package it.fast4x.riplay.player

/** Stato del player mappato dagli stati YouTube */
sealed interface PlaybackState {
    data object Idle : PlaybackState
    data object Playing : PlaybackState
    data object Paused : PlaybackState
    data object Buffering : PlaybackState
    data object Ended : PlaybackState
    data object Error : PlaybackState
}

/**
 * Ponte verso il player (YouTube IFrame API tramite bridge.js).
 * Implementazione in wasmJsMain/WebPlayer.kt
 */
expect object WebPlayer {
    fun load(videoId: String): Boolean
    fun play()
    fun pause()
    fun seek(seconds: Double)
    fun setVolume(value: Int)
    fun position(): Double
    fun duration(): Double
    fun state(): PlaybackState
    fun isReady(): Boolean
    fun currentVideoId(): String?
    fun showHost()
    fun hideHost()
    fun toggleExpand(): Boolean
    fun stop()
}
