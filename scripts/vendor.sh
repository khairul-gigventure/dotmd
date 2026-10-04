#!/bin/sh
# Copy browser builds of the libraries into lib/ (committed, no build step for the extension).
set -e
cd "$(dirname "$0")/.."
mkdir -p lib
cp node_modules/@mozilla/readability/Readability.js lib/Readability.js
cp node_modules/turndown/lib/turndown.browser.umd.js lib/turndown.js
cp node_modules/turndown-plugin-gfm/dist/turndown-plugin-gfm.js lib/turndown-plugin-gfm.js
echo "Vendored: $(ls lib | tr '\n' ' ')"
