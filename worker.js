/*
 * Gramáticas Urbanas de Rosario - Cloudflare Worker estable
 * Frontend (GitHub Pages) -> /api -> Worker -> Google Apps Script
 *
 * Secret requerido:
 *   APPS_SCRIPT_URL=https://script.google.com/macros/s/XXXXXXXX/exec
 */

const BUILD_ID = "gur-2026-09-22-api-v2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Expose-Headers": "X-Proxy-Stage, X-Worker-Build, X-Request-Id"
};

function headers(extra = {}) {
  return {
    ...CORS_HEADERS,
    "Cache-Control": "no-store",
    "X-Worker-Build": BUILD_ID,
    ...extra
  };
}

function jsonResponse(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: headers({
      "Content-Type": "application/json; charset=utf-8",
      ...extra
    })
  });
}

function normalizeAppsScriptUrl(raw) {
  let value = String(raw || "").trim();
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1).trim();
  }
  return value;
}

function getAppsScriptUrl(env) {
  const value = normalizeAppsScriptUrl(env.APPS_SCRIPT_URL);
  if (!value) throw new Error("Falta configurar APPS_SCRIPT_URL.");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "script.google.com" ||
      !/\/macros\/s\/[^/]+\/exec\/?$/.test(url.pathname)) {
    throw new Error("APPS_SCRIPT_URL debe ser la URL /exec vigente del Web App de Apps Script.");
  }
  return url;
}

async function parseResponse(response) {
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) {}
  return {
    response,
    text,
    json,
    contentType: response.headers.get("Content-Type") || ""
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function safeRetryAction(action) {
  return ["getPublicData", "loginUser", "getUsers"].includes(String(action || ""));
}

async function fetchGooglePost(appsScriptUrl, body, action) {
  const attempts = safeRetryAction(action) ? 3 : 1;
  let last;

  for (let i = 0; i < attempts; i++) {
    const response = await fetch(appsScriptUrl.toString(), {
      method: "POST",
      redirect: "follow",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
        "Accept": "application/json,text/plain,*/*",
        "Cache-Control": "no-cache"
      },
      body
    });

    last = await parseResponse(response);

    // Solo reintentar lecturas/login seguros. Nunca reintentamos altas/ediciones
    // para evitar registros o actuaciones duplicadas.
    if (i < attempts - 1 && [404, 408, 429, 500, 502, 503, 504].includes(response.status)) {
      await sleep(180 * (i + 1));
      continue;
    }
    return last;
  }

  return last;
}

