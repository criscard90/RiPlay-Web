import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.window.ComposeViewport
import it.fast4x.riplay.App
import it.fast4x.riplay.state.rememberAppState
import kotlinx.browser.document

@OptIn(ExperimentalComposeUiApi::class)
fun main() {
    // ComposeViewport CANCELLA i figli esistenti del container passato.
    // Su document.body rimuoverebbe #riplay-player-host (bridge.js del player
    // YouTube), che quindi non verrebbe più trovato al primo play.
    // Montiamo invece nel contenitore dedicato #ComposeTarget.
    val target = document.getElementById("ComposeTarget")
        ?: error("Missing #ComposeTarget element in index.html")
    ComposeViewport(target) {
        val appState = rememberAppState()
        App(appState)
    }
}
