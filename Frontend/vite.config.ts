import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "");

  if (mode === "production" && !env.VITE_API_URL?.trim()) {
    throw new Error("VITE_API_URL must be set for production builds");
  }

  return {
    logLevel: "info",
    plugins: [
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
      dedupe: ["react", "react-dom"],
    },
    esbuild: {
      sourcemap: false,
    },
    root: path.resolve(__dirname),
    build: {
      outDir: path.resolve(__dirname, "dist-build"),
      emptyOutDir: true,
      sourcemap: false,
      rollupOptions: {
        output: {
          sourcemap: false,
          manualChunks: {
            "vendor-react": ["react", "react-dom"],
            "vendor-motion": ["framer-motion"],
            "vendor-query": ["@tanstack/react-query"],
          },
        },
      },
      reportCompressedSize: true,
    },
    server: {
      port: 5000,
      host: "127.0.0.1",
      strictPort: true,
      allowedHosts: true,
      proxy: {
        "/api": {
          target: "http://127.0.0.1:5001",
          changeOrigin: true,
        },
      },
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
    preview: {
      port: 5173,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  };
});
