import { test, expect } from '@playwright/test';

import {
  setUp,
  googleLog,
  sheetDay,
  FAKE_CLIENT_ID,
  FAKE_SHEET_ID,
  FAKE_CELLS,
  FAKE_TOTAL,
  FAKE_MOVEMENTS,
} from './helpers.js';
import { CARDS, hasIcon, PILLS } from '../../src/components.js';
import { ICONS } from '../../src/icons.js';

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

// True while the app ignores taps, because an animation is playing.
const locked = (page) => page.evaluate(() => document.querySelector('main').inert);

// Reads an element's shadow: how far it is moved right (x) and down (y), how soft it is (blur)
// and how much bigger or smaller than the element it is (spread).
const shadowOf = (locator) =>
  locator.evaluate((node) => {
    const [x, y, blur, spread = 0] = getComputedStyle(node)
      .boxShadow.match(/-?[\d.]+px/g)
      .map(parseFloat);
    return {
      x,
      y,
      blur,
      spread,
      // How far the visible shadow reaches past each side of the element.
      top: blur - y + spread,
      left: blur - x + spread,
      right: x + spread + blur,
      bottom: y + spread + blur,
    };
  });

// Checks that a card on the page follows its settings in CARDS.
async function expectCardFollowsSettings(card, name) {
  const settings = CARDS[name];
  const look = await card.evaluate((node) => {
    const css = getComputedStyle(node);
    const icon = node.querySelector('.label-badge svg');
    return {
      hasBadge: Boolean(icon),
      width: node.getBoundingClientRect().width,
      height: node.getBoundingClientRect().height,
      room: node.parentElement.clientWidth,
      minHeight: css.minHeight,
      border: css.borderTopWidth,
      radius: css.borderTopLeftRadius,
      padX: css.paddingLeft,
      padY: css.paddingTop,
      iconWidth: icon?.getAttribute('width'),
      iconHeight: icon?.getAttribute('height'),
      iconPath: icon?.querySelector('path').getAttribute('d'),
    };
  });
  // As wide as set, unless the screen is narrower.
  expect(Math.abs(look.width - Math.min(settings.width, look.room))).toBeLessThan(1);
  expect(look.minHeight).toBe(`${settings.height}px`);
  expect(look.height).toBeGreaterThanOrEqual(settings.height - 0.5);
  expect(look.border).toBe(`${settings.border}px`);
  expect(look.radius).toBe(`${settings.radius}px`);
  expect(look.padX).toBe(`${settings.padding.x}px`);
  expect(look.padY).toBe(`${settings.padding.y}px`);
  expect(look.hasBadge).toBe(hasIcon(settings));
  if (!look.hasBadge) return;
  expect(look.iconWidth).toBe(String(settings.iconSize));
  expect(look.iconHeight).toBe(String(settings.iconSize));
  expect(look.iconPath).toBe(ICONS[settings.icon].path);
}

test('a card without corner icon settings has no corner icon area, and icons can be content', async ({
  page,
}) => {
  await setUp(page);
  await page.goto('./');

  const back = page.locator('#back');
  await expect(back).toHaveAttribute('data-badge', 'none');
  await expect(back.locator('.label-badge')).toHaveCount(0);
  const icon = back.locator('[data-icon="back"] svg');
  await expect(icon).toHaveAttribute('width', '24');
  await expect(icon.locator('path')).toHaveAttribute('d', ICONS.back.path);
});

test('no shadow in the app shows above or to the left of its item', async ({ page }) => {
  const checked = [];
  const check = async (locator) => {
    const shadow = await shadowOf(locator);
    expect(shadow.top).toBeLessThanOrEqual(0);
    expect(shadow.left).toBeLessThanOrEqual(0);
    checked.push(shadow);
  };
  await setUp(page, { movements: [[sheetDay('2026-10-03'), 'General', 'Market', -10]] });
  await page.goto('./');
  await expect.poll(() => locked(page)).toBe(false);
  await check(signInButton(page));

  await signInButton(page).click();
  await expect.poll(() => locked(page)).toBe(false);
  await check(page.locator('#main [data-card="total"]'));
  await check(page.locator('#main [data-card="goal"]'));
  await check(page.locator('#sign-out'));

  await page.locator('#main [data-card="total"]').click();
  await expect.poll(() => locked(page)).toBe(false);
  await check(page.locator('[data-pill="bank"]'));
  await check(page.locator('#back'));
  await page.locator('#back').click();
  await expect.poll(() => locked(page)).toBe(false);

  await page.locator('#main [data-card="goal"]').click();
  await expect.poll(() => locked(page)).toBe(false);
  await check(page.locator('.month').first());
  expect(checked).toHaveLength(7);
});

test.describe('loading', () => {
  test('the app stays hidden until its code has run', async ({ page }) => {
    await setUp(page);
    await page.route('**/main.js', (route) => route.abort());
    await page.goto('./');

    await expect(page.locator('html')).toHaveClass(/loading/);
    await expect(page.locator('main')).toBeHidden();
  });

  test('if the code never runs, the page still shows after a few seconds', async ({ page }) => {
    await setUp(page);
    await page.route('**/main.js', (route) => route.abort());
    await page.goto('./');

    await expect(page.locator('main')).toBeHidden();
    await expect(page.locator('main')).toBeVisible({ timeout: 6000 });
  });

  test('the app appears with its final look', async ({ page }) => {
    await setUp(page);
    await page.goto('./');

    await expect(signInButton(page)).toBeVisible();
    await expect(page.locator('html')).not.toHaveClass(/loading/);
    // Already when it appears: the card follows its settings and the font is loaded.
    await expectCardFollowsSettings(signInButton(page), 'signIn');
    expect(await page.evaluate(() => document.fonts.check('16px Sol'))).toBe(true);
  });
});

test('each card follows its settings', async ({ page }) => {
  await setUp(page);
  await page.goto('./');
  await expectCardFollowsSettings(signInButton(page), 'signIn');

  await signInButton(page).click();
  await expect(page.locator('#total-value')).toHaveText(FAKE_TOTAL);

  await expectCardFollowsSettings(page.locator('#main .label:has(#total-value)'), 'total');
  await expectCardFollowsSettings(page.locator('#main .label:has(#goal-value)'), 'goal');
  await expectCardFollowsSettings(page.getByRole('button', { name: 'Log out' }), 'logOut');
});

