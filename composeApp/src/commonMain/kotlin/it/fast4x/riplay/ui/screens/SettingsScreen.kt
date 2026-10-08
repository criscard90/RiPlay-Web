package it.fast4x.riplay.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import it.fast4x.riplay.api.ApiClient
import it.fast4x.riplay.state.AppState

@Composable
fun SettingsScreen(state: AppState) {
    var urlInput by remember { mutableStateOf(state.apiBaseUrl) }

    Column(
        modifier = Modifier.fillMaxSize().padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            "Impostazioni",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
        )

        Text(
            "URL del proxy (Cloudflare Worker)",
            style = MaterialTheme.typography.titleMedium,
        )
        Text(
            "Il proxy serve a superare il blocco CORS di YouTube: le ricerche " +
                    "passano dal tuo worker, mai da server terzi non controllati. " +
                    "In sviluppo locale usa http://localhost:8787.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        OutlinedTextField(
            value = urlInput,
            onValueChange = { urlInput = it },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = MaterialTheme.colorScheme.primary,
            ),
        )

        Button(
            onClick = {
                val normalized = urlInput.trim().trimEnd('/')
                ApiClient.baseUrl = normalized
                state.apiBaseUrl = normalized
            },
        ) {
            Text("Salva")
        }

        if (state.apiBaseUrl == ApiClient.baseUrl) {
            Text(
                "✓ Proxy attivo: ${state.apiBaseUrl}",
                color = MaterialTheme.colorScheme.primary,
                style = MaterialTheme.typography.bodySmall,
            )
        }

        Text(
            "RiPlay Web — client non ufficiale per RiPlay (GPL-3.0). " +
                    "La riproduzione usa l'embed YouTube ufficiale (IFrame API).",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 24.dp),
        )
    }
}
