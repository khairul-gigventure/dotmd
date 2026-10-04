#!/bin/sh
# Build dist/dotmd-<version>.zip containing only what the extension needs at runtime.
set -e
cd "$(dirname "$0")/.."
VERSION=$(node -p 'require("./manifest.json").version')
OUT="dist/dotmd-$VERSION.zip"
mkdir -p dist
rm -f "$OUT"
zip -qr "$OUT" manifest.json background.js panel.js extract.js src lib icons
echo "$OUT"
