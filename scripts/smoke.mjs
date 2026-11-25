/**
 * Дымовой тест прод-сборки: открываем адрес в headless Chrome, слушаем ошибки
 * и смотрим, отрисовалось ли приложение.
 *
 * Зачем отдельный инструмент: локальная сборка проверок не заменяет. В ВК
 * приложение живёт в iframe, а между публикацией и клиентом стоит кеш Pages —
 * поэтому важно проверять именно боевой адрес и именно чужими глазами.
 *
 * Запуск: node scripts/smoke.mjs https://example.com/ [screenshot.png]
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.argv[2] ?? 'http://127.0.0.1:4173';
const shotPath = process.argv[3] ?? null;
/**
 * Необязательный прогресс для проверки: `ключ=значение,ключ=значение`.
 * Формат без кавычек и JSON — так его удобно передавать из любой оболочки.
 */
const storageSpec = process.argv[4] ?? null;
const DEBUG_PORT = 9337;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

const profile = mkdtempSync(join(tmpdir(), 'saper-smoke-'));
const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${DEBUG_PORT}`,
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--hide-scrollbars',
  'about:blank',
], { stdio: 'ignore' });

let socket;
let nextId = 1;
const pending = new Map();
const errors = [];
const consoleErrors = [];
const failedRequests = [];

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
          if (typeof message.id === 'number') {
            const entry = pending.get(message.id);
            if (entry === undefined) return;
            pending.delete(message.id);
            if (message.error !== undefined) entry.reject(new Error(JSON.stringify(message.error)));
            else entry.resolve(message.result);
            return;
          }
          if (message.method === 'Runtime.exceptionThrown') {
            const details = message.params.exceptionDetails;
            errors.push(details.exception?.description ?? details.text);
          }
          if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
            consoleErrors.push(
              message.params.args.map((arg) => arg.description ?? arg.value ?? '').join(' '),
            );
          }
          if (message.method === 'Network.loadingFailed') {
            failedRequests.push(
              `${message.params.type} ${message.params.errorText} ${message.params.blockedReason ?? ''}`,
            );
          }
          if (message.method === 'Network.responseReceived') {
            const status = message.params.response.status;
            if (status >= 400) failedRequests.push(`${status} ${message.params.response.url}`);
          }
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
  if (result.exceptionDetails !== undefined) return `ОШИБКА: ${result.exceptionDetails.text}`;
  return result.result.value;
}

try {
  await connect();
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });

  await send('Page.navigate', { url });
  await sleep(4000);

  // Если задан прогресс — подставляем его и перезагружаем страницу: так видно
  // не первый запуск с обучением, а игру с уровнями, жизнями и темами.
  if (storageSpec !== null) {
    const writes = storageSpec
      .split(',')
      .map((pair) => pair.split('='))
      .filter(([key]) => key !== undefined && key !== '')
      .map(([key, value]) => `localStorage.setItem('saper:${key}', ${JSON.stringify(value ?? '')});`)
      .join(' ');
    await evaluate(`(() => { ${writes} })()`);
    await send('Page.navigate', { url });
    await sleep(4000);
  }

  const report = {
    url,
    title: await evaluate('document.title'),
    scripts: await evaluate('[...document.querySelectorAll("script[src]")].map(s => s.src)'),
    rootChildren: await evaluate('document.getElementById("root")?.childElementCount ?? -1'),
    app: await evaluate('document.querySelector(".app") !== null'),
    screens: await evaluate('document.querySelectorAll(".screen, .game").length'),
    cells: await evaluate('document.querySelectorAll(".cell").length'),
    bodyText: await evaluate('(document.body.innerText || "").slice(0, 200)'),
  };

  console.log('=== отчёт ===');
  for (const [key, value] of Object.entries(report)) {
    console.log(`${key}: ${JSON.stringify(value)}`);
  }
  console.log(`ошибки страницы: ${errors.length === 0 ? 'нет' : ''}`);
  for (const error of errors) console.log(`  • ${error.split('\n')[0]}`);
  console.log(`ошибки консоли: ${consoleErrors.length === 0 ? 'нет' : ''}`);
  for (const error of consoleErrors) console.log(`  • ${error.slice(0, 200)}`);
  console.log(`сетевые неудачи: ${failedRequests.length === 0 ? 'нет' : ''}`);
  for (const failure of failedRequests) console.log(`  • ${failure}`);

  if (shotPath !== null) {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(shotPath, Buffer.from(shot.data, 'base64'));
    console.log(`скриншот: ${shotPath}`);
  }

  const ok = errors.length === 0 && failedRequests.length === 0 && report.app === true;
  console.log(ok ? '\nДЫМ OK: приложение отрисовалось' : '\nДЫМ ПРОВАЛЕН');
  process.exitCode = ok ? 0 : 1;
} finally {
  try { socket?.close(); } catch { /* уже закрыт */ }
  chrome.kill();
  await sleep(400);
  rmSync(profile, { recursive: true, force: true });
}
