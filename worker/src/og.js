const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      const valid = Number.isFinite(code) && code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff);
      return valid ? String.fromCodePoint(code) : "\uFFFD";
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

function attrs(tag) {
  const out = {};
  for (const m of tag.matchAll(/([a-zA-Z:_-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
    out[m[1].toLowerCase()] = m[3] ?? m[4] ?? "";
  }
  return out;
}

export function readOg(html) {
  const found = {};
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const a = attrs(tag);
    if (a.content === undefined) continue;
    const key = (a.property || a.name || "").toLowerCase();
    if (key === "og:title") found.title = decode(a.content);
    else if (key === "og:description") found.description = decode(a.content);
    else if (key === "og:site_name") found.siteName = decode(a.content);
  }
  return found;
}
