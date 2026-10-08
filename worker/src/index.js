/**
 * RiPlay proxy — Cloudflare Worker.
 *
 * Ponte CORS: riceve GET /search?q=...[&type=songs|videos|albums|artists],
 * interroga YouTube Music (InnerTube) lato server e restituisce JSON
 * con header CORS aperti. Nessun dato salvato, nessun tracking.
 *
 * Risponde anche:
 *   GET /health              -> { ok: true }
 *   GET /artist?browseId=... -> top brani dell'artista (per "vedi artista")
 *   GET /album?browseId=...  -> brani dell'album
 */

const INNERTUBE_API_KEY = "AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30";
const INNERTUBE_HOST = "https://music.youtube.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

const CLIENT = {
  clientName: "WEB_REMIX",
  clientVersion: "1.20251001.00.00",
  hl: "it",
  gl: "IT",
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
};

// Client "ANDROID" per l'endpoint /player: restituisce streamingData con URL
// diretti (niente po_token/cipher) e sia audio/mp4 sia audio/webm.
// Nota: TVHTML5_SIMPLY_EMBEDDED_PLAYER e' bloccato ("no longer supported").
const PLAYER_CLIENT = {
  clientName: "ANDROID",
  clientVersion: "20.10.38",
  androidSdkVersion: 34,
  userAgent: "com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip",
};

// Filtri di ricerca InnerTube (tab "Brani", "Video", "Album", "Artisti").
// Valori verificati con ytmusicapi (get_search_params): prefisso "EgWKAQ" +
// 2 byte tipo (II=songs, IQ=videos, IY=albums, Ig=artists) + coda "AWoMEA4QChADEAQQCRAF".
const SEARCH_PARAMS = {
  songs: "EgWKAQIIAWoMEA4QChADEAQQCRAF",
  videos: "EgWKAQIQAWoMEA4QChADEAQQCRAF",
  albums: "EgWKAQIYAWoMEA4QChADEAQQCRAF",
  artists: "EgWKAQIgAWoMEA4QChADEAQQCRAF",
};

/** clientVersion "1.YYYYMMDD.01.00" (formato dinamico come da ytmusicapi). */
function clientVersion() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `1.${y}${m}${day}.01.00`;
}

function thumb(thumbnails) {
  if (!thumbnails || thumbnails.length === 0) return "";
  return thumbnails[thumbnails.length - 1].url || "";
}

function parseLength(text) {
  if (!text) return 0;
  const parts = String(text).split(":").map(Number);
  if (parts.some(isNaN)) return 0;
  let s = 0;
  for (const p of parts) s = s * 60 + p;
  return s;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

/** Raccoglie ricorsivamente tutti gli item musicali ovunque siano annidati. */
function collectItems(root) {
  const out = [];
  (function walk(o) {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) {
      for (const v of o) walk(v);
      return;
    }
    if (o.musicResponsiveListItemRenderer) out.push(o.musicResponsiveListItemRenderer);
    else if (o.musicTwoRowItemRenderer) out.push(o.musicTwoRowItemRenderer);
    for (const k of Object.keys(o)) {
      if (k === "musicResponsiveListItemRenderer" || k === "musicTwoRowItemRenderer") continue;
      walk(o[k]);
    }
  })(root);
  return out;
}

/** Tipo + browseId di un item (brano / album / artista / playlist / video). */
function itemKind(m) {
  const sub = subRuns(m).map((x) => x.text).join("");
  const first = sub.split("•")[0].trim().toLowerCase();
  const browse =
    m.navigationEndpoint?.browseEndpoint?.browseId ??
    m.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]
      ?.navigationEndpoint?.browseEndpoint?.browseId ?? null;
  if (browse?.startsWith("UC")) return { kind: "artist", browseId: browse };
  if (browse?.startsWith("MPRE")) return { kind: "album", browseId: browse };
  if (browse?.startsWith("VL") || browse?.startsWith("PL")) return { kind: "playlist", browseId: browse };
  if (first.startsWith("album")) return { kind: "album", browseId: browse };
  if (first.startsWith("singolo") || first.startsWith("single") || first.startsWith("ep"))
    return { kind: "album", browseId: browse };
  if (first.startsWith("artist")) return { kind: "artist", browseId: browse };
  if (first.startsWith("playlist")) return { kind: "playlist", browseId: browse };
  return { kind: "song", browseId: null };
}

