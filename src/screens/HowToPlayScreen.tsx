/**
 * «Как играть»: короткая инструкция из четырёх шагов.
 */

import type { ReactElement } from 'react';
import { ScreenShell } from '../components/ScreenShell';

export interface HowToPlayScreenProps {
  readonly onBack: () => void;
}

const STEPS: readonly { readonly title: string; readonly text: string }[] = [
  {
    title: 'Открывайте клетки',
    text: 'Тап по закрытой клетке открывает её. Цифра показывает, сколько мин среди восьми соседних клеток.',
  },
  {
    title: 'Ставьте флажки',
    text: 'Удержание пальца (или правая кнопка мыши) помечает клетку флажком. На уже открытую клетку флажок не ставится.',
  },
  {
    title: 'Доверьтесь каскаду',
    text: 'Если рядом с клеткой мин нет, она раскроется вместе с соседями. Первый ход всегда безопасен: мины расставляются после него.',
  },
  {
    title: 'Побеждайте и копите',
    text: 'Победа — когда открыты все безопасные клетки. За каждую открытую клетку идёт монета, за победу — бонус. Монеты тратятся в магазине подсказок: подсветить мину, открыть клетку или убрать мину с поля.',
  },
];

export function HowToPlayScreen({ onBack }: HowToPlayScreenProps): ReactElement {
  return (
    <ScreenShell title="Как играть" subtitle="Четыре шага до первой победы" onBack={onBack}>
      <ol className="steps">
        {STEPS.map((step, index) => (
          <li key={step.title} className="step">
            <span className="step__number" aria-hidden="true">
              {index + 1}
            </span>
            <span className="step__text">
              <span className="step__title">{step.title}</span>
              <span className="step__description">{step.text}</span>
            </span>
          </li>
        ))}
      </ol>

      <p className="note">
        Подсказки стоят монет: «Показать мину» — 50, «Открыть клетку» — 30, «Убрать мину» — 100.
        Если монет не хватает, кнопка в магазине остаётся серой.
      </p>
    </ScreenShell>
  );
}
