import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  root: 'web',
  // Sub-path hosting (GitHub Pages serves at /<repo>/); '/' everywhere else.
  base: process.env.BASE_PATH || '/',
  build: { outDir: '../dist', emptyOutDir: true },
  server: { host: true, fs: { allow: ['..'] } },
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
        runtimeCaching: [
          // Catalog data is also kept in localStorage; product images have unique names, so cache forever.
          { urlPattern: /\/storage\/v1\/object\/public\//, handler: 'CacheFirst', options: { cacheName: 'images', expiration: { maxEntries: 1000 }, cacheableResponse: { statuses: [0, 200] } } },
          { urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//, handler: 'StaleWhileRevalidate', options: { cacheName: 'fonts' } },
        ],
      },
    }),
  ],
});
