// Spike finding (Task 1): Readability + Turndown + gfm work on linkedom. Only gap was
// `table.rows`/`row.cells`, which linkedom lacks; extract.js now uses querySelector/children.
import { parseHTML } from "linkedom";

// Workers have no DOM, so linkedom stands in for it. linkedom does not know the page URL,
// so inject <base href> to let Readability resolve relative links and images.
// turndown-plugin-gfm reads `table.rows`, which linkedom lacks; add it once on linkedom's table prototype.
// (Turndown clones the node it is given, so an own property on one instance would be lost.)
function ensureTableRows(document) {
  const proto = Object.getPrototypeOf(document.createElement("table"));
  if (Object.getOwnPropertyDescriptor(proto, "rows")) return;
  Object.defineProperty(proto, "rows", {
    configurable: true,
    get() { return this.querySelectorAll("tr"); },
  });
}

export function parseDoc(html, url) {
  const { document } = parseHTML(html);
  ensureTableRows(document);
  if (!document.querySelector("base[href]")) {
    const base = document.createElement("base");
    base.setAttribute("href", url);
    const head = document.head || document.documentElement.insertBefore(document.createElement("head"), document.documentElement.firstChild);
    head.insertBefore(base, head.firstChild);
  }
  return document;
}

// Workers on the free plan have ~10 ms CPU per request, so drop the heaviest, never-article bytes before
// parsing. JSON-LD scripts stay (Readability reads author/title from them); <noscript> stays (lazy images).
export function stripNoise(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script\b(?![^>]*type\s*=\s*["']?application\/ld\+json)[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, "")
    .replace(/<svg\b[\s\S]*?<\/svg\s*>/gi, "");
}
