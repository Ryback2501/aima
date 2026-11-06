import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

// End-to-end tests: they open the built app in a real browser. Google is replaced by a
// stand-in, so the tests never use real accounts.
//
// Every test runs on a phone screen. Only the tests about the layout also run on a computer
// screen: they have @both-screens at the end of their name. Add it when a test checks a size, a
// position, scrolling, something cut off by the edge of the screen, hover or touch, or when it
// changes the screen size. When it is not clear, add it. A test without it runs on the phone only.
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  // Most of the time a test waits for the app, so four of them run at the same time, also on a
  // computer with 4 processors (like the machines of CI).
  workers: 4,
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
    { name: 'computer', use: { ...devices['Desktop Chrome'] }, grep: /@both-screens/ },
  ],
  webServer: {
    command: `node scripts/build.mjs && node scripts/serve.mjs dist ${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
  },
});
