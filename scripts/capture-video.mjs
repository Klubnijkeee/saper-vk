/**
 * Запись промовидео: играем в настоящее приложение и снимаем кадры.
 *
 * Схема: поднимаем статический сервер над dist/ (там сборка с включённым
 * отладочным мостом `window.__SAPER__`), открываем приложение в headless Chrome
 * с телефонным вьюпортом 360×640 и кратностью 2 (`--force-device-scale-factor=2`),
 * включаем CDP-скринкаст и прогоняем партию: каскад, подсказка, победа,
 * следующий уровень.
 *
 * Про кратность: кратный размер задаётся именно флагом Chrome. Скринкаст
 * в headless отдаёт кадр в CSS-пикселях и `deviceScaleFactor` из эмуляции
 * игнорирует; при кратности 3 кадр получается 1080×1920, но headless рисует
 * его программно и частота падает до ~3 к/с. Кратность 2 даёт честные
 * 720×1280 при ~30 к/с — движение плавное, а апскейл до 1080×1920 делает
 * ffmpeg уже на сборке (scripts/make-video.py).
 *
 * Кадры складываются в .video-work/frames вместе с manifest.json (таймкоды).
 *
 * Запуск: node scripts/capture-video.mjs
 */

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const DIST = join(ROOT, 'dist');
const WORK = join(ROOT, '.video-work');
const FRAMES = join(WORK, 'frames');
const PORT = 4174;
const DEBUG_PORT = 9336;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

/** Телефонный вьюпорт: 360×640 — раскладка как на настоящем телефоне. */
const VIEWPORT = { width: 360, height: 640, deviceScaleFactor: 1, mobile: true };

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

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

if (!existsSync(join(DIST, 'index.html'))) {
  throw new Error('нет сборки в dist/: соберите проект с VITE_DEV_BRIDGE=1');
}

// ── Статический сервер над dist/ ────────────────────────────────────────────

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://127.0.0.1:${PORT}`);
  const path = decodeURIComponent(url.pathname);
  const file = path === '/' ? join(DIST, 'index.html') : join(DIST, path);

  try {
    const body = readFileSync(file);
    response.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    // одностраничное приложение: всё неизвестное отдаём как index.html
    response.writeHead(200, { 'content-type': MIME['.html'] });
    response.end(readFileSync(join(DIST, 'index.html')));
  }
});

await new Promise((done) => server.listen(PORT, '127.0.0.1', done));

// ── Chrome и CDP ────────────────────────────────────────────────────────────

const profile = mkdtempSync(join(tmpdir(), 'saper-video-'));
const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${DEBUG_PORT}`,
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--hide-scrollbars',
  '--disable-extensions',
  '--autoplay-policy=no-user-gesture-required',
  '--force-device-scale-factor=2',
  'about:blank',
], { stdio: 'ignore' });

let socket;
let nextId = 1;
const pending = new Map();
const listeners = new Map();

function send(method, params = {}) {
  const id = nextId;
  nextId += 1;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

function on(event, handler) {
  const list = listeners.get(event) ?? [];
  list.push(handler);
  listeners.set(event, list);
}

async function connect() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const list = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`).then((r) => r.json());
      const page = list.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
      if (page !== undefined) {
        socket = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => {
          socket.addEventListener('open', () => resolve(), { once: true });
          socket.addEventListener('error', () => reject(new Error('CDP: нет соединения')), { once: true });
        });
        socket.addEventListener('message', (event) => {
          const message = JSON.parse(event.data);
          if (typeof message.id === 'number') {
            const entry = pending.get(message.id);
            if (entry === undefined) return;
            pending.delete(message.id);
            if (message.error !== undefined) entry.reject(new Error(JSON.stringify(message.error)));
            else entry.resolve(message.result);
            return;
          }
          for (const handler of listeners.get(message.method) ?? []) handler(message.params);
        });
        return;
      }
    } catch {
      // Chrome ещё поднимается
    }
    await sleep(250);
  }
  throw new Error('CDP: Chrome не поднялся');
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails !== undefined) {
    throw new Error(`Страница: ${result.exceptionDetails.text}`);
  }
  return result.result.value;
}