function extractVideoId(m) {
  return (
    m.overlay?.musicItemThumbnailOverlayRenderer?.content
      ?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId ??
    m.navigationEndpoint?.watchEndpoint?.videoId ??
    m.onTap?.watchEndpoint?.videoId ?? null
  );
}



/** Etichette di tipo che YTM antepone al sottotitolo nelle ricerche non filtrate
 *  (es. "Brano • Caparezza", "Album • Nome • 2006"). Servono a itemKind, ma non
 *  all'artista mostrato in UI. */
const TYPE_LABELS = new Set([
  "brano", "canzone", "song", "video", "album", "singolo", "single", "ep",
  "playlist", "elenco di riproduzione", "artista", "artist", "profilo", "profile",
  "puntata", "podcast", "episodio", "episode", "stazione", "station",
]);

/** Runs del sottotitolo: da flexColumns[1] (MRLI) oppure subtitle (two-row). */
function subRuns(m) {
  return (
    m.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs ??
    m.subtitle?.runs ??
    []
  );
}

/** Rimuove l'etichetta di tipo iniziale (più il separatore "•") dai runs. */
function stripTypeLabel(runs) {
  let r = runs;
  if (r.length > 0 && TYPE_LABELS.has((r[0].text ?? "").trim().toLowerCase())) {
    r = r.slice(1);
    if (r.length > 0 && (r[0].text ?? "").trim() === "•") r = r.slice(1);
  }
  return r;
}


/** Converte un item InnerTube nel nostro Song (+ tipo per la UI). */
function toSong(m) {
  const flex = m.flexColumns ?? [];
  const title =
    flex[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text ??
    m.title?.runs?.[0]?.text ?? "";
  const sub = stripTypeLabel(subRuns(m));
  let artist = sub.length > 0 ? (sub[0].text ?? "") : "";
  // Righe non filtrate come ["Brano", " • ", "4:15"] non riportano l'artista:
  // il primo run resta la durata, non un nome.
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(artist.trim())) artist = "";
  let lengthText = "";
  for (const r of sub) {
    const t = (r.text ?? "").trim();
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(t)) lengthText = t;
  }
  if (!lengthText) {
    lengthText =
      m.fixedColumns?.[0]?.musicResponsiveListItemFixedColumnRenderer
        ?.text?.runs?.[0]?.text ?? "";
  }
  const thumbs =
    m.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails ??
    m.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails ?? [];
  const { kind, browseId } = itemKind(m);
  const subtitle = subRuns(m)
    .map((r) => (r.text ?? "").trim())
    .filter((t) => t && t !== "•")
    .join(" • ");
  return {
    id: extractVideoId(m) ?? (browseId ? `browse:${browseId}` : ""),
    title,
    artist,
    album: "",
    duration: parseLength(lengthText),
    thumbnail: thumb(thumbs),
    isExplicit: false,
    kind,
    browseId,
    videoId: extractVideoId(m),
    subtitle,
  };
}

async function innerTube(path, body) {
  const res = await fetch(
    `${INNERTUBE_HOST}/youtubei/v1/${path}?key=${INNERTUBE_API_KEY}&prettyPrint=false`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": CLIENT.userAgent,
        Origin: INNERTUBE_HOST,
        Referer: `${INNERTUBE_HOST}/`,
      },
      body: JSON.stringify({
        context: { client: { ...CLIENT, clientVersion: clientVersion() } },
        ...body,
      }),
    }
  );
  if (!res.ok) throw new Error(`upstream HTTP ${res.status}`);
  return res.json();
}

/**
 * Info riproduzione via client ANDROID (www.youtube.com): gli adaptiveFormats
 * audio riportano l'URL diretto, senza signature cipher ne' po_token.
 */
async function playerInfo(videoId) {
  const res = await fetch(
    `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_API_KEY}&prettyPrint=false`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": PLAYER_CLIENT.userAgent,
      },
      body: JSON.stringify({
        context: {
          client: {
            hl: CLIENT.hl,
            gl: CLIENT.gl,
            clientName: PLAYER_CLIENT.clientName,
            clientVersion: PLAYER_CLIENT.clientVersion,
            androidSdkVersion: PLAYER_CLIENT.androidSdkVersion,
          },
        },
        videoId,
        contentCheckOk: true,
        racyCheckOk: true,
      }),
    }
  );
  if (!res.ok) throw new Error(`player HTTP ${res.status}`);
  return res.json();
}

