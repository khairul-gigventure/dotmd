// URL validation and a size/time-limited fetch. Every outbound request from the Worker goes through here.
// Note: hostnames that merely *resolve* to a private IP (e.g. foo.nip.io) cannot be detected without DNS;
// Cloudflare Workers cannot reach private networks from the edge, which is the backstop.

const DEFAULT_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
};
const MAX_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function isPrivateIPv4(host) {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

function isPrivateIPv6(host) {
  const h = host.toLowerCase();
  if (h === "::1" || h === "::") return true;
  if (h.startsWith("::ffff:") || h.startsWith("64:ff9b:")) return true; // IPv4-mapped / NAT64
  const first = h.split(":")[0];
  if (/^f[cd][0-9a-f]{2}$/.test(first)) return true; // fc00::/7
  if (/^fe[89ab][0-9a-f]$/.test(first)) return true; // fe80::/10
  return false;
}

export function validateUrl(raw) {
  let url;
  try {
    url = new URL(String(raw));
  } catch {
    return { ok: false, error: "bad-url" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false, error: "unsupported-url" };
  if (url.username || url.password) return { ok: false, error: "unsupported-url" };
  if (url.port && url.port !== "80" && url.port !== "443") return { ok: false, error: "unsupported-url" };

  let host = url.hostname.toLowerCase();
  if (host.startsWith("[") && host.endsWith("]")) {
    if (isPrivateIPv6(host.slice(1, -1))) return { ok: false, error: "unsupported-url" };
    return { ok: true, url };
  }
  host = host.replace(/\.$/, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host === "") {
    return { ok: false, error: "unsupported-url" };
  }
  if (isPrivateIPv4(host)) return { ok: false, error: "unsupported-url" };
  return { ok: true, url };
}

class TimeoutError extends Error {}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError("timeout")), Math.max(ms, 0));
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function readBody(response, maxBytes, remainingMs) {
  const reader = response.body ? response.body.getReader() : null;
  if (!reader) return { text: "" };
  const deadline = Date.now() + remainingMs;
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await withTimeout(reader.read(), deadline - Date.now());
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) return { error: "too-large" };
      chunks.push(value);
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { bytes.set(c, offset); offset += c.byteLength; }
  return { text: new TextDecoder().decode(bytes) };
}

export async function fetchLimited(url, opts = {}) {
  const {
    fetchImpl = fetch,
    timeoutMs = 10_000,
    maxBytes = 3_000_000,
    requireHtml = true,
    headers = {},
  } = opts;
  const deadline = Date.now() + timeoutMs;
  const controller = new AbortController();
  let current = url;

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const response = await withTimeout(
        fetchImpl(current.toString(), {
          redirect: "manual",
          headers: { ...DEFAULT_HEADERS, ...headers },
          signal: controller.signal,
        }),
        deadline - Date.now()
      );

      if (REDIRECT_STATUSES.has(response.status)) {
        const location = response.headers.get("location");
        if (!location || hop === MAX_REDIRECTS) return { ok: false, error: "fetch-failed" };
        const next = validateUrl(new URL(location, current).toString());
        if (!next.ok) return { ok: false, error: next.error };
        current = next.url;
        continue;
      }

      const { status } = response;
      if (status === 401 || status === 403 || status === 429) return { ok: false, error: "blocked" };
      if (status === 404 || status === 410) return { ok: false, error: "private-or-missing" };
      if (status < 200 || status >= 300) return { ok: false, error: "fetch-failed" };

      const contentType = response.headers.get("content-type") || "";
      if (requireHtml && !/html/i.test(contentType)) return { ok: false, error: "not-html" };
      const declared = Number(response.headers.get("content-length"));
      if (declared > maxBytes) return { ok: false, error: "too-large" };

      const body = await readBody(response, maxBytes, deadline - Date.now());
      if (body.error) return { ok: false, error: body.error };
      return { ok: true, text: body.text, finalUrl: current.toString(), contentType };
    }
    return { ok: false, error: "fetch-failed" };
  } catch (err) {
    return { ok: false, error: err instanceof TimeoutError ? "timeout" : "fetch-failed" };
  } finally {
    controller.abort();
  }
}
