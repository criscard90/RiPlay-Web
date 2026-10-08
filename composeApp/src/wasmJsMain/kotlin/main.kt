import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.window.ComposeViewport
import it.fast4x.riplay.App
import it.fast4x.riplay.state.rememberAppState
import kotlinx.browser.document

@OptIn(ExperimentalComposeUiApi::class)
fun main() {
    ComposeViewport(document.body!!) {
        val appState = rememberAppState()
        App(appState)
    }
}
