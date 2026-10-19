#!/usr/bin/env bash
# Renders the brand sources in scripts/brand/ into public/ (press kit and social image).
# Text is converted to outlines, so the SVGs look the same without the fonts installed.
# Needs rsvg-convert (librsvg) and uv (for fonttools); the fonts come from node_modules (pnpm install).
set -euo pipefail
cd "$(dirname "$0")/../.."

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
# The renderer can't read WOFF2, so unpack the Latin subsets to TTF first
# (the other subset files share the family name but lack these glyphs).
mkdir "$tmp/fonts"
for font in source-serif-4/files/source-serif-4 public-sans/files/public-sans; do
  src="node_modules/@fontsource-variable/$font-latin-wght-normal.woff2"
  uvx --quiet --from 'fonttools[woff]' fonttools ttLib.woff2 decompress "$src" -o "$tmp/fonts/$(basename "$font").ttf"
done
cat > "$tmp/fonts.conf" <<CONF
<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>$tmp/fonts</dir>
  <cachedir>$tmp/cache</cachedir>
</fontconfig>
CONF
export FONTCONFIG_FILE="$tmp/fonts.conf"

mkdir -p public/press public/og
for name in emblem emblem-inverse wordmark wordmark-inverse; do
  rsvg-convert -f svg "scripts/brand/$name.svg" -o "public/press/$name.svg"
done
rsvg-convert -w 1024 scripts/brand/emblem.svg -o public/press/emblem.png
rsvg-convert -w 1024 scripts/brand/emblem-inverse.svg -o public/press/emblem-inverse.png
rsvg-convert -w 2240 scripts/brand/wordmark.svg -o public/press/wordmark.png
rsvg-convert -w 2240 scripts/brand/wordmark-inverse.svg -o public/press/wordmark-inverse.png
rsvg-convert -w 1200 -h 630 scripts/brand/og-image.svg -o public/og/default.png
echo "Rendered public/press/* and public/og/default.png"
