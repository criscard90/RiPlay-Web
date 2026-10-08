package it.fast4x.riplay.player

import kotlin.js.JsAny

/**
 * Dichiarazioni external verso window.riplay (definito in resources/bridge.js).
 * Unico punto di contatto con la YouTube IFrame Player API.
 */
external interface RiPlayJsBridge : JsAny {
    fun load(videoId: String): Boolean
    fun play()
    fun pause()
    fun seek(seconds: Double)
    fun setVolume(value: Int)
    fun getPosition(): Double
    fun getDuration(): Double
    fun getState(): Int
    fun isReady(): Boolean
    fun getCurrentVideoId(): String?
    fun showHost()
    fun hideHost()
    fun toggleExpand(): Boolean
    fun stop()
}

// Globale creato da bridge.js
@JsName("riplay")
private external val riplay: RiPlayJsBridge

actual object WebPlayer {
    actual fun load(videoId: String): Boolean = riplay.load(videoId)
    actual fun play() = riplay.play()
    actual fun pause() = riplay.pause()
    actual fun seek(seconds: Double) = riplay.seek(seconds)
    actual fun setVolume(value: Int) = riplay.setVolume(value)
    actual fun position(): Double = riplay.getPosition()
    actual fun duration(): Double = riplay.getDuration()
    actual fun isReady(): Boolean = riplay.isReady()
    actual fun currentVideoId(): String? = riplay.getCurrentVideoId()
    actual fun showHost() = riplay.showHost()
    actual fun hideHost() = riplay.hideHost()
    actual fun toggleExpand(): Boolean = riplay.toggleExpand()
    actual fun stop() = riplay.stop()

    actual fun state(): PlaybackState = when (riplay.getState()) {
        1 -> PlaybackState.Playing
        2 -> PlaybackState.Paused
        3 -> PlaybackState.Buffering
        0 -> PlaybackState.Ended
        -2 -> PlaybackState.Error
        else -> PlaybackState.Idle
    }
}
