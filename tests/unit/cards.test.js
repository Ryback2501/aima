import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CARDS, cardStyle } from '../../src/cards.js';
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

test('every card has all its settings and uses an icon that exists', () => {
  for (const [name, settings] of Object.entries(CARDS)) {
    for (const key of ['width', 'height', 'border', 'radius', 'iconSize']) {
      assert.equal(typeof settings[key], 'number', `${name}.${key}`);
    }
    assert.ok(ICONS[settings.icon], `${name} uses an unknown icon`);
    assert.ok(settings.colors.length > 0, `${name} has no colors`);
    assert.equal(typeof settings.padding.x, 'number', `${name}.padding.x`);
    assert.equal(typeof settings.padding.y, 'number', `${name}.padding.y`);
  }
});
