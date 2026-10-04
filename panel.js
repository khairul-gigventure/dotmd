(function (root) {
  const HOST_ID = "dotmd-panel-host";

  const CSS = `
    :host { all: initial; }
    .panel { position: fixed; top: 0; right: 0; width: 340px; height: 100vh; box-sizing: border-box;
      padding: 16px; display: flex; flex-direction: column; gap: 8px;
      font: 13px/1.45 -apple-system, system-ui, sans-serif; color: #111; background: #fff;
      border-left: 1px solid #0002; box-shadow: -8px 0 24px #0002; z-index: 2147483647; }
    @media (prefers-color-scheme: dark) { .panel { color: #eee; background: #1c1c1e; border-left-color: #fff3; } }
    header { display: flex; align-items: center; justify-content: space-between; }
    h1 { margin: 0; font-size: 15px; }
    #status { margin: 8px 0 0; font-weight: 600; word-break: break-word; }
    #meta { margin: 0; opacity: .7; }
    .actions { display: flex; gap: 8px; margin-top: 8px; }
    button { flex: 1; padding: 8px; border-radius: 8px; border: 1px solid #8886; background: #8881;
      color: inherit; font: inherit; cursor: pointer; }
    button:hover:not(:disabled) { background: #8883; }
    button:disabled { opacity: .4; cursor: default; }
    #close { flex: none; width: 28px; padding: 2px 0; }
  `;

  function el(doc, tag, props) {
    const node = doc.createElement(tag);
    Object.assign(node, props);
    return node;
  }

  function togglePanel(doc, deps) {
    const existing = doc.getElementById(HOST_ID);
    if (existing) {
      existing.remove();
      return "closed";
    }

    // Extract first so the panel itself never ends up in the converted page.
    const result = deps.extract();

    const host = el(doc, "div", { id: HOST_ID });
    const shadow = host.attachShadow({ mode: "open" });
    shadow.appendChild(el(doc, "style", { textContent: CSS }));

    const panel = el(doc, "div", { className: "panel" });
    const header = el(doc, "header");
    header.append(el(doc, "h1", { textContent: "DotMD" }), el(doc, "button", { id: "close", textContent: "×", title: "Tutup" }));
    const status = el(doc, "p", { id: "status" });
    const meta = el(doc, "p", { id: "meta", hidden: true });
    const copy = el(doc, "button", { id: "copy", textContent: "Copy Markdown", disabled: true });
    const download = el(doc, "button", { id: "download", textContent: "Download .md", disabled: true });
    const actions = el(doc, "div", { className: "actions" });
    actions.append(copy, download);
    panel.append(header, status, meta, actions);
    shadow.appendChild(panel);

    header.querySelector("#close").addEventListener("click", () => host.remove());

    if (result && result.ok) {
      status.textContent = result.title || "(Tiada tajuk)";
      meta.textContent = `${result.words} perkataan`;
      meta.hidden = false;
      copy.disabled = download.disabled = false;
      copy.addEventListener("click", async () => {
        try {
          await deps.writeText(result.markdown);
          copy.textContent = "Copied ✓";
        } catch (err) {
          copy.textContent = "Gagal copy";
        }
        setTimeout(() => (copy.textContent = "Copy Markdown"), 1500);
      });
      download.addEventListener("click", () => deps.saveFile(result.filename, result.markdown));
    } else {
      status.textContent =
        result && result.reason === "error" ? "Gagal tukar page ni" : "Tak jumpa article di page ni";
    }

    doc.documentElement.appendChild(host);
    return "opened";
  }

  function saveFile(filename, text) {
    // data: URL so the download does not depend on a blob that dies with the page.
    const a = document.createElement("a");
    a.href = "data:text/markdown;charset=utf-8," + encodeURIComponent(text);
    a.download = filename;
    a.click();
  }

  if (typeof module === "object" && module.exports) {
    module.exports = { togglePanel };
  } else {
    togglePanel(document, {
      extract: () => root.__dotmdExtract(),
      writeText: (t) => navigator.clipboard.writeText(t),
      saveFile,
    });
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
