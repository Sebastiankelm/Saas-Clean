import '@rushstack/eslint-patch/modern-module-resolution.js';
import next from 'eslint-config-next';

export default [
  ...next(),
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    ignores: ['**/node_modules/**', '**/.next/**'],
    settings: {
      next: {
        rootDir: ['apps/*/'],
      },
    },
  },
];
