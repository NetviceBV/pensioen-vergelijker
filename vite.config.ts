import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { maakVergelijkHandler } from "./src/server/handler";

export default defineConfig(({ mode }) => {
  // Laadt .env (incl. niet-VITE_ variabelen) server-side. Deze blijven op de
  // server; ze worden nooit in de client-bundel meegebakken.
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), "") } as Record<string, string | undefined>;

  return {
    plugins: [
      react(),
      {
        name: "vergelijk-api",
        configureServer(server) {
          const handler = maakVergelijkHandler(env);
          server.middlewares.use(async (req, res, next) => {
            if (req.method !== "POST" || (req.url ?? "").split("?")[0] !== "/api/vergelijk") return next();
            try {
              const chunks: Buffer[] = [];
              for await (const c of req) chunks.push(c as Buffer);
              const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
              const out = await handler(body);
              res.setHeader("content-type", "application/json");
              res.end(JSON.stringify(out));
            } catch (e) {
              res.statusCode = 500;
              res.setHeader("content-type", "application/json");
              res.end(JSON.stringify({ fout: e instanceof Error ? e.message : String(e) }));
            }
          });
        },
      },
    ],
    server: { port: 5173, open: true },
    build: {
      // recharts (incl. d3) is inherently groot; in een eigen chunk isoleren
      // houdt de app-chunk klein en laat de browser 'm apart cachen.
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks: { recharts: ["recharts"] },
        },
      },
    },
  };
});
