const VERSION = "solaris-core-1";

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

    if (url.pathname.startsWith("/api/")) {
      if (!sameOrigin(request, url)) return json({ error: "Cross-origin requests are not allowed." }, 403);

      if (url.pathname === "/api/health") {
        if (request.method !== "GET") return json({ error: "GET required." }, 405);
        return json({ ok: true, service: "Solaris Worker", version: VERSION });
      }
        if (!title || !/^[\p{L}\p{N}_()%,' -]+$/u.test(title)) {
      if (url.pathname === "/api/version") {
        if (request.method !== "GET") return json({ error: "GET required." }, 405);
        return json({ sha: VERSION });
      }

      if (url.pathname === "/api/wikipedia/page") {
        if (request.method !== "GET") return new Response("GET required.", { status: 405 });
        const title = (url.searchParams.get("title") || "").trim().slice(0, 240);
        if (!title || !/^[\\p{L}\\p{N}_()%,' -]+$/u.test(title)) {
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
      if (sitePath.includes("\\") || sitePath.split("/").some(part => part === "." || part === "..")) {
    if (url.pathname === "/owned-site" || url.pathname.startsWith("/owned-site/")) {
      const sitePath = url.pathname.slice("/owned-site".length) || "/";
      if (sitePath.includes("\\\\") || sitePath.split("/").some(part => part === "." || part === "..")) {
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
      html = html.replace(/<head(\\s[^>]*)?>/i, match => match + '<base href="/owned-site/">');
      headers.delete("Content-Length");
      headers.delete("Content-Security-Policy");
      headers.delete("X-Frame-Options");
      headers.set("Content-Type", "text/html; charset=utf-8");
      headers.set("Cache-Control", "no-store");
      return new Response(html, { status: upstream.status, headers });
    }

    return env.ASSETS.fetch(request);
  }
};
