const VERSION = "solaris-dev-gate-2";

const DEV_COOKIE = "solaris_dev_access";
const DEV_ACCESS_SECONDS = 7 * 24 * 60 * 60;

function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/g, "");
}

async function devSignature(secret, payload) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]
  );
  return { key, signature: await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)) };
}

async function hasDevAccess(request, secret) {
  if (!secret) return false;
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(new RegExp("(?:^|;\\s*)" + DEV_COOKIE + "=([A-Za-z0-9_.-]+)"));
  if (!match) return false;
  const [expiry, signature, extra] = match[1].split(".");
  if (!expiry || !signature || extra || !/^\\d{10,}$/.test(expiry) || Number(expiry) < Math.floor(Date.now() / 1000)) return false;
  try {
    const key = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
    );
    const bytes = Uint8Array.from(atob(signature.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - signature.length % 4) % 4)), c => c.charCodeAt(0));
    return await crypto.subtle.verify("HMAC", key, bytes, new TextEncoder().encode(expiry));
  } catch { return false; }
}

function devLockPage(configured) {
  const setup = configured ? "" : '<p class="hint">The site owner still needs to set the <code>DEV_CODE</code> Worker secret in Cloudflare before access can be enabled.</p>';
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#ffc928"><title>Solaris · Beta access</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(ellipse at 50% 0,#61400d55,transparent 55%),#11100d;color:#fff8e9;font-family:Arial,sans-serif}.card{width:min(420px,100%);padding:34px;border:1px solid #594728;border-radius:22px;background:#1d1a14;box-shadow:0 24px 80px #0008}.star{width:54px;height:54px;display:block;object-fit:contain;border-radius:14px}.kicker{margin:24px 0 8px;color:#ffc928;font-size:10px;font-weight:bold;letter-spacing:2px}h1{margin:0;font-size:32px}p{color:#b6a98f;font-size:13px;line-height:1.6}.field{width:100%;padding:14px;border:1px solid #594a30;border-radius:10px;background:#11100d;color:#fff8e9;font-size:15px;outline:none}.field:focus{border-color:#ffc928;box-shadow:0 0 0 3px #ffc92822}button{width:100%;margin-top:12px;padding:14px;border:0;border-radius:10px;background:linear-gradient(130deg,#ffe47a,#ffb700);color:#342200;font-weight:800;font-size:13px;cursor:pointer}button:disabled{opacity:.6;cursor:wait}.error{min-height:20px;color:#ff9a82;font-size:12px}.hint{padding:10px;border-radius:9px;background:#302719;font-size:11px}.hint code{color:#ffe18a}</style></head><body><main class="card"><img class="star" src="/favicon.ico?v=3" alt="Solaris icon" width="54" height="54"><div class="kicker">PRIVATE BETA</div><h1>Solaris is locked</h1><p>Enter the developer access code to continue to the beta website.</p><form id="access"><input class="field" id="code" type="password" autocomplete="current-password" placeholder="Developer access code" required maxlength="200" autofocus><button id="submit" type="submit">Unlock Solaris</button><div class="error" id="error" role="alert"></div></form>${setup}</main><script>const form=document.getElementById("access"),input=document.getElementById("code"),button=document.getElementById("submit"),error=document.getElementById("error");form.addEventListener("submit",async e=>{e.preventDefault();button.disabled=true;error.textContent="Checking access…";try{const response=await fetch("/api/dev-access",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code:input.value})});const data=await response.json();if(!response.ok||!data.ok)throw new Error(data.error||"That code was not accepted.");error.textContent="Access granted. Opening Solaris…";location.reload()}catch(err){error.textContent=err.message||"Could not verify the code. Try again.";input.select()}finally{button.disabled=false}});</script></body></html>`, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" }
  });
}


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

    // The beta code is held only as a Cloudflare Worker secret, never in client code.
    if (url.pathname === "/api/dev-access") {
      if (request.method !== "POST") return json({ error: "POST required." }, 405);
      if (!sameOrigin(request, url)) return json({ error: "Cross-origin requests are not allowed." }, 403);
      const secret = env.DEV_CODE;
      if (!secret) return json({ error: "Beta access is not configured yet. DEV_CODE is missing from this deployed Solaris Worker. Add it as a Secret under Workers & Pages → Solaris → Settings → Variables and Secrets, then deploy the Worker." }, 503);
      const length = Number(request.headers.get("Content-Length") || 0);
      if (length > 1000) return json({ error: "Request is too large." }, 413);
      let data;
      try { data = await request.json(); } catch { return json({ error: "Invalid request." }, 400); }
      const supplied = typeof data.code === "string" ? data.code : "";
      let difference = supplied.length ^ secret.length;
      const max = Math.max(supplied.length, secret.length);
      for (let i = 0; i < max; i++) difference |= (supplied.charCodeAt(i) || 0) ^ (secret.charCodeAt(i) || 0);
      if (difference !== 0) return json({ error: "Incorrect developer code." }, 401);
      const expiry = String(Math.floor(Date.now() / 1000) + DEV_ACCESS_SECONDS);
      const signed = await devSignature(secret, expiry);
      const signature = base64url(new Uint8Array(signed.signature));
      return json({ ok: true }, 200, {
        "Set-Cookie": DEV_COOKIE + "=" + expiry + "." + signature + "; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=" + DEV_ACCESS_SECONDS
      });
    }

    if (!await hasDevAccess(request, env.DEV_CODE)) {
      return devLockPage(Boolean(env.DEV_CODE));
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
        return json({ sha: VERSION });
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

    return env.ASSETS.fetch(request);
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
