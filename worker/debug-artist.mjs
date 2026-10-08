// Dump della struttura browse di un artista: shelf + tipo item (per distinzione
// album/EP/singoli e top songs). Uso: node debug-artist.mjs "Caparezza" [browseId]
const KEY = "AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30";
const CLIENT = { clientName: "WEB_REMIX", clientVersion: "1.20261008.01.00", hl: "it", gl: "IT" };

async function innerTube(path, body) {
  const res = await fetch(`https://music.youtube.com/youtubei/v1/${path}?key=${KEY}&prettyPrint=false`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ context: { client: CLIENT }, ...body }),
  });
  return res.json();
}

// Se non è già un browseId UC... risolvi via search (tab artisti)
let browseId = process.argv[2] || "";
if (!browseId.startsWith("UC")) {
  const query = browseId || "Caparezza";
  const data = await innerTube("search", { query, params: "EgWKAQIgAWoMEA4QChADEAQQCRAF" });
  let found = null;
  (function walk(o) {
    if (!o || typeof o !== "object" || found) return;
    if (Array.isArray(o)) return o.forEach(walk);
    const t = o.musicResponsiveListItemRenderer || o.musicTwoRowItemRenderer || o.musicCardShelfRenderer;
    if (t) {
      const runs = t.title?.runs || t.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs;
      const b = runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId;
      if (b?.startsWith("UC")) found = b;
    }
    for (const v of Object.values(o)) walk(v);
  })(data);
  // Fallback: search "tutto" (la card artista in alto ha il browseId UC)
  if (!found) {
    const data2 = await innerTube("search", { query });
    (function walk(o) {
      if (!o || typeof o !== "object" || found) return;
      if (Array.isArray(o)) return o.forEach(walk);
      const t = o.musicResponsiveListItemRenderer || o.musicTwoRowItemRenderer || o.musicCardShelfRenderer;
      if (t) {
        const runs = t.title?.runs || t.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs;
        const b = runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId;
        if (b?.startsWith("UC")) found = b;
      }
      for (const v of Object.values(o)) walk(v);
    })(data2);
  }
  console.log(`Artista "${query}" -> ${found}`);
  browseId = found || "";
  if (!browseId) { console.log("browseId non trovato"); process.exit(1); }
}

const data = await innerTube("browse", { browseId });

function text(runs) {
  return (runs || []).map((r) => r.text).join("");
}

// 1) Elenco shelf di primo livello con titolo
function shelves(o, path = "root", out = []) {
  if (!o || typeof o !== "object") return out;
  if (Array.isArray(o)) { o.forEach((v, i) => shelves(v, path + "[" + i + "]", out)); return out; }
  if (o.musicCarouselShelfRenderer) {
    const s = o.musicCarouselShelfRenderer;
    out.push({ path, header: text(s.header?.musicCarouselShelfHeaderRenderer?.title?.runs), n: s.contents?.length });
  }
  if (o.musicCardShelfRenderer) {
    out.push({ path, header: "[card] " + text(o.musicCardShelfRenderer.title?.runs) });
  }
  for (const [k, v] of Object.entries(o)) shelves(v, path + "." + k, out);
  return out;
}
console.log("=== SHELVES ===");
for (const s of shelves(data)) console.log(JSON.stringify(s));

// 2) Per ogni shelf: item con tipo (subtitle runs[0]) e browseId
function walkShelves(o, out = []) {
  if (!o || typeof o !== "object") return out;
  if (Array.isArray(o)) { o.forEach((v) => walkShelves(v, out)); return out; }
  if (o.musicCarouselShelfRenderer) {
    const s = o.musicCarouselShelfRenderer;
    const title = text(s.header?.musicCarouselShelfHeaderRenderer?.title?.runs);
    const items = (s.contents || []).map((c) => {
      const t = c.musicTwoRowItemRenderer || c.musicResponsiveListItemRenderer;
      if (!t) return null;
      const title = text(t.title?.runs) ||
        text(t.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs);
      const subtitle = text(t.subtitle?.runs) ||
        text(t.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs);
      const videoId = t.navigationEndpoint?.watchEndpoint?.videoId ||
        t.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.navigationEndpoint?.watchEndpoint?.videoId || null;
      const b = t.navigationEndpoint?.browseEndpoint?.browseId ||
        t.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId || null;
      return { title, subtitle, videoId, browseId: b };
    }).filter(Boolean);
    out.push({ shelf: title, items });
  }
  for (const v of Object.values(o)) walkShelves(v, out);
  return out;
}
console.log("\n=== SHELF ITEMS (title | subtitle | videoId? | browseId) ===");
for (const sh of walkShelves(data)) {
  console.log("\n-- " + sh.shelf);
  for (const it of sh.items.slice(0, 8)) {
    console.log(`   ${it.title} | ${it.subtitle} | vid=${it.videoId ? "si" : "-"} | ${it.browseId || ""}`);
  }
}

// 3) Dump grezzo dei primi livelli di sectionListRenderer.contents[i]
//    (per capire che renderer ha la sezione [0], tipicamente le "top songs")
console.log("\n=== SECTION RENDERERS ===");
const contents =
  data?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content
    ?.sectionListRenderer?.contents ?? [];
contents.forEach((c, i) => {
  const keys = Object.keys(c);
  console.log(`[${i}] ${keys.join(", ")}`);
  if (c.musicShelfRenderer || c.musicCarouselShelfRenderer) {
    const s = c.musicShelfRenderer || c.musicCarouselShelfRenderer;
    const h = s.header;
    const hText = JSON.stringify(h ?? null).slice(0, 300);
    console.log(`    header: ${hText}`);
    const items = s.contents || [];
    items.slice(0, 5).forEach((it) => {
      const m = it.musicResponsiveListItemRenderer || it.musicTwoRowItemRenderer;
      if (!m) return console.log("    item-altro: " + Object.keys(it).join(","));
      const t0 = text(m.title?.runs) ||
        text(m.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs);
      const subs = (m.flexColumns || []).map((fc) =>
        text(fc.musicResponsiveListItemFlexColumnRenderer?.text?.runs)
      );
      console.log(`    * ${t0} :: ${subs.join(" | ")}`);
    });
  }
});
