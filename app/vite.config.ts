import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  envDir: '..',
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      buffer: fileURLToPath(new URL('./node_modules/buffer/index.js', import.meta.url)),
    },
    preserveSymlinks: false,
    dedupe: ['@stellar/stellar-sdk', '@stellar/stellar-base'],
  },
  build: {
    outDir: 'dist',
    target: 'esnext',
    sourcemap: false,
    commonjsOptions: {
      include: [/node_modules/, /smart-account-kit/, /smart-account-kit-bindings/],
      transformMixedEsModules: true,
    },
  },
  optimizeDeps: {
    exclude: ['@aztec/bb.js'],
    include: [
      'buffer',
      '@stellar/stellar-sdk',
      '@stellar/stellar-sdk/rpc',
      '@stellar/stellar-base',
      'smart-account-kit',
      'smart-account-kit-bindings',
    ],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
    fs: {
      allow: ['..', '../../reference-impls'],
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
});
