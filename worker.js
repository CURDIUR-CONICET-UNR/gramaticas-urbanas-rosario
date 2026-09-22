export default {
  async fetch(request, env) {

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    // CORS
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    try {

      if (!env.APPS_SCRIPT_URL) {
        throw new Error("Falta configurar APPS_SCRIPT_URL");
      }

      const incomingUrl = new URL(request.url);

      // GET
      if (request.method === "GET") {

        const targetUrl = new URL(env.APPS_SCRIPT_URL);

        // Copiar parámetros recibidos
        incomingUrl.searchParams.forEach((value, key) => {
          targetUrl.searchParams.set(key, value);
        });

        const response = await fetch(targetUrl.toString(), {
          method: "GET",
          redirect: "follow"
        });

        const body = await response.text();

        return new Response(body, {
          status: response.status,
          headers: {
            ...corsHeaders,
            "Content-Type":
              response.headers.get("Content-Type") ||
              "application/json"
          }
        });
      }

      // POST
      if (request.method === "POST") {

        const body = await request.text();

        const response = await fetch(env.APPS_SCRIPT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain;charset=utf-8"
          },
          body,
          redirect: "follow"
        });

        const result = await response.text();

        return new Response(result, {
          status: response.status,
          headers: {
            ...corsHeaders,
            "Content-Type":
              response.headers.get("Content-Type") ||
              "application/json"
          }
        });
      }

      return new Response("Método no permitido", {
        status: 405,
        headers: corsHeaders
      });

    } catch (error) {

      return new Response(
        JSON.stringify({
          ok: false,
          error: error.message
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        }
      );
    }
  }
};
