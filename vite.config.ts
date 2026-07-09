import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5173,
    watch: {
      // generated project sites live here; editing must not reload the editor
      ignored: ["**/projects/**"],
    },
    proxy: {
      "/api": "http://localhost:4570",
      "/project-assets": "http://localhost:4570",
      "/published": "http://localhost:4570",
    },
  },
});
