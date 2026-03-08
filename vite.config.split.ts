// dev:split 用 — Vite (フロント) + wrangler dev (API) を分離して起動
// @cloudflare/vite-plugin で認証フローがフリッカーする場合にこちらを使う
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
});
