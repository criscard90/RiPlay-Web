package it.fast4x.riplay.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Fullscreen
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.SkipPrevious
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import it.fast4x.riplay.player.WebPlayer
import it.fast4x.riplay.state.AppState

@Composable
fun PlayerBar(state: AppState) {
    val song = state.currentSong
    val surface = MaterialTheme.colorScheme.surfaceVariant
    val accent = MaterialTheme.colorScheme.primary

    // Seek interattivo: durante il drag mostriamo il valore provvisorio
    var scrubbing by remember { mutableStateOf<Float?>(null) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surface)
            .padding(horizontal = 16.dp, vertical = 10.dp)
    ) {
        // Barra di avanzamento
        val fraction = scrubbing ?: if (state.duration > 0)
            (state.position / state.duration).toFloat().coerceIn(0f, 1f) else 0f

        Slider(
            value = fraction,
            onValueChange = { scrubbing = it },
            onValueChangeFinished = {
                scrubbing?.let { state.seek(it) }
                scrubbing = null
            },
            colors = SliderDefaults.colors(
                thumbColor = accent,
                activeTrackColor = accent,
                inactiveTrackColor = surface,
            ),
            modifier = Modifier.fillMaxWidth().padding(bottom = 4.dp),
        )

        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            // Thumbnail + info
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(surface),
                contentAlignment = Alignment.Center
            ) {
                if (song != null && song.thumbnail.isNotEmpty()) {
                    AsyncImage(
                        model = song.thumbnail,
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.size(44.dp),
                    )
                } else {
                    Icon(
                        Icons.Default.MusicNote,
                        contentDescription = null,
                        tint = accent,
                        modifier = Modifier.size(22.dp),
                    )
                }
            }

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    song?.title ?: "Nessuna traccia in riproduzione",
                    style = MaterialTheme.typography.bodyMedium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                if (song != null && song.artist.isNotEmpty()) {
                    Text(
                        song.artist,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }

            // Tempi
            if (song != null && state.duration > 0) {
                Text(
                    "${formatTime(state.position)} / ${formatTime(state.duration)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            // Controlli
            Icon(
                Icons.Default.SkipPrevious,
                contentDescription = "Precedente",
                tint = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier
                    .size(28.dp)
                    .clip(RoundedCornerShape(50))
                    .clickable(enabled = song != null) { state.previous() }
                    .padding(4.dp),
            )
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(50))
                    .background(accent)
                    .clickable(enabled = song != null) { state.togglePlayPause() },
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    if (state.isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                    contentDescription = if (state.isPlaying) "Pausa" else "Riproduci",
                    tint = MaterialTheme.colorScheme.onPrimary,
                    modifier = Modifier.size(26.dp),
                )
            }
            Icon(
                Icons.Default.SkipNext,
                contentDescription = "Successiva",
                tint = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier
                    .size(28.dp)
                    .clip(RoundedCornerShape(50))
                    .clickable(enabled = song != null) { state.next() }
                    .padding(4.dp),
            )

            // Preferito corrente
            if (song != null) {
                Icon(
                    if (state.isFavorite(song)) Icons.Default.Favorite
                    else Icons.Default.FavoriteBorder,
                    contentDescription = "Preferito",
                    tint = if (state.isFavorite(song)) MaterialTheme.colorScheme.secondary
                    else MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier
                        .size(22.dp)
                        .clip(RoundedCornerShape(50))
                        .clickable { state.toggleFavorite(song) }
                        .padding(2.dp),
                )
            }

            // Espandi/nascondi video
            if (song != null) {
                Icon(
                    Icons.Default.Fullscreen,
                    contentDescription = "Ingrandisci video",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier
                        .size(22.dp)
                        .clip(RoundedCornerShape(50))
                        .clickable { WebPlayer.toggleExpand() }
                        .padding(2.dp),
                )
            }
        }

        if (state.buffering) {
            LinearProgressIndicator(
                modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
                color = accent,
            )
        }
    }
}

private fun formatTime(seconds: Double): String {
    val total = seconds.toInt()
    val h = total / 3600
    val m = (total % 3600) / 60
    val s = total % 60
    // NB: String.format non esiste su wasmJs -> padding manuale
    return if (h > 0) "$h:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}"
    else "$m:${s.toString().padStart(2, '0')}"
}
