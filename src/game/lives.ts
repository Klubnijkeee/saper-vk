/**
 * Жизни: попытки кампании, которые восстанавливаются со временем.
 *
 * Модель простая и воспроизводимая: храним число жизней и момент, от которого
 * считаем регенерацию. Никаких таймеров в состоянии — «сколько накапало»
 * считается функцией от `now`, поэтому перезагрузка страницы ничего не ломает,
 * а часы можно переводить в любую сторону без отрицательных значений.
 */

/** Сколько жизней максимум. */
export const MAX_LIVES = 5;
/** Через сколько восстанавливается одна жизнь. */
export const LIFE_REGEN_MS = 8 * 60 * 1000;
/** Цена одной жизни в звёздах. */
export const LIFE_PRICE_STARS = 12;

/** Состояние жизней. */
export interface LivesState {
  readonly lives: number;
  /** Момент, от которого считаем регенерацию. */
  readonly updatedAt: number;
}

/** Полный набор жизней. */
export const FULL_LIVES: LivesState = { lives: MAX_LIVES, updatedAt: 0 };

function clamp(value: number): number {
  if (!Number.isFinite(value)) return MAX_LIVES;
  return Math.min(MAX_LIVES, Math.max(0, Math.floor(value)));
}

/**
 * Начислить всё, что успело восстановиться к моменту `now`.
 *
 * Если жизни полны, отсчёт не копим: иначе после траты жизнь вернулась бы
 * мгновенно. Возвращает тот же объект, когда менять нечего.
 */
export function refreshLives(state: LivesState, now: number): LivesState {
  const lives = clamp(state.lives);

  if (lives >= MAX_LIVES) {
    // На полном наборе момент отсчёта не важен: держим тот же объект,
    // чтобы тик регенерации не перерисовывал приложение и не писал в хранилище.
    return state.lives === MAX_LIVES ? state : { lives: MAX_LIVES, updatedAt: now };
  }

  // Время могло уйти назад (часы переставили) — просто начинаем отсчёт заново.
  if (!Number.isFinite(state.updatedAt) || now <= state.updatedAt) {
    return { lives, updatedAt: now };
  }

  const gained = Math.floor((now - state.updatedAt) / LIFE_REGEN_MS);
  if (gained <= 0) return lives === state.lives ? state : { lives, updatedAt: state.updatedAt };

  const next = Math.min(MAX_LIVES, lives + gained);
  return {
    lives: next,
    updatedAt: next >= MAX_LIVES ? now : state.updatedAt + gained * LIFE_REGEN_MS,
  };
}

/** Сколько миллисекунд до следующей жизни; `null` — жизни полны. */
export function msUntilNextLife(state: LivesState, now: number): number | null {
  const current = refreshLives(state, now);
  if (current.lives >= MAX_LIVES) return null;
  return Math.max(0, current.updatedAt + LIFE_REGEN_MS - now);
}

/** Потратить жизнь (проигрыш). Если жизней нет — состояние не меняется. */
export function spendLife(state: LivesState, now: number): LivesState {
  const current = refreshLives(state, now);
  if (current.lives <= 0) return current;

  return {
    lives: current.lives - 1,
    // Отсчёт начинается с момента, когда жизни перестали быть полными.
    updatedAt: current.lives >= MAX_LIVES ? now : current.updatedAt,
  };
}

/** Добавить жизни (покупка за звёзды). */
export function addLives(state: LivesState, count: number, now: number): LivesState {
  const current = refreshLives(state, now);
  const lives = clamp(current.lives + count);

  return {
    lives,
    updatedAt: lives >= MAX_LIVES ? now : current.updatedAt,
  };
}

/** Можно ли начинать партию. */
export function canSpendLife(state: LivesState, now: number): boolean {
  return refreshLives(state, now).lives > 0;
}

/** Подпись времени до следующей жизни: «8:05». */
export function formatWaiting(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
