// A very small web server to try the app on this computer.
// Use: node scripts/serve.mjs <folder> <port>
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
};

const folder = resolve(process.argv[2] ?? 'dist');
const port = Number(process.argv[3] ?? 8082);

createServer(async (request, response) => {
  try {
    // A broken address (for example a bad "%" code) makes decodeURIComponent fail. The
    // try/catch below answers "Not found" instead of stopping the server.
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    // normalize() removes "../" so nobody can read files outside the folder.
    let file = join(folder, normalize(path));
    // A folder without "/" at the end (for example /privacy) goes to the folder's page
    // (/privacy/), like GitHub Pages does.
    if (!path.endsWith('/') && (await stat(file).catch(() => null))?.isDirectory()) {
      response.writeHead(301, { Location: `${path}/` });
      response.end();
      return;
    }
    if (path.endsWith('/')) file = join(file, 'index.html');
    const body = await readFile(file);
    response.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain' });
    response.end('Not found');
  }
}).listen(port, () => {
  console.log(`aima is running at http://localhost:${port}/`);
});
