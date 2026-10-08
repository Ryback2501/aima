import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CARDS, cardStyle, hasIcon, PILLS, pillStyle } from '../../src/components.js';
import { config } from '../../src/config.js';
import { ICONS } from '../../src/icons.js';

const card = {
  width: 544,
  height: 136,
  border: 3,
  radius: 24,
  icon: 'star',
  iconSize: 26,
  colors: ['#14b8a6', '#ec4899'],
  padding: { x: 24, y: 48 },
};

test('cardStyle turns the settings into the variables the card styles use', () => {
  assert.deepEqual(cardStyle(card), {
    '--width': '544px',
    '--height': '136px',
    '--border': '3px',
    '--radius': '24px',
    '--badge-size': '48px',
    '--pad-x': '24px',
    '--pad-y': '48px',
    '--label-border': 'linear-gradient(to bottom right, #14b8a6, #ec4899)',
  });
});

test('the badge is twice the corner size, unless the card sets its own badge size', () => {
  assert.equal(cardStyle({ ...card, radius: 20 })['--badge-size'], '40px');
  assert.equal(cardStyle({ ...card, radius: 8, badge: 44 })['--badge-size'], '44px');
});

test('the border colors go from the top-left to the bottom-right in the given order', () => {
  const colors = ['#4285f4', '#ea4335', '#fbbc05', '#34a853'];
  assert.equal(
    cardStyle({ ...card, colors })['--label-border'],
    'linear-gradient(to bottom right, #4285f4, #ea4335, #fbbc05, #34a853)',
  );
});

test('one color gives a plain border', () => {
  assert.equal(
    cardStyle({ ...card, colors: ['#123456'] })['--label-border'],
    'linear-gradient(to bottom right, #123456, #123456)',
  );
});

test('a card has a corner icon only when it sets both the icon and its size', () => {
  assert.equal(hasIcon(card), true);
  assert.equal(hasIcon({ ...card, icon: undefined }), false);
  assert.equal(hasIcon({ ...card, iconSize: undefined }), false);
});

test('every card has all its settings, and its corner icon exists', () => {
  for (const [name, settings] of Object.entries(CARDS)) {
    for (const key of ['width', 'height', 'border', 'radius']) {
      assert.equal(typeof settings[key], 'number', `${name}.${key}`);
    }
    if (hasIcon(settings)) {
      assert.ok(ICONS[settings.icon], `${name} uses an unknown icon`);
      assert.equal(typeof settings.iconSize, 'number', `${name}.iconSize`);
    }
    assert.ok(settings.colors.length > 0, `${name} has no colors`);
    assert.equal(typeof settings.padding.x, 'number', `${name}.padding.x`);
    assert.equal(typeof settings.padding.y, 'number', `${name}.padding.y`);
  }
});

test('the back button is a card without a corner icon', () => {
  assert.ok(CARDS.back);
  assert.equal(hasIcon(CARDS.back), false);
});

const pill = {
  width: 360,
  height: 48,
  border: 3,
  borderColor: '#e5e7eb',
  colors: { on: '#000000', off: '#6b7280' },
  valueWidth: 180,
  padding: { x: 20, y: 4 },
};

test('pillStyle turns the settings into the variables the pill styles use', () => {
  assert.deepEqual(pillStyle(pill), {
    '--pill-width': '360px',
    '--pill-height': '48px',
    '--pill-border': '3px',
    '--pill-border-color': '#e5e7eb',
    '--pill-on': '#000000',
    '--pill-off': '#6b7280',
    '--pill-value-width': '180px',
    '--pill-pad-x': '20px',
    '--pill-pad-y': '4px',
  });
});

test('every pill has all its settings', () => {
  for (const [name, settings] of Object.entries(PILLS)) {
    for (const key of ['width', 'height', 'border', 'valueWidth']) {
      assert.equal(typeof settings[key], 'number', `${name}.${key}`);
    }
    assert.equal(typeof settings.borderColor, 'string', `${name}.borderColor`);
    assert.equal(typeof settings.colors.on, 'string', `${name}.colors.on`);
    assert.equal(typeof settings.colors.off, 'string', `${name}.colors.off`);
    assert.equal(typeof settings.padding.x, 'number', `${name}.padding.x`);
    assert.equal(typeof settings.padding.y, 'number', `${name}.padding.y`);
  }
});

test('every part of the Total in the config has a pill', () => {
  for (const { name } of config.pills) assert.ok(PILLS[name], `no pill called "${name}"`);
});

test('every pill shows an icon that exists in icons.js, with a size', () => {
  for (const [name, settings] of Object.entries(PILLS)) {
    assert.ok(hasIcon(settings), `${name} has no icon`);
    assert.ok(ICONS[settings.icon], `${name} uses an unknown icon`);
    assert.equal(typeof settings.iconSize, 'number', `${name}.iconSize`);
  }
});
