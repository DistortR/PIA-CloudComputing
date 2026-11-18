import { createMetrics } from "./metrics.js";

export function readConfig(env) {
  function required(key) {
    const value = env[key]?.trim();
    if (!value) throw new Error(`Falta la variable ${key}`);
    return value;
  }

  const port = Number(required("APP_PORT"));
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("APP_PORT debe ser un entero entre 1 y 65535");
  }

  return {
    hostname: required("APP_HOST"),
    port,
    version: {
      version: required("APP_VERSION"),
      commit_sha: required("APP_COMMIT_SHA"),
      build_date: required("APP_BUILD_DATE"),
    },
  };
}

export function createItem(body, id) {
  if (typeof body?.name !== "string") return null;
  const name = body.name.trim();
  return name ? { id, name } : null;
}

export function createApp(version) {
  let ready = false;
  // shortcut: datos por proceso, usar almacenamiento compartido si se requiere persistencia.
  const items = [];
  const metrics = createMetrics(`${version.version}-${version.commit_sha}`);
  const routes = {
    "GET /health": () => Response.json({ status: "ok" }),
    "GET /ready": () => Response.json(
      { status: ready ? "ready" : "unavailable" }, { status: ready ? 200 : 503 },
    ),
    "GET /version": () => Response.json(version, { headers: { "cache-control": "no-store" } }),
    "GET /metrics": () => new Response(metrics.render(), {
      headers: { "content-type": "text/plain; version=0.0.4; charset=utf-8" },
    }),
    "GET /api/items": () => Response.json(items),
    "POST /api/items": async (request) => {
      let body;
      try {
        body = await request.json();
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        return Response.json({ error: "JSON inválido" }, { status: 400 });
      }
      const item = createItem(body, items.length + 1);
      if (!item) return Response.json({ error: "name debe ser un texto no vacío" }, { status: 422 });
      items.push(item);
      return Response.json(item, { status: 201 });
    },
  };

  return {
    setReady(value) {
      ready = value;
    },
    async fetch(request) {
      const started = performance.now();
      const { pathname } = new URL(request.url);
      const handler = routes[`${request.method} ${pathname}`];
      let response;
      try {
        response = handler
          ? await handler(request)
          : Response.json({ error: "Ruta no encontrada" }, { status: 404 });
      } catch (error) {
        console.error("Error al atender petición", error);
        response = Response.json({ error: "Error interno" }, { status: 500 });
      }
      const method = ["GET", "POST"].includes(request.method) ? request.method : "OTHER";
      metrics.observe(method, handler ? pathname : "unmatched", response.status,
        (performance.now() - started) / 1000);
      return response;
    },
  };
}
