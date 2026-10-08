package it.fast4x.riplay.api

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.get
import io.ktor.client.request.parameter
import io.ktor.http.HttpStatusCode
import io.ktor.serialization.kotlinx.json.json
import it.fast4x.riplay.model.BrowseResponse
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
 *   GET {base}/search?q=QUERY[&type=songs|videos|albums|artists] -> SearchResponse
 *   GET {base}/artist?browseId=UC... -> BrowseResponse (top brani artista)
 *   GET {base}/album?browseId=MPRE... -> BrowseResponse (brani album)
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

    suspend fun search(query: String, type: String? = null): SearchResponse {
        if (query.isBlank()) return SearchResponse()
        val response = client.get("$baseUrl/search") {
            parameter("q", query)
            if (type != null) parameter("type", type)
        }
        if (response.status != HttpStatusCode.OK) {
            throw IllegalStateException("API error: HTTP ${response.status.value}")
        }
        return response.body<SearchResponse>()
    }

    /** Top brani di un artista (browseId UC...) */
    suspend fun artist(browseId: String): BrowseResponse =
        browse("artist", browseId)

    /** Brani di un album (browseId MPRE...) */
    suspend fun album(browseId: String): BrowseResponse =
        browse("album", browseId)

    private suspend fun browse(endpoint: String, browseId: String): BrowseResponse {
        val response = client.get("$baseUrl/$endpoint") {
            parameter("browseId", browseId)
        }
        if (response.status != HttpStatusCode.OK) {
            throw IllegalStateException("API error: HTTP ${response.status.value}")
        }
        return response.body<BrowseResponse>()
    }
}
