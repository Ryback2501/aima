// Builds the app: copies src/ to dist/ and writes the version number into the files.
// The app has no bundler, so the files in dist/ are the same files we write in src/.
import { cp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Only these files can hold a __VERSION__ marker. Images are copied as they are.
const TEXT_FILES = new Set(['.html', '.js', '.css', '.webmanifest', '.json', '.svg']);

// Replaces every __NAME__ marker in the text with the matching value.
export function stamp(text, values) {
  return text.replace(/__([A-Z]+)__/g, (marker, name) => values[name] ?? marker);
}

export async function build({ srcDir, outDir, version }) {
  await rm(outDir, { recursive: true, force: true });
  await cp(srcDir, outDir, { recursive: true });

  const files = await readdir(outDir, { recursive: true, withFileTypes: true });
  for (const file of files) {
    if (!file.isFile() || !TEXT_FILES.has(extname(file.name))) continue;
    const path = join(file.parentPath, file.name);
    const text = await readFile(path, 'utf8');
    const stamped = stamp(text, { VERSION: version });
    if (stamped !== text) await writeFile(path, stamped);
  }
}

// Run the build only when this file is started directly (not when a test imports it).
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const { version } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  await build({ srcDir: join(root, 'src'), outDir: join(root, 'dist'), version });
  console.log(`Built aima ${version} into dist/`);
}
