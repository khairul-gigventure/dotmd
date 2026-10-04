const test = require("node:test");
const assert = require("node:assert");
const { JSDOM } = require("jsdom");
const { togglePanel } = require("../panel.js");

const OK = { ok: true, title: "My Title", markdown: "# md", words: 123, filename: "my-title.md" };
const flush = () => new Promise((r) => setTimeout(r, 0));

function setup(result, overrides = {}) {
  const doc = new JSDOM("<!doctype html><body><p>page</p></body>").window.document;
  const calls = { copied: [], saved: [] };
  const deps = {
    extract: () => result,
    writeText: async (t) => calls.copied.push(t),
    saveFile: (name, text) => calls.saved.push([name, text]),
    ...overrides,
  };
  const root = () => {
    const host = doc.getElementById("dotmd-panel-host");
    return host && host.shadowRoot;
  };
  return { doc, deps, calls, root };
}

test("opens a panel showing title and word count, with buttons enabled", () => {
  const { doc, deps, root } = setup(OK);
  assert.strictEqual(togglePanel(doc, deps), "opened");
  assert.strictEqual(root().getElementById("status").textContent, "My Title");
  assert.match(root().getElementById("meta").textContent, /123 perkataan/);
  assert.strictEqual(root().getElementById("copy").disabled, false);
  assert.strictEqual(root().getElementById("download").disabled, false);
});

test("second toggle closes the panel", () => {
  const { doc, deps, root } = setup(OK);
  togglePanel(doc, deps);
  assert.strictEqual(togglePanel(doc, deps), "closed");
  assert.strictEqual(root(), null);
});

test("close button removes the panel", () => {
  const { doc, deps, root } = setup(OK);
  togglePanel(doc, deps);
  root().getElementById("close").click();
  assert.strictEqual(root(), null);
});

test("extraction runs before the panel is attached to the page", () => {
  const { doc, deps } = setup(OK);
  let hostPresentDuringExtract = null;
  deps.extract = () => {
    hostPresentDuringExtract = !!doc.getElementById("dotmd-panel-host");
    return OK;
  };
  togglePanel(doc, deps);
  assert.strictEqual(hostPresentDuringExtract, false);
});

test("copy writes markdown and shows 'Copied ✓'", async () => {
  const { doc, deps, calls, root } = setup(OK);
  togglePanel(doc, deps);
  root().getElementById("copy").click();
  await flush();
  assert.deepStrictEqual(calls.copied, ["# md"]);
  assert.strictEqual(root().getElementById("copy").textContent, "Copied ✓");
});

test("copy failure shows 'Gagal copy'", async () => {
  const { doc, deps, root } = setup(OK, { writeText: async () => { throw new Error("denied"); } });
  togglePanel(doc, deps);
  root().getElementById("copy").click();
  await flush();
  assert.strictEqual(root().getElementById("copy").textContent, "Gagal copy");
});

test("download saves filename and markdown", () => {
  const { doc, deps, calls, root } = setup(OK);
  togglePanel(doc, deps);
  root().getElementById("download").click();
  assert.deepStrictEqual(calls.saved, [["my-title.md", "# md"]]);
});

test("empty title falls back to '(Tiada tajuk)'", () => {
  const { doc, deps, root } = setup({ ...OK, title: "" });
  togglePanel(doc, deps);
  assert.strictEqual(root().getElementById("status").textContent, "(Tiada tajuk)");
});

test("no article shows message and keeps buttons disabled", () => {
  const { doc, deps, root } = setup({ ok: false, reason: "no-article" });
  togglePanel(doc, deps);
  assert.strictEqual(root().getElementById("status").textContent, "Tak jumpa article di page ni");
  assert.strictEqual(root().getElementById("copy").disabled, true);
});

test("conversion error shows its own message", () => {
  const { doc, deps, root } = setup({ ok: false, reason: "error" });
  togglePanel(doc, deps);
  assert.strictEqual(root().getElementById("status").textContent, "Gagal tukar page ni");
});
