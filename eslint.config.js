//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config';

export default [
  ...tanstackConfig,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'import/no-cycle': 'off',
      'import/order': 'off',
      'sort-imports': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/require-await': 'off',
      'pnpm/json-enforce-catalog': 'off',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@prisma/client', '@prisma/client/*'],
              message: 'Use the scoped database wrapper in src/server/db.ts.',
            },
            {
              group: [
                '**/generated/prisma',
                '**/generated/prisma/**',
                '#/generated/prisma',
                '#/generated/prisma/**',
              ],
              message: 'Use the scoped database wrapper in src/server/db.ts.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/server/db.ts', 'prisma/seed.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    ignores: [
      '.output/**',
      '.tanstack/**',
      '.vercel/**',
      'dist/**',
      'eslint.config.js',
      'node_modules/**',
      'prettier.config.js',
      'src/routeTree.gen.ts',
    ],
  },
];
