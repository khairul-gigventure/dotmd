(function (root) {
  // Quote anything YAML would misparse: special leading chars, ": " / trailing ":", " #",
  // trailing space, and scalars it would read as bool/null/number (e.g. "1984", "No", "0x1F").
  const NEEDS_QUOTE =
    /(^[\s\-?:,\[\]{}#&*!|>'"%@`])|(:(\s|$))|( #)|\s$|^(true|false|yes|no|on|off|null|~)$|^[-+]?(\d|\.\d)|^\.(inf|nan)$/i;

  function oneLine(value) {
    return String(value).replace(/[\s\u0085]+/g, " ").trim();
  }

  function slugify(title) {
    const slug = String(title || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80)
      .replace(/-+$/g, "");
    return slug || "article";
  }

  function yamlValue(value) {
    return NEEDS_QUOTE.test(value) ? JSON.stringify(value) : value;
  }

  function buildFrontmatter(meta) {
    const lines = ["---"];
    for (const key of ["title", "author", "source", "clipped"]) {
      const value = meta[key];
      if (value === undefined || value === null || String(value).trim() === "") continue;
      const text = oneLine(value);
      // source (URL) and clipped (ISO date) are machine-generated and safe as plain scalars.
      lines.push(`${key}: ${key === "title" || key === "author" ? yamlValue(text) : text}`);
    }
    lines.push("---");
    return lines.join("\n");
  }

  function buildMarkdown(meta, body) {
    const heading = meta.title ? `# ${oneLine(meta.title)}\n\n` : "";
    return `${buildFrontmatter(meta)}\n\n${heading}${String(body).trim()}\n`;
  }

  function todayISO(now) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  const api = { slugify, buildFrontmatter, buildMarkdown, todayISO };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.DotMD = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
