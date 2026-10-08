package it.fast4x.riplay.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Album
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.PlaylistPlay
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.AssistChip
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
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import it.fast4x.riplay.model.FeaturedArtist
import it.fast4x.riplay.model.Song
import it.fast4x.riplay.state.AppState
import it.fast4x.riplay.ui.components.SongRow
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

private data class Filter(val key: String?, val label: String)

private val FILTERS = listOf(
    Filter(null, "Tutto"),
    Filter("songs", "Brani"),
    Filter("videos", "Video"),
    Filter("albums", "Album"),
    Filter("artists", "Artisti"),
)

private fun kindIcon(kind: String): ImageVector = when (kind) {
    "album" -> Icons.Default.Album
    "artist" -> Icons.Default.Person
    "playlist" -> Icons.Default.PlaylistPlay
    else -> Icons.Default.MusicNote
}

private fun kindLabel(kind: String): String = when (kind) {
    "album" -> "Album"
    "artist" -> "Artista"
    "playlist" -> "Playlist"
    "video" -> "Video"
    else -> "Brano"
}


@Composable
private fun SearchMain(state: AppState, scope: CoroutineScope) {
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

        if (input.isNotBlank() || state.searchResults.isNotEmpty()) {
            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
            ) {
                items(FILTERS) { f ->
                    AssistChip(
                        onClick = {
                            if (!state.searchLoading && input.isNotBlank()) {
                                scope.launch { state.search(input, f.key) }
                            }
                        },
                        label = { Text(f.label + if (state.searchFilter == f.key) " ✓" else "") },
                    )
                }
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
                    Text("Ricerca in corso…", color = MaterialTheme.colorScheme.onSurfaceVariant)
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
            state.searchResults.isNotEmpty() || state.featuredArtist != null -> {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                    modifier = Modifier.fillMaxSize().padding(top = 12.dp),
                ) {
                    state.featuredArtist?.let { artist ->
                        item(key = "featured") {
                            FeaturedCard(artist) {
                                artist.browseId?.let { id ->
                                    scope.launch { state.openDetail("artist", id, artist.title) }
                                }
                            }
                        }
                    }
                    items(state.searchResults, key = { it.id }) { song ->
                        if (song.isPlayable) {
                            SongRow(
                                song = song,
                                isActive = state.currentSong?.id == song.id,
                                isFavorite = state.isFavorite(song),
                                onClick = {
                                    val playable = state.searchResults.filter { it.isPlayable }
                                    state.play(song, items = playable)
                                },
                                onToggleFavorite = { state.toggleFavorite(song) },
                            )
                        } else {
                            BrowseRow(song) {
                                song.browseId?.let { id ->
                                    scope.launch { state.openDetail(song.kind, id, song.title) }
                                }
                            }
                        }
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

/** Card dell'artista in evidenza (nome, ascoltatori, thumbnail) */
@Composable
private fun FeaturedCard(artist: FeaturedArtist, onOpen: () -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(MaterialTheme.colorScheme.primaryContainer)
            .clickable(enabled = artist.browseId != null) { onOpen() }
            .padding(14.dp),
    ) {
        if (artist.thumbnail.isNotBlank()) {
            AsyncImage(
                model = artist.thumbnail,
                contentDescription = null,
                modifier = Modifier.size(64.dp).clip(RoundedCornerShape(50)),
            )
        } else {
            Icon(
                Icons.Default.Person,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onPrimaryContainer,
                modifier = Modifier.size(48.dp),
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                artist.title,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onPrimaryContainer,
            )
            if (artist.subtitle.isNotBlank()) {
                Text(
                    artist.subtitle,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                )
            }
            Text(
                "Tocca per vedere i top brani",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onPrimaryContainer,
            )
        }
    }
}

/** Riga per album/playlist/artista: apre il dettaglio invece di suonare */
@Composable
private fun BrowseRow(song: Song, onOpen: () -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .clickable(enabled = song.browseId != null) { onOpen() }
            .padding(horizontal = 8.dp, vertical = 8.dp),
    ) {
        Box(
            modifier = Modifier
                .size(44.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant),
            contentAlignment = Alignment.Center,
        ) {
            if (song.thumbnail.isNotBlank()) {
                AsyncImage(
                    model = song.thumbnail,
                    contentDescription = null,
                    modifier = Modifier.size(44.dp).clip(RoundedCornerShape(8.dp)),
                )
            } else {
                Icon(
                    kindIcon(song.kind),
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                song.title,
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Medium,
                maxLines = 1,
            )
            Text(
                kindLabel(song.kind) + " - apri",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
            )
        }
    }
}

/** Vista dettaglio artista/album: titolo + lista brani */
@Composable
private fun DetailView(state: AppState) {
    Column(modifier = Modifier.fillMaxSize().padding(20.dp)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
        ) {
            Icon(
                Icons.Default.ArrowBack,
                contentDescription = "Indietro",
                tint = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier
                    .size(32.dp)
                    .clip(RoundedCornerShape(50))
                    .clickable { state.closeDetail() }
                    .padding(4.dp),
            )
            Text(
                state.detailTitle.ifBlank { "Dettaglio" },
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
            )
        }
        when {
            state.detailLoading -> {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.padding(top = 16.dp),
                ) {
                    CircularProgressIndicator()
                    Text("Caricamento…", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            state.detailError != null -> {
                Text(
                    "⚠ ${state.detailError}",
                    color = MaterialTheme.colorScheme.secondary,
                    modifier = Modifier.padding(top = 16.dp),
                )
            }
            state.detailItems.isNotEmpty() -> {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                    modifier = Modifier.fillMaxSize(),
                ) {
                    items(state.detailItems, key = { it.id }) { song ->
                        SongRow(
                            song = song,
                            isActive = state.currentSong?.id == song.id,
                            isFavorite = state.isFavorite(song),
                            onClick = {
                                state.play(song, items = state.detailItems.toList())
                            },
                            onToggleFavorite = { state.toggleFavorite(song) },
                        )
                    }
                }
            }
            else -> {
                Text(
                    "Nessun brano trovato.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 16.dp),
                )
            }
        }
    }
}

@Composable
fun SearchScreen(state: AppState) {
    // Le operazioni di rete girano su state.appScope: sopravvivono allo swap
    // SearchMain <-> DetailView. Se fossero lanciate dallo scope di SearchMain,
    // la coroutine di openDetail() verrebbe cancellata appena la vista dettaglio
    // sostituisce SearchMain (e il fetch non porterebbe a termine).
    if (state.isDetailOpen) {
        DetailView(state)
        return
    }
    SearchMain(state, state.appScope)
}
