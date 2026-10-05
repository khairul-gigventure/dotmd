import convert from "../../../src/convert.js";
import { readOg } from "../og.js";

const { buildMarkdown, slugify, todayISO } = convert;

export const FACEBOOK_NOTE = "Facebook: teks dipotong (~200 aksara). Post penuh perlu dibuka sendiri.";
const LOGIN_TITLE = /^(log in|log into|masuk|facebook$)/i;

export async function handleFacebook(url, deps) {
  const page = await deps.fetchLimited(url);
  if (!page.ok) return { ok: false, error: page.error };

  const og = readOg(page.text);
  const text = (og.description || "").trim();
  if (!text || LOGIN_TITLE.test((og.title || "").trim())) return { ok: false, error: "private-or-missing" };

  const title = (og.title || "Facebook post").trim();
  const meta = { title, source: url.toString(), clipped: todayISO(deps.now) };
  return {
    ok: true, kind: "facebook", title,
    markdown: buildMarkdown(meta, text),
    words: text.split(/\s+/).filter(Boolean).length,
    filename: `facebook-${slugify(title)}.md`,
    note: FACEBOOK_NOTE,
  };
}
