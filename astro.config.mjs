// @ts-check
import { defineConfig } from "astro/config";

import svelte from "@astrojs/svelte";

import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  integrations: [svelte()],
  adapter: cloudflare(),

  // Build optimizations
  vite: {
    // Handle font and wasm imports
    assetsInclude: ["**/*.woff2", "**/*.wasm"],
    build: {
      // Enable minification
      minify: "esbuild",
      // Code splitting configuration
      rollupOptions: {
        output: {
          // Manual chunks for better caching
          manualChunks: {
            // Vendor chunks
            "vendor-atproto": ["@atproto/api"],
            "vendor-ipld": ["@ipld/car", "@ipld/dag-cbor", "multiformats"],
            "vendor-cbor": ["cbor-x"],
          },
        },
      },
      // Target modern browsers for smaller bundles
      target: "esnext",
      // Increase chunk size warning limit (IPLD modules are large)
      chunkSizeWarningLimit: 600,
    },
    // Optimize dependencies
    optimizeDeps: {
      include: ["@atproto/api", "@ipld/car", "@ipld/dag-cbor", "multiformats"],
    },
  },

  // Prefetch configuration for faster navigation
  prefetch: {
    prefetchAll: false,
    defaultStrategy: "hover",
  },
});
