package it.fast4x.riplay.storage

/**
 * Persistenza locale (localStorage) per coda, preferiti e preferenze.
 * Le funzioni JS sono in wasmJsMain/PlatformStorage.kt
 */
expect object LocalStore {
    fun get(key: String): String?
    fun set(key: String, value: String)
    fun remove(key: String)
}
