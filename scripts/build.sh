#!/usr/bin/env bash
set -euo pipefail

echo "==> Building WebAssembly client (mastodon-wasm)..."
cargo build --target wasm32-unknown-unknown --release -p mastodon-wasm

echo "==> Generating WebAssembly web bindings..."
mkdir -p static/pkg
wasm-bindgen --target web --out-dir static/pkg target/wasm32-unknown-unknown/release/mastodon_wasm.wasm

echo "==> Building backend server (mastodon-server)..."
cargo build --release -p mastodon-server

echo "==> Build complete! Run './target/release/mastodon-server' to launch."
