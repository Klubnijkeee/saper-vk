/**
 * Мини-сервер над dist/ для локальных проверок: скриншотов и ручного просмотра.
 *
 * `vite preview` для этого не годится: он поднимает esbuild, а тот в песочнице
 * не может порождать дочерние процессы. Здесь только чтение файлов.
 *
 * Запуск: node scripts/serve-dist.mjs [порт]
 */

import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const DIST = join(ROOT, 'dist');
const PORT = Number(process.argv[2] ?? 4173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

if (!existsSync(join(DIST, 'index.html'))) {
  throw new Error('нет сборки в dist/: сначала соберите проект');
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://127.0.0.1:${PORT}`);
  const path = decodeURIComponent(url.pathname);
  const file = path === '/' ? join(DIST, 'index.html') : join(DIST, path);

  try {
    const body = readFileSync(file);
    response.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    // одностраничное приложение: неизвестный путь отдаём как index.html
    response.writeHead(200, { 'content-type': MIME['.html'] });
    response.end(readFileSync(join(DIST, 'index.html')));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`dist на http://127.0.0.1:${PORT}`);
});
