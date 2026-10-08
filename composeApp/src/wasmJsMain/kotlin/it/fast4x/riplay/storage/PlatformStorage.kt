package it.fast4x.riplay.storage

import kotlin.js.JsName

@JsName("localStorage")
private external val localStorage: WebLocalStorage

external interface WebLocalStorage {
    fun getItem(key: String): String?
    fun setItem(key: String, value: String)
    fun removeItem(key: String)
}

actual object LocalStore {
    actual fun get(key: String): String? = localStorage.getItem(key)
    actual fun set(key: String, value: String) = localStorage.setItem(key, value)
    actual fun remove(key: String) = localStorage.removeItem(key)
}
