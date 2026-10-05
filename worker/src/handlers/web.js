import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import extract from "../../../extract.js";
import { parseDoc, stripNoise } from "../dom.js";

const { extractArticle } = extract;

export async function handleWeb(url, deps) {
  const page = await deps.fetchLimited(url);
  if (!page.ok) return { ok: false, error: page.error };

  const result = extractArticle(parseDoc(stripNoise(page.text), page.finalUrl), {
    url: page.finalUrl, now: deps.now, Readability, TurndownService, gfm,
  });
  if (!result.ok) return { ok: false, error: result.reason === "error" ? "internal" : "no-article" };

  return {
    ok: true, kind: "web", title: result.title, markdown: result.markdown,
    words: result.words, filename: result.filename,
  };
}
