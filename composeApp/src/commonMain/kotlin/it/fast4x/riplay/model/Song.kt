package it.fast4x.riplay.model

import kotlinx.serialization.Serializable

@Serializable
data class Song(
    val id: String,                 // videoId YouTube
    val title: String,
    val artist: String = "",
    val album: String = "",
    val duration: Int = 0,          // secondi
    val thumbnail: String = "",
    val isExplicit: Boolean = false,
) {
    val durationText: String
        get() {
            val h = duration / 3600
            val m = (duration % 3600) / 60
            val s = duration % 60
            // NB: String.format non esiste su wasmJs -> padding manuale
            return if (h > 0) "$h:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}"
            else "$m:${s.toString().padStart(2, '0')}"
        }
}

@Serializable
data class SearchResponse(
    val items: List<Song> = emptyList(),
)
