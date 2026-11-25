/**
 * Проверка анимированной иконки: рендерим Lottie в настоящем Chrome.
 *
 * Зачем: JSON может быть валидным по схеме и при этом не рисоваться —
 * например, если слой перекрыт, дуга не обрезана или цвет ушёл в прозрачность.
 * Единственный способ это увидеть — отдать файл реальному плееру (lottie-web)
 * и снять кадры.
 *
 * Что проверяется:
 *   • файл парсится и рисуется без ошибок плеера;
 *   • на кадре есть плашка, красное кольцо и белые шипы;
 *   • кадры отличаются друг от друга (анимация действительно идёт);
 *   • размер файла в лимите панели ВК (24 КБ).
 *
 * Запуск: node scripts/verify-lottie.mjs [--keep]
 */

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const JSON_PATH = join(ROOT, 'art', 'icon-loading-96.json');
const OUT_DIR = join(ROOT, 'art', 'preview-loading');
const PORT = 4399;
const DEBUG_PORT = 9333;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const LIMIT_BYTES = 24 * 1024;

/** Кадры, которые снимаем: начало, середина оборота, конец и пульс. */
const FRAMES = [0, 8, 15, 23, 30, 38, 45, 53];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const PAGE = `<!doctype html>
<html lang="ru">
<head><meta charset="utf-8"><title>Lottie</title>
<style>html,body{margin:0;padding:0;background:#121212}svg{display:block}</style>
</head>
<body>
<div id="icon" style="width:96px;height:96px"></div>
<script src="/node_modules/lottie-web/build/player/lottie.min.js"></script>
<script>
  window.__errors = [];
  window.addEventListener('error', (event) => window.__errors.push(String(event.message)));
  fetch('/art/icon-loading-96.json')
    .then((response) => response.json())
    .then((data) => {
      window.__animation = lottie.loadAnimation({
        container: document.getElementById('icon'),
        renderer: 'svg',
        loop: true,
        autoplay: false,
        animationData: data,
      });
      window.__ready = true;
    })
    .catch((error) => { window.__errors.push(String(error)); window.__ready = true; });
</script>
</body>
</html>`;

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

// ── Статический сервер: отдаёт страницу, JSON и сам lottie-web ───────────────

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://127.0.0.1:${PORT}`);
  if (url.pathname === '/__lottie.html') {
    response.writeHead(200, { 'content-type': MIME['.html'] });
    response.end(PAGE);
    return;
  }
  try {
    const file = join(ROOT, decodeURIComponent(url.pathname));
    const body = readFileSync(file);
    response.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404).end('not found');
  }
});

await new Promise((done) => server.listen(PORT, '127.0.0.1', done));

// ── Chrome ──────────────────────────────────────────────────────────────────

const profile = mkdtempSync(join(tmpdir(), 'saper-lottie-'));
const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${DEBUG_PORT}`,
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--hide-scrollbars',
  '--disable-extensions',
  `http://127.0.0.1:${PORT}/__lottie.html`,
], { stdio: 'ignore' });

let socket;
let nextId = 1;
const pending = new Map();

function send(method, params = {}) {
  const id = nextId;
  nextId += 1;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
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
          if (typeof message.id !== 'number') return;
          const entry = pending.get(message.id);
          if (entry === undefined) return;
          pending.delete(message.id);
          if (message.error !== undefined) entry.reject(new Error(JSON.stringify(message.error)));
          else entry.resolve(message.result);
        });
        return;
      }
    } catch {
      // Chrome ещё поднимается — пробуем снова
    }
    await sleep(250);
  }
  throw new Error('CDP: Chrome не поднялся');
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails !== undefined) {
    throw new Error(`Страница: ${result.exceptionDetails.text} ${result.exceptionDetails.exception?.description ?? ''}`);
  }
  return result.result.value;
}

const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

