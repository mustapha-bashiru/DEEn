import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },

    plugins: [
      react(),
      VitePWA({
        // 'prompt' rather than 'autoUpdate': the user is told a new version is
        // ready and chooses when to reload, so an update never discards an
        // in-progress chat. See components/PwaUpdatePrompt.tsx.
        registerType: 'prompt',
        injectRegister: null,

        manifest: {
          id: '/',
          name: 'SebilLink – Mosque & Community Super App',
          short_name: 'SebilLink',
          description:
            'SebilLink connects mosques, halal businesses, and their communities: ' +
            'an Islamic AI assistant, QR menus, prayer times, and community events.',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#f8fafc',
          theme_color: '#3b82f6',
          categories: ['lifestyle', 'food', 'education'],
          icons: [
            { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
            { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
          ],
        },

        workbox: {
          /*
           * The plugin already adds every `manifest.icons` entry to the precache
           * list, and everything in public/ is copied to the output root, so the
           * glob below covers the rest (apple-touch-icon.png included). There is
           * deliberately no `includeAssets`: naming a file the glob already
           * matches produces a duplicate precache entry.
           */
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
          globIgnores: ['pwa-*.png', 'icon.svg'],
          // Serve the app shell for unknown routes so navigation works offline.
          navigateFallback: '/index.html',
          // Never hand the app shell to API traffic, and never let the service
          // worker sit in front of authenticated or provider responses.
          navigateFallbackDenylist: [/^\/api\//],
          // No runtimeCaching entry exists on purpose: everything precached here
          // is a public, versioned build asset. Adding one for /api would risk
          // serving another user's response from cache.
          runtimeCaching: [],
          cleanupOutdatedCaches: true,
          clientsClaim: false,
        },

        devOptions: {
          // Opt in with `SW_DEV=true npm run dev` when testing offline behaviour;
          // off by default because a live service worker confuses HMR.
          enabled: env.SW_DEV === 'true',
          type: 'module',
        },
      }),
    ],

    define: {
      /*
       * ⚠️ TEMPORARY — implementation plan step 4 removes this.
       *
       * Inlining the Gemini key makes it readable by anyone who loads the app.
       * Access is centralised in config/env.ts so the migration to /api endpoints
       * is a single-file change. Use a low-quota development key until then.
       */
      __GEMINI_API_KEY__: JSON.stringify(env.GEMINI_API_KEY ?? ''),
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
