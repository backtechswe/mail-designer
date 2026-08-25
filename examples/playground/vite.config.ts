import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: { port: 7788 },
  resolve: {
    alias: {
      // Point straight at the source so edits show up without a rebuild. Consumers get
      // dist/ through the exports map; the playground gets hot reload.
      "@backtech/mail-designer/render": resolve(here, "../../src/render/index.ts"),
      "@backtech/mail-designer/styles.css": resolve(here, "../../src/styles.css"),
      "@backtech/mail-designer": resolve(here, "../../src/index.ts"),
    },
  },
});
