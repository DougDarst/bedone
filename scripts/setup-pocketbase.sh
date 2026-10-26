#!/usr/bin/env bash
# Downloads the pinned PocketBase binary into the repo root (git-ignored),
# verifying it against the release's published checksums.
set -euo pipefail

VERSION="0.40.6"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$ROOT/pocketbase"

if [[ -x "$BIN" ]] && "$BIN" --version 2>/dev/null | grep -q "$VERSION"; then
  echo "PocketBase $VERSION already installed."
  exit 0
fi

case "$(uname -s)" in
  Darwin) OS=darwin ;;
  Linux) OS=linux ;;
  *) echo "Unsupported OS: $(uname -s)" >&2; exit 1 ;;
esac
case "$(uname -m)" in
  arm64|aarch64) ARCH=arm64 ;;
  x86_64|amd64) ARCH=amd64 ;;
  *) echo "Unsupported architecture: $(uname -m)" >&2; exit 1 ;;
esac

ZIP="pocketbase_${VERSION}_${OS}_${ARCH}.zip"
BASE="https://github.com/pocketbase/pocketbase/releases/download/v${VERSION}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Downloading PocketBase $VERSION ($OS/$ARCH)..."
curl -fsSL -o "$TMP/$ZIP" "$BASE/$ZIP"
curl -fsSL -o "$TMP/checksums.txt" "$BASE/checksums.txt"

EXPECTED="$(grep " $ZIP\$" "$TMP/checksums.txt" | awk '{print $1}')"
if command -v sha256sum >/dev/null; then
  ACTUAL="$(sha256sum "$TMP/$ZIP" | awk '{print $1}')"
else
  ACTUAL="$(shasum -a 256 "$TMP/$ZIP" | awk '{print $1}')"
fi
if [[ -z "$EXPECTED" || "$EXPECTED" != "$ACTUAL" ]]; then
  echo "Checksum mismatch for $ZIP" >&2
  exit 1
fi

unzip -q -o "$TMP/$ZIP" pocketbase -d "$TMP/out"
mv "$TMP/out/pocketbase" "$BIN"
chmod +x "$BIN"
echo "Installed $("$BIN" --version)"
