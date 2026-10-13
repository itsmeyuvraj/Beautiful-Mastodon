#!/usr/bin/env bash
set -euo pipefail

# Ensure WebAssembly package exists
if [ ! -f "static/pkg/mastodon_wasm_bg.wasm" ]; then
  echo "==> Building WebAssembly client..."
  ./scripts/build.sh
fi

echo "==> Starting Beautiful Mastodon Server..."
exec ./target/release/mastodon-server
