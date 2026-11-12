/** ESLint 10 flat configuration for this JavaScript/React project. */
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y-x';
import globals from 'globals';

export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y-x': jsxA11y },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'jsx-a11y-x/alt-text': 'error',
      'jsx-a11y-x/anchor-is-valid': 'error',
      'jsx-a11y-x/click-events-have-key-events': 'error',
    },
  },
  {
    files: ['test/**/*.js'],
    languageOptions: { globals: globals.mocha },
  },
  {
    files: ['**/*.jsx'],
    // Core no-unused-vars does not recognize references through JSX tags.
    // Build and browser checks still catch missing component imports.
    rules: { 'no-unused-vars': 'off' },
  },
];
