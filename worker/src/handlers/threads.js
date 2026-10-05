import convert from "../../../src/convert.js";
import { readOg } from "../og.js";

const { buildMarkdown, todayISO } = convert;

export function parseThreadsUrl(url) {
  const m = url.pathname.match(/^\/@([^/]+)\/post\/([A-Za-z0-9_-]+)/);
  return m ? { handle: m[1], code: m[2] } : null;
}

export async function handleThreads(url, deps) {
  const parsed = parseThreadsUrl(url);
  if (!parsed) return { ok: false, error: "unsupported-url" };

  const page = await deps.fetchLimited(url);
  if (!page.ok) return { ok: false, error: page.error };

  const og = readOg(page.text);
  const generic = /^threads$/i.test((og.title || "").trim()); // login wall / deleted post
  const text = (og.description || (generic ? "" : og.title) || "").trim();
  if (!text) return { ok: false, error: "private-or-missing" };

  const title = `@${parsed.handle} on Threads`;
  const meta = { title, author: `@${parsed.handle}`, source: url.toString(), clipped: todayISO(deps.now) };
  return {
    ok: true, kind: "threads", title,
    markdown: buildMarkdown(meta, text),
    words: text.split(/\s+/).filter(Boolean).length,
    filename: `threads-${parsed.handle}-${parsed.code}.md`,
  };
}
