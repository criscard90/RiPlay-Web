/**
 * RiPlay proxy — Cloudflare Worker (parte 1/2: costanti + parsing).
 *
 * Ponte CORS: riceve GET /search?q=..., interroga InnerTube lato server
 * e restituisce JSON con header CORS aperti. Nessun dato salvato.
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

function thumb(thumbnails) {
  if (!thumbnails || thumbnails.length === 0) return "";
  return thumbnails[thumbnails.length - 1].url || "";
}

function parseLength(text) {
  if (!text) return 0;
  const parts = text.split(":").map(Number);
  if (parts.some(isNaN)) return 0;
  let s = 0;
  for (const p of parts) s = s * 60 + p;
  return s;
}


/** Estrae i Song da una risposta InnerTube /search (parte 2/2: handler). */
function extractSongs(data) {
  const songs = [];
  const tabs = data?.contents?.tabbedSearchResultsRenderer?.tabs ?? [];
  for (const tab of tabs) {
    const sections =
      tab?.tabRenderer?.content?.sectionListRenderer?.contents ?? [];
    for (const section of sections) {
      const items =
        section?.musicShelfRenderer?.contents ??
        section?.musicCardShelfRenderer?.contents ?? [];
      for (const item of items) {
        const mrlm =
          item?.musicResponsiveListItemRenderer ??
          item?.musicTwoRowItemRenderer;
        if (!mrlm) continue;
        const flex = mrlm.flexColumns ?? [];
        const title =
          flex[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]
            ?.text ?? mrlm.title?.runs?.[0]?.text ?? "";
        // Colonna 2: "artista • album • durata" -> prendiamo solo il 1° run
        const artistRuns =
          flex[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs ?? [];
        const artist = artistRuns.length > 0 ? (artistRuns[0].text ?? "") : (
          mrlm.subtitle?.runs?.[0]?.text ?? "");
        // Durata: ultimo run della colonna 2 che matcha M:SS / H:MM:SS
        let lengthText = "";
        for (const r of artistRuns) {
          if (/^\d{1,2}:\d{2}(:\d{2})?$/.test((r.text ?? "").trim())) {
            lengthText = r.text.trim();
          }
        }
        if (!lengthText) {
          lengthText =
            mrlm.fixedColumns?.[0]?.musicResponsiveListItemFixedColumnRenderer
              ?.text?.runs?.[0]?.text ?? "";
        }
        const thumbs =
          mrlm.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails ??
          mrlm.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail
            ?.thumbnails ?? [];
        let videoId =
          mrlm.overlay?.musicItemThumbnailOverlayRenderer?.content
            ?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint
            ?.videoId ??
          mrlm.navigationEndpoint?.watchEndpoint?.videoId ??
          mrlm.onTap?.watchEndpoint?.videoId ?? null;
        if (!videoId) {
          const runs =
            flex[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs ?? [];
          for (const r of runs) {
            const id = r?.navigationEndpoint?.watchEndpoint?.videoId ?? null;
            if (id) { videoId = id; break; }
          }
        }
        if (videoId && title) {
          songs.push({
            id: videoId, title, artist: artist || "", album: "",
            duration: parseLength(lengthText),
            thumbnail: thumb(thumbs), isExplicit: false,
          });
        }
      }
    }
  }
  return songs;
}

async function handleSearch(url) {
  const q = (url.searchParams.get("q") || "").trim();
  if (!q) {
    return new Response(JSON.stringify({ items: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }
  const res = await fetch(
    `${INNERTUBE_HOST}/youtubei/v1/search?key=${INNERTUBE_API_KEY}&prettyPrint=false`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": CLIENT.userAgent,
        Origin: INNERTUBE_HOST,
        Referer: `${INNERTUBE_HOST}/`,
      },
      body: JSON.stringify({ context: { client: CLIENT }, query: q }),
    }
  );
  if (!res.ok) {
    return new Response(JSON.stringify({ error: "upstream HTTP " + res.status }), {
      status: 502,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }
  const data = await res.json();
  return new Response(JSON.stringify({ items: extractSongs(data) }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (url.pathname === "/search" && request.method === "GET") {
      return handleSearch(url);
    }
    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response(
        JSON.stringify({ ok: true, service: "riplay-proxy" }),
        { status: 200, headers: { "Content-Type": "application/json", ...CORS } }
      );
    }
    return new Response(JSON.stringify({ error: "not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  },
};
