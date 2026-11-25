import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { VitePWA } from 'vite-plugin-pwa';

// BASE_PATH is set by the GitHub Pages workflow (e.g. "/ideal-octo-tribble/").
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  build: {
    rollupOptions: {
      input: { main: resolve(__dirname, 'index.html'), lab: resolve(__dirname, 'lab.html') },
    },
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'recorder-worklet.js'],
      manifest: {
        name: 'OCTO',
        short_name: 'OCTO',
        description: 'Touch-first loop maker',
        theme_color: '#F5F3EE',
        background_color: '#F5F3EE',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
});
