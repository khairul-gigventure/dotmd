import convert from "../../../src/convert.js";

const { buildMarkdown, slugify, todayISO } = convert;
const SYNDICATION = "https://cdn.syndication.twimg.com/tweet-result";

export function parseXUrl(url) {
  const m = url.pathname.match(/^\/([^/]+)\/status\/(\d+)/);
  return m ? { handle: m[1], id: m[2] } : null;
}

// Same token scheme the public embed script uses; endpoint is unofficial and may change.
export function xToken(id) {
  return ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, "");
}

export async function handleX(url, deps) {
  const parsed = parseXUrl(url);
  if (!parsed) return { ok: false, error: "unsupported-url" };

  const api = new URL(SYNDICATION);
  api.searchParams.set("id", parsed.id);
  api.searchParams.set("token", xToken(parsed.id));
  const res = await deps.fetchLimited(api, { requireHtml: false });
  if (!res.ok) return { ok: false, error: res.error };

  let data;
  try {
    data = res.text.trim() ? JSON.parse(res.text) : null;
  } catch {
    return { ok: false, error: "fetch-failed" };
  }
  if (!data || data.__typename === "TweetTombstone" || !data.text) {
    return { ok: false, error: "private-or-missing" };
  }

  const screen = data.user?.screen_name || parsed.handle;
  const title = `${data.user?.name || screen} (@${screen}) on X`;
  const photos = (data.mediaDetails || [])
    .filter((m) => m.type === "photo" && m.media_url_https)
    .map((m) => `![](${m.media_url_https})`);
  const body = [data.text, ...photos].join("\n\n");
  const meta = { title, author: `@${screen}`, source: url.toString(), clipped: todayISO(deps.now) };

  return {
    ok: true, kind: "x", title,
    markdown: buildMarkdown(meta, body),
    words: data.text.split(/\s+/).filter(Boolean).length,
    filename: `x-${slugify(screen)}-${parsed.id}.md`,
  };
}
