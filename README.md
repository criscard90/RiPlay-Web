# RiPlay Web 🎵

Port web di [RiPlay](https://github.com/fast4x/RiPlay) — fruibile da browser su PC
senza installare APK o eseguire binari: basta aprire un URL (GitHub Pages).

## Architettura

```
Browser (PC, nessuna installazione)
 └─ GitHub Pages → UI RiPlay (Compose Multiplatform / WASM)
      │  fetch() verso...
 └─ Cloudflare Worker (gratuito, codice open in worker/)
      └─ proxy CORS → YouTube InnerTube API (search)
Playback:
 └─ YouTube IFrame Player API nel browser (nessun CORS per il playback via iframe)
Storage:
 └─ localStorage del browser (preferiti, coda, volume) — nessun dato lascia il PC
```

## Sviluppo locale

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
.\gradlew.bat :composeApp:wasmJsBrowserDevelopmentRun
```

Poi aprire http://localhost:8080 e avviare il worker locale:

```bash
cd worker
npm install
npm run dev   # http://localhost:8787
```

Per puntare l'app a un worker diverso, impostare prima del caricamento:

```html
<script>window.__RIPLAY_API__ = "https://riplay-proxy.<tuo-sub>.workers.dev";</script>
```

## Deploy

- **GitHub Pages**: workflow `.github/workflows/pages.yml` — build WASM + publish automatico.
- **Worker**: `cd worker && npm run deploy` (serve `wrangler login`).

## Sicurezza

- Nessun eseguibile da installare: solo pagine statiche + chiamate HTTPS.
- Il proxy è trasparente: tutto il codice è in `worker/src/index.js`.
- Nessun account, nessun tracking: i dati restano in `localStorage`.
