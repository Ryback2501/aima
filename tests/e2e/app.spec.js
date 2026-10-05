import { test, expect } from '@playwright/test';

import { setUp, googleLog, FAKE_CLIENT_ID, FAKE_SHEET_ID, FAKE_CELL } from './helpers.js';

const signInButton = (page) => page.getByRole('button', { name: 'Login with Google' });

// The badge has no color of its own. The card's inner fill leaves a hole in the badge's shape,
// so the card's border gradient shows through: badge and border are one painted surface.
async function expectBadgeShowsBorder(label) {
  const paint = await label.evaluate((node) => {
    const badge = getComputedStyle(node.querySelector('.label-badge'));
    const fill = getComputedStyle(node, '::before');
    return {
      badgeColor: badge.backgroundColor,
      badgeImage: badge.backgroundImage,
      fillMask: fill.maskImage || fill.webkitMaskImage,
    };
  });
  expect(paint.badgeColor).toBe('rgba(0, 0, 0, 0)');
  expect(paint.badgeImage).toBe('none');
  expect(paint.fillMask).toContain('radial-gradient');
}

test.describe('login page', () => {
  test('shows the logo, the name and the Google button, and nothing else', async ({ page }) => {
    await setUp(page);
    await page.goto('./');

    await expect(page.locator('#login .logo')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'aima' })).toBeVisible();
    await expect(signInButton(page)).toBeEnabled();
    await expect(page.locator('#briefing')).toBeHidden();
    await expect(page.locator('#login-message')).toBeHidden();
  });

  test('the Google button looks like the main label, in Google colors', async ({ page }) => {
    await setUp(page);
    await page.goto('./');

    const button = signInButton(page);
    const badge = button.locator('.label-badge');
    await expect(button).toHaveText('Login with Google');
    await expect(badge.locator('svg')).toBeVisible();

    // The "G" badge sits in the button's top-left corner, on top of the border.
    const buttonBox = await button.boundingBox();
    const badgeBox = await badge.boundingBox();
    expect(Math.abs(badgeBox.x - buttonBox.x)).toBeLessThan(1);
    expect(Math.abs(badgeBox.y - buttonBox.y)).toBeLessThan(1);

    const style = await button.evaluate((node) => {
      const css = getComputedStyle(node);
      return {
        radius: parseFloat(css.borderTopLeftRadius),
        background: css.backgroundImage,
        shadow: css.boxShadow,
      };
    });
    expect(style.radius).toBeGreaterThan(0);
    await expectBadgeShowsBorder(button);
    // Google blue, red, yellow and green.
    for (const color of [
      'rgb(66, 133, 244)',
      'rgb(234, 67, 53)',
      'rgb(251, 188, 5)',
      'rgb(52, 168, 83)',
    ]) {
      expect(style.background).toContain(color);
    }
    // The shadow falls to the bottom-right: both offsets are positive.
    const [x, y] = style.shadow.match(/-?[\d.]+px/g).map(parseFloat);
    expect(x).toBeGreaterThan(0);
    expect(y).toBeGreaterThan(0);
  });

  test('uses the Sol font for the whole app', async ({ page }) => {
    await setUp(page);
    await page.goto('./');

    const font = await page.evaluate(async () => {
      await document.fonts.ready;
      return {
        loaded: [...document.fonts].some(
          (face) => face.family.replace(/["']/g, '') === 'Sol' && face.status === 'loaded',
        ),
        body: getComputedStyle(document.body).fontFamily,
        weight: getComputedStyle(document.body).fontWeight,
      };
    });
    expect(font.loaded).toBe(true);
    expect(font.body).toMatch(/^["']?Sol["']?,/);
    // Bold, so letters Sol does not have (like Russian ones) look heavy too.
    expect(font.weight).toBe('700');
  });

  test('says the app is not set up while the example IDs are in the config', async ({ page }) => {
    await setUp(page, { configured: false });
    await page.goto('./');

    await expect(page.getByText('This app is not set up yet.')).toBeVisible();
    await expect(signInButton(page)).toBeDisabled();
  });
});

test.describe('sign-in', () => {
  test('a person with access sees the briefing cell in the middle', async ({ page }) => {
    const sheetRequests = await setUp(page, { cell: 'Pay the rent on Friday' });
    await page.goto('./');

    await signInButton(page).click();

    await expect(page.locator('#briefing-text')).toHaveText('Pay the rent on Friday');
    await expect(page.getByText('Signed in as ana@example.com')).toBeVisible();
    await expect(page.locator('#login')).toBeHidden();
    expect(sheetRequests).toEqual([
      {
        url: `https://sheets.googleapis.com/v4/spreadsheets/${FAKE_SHEET_ID}/values/${FAKE_CELL}`,
        authorization: 'Bearer fake-token',
      },
    ]);
    const log = await googleLog(page);
    expect(log.requests[0].clientId).toBe(FAKE_CLIENT_ID);
    expect(log.requests[0].scope).toContain('spreadsheets.readonly');
  });

  test('the text sits in a rounded label with a star badge', async ({ page }) => {
    await setUp(page, { cell: 'Buy milk' });
    await page.goto('./');

    await signInButton(page).click();

    const label = page.locator('#briefing .label');
    const badge = label.locator('.label-badge');
    await expect(label.locator('#briefing-text')).toHaveText('Buy milk');
    await expect(badge).toBeVisible();

    // The badge sits in the label's top-left corner, on top of the border.
    const labelBox = await label.boundingBox();
    const badgeBox = await badge.boundingBox();
    expect(Math.abs(badgeBox.x - labelBox.x)).toBeLessThan(1);
    expect(Math.abs(badgeBox.y - labelBox.y)).toBeLessThan(1);

    // A rectangle, wider than it is tall.
    expect(labelBox.width).toBeGreaterThan(labelBox.height);

    const style = await label.evaluate((node) => {
      const css = getComputedStyle(node);
      return {
        radius: parseFloat(css.borderTopLeftRadius),
        background: css.backgroundImage,
        shadow: css.boxShadow,
      };
    });
    expect(style.radius).toBeGreaterThan(0);
    await expectBadgeShowsBorder(label);
    expect(style.background).toContain('linear-gradient');
    // The shadow falls to the bottom-right: both offsets are positive.
    const [x, y] = style.shadow.match(/-?[\d.]+px/g).map(parseFloat);
    expect(x).toBeGreaterThan(0);
    expect(y).toBeGreaterThan(0);
  });

  test('the cell is shown as plain text, never as page code', async ({ page }) => {
    await setUp(page, { cell: '<img src=x onerror="window.hacked=1">Hello' });
    await page.goto('./');

    await signInButton(page).click();

    await expect(page.locator('#briefing-text')).toHaveText(
      '<img src=x onerror="window.hacked=1">Hello',
    );
    await expect(page.locator('#briefing-text img')).toHaveCount(0);
    expect(await page.evaluate(() => window.hacked)).toBeUndefined();
  });

  test('an empty cell shows a friendly message', async ({ page }) => {
    await setUp(page, { cell: '' });
    await page.goto('./');

    await signInButton(page).click();

    await expect(page.locator('#briefing-text')).toHaveText('There is no briefing yet.');
  });

  for (const status of [403, 404]) {
    test(`a person without access (${status}) is signed out with a message`, async ({ page }) => {
      await setUp(page, { sheetStatus: status });
      await page.goto('./');

      await signInButton(page).click();

      await expect(
        page.getByText(
          "You don't have access to this document. Ask its owner to share it with you.",
        ),
      ).toBeVisible();
      await expect(page.locator('#briefing')).toBeHidden();
      await expect(signInButton(page)).toBeEnabled();
      expect((await googleLog(page)).revoked).toEqual(['fake-token']);
      expect(await page.evaluate(() => sessionStorage.getItem('aima.token'))).toBeNull();
      expect(await page.evaluate(() => localStorage.getItem('aima.hint'))).toBeNull();
    });
  }

  test('closing the Google window keeps the login page with a message', async ({ page }) => {
    await setUp(page, { google: { closePopup: true } });
    await page.goto('./');

    await signInButton(page).click();

    await expect(page.getByText('Sign-in did not finish. Please try again.')).toBeVisible();
    await expect(signInButton(page)).toBeEnabled();
  });

  test('not allowing the sheets permission explains what is missing', async ({ page }) => {
    await setUp(page, { google: { grantSheets: false } });
    await page.goto('./');

    await signInButton(page).click();

    await expect(page.getByText(/aima needs permission to see your Google Sheets/)).toBeVisible();
    expect((await googleLog(page)).revoked).toEqual(['fake-token']);
  });

  test('opening the app again during the same visit needs no new sign-in', async ({ page }) => {
    await setUp(page);
    await page.goto('./');
    await signInButton(page).click();
    await expect(page.locator('#briefing-text')).toHaveText('Buy milk');

    await page.reload();

    await expect(page.locator('#briefing-text')).toHaveText('Buy milk');
    expect((await googleLog(page)).requests).toEqual([]);
  });

  test('the next sign-in uses the remembered account, for one tap', async ({ page }) => {
    await setUp(page);
    await page.goto('./');
    await signInButton(page).click();
    await expect(page.locator('#briefing-text')).toHaveText('Buy milk');
    // A new visit: the token is gone, the remembered email stays.
    await page.evaluate(() => sessionStorage.clear());

    await page.reload();
    await signInButton(page).click();

    await expect(page.locator('#briefing-text')).toHaveText('Buy milk');
    const { requests } = await googleLog(page);
    expect(requests[0]).toMatchObject({ prompt: '', login_hint: 'ana@example.com' });
  });

  test('signing out goes back to the login page and forgets the person', async ({ page }) => {
    await setUp(page);
    await page.goto('./');
    await signInButton(page).click();
    await expect(page.locator('#briefing-text')).toHaveText('Buy milk');

    await page.getByRole('button', { name: 'Sign out' }).click();

    await expect(page.getByText('You have signed out.')).toBeVisible();
    await expect(page.locator('#briefing')).toBeHidden();
    expect((await googleLog(page)).revoked).toEqual(['fake-token']);
    expect(await page.evaluate(() => localStorage.getItem('aima.hint'))).toBeNull();
  });
});

test.describe('language', () => {
  const cases = [
    { locale: 'es-ES', lang: 'es', button: 'Iniciar sesión con Google' },
    { locale: 'ru-RU', lang: 'ru', button: 'Войти через Google' },
    { locale: 'fr-FR', lang: 'en', button: 'Login with Google' },
  ];
  for (const { locale, lang, button } of cases) {
    test.describe(locale, () => {
      test.use({ locale });

      test(`shows the app in "${lang}"`, async ({ page }) => {
        await setUp(page);
        await page.goto('./');

        await expect(page.getByRole('button', { name: button })).toBeVisible();
        expect(await page.locator('html').getAttribute('lang')).toBe(lang);
      });
    });
  }
});

test.describe('phone app', () => {
  test('pinch zoom and double-tap zoom are turned off', async ({ page }) => {
    await setUp(page);
    await page.goto('./');

    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toContain('user-scalable=no');
    expect(viewport).toContain('maximum-scale=1');
    const touchAction = await page.evaluate(() => getComputedStyle(document.body).touchAction);
    expect(touchAction).toBe('manipulation');
  });

  test('the app can be installed with a home-screen icon and without the browser bar', async ({
    page,
    request,
  }) => {
    await setUp(page);
    await page.goto('./');

    const manifestPath = await page.locator('link[rel="manifest"]').getAttribute('href');
    const manifest = await (await request.get(manifestPath)).json();
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('./');
    const sizes = manifest.icons.map((icon) => icon.sizes);
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));

    const iconPaths = [
      ...manifest.icons.map((icon) => icon.src),
      await page.locator('link[rel="apple-touch-icon"]').getAttribute('href'),
    ];
    for (const path of iconPaths) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
      expect(response.headers()['content-type'], path).toBe('image/png');
    }
    expect(
      await page.locator('meta[name="apple-mobile-web-app-capable"]').getAttribute('content'),
    ).toBe('yes');
  });
});

test.describe('service worker', () => {
  test.use({ serviceWorkers: 'allow' });

  test('starts and keeps a copy of the app files for this version', async ({ page }) => {
    await setUp(page);
    await page.goto('./');

    const script = await page.evaluate(
      async () => (await navigator.serviceWorker.ready).active.scriptURL,
    );
    expect(script).toMatch(/\/sw\.js$/);
    await page.reload();
    await expect
      .poll(() => page.evaluate(async () => (await caches.keys()).join(',')))
      .toMatch(/^aima-\d+\.\d+\.\d+$/);
  });
});
