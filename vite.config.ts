import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const api = 'http://localhost:8840';

export default defineConfig({
  root: 'web',
  build: { outDir: '../dist', emptyOutDir: true },
  server: {
    host: true,
    proxy: { '/api': api, '/uploads': api },
    fs: { allow: ['..'] },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'שלתי הזקן – קטלוג',
        short_name: 'שלתי הזקן',
        lang: 'he',
        dir: 'rtl',
        display: 'fullscreen',
        orientation: 'any',
        background_color: '#151816',
        theme_color: '#151816',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api/, /^\/uploads/],
        runtimeCaching: [
          // Catalog data: fresh when online, last copy when the shop Wi-Fi drops.
          { urlPattern: /\/api\/catalog/, handler: 'NetworkFirst', options: { cacheName: 'catalog', networkTimeoutSeconds: 4 } },
          // Uploaded images have unique names, so cache forever.
          { urlPattern: /\/uploads\//, handler: 'CacheFirst', options: { cacheName: 'images', expiration: { maxEntries: 1000 } } },
          { urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//, handler: 'StaleWhileRevalidate', options: { cacheName: 'fonts' } },
        ],
      },
    }),
  ],
});
