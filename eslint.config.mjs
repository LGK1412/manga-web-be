import eslintPluginPrettier from 'eslint-plugin-prettier';
import prettierConfig from './.prettierrc' assert { type: 'json' };

export default [
  {
    files: ['**/*.ts'],
    plugins: {
      prettier: eslintPluginPrettier,
    },
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
    },
    rules: {
      'prettier/prettier': ['error', prettierConfig],
    },
  },
];
