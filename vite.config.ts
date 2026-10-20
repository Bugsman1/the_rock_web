import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import svgr from "vite-plugin-svgr";
import { defineConfig } from "vitest/config";

const DEFAULT_BACKEND_API_URL = "http://127.0.0.1:8000";

export default defineConfig(({ mode }) => {
  const backendApiUrl = loadEnv(mode, process.cwd(), "").BACKEND_API_URL ?? DEFAULT_BACKEND_API_URL;

  return {
    plugins: [
      react(),
      tailwindcss(),
      svgr({ svgrOptions: { icon: true, titleProp: true, ref: true } }),
    ],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    server: {
      port: 3000,
      strictPort: true,
      proxy: { "/api": { target: backendApiUrl, changeOrigin: true } },
    },
    preview: {
      port: 3000,
      strictPort: true,
      proxy: { "/api": { target: backendApiUrl, changeOrigin: true } },
    },
    test: {
      environment: "jsdom",
      include: ["src/**/*.test.{ts,tsx}"],
      setupFiles: ["./vitest.setup.ts"],
      testTimeout: 15000,
    },
  };
});
