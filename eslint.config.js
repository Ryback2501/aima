import js from '@eslint/js';

// We list the global names by hand so we do not need one more package.
const browserGlobals = Object.fromEntries(
  [
    'window',
    'document',
    'navigator',
    'location',
    'fetch',
    'console',
    'setTimeout',
    'clearTimeout',
    'sessionStorage',
    'localStorage',
    'URL',
    'URLSearchParams',
    'Response',
    'Request',
    'Headers',
    'Event',
    'HTMLElement',
    'getComputedStyle',
    'caches',
  ].map((name) => [name, 'readonly']),
);

const serviceWorkerGlobals = Object.fromEntries(
  ['self', 'caches', 'fetch', 'Response', 'Request', 'URL', 'console'].map((name) => [
    name,
    'readonly',
  ]),
);

const nodeGlobals = Object.fromEntries(
  ['process', 'Buffer', 'console', 'URL', 'setTimeout', 'clearTimeout', 'fetch', 'Response'].map(
    (name) => [name, 'readonly'],
  ),
);

export default [
  { ignores: ['dist/', 'test-results/', 'playwright-report/'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: { globals: browserGlobals },
  },
  {
    files: ['src/sw.js'],
    languageOptions: { globals: serviceWorkerGlobals },
  },
  {
    // Node scripts and tests. End-to-end tests also run small functions inside the page.
    files: ['scripts/**/*.mjs', 'tests/**/*.js', '*.config.js'],
    languageOptions: { globals: { ...nodeGlobals, ...browserGlobals } },
  },
];
