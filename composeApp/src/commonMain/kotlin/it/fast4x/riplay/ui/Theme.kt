package it.fast4x.riplay.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Palette ispirata a RiPlay (accent viola/rosso su superfici scure)
private val AppColorScheme = darkColorScheme(
    primary = Color(0xFF9C6CFF),
    onPrimary = Color(0xFF1B1B1F),
    secondary = Color(0xFFE91E63),
    background = Color(0xFF111114),
    onBackground = Color(0xFFECECF1),
    surface = Color(0xFF17171C),
    onSurface = Color(0xFFECECF1),
    surfaceVariant = Color(0xFF1F1F26),
    onSurfaceVariant = Color(0xFFB6B6C0),
    outline = Color(0xFF34343E),
)

@Composable
fun RiPlayTheme(content: @Composable () -> Unit) {
    // Web: usiamo sempre il tema scuro (coerente con il design desktop)
    MaterialTheme(
        colorScheme = AppColorScheme,
        content = content,
    )
}
