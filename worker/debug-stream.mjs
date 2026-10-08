// Test endpoint /stream audio-only: chiama youtubei player (client ANDROID,
// niente po_token), sceglie il miglior formato audio e ne verifica l'URL.
// Uso: node debug-stream.mjs [videoId]
const KEY = "AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30";
const videoId = process.argv[2] || "";

let id = videoId;
if (!id) {
  // Prende un videoId dalle top songs di Caparezza
  const sr = await fetch(
    `https://music.youtube.com/youtubei/v1/search?key=${KEY}&prettyPrint=false`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context: { client: { clientName: "WEB_REMIX", clientVersion: "1.20261008.01.00", hl: "it", gl: "IT" } },
        query: "Caparezza",
        params: "EgWKAQIIAWoMEA4QChADEAQQCRAF",
      }),
    }
  ).then((r) => r.json());
  (function walk(o) {
    if (id || !o || typeof o !== "object") return;
    if (Array.isArray(o)) return o.forEach(walk);
    const vid =
      o.musicResponsiveListItemRenderer?.flexColumns?.[0]
        ?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.navigationEndpoint?.watchEndpoint?.videoId;
    if (vid) id = vid;
    for (const v of Object.values(o)) walk(v);
  })(sr);
}
if (!id) { console.log("videoId non trovato"); process.exit(1); }
console.log("videoId:", id);

for (const client of [
  { clientName: "ANDROID", clientVersion: "20.10.38", androidSdkVersion: 34 },
  { clientName: "IOS", clientVersion: "20.10.4", deviceMake: "Apple", deviceModel: "iPhone16,2", osName: "iPhone", osVersion: "18.1" },
  { clientName: "TVHTML5_SIMPLY_EMBEDDED_PLAYER", clientVersion: "2.0", clientScreen: "EMBED" },
]) {
  const res = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${KEY}&prettyPrint=false`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip" },
    body: JSON.stringify({ context: { client }, videoId: id, contentCheckOk: true, racyCheckOk: true }),
  });
  const d = await res.json();
  const status = d.playabilityStatus?.status;
  const reason = d.playabilityStatus?.reason || "";
  const audio = (d.streamingData?.adaptiveFormats || []).filter((f) => f.mimeType?.startsWith("audio/"));
  const progressive = (d.streamingData?.formats || []).filter((f) => f.mimeType?.startsWith("audio/"));
  console.log(`\n[client ${client.clientName}] status=${status} ${reason} | adaptive audio: ${audio.length} | progressive audio: ${progressive.length}`);
  const best = audio.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
  if (best) {
    console.log(`  best: ${best.mimeType} ${Math.round((best.bitrate || 0) / 1000)}kbps len=${best.audioQuality || "?"}`);
    console.log(`  url: ${best.url ? best.url.slice(0, 120) + "..." : "(solo cipher, niente url)"}`);
    if (best.url) {
      // Verifica cross-IP: fetch parziale dal nostro IP con l'URL generato sopra
      try {
        const probe = await fetch(best.url, { headers: { Range: "bytes=0-999" } });
        const len = (await probe.arrayBuffer()).byteLength;
        console.log(`  probe: HTTP ${probe.status}, bytes ricevuti=${len} -> ${probe.ok ? "OK, URL riproducibile!" : "FALLITO"}`);
      } catch (e) {
        console.log(`  probe ERRORE: ${e.message}`);
      }
    }
  }
}