import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

// End-to-end tests: they open the built app in a real browser, on a phone screen and a
// computer screen. Google is replaced by a stand-in, so the tests never use real accounts.
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/`,
    // The service worker would answer some requests itself and hide our stand-ins.
    // One test turns it back on to check it.
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    // Cards rise into view with a short animation. Most tests turn it off, as phones do with
    // "reduce motion", so they never measure a card while it moves. The animation tests turn it on.
    reducedMotion: 'reduce',
  },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'] } },
    { name: 'computer', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `node scripts/build.mjs && node scripts/serve.mjs dist ${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
  },
});
