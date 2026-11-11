# Backend adapter

The Solaris frontend is designed to call same-origin API routes. This folder documents the expected interface; it does not contain a universal web proxy or the original Edustar site's private integrations.

Implement these routes in your chosen server/Cloudflare Worker:

| Route | Purpose |
| --- | --- |
| `GET /api/search/google?q=` | Search results for the configured search view. |
| `GET /api/search/wikipedia?q=` | Wikipedia search results. |
| `GET /api/wikipedia/page?title=` | Retrieve a Wikipedia article. |
| `GET /api/proxy/read?url=` | Readable preview for a URL you are authorised to access. |
| `GET /api/version` | Return app version/update metadata. |
| `POST /api/ai/nim` | Optional server-side AI provider adapter. |

Use strict hostname allowlists for any server-side fetching. Validate URLs, reject private-network and localhost destinations, limit response size and content types, apply timeouts and rate limits, and do not expose API keys to the browser.

The original Edustar Worker is not copied because it contains site-specific feedback routing and developer-access functionality. Create a separate adapter for each deployment and keep credentials in host environment variables.
