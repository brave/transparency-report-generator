// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.stylistic,
  {
    rules: {
      'semi': ['error', 'always'],
      'indent': ['error', 2],
    }
  },
  {
    ignores: ['node_modules', 'dist', 'build']
  }
);
