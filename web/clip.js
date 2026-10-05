// Pure helpers (no DOM) so they can be unit-tested in Node.
const count = (s, ch) => s.split(ch).length - 1;

// Strip sentence punctuation after a pasted link, but keep a ")" that closes a "(" inside the URL
// (e.g. https://en.wikipedia.org/wiki/Foo_(bar)).
function trimTrailing(url) {
  for (;;) {
    const last = url[url.length - 1];
    if (!last || !".,;:!?)]'\"".includes(last)) return url;
    if (last === ")" && count(url, ")") <= count(url, "(")) return url;
    url = url.slice(0, -1);
  }
}

export function extractUrl(text) {
  const m = String(text || "").match(/https?:\/\/[^\s<>"]+/i);
  return m ? trimTrailing(m[0]) : null;
}

export function parseQueryUrl(search) {
  return extractUrl(new URLSearchParams(search).get("url"));
}

export function getApiBase(storage, config) {
  let override = null;
  try { override = storage.getItem("dotmd-api-base"); } catch { /* storage may be blocked */ }
  return (override || config.API_BASE || "").replace(/\/+$/, "");
}

export function clipEndpoint(apiBase, url) {
  return `${apiBase.replace(/\/+$/, "")}/api/clip?url=${encodeURIComponent(url)}`;
}
