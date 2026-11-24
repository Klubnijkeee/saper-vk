/**
 * Снимки состояний интерфейса через Chrome DevTools Protocol.
 *
 * Зачем отдельный инструмент: `chrome --screenshot` не даёт мобильной эмуляции,
 * поэтому layout-вьюпорт получается шире кадра и картинка обрезается справа.
 * Здесь мы явно задаём телефонный вьюпорт (390×844, DPR 2, mobile: true) —
 * то же, что видит игрок в веб-вью ВКонтакте, — печатаем фактические размеры
 * узлов и проверяем то, что юнит-тестом не проверить: прогресс переживает
 * перезагрузку страницы.
 *
 * Запуск (Chrome уже поднят с --remote-debugging-port=9222,
 * сборка сделана с VITE_DEV_BRIDGE=1):
 *   node scripts/screenshot.mjs http://127.0.0.1:4173 screenshots
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:4173';
const outDir = process.argv[3] ?? 'screenshots';
const devtoolsUrl = process.argv[4] ?? 'http://127.0.0.1:9222';

/** Телефонный вьюпорт: iPhone 12/13/14 в веб-вью. */
const VIEWPORT = { width: 390, height: 844, deviceScaleFactor: 2, mobile: true };

const SCENARIOS = [
  { name: '01-start', query: '', waitMs: 700 },
  { name: '02-cascade', query: '?dev=play', waitMs: 1000 },
  { name: '03-flag', query: '?dev=flag', waitMs: 1000 },
  { name: '04-boom', query: '?dev=lose', waitMs: 3400 },
  { name: '05-boom-field', query: '?dev=lose-peek', waitMs: 4400 },
  { name: '06-win', query: '?dev=win', waitMs: 3400 },
  { name: '07-win-field', query: '?dev=win-peek', waitMs: 4400 },
  { name: '08-pause', query: '?dev=pause', waitMs: 2200 },
  // Магазин: все три подсказки доступны (монет хватает после победы).
  { name: '09-shop-all', query: '?dev=shop-all', waitMs: 4200 },
  // Подсказка «Показать мину»: снимок сделан в середине 2-секундной пульсации.
  { name: '10-hint-show', query: '?dev=hint-show', waitMs: 5000 },
  // Подсказка «Убрать мину»: снимок сделан в момент белого дымка.
  { name: '11-hint-remove', query: '?dev=hint-remove', waitMs: 4950 },
  // Выключаем звук и проверяем, что настройка попала в хранилище.
  { name: '12-sound-off', query: '?dev=sound-off', waitMs: 1800 },
  // Свежая загрузка страницы: настройка должна подхватиться из хранилища.
  { name: '13-sound-persisted', query: '?dev=pause', waitMs: 2200 },
];

const DIAGNOSTICS = `(() => {
  const style = (selector) => {
    const element = document.querySelector(selector);
    return element === null ? null : getComputedStyle(element).width;
  };
  const read = (key) => localStorage.getItem('saper:' + key);
  const raw = window.__SAPER__ ? window.__SAPER__.getState() : null;
  return {
    innerWidth,
    scrollWidth: document.body.scrollWidth,
    board: style('.board'),
    cell: style('.cell'),
    statusbar: style('.statusbar'),
    cells: document.querySelectorAll('.cell').length,
    state: raw === null ? null : {
      coins: raw.coins,
      level: raw.level,
      bestTime: raw.bestTime,
      status: raw.status,
      minesRemoved: raw.minesRemoved,
    },
    stored: {
      coins: read('coins'),
      level: read('level'),
      bestTime: read('bestTime'),
      soundEnabled: read('soundEnabled'),
    },
  };
})()`;

const list = await fetch(`${devtoolsUrl}/json/list`).then((response) => response.json());
const page = list.find((target) => target.type === 'page');
if (page === undefined) throw new Error('CDP: не найдено ни одной открытой страницы');

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', () => resolve(), { once: true });
  socket.addEventListener('error', () => reject(new Error('CDP: не удалось подключиться')), {
    once: true,
  });
});

let nextId = 1;
const pending = new Map();

socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (typeof message.id !== 'number') return;
  const entry = pending.get(message.id);
  if (entry === undefined) return;
  pending.delete(message.id);
  if (message.error !== undefined) entry.reject(new Error(JSON.stringify(message.error)));
  else entry.resolve(message.result);
});

function send(method, params = {}) {
  const id = nextId;
  nextId += 1;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Выполнить выражение на странице и вернуть результат. */
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true });
  return result.result.value;
}

