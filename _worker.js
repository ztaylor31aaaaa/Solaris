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

      if (url.pathname === "/api/version") {
        if (request.method !== "GET") return json({ error: "GET required." }, 405);
        return json({ sha: VERSION });
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

    return env.ASSETS.fetch(request);
  }
};
