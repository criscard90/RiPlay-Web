package it.fast4x.riplay.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import it.fast4x.riplay.model.Song
import it.fast4x.riplay.state.AppState
import it.fast4x.riplay.state.Page
import it.fast4x.riplay.ui.components.SongRow
import kotlinx.coroutines.launch

/**
 * Home: riepilogo coda corrente + preferiti + suggerimenti di ricerca rapidi.
 */
@Composable
fun HomeScreen(state: AppState) {
    val scope = rememberCoroutineScope()
    Column(modifier = Modifier.fillMaxSize().padding(20.dp)) {
        Text(
            "Ciao!",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
        )
        Text(
            "Cerca e ascolta, tutto dal browser.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(bottom = 16.dp),
        )

        // Ricerche rapide
        Text(
            "Ricerche rapide",
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.padding(vertical = 8.dp),
        )
        val quickQueries = listOf(
            "Trending Italia", "Lofi beats", "Hit 90s", "Rock classico", "Jazz relax",
        )
        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(4.dp),
            modifier = Modifier.weight(1f),
        ) {
            items(quickQueries) { q ->
                SongRow(
                    song = Song(
                        id = "quick-$q",
                        title = q,
                        artist = "Avvia la ricerca",
                    ),
                    isActive = false,
                    isFavorite = false,
                    onClick = {
                        state.page = Page.SEARCH
                        scope.launch { state.search(q) }
                    },
                    onToggleFavorite = {},
                )
            }
        }
    }
}
