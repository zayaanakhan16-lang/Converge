// ESLint flat configuration for the Converge mobile app.
//
// Extends Expo's shared flat config and then tightens it: the project is
// strict TypeScript, so unused code and implicit any are errors rather than
// warnings. `--max-warnings 0` in the lint script makes that non-negotiable.

const expoConfig = require('eslint-config-expo/flat');
const { defineConfig } = require('eslint/config');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      'node_modules/**',
      'android/**',
      'ios/**',
      '.expo/**',
      'dist/**',
      'web-build/**',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      // `Array<T>` stays allowed where a union makes `T[]` ambiguous to read.
      '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },
  {
    // Tests and the jest setup legitimately reach for loose types and globals.
    // The plugin tests are `.js` CommonJS and run in a Node environment.
    files: ['**/__tests__/**/*.{ts,tsx,js}', 'jest.setup.ts', 'jest.config.js', 'plugins/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        global: 'readonly',
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
]);
