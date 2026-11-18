import { expect, spyOn, test } from "bun:test";
import { createApp, createItem, readConfig } from "../app/api.js";

import { startServer } from "../app/server.js";

const env = {
  APP_HOST: "127.0.0.1",
  APP_PORT: "8080",
  APP_VERSION: "1.0.0",
  APP_COMMIT_SHA: "a3f9c1b",
  APP_BUILD_DATE: "2026-11-18T16:00:00Z",
};
const version = {
  version: env.APP_VERSION,
  commit_sha: env.APP_COMMIT_SHA,
  build_date: env.APP_BUILD_DATE,
};

test("lee host y puerto del entorno", () => {
  expect(readConfig({ ...env, APP_PORT: "8095" })).toMatchObject({
    hostname: "127.0.0.1",
    port: 8095,
  });
});

test("rechaza puertos fuera de rango o no enteros", () => {
  for (const APP_PORT of ["0", "65536", "2.5", "x", ""]) {
    expect(() => readConfig({ ...env, APP_PORT })).toThrow("APP_PORT");
  }
});

test("lee los tres metadatos de construcción", () => {
  expect(readConfig(env).version).toEqual(version);
});

test("rechaza metadatos faltantes", () => {
  expect(() => readConfig({ ...env, APP_COMMIT_SHA: "" })).toThrow("APP_COMMIT_SHA");
});

test("crea un ítem con el nombre normalizado", () => {
  expect(createItem({ name: "  vendas  " }, 1)).toEqual({ id: 1, name: "vendas" });
});

test("rechaza nombres inválidos", () => {
  for (const body of [null, {}, { name: "" }, { name: "   " }, { name: 42 }]) {
    expect(createItem(body, 1)).toBeNull();
  }
});

function request(app, path, options) {
  return app.fetch(new Request("http://localhost" + path, options));
}

function post(app, body) {
  return request(app, "/api/items", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

test("las sondas distinguen vitalidad, disponibilidad y cierre", async () => {
  const app = createApp(version);
  expect((await request(app, "/health")).status).toBe(200);
  expect((await request(app, "/ready")).status).toBe(503);
  app.setReady(true);
  expect((await request(app, "/ready")).status).toBe(200);
  app.setReady(false);
  expect((await request(app, "/ready")).status).toBe(503);
  expect((await request(app, "/health")).status).toBe(200);
});

test("expone los metadatos de la instancia", async () => {
  for (const build of [version, { ...version, commit_sha: "b4f9c1a" }]) {
    const result = await request(createApp(build), "/version");
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual(build);
  }
});

test("crea, lista y mantiene aislados los ítems de cada instancia", async () => {
  const app = createApp(version);
  const initial = await request(app, "/api/items");
  expect(initial.status).toBe(200);
  expect(await initial.json()).toEqual([]);
  const created = await post(app, '{"name":"vendas"}');
  expect(created.status).toBe(201);
  const item = await created.json();
  expect(item).toEqual({ id: 1, name: "vendas" });
  expect((await (await post(app, '{"name":"gasas"}')).json()).id).toBe(2);
  expect(await (await request(app, "/api/items")).json()).toEqual([
    item, { id: 2, name: "gasas" },
  ]);
  expect(await (await request(createApp(version), "/api/items")).json()).toEqual([]);
});

test("rechaza JSON malformado y nombres inválidos sin guardar ítems", async () => {
  const app = createApp(version);
  expect((await post(app, "{")).status).toBe(400);
  expect((await post(app, '{"name":"  "}')).status).toBe(422);
  expect(await (await request(app, "/api/items")).json()).toEqual([]);
});

test("expone conteos, duración y una etiqueta fija para rutas desconocidas", async () => {
  const app = createApp(version);
  await request(app, "/api/items");
  await request(app, "/api/items");
  await post(app, '{"name":" "}');
  await request(app, "/desconocida");
  await request(app, "/otra");
  const response = await request(app, "/metrics");
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("text/plain");
  const body = await response.text();
  expect(body).toContain('http_requests_total{method="GET",route="/api/items",status="200",version="1.0.0-a3f9c1b"} 2');
  expect(body).toContain('http_requests_total{method="POST",route="/api/items",status="422",version="1.0.0-a3f9c1b"} 1');
  expect(body).toContain('http_requests_total{method="GET",route="unmatched",status="404",version="1.0.0-a3f9c1b"} 2');
  expect(body).toContain('http_request_duration_seconds_bucket{method="GET",route="/api/items",version="1.0.0-a3f9c1b",le="+Inf"} 2');
  expect(body).toContain('http_request_duration_seconds_count{method="GET",route="/api/items",version="1.0.0-a3f9c1b"} 2');
  expect(body).not.toContain("/desconocida");
});

test("registra respuestas 500 ante una excepción inesperada", async () => {
  const app = createApp(version);
  const failingRequest = new Request("http://localhost/api/items", { method: "POST" });
  failingRequest.json = () => { throw new Error("falla controlada"); };
  const log = spyOn(console, "error").mockImplementation(() => {});
  try {
    expect((await app.fetch(failingRequest)).status).toBe(500);
    expect(log).toHaveBeenCalled();
  } finally {
    log.mockRestore();
  }
  const metrics = await (await request(app, "/metrics")).text();
  expect(metrics).toContain('status="500",version="1.0.0-a3f9c1b"} 1');
});

test("conecta el servidor al puerto configurado y marca el cierre", async () => {
  let options;
  const serve = spyOn(Bun, "serve").mockImplementation((config) => {
    options = config;
    return {
      async stop() {
        const response = await options.fetch(new Request("http://localhost/ready"));
        expect(response.status).toBe(503);
      },
    };
  });
  try {
    const app = startServer(env);
    expect(options).toMatchObject({ hostname: env.APP_HOST, port: 8080 });
    expect((await options.fetch(new Request("http://localhost/ready"))).status).toBe(200);
    await app.stop();
  } finally {
    serve.mockRestore();
  }
});
