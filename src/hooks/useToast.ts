/**
 * Тост — всплывающее сообщение снизу.
 *
 * Используется для «Не хватает монет» и «Подсказка применена» (Шаг 3),
 * а также для служебных подсказок на промежуточных шагах.
 * Никаких зависимостей: одно сообщение, автоскрытие, повторный показ
 * перезапускает таймер и анимацию.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/** Длительность показа по умолчанию, мс. */
const DEFAULT_DURATION_MS = 2000;

export interface ToastMessage {
  /** Уникальный id — чтобы React пересоздал узел и анимация проигралась заново. */
  readonly id: number;
  readonly text: string;
}

export interface UseToastResult {
  readonly toast: ToastMessage | null;
  readonly showToast: (text: string) => void;
}

/** Очередь из одного сообщения: новое вытесняет предыдущее. */
export function useToast(durationMs: number = DEFAULT_DURATION_MS): UseToastResult {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const timer = useRef<number | null>(null);
  const nextId = useRef(0);

  const clear = useCallback((): void => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => clear, [clear]);

  const showToast = useCallback(
    (text: string): void => {
      clear();
      nextId.current += 1;
      setToast({ id: nextId.current, text });
      timer.current = window.setTimeout(() => {
        timer.current = null;
        setToast(null);
      }, durationMs);
    },
    [clear, durationMs],
  );

  return { toast, showToast };
}
