package it.fast4x.riplay.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import it.fast4x.riplay.state.AppState
import it.fast4x.riplay.ui.components.SongRow
import kotlinx.coroutines.launch

@Composable
fun SearchScreen(state: AppState) {
    val scope = rememberCoroutineScope()
    var input by remember { mutableStateOf(state.searchQuery) }

    Column(modifier = Modifier.fillMaxSize().padding(20.dp)) {
        Text(
            "Cerca",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(bottom = 12.dp),
        )

        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxWidth(),
        ) {
            OutlinedTextField(
                value = input,
                onValueChange = { input = it },
                placeholder = { Text("Artista, brano, album…") },
                singleLine = true,
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                modifier = Modifier.weight(1f),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = MaterialTheme.colorScheme.primary,
                    unfocusedBorderColor = MaterialTheme.colorScheme.outline,
                ),
            )
            Button(
                onClick = { scope.launch { state.search(input) } },
                enabled = !state.searchLoading && input.isNotBlank(),
            ) {
                Text("Cerca")
            }
        }

        when {
            state.searchLoading -> {
                Row(
                    modifier = Modifier.padding(top = 24.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    CircularProgressIndicator(modifier = Modifier.padding(4.dp))
                    Text(
                        "Ricerca in corso…",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            state.searchError != null -> {
                Text(
                    "⚠ ${state.searchError}",
                    color = MaterialTheme.colorScheme.secondary,
                    modifier = Modifier.padding(top = 16.dp),
                )
                Text(
                    "Controlla l'URL del proxy nelle impostazioni.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            state.searchResults.isNotEmpty() -> {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                    modifier = Modifier.fillMaxSize().padding(top = 12.dp),
                ) {
                    items(state.searchResults, key = { it.id }) { song ->
                        SongRow(
                            song = song,
                            isActive = state.currentSong?.id == song.id,
                            isFavorite = state.isFavorite(song),
                            onClick = {
                                state.play(song, items = state.searchResults.toList())
                            },
                            onToggleFavorite = { state.toggleFavorite(song) },
                        )
                    }
                }
            }

            else -> {
                Text(
                    "Cosa vuoi ascoltare?",
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 24.dp),
                )
            }
        }
    }
}
