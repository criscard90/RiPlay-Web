const KEY = "AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30";
const query = process.argv[2] || "caparezza";

// Varianti di params (tab filtro ricerca YTMusic)
const VARIANTS = {
  "(none)": undefined,
  "current songs": "EgWKAQIIAWoQEAMQBBAJEAoQEBAKEAkEDBA",
  "ytmusicapi songs": "EgWKAQIIAWoMEAQIBBAJ",
  "ytmusicapi videos": "EgWKAQIQAWoMEAQIBBAJ",
  "ytmusicapi albums": "EgWKAQIYAWoMEAQIBBAJ",
  "ytmusicapi artists": "EgWKAQIgAWoMEAQIBBAJ",
};

async function search(params) {
  const body = {
    context: { client: { clientName: "WEB_REMIX", clientVersion: "1.20251001.00.00", hl: "it", gl: "IT" } },
    query,
  };
  if (params) body.params = params;
  const r = await fetch(`https://music.youtube.com/youtubei/v1/search?key=${KEY}&prettyPrint=false`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) return { error: `HTTP ${r.status}` };
  const j = await r.json();
  if (j.error) return { error: JSON.stringify(j.error).substring(0, 120) };

  // Struttura: tabbedSearchResultsRenderer -> tabs[]
  const tabs = j.contents?.tabbedSearchResultsRenderer?.tabs ?? [];
  const out = tabs.map((t) => {
    const tr = t.tabRenderer ?? t.musicTabRenderer ?? {};
    const title = typeof tr.title === "string" ? tr.title : tr.title?.runs?.map((x) => x.text).join("");
    let items = 0;
    const first = JSON.stringify(tr.content ?? {}).substring(0, 80);
    (function walk(o) {
      if (!o || typeof o !== "object") return;
      if (Array.isArray(o)) return o.forEach(walk);
      if (o.musicResponsiveListItemRenderer || o.musicTwoRowItemRenderer) items++;
      for (const v of Object.values(o)) walk(v);
    })(tr.content);
    return `${title}${tr.selected ? "*" : ""}=${items} [${first}]`;
  });
  return out;
}

for (const [name, params] of Object.entries(VARIANTS)) {
  const r = await search(params);
  console.log(name.padEnd(20), "->", Array.isArray(r) ? r.join(" | ") : JSON.stringify(r));
}

// Dump grezzo della risposta con params "ytmusicapi albums"
if (process.argv[3] === "--dump") {
  const body = {
    context: { client: { clientName: "WEB_REMIX", clientVersion: "1.20251001.00.00", hl: "it", gl: "IT" } },
    query,
    params: VARIANTS["ytmusicapi albums"],
  };
  const r = await fetch(`https://music.youtube.com/youtubei/v1/search?key=${KEY}&prettyPrint=false`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  const fs = await import("node:fs");
  fs.writeFileSync("dump-albums.json", JSON.stringify(j, null, 1));
  console.log("dumped dump-albums.json, top keys:", Object.keys(j));
}


