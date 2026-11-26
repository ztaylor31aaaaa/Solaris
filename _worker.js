const VERSION = "solaris-2026-11-13";


function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

function sameOrigin(request, url) {
  const origin = request.headers.get("Origin");
  return !origin || origin === url.origin;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Public read-only API for Discord bots and other integrations.
    const publicApiHeaders = { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" };
    const getOnlineCount = async () => {
      const id = env.PRESENCE.idFromName("solaris-global");
      const response = await env.PRESENCE.get(id).fetch(new Request("https://presence.internal/"));
      const data = await response.json();
      return Number(data.online || 0);
    };
    const getSharedGames = async () => {
      try {
        const object = await env.GAMES_BUCKET.get("games/index.json");
        if (!object) return [];
        const data = await object.json();
        return Array.isArray(data) ? data : [];
      } catch { return []; }
    };
    if (url.pathname === "/api" || url.pathname === "/api/") {
      if (request.method !== "GET") return json({ error: "GET required." }, 405, publicApiHeaders);
      return json({
        name: "Solaris API",
        endpoints: {
          status: "GET /api/status",
          health: "GET /api/health",
          version: "GET /api/version",
          online: "GET /api/discord-presence",
          stats: "GET /api/stats",
          games: "GET /api/games",
          sharedGames: "GET /api/shared-games"
        }
      }, 200, publicApiHeaders);
    }
    if (url.pathname === "/api/health") {
      if (request.method !== "GET") return json({ error: "GET required." }, 405, publicApiHeaders);
      return json({ ok: true, status: "healthy", service: "Solaris" }, 200, publicApiHeaders);
    }
    if (url.pathname === "/api/version") {
      if (request.method !== "GET") return json({ error: "GET required." }, 405, publicApiHeaders);
      return json({ service: "Solaris", version: VERSION, buildId: env.CF_VERSION_METADATA?.id || null }, 200, publicApiHeaders);
    }
    if (url.pathname === "/api/status") {
      if (request.method !== "GET") return json({ error: "GET required." }, 405, publicApiHeaders);
      const online = await getOnlineCount();
      return json({ service: "Solaris", status: "online", online, version: VERSION, buildId: env.CF_VERSION_METADATA?.id || null, checkedAt: new Date().toISOString() }, 200, publicApiHeaders);
    }
    if (url.pathname === "/api/games") {
      if (request.method !== "GET") return json({ error: "GET required." }, 405, publicApiHeaders);
      return json(await getSharedGames(), 200, publicApiHeaders);
    }
    if (url.pathname === "/api/stats") {
      if (request.method !== "GET") return json({ error: "GET required." }, 405, publicApiHeaders);
      const [online, games] = await Promise.all([getOnlineCount(), getSharedGames()]);
      return json({ service: "Solaris", online, sharedGames: games.length, version: VERSION, buildId: env.CF_VERSION_METADATA?.id || null, checkedAt: new Date().toISOString() }, 200, publicApiHeaders);
    }

    if (url.pathname === "/api/discord-presence") {
      if (request.method !== "GET") return json({ error: "GET required." }, 405, { "Access-Control-Allow-Origin": "*" });
      const id = env.PRESENCE.idFromName("solaris-global");
      const response = await env.PRESENCE.get(id).fetch(new Request("https://presence.internal/"));
      const data = await response.json();
      const online = Number(data.online || 0);
      return json({ online, status: "Currently " + online + " People online" }, 200, { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" });
    }

    // Read-only same-origin delivery for the Polaris Games catalogue and its static game files.
    if (url.pathname.startsWith("/polaris-games/")) {
      if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed.", { status: 405 });
      let parts;
      try { parts = url.pathname.slice("/polaris-games/".length).split("/").map(decodeURIComponent); } catch { return new Response("Invalid asset path.", { status: 400 }); }
      if (!parts.length || parts.some(part => !part || part === "." || part === ".." || part.includes("/") || part.includes("\\"))) return new Response("Invalid asset path.", { status: 400 });
      const key = parts.join("/");
      if (!(key === "catalogue.json" || /^games\/[a-z0-9_-]+\/[a-z0-9._/-]+$/i.test(key)) || key.split("/").some(part => part === "." || part === "..")) return new Response("Asset not found.", { status: 404 });
      const upstream = await fetch("https://raw.githubusercontent.com/ztaylor31aaaaa/Polaris-Games/main/" + key.split("/").map(encodeURIComponent).join("/"), { headers: { "Accept": "*/*" }, cf: { cacheTtl: key === "catalogue.json" ? 30 : 300, cacheEverything: true } });
      if (!upstream.ok) return new Response(upstream.status === 404 ? "Game asset not found." : "Polaris Games asset unavailable.", { status: upstream.status });
      const extension = key.split(".").pop().toLowerCase();
      const mime = { html:"text/html; charset=utf-8",htm:"text/html; charset=utf-8",js:"text/javascript; charset=utf-8",mjs:"text/javascript; charset=utf-8",css:"text/css; charset=utf-8",json:"application/json; charset=utf-8",svg:"image/svg+xml",png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",webp:"image/webp",gif:"image/gif",avif:"image/avif",wasm:"application/wasm",woff:"font/woff",woff2:"font/woff2",ttf:"font/ttf",otf:"font/otf",mp3:"audio/mpeg",ogg:"audio/ogg",wav:"audio/wav",mp4:"video/mp4",webm:"video/webm",glb:"model/gltf-binary",gltf:"model/gltf+json" };
      const headers = new Headers(upstream.headers);
      headers.set("Content-Type", mime[extension] || upstream.headers.get("Content-Type") || "application/octet-stream");
      headers.set("Cache-Control", key === "catalogue.json" ? "no-cache" : "public, max-age=300");
      headers.set("X-Content-Type-Options", "nosniff");
      headers.set("Cross-Origin-Resource-Policy", "cross-origin");
      headers.set("Access-Control-Allow-Origin", "*");
      headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      return new Response(request.method === "HEAD" ? null : upstream.body, { status: upstream.status, headers });
    }
    if (url.pathname === "/api/shared-games") {
      if (request.method !== "GET") return json({ error: "GET required." }, 405);
      const object = await env.GAMES_BUCKET.get("games/index.json");
      if (!object) return json([]);
      try { return json(await object.json()); } catch { return json([]); }
    }

    if (url.pathname.startsWith("/shared-games/")) {
      if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed.", { status: 405 });
      const parts = url.pathname.slice("/shared-games/".length).split("/");
      if (parts.length < 2 || parts.some(part => !part || part === "." || part === "..")) return new Response("Invalid game path.", { status: 400 });
      let key;
      try { key = "games/" + parts.map(decodeURIComponent).join("/"); } catch { return new Response("Invalid game path.", { status: 400 }); }
      const object = await env.GAMES_BUCKET.get(key);
      if (!object) return new Response("Game file not found.", { status: 404 });
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("Cache-Control", "public, max-age=3600");
      headers.set("X-Content-Type-Options", "nosniff");
      return new Response(request.method === "HEAD" ? null : object.body, { headers });
    }

    if (url.pathname.startsWith("/api/developer/games")) {
      if (!sameOrigin(request, url)) return json({ error: "Cross-origin requests are not allowed." }, 403);
      const expected = env.GAME_UPLOAD_TOKEN || "";
      const supplied = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      if (!expected || supplied.length !== expected.length || supplied !== expected) return json({ error: "Developer authentication failed." }, 401);
      if (request.method === "POST") {
        const length = Number(request.headers.get("Content-Length") || 0);
        if (length > 50 * 1024 * 1024) return json({ error: "Upload exceeds the 50 MB limit." }, 413);
        let form;
        try { form = await request.formData(); } catch { return json({ error: "Invalid upload form." }, 400); }
        const name = String(form.get("name") || "").trim().slice(0, 60);
        const description = String(form.get("description") || "").trim().slice(0, 180);
        const files = form.getAll("files").filter(file => file && typeof file.arrayBuffer === "function");
        if (!name || !files.length || files.length > 500) return json({ error: "A game name and 1–500 files are required." }, 400);
        let total = 0, hasEntry = false;
        const paths = new Set();
        for (const file of files) {
          const path = String(file.name || "").replace(/\\\\/g, "/").split("/").filter(Boolean).join("/");
          if (!path || path.split("/").some(part => part === "." || part === "..") || paths.has(path)) return json({ error: "A file path is invalid or duplicated." }, 400);
          paths.add(path); total += file.size;
          if (/^(index|game)\.html?$/i.test(path)) hasEntry = true;
          if (total > 50 * 1024 * 1024) return json({ error: "Upload exceeds the 50 MB limit." }, 413);
        }
        if (!hasEntry) return json({ error: "Include an index.html or game.html entry file." }, 400);
        const id = crypto.randomUUID();
        for (const file of files) {
          const path = String(file.name).replace(/\\\\/g, "/").split("/").filter(Boolean).join("/");
          await env.GAMES_BUCKET.put("games/" + id + "/" + path, file.stream(), { httpMetadata: { contentType: file.type || "application/octet-stream" } });
        }
        const entry = paths.has("index.html") ? "index.html" : paths.has("game.html") ? "game.html" : [...paths].find(path => /\.html?$/i.test(path));
        const stored = await env.GAMES_BUCKET.get("games/index.json");
        let catalogue = [];
        if (stored) { try { catalogue = await stored.json(); } catch {} }
        const game = { id, name, description, category: "Community", entry, src: "/shared-games/" + id + "/" + entry, files: files.length, size: total, publishedAt: new Date().toISOString() };
        catalogue.push(game);
        await env.GAMES_BUCKET.put("games/index.json", JSON.stringify(catalogue), { httpMetadata: { contentType: "application/json; charset=utf-8" } });
        return json({ ok: true, game });
      }
      if (request.method === "DELETE") {
        let data;
        try { data = await request.json(); } catch { return json({ error: "Invalid JSON." }, 400); }
        const id = String(data.id || "");
        if (!/^[a-f0-9-]{30,40}$/i.test(id)) return json({ error: "Invalid game ID." }, 400);
        const listed = await env.GAMES_BUCKET.list({ prefix: "games/" + id + "/" });
        if (listed.objects.length) await env.GAMES_BUCKET.delete(listed.objects.map(item => item.key));
        const stored = await env.GAMES_BUCKET.get("games/index.json");
        let catalogue = [];
        if (stored) { try { catalogue = await stored.json(); } catch {} }
        catalogue = catalogue.filter(item => item.id !== id);
        await env.GAMES_BUCKET.put("games/index.json", JSON.stringify(catalogue), { httpMetadata: { contentType: "application/json; charset=utf-8" } });
        return json({ ok: true });
      }
      return json({ error: "POST or DELETE required." }, 405);
    }

    if (url.pathname.startsWith("/api/")) {
      if (!sameOrigin(request, url)) return json({ error: "Cross-origin requests are not allowed." }, 403);

      if (url.pathname === "/api/presence") {
        if (!["GET", "POST"].includes(request.method)) return json({ error: "GET or POST required." }, 405);
        const id = env.PRESENCE.idFromName("solaris-global");
        return env.PRESENCE.get(id).fetch(request);
      }

      if (url.pathname === "/api/health") {
        if (request.method !== "GET") return json({ error: "GET required." }, 405);
        return json({ ok: true, service: "Solaris Worker", version: VERSION });
      }
      if (url.pathname === "/api/version") {
        if (request.method !== "GET") return json({ error: "GET required." }, 405);
        return json({ id: env.CF_VERSION_METADATA?.id || VERSION, tag: env.CF_VERSION_METADATA?.tag || "", timestamp: env.CF_VERSION_METADATA?.timestamp || "" });
      }

      if (url.pathname === "/api/wikipedia/page") {
        if (request.method !== "GET") return new Response("GET required.", { status: 405 });
        const title = (url.searchParams.get("title") || "").trim().slice(0, 240);
        if (!title || !/^[\p{L}\p{N}_()%,' -]+$/u.test(title)) {
          return new Response("Invalid article title.", { status: 400 });
        }
        try {
          const upstreamUrl = "https://en.wikipedia.org/w/rest.php/v1/page/" + encodeURIComponent(title) + "/html";
          const upstream = await fetch(upstreamUrl, {
            headers: {
              "Accept": "text/html; charset=utf-8",
              "User-Agent": "SolarisEducation/1.0 (Wikipedia reader)"
            },
            cf: { cacheTtl: 900, cacheEverything: true }
          });
          if (!upstream.ok) {
            return new Response("Wikipedia article returned " + upstream.status + ".", {
              status: upstream.status === 404 ? 404 : 502,
              headers: { "Content-Type": "text/plain; charset=utf-8" }
            });
          }
          return new Response(await upstream.text(), {
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "public, max-age=900",
              "X-Content-Type-Options": "nosniff"
            }
          });
        } catch {
          return new Response("Could not contact Wikipedia.", {
            status: 502,
            headers: { "Content-Type": "text/plain; charset=utf-8" }
          });
        }
      }

      if (url.pathname === "/api/ai/nim") {
        if (request.method !== "POST") return json({ error: { message: "POST required." } }, 405);
        if (request.headers.get("Sec-Fetch-Site") === "cross-site") {
          return json({ error: { message: "Cross-site requests are not allowed." } }, 403);
        }

        const length = Number(request.headers.get("Content-Length") || 0);
        if (length > 500_000) return json({ error: { message: "Request is too large." } }, 413);

        let data;
        try {
          const raw = await request.text();
          if (raw.length > 500_000) return json({ error: { message: "Request is too large." } }, 413);
          data = JSON.parse(raw);
        } catch {
          return json({ error: { message: "Invalid JSON request." } }, 400);
        }

        const apiKey = typeof data.apiKey === "string" ? data.apiKey.trim() : "";
        const model = typeof data.model === "string" ? data.model.trim() : "";
        if (!apiKey || apiKey.length > 500 || !model || model.length > 160 ||
            !Array.isArray(data.messages) || data.messages.length < 1 || data.messages.length > 40) {
          return json({ error: { message: "A valid NVIDIA API key, model and message history are required." } }, 400);
        }

        const messages = [];
        let total = 0;
        for (const item of data.messages) {
          if (!item || !["system", "user", "assistant"].includes(item.role) ||
              typeof item.content !== "string" || item.content.length > 100_000) {
            return json({ error: { message: "Message format is invalid or too large." } }, 400);
          }
          total += item.content.length;
          if (total > 120_000) return json({ error: { message: "Conversation is too large." } }, 413);
          messages.push({ role: item.role, content: item.content });
        }

        try {
          const upstream = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": "Bearer " + apiKey,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model,
              messages,
              temperature: Math.max(0, Math.min(1, Number(data.temperature ?? 0.4)))
            })
          });
          return new Response(upstream.body, {
            status: upstream.status,
            headers: {
              "Content-Type": upstream.headers.get("Content-Type") || "application/json",
              "Cache-Control": "no-store",
              "X-Content-Type-Options": "nosniff"
            }
          });
        } catch {
          return json({ error: { message: "The Solaris Worker could not connect to NVIDIA NIM." } }, 502);
        }
      }

      return json({ error: "API route not found." }, 404);
    }
    if (url.pathname === "/owned-site" || url.pathname.startsWith("/owned-site/")) {
      const sitePath = url.pathname.slice("/owned-site".length) || "/";
      if (sitePath.includes("\\") || sitePath.split("/").some(part => part === "." || part === "..")) {
        return new Response("Invalid site path.", { status: 400 });
      }
      const assetUrl = new URL(request.url);
      assetUrl.pathname = sitePath;
      const upstream = await env.ASSETS.fetch(new Request(assetUrl.toString(), request));
      const headers = new Headers(upstream.headers);
      const contentType = headers.get("Content-Type") || "";
      if (!upstream.ok || !/text\/html/i.test(contentType)) {
        return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers });
      }
      html = html.replace(/(\b(?:href|src|action|poster)=["'])\/(?!\/)/gi, "$1/owned-site/");
      html = html.replace(/<head(\s[^>]*)?>/i, match => match + '<base href="/owned-site/">');
      headers.delete("Content-Length");
      headers.delete("Content-Security-Policy");
      headers.delete("X-Frame-Options");
      headers.set("Content-Type", "text/html; charset=utf-8");
      headers.set("Cache-Control", "no-store");
      return new Response(html, { status: upstream.status, headers });
    }

    const assetResponse = await env.ASSETS.fetch(request);
    if ((url.pathname === "/" || url.pathname === "/index.html") && assetResponse.ok && (assetResponse.headers.get("Content-Type") || "").includes("text/html")) {
      const versionId = env.CF_VERSION_METADATA?.id || VERSION;
      const html = (await assetResponse.text()).replace(/<\/head>/i, '<script>window.__SOLARIS_BUILD_ID="' + versionId + '";</script></head>');
      const headers = new Headers(assetResponse.headers);
      headers.delete("Content-Length");
      headers.set("Cache-Control", "no-store");
      return new Response(html, { status: assetResponse.status, headers });
    }
    return assetResponse;
  }
};


export class PresenceCounter {
  constructor(state) { this.state = state; }
  async fetch(request) {
    const now = Date.now();
    const visitors = (await this.state.storage.get("visitors")) || {};
    for (const [id, seen] of Object.entries(visitors)) {
      if (now - seen > 90000) delete visitors[id];
    }
    if (request.method === "POST") {
      let body;
      try { body = await request.json(); } catch { return Response.json({error:"Invalid JSON."},{status:400}); }
      if (typeof body.id !== "string" || !/^[a-zA-Z0-9-]{12,80}$/.test(body.id)) {
        return Response.json({error:"Invalid visitor ID."},{status:400});
      }
      visitors[body.id] = now;
    }
    await this.state.storage.put("visitors", visitors);
    return Response.json({ online: Object.keys(visitors).length }, {
      headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "null" }
    });
  }
}
