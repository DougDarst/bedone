import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { APP, appDisplayName } from './src/lib/config.ts';

/** Fills `%APP_TITLE%` in index.html from the single app-name config. */
function appTitle(): Plugin {
  return {
    name: 'app-title',
    transformIndexHtml: (html) => html.replaceAll('%APP_TITLE%', appDisplayName(APP)),
  };
}

export default defineConfig({
  plugins: [svelte(), appTitle()],
  build: {
    // PocketBase serves the frontend from pb_public.
    outDir: 'pb_public',
    emptyOutDir: true,
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