try {
  await connect();
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 96, height: 96, deviceScaleFactor: 4, mobile: false,
  });

  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await evaluate('window.__ready === true')) break;
    await sleep(100);
  }

  const errors = await evaluate('window.__errors');
  check(Array.isArray(errors) && errors.length === 0, `ошибки страницы: ${JSON.stringify(errors)}`);

  const structure = await evaluate(`(() => {
    const svg = document.querySelector('#icon svg');
    if (svg === null) return { drawn: false };
    return {
      drawn: true,
      width: svg.getAttribute('width'),
      height: svg.getAttribute('height'),
      nodes: svg.querySelectorAll('path,ellipse,circle,rect').length,
      frames: window.__animation ? window.__animation.totalFrames : null,
    };
  })()`);

  check(structure.drawn === true, 'SVG не отрисован');
  check(structure.width === '96' && structure.height === '96', `холст SVG: ${structure.width}×${structure.height}`);
  check(structure.frames === 60, `кадров в анимации: ${structure.frames}`);

  // Пиксельная проверка: раскрашиваем SVG в canvas и считаем цвета.
  // Надёжнее, чем читать computed style — проверяет то, что реально видно.
  const pixels = await evaluate(`(async () => {
    const svg = document.querySelector('#icon svg');
    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const source = new XMLSerializer().serializeToString(clone);
    const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml' }));
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('SVG не загрузился в canvas'));
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = 96;
    canvas.height = 96;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, 96, 96);
    URL.revokeObjectURL(url);
    const data = context.getImageData(0, 0, 96, 96).data;
    let red = 0, white = 0, plate = 0, sumX = 0, sumY = 0;
    for (let index = 0; index < data.length; index += 4) {
      const r = data[index], g = data[index + 1], b = data[index + 2], a = data[index + 3];
      if (a < 40) continue;
      const x = (index / 4) % 96, y = Math.floor(index / 4 / 96);
      if (r > 200 && g < 130 && b < 130) red += 1;
      else if (r > 200 && g > 200 && b > 200) white += 1;
      else if (Math.abs(r - 26) < 8 && Math.abs(g - 26) < 8 && Math.abs(b - 26) < 8) {
        plate += 1;
        sumX += x;
        sumY += y;
      }
    }
    return { red, white, plate, cx: plate ? sumX / plate : 0, cy: plate ? sumY / plate : 0 };
  })()`);

  check(pixels.red > 40, `красных пикселей кольца мало: ${pixels.red}`);
  check(pixels.white > 60, `белых пикселей шипов мало: ${pixels.white}`);
  check(pixels.plate > 2000, `плашки на кадре мало: ${pixels.plate}`);
  check(
    Math.abs(pixels.cx - 48) < 3 && Math.abs(pixels.cy - 48) < 3,
    `плашка не по центру: ${pixels.cx.toFixed(1)}, ${pixels.cy.toFixed(1)}`,
  );

  mkdirSync(OUT_DIR, { recursive: true });
  const shots = [];
  for (const frame of FRAMES) {
    await evaluate(`window.__animation.goToAndStop(${frame}, true)`);
    await sleep(60);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(shot.data, 'base64');
    const name = `frame-${String(frame).padStart(2, '0')}.png`;
    writeFileSync(join(OUT_DIR, name), buffer);
    shots.push({ frame, buffer });
  }

  // Кадры должны отличаться: если анимация не идёт, все PNG совпадут побайтно.
  const distinct = new Set(shots.map((shot) => shot.buffer.toString('base64'))).size;
  check(distinct >= 4, `кадры почти не отличаются: уникальных ${distinct} из ${shots.length}`);

  const size = readFileSync(JSON_PATH).length;
  check(size <= LIMIT_BYTES, `размер ${(size / 1024).toFixed(1)} КБ больше лимита 24 КБ`);

  console.log(`кадров снято: ${shots.length} (уникальных ${distinct})`);
  console.log(`структура SVG: ${structure.nodes} узлов, ${structure.frames} кадров, 96×96`);
  console.log(`пиксели: кольцо ${pixels.red}, шипы ${pixels.white}, плашка ${pixels.plate} `
    + `(центр ${pixels.cx.toFixed(1)}, ${pixels.cy.toFixed(1)})`);
  console.log(`размер JSON: ${(size / 1024).toFixed(1)} КБ из 24 КБ`);
  console.log(`кадры: ${OUT_DIR}`);
} finally {
  try { socket?.close(); } catch { /* уже закрыт */ }
  chrome.kill();
  server.close();
  await sleep(400);
  rmSync(profile, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error('\nПРОВЕРКИ НЕ ПРОЙДЕНЫ:');
  for (const failure of failures) console.error(`  • ${failure}`);
  process.exit(1);
}

console.log('\nвсе проверки Lottie пройдены');