/** Вызвать метод отладочного моста на странице. */
async function bridge(method, ...args) {
  const argsList = args.map((value) => JSON.stringify(value)).join(', ');
  return evaluate(`window.__SAPER__.${method}(${argsList})`);
}

/**
 * Индекс закрытой клетки, которая точно безопасна (и уже даёт цифру).
 * Важно: вызывать только после первого клика — до него мины ещё не расставлены
 * и любая клетка «выглядит» безопасной.
 */
async function safeCellIndex() {
  return evaluate(`(() => {
    const state = window.__SAPER__.getState();
    const cell = state.board.find(
      (item) => !item.hasMine && item.state === 'hidden' && item.adjacentMines > 0,
    );
    return cell === undefined ? -1 : cell.index;
  })()`);
}

/** Открыть безопасную клетку (для промо — никаких случайных мин). */
async function revealSafeCell() {
  const index = await safeCellIndex();
  if (typeof index === 'number' && index >= 0) await bridge('reveal', index);
}

// ── Запись ──────────────────────────────────────────────────────────────────

rmSync(WORK, { recursive: true, force: true });
mkdirSync(FRAMES, { recursive: true });

const captured = [];
let capturing = false;

on('Page.screencastFrame', (params) => {
  if (capturing) {
    const file = `shot-${String(captured.length).padStart(5, '0')}.png`;
    writeFileSync(join(FRAMES, file), Buffer.from(params.data, 'base64'));
    captured.push({ timestamp: params.metadata.timestamp, file });
  }
  void send('Page.screencastFrameAck', { sessionId: params.sessionId }).catch(() => undefined);
});

try {
  await connect();
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', VIEWPORT);

  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` });
  await sleep(1500);

  const ready = await evaluate('typeof window.__SAPER__ === "object"');
  if (!ready) throw new Error('отладочный мост недоступен: соберите dist с VITE_DEV_BRIDGE=1');

  await evaluate('localStorage.clear()');
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` });
  await sleep(1400);

  await send('Page.startScreencast', {
    format: 'png', maxWidth: 720, maxHeight: 1280, everyNthFrame: 1,
  });
  capturing = true;
  await sleep(1200);                       // спокойная доска

  await bridge('reveal', 40);              // первый клик: каскад открывает область
  await sleep(1600);

  // Добираем монеты только безопасными клетками — иначе в кадре будет «Взрыв».
  for (let step = 0; step < 4; step += 1) {
    const coins = await evaluate('window.__SAPER__.getState().coins');
    if (coins >= 60) break;
    await revealSafeCell();
    await sleep(420);
  }

  await revealSafeCell();                  // ещё пара ходов для динамики
  await sleep(700);
  await revealSafeCell();
  await sleep(900);

  await bridge('applyHint', 'show-mine');  // подсветка мины: пауза на 2 секунды
  await sleep(2200);

  await bridge('win');                     // победа: конфетти и экран результата
  await sleep(2600);
  await bridge('nextLevel');               // следующий уровень: новое поле
  await sleep(900);
  await bridge('reveal', 40);
  await sleep(1600);

  capturing = false;
  await send('Page.stopScreencast');

  writeFileSync(join(WORK, 'manifest.json'), JSON.stringify({
    viewport: VIEWPORT,
    frames: captured,
  }, null, 2));

  const duration = captured.length > 1
    ? captured[captured.length - 1].timestamp - captured[0].timestamp
    : 0;
  console.log(`frames: ${captured.length}`);
  console.log(`duration: ${duration.toFixed(1)} s (${(captured.length / duration).toFixed(1)} fps)`);
  console.log(`frames dir: ${FRAMES}`);
} finally {
  try { socket?.close(); } catch { /* уже закрыт */ }
  chrome.kill();
  server.close();
  await sleep(400);
  rmSync(profile, { recursive: true, force: true });
}
