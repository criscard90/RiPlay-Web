package it.fast4x.riplay.state

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import it.fast4x.riplay.api.ApiClient
import it.fast4x.riplay.model.FeaturedArtist
import it.fast4x.riplay.model.Song
import it.fast4x.riplay.player.WebPlayer
import it.fast4x.riplay.storage.LocalStore
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

enum class Page { HOME, SEARCH, FAVORITES, SETTINGS }

/** Stato globale dell'app (single source of truth) */
class AppState {
    var page by mutableStateOf(Page.HOME)

    // --- Ricerca ---
    var searchQuery by mutableStateOf("")
    var searchResults = mutableStateListOf<Song>()
    var featuredArtist by mutableStateOf<FeaturedArtist?>(null)
    var searchLoading by mutableStateOf(false)
    var searchError by mutableStateOf<String?>(null)
    var searchFilter by mutableStateOf<String?>(null) // null=tutto, songs|videos|albums|artists

    // --- Dettaglio artista/album ---
    var detailTitle by mutableStateOf("")
    var detailItems = mutableStateListOf<Song>()
    var detailLoading by mutableStateOf(false)
    var detailError by mutableStateOf<String?>(null)

    // --- Coda di riproduzione ---
    val queue = mutableStateListOf<Song>()
    var queueIndex by mutableStateOf(-1)
    val currentSong: Song?
        get() = queue.getOrNull(queueIndex)

    // --- Player (aggiornato dal poll) ---
    var isPlaying by mutableStateOf(false)
    var position by mutableStateOf(0.0)
    var duration by mutableStateOf(0.0)
    var buffering by mutableStateOf(false)

    // --- Preferiti ---
    val favorites = mutableStateListOf<Song>()

    // --- Impostazioni ---
    var apiBaseUrl by mutableStateOf(ApiClient.baseUrl)

    init {
        loadFavorites()
        loadQueue()
    }

    // ================= Ricerca =================

    suspend fun search(query: String, filter: String? = searchFilter) {
        searchQuery = query
        searchFilter = filter
        // Nuova ricerca -> chiudi eventuale dettaglio
        closeDetail()
        searchLoading = true
        searchError = null
        try {
            val response = ApiClient.search(query, filter)
            searchResults.clear()
            searchResults.addAll(response.items)
            featuredArtist = response.featured?.takeIf { it.title.isNotBlank() }
        } catch (e: Exception) {
            searchError = e.message ?: "Errore di rete"
            searchResults.clear()
            featuredArtist = null
        } finally {
            searchLoading = false
        }
    }

    // ================= Dettaglio artista/album =================

    /** Apre artista (browseId UC...) o album (browseId MPRE...) */
    suspend fun openDetail(kind: String, browseId: String, fallbackTitle: String = "") {
        detailTitle = fallbackTitle
        detailItems.clear()
        detailError = null
        detailLoading = true
        try {
            val response = if (kind == "artist") ApiClient.artist(browseId)
            else ApiClient.album(browseId)
            detailItems.clear()
            detailItems.addAll(response.items)
            if (response.title.isNotBlank()) detailTitle = response.title
            else if (detailTitle.isBlank()) detailTitle = fallbackTitle
        } catch (e: Exception) {
            detailError = e.message ?: "Errore di rete"
        } finally {
            detailLoading = false
        }
    }

    fun closeDetail() {
        detailTitle = ""
        detailItems.clear()
        detailError = null
        detailLoading = false
    }

    val isDetailOpen: Boolean get() = detailTitle.isNotBlank() || detailItems.isNotEmpty() || detailLoading

    // ================= Coda / playback =================

    /** Avvia la riproduzione di song, usando items come coda (se fornita) */
    fun play(song: Song, items: List<Song>? = null) {
        if (!song.isPlayable) return
        val playable = items?.filter { it.isPlayable }
        if (playable != null) {
            queue.clear()
            queue.addAll(playable)
        } else if (!queue.contains(song)) {
            queue.add(song)
        }
        queueIndex = queue.indexOf(song).let { if (it >= 0) it else queue.lastIndex }
        WebPlayer.load(song.playId)
        WebPlayer.showHost()
        persistQueue()
    }

    fun togglePlayPause() {
        if (currentSong == null) return
        if (isPlaying) WebPlayer.pause() else WebPlayer.play()
    }

    fun next() {
        if (queueIndex < queue.lastIndex) {
            queueIndex++
            WebPlayer.load(queue[queueIndex].playId)
            WebPlayer.showHost()
            persistQueue()
        }
    }

    fun previous() {
        // Se oltre 3 secondi ripartiti dall'inizio, altrimenti canzone precedente
        if (position > 3.0) {
            WebPlayer.seek(0.0)
        } else if (queueIndex > 0) {
            queueIndex--
            WebPlayer.load(queue[queueIndex].playId)
            WebPlayer.showHost()
            persistQueue()
        }
    }

    fun seek(fraction: Float) {
        if (duration > 0) WebPlayer.seek(duration * fraction)
    }

    /** Chiamato dal poll quando la traccia finisce */
    fun onTrackEnded() {
        next()
    }

    /** Aggiorna position/duration/isPlaying — chiamato dal loop di polling */
    fun pollPlayer() {
        position = WebPlayer.position()
        duration = WebPlayer.duration()
        val st = WebPlayer.state()
        isPlaying = st == it.fast4x.riplay.player.PlaybackState.Playing
        buffering = st == it.fast4x.riplay.player.PlaybackState.Buffering
    }

    // ================= Preferiti =================

    fun isFavorite(song: Song): Boolean = favorites.any { it.id == song.id }

    fun toggleFavorite(song: Song) {
        val idx = favorites.indexOfFirst { it.id == song.id }
        if (idx >= 0) favorites.removeAt(idx) else favorites.add(0, song)
        persistFavorites()
    }

    private fun persistFavorites() {
        runCatching { LocalStore.set(KEY_FAVORITES, Json.encodeToString(favorites.toList())) }
    }

    private fun loadFavorites() {
        runCatching {
            LocalStore.get(KEY_FAVORITES)?.let { raw ->
                favorites.addAll(Json.decodeFromString<List<Song>>(raw))
            }
        }
    }

    private fun persistQueue() {
        runCatching {
            LocalStore.set(KEY_QUEUE, Json.encodeToString(queue.toList()))
            LocalStore.set(KEY_QUEUE_INDEX, queueIndex.toString())
        }
    }

    private fun loadQueue() {
        runCatching {
            LocalStore.get(KEY_QUEUE)?.let { raw ->
                queue.addAll(Json.decodeFromString<List<Song>>(raw))
            }
            queueIndex = LocalStore.get(KEY_QUEUE_INDEX)?.toIntOrNull() ?: -1
            if (queueIndex >= queue.size) queueIndex = -1
        }
    }

    companion object {
        private const val KEY_FAVORITES = "riplay.favorites"
        private const val KEY_QUEUE = "riplay.queue"
        private const val KEY_QUEUE_INDEX = "riplay.queueIndex"
    }
}

@Composable
fun rememberAppState(): AppState = remember { AppState() }
