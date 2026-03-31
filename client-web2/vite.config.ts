import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const here = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(here, "..");

// Load .env from root directory (fallback to client-web/.env)
dotenv.config({ path: path.resolve(rootDir, ".env") });
dotenv.config({ path: path.resolve(here, ".env") }); // Local overrides

function normalizeBase(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "/";
  if (trimmed === "./") return "./";
  if (trimmed.endsWith("/")) return trimmed;
  return `${trimmed}/`;
}

export default defineConfig(() => {
  // Environment variables with defaults
  const envBase = process.env.CLIENT_WEB_BASE_PATH?.trim();
  const base = envBase ? normalizeBase(envBase) : "./";

  const port = parseInt(process.env.CLIENT_WEB_PORT || "5173", 10);
  const apiTarget = process.env.CLIENT_WEB_API_TARGET || "http://127.0.0.1:18789";

  return {
    base,
    publicDir: path.resolve(here, "public"),
    plugins: [],
    define: {},
    optimizeDeps: {
      include: ["lit/directives/repeat.js"],
    },
    build: {
      outDir: path.resolve(here, "../dist/control-ui2"),
      emptyOutDir: true,
      sourcemap: true,
    },
    server: {
      host: true,
      port,
      strictPort: true,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          ws: true,
          // Rewrite cookie flags so they work on localhost (Safari blocks cross-site cookies)
          configure: (proxy) => {
            proxy.on("proxyRes", (proxyRes) => {
              const sc = proxyRes.headers["set-cookie"];
              if (sc) {
                proxyRes.headers["set-cookie"] = (Array.isArray(sc) ? sc : [sc]).map((c) =>
                  c
                    .replace(/;\s*Secure/gi, "")
                    .replace(/;\s*SameSite=None/gi, "; SameSite=Lax")
                    .replace(/;\s*Domain=[^;]*/gi, ""),
                );
              }
            });
          },
        },
      },
    },
  };
});
