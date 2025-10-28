import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

import saasPlugin from './packages/eslint-plugin-saas/index.js';

export default [
  {
    ignores: ['**/node_modules/**', '**/.next/**', '**/dist/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    languageOptions: {
      ...config.languageOptions,
      parserOptions: {
        ...config.languageOptions?.parserOptions,
        ecmaFeatures: {
          ...(config.languageOptions?.parserOptions?.ecmaFeatures ?? {}),
          jsx: true,
        },
        sourceType: 'module',
      },
    },
  })),
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
      '@next/next': nextPlugin,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        sourceType: 'module',
      },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...(reactPlugin.configs['jsx-runtime']?.rules ?? {}),
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      '@next/next/no-html-link-for-pages': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-case-declarations': 'off',
    },
    settings: {
      react: {
        version: 'detect',
      },
      next: {
        rootDir: ['apps/*/'],
      },
    },
  },
  {
    files: ['packages/{ui,plugins,api-types}/src/**/*.{ts,tsx,js,jsx}'],
    plugins: {
      saas: saasPlugin,
    },
    rules: {
      'saas/enforce-package-exports': [
        'error',
        {
          packages: ['@saas-clean/ui', '@saas-clean/plugins', '@saas-clean/api-types'],
        },
      ],
    },
  },
];
