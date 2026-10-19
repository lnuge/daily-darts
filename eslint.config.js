import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
  },
  {
    files: ['src/ui/**/*.{ts,tsx}', 'src/main.tsx'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
  },
  {
    // Game logic must be pure and deterministic so the server can replay a
    // round from the player's inputs. See CLAUDE.md.
    files: ['src/game/**/*.ts'],
    ignores: ['src/game/**/*.test.ts'],
    languageOptions: {
      // No browser globals: game code must run unchanged on the server.
      globals: {},
    },
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Use the seeded RNG from src/game/rng.ts.',
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'Pass the date key in as an argument instead.' },
        { name: 'performance', message: 'Game logic must not read the clock.' },
        { name: 'crypto', message: 'Use the seeded RNG from src/game/rng.ts.' },
        { name: 'window', message: 'Game logic must not touch the DOM.' },
        { name: 'document', message: 'Game logic must not touch the DOM.' },
        { name: 'localStorage', message: 'Use src/lib/storage.ts outside of src/game.' },
        { name: 'fetch', message: 'Game logic must not do I/O.' },
        { name: 'setTimeout', message: 'Advance time with explicit ticks, not timers.' },
        { name: 'setInterval', message: 'Advance time with explicit ticks, not timers.' },
        { name: 'requestAnimationFrame', message: 'The render loop lives in src/render.' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-dom', 'react/*', 'react-dom/*'],
              message: 'src/game must not depend on React.',
            },
            {
              group: ['**/render', '**/render/**', '**/ui', '**/ui/**', '**/lib', '**/lib/**'],
              message: 'src/game must not import from render, ui or lib.',
            },
            {
              group: ['@supabase/*'],
              message: 'src/game must not do I/O.',
            },
          ],
        },
      ],
    },
  },
  prettier,
])
