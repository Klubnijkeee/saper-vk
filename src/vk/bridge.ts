/**
 * Мост во ВКонтакте: инициализация Mini App и низкоуровневые обёртки над
 * `VKWebAppStorage`.
 *
 * Ключевое требование ТЗ: приложение обязано работать и вне ВКонтакте.
 * Поэтому инициализация не блокирует запуск (с таймаутом), а все ошибки моста
 * глушатся — вызывающий код сам решает, что делать (см. `storage.ts`, где есть
 * фолбэк на localStorage).
 */

import bridge, { type RequestPropsMap } from '@vkontakte/vk-bridge';

/** Методы моста, которые вызываются без параметров (социальный блок). */
type SimpleMethod = keyof RequestPropsMap;

/** Сколько ждём ответ ВК на VKWebAppInit, прежде чем считать, что мы не в ВК. */
const INIT_TIMEOUT_MS = 2000;

let bridgeReady = false;
let initPromise: Promise<boolean> | null = null;

/** Мост инициализирован (мы внутри ВКонтакте и ВК ответил)? */
export function isBridgeReady(): boolean {
  return bridgeReady;
}

/**
 * Мы внутри фрейма? На десктопе мини-приложение ВКонтакте грузится в `<iframe>`,
 * поэтому в обычном браузере можно сразу переходить на localStorage,
 * не ожидая таймаут моста.
 */
function insideFrame(): boolean {
  try {
    return window.parent !== window;
  } catch {
    // достучаться до parent нельзя → точно внутри чужого фрейма
    return true;
  }
}

/**
 * Похоже, что приложение открыто внутри ВКонтакте?
 *
 * Признак фрейма — основной, но полагаться только на него рискованно: если
 * площадка откроет мобильный WebView без фрейма, мы решим «мы не в ВК», не
 * вызовем `VKWebAppInit` и уведём прогресс в localStorage. Поэтому
 * дополнительно проверяем launch-параметры, которые ВКонтакте всегда
 * добавляет к адресу приложения (`?vk_app_id=…&vk_user_id=…&sign=…`).
 *
 * В обычном браузере оба признака ложны — и мы не ждём таймаут моста.
 * Функция чистая (признаки передаются аргументами), поэтому её легко тестировать.
 */
export function looksLikeVk(input: {
  readonly insideFrame: boolean;
  readonly search: string;
}): boolean {
  if (input.insideFrame) return true;

  const params = new URLSearchParams(input.search);
  return params.has('vk_app_id') || params.has('vk_user_id') || params.has('sign');
}

/**
 * Вызвать `VKWebAppInit` — без него приложение не откроется внутри ВК.
 * Возвращает `true`, если ВК ответил. Вне ВК (или по таймауту) — `false`,
 * и игра продолжает работать на localStorage.
 */
export function initVkBridge(): Promise<boolean> {
  initPromise ??= (async (): Promise<boolean> => {
    if (!looksLikeVk({ insideFrame: insideFrame(), search: window.location.search })) {
      bridgeReady = false;
      return false;
    }

    try {
      await Promise.race([
        bridge.send('VKWebAppInit'),
        new Promise<never>((_resolve, reject) => {
          window.setTimeout(() => {
            reject(new Error('VKWebAppInit: таймаут'));
          }, INIT_TIMEOUT_MS);
        }),
      ]);
      bridgeReady = true;
    } catch {
      bridgeReady = false;
    }
    return bridgeReady;
  })();

  return initPromise;
}

/** Прочитать значения по ключам из VK Storage. Ошибки → пустая карта. */
export async function storageGet(keys: readonly string[]): Promise<ReadonlyMap<string, string>> {
  if (!bridgeReady) return new Map();

  try {
    const response = await bridge.send('VKWebAppStorageGet', { keys: [...keys] });
    const values = new Map<string, string>();
    for (const item of response.keys) {
      values.set(item.key, item.value);
    }
    return values;
  } catch {
    return new Map();
  }
}

/** Записать значения в VK Storage. Ошибки глушим: прогресс не должен ломать игру. */
export async function storageSet(values: Readonly<Record<string, string>>): Promise<void> {
  if (!bridgeReady) return;

  try {
    await Promise.all(
      Object.entries(values).map(([key, value]) =>
        bridge.send('VKWebAppStorageSet', { key, value }),
      ),
    );
  } catch {
    // тишина: не сохранилось — играем дальше
  }
}

/**
 * Действия «социального» блока. Все они доступны только внутри ВКонтакте:
 * вне его мост молчит, и мы просто сообщаем игроку об этом.
 *
 * `true` — ВК принял вызов, `false` — мы не в ВК (или игрок закрыл диалог).
 */
async function callBridge(method: SimpleMethod): Promise<boolean> {
  if (!bridgeReady) return false;

  try {
    await bridge.send(method, {});
    return true;
  } catch {
    return false;
  }
}

/** Пригласить друзей: стандартный диалог ВК. */
export function inviteFriends(): Promise<boolean> {
  return callBridge('VKWebAppShowInviteBox');
}

/** Добавить приложение в избранное — это влияет на возвраты игроков. */
export function addToFavorites(): Promise<boolean> {
  return callBridge('VKWebAppAddToFavorites');
}

/** Попросить разрешение на уведомления. */
export function allowNotifications(): Promise<boolean> {
  return callBridge('VKWebAppAllowNotifications');
}

/** Поделиться ссылкой на приложение (кнопка «Рассказать друзьям»). */
export function shareApp(): Promise<boolean> {
  return callBridge('VKWebAppShare');
}
