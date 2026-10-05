// Makes the PNG app icons from src/icons/logo.svg. Phones need PNG icons for the home screen.
// Run it again after you change the logo: npm run icons
// It uses the browser that comes with Playwright (a test tool we already have).
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const icons = fileURLToPath(new URL('../src/icons/', import.meta.url));
const logo = await readFile(join(icons, 'logo.svg'), 'utf8');

// "square" icons fill the whole square: the phone cuts its own shape (circle, rounded corners).
// The logo's drawing stays inside the middle 80%, so nothing important is cut off.
const square = logo.replace('rx="112"', 'rx="0"');

const outputs = [
  { file: 'icon-192.png', size: 192, svg: logo },
  { file: 'icon-512.png', size: 512, svg: logo },
  { file: 'icon-maskable-512.png', size: 512, svg: square },
  { file: 'apple-touch-icon.png', size: 180, svg: square },
];

const browser = await chromium.launch();
try {
  for (const { file, size, svg } of outputs) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    const sized = svg.replace('<svg ', `<svg width="${size}" height="${size}" `);
    await page.setContent(`<body style="margin:0">${sized}</body>`);
    await page.locator('svg').screenshot({ path: join(icons, file), omitBackground: true });
    await page.close();
    console.log(`Made src/icons/${file}`);
  }
} finally {
  await browser.close();
}
