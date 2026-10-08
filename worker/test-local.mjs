// Verifica rapida /artist + /stream (node src/index.js tramite import)
import w from "./src/index.js";
const J = async (u) => (await w.fetch(new Request("http://localhost" + u))).json();

const a = await J("/artist?browseId=UCGsv8l1sq32W1Xptp7ywaNA");
console.log("title:", JSON.stringify(a.title));
console.log("sections:", a.sections.map((s) => `${s.title}(${s.items.length})`).join(", "));
console.log("items flat:", a.items.length);

const st = await J("/stream?videoId=zvC6jsZnicY");
console.log("stream:", st.itag, st.mimeType, st.bitrate, "url:", st.url ? "ok" : "MANCANTE");
const probe = await fetch(st.url, { headers: { Range: "bytes=0-99" } });
console.log("probe cross-check:", probe.status);
