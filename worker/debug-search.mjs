const KEY = "AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30";
const W = await import("./src/index.js").then((m) => m.default);
const query = process.argv[2] || "caparezza";

async function get(path) {
  const res = await W.fetch(new Request("http://x" + path));
  const j = await res.json();
  console.log("### GET", path, "-> HTTP", res.status);
  if (j.featured) console.log("featured:", JSON.stringify(j.featured).substring(0, 200));
  console.log("items:", j.items?.length ?? j.error ?? "?");
  for (const s of (j.items || []).slice(0, 12)) {
    console.log("-", "[" + (s.kind || "?") + "]", (s.title || "").substring(0, 38), "|", (s.artist || "").substring(0, 22), "|", s.duration, "|", (s.id || "").substring(0, 20));
  }
  return j;
}

const r = await get("/search?q=" + encodeURIComponent(query));
if (r.featured?.browseId) {
  await get("/artist?browseId=" + r.featured.browseId);
}
const album = (r.items || []).find((x) => x.kind === "album" && x.browseId);
if (album) await get("/album?browseId=" + album.browseId);
await get("/search?q=" + encodeURIComponent(query) + "&type=songs");
