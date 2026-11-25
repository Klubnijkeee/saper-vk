/**
 * Тикающие «текущее время» для интерфейса.
 *
 * Нужен там, где показывается обратный отсчёт (жизни, задачи дня). Держим его
 * на конкретных экранах, а не в корне приложения: иначе игровое поле
 * перерисовывалось бы каждую секунду.
 */

import { useEffect, useState } from 'react';

export function useNow(intervalMs: number = 1000): number {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, intervalMs);
    return () => {
      window.clearInterval(timer);
    };
  }, [intervalMs]);

  return now;
}
