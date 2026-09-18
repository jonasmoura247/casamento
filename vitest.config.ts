import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      all: true,
      include: ['app/**/*.{ts,tsx}', 'models/**/*.ts', 'controllers/**/*.ts', 'middleware.ts'],
      exclude: ['**/*.test.ts', '**/*.test.tsx'],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
});
