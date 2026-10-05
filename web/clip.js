// Pure helpers (no DOM) so they can be unit-tested in Node.
const TRAILING = /[.,;:!?)\]'"]+$/;

export function extractUrl(text) {
  const m = String(text || "").match(/https?:\/\/[^\s<>"]+/i);
  return m ? m[0].replace(TRAILING, "") : null;
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