test.describe('login page', () => {
  test('shows the logo, the name and the Google button, and nothing else', async ({ page }) => {
    await setUp(page);
    await page.goto('./');

    await expect(page.locator('#login .logo')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'aima' })).toBeVisible();
    await expect(signInButton(page)).toBeEnabled();
    await expect(page.locator('#main')).toBeHidden();
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
  test('a person with access sees the total in the middle', async ({ page }) => {
    const sheetRequests = await setUp(page);
    await page.goto('./');

    await signInButton(page).click();

    // The Total is the sum of its four parts: 1000 - 200.50 + 300 + 50.
    await expect(page.locator('#total-value')).toHaveText(FAKE_TOTAL);
    // The account email is not shown.
    await expect(page.getByText('ana@example.com')).toHaveCount(0);
    await expect(page.locator('#login')).toBeHidden();
    const sheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${FAKE_SHEET_ID}/values`;
    expect(sheetRequests).toHaveLength(2);
    expect(sheetRequests).toEqual(
      expect.arrayContaining([
        {
          url:
            `${sheetUrl}:batchGet?` +
            FAKE_CELLS.map((cell) => `ranges=${encodeURIComponent(cell)}`).join('&') +
            '&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER',
          authorization: 'Bearer fake-token',
        },
        {
          url:
            `${sheetUrl}/${encodeURIComponent(FAKE_MOVEMENTS)}` +
            '?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER',
          authorization: 'Bearer fake-token',
        },
      ]),
    );
    const log = await googleLog(page);
    expect(log.requests[0].clientId).toBe(FAKE_CLIENT_ID);
    expect(log.requests[0].scope).toContain('spreadsheets.readonly');
  });

  test('the Log out button is a card as wide as the Total card', async ({ page }) => {
    await setUp(page);
    await page.goto('./');

    await signInButton(page).click();

    const button = page.getByRole('button', { name: 'Log out' });
    const badge = button.locator('.label-badge');
    await expect(button).toHaveText('Log out');
    await expect(badge.locator('svg')).toBeVisible();

    const buttonBox = await button.boundingBox();
    const totalBox = await page.locator('#main .label:has(#total-value)').boundingBox();
    expect(Math.abs(buttonBox.width - totalBox.width)).toBeLessThan(1);
    expect(Math.abs(buttonBox.x - totalBox.x)).toBeLessThan(1);

    // The exit icon badge sits in the button's top-left corner, on top of the border.
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
    expect(style.background).toContain('linear-gradient');
    await expectBadgeShowsBorder(button);
    // The shadow falls to the bottom-right: both offsets are positive.
    const [x, y] = style.shadow.match(/-?[\d.]+px/g).map(parseFloat);
    expect(x).toBeGreaterThan(0);
    expect(y).toBeGreaterThan(0);
  });

  test('the text sits in a rounded label with a star badge', async ({ page }) => {
    await setUp(page);
    await page.goto('./');

    await signInButton(page).click();

    const label = page.locator('#main .label:has(#total-value)');
    const badge = label.locator('.label-badge');
    await expect(label.locator('#total-value')).toHaveText(FAKE_TOTAL);
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

  test('a part that is not a number counts as 0 and is never shown as page code', async ({
    page,
  }) => {
    await setUp(page, { cells: ['<img src=x onerror="window.hacked=1">', '', 2, 3.5] });
    await page.goto('./');

    await signInButton(page).click();

    await expect(page.locator('#total-value')).toHaveText('€1.50');
    await expect(page.locator('img[src="x"]')).toHaveCount(0);
    expect(await page.evaluate(() => window.hacked)).toBeUndefined();
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
      await expect(page.locator('#main')).toBeHidden();
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
    await expect(page.locator('#total-value')).toHaveText(FAKE_TOTAL);

    await page.reload();

    await expect(page.locator('#total-value')).toHaveText(FAKE_TOTAL);
    expect((await googleLog(page)).requests).toEqual([]);
  });

  test('the next sign-in uses the remembered account, for one tap', async ({ page }) => {
    await setUp(page);
    await page.goto('./');
    await signInButton(page).click();
    await expect(page.locator('#total-value')).toHaveText(FAKE_TOTAL);
    // A new visit: the token is gone, the remembered email stays.
    await page.evaluate(() => sessionStorage.clear());

    await page.reload();
    await signInButton(page).click();

    await expect(page.locator('#total-value')).toHaveText(FAKE_TOTAL);
    const { requests } = await googleLog(page);
    expect(requests[0]).toMatchObject({ prompt: '', login_hint: 'ana@example.com' });
  });

  test('signing out goes back to the login page and forgets the person', async ({ page }) => {
    await setUp(page);
    await page.goto('./');
    await signInButton(page).click();
    await expect(page.locator('#total-value')).toHaveText(FAKE_TOTAL);

    await page.getByRole('button', { name: 'Log out' }).click();

    await expect(page.getByText('You have signed out.')).toBeVisible();
    await expect(page.locator('#main')).toBeHidden();
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

test.describe('spending goal', () => {
  // October spending: 150 counted. Salary is not spending, so it is left out.
  const movements = [
    ['Date', 'Category', 'Description', 'Amount'],
    [sheetDay('2026-10-03'), 'Food', 'Market', -100],
    [sheetDay('2026-10-04'), 'Leisure', 'Cinema', -50],
    [sheetDay('2026-10-01'), 'Salary', 'October', 2500],
  ];

  async function openMain(page, rows) {
    await setUp(page, { movements: rows });
    await page.goto('./');
    await signInButton(page).click();
    await expect(page.locator('#total-value')).toHaveText(FAKE_TOTAL);
  }

  test('a card with a flag below the Total shows the spending', async ({ page }) => {
    await openMain(page, movements);

    const goal = page.locator('#goal-value');
    await expect(goal).toHaveText('€150.00');
    const card = page.locator('#main .label:has(#goal-value)');
    const total = page.locator('#main .label:has(#total-value)');
    expect((await card.boundingBox()).y).toBeGreaterThan((await total.boundingBox()).y);
    await expect(card.locator('.label-badge path')).toHaveAttribute('d', ICONS.flag.path);
  });

  const colorOf = (locator) => locator.evaluate((node) => getComputedStyle(node).color);

  test('under the warning line, the amount has the normal text color', async ({ page }) => {
    await openMain(page, movements);

    await expect(page.locator('#goal-value')).toHaveAttribute('data-level', 'ok');
    expect(await colorOf(page.locator('#goal-value'))).toBe(
      await colorOf(page.locator('#total-value')),
    );
  });

  test('close to the limit for the time gone by, the amount is yellow', async ({ page }) => {
    await openMain(page, [[sheetDay('2026-10-10'), 'Food', 'Market', -1500]]);

    await expect(page.locator('#goal-value')).toHaveAttribute('data-level', 'close');
    expect(await colorOf(page.locator('#goal-value'))).toBe('rgb(180, 83, 9)');
  });

  test('over the limit, the amount is red', async ({ page }) => {
    await openMain(page, [[sheetDay('2026-12-10'), 'Food', 'Market', -4000.5]]);

    await expect(page.locator('#goal-value')).toHaveAttribute('data-level', 'over');
    expect(await colorOf(page.locator('#goal-value'))).toBe('rgb(220, 38, 38)');
  });

  test.describe('in Spanish', () => {
    test.use({ locale: 'es-ES' });

    test('the amount is written the Spanish way', async ({ page }) => {
      await setUp(page, { movements: [[sheetDay('2026-10-03'), 'Food', 'Market', -1234.5]] });
      await page.goto('./');
      await page.getByRole('button', { name: 'Iniciar sesión con Google' }).click();

      await expect(page.locator('#goal-value')).toHaveText(/^1\.234,50\s€$/);
    });
  });
});

test.describe('cards rise into view', () => {
  test.use({ reducedMotion: 'no-preference' });

  const look = (locator) =>
    locator.evaluate((node) => {
      const css = getComputedStyle(node);
      return {
        name: css.animationName,
        delay: css.animationDelay,
        opacity: css.opacity,
        shadow: css.boxShadow,
      };
    });

  test('every card rises; on the main screen one after the other', async ({ page }) => {
    await setUp(page);
    await page.goto('./');
    expect(await look(signInButton(page))).toMatchObject({ name: 'card-rise', delay: '0s' });

    await expect.poll(() => locked(page)).toBe(false);
    await signInButton(page).click();
    await expect(page.locator('#total-value')).toHaveText(FAKE_TOTAL);

    const total = page.locator('#main .label:has(#total-value)');
    const goal = page.locator('#main .label:has(#goal-value)');
    const logOut = page.getByRole('button', { name: 'Log out' });
    expect(await look(total)).toMatchObject({ name: 'card-rise', delay: '0s' });
    expect(await look(goal)).toMatchObject({ name: 'card-rise', delay: '0.075s' });
    expect(await look(logOut)).toMatchObject({ name: 'card-rise', delay: '0.15s' });
  });

  test('taps are ignored until the cards have risen', async ({ page }) => {
    await setUp(page);
    await page.goto('./');
    await expect.poll(() => locked(page)).toBe(false);
    await signInButton(page).click();
    await expect(page.locator('#total-value')).toHaveText(FAKE_TOTAL);

    expect(await locked(page)).toBe(true);
    await expect.poll(() => locked(page)).toBe(false);

    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(signInButton(page)).toBeVisible();
  });

  test('at the end each card has its normal look', async ({ page }) => {
    await setUp(page, { configured: false });
    await page.goto('./');
    await expect.poll(() => locked(page)).toBe(false);

    const end = await look(signInButton(page));
    // The button stays disabled here, so it ends faded, as a disabled button should.
    expect(end.opacity).toBe('0.5');
    const [x, y] = end.shadow.match(/-?[\d.]+px/g).map(parseFloat);
    expect(x).toBeGreaterThan(0);
    expect(y).toBeGreaterThan(0);
  });
});

test('with "reduce motion" on the phone, cards show at once and taps work', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setUp(page);
  await page.goto('./');
  await expect(signInButton(page)).toBeVisible();

  expect(await signInButton(page).evaluate((node) => getComputedStyle(node).animationName)).toBe(
    'none',
  );
  await expect.poll(() => locked(page)).toBe(false);
});

test.describe('open a card full screen', () => {
  const cardOf = (page, name) => page.locator(`#main [data-card="${name}"]`);
  const box = (locator) => locator.boundingBox();
  const near = (a, b) => expect(Math.abs(a - b)).toBeLessThan(1);

  async function openMain(page) {
    await setUp(page);
    await page.goto('./');
    await signInButton(page).click();
    await expect(page.locator('#total-value')).toHaveText(FAKE_TOTAL);
    await expect.poll(() => locked(page)).toBe(false);
  }

  for (const name of ['total', 'goal']) {
    test(`tapping the ${name} card opens it full screen, and back puts it back`, async ({
      page,
    }) => {
      await openMain(page);
      const card = cardOf(page, name);
      const before = await box(card);
      const screen = page.viewportSize();

      await card.click();

      const back = page.locator('#back');
      await expect(back).toBeVisible();
      await expect(card).toHaveAttribute('aria-expanded', 'true');
      const open = await box(card);
      near(open.x, 0);
      near(open.y, 0);
      near(open.width, screen.width);
      near(open.height, screen.height);
      // Everything else is black.
      const backdrop = page.locator('#backdrop');
      await expect(backdrop).toBeVisible();
      expect(
        await backdrop.evaluate((node) => [
          getComputedStyle(node).opacity,
          getComputedStyle(node).backgroundColor,
        ]),
      ).toEqual(['1', 'rgb(0, 0, 0)']);
      // The back button: bottom-left, a card from its settings, with the back arrow inside.
      const backBox = await box(back);
      expect(backBox.x).toBeLessThan(40);
      expect(backBox.y + backBox.height).toBeGreaterThan(screen.height - 40);
      await expectCardFollowsSettings(back, 'back');
      await expect(back.locator('[data-icon="back"] svg path')).toHaveAttribute(
        'd',
        ICONS.back.path,
      );
      // Log out is covered: a tap there does nothing.
      const logOut = await box(page.getByRole('button', { name: 'Log out' }));
      await page.mouse.click(logOut.x + logOut.width / 2, logOut.y + logOut.height / 2);
      await expect(back).toBeVisible();
      expect(await page.locator('#sign-out').evaluate((node) => node.inert)).toBe(true);

      await back.click();

      await expect(back).toBeHidden();
      await expect(backdrop).toBeHidden();
      await expect(card).toHaveAttribute('aria-expanded', 'false');
      const after = await box(card);
      near(after.x, before.x);
      near(after.y, before.y);
      near(after.width, before.width);
      near(after.height, before.height);
      expect(await page.locator('#sign-out').evaluate((node) => node.inert)).toBe(false);
    });
  }

  test('a card also opens with the Enter key', async ({ page }) => {
    await openMain(page);

    await cardOf(page, 'total').focus();
    await page.keyboard.press('Enter');

    await expect(page.locator('#back')).toBeVisible();
  });

  test.describe('with motion', () => {
    test.use({ reducedMotion: 'no-preference' });

    test('the card grows while taps are ignored, then the back button rises in', async ({
      page,
    }) => {
      await openMain(page);
      const card = cardOf(page, 'total');
      const before = await box(card);

      await card.click();
      expect(await locked(page)).toBe(true);
      // Stop the growing halfway to measure it.
      const half = await card.evaluate((node) => {
        const grow = node.getAnimations().find((animation) => !('animationName' in animation));
        grow.pause();
        grow.currentTime = grow.effect.getTiming().duration / 2;
        const rect = node.getBoundingClientRect();
        grow.play();
        return { width: rect.width, height: rect.height };
      });
      expect(half.height).toBeGreaterThan(before.height);
      expect(half.height).toBeLessThan(page.viewportSize().height);

      await expect(page.locator('#back')).toBeVisible();
      await expect.poll(() => locked(page)).toBe(false);
      await page.locator('#back').click();
      await expect(page.locator('#backdrop')).toBeHidden();
    });
  });
});

test.describe('the open Total card', () => {
  const totalCard = (page) => page.locator('#main [data-card="total"]');
  const pill = (page, name) => page.locator(`[data-pill="${name}"]`);
  const names = ['bank', 'cards', 'provisioned', 'cash'];

  async function openMain(page) {
    await setUp(page);
    await page.goto('./');
    await signInButton(page).click();
    await expect(page.locator('#total-value')).toHaveText(FAKE_TOTAL);
    await expect.poll(() => locked(page)).toBe(false);
  }

  async function openTotal(page) {
    await totalCard(page).click();
    await expect(page.locator('#back')).toBeVisible();
    await expect.poll(() => locked(page)).toBe(false);
  }

  test('shows the Total at the top with its caption, and the four parts as pills', async ({
    page,
  }) => {
    await openMain(page);
    const closed = await page.locator('#total-value').boundingBox();

    await openTotal(page);

    const caption = totalCard(page).locator('.total-caption');
    await expect(caption).toHaveText('Total');
    const number = await page.locator('#total-value').boundingBox();
    expect(number.y).toBeLessThan(closed.y);
    expect(number.y).toBeLessThan(160);
    expect((await caption.boundingBox()).y).toBeLessThan(number.y);

    const boxes = [];
    for (const name of names) {
      await expect(pill(page, name)).toBeVisible();
      boxes.push(await pill(page, name).boundingBox());
    }
    // In a column below the number, in order, all the same width.
    expect(boxes[0].y).toBeGreaterThan(number.y + number.height);
    for (let i = 1; i < boxes.length; i++) {
      expect(boxes[i].y).toBeGreaterThan(boxes[i - 1].y);
      expect(Math.abs(boxes[i].width - boxes[0].width)).toBeLessThan(1);
    }
    await expect(pill(page, 'bank').locator('.pill-name')).toHaveText('Bank');
    await expect(pill(page, 'bank').locator('.pill-value')).toHaveText('€1,000.00');
    await expect(pill(page, 'cards').locator('.pill-value')).toHaveText('-€200.50');
    await expect(pill(page, 'provisioned').locator('.pill-value')).toHaveText('€300.00');
    await expect(pill(page, 'cash').locator('.pill-value')).toHaveText('€50.00');
    // Pills cast the same shadow as the cards.
    const shadow = await pill(page, 'bank').evaluate((node) => getComputedStyle(node).boxShadow);
    const [x, y] = shadow.match(/-?[\d.]+px/g).map(parseFloat);
    expect(x).toBeGreaterThan(0);
    expect(y).toBeGreaterThan(0);

    await page.locator('#back').click();

    await expect(caption).toBeHidden();
    await expect(pill(page, 'bank')).toBeHidden();
    const after = await page.locator('#total-value').boundingBox();
    expect(Math.abs(after.y - closed.y)).toBeLessThan(1);
  });

  test('the pills have the same space above (to the number) and below (to the back button)', async ({
    page,
  }) => {
    await openMain(page);
    await openTotal(page);

    const number = await page.locator('#total-value').boundingBox();
    const first = await pill(page, 'bank').boundingBox();
    const last = await pill(page, 'cash').boundingBox();
    const back = await page.locator('#back').boundingBox();
    const above = first.y - (number.y + number.height);
    const below = back.y - (last.y + last.height);

    expect(above).toBeGreaterThan(0);
    expect(Math.abs(above - below)).toBeLessThan(1);
  });

  test('a negative Total is red; a positive one has the normal text color', async ({ page }) => {
    const colorOf = (selector) =>
      page.locator(selector).evaluate((node) => getComputedStyle(node).color);
    await openMain(page);
    const normal = await colorOf('#goal-value');
    expect(await colorOf('#total-value')).toBe(normal);
    await openTotal(page);

    // Without the bank, the Total is 549.50 - 1000 = -450.50.
    await pill(page, 'bank').click();

    await expect(page.locator('#total-value')).toHaveText('-€450.50');
    expect(await colorOf('#total-value')).toBe('rgb(220, 38, 38)');

    await pill(page, 'bank').click();

    await expect(page.locator('#total-value')).toHaveText(FAKE_TOTAL);
    expect(await colorOf('#total-value')).toBe(normal);
  });

  test('each pill follows its settings, and its value part has a fixed width', async ({ page }) => {
    await openMain(page);
    await openTotal(page);

    for (const name of names) {
      const settings = PILLS[name];
      const look = await pill(page, name).evaluate((node) => {
        const css = getComputedStyle(node);
        return {
          width: node.getBoundingClientRect().width,
          height: node.getBoundingClientRect().height,
          room: node.parentElement.clientWidth,
          border: css.borderTopWidth,
          borderColor: css.borderTopColor,
          valueWidth: node.querySelector('.pill-value').getBoundingClientRect().width,
        };
      });
      expect(Math.abs(look.width - Math.min(settings.width, look.room))).toBeLessThan(1);
      expect(look.height).toBe(settings.height);
      expect(look.border).toBe(`${settings.border}px`);
      expect(look.valueWidth).toBe(settings.valueWidth);
    }
  });

  test('each pill shows its icon left of its name, in the same color as the name', async ({
    page,
  }) => {
    await openMain(page);
    await openTotal(page);

    for (const name of names) {
      const icon = pill(page, name).locator('.pill-icon');
      await expect(icon).toBeVisible();
      await expect(icon).toHaveAttribute('width', String(PILLS[name].iconSize));
      await expect(icon.locator('path')).toHaveAttribute('d', ICONS[PILLS[name].icon].path);
      const iconBox = await icon.boundingBox();
      const nameBox = await pill(page, name).locator('.pill-name').boundingBox();
      expect(iconBox.x + iconBox.width).toBeLessThanOrEqual(nameBox.x);
      const colors = await pill(page, name).evaluate((node) => [
        getComputedStyle(node.querySelector('.pill-icon')).fill,
        getComputedStyle(node.querySelector('.pill-name')).color,
      ]);
      expect(colors[0]).toBe(colors[1]);
      // The name is never cut off.
      const nameNode = pill(page, name).locator('.pill-name');
      expect(await nameNode.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
    }
  });

  test('a tap on a pill switches it off and takes it out of the Total; it is remembered', async ({
    page,
  }) => {
    await openMain(page);
    await openTotal(page);
    const dark = (name) =>
      pill(page, name).evaluate((node) => getComputedStyle(node).backgroundColor);
    expect(await dark('cash')).toBe('rgb(0, 0, 0)');

    await pill(page, 'cash').click();

    await expect(pill(page, 'cash')).toHaveAttribute('aria-pressed', 'false');
    expect(await dark('cash')).toBe('rgb(107, 114, 128)');
    await expect(page.locator('#total-value')).toHaveText('€499.50');

    await page.reload();
    await expect(page.locator('#total-value')).toHaveText('€499.50');
    await expect.poll(() => locked(page)).toBe(false);
    await openTotal(page);
    await expect(pill(page, 'cash')).toHaveAttribute('aria-pressed', 'false');

    await pill(page, 'cash').click();

    await expect(pill(page, 'cash')).toHaveAttribute('aria-pressed', 'true');
    expect(await dark('cash')).toBe('rgb(0, 0, 0)');
    await expect(page.locator('#total-value')).toHaveText(FAKE_TOTAL);
  });

  test.describe('with motion', () => {
    test.use({ reducedMotion: 'no-preference' });

    const delayOf = (locator) =>
      locator.evaluate((node) => {
        const css = getComputedStyle(node);
        return `${css.animationName} ${css.animationDelay}`;
      });

    test('the number glides up while the card grows', async ({ page }) => {
      await openMain(page);
      const closed = await page.locator('#total-value').boundingBox();

      await totalCard(page).click();
      const half = await page.evaluate(() => {
        const grows = document
          .getAnimations()
          .filter((animation) => !('animationName' in animation));
        for (const animation of grows) {
          animation.pause();
          animation.currentTime = animation.effect.getTiming().duration / 2;
        }
        const y = document.getElementById('total-value').getBoundingClientRect().y;
        for (const animation of grows) animation.play();
        return y;
      });
      await expect.poll(() => locked(page)).toBe(false);
      const open = await page.locator('#total-value').boundingBox();

      expect(half).toBeLessThan(closed.y);
      expect(half).toBeGreaterThan(open.y);
    });

    test('caption, pills and back button rise in one after the other', async ({ page }) => {
      await openMain(page);

      await totalCard(page).click();
      await expect(page.locator('#back')).toBeVisible();
      expect(await locked(page)).toBe(true);

      expect(await delayOf(totalCard(page).locator('.total-caption'))).toBe('card-rise 0s');
      expect(await delayOf(pill(page, 'bank'))).toBe('card-rise 0.075s');
      expect(await delayOf(pill(page, 'cash'))).toBe('card-rise 0.3s');
      expect(await delayOf(page.locator('#back'))).toBe('card-rise 0.375s');
      await expect.poll(() => locked(page)).toBe(false);
    });

    test('closing plays it all backwards and in reverse order, then the card shrinks', async ({
      page,
    }) => {
      await openMain(page);
      await openTotal(page);
      const open = await totalCard(page).boundingBox();

      await page.locator('#back').click();

      expect(await locked(page)).toBe(true);
      expect(await delayOf(page.locator('#back'))).toBe('card-sink 0s');
      expect(await delayOf(pill(page, 'cash'))).toBe('card-sink 0.075s');
      expect(await delayOf(pill(page, 'bank'))).toBe('card-sink 0.3s');
      expect(await delayOf(totalCard(page).locator('.total-caption'))).toBe('card-sink 0.375s');
      // The card waits for them before it shrinks.
      const stillOpen = await totalCard(page).boundingBox();
      expect(stillOpen.height).toBe(open.height);

      await expect(page.locator('#backdrop')).toBeHidden();
      await expect.poll(() => locked(page)).toBe(false);
    });

    test('the Total counts to its new value while a pill fades, and taps wait', async ({
      page,
    }) => {
      await openMain(page);
      await openTotal(page);

      await pill(page, 'bank').click();
      expect(await locked(page)).toBe(true);
      // Stop the counting halfway and read the number.
      await page.evaluate(() => {
        for (const animation of document.getElementById('total-value').getAnimations()) {
          animation.pause();
          animation.currentTime = animation.effect.getTiming().duration / 2;
        }
      });
      await page.evaluate(
        () =>
          new Promise((done) =>
            window.requestAnimationFrame(() => window.requestAnimationFrame(done)),
          ),
      );
      const halfway = Number(
        (await page.locator('#total-value').textContent()).replace(/[^\d.-]/g, ''),
      );
      expect(halfway).toBeGreaterThan(-450.5);
      expect(halfway).toBeLessThan(549.5);
      await page.evaluate(() => {
        for (const animation of document.getElementById('total-value').getAnimations()) {
          animation.play();
        }
      });

      await expect(page.locator('#total-value')).toHaveText('-€450.50');
      await expect.poll(() => locked(page)).toBe(false);
    });
  });
});

test.describe('the open goal card', () => {
  const goalCard = (page) => page.locator('#main [data-card="goal"]');
  const month = (page, index) => page.locator('.month').nth(index);

  // October has three counted movements and one skipped (salary); November has none;
  // December has one.
  const movements = [
    [sheetDay('2026-10-03'), 'General', 'Market', -100],
    [sheetDay('2026-10-20'), 'Car', 'Petrol', -45.2],
    [sheetDay('2026-10-12'), 'Leisure', 'Cinema refund', 10],
    [sheetDay('2026-10-01'), 'Salary', 'October', 2500],
    [sheetDay('2026-12-02'), 'Yoshi', 'Vet', -60],
  ];

  async function openGoal(page, rows = movements) {
    await setUp(page, { movements: rows });
    await page.goto('./');
    await signInButton(page).click();
    await expect(page.locator('#total-value')).toHaveText(FAKE_TOTAL);
    await expect.poll(() => locked(page)).toBe(false);
    await goalCard(page).click();
    await expect(page.locator('#back')).toBeVisible();
    await expect.poll(() => locked(page)).toBe(false);
  }

  async function tapMonth(page, index) {
    await month(page, index).locator('.month-head').click();
    await expect.poll(() => locked(page)).toBe(false);
  }

  test('shows "Goal 4K" above the number and the three months below it', async ({ page }) => {
    await openGoal(page);

    const title = goalCard(page).locator('.total-caption');
    await expect(title).toHaveText('Goal 4K');
    const number = await page.locator('#goal-value').boundingBox();
    expect((await title.boundingBox()).y).toBeLessThan(number.y);
    expect(number.y).toBeLessThan(160);

    await expect(page.locator('.month')).toHaveCount(3);
    await expect(month(page, 0).locator('.month-letter')).toHaveText('O');
    await expect(month(page, 1).locator('.month-letter')).toHaveText('N');
    await expect(month(page, 2).locator('.month-letter')).toHaveText('D');
    await expect(month(page, 0).locator('.month-head')).toHaveAttribute('aria-label', /October/);
    await expect(month(page, 0).locator('.month-amount')).toHaveText('€135.20');
    await expect(month(page, 2).locator('.month-amount')).toHaveText('€60.00');
    // The months start right below the number, 32px away, one under the other.
    const first = await month(page, 0).boundingBox();
    expect(Math.abs(first.y - (number.y + number.height) - 32)).toBeLessThan(1);
    expect((await month(page, 1).boundingBox()).y).toBeGreaterThan(first.y);
    // All months start closed: no movement shows.
    for (const index of [0, 1, 2]) {
      await expect(month(page, index).locator('.month-list')).toBeHidden();
    }
  });

  test("a month's shadow ends where the next month starts, and is not cut on the right", async ({
    page,
  }) => {
    await openGoal(page);

    const shadow = await shadowOf(month(page, 0));
    const first = await month(page, 0).boundingBox();
    const second = await month(page, 1).boundingBox();
    expect(shadow.bottom).toBe(second.y - (first.y + first.height));
    // The area reaches 24px into the card's side padding: the shadow fits in it.
    const area = await page.locator('.month-room').boundingBox();
    expect(first.x + first.width + shadow.right).toBeLessThanOrEqual(area.x + area.width);
  });

  test('a month without movements shows two lines in grey and does not open', async ({ page }) => {
    await openGoal(page);

    const november = month(page, 1);
    await expect(november.locator('.month-amount')).toHaveText('--');
    const grey = 'rgb(156, 163, 175)';
    expect(await november.locator('.month-amount').evaluate((n) => getComputedStyle(n).color)).toBe(
      grey,
    );
    expect(await november.locator('.month-arrow').evaluate((n) => getComputedStyle(n).fill)).toBe(
      grey,
    );
    await expect(november.locator('.month-head')).toBeDisabled();
  });

  test('a tap opens a month: its movements, newest first, with icons and descriptions', async ({
    page,
  }) => {
    await openGoal(page);

    await tapMonth(page, 0);

    const october = month(page, 0);
    await expect(october.locator('.month-head')).toHaveAttribute('aria-expanded', 'true');
    const rows = october.locator('.movement');
    await expect(rows).toHaveCount(3);
    await expect(rows.locator('.movement-amount')).toHaveText(['€45.20', '-€10.00', '€100.00']);
    await expect(rows.locator('.movement-description')).toHaveText([
      'Petrol',
      'Cinema refund',
      'Market',
    ]);
    await expect(rows.nth(0).locator('svg path')).toHaveAttribute('d', ICONS.car.path);
    await expect(rows.nth(1).locator('svg path')).toHaveAttribute('d', ICONS.ticket.path);
    await expect(rows.nth(2).locator('svg path')).toHaveAttribute('d', ICONS.moneyBag.path);
    // The description is below the amount.
    const amountBox = await rows.nth(0).locator('.movement-amount').boundingBox();
    const descriptionBox = await rows.nth(0).locator('.movement-description').boundingBox();
    expect(descriptionBox.y).toBeGreaterThan(amountBox.y);
    // No shadow under the header row: the list is already separated from it.
    const shadowOf = (index) =>
      month(page, index)
        .locator('.month-head')
        .evaluate((n) => getComputedStyle(n).boxShadow);
    expect(await shadowOf(0)).toBe('none');

    // Another month: the first one closes.
    await tapMonth(page, 2);
    await expect(october.locator('.month-head')).toHaveAttribute('aria-expanded', 'false');
    await expect(month(page, 2).locator('.movement-description')).toHaveText(['Vet']);
    await expect(month(page, 2).locator('.movement svg path')).toHaveAttribute('d', ICONS.paw.path);

    // The same month again: it closes.
    await tapMonth(page, 2);
    await expect(month(page, 2).locator('.month-head')).toHaveAttribute('aria-expanded', 'false');
  });

  test('with many movements the open month fills the room, and only its list scrolls', async ({
    page,
  }) => {
    const many = Array.from({ length: 40 }, (_, index) => [
      sheetDay('2026-11-01') + index / 100,
      'General',
      `Shop ${index}`,
      -1,
    ]);
    await openGoal(page, many);
    const room = await page.locator('.month-room').boundingBox();
    const number = await page.locator('#goal-value').boundingBox();
    const back = await page.locator('#back').boundingBox();
    // The area, and the months in it, start 32px below the number; the area ends 32px above
    // the back button.
    const first = await month(page, 0).boundingBox();
    expect(Math.abs(first.y - (number.y + number.height) - 32)).toBeLessThan(1);
    expect(Math.abs(first.y - room.y)).toBeLessThan(1);
    expect(Math.abs(back.y - (room.y + room.height) - 32)).toBeLessThan(1);

    await tapMonth(page, 1);

    // The open month fills the space from the months' start line to the bottom edge.
    const november = await month(page, 1).boundingBox();
    expect(Math.abs(november.y - first.y)).toBeLessThan(1);
    expect(Math.abs(november.y + november.height - (room.y + room.height))).toBeLessThan(1);
    // October is pushed out above (nothing to fade over the open month at the top), December
    // is pushed out below.
    await expect(page.locator('.month-fade-top')).not.toHaveClass(/visible/);
    await expect(page.locator('.month-fade-bottom')).not.toHaveClass(/visible/);

    const list = month(page, 1).locator('.month-list');
    const columnBefore = await page
      .locator('.month-column')
      .evaluate((n) => getComputedStyle(n).transform);
    const listBox = await list.boundingBox();
    await page.mouse.move(listBox.x + listBox.width / 2, listBox.y + listBox.height / 2);
    await page.mouse.wheel(0, 300);
    await expect.poll(() => list.evaluate((n) => n.scrollTop)).toBeGreaterThan(0);
    expect(await page.locator('.month-column').evaluate((n) => getComputedStyle(n).transform)).toBe(
      columnBefore,
    );
  });

  for (const count of [3, 6, 8]) {
    test(`a fade shows exactly when a closed month is cut by a limit (${count} movements)`, async ({
      page,
    }) => {
      const some = Array.from({ length: count }, (_, index) => [
        sheetDay('2026-11-01') + index / 100,
        'General',
        `Shop ${index}`,
        -1,
      ]);
      await openGoal(page, [...movements, ...some]);

      for (const index of [0, 1]) {
        await tapMonth(page, index);
        const look = await page.evaluate(() => {
          const room = document.querySelector('.month-room').getBoundingClientRect();
          const closed = [...document.querySelectorAll('.month:not(.open)')].map((node) =>
            node.getBoundingClientRect(),
          );
          const cutAt = (line) =>
            closed.some(({ top, bottom }) => top < line - 0.5 && bottom > line + 0.5);
          return {
            cutTop: cutAt(room.top),
            cutBottom: cutAt(room.bottom),
            fadeTop: document.querySelector('.month-fade-top').classList.contains('visible'),
            fadeBottom: document.querySelector('.month-fade-bottom').classList.contains('visible'),
          };
        });
        expect(look.fadeTop).toBe(look.cutTop);
        expect(look.fadeBottom).toBe(look.cutBottom);
      }
    });
  }

  // A fade shows over exactly the closed months that are cut at an edge of the area.
  const fadesMatchCuts = async (page) => {
    const look = await page.evaluate(() => {
      const room = document.querySelector('.month-room').getBoundingClientRect();
      const closed = [...document.querySelectorAll('.month:not(.open)')].map((node) =>
        node.getBoundingClientRect(),
      );
      const cutAt = (line) =>
        closed.some(({ top, bottom }) => top < line - 0.5 && bottom > line + 0.5);
      return {
        cutTop: cutAt(room.top),
        cutBottom: cutAt(room.bottom),
        fadeTop: document.querySelector('.month-fade-top').classList.contains('visible'),
        fadeBottom: document.querySelector('.month-fade-bottom').classList.contains('visible'),
      };
    });
    expect(look.fadeTop).toBe(look.cutTop);
    expect(look.fadeBottom).toBe(look.cutBottom);
    return look;
  };

  test('in a short window with no month open, the area scrolls like a normal list', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 412, height: 380 });
    await openGoal(page);
    const room = page.locator('.month-room');
    expect(await room.evaluate((n) => n.scrollHeight > n.clientHeight)).toBe(true);
    expect((await fadesMatchCuts(page)).cutBottom).toBe(true);

    const box = await room.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 400);

    await expect.poll(() => room.evaluate((n) => n.scrollTop)).toBeGreaterThan(0);
    await expect(() => fadesMatchCuts(page)).toPass();

    // Scrolled a little: the first month is cut at the top, under the top fade.
    await room.evaluate((n) => (n.scrollTop = 40));
    await expect(async () => expect((await fadesMatchCuts(page)).cutTop).toBe(true)).toPass();

    // Open a month and close it again: the months stay where they were, and the area scrolls
    // like a normal list again.
    const before = (await month(page, 1).boundingBox()).y;
    await tapMonth(page, 0);
    expect(await room.evaluate((n) => getComputedStyle(n).overflowY)).toBe('hidden');
    await tapMonth(page, 0);
    expect(await room.evaluate((n) => getComputedStyle(n).overflowY)).toBe('auto');
    await room.evaluate((n) => (n.scrollTop = 0));
    await expect.poll(() => room.evaluate((n) => n.scrollTop)).toBe(0);
    expect((await month(page, 1).boundingBox()).y).toBeGreaterThan(before);
    await expect(() => fadesMatchCuts(page)).toPass();
  });

  test('when the window gets smaller with a month open, the months are placed again', async ({
    page,
  }) => {
    const many = Array.from({ length: 40 }, (_, index) => [
      sheetDay('2026-11-01') + index / 100,
      'General',
      `Shop ${index}`,
      -1,
    ]);
    await openGoal(page, many);
    await tapMonth(page, 1);
    const size = page.viewportSize();

    await page.setViewportSize({ width: size.width, height: size.height - 150 });

    await expect
      .poll(async () => {
        const room = await page.locator('.month-room').boundingBox();
        const open = await month(page, 1).boundingBox();
        return Math.abs(open.y + open.height - (room.y + room.height));
      })
      .toBeLessThan(1);
    const room = await page.locator('.month-room').boundingBox();
    expect((await month(page, 1).boundingBox()).y).toBeGreaterThanOrEqual(room.y);
    await fadesMatchCuts(page);
  });

  test.describe('in Spanish', () => {
    test.use({ locale: 'es-ES' });

    test('the title and the month names are in Spanish', async ({ page }) => {
      await setUp(page, { movements });
      await page.goto('./');
      await page.getByRole('button', { name: 'Iniciar sesión con Google' }).click();
      await expect.poll(() => locked(page)).toBe(false);
      await goalCard(page).click();
      await expect(page.locator('#back')).toBeVisible();

      await expect(goalCard(page).locator('.total-caption')).toHaveText('Objetivo 4K');
      await expect(month(page, 0).locator('.month-head')).toHaveAttribute('aria-label', /Octubre/);
    });
  });

  test.describe('with motion', () => {
    test.use({ reducedMotion: 'no-preference' });

    const delayOf = (locator) =>
      locator.evaluate((node) => {
        const css = getComputedStyle(node);
        return `${css.animationName} ${css.animationDelay}`;
      });

    test('title, months one by one, then the back button rise in; closing reverses', async ({
      page,
    }) => {
      await setUp(page, { movements });
      await page.goto('./');
      await signInButton(page).click();
      await expect.poll(() => locked(page)).toBe(false);

      await goalCard(page).click();
      await expect(page.locator('#back')).toBeVisible();
      expect(await delayOf(goalCard(page).locator('.total-caption'))).toBe('card-rise 0s');
      expect(await delayOf(month(page, 0))).toBe('card-rise 0.075s');
      expect(await delayOf(month(page, 2))).toBe('card-rise 0.225s');
      expect(await delayOf(page.locator('#back'))).toBe('card-rise 0.3s');
      await expect.poll(() => locked(page)).toBe(false);

      await page.locator('#back').click();
      expect(await delayOf(page.locator('#back'))).toBe('card-sink 0s');
      expect(await delayOf(month(page, 2))).toBe('card-sink 0.075s');
      expect(await delayOf(goalCard(page).locator('.total-caption'))).toBe('card-sink 0.3s');
      await expect(page.locator('#backdrop')).toBeHidden();
    });

    test('while a month opens, the area edges stay still and the fades follow the months', async ({
      page,
    }) => {
      const some = Array.from({ length: 7 }, (_, index) => [
        sheetDay('2026-10-01') + index / 100,
        'General',
        `Shop ${index}`,
        -1,
      ]);
      await setUp(page, { movements: [...movements, ...some] });
      await page.goto('./');
      await signInButton(page).click();
      await expect.poll(() => locked(page)).toBe(false);
      await goalCard(page).click();
      await expect(page.locator('#back')).toBeVisible();
      await expect.poll(() => locked(page)).toBe(false);
      const edges = () =>
        page.locator('.month-room').evaluate((node) => {
          const { top, bottom } = node.getBoundingClientRect();
          // Where the area cuts what is inside it: its box, and any extra cut line.
          return { top, bottom, cut: getComputedStyle(node).clipPath };
        });
      const before = await edges();

      await month(page, 0).locator('.month-head').click();

      for (const part of [0.25, 0.5, 0.75]) {
        await page.evaluate((part) => {
          for (const animation of document.querySelector('.month-room').getAnimations({
            subtree: true,
          })) {
            animation.pause();
            animation.currentTime = animation.effect.getTiming().duration * part;
          }
        }, part);
        await page.evaluate(
          () =>
            new Promise((done) =>
              window.requestAnimationFrame(() => window.requestAnimationFrame(done)),
            ),
        );
        expect(await edges()).toEqual(before);
        const look = await page.evaluate(() => {
          const room = document.querySelector('.month-room').getBoundingClientRect();
          const closed = [...document.querySelectorAll('.month:not(.open)')].map((node) =>
            node.getBoundingClientRect(),
          );
          const cutAt = (line) =>
            closed.some(({ top, bottom }) => top < line - 0.5 && bottom > line + 0.5);
          return {
            cutTop: cutAt(room.top),
            cutBottom: cutAt(room.bottom),
            fadeTop: document.querySelector('.month-fade-top').classList.contains('visible'),
            fadeBottom: document.querySelector('.month-fade-bottom').classList.contains('visible'),
          };
        });
        expect(look.fadeTop).toBe(look.cutTop);
        expect(look.fadeBottom).toBe(look.cutBottom);
      }
      await page.evaluate(() => {
        for (const animation of document.querySelector('.month-room').getAnimations({
          subtree: true,
        })) {
          animation.play();
        }
      });
      await expect.poll(() => locked(page)).toBe(false);
    });

    test('opening a month moves smoothly and taps wait', async ({ page }) => {
      await setUp(page, { movements });
      await page.goto('./');
      await signInButton(page).click();
      await expect.poll(() => locked(page)).toBe(false);
      await goalCard(page).click();
      await expect(page.locator('#back')).toBeVisible();
      await expect.poll(() => locked(page)).toBe(false);
      const closedHeight = (await month(page, 0).boundingBox()).height;

      await month(page, 0).locator('.month-head').click();

      expect(await locked(page)).toBe(true);
      const moving = await month(page, 0).evaluate((n) => n.getAnimations().length);
      expect(moving).toBeGreaterThan(0);
      await expect.poll(() => locked(page)).toBe(false);
      expect((await month(page, 0).boundingBox()).height).toBeGreaterThan(closedHeight);
    });
  });
});
