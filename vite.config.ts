import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// BASE_PATH is set by the GitHub Pages workflow (e.g. "/ideal-octo-tribble/").
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'recorder-worklet.js'],
      manifest: {
        name: 'OCTO',
        short_name: 'OCTO',
        description: 'Touch-first loop maker',
        theme_color: '#141518',
        background_color: '#141518',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png}'] },
    }),
  ],
});
