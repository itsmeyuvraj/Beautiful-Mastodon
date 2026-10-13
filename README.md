# Beautiful Federated Client (WebAssembly Edition) ⚡️🦀

A minimal, high-performance, and aesthetically polished Mastodon client rewritten completely with **Rust and WebAssembly (Wasm)**. Experience the Fediverse with blazing-fast native speed, minimal memory overhead, and a glassmorphic design system.

## 🚀 Technical Architecture

- **Frontend Core:** Pure Rust compiled to **WebAssembly** (`wasm32-unknown-unknown`) via `wasm-bindgen`
- **Frontend UI Engine:** Reactive DOM manipulation, optimistic state transitions, and asynchronous Mastodon API bindings in Rust (`crates/mastodon-wasm`)
- **Backend Proxy & Server:** High-performance async Rust server using **Axum** & **Tokio** (`crates/mastodon-server`), handling dynamic OAuth registration, multi-instance token exchanges, HTTP-only cookie sessions, multipart media uploads, and static asset delivery
- **Styling:** Custom Glassmorphic Design System with Dark/Light theme switching, Outfit & Inter typography, and micro-interactions
- **PWA & Offline:** Progressive Web App with manifest and service worker support

---

## ✨ Features

- **Full WebAssembly Execution:** Client logic, state management, Mastodon data parsing, and timeline filtering run in compiled WebAssembly.
- **Seamless Optimistic Updates:** Liking (favourites), boosting (reblogs), and bookmarking apply instantly in the WebAssembly state store while syncing in the background with automatic rollback on network failure.
- **Multi-Instance Support:** Connect to any Mastodon instance (e.g. `mastodon.social`, `fosstodon.org`, `techhub.social`).
- **Multi-Account Switching:** Store multiple authenticated accounts with instant hot-swapping from the sidebar.
- **Rich Timelines:** Home, Trending, Local, and Federated feeds with country & language filtering.
- **Conversation Threading:** Full ancestor and descendant reply tree view.
- **Composer with Media:** Publish toots, reply to threads, and attach media.
- **Search:** Instant query search for accounts, posts, and hashtags.
- **Theme Support:** Dark, Light, and System default appearance modes with smooth transitions.

---

## 🛠️ Workspace Structure

```
├── Cargo.toml                    # Workspace configuration
├── crates/
│   ├── mastodon-wasm/            # Frontend WebAssembly crate (wasm32-unknown-unknown)
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs            # App entrypoint, state lifecycle & events
│   │       ├── api.rs            # Async Fetch API bindings for Mastodon
│   │       ├── models.rs         # Strongly typed Serde models
│   │       ├── state.rs          # Reactive state store
│   │       └── ui.rs             # Glassmorphic component & HTML renderers
│   └── mastodon-server/          # Backend Axum proxy server
│       ├── Cargo.toml
│       └── src/
│           └── main.rs           # OAuth handlers, proxy routes & static file server
├── static/                       # Web static assets
│   ├── index.html                # HTML host with WebAssembly loader
│   ├── style.css                 # Glassmorphic CSS design system
│   └── pkg/                      # Generated .wasm binary & JS wrapper
└── scripts/
    ├── build.sh                  # Build script for Wasm and server
    └── dev.sh                    # Development launcher script
```

---

## 📦 Building and Running

### Prerequisites
- [Rust & Cargo](https://rustup.rs/) (installed)
- `wasm32-unknown-unknown` target:
  ```bash
  rustup target add wasm32-unknown-unknown
  ```
- `wasm-bindgen-cli` (v0.2.100):
  ```bash
  cargo install wasm-bindgen-cli --version 0.2.100
  ```

### Build the Project
Compile the WebAssembly client and the Axum backend:
```bash
./scripts/build.sh
```

### Start the Server
Launch the server on port 3000:
```bash
./scripts/dev.sh
```
Or directly:
```bash
./target/release/mastodon-server
```
Then open `http://localhost:3000` in your browser.
