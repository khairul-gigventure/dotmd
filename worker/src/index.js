import { validateUrl, fetchLimited } from "./guard.js";
import { ERROR_MESSAGES, ERROR_STATUS } from "./messages.js";
import { handleWeb } from "./handlers/web.js";
import { handleX } from "./handlers/x.js";
import { handleThreads } from "./handlers/threads.js";
import { handleFacebook } from "./handlers/facebook.js";

const bare = (host) => host.toLowerCase().replace(/^(www\.|m\.|mobile\.)/, "");

export function pickHandler(url) {
  const host = bare(url.hostname);
  if (host === "x.com" || host === "twitter.com") return "x";
  if (host === "threads.com" || host === "threads.net") return "threads";
  if (host === "facebook.com" || host === "fb.com" || host === "fb.watch") return "facebook";
  return "web";
}

function corsHeaders(origin, env) {
  const allowed = String(env?.ALLOWED_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);
  const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || "");
  const headers = { vary: "Origin" };
  if (origin && (allowed.includes(origin) || local)) headers["access-control-allow-origin"] = origin;
  return headers;
}

function json(body, status, cors) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...cors },
  });
}

function failure(error, cors) {
  return json({ ok: false, error, message: ERROR_MESSAGES[error] }, ERROR_STATUS[error], cors);
}

export function createWorker(deps = {}) {
  const handlers = deps.handlers || { web: handleWeb, x: handleX, threads: handleThreads, facebook: handleFacebook };
  const doFetch = deps.fetchLimited || fetchLimited;
  const now = deps.now || (() => new Date());

  return {
    async fetch(request, env) {
      const cors = corsHeaders(request.headers.get("origin"), env);
      const { pathname, searchParams } = new URL(request.url);

      if (pathname !== "/api/clip") return json({ ok: false, error: "not-found" }, 404, cors);
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: { ...cors, "access-control-allow-methods": "GET, OPTIONS", "access-control-allow-headers": "content-type" },
        });
      }
      if (request.method !== "GET") return json({ ok: false, error: "method-not-allowed" }, 405, cors);

      const checked = validateUrl(searchParams.get("url") || "");
      if (!checked.ok) return failure(checked.error, cors);

      try {
        const result = await handlers[pickHandler(checked.url)](checked.url, { fetchLimited: doFetch, now: now() });
        return result.ok ? json(result, 200, cors) : failure(result.error, cors);
      } catch (err) {
        console.error("clip failed:", err && err.stack); // stack only, never the requested URL
        return failure("internal", cors);
      }
    },
  };
}

export default createWorker();