/** Открыть страницу и дать приложению смонтироваться. */
async function openPage(url) {
  await send('Page.navigate', { url });
  await sleep(900);
}

/** Снять состояние: диагностика в консоль + PNG в каталог. */
async function shoot(name) {
  const diagnostics = await evaluate(DIAGNOSTICS);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(outDir, `${name}.png`), Buffer.from(shot.data, 'base64'));
  console.log(`${name}: ${JSON.stringify(diagnostics)}`);
  return diagnostics;
}

function check(condition, message) {
  if (!condition) throw new Error(`Проверка: ${message}`);
}

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', VIEWPORT);

mkdirSync(outDir, { recursive: true });

// Чистим сохранённый прогресс, чтобы проверки начинались с нуля.
// После очистки обязательно перезагружаем страницу: иначе приложение
// продолжит работать с состоянием из памяти и снова запишет его в хранилище.
await openPage(`${baseUrl}/`);
await evaluate('localStorage.clear()');
await openPage(`${baseUrl}/`);

for (const scenario of SCENARIOS) {
  await send('Page.navigate', { url: `${baseUrl}/${scenario.query}` });
  await sleep(scenario.waitMs);
  await shoot(scenario.name);
}

// ── Прогресс: проверяем перезагрузкой страницы ────────────────────────────────
//
// Сценарии выше сами выигрывают уровни, поэтому хранилище чистим ещё раз:
// цепочка должна начинаться с 1-го уровня и нуля монет. После очистки
// перезагружаем страницу — иначе приложение перезапишет хранилище состоянием
// из памяти.
await openPage(`${baseUrl}/`);
await evaluate('localStorage.clear()');
const fresh = await openPage(`${baseUrl}/`).then(() => shoot('14-progress-start'));
check(fresh.state.level === 1, `уровень после очистки: ${fresh.state.level}`);
check(fresh.state.coins === 0, `монеты после очистки: ${fresh.state.coins}`);

// 1. Открыли клетку → монеты начислились и сохранились.
await evaluate('window.__SAPER__.reveal(40)');
await sleep(900);
const afterMove = await shoot('15-coins-after-move');
check(afterMove.state.coins > 0, `монеты не начислились (${afterMove.state.coins})`);

await openPage(`${baseUrl}/`);
const coinsReload = await shoot('16-coins-after-reload');
check(
  coinsReload.state.coins === afterMove.state.coins,
  `монеты не пережили перезагрузку: ${afterMove.state.coins} → ${coinsReload.state.coins}`,
);

// 2. Победили на 1-м уровне → сохранились уровень 2 и рекорд.
// Побеждаем сценарием с реальным игровым отрезком, чтобы рекорд в кадре
// был осмысленным (а не «00:00»).
await send('Page.navigate', { url: `${baseUrl}/?dev=win` });
await sleep(3400);
const won = await shoot('17-win-saved');
check(won.state.status === 'won', `партия не выиграна (${won.state.status})`);

await openPage(`${baseUrl}/`);
const winReload = await shoot('18-win-after-reload');
check(winReload.state.level === 2, `уровень не сохранился: ${winReload.state.level}`);
check(
  typeof winReload.state.bestTime === 'number' && winReload.state.bestTime > 0,
  `рекорд не сохранился: ${winReload.state.bestTime}`,
);
check(
  winReload.state.coins === won.state.coins,
  `монеты после победы не пережили перезагрузку: ${won.state.coins} → ${winReload.state.coins}`,
);

// 3. Потратили 100 монет на «Убрать мину» → монеты уменьшились ровно на 100.
await evaluate('window.__SAPER__.reveal(40)');
await sleep(900);
const coinsBeforeSpend = await evaluate('window.__SAPER__.getState().coins');
await evaluate("window.__SAPER__.applyHint('remove-mine')");
await sleep(500);
const spent = await shoot('19-coins-after-spend');
check(
  spent.state.coins === coinsBeforeSpend - 100,
  `списано не 100 монет: ${coinsBeforeSpend} → ${spent.state.coins}`,
);
check(spent.state.minesRemoved === 1, `подсказка не применилась (${spent.state.minesRemoved})`);

await openPage(`${baseUrl}/`);
const spendReload = await shoot('20-coins-after-spend-reload');
check(
  spendReload.state.coins === spent.state.coins,
  `монеты после траты не пережили перезагрузку: ${spent.state.coins} → ${spendReload.state.coins}`,
);
check(spendReload.state.level === 2, `уровень изменился без победы: ${spendReload.state.level}`);

console.log('\nвсе проверки прогресса пройдены');

socket.close();
console.log('готово');