export default {
  async fetch(request, env) {
    const requestId = crypto.randomUUID();
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: headers({ "X-Request-Id": requestId, "X-Proxy-Stage": "cors" })
      });
    }

    if (url.pathname === "/health") {
      return jsonResponse({
        ok: true,
        service: "gramaticas-urbanas-proxy",
        build: BUILD_ID,
        hasAppsScriptUrl: Boolean(env.APPS_SCRIPT_URL)
      }, 200, { "X-Request-Id": requestId, "X-Proxy-Stage": "worker-ok" });
    }

    let appsScriptUrl;
    try {
      appsScriptUrl = getAppsScriptUrl(env);
    } catch (error) {
      return jsonResponse({
        status: "error",
        code: "BAD_APPS_SCRIPT_URL",
        message: error.message
      }, 500, { "X-Request-Id": requestId, "X-Proxy-Stage": "worker-config" });
    }

    if (url.pathname === "/upstream-health") {
      try {
        const target = new URL(appsScriptUrl.toString());
        target.searchParams.set("_proxy_health", "1");
        const parsed = await parseResponse(await fetch(target.toString(), {
          method: "GET",
          redirect: "follow",
          headers: { "Accept": "application/json,text/plain,*/*", "Cache-Control": "no-cache" }
        }));

        return jsonResponse({
          ok: parsed.response.ok && parsed.json !== null,
          build: BUILD_ID,
          upstreamStatus: parsed.response.status,
          returnedJson: parsed.json !== null,
          contentType: parsed.contentType
        }, parsed.response.ok && parsed.json !== null ? 200 : 502,
        { "X-Request-Id": requestId, "X-Proxy-Stage": "upstream-check" });
      } catch (error) {
        return jsonResponse({ ok:false, build:BUILD_ID, message:error.message }, 502,
          { "X-Request-Id": requestId, "X-Proxy-Stage": "upstream-check" });
      }
    }

    // La API de la aplicación vive explícitamente en /api.
    // Se conserva / como compatibilidad temporal, pero el frontend nuevo usa /api.
    if (url.pathname !== "/api" && url.pathname !== "/api/" && url.pathname !== "/") {
      return jsonResponse({ status:"error", code:"NOT_FOUND", message:"Ruta no encontrada." }, 404,
        { "X-Request-Id": requestId, "X-Proxy-Stage": "worker-route" });
    }

    try {
      if (request.method === "GET") {
        const target = new URL(appsScriptUrl.toString());
        url.searchParams.forEach((value, key) => target.searchParams.set(key, value));
        const parsed = await parseResponse(await fetch(target.toString(), {
          method: "GET",
          redirect: "follow",
          headers: { "Accept": "application/json,text/plain,*/*", "Cache-Control": "no-cache" }
        }));

        if (!parsed.response.ok || parsed.json === null) {
          return jsonResponse({
            status:"error",
            code: parsed.response.ok ? "APPS_SCRIPT_NOT_JSON" : "APPS_SCRIPT_HTTP_ERROR",
            upstreamStatus: parsed.response.status,
            message: parsed.response.ok
              ? "Apps Script respondió pero no devolvió JSON."
              : `Apps Script respondió HTTP ${parsed.response.status}.`
          }, 502, { "X-Request-Id": requestId, "X-Proxy-Stage": "apps-script-error" });
        }

        return new Response(parsed.text, {
          status: 200,
          headers: headers({
            "Content-Type": "application/json; charset=utf-8",
            "X-Request-Id": requestId,
            "X-Proxy-Stage": "apps-script-ok"
          })
        });
      }

      if (request.method === "POST") {
        const body = await request.text();
        let action = "";
        try { action = JSON.parse(body || "{}").action || ""; } catch (_) {}

        const parsed = await fetchGooglePost(appsScriptUrl, body, action);

        if (!parsed.response.ok) {
          return jsonResponse({
            status:"error",
            code:"APPS_SCRIPT_HTTP_ERROR",
            upstreamStatus: parsed.response.status,
            action,
            message:`Apps Script respondió HTTP ${parsed.response.status}.`
          }, 502, { "X-Request-Id": requestId, "X-Proxy-Stage": "apps-script-http-error" });
        }

        if (parsed.json === null) {
          return jsonResponse({
            status:"error",
            code:"APPS_SCRIPT_NOT_JSON",
            upstreamStatus: parsed.response.status,
            action,
            message:"Apps Script respondió pero no devolvió JSON."
          }, 502, { "X-Request-Id": requestId, "X-Proxy-Stage": "apps-script-not-json" });
        }

        return new Response(parsed.text, {
          status: 200,
          headers: headers({
            "Content-Type": "application/json; charset=utf-8",
            "X-Request-Id": requestId,
            "X-Proxy-Stage": "apps-script-ok"
          })
        });
      }

      return jsonResponse({ status:"error", message:"Método no permitido." }, 405,
        { "X-Request-Id": requestId, "X-Proxy-Stage": "worker" });

    } catch (error) {
      return jsonResponse({
        status:"error",
        code:"WORKER_PROXY_ERROR",
        message:error && error.message ? error.message : String(error)
      }, 500, { "X-Request-Id": requestId, "X-Proxy-Stage": "worker-exception" });
    }
  }
};
