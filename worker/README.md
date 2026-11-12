# Solaris Cloudflare Worker

The active Worker implementation is at the repository root in `_worker.js`. Its configuration is in `wrangler.jsonc`.

## Current routes

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/health` | GET | Confirms that the Worker is running. |
| `/api/version` | GET | Returns the app version marker. |
| `/api/wikipedia/page?title=` | GET | Fetches a Wikipedia article for the built-in reader. |
| `/api/ai/nim` | POST | Forwards chat requests to NVIDIA NIM using the key supplied in that request. |
| `/owned-site/...` | GET | Serves this deployment's own static assets through the app's owned-site viewer. |

Unknown `/api/*` routes return a JSON 404. The Worker does not fetch arbitrary third-party URLs and is not an unrestricted web proxy.

## Deploy

The Worker is named `solaris`. Connect this GitHub repository to that existing Worker using Cloudflare **Workers & Pages → solaris → Settings → Builds & deployments** (the exact dashboard labels may vary).

Recommended build settings:
- Root directory: `/`
- Build command: `npm install`
- Deploy command: `npx wrangler deploy`

The Wrangler config points to `_worker.js` and serves the repository's frontend files as Static Assets. To deploy from a local checkout, run `npm install` followed by `npm run deploy`.

## Security notes

- Do not commit API keys, passwords or private secrets.
- The AI route validates request size, message roles and same-origin requests.
- The Worker only provides the owned-site asset route for this deployment; it does not proxy arbitrary websites.
- Add any future external integration as a narrowly scoped route with input validation, response limits and rate limiting.
