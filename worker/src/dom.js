// Spike finding (Task 1): Readability + Turndown + gfm work on linkedom. Only gap was
// `table.rows`/`row.cells`, which linkedom lacks; extract.js now uses querySelector/children.
import { parseHTML } from "linkedom";

// Workers have no DOM, so linkedom stands in for it. linkedom does not know the page URL,
// so inject <base href> to let Readability resolve relative links and images.
export function parseDoc(html, url) {
  const { document } = parseHTML(html);
  if (!document.querySelector("base[href]")) {
    const base = document.createElement("base");
    base.setAttribute("href", url);
    const head = document.head || document.documentElement.insertBefore(document.createElement("head"), document.documentElement.firstChild);
    head.insertBefore(base, head.firstChild);
  }
  return document;
}
