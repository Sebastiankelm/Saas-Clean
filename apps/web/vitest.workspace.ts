import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    extends: './vitest.config.ts',
    test: {
      name: 'unit',
      include: ['src/**/*.{test,spec}.{ts,tsx}', 'src/**/*.unit.{ts,tsx}'],
    },
  },
  {
    extends: './vitest.config.ts',
    test: {
      name: 'integration',
      include: ['tests/integration/**/*.{test,spec}.{ts,tsx}'],
      environment: 'node',
    },
  },
]);
