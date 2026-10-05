(function (root) {
  // In the browser convert.js has already set root.DotMD; a page element with id="require"
  // can shadow window.require, so never call it when DotMD exists.
  const convert = root.DotMD || require("./src/convert.js");
  const MIN_TEXT_LENGTH = 200;
  const MAX_LINK_DENSITY = 0.5;
  const MIN_PARAGRAPHS = 3;

  // Listing pages (HN, front pages) are mostly link text and have no real paragraphs;
  // link roundups are link-heavy too but are written as headings + paragraphs.
  function looksLikeListing(container) {
    return linkDensity(container) > MAX_LINK_DENSITY &&
      container.querySelectorAll("p").length < MIN_PARAGRAPHS;
  }

  function linkDensity(container) {
    const total = container.textContent.trim().length;
    if (!total) return 1;
    let linked = 0;
    for (const a of container.querySelectorAll("a")) linked += a.textContent.trim().length;
    return linked / total;
  }

  // gfm only emits a Markdown table when the first row is a header row.
  function ensureTableHeaders(container) {
    for (const table of container.querySelectorAll("table")) {
      const firstRow = table.querySelector("tr"); // querySelector: linkedom has no table.rows
      if (!firstRow || table.querySelector("thead")) continue;
      if ([...firstRow.children].every((c) => c.nodeName === "TH")) continue;
      for (const cell of [...firstRow.children]) {
        const th = table.ownerDocument.createElement("th");
        th.innerHTML = cell.innerHTML;
        cell.replaceWith(th);
      }
    }
  }

  function extractArticle(doc, opts) {
    const { url, now, Readability, TurndownService, gfm } = opts;
    const parsed = new Readability(doc, { keepClasses: true }).parse();
    if (!parsed || !parsed.textContent || parsed.textContent.trim().length < MIN_TEXT_LENGTH) {
      return { ok: false, reason: "no-article" };
    }

    const container = doc.createElement("div");
    container.innerHTML = parsed.content;
    if (looksLikeListing(container)) return { ok: false, reason: "no-article" };
    ensureTableHeaders(container);

    const turndown = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
      bulletListMarker: "-",
    });
    turndown.use(gfm);
    const body = turndown.turndown(container.innerHTML);

    const title = (parsed.title || "").trim();
    const meta = {
      title,
      author: parsed.byline ? parsed.byline.trim() : undefined,
      source: url,
      clipped: convert.todayISO(now),
    };
    return {
      ok: true,
      title,
      markdown: convert.buildMarkdown(meta, body),
      words: parsed.textContent.split(/\s+/).filter(Boolean).length,
      filename: `${convert.slugify(title)}.md`,
    };
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { extractArticle };
  } else {
    root.__dotmdExtract = () => {
      try {
        return extractArticle(document.cloneNode(true), {
          url: location.href,
          now: new Date(),
          Readability: root.Readability,
          TurndownService: root.TurndownService,
          gfm: root.turndownPluginGfm.gfm,
        });
      } catch (err) {
        return { ok: false, reason: "error" };
      }
    };
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
