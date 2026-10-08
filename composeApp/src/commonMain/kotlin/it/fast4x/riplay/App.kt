package it.fast4x.riplay

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import it.fast4x.riplay.player.PlaybackState
import it.fast4x.riplay.player.WebPlayer
import it.fast4x.riplay.state.AppState
import it.fast4x.riplay.state.Page
import it.fast4x.riplay.ui.RiPlayTheme
import it.fast4x.riplay.ui.components.PlayerBar
import it.fast4x.riplay.ui.screens.FavoritesScreen
import it.fast4x.riplay.ui.screens.HomeScreen
import it.fast4x.riplay.ui.screens.SearchScreen
import it.fast4x.riplay.ui.screens.SettingsScreen
import kotlinx.coroutines.delay

@Composable
fun App(state: AppState) {
    RiPlayTheme {
        // Loop di polling dello stato player (~4 fps: sufficiente e leggero)
        LaunchedEffect(Unit) {
            while (true) {
                state.pollPlayer()
                // Fine traccia -> avanza automaticamente
                if (WebPlayer.state() == PlaybackState.Ended) state.onTrackEnded()
                delay(250)
            }
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
        ) {
            Row(modifier = Modifier.weight(1f).fillMaxWidth()) {
                Sidebar(state)
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxHeight()
                        .padding(top = 12.dp, end = 12.dp, bottom = 12.dp)
                        .clip(RoundedCornerShape(topEnd = 16.dp, bottomEnd = 16.dp))
                        .background(MaterialTheme.colorScheme.surface)
                ) {
                    when (state.page) {
                        Page.HOME -> HomeScreen(state)
                        Page.SEARCH -> SearchScreen(state)
                        Page.FAVORITES -> FavoritesScreen(state)
                        Page.SETTINGS -> SettingsScreen(state)
                    }
                }
            }
            PlayerBar(state)
        }
    }
}

private data class NavItem(val page: Page, val label: String, val icon: ImageVector)

@Composable
private fun Sidebar(state: AppState) {
    val items = remember {
        listOf(
            NavItem(Page.HOME, "Home", Icons.Default.Home),
            NavItem(Page.SEARCH, "Cerca", Icons.Default.Search),
            NavItem(Page.FAVORITES, "Preferiti", Icons.Default.Favorite),
            NavItem(Page.SETTINGS, "Impostazioni", Icons.Default.Settings),
        )
    }

    Column(
        modifier = Modifier
            .width(200.dp)
            .fillMaxHeight()
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(8.dp, 16.dp, 8.dp, 24.dp)
        ) {
            Text(
                "♪ ",
                color = MaterialTheme.colorScheme.primary,
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold
            )
            Text(
                "RiPlay Web",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
            )
        }

        items.forEach { item ->
            val selected = state.page == item.page
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(10.dp))
                    .background(
                        if (selected) MaterialTheme.colorScheme.surfaceVariant
                        else MaterialTheme.colorScheme.background
                    )
                    .clickable { state.page = item.page }
                    .padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Icon(
                    item.icon,
                    contentDescription = item.label,
                    modifier = Modifier.size(20.dp),
                    tint = if (selected) MaterialTheme.colorScheme.primary
                    else MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    item.label,
                    style = MaterialTheme.typography.bodyMedium,
                    color = if (selected) MaterialTheme.colorScheme.onSurface
                    else MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}