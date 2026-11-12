import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

// Static build for GitHub Pages. The form talks to Supabase directly, so no
// Worker, D1 binding or API route takes part in this build.
export default defineConfig({
  root: "static",
  // Relative, so asset URLs hold under /<repo>/ and under a custom domain alike.
  base: "./",
  publicDir: "../public",
  plugins: [react()],
  resolve: { alias: { "@": projectRoot } },
  css: { postcss: projectRoot },
  build: {
    outDir: "../dist-pages",
    emptyOutDir: true,
    rollupOptions: {
      // Two pages: the public form at / and the committee view at /admin/.
      input: {
        main: `${projectRoot}static/index.html`,
        admin: `${projectRoot}static/admin/index.html`,
      },
    },
  },
});