/**
 * GET /stream?videoId=... -> { videoId, url, mimeType, bitrate, ... }
 *
 * Restituisce l'URL diretto dello stream AUDIO (solo metadati: pochi KB).
 * Il browser lo riproduce con un <audio> element senza passare dal worker
 * (nessun relay di traffico): la riproduzione resta solo audio.
 * Preferenza: audio/mp4 (AAC, universale) poi audio/webm (opus, no Safari).
 */
async function handleStream(url) {
  const videoId = (url.searchParams.get("videoId") || "").trim();
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return json({ error: "invalid videoId" }, 400);
  const data = await playerInfo(videoId);
  const status = data.playabilityStatus?.status;
  if (status && status !== "OK") {
    return json({ error: data.playabilityStatus.reason || "unplayable", status }, 404);
  }
  const audio = (data.streamingData?.adaptiveFormats || []).filter(
    (f) => f.url && f.mimeType && f.mimeType.startsWith("audio/")
  );
  if (audio.length === 0) return json({ error: "no audio stream" }, 404);
  const mp4 = audio.filter((f) => f.mimeType.startsWith("audio/mp4"));
  const best = (mp4.length > 0 ? mp4 : audio).sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
  return json({
    videoId,
    url: best.url,
    itag: best.itag,
    mimeType: best.mimeType,
    bitrate: best.bitrate || 0,
    audioQuality: best.audioQuality || "",
    duration: Number(data.videoDetails?.lengthSeconds || 0),
  });
}

async function handleSearch(url) {
  const q = (url.searchParams.get("q") || "").trim();
  const type = (url.searchParams.get("type") || "").trim();
  if (!q) return json({ items: [] });
  const params = SEARCH_PARAMS[type] || undefined;
  const body = params ? { query: q, params } : { query: q };
  const data = await innerTube("search", body);

  // Artista in evidenza (card in alto)
  let featured = null;
  const card = collectCard(data);
  if (card) featured = toFeatured(card);

  const items = [];
  const seen = new Set();
  for (const m of collectItems(data)) {
    const s = toSong(m);
    if (!s.title || !s.id || seen.has(s.id)) continue;
    seen.add(s.id);
    items.push(s);
  }
  return json({ items, featured });
}

/** Card artista in alto nei risultati (nome, iscritti, thumbnail, browseId). */
function collectCard(data) {
  let found = null;
  (function walk(o) {
    if (!o || typeof o !== "object" || found) return;
    if (Array.isArray(o)) {
      for (const v of o) walk(v);
      return;
    }
    if (o.musicCardShelfRenderer) {
      found = o.musicCardShelfRenderer;
      return;
    }
    for (const v of Object.values(o)) walk(v);
  })(data?.contents);
  return found;
}

function toFeatured(card) {
  const title = card.title?.runs?.[0]?.text ?? "";
  const browseId =
    card.title?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId ?? null;
  const subtitle = (card.subtitle?.runs ?? []).map((r) => r.text).join("");
  const thumbs =
    card.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails ?? [];
  return { title, browseId, subtitle, thumbnail: thumb(thumbs) };
}

/** Titolo di uno shelf carousel ("Album", "Singoli ed EP", "Video", ...). */
function carouselTitle(s) {
  const h =
    s.header?.musicCarouselShelfBasicHeaderRenderer ?? s.header?.musicCarouselShelfHeaderRenderer;
  return (h?.title?.runs?.[0]?.text ?? "").trim();
}

/**
 * Pagina artista strutturata sugli shelf che YouTube Music espone gia separati:
 *  - musicShelfRenderer con videoId     -> "Brani in evidenza" (top songs)
 *  - carousel "Album"                   -> album
 *  - carousel "Singoli ed EP"           -> singoli/EP
 *  - carousel "Video"/"Performance live" -> video
 * Playlist e artisti correlati sono volutamente esclusi (meno rumore).
 */
