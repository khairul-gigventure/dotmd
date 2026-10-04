const test = require("node:test");
const assert = require("node:assert");
const { slugify, buildFrontmatter, buildMarkdown, todayISO } = require("../src/convert.js");

test("slugify makes a lowercase hyphenated slug", () => {
  assert.strictEqual(slugify("Hello, World! 2026"), "hello-world-2026");
});

test("slugify falls back to 'article' for emoji-only and non-latin titles", () => {
  assert.strictEqual(slugify("🔥🔥"), "article");
  assert.strictEqual(slugify("بسم"), "article");
});

test("buildFrontmatter omits missing fields", () => {
  assert.strictEqual(
    buildFrontmatter({ title: "A", source: "https://x.com/a", clipped: "2026-10-04" }),
    "---\ntitle: A\nsource: https://x.com/a\nclipped: 2026-10-04\n---"
  );
});

test("buildFrontmatter quotes YAML-special values", () => {
  assert.ok(
    buildFrontmatter({ title: 'Why: "quotes" # tags' }).includes('title: "Why: \\"quotes\\" # tags"')
  );
});

test("buildMarkdown puts # title then body and ends with one newline", () => {
  const md = buildMarkdown({ title: "T" }, "body");
  assert.ok(md.endsWith("# T\n\nbody\n"));
});

test("todayISO formats local date", () => {
  assert.strictEqual(todayISO(new Date(2026, 9, 4)), "2026-10-04");
});

test("buildFrontmatter quotes values ending in colon", () => {
  assert.ok(buildFrontmatter({ title: "Update:" }).includes('title: "Update:"'));
});

test("buildFrontmatter quotes values YAML would read as number or bool or null", () => {
  for (const v of ["1984", "2026 Trends", "true", "No", "null", "~", "0x1F", ".inf"]) {
    assert.ok(buildFrontmatter({ title: v }).includes(`title: ${JSON.stringify(v)}`), v);
  }
});

test("buildFrontmatter and buildMarkdown collapse newlines and tabs in title and author", () => {
  const fm = buildFrontmatter({ title: "A\n\tB", author: "X\r\nY" });
  assert.ok(fm.includes("title: A B") && fm.includes("author: X Y"), fm);
  assert.ok(buildMarkdown({ title: "A\nB" }, "x").includes("# A B\n"));
});

test("slugify strips accents instead of dropping the letters", () => {
  assert.strictEqual(slugify("Café Résumé"), "cafe-resume");
});
