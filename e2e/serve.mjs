// Serves the built site for e2e/consent.spec.mjs the way GitHub Pages does with trailingSlash false:
// /a/b answers build/a/b.html, then build/a/b/index.html. Usage: node e2e/serve.mjs <dir> <port>
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(process.argv[2] || 'build');
const port = Number(process.argv[3] || 4173);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
};

function find(pathname) {
  const clean = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  const base = join(root, clean);
  if (!base.startsWith(root)) return null;
  for (const candidate of [base, `${base}.html`, join(base, 'index.html')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

createServer((request, response) => {
  const file = find(new URL(request.url, 'http://localhost').pathname);
  if (!file) {
    const notFound = join(root, '404.html');
    response.writeHead(404, { 'content-type': TYPES['.html'] });
    response.end(existsSync(notFound) ? readFileSync(notFound) : 'Not found');
    return;
  }
  response.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
  response.end(readFileSync(file));
}).listen(port, '127.0.0.1', () => console.log(`serving ${root} on http://127.0.0.1:${port}`));
