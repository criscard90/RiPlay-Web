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
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import it.fast4x.riplay.state.AppState
import it.fast4x.riplay.ui.components.SongRow

@Composable
fun FavoritesScreen(state: AppState) {
    Column(modifier = Modifier.fillMaxSize().padding(20.dp)) {
        Text(
            "Preferiti",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(bottom = 12.dp),
        )

        if (state.favorites.isEmpty()) {
            Text(
                "Nessun preferito: tocca il cuore su una canzone per salvarla qui.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                items(state.favorites, key = { it.id }) { song ->
                    SongRow(
                        song = song,
                        isActive = state.currentSong?.id == song.id,
                        isFavorite = true,
                        onClick = { state.play(song, items = state.favorites.toList()) },
                        onToggleFavorite = { state.toggleFavorite(song) },
                    )
                }
            }
        }
    }
}
