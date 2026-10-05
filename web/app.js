import { extractUrl, parseQueryUrl, getApiBase, clipEndpoint } from "./clip.js";
import * as config from "./config.js";

const $ = (id) => document.getElementById(id);
const KIND_LABEL = { web: "Web", x: "X", threads: "Threads", facebook: "Facebook" };
const CLIP_TIMEOUT_MS = 30000;
let current = null;

function setStatus(text, isError = false) {
  const el = $("status");
  el.textContent = text;
  el.classList.toggle("error", isError);
}

function showResult(r) {
  current = r;
  $("kind").textContent = KIND_LABEL[r.kind] || r.kind;
  $("words").textContent = `${r.words} perkataan`;
  $("title").textContent = r.title || "(Tiada tajuk)";
  $("note").hidden = !r.note;
  $("note").textContent = r.note || "";
  $("result").hidden = false;
}

function hideResult() {
  current = null;
  $("result").hidden = true;
}

function markdownFile() {
  return new File([current.markdown], current.filename, { type: "text/markdown" });
}

async function clip() {
  const url = extractUrl($("url").value);
  if (!url) return setStatus("Masukkan link dulu.", true);
  const apiBase = getApiBase(localStorage, config);
  if (!apiBase) return setStatus("Server DotMD belum diset. Lihat README.", true);

  hideResult();
  $("clip").disabled = true;
  setStatus("Mengambil dan menukar…");
  try {
    const res = await fetch(clipEndpoint(apiBase, url), { signal: AbortSignal.timeout(CLIP_TIMEOUT_MS) });
    const data = await res.json();
    if (data.ok) {
      setStatus("");
      showResult(data);
    } else {
      setStatus(data.message || "Gagal tukar link ni.", true);
    }
  } catch {
    setStatus("Tak dapat hubungi server DotMD.", true);
  } finally {
    $("clip").disabled = false;
  }
}

async function paste() {
  try {
    const text = await navigator.clipboard.readText();
    const url = extractUrl(text);
    $("url").value = url || text;
    setStatus(url ? "" : "Tiada link dalam clipboard.", !url);
  } catch {
    setStatus("Tak boleh baca clipboard. Tampal link terus ke dalam kotak.", true);
  }
}

async function copy() {
  const btn = $("copy");
  try {
    await navigator.clipboard.writeText(current.markdown);
    btn.textContent = "Copied ✓";
  } catch {
    btn.textContent = "Gagal copy";
  }
  setTimeout(() => (btn.textContent = "Copy Markdown"), 1500);
}

async function saveOrShare(withTitle) {
  const file = markdownFile();
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share(withTitle ? { files: [file], title: current.title } : { files: [file] });
    } catch { /* user cancelled the share sheet */ }
    return;
  }
  if (withTitle && navigator.share) {
    try { await navigator.share({ title: current.title, text: current.markdown }); } catch { /* cancelled */ }
    return;
  }
  const a = document.createElement("a");
  a.href = "data:text/markdown;charset=utf-8," + encodeURIComponent(current.markdown);
  a.download = current.filename;
  a.click();
}

$("paste").addEventListener("click", paste);
$("clip").addEventListener("click", clip);
$("url").addEventListener("keydown", (e) => { if (e.key === "Enter") clip(); });
$("copy").addEventListener("click", copy);
$("download").addEventListener("click", () => saveOrShare(false));
$("share").addEventListener("click", () => saveOrShare(true));

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

const fromQuery = parseQueryUrl(location.search);
if (fromQuery) {
  $("url").value = fromQuery;
  clip();
}
