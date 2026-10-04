const FILES = [
  "lib/Readability.js",
  "lib/turndown.js",
  "lib/turndown-plugin-gfm.js",
  "src/convert.js",
  "extract.js",
];

const statusEl = document.getElementById("status");
const metaEl = document.getElementById("meta");
const copyBtn = document.getElementById("copy");
const downloadBtn = document.getElementById("download");

function showError(message) {
  statusEl.textContent = message;
}

function download(filename, text) {
  // data: URL (not a blob: URL) so the download survives the popup closing when
  // the browser shows a "Save as" dialog.
  const a = document.createElement("a");
  a.href = "data:text/markdown;charset=utf-8," + encodeURIComponent(text);
  a.download = filename;
  a.click();
}

async function run() {
  let result;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: FILES });
    [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => globalThis.__dotmdExtract(),
    });
  } catch (err) {
    return showError("Page ni tak boleh diakses");
  }

  if (!result || !result.ok) return showError("Tak jumpa article di page ni");

  statusEl.textContent = result.title;
  metaEl.textContent = `${result.words} perkataan`;
  metaEl.hidden = false;
  copyBtn.disabled = downloadBtn.disabled = false;

  copyBtn.addEventListener("click", async () => {
    await navigator.clipboard.writeText(result.markdown);
    copyBtn.textContent = "Copied ✓";
    setTimeout(() => (copyBtn.textContent = "Copy Markdown"), 1500);
  });
  downloadBtn.addEventListener("click", () => download(result.filename, result.markdown));
}

run();
