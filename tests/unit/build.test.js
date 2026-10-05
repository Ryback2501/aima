import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { stamp, build } from '../../scripts/build.mjs';

test('stamp puts the version where the text says __VERSION__', () => {
  assert.equal(
    stamp('cache-__VERSION__ and v__VERSION__', { VERSION: '1.2.3' }),
    'cache-1.2.3 and v1.2.3',
  );
});

test('stamp leaves text without markers unchanged', () => {
  assert.equal(stamp('nothing to change', { VERSION: '1.2.3' }), 'nothing to change');
});

test('build copies every file and stamps only text files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aima-build-'));
  try {
    const src = join(root, 'src');
    const out = join(root, 'dist');
    await mkdir(join(src, 'icons'), { recursive: true });
    await writeFile(join(src, 'sw.js'), "const CACHE = 'aima-__VERSION__';");
    await writeFile(join(src, 'index.html'), '<p>v__VERSION__</p>');
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x5f, 0x5f]);
    await writeFile(join(src, 'icons', 'icon.png'), png);

    await build({ srcDir: src, outDir: out, version: '0.9.0' });

    assert.equal(await readFile(join(out, 'sw.js'), 'utf8'), "const CACHE = 'aima-0.9.0';");
    assert.equal(await readFile(join(out, 'index.html'), 'utf8'), '<p>v0.9.0</p>');
    assert.deepEqual(await readFile(join(out, 'icons', 'icon.png')), png);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('build removes old files from a previous build', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aima-build-'));
  try {
    const src = join(root, 'src');
    const out = join(root, 'dist');
    await mkdir(src, { recursive: true });
    await mkdir(out, { recursive: true });
    await writeFile(join(src, 'index.html'), 'new');
    await writeFile(join(out, 'old.js'), 'old');

    await build({ srcDir: src, outDir: out, version: '0.9.0' });

    await assert.rejects(readFile(join(out, 'old.js')));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
