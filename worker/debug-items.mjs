const KEY = "AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30";
const query = process.argv[2] || "caparezza";
// opzionale: endpoint browse "mostra altro" da seguire (params del 2° argomento)
const followEndpoint = process.argv[3] || null;

async function innerTube(path, body) {
  const res = await fetch(
    `https://music.youtube.com/youtubei/v1/${path}?key=${KEY}&prettyPrint=false`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context: { client: { clientName: "WEB_REMIX", clientVersion: "1.20251001.00.00" } },
        ...body,
      }),
    }
  );
  return res.json();
}

const j = await innerTube("search", { query });

// Raccoglie ricorsivamente TUTTI gli item musicali ovunque siano annidati
const items = [];
function walk(o) {
  if (!o || typeof o !== "object") return;
  if (Array.isArray(o)) {
    o.forEach(walk);
    return;
  }
  if (o.musicResponsiveListItemRenderer || o.musicTwoRowItemRenderer) {
    items.push(o.musicResponsiveListItemRenderer ?? o.musicTwoRowItemRenderer);
  }
  for (const k of Object.keys(o)) {
    if (k === "musicResponsiveListItemRenderer" || k === "musicTwoRowItemRenderer") continue;
    walk(o[k]);
  }
}
walk(j.contents);
console.log("items trovati:", items.length);

// Mostra struttura dei primi 15 (titolo / tipo / dove punta)
items.slice(0, 15).forEach((m, i) => {
  const t = m.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text
    ?? m.title?.runs?.[0]?.text ?? "?";
  const sub = (m.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs ?? [])
    .map((x) => x.text).join("");
  const vid = m.overlay?.musicItemThumbnailOverlayRenderer?.content
    ?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId
    ?? m.navigationEndpoint?.watchEndpoint?.videoId ?? "NO-VID";
  const browse = m.navigationEndpoint?.browseEndpoint?.browseId
    ?? m.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId
    ?? "";
  console.log(i, "|", t.substring(0, 40), "|", sub.substring(0, 40), "|", vid, browse ? ("BROWSE:" + browse) : "");
});

// Cerca endpoint "mostra altro / vedi tutti" per i brani
const more = [];
function walkMore(o) {
  if (!o || typeof o !== "object") return;
  if (Array.isArray(o)) { o.forEach(walkMore); return; }
  if (o.musicCarouselShelfRenderer || (o.musicShelfRenderer && o.musicShelfRenderer.bottomEndpoint)) {
    const sh = o.musicCarouselShelfRenderer ?? o.musicShelfRenderer;
    more.push({ title: sh.header?.musicCarouselShelfBasicHeaderRenderer?.title?.runs?.[0]?.text ?? sh.title?.runs?.[0]?.text ?? "?", ep: sh.bottomEndpoint ?? "(expand)" });
  }
  for (const v of Object.values(o)) walkMore(v);
}
walkMore(j.contents);
console.log("--- show-more endpoints:", more.length);
more.slice(0, 6).forEach((m) => console.log(" *", m.title, JSON.stringify(m.ep).substring(0, 200)));
