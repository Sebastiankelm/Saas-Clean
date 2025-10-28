import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      reporter: ['text', 'lcov'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      'better-auth/integrations/next-js': path.resolve(
        __dirname,
        './types/better-auth-stub'
      ),
      '@//lib/auth/better': path.resolve(__dirname, './types/better-auth-stub'),
      '@/lib/auth/better': path.resolve(__dirname, './types/better-auth-stub'),
      'better-auth': path.resolve(__dirname, './types/better-auth-stub'),
    },
  },
});
