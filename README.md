# Solaris

Solaris is a reusable browser-based application shell extracted from the Solaris app in [edustar](https://github.com/ztaylor31aaaaa/edustar). Use this repository as the base for multiple branded websites or deployments.

## Project layout

- `index.html` — application entry point.
- `app.js` — main application logic (navigation, tabs, games, search, AI workspace, settings and feedback UI).
- `style.css` — Solaris application styling.
- `config.js` — per-site name, tagline, accent and module configuration.
- `shared/theme.js` and `shared/theme.css` — optional shared theme utilities for surrounding pages.
- `worker/README.md` — backend/API deployment notes.

## Run locally

This is a static web app. Serve the repository root with any local static HTTP server; opening `index.html` directly may prevent browser storage and fetch features from working correctly.

## Make another branded site

1. Copy this repository or create a new repository from it.
2. Edit `config.js` (name, tagline, accent and module switches).
3. Adjust `style.css` for the new brand.
4. Deploy the static files to a host such as Cloudflare Pages or GitHub Pages.
5. Configure the backend routes described in `worker/README.md` if you want search, AI proxying, update checks or other server-backed features.

## Backend requirements

The app expects same-origin API endpoints for some features, including:

- `GET /api/search/google?q=...`
- `GET /api/search/wikipedia?q=...`
- `GET /api/wikipedia/page?title=...`
- `GET /api/proxy/read?url=...`
- `GET /api/version`
- `POST /api/ai/nim`

The game catalogue is currently loaded from the Snubby games catalogue CDN. Some AI providers can also be configured client-side in the app settings. These external services can change independently of Solaris.

**Important:** The reusable frontend is included here. The original site's authentication, feedback recipient configuration, developer-access secrets and private deployment settings are intentionally not copied into this repository. Add your own backend implementation and secrets as environment variables; never commit API keys or passwords.

## Compatibility note

The app retains existing `sunset_settings`, `sunset_favs` and `sunset_recent` browser-storage keys so existing Solaris preferences can be migrated without losing settings.
