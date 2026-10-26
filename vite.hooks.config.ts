import { defineConfig } from 'vite';

/** Bundles src/hooks-lib.ts as CommonJS for PocketBase's JavaScript hooks. */
export default defineConfig({
  publicDir: false,
  build: {
    lib: {
      entry: 'src/hooks-lib.ts',
      formats: ['cjs'],
      fileName: () => 'shared.cjs',
    },
    outDir: 'pb_hooks/generated',
    emptyOutDir: true,
    minify: false,
    target: 'es2020',
  },
});
