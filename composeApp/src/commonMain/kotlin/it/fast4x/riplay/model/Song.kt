package it.fast4x.riplay.model

import kotlinx.serialization.Serializable

@Serializable
data class Song(
    val id: String,                 // videoId YouTube (o "browse:XXX" per album/playlist)
    val title: String,
    val artist: String = "",
    val album: String = "",
    val duration: Int = 0,          // secondi
    val thumbnail: String = "",
    val isExplicit: Boolean = false,
    // Campi estesi dal worker (ignora sconosciuti in lettura grazie a ignoreUnknownKeys)
    val kind: String = "song",      // song | album | artist | playlist | video
    val browseId: String? = null,   // per aprire artista/album
    val videoId: String? = null,    // videoId diretto quando disponibile
    val subtitle: String = "",      // sottotitolo grezzo (es. "Singolo • 2021" per gli album)
) {
    /** Vere tracce riproducibili (con videoId) */
    val isPlayable: Boolean get() = (videoId ?: id.takeIf { !it.startsWith("browse:") }) != null
    /** Id da passare al player */
    val playId: String get() = videoId ?: id

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
data class FeaturedArtist(
    val title: String = "",
    val browseId: String? = null,
    val subtitle: String = "",
    val thumbnail: String = "",
)

@Serializable
data class SearchResponse(
    val items: List<Song> = emptyList(),
    val featured: FeaturedArtist? = null,
)

/**
 * Sezione della pagina artista (es. "Brani in evidenza", "Album",
 * "Singoli ed EP", "Video"): il worker separa gli shelf di YouTube Music.
 */
@Serializable
data class DetailSection(
    val title: String = "",
    val items: List<Song> = emptyList(),
)

@Serializable
data class BrowseResponse(
    val items: List<Song> = emptyList(),
    val title: String = "",
    val sections: List<DetailSection> = emptyList(),
)