function artistPage(data) {
  const buckets = { songs: [], albums: [], singles: [], videos: [] };
  const seen = new Set(); // dedup cross-sezione (stesso video/id in piu' shelf)
  const push = (bucket, s) => {
    const key = s.videoId || s.id;
    if (!s.title || !key || seen.has(key)) return;
    seen.add(key);
    buckets[bucket].push(s);
  };

  const contents =
    data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content
      ?.sectionListRenderer?.contents;
  for (const c of contents ?? []) {
    if (c.musicShelfRenderer) {
      // Top songs: MRLI con watchEndpoint
      for (const it of c.musicShelfRenderer.contents ?? []) {
        const m = it.musicResponsiveListItemRenderer;
        if (m) push("songs", toSong(m));
      }
    } else if (c.musicCarouselShelfRenderer) {
      const shelf = c.musicCarouselShelfRenderer;
      const t = carouselTitle(shelf).toLowerCase();
      let bucket = null;
      if (t.includes("album")) bucket = "albums";
      else if (t.includes("singol") || /\bep\b/.test(t)) bucket = "singles";
      else if (t.includes("video") || t.includes("live")) bucket = "videos";
      if (!bucket) continue; // playlist, artisti correlati, ...
      for (const it of shelf.contents ?? []) {
        const m = it.musicTwoRowItemRenderer || it.musicResponsiveListItemRenderer;
        if (!m) continue;
        const s = toSong(m);
        // Nei due-row l'album e' sottotitolo solo dall'anno: per gli item non
        // canzone il "nome artista" estratto e' spesso l'anno stesso.
        if ((bucket === "albums" || bucket === "singles") && /^\d{4}$/.test(s.artist)) s.artist = "";
        push(bucket, s);
      }
    }
  }

  const sections = [];
  if (buckets.songs.length) sections.push({ title: "Brani in evidenza", items: buckets.songs });
  if (buckets.albums.length) sections.push({ title: "Album", items: buckets.albums });
  if (buckets.singles.length) sections.push({ title: "Singoli ed EP", items: buckets.singles });
  if (buckets.videos.length) sections.push({ title: "Video", items: buckets.videos });
  return { sections, items: sections.flatMap((s) => s.items) };
}

/** Brani di un album / pagina artista strutturata via /browse. */
async function handleBrowse(url, kind) {
  const browseId = (url.searchParams.get("browseId") || "").trim();
  if (!browseId) return json({ error: "missing browseId" }, 400);
  const data = await innerTube("browse", { browseId });
  const header = headerTitle(data);

  if (kind === "artist") {
    const { items, sections } = artistPage(data);
    return json({ items, title: header, sections });
  }

  // Album: solo tracce riproducibili, in sequenza
  const items = [];
  const seen = new Set();
  for (const m of collectItems(data)) {
    const s = toSong(m);
    if (!s.title || !s.videoId || seen.has(s.videoId)) continue;
    seen.add(s.videoId);
    s.id = s.videoId;
    s.kind = "song";
    items.push(s);
  }
  return json({ items, title: header });
}

function headerTitle(data) {
  let title = "";
  (function walk(o) {
    if (!o || typeof o !== "object" || title) return;
    if (Array.isArray(o)) {
      for (const v of o) walk(v);
      return;
    }
    if (o.musicDetailHeaderRenderer) {
      title = o.musicDetailHeaderRenderer.title?.runs?.[0]?.text ?? "";
      return;
    }
    if (o.musicImmersiveHeaderRenderer) {
      // Header degli artisti (nome artista in alto)
      title = o.musicImmersiveHeaderRenderer.title?.runs?.[0]?.text ?? "";
      return;
    }
    if (o.musicEditablePlaylistDetailHeaderRenderer) {
      title = o.musicEditablePlaylistDetailHeaderRenderer.header
        ?.musicDetailHeaderRenderer?.title?.runs?.[0]?.text ?? "";
      return;
    }
    for (const v of Object.values(o)) walk(v);
    // Scansiona tutto il payload: l'header dell'artista (musicImmersiveHeader
    // Renderer) vive in data.header, fuori dai contents.
  })(data);
  return title;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }
    try {
      if (url.pathname === "/search" && request.method === "GET") {
        return await handleSearch(url);
      }
      if ((url.pathname === "/artist" || url.pathname === "/album") && request.method === "GET") {
        return await handleBrowse(url, url.pathname.slice(1));
      }
      if (url.pathname === "/stream" && request.method === "GET") {
        return await handleStream(url);
      }
      if (url.pathname === "/" || url.pathname === "/health") {
        return json({ ok: true, service: "riplay-proxy" });
      }
      return json({ error: "not found" }, 404);
    } catch (e) {
      return json({ error: String(e.message || e) }, 502);
    }
  },
};
