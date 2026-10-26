// Compiler-aligned correctness gate. TypeScript (tsconfig.json) owns type
// strictness; this config adds ESLint correctness and React Hooks checks. It
// deliberately does not adopt an explicit-any ban or Fast Refresh export policy.
import js from '@eslint/js';
import ts from '@typescript-eslint/eslint-plugin';
import parser from '@typescript-eslint/parser';
import hooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { parser, ecmaVersion: 2020, sourceType: 'module', globals: globals.browser },
    plugins: { '@typescript-eslint': ts, 'react-hooks': hooks },
    rules: {
      ...js.configs.recommended.rules,
      ...ts.configs['eslint-recommended'].overrides[0].rules,
      ...hooks.configs.recommended.rules,
      // Core no-unused-vars cannot understand TS type uses. Replace it with the
      // parser-aware rule, matching the compiler's underscore-parameter and
      // unused-catch conventions.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }]
    }
  },
  { files: ['vite.config.ts', 'vitest.config.ts', 'tests/**/*.{ts,tsx}'], languageOptions: { globals: globals.node } }
];
