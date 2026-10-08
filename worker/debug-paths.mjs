const KEY = "AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30";
const query = process.argv[2] || "caparezza";

const r = await fetch(
  `https://music.youtube.com/youtubei/v1/search?key=${KEY}&prettyPrint=false`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      context: { client: { clientName: "WEB_REMIX", clientVersion: "1.20251001.00.00" } },
      query,
    }),
  }
);
const j = await r.json();

// Trova il percorso di ogni musicResponsiveListItemRenderer
const paths = [];
function walk(o, path) {
  if (!o || typeof o !== "object") return;
  if (Array.isArray(o)) {
    o.forEach((v, i) => walk(v, path + "[" + i + "]"));
    return;
  }
  for (const k of Object.keys(o)) {
    if (k === "musicResponsiveListItemRenderer") paths.push(path + "." + k);
    else walk(o[k], path + "." + k);
  }
}
walk(j.contents, "contents");
const byParent = {};
for (const p of paths) {
  const parent = p.replace(/\.musicResponsiveListItemRenderer$/, "").replace(/\[\d+\]$/, "[n]");
  byParent[parent] = (byParent[parent] || 0) + 1;
}
console.log("total MRLI:", paths.length);
for (const [k, v] of Object.entries(byParent)) console.log(v + "x  " + k);
