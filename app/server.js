import { createApp, readConfig } from "./api.js";

export function startServer(env) {
  const { hostname, port, version } = readConfig(env);
  const app = createApp(version);
  const server = Bun.serve({
    hostname,
    port,
    fetch: app.fetch,
    maxRequestBodySize: 16 * 1024,
  });
  app.setReady(true);
  return {
    server,
    async stop() {
      app.setReady(false);
      await server.stop();
    },
  };
}

if (import.meta.main) {
  const { server, stop } = startServer(process.env);
  console.log(`MediSur escuchando en ${server.url}`);
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}
