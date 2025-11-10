/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        // openapi-clientを除外
        'src/openapi-client/**',
        // その他の除外対象
        'node_modules/**',
        'dist/**',
        '**/*.d.ts',
        'rollup.config.js',
        'vitest.config.ts',
        'eslint.config.js',
      ],
      include: ['src/**/*.ts'],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
  },
});
