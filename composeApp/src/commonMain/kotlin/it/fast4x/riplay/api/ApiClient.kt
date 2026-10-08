package it.fast4x.riplay.api

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import io.ktor.http.HttpStatusCode
import io.ktor.serialization.kotlinx.json.json
import it.fast4x.riplay.model.SearchResponse
import it.fast4x.riplay.model.Song
import kotlinx.serialization.json.Json

// NB: js() richiede opt-in ExperimentalWasmJsInterop su wasmJs.
@OptIn(kotlin.js.ExperimentalWasmJsInterop::class)
private fun resolveBaseUrl(): String = js("window.__RIPLAY_API__ || 'http://localhost:8787'")

/**
 * Client HTTP verso il Cloudflare Worker (proxy CORS verso InnerTube).
 *
 * Il worker espone:
 *   GET {base}/search?q=QUERY      -> SearchResponse (JSON)
 *
 * In sviluppo locale si imposta http://localhost:8787
 * In produzione l'URL del worker (es. https://riplay-proxy.tuo-sub.workers.dev)
 */
object ApiClient {

    /**
     * URL del worker: iniettato dall'host via `window.__RIPLAY_API__`
     * (impostato in index.html), altrimenti fallback locale.
     */
    var baseUrl: String = resolveBaseUrl()

    private val client = HttpClient {
        install(ContentNegotiation) {
            json(Json {
                ignoreUnknownKeys = true
                isLenient = true
            })
        }
    }

    suspend fun search(query: String): List<Song> {
        if (query.isBlank()) return emptyList()
        val response = client.get("$baseUrl/search") {
            parameter("q", query)
        }
        if (response.status != HttpStatusCode.OK) {
            throw IllegalStateException("API error: HTTP ${response.status.value}")
        }
        return response.body<SearchResponse>().items
    }
}
