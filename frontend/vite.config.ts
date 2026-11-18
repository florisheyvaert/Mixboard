import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `npm run dev` serves index.html with a mock Home Assistant (src/dev.tsx).
// `npm run build` emits one ES module that HA loads as the panel.
export default defineConfig({
  plugins: [react()],
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    outDir: "../custom_components/mixboard/frontend",
    emptyOutDir: false,
    lib: { entry: "src/main.tsx", formats: ["es"], fileName: () => "mixboard.js" },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
