import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Separate from vite.config.ts on purpose: the PWA plugin injects a service
 * worker registration and a `virtual:pwa-register/react` module that has no
 * meaning under jsdom, and loading it in tests produces confusing failures.
 */
export default defineConfig({
  plugins: [react()],
  // No `__GEMINI_API_KEY__` define here, unlike vite.config.ts. Leaving it
  // undefined means the identifier resolves to a real global at runtime, so tests
  // can set and unset it to exercise both the configured and unconfigured paths.
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    css: false,
    restoreMocks: true,
    clearMocks: true,
  },
});
