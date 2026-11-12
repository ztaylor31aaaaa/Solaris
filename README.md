# Solaris

Solaris is a reusable browser-based application shell extracted from the Solaris app in [edustar](https://github.com/ztaylor31aaaaa/edustar). This repository is configured to deploy as a **Cloudflare Worker with Static Assets**.

## Project layout

- `index.html`, `app.js`, `style.css`, `config.js` — application frontend.
- `_worker.js` — Cloudflare Worker request handler and API routes.
- `wrangler.jsonc` — Worker name, entry point and Static Assets configuration.
- `arcade/version.json` — frontend version marker used by the update checker.
- `worker/README.md` — deployment notes.

## Cloudflare Worker deployment

The configured Worker name is `solaris`.

The repository uses the Wrangler configuration in `wrangler.jsonc`:
- Worker entry point: `_worker.js`
- Static asset directory: repository root
- Static asset binding: `ASSETS`
- Worker-first routes: `/api/*`

For a Git-connected Cloudflare Worker, connect this GitHub repository to the existing `solaris` Worker in Cloudflare's **Builds & deployments** settings. Use:
- Build command: `npm install`
- Deploy command: `npx wrangler deploy`
- Root directory: `/`

Alternatively, from a local checkout run `npm install` and then `npm run deploy`. The deploy command publishes to the Worker named in `wrangler.jsonc`.

## Worker API routes

- `GET /api/health` — Worker health check.
- `GET /api/version` — app version check.
- `GET /api/wikipedia/page?title=...` — retrieves a Wikipedia article for the in-app reader.
- `POST /api/ai/nim` — forwards a chat request to NVIDIA NIM. The user's provider key is sent in the request and is not stored by this Worker.
- `GET /owned-site/...` — serves this Worker site's own static assets through the in-app owned-site viewer.

Unknown `/api/*` routes return a JSON 404. This Worker does not provide an unrestricted third-party website proxy.

## Make another branded site

1. Copy this repository or create a new repository from it.
2. Edit `config.js` (name, tagline, accent and module switches).
3. Adjust `style.css` for the new brand.
4. Change the Worker name in `wrangler.jsonc` for a separate deployment.
5. Connect the new repository to its own Cloudflare Worker.

## Security

The original site's authentication, feedback recipient configuration, developer-access secrets and private deployment settings are intentionally not copied into this repository. Add separate backend logic and secrets only when needed. Never commit API keys or passwords.

The app retains existing `sunset_settings`, `sunset_favs` and `sunset_recent` browser-storage keys so existing Solaris preferences can be migrated without losing settings.
