/**
 * Иконки интерфейса — инлайновые SVG, без шрифтов и без зависимостей.
 * Цвет наследуется через `currentColor`, поэтому состояние кнопок
 * (активна / неактивна / нажата) описывается одним CSS-правилом.
 */

import type { ReactElement, ReactNode } from 'react';

export interface IconProps {
  /** Сторона иконки в px. */
  readonly size?: number | undefined;
}

function Icon({ size, children }: IconProps & { readonly children: ReactNode }): ReactElement {
  return (
    <svg
      width={size ?? 20}
      height={size ?? 20}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** Мина: чёрный шар с белыми шипами и блик. */
export function MineIcon({ size }: IconProps): ReactElement {
  return (
    <Icon size={size}>
      <g stroke="#FFFFFF" strokeWidth="1.9" strokeLinecap="round" opacity="0.92">
        <path d="M12 1.6v3.6M12 18.8v3.6M1.6 12h3.6M18.8 12h3.6" />
        <path d="M4.6 4.6l2.5 2.5M16.9 16.9l2.5 2.5M19.4 4.6l-2.5 2.5M7.1 16.9l-2.5 2.5" />
      </g>
      <circle cx="12" cy="12" r="6.1" fill="#0B0B0B" stroke="#FFFFFF" strokeWidth="0.9" opacity="0.95" />
      <circle cx="9.9" cy="9.9" r="1.5" fill="#FFFFFF" opacity="0.55" />
    </Icon>
  );
}

/** Флажок: белое полотнище на древке (кладётся на красный фон клетки). */
export function FlagIcon({ size }: IconProps): ReactElement {
  return (
    <Icon size={size}>
      <path d="M7.4 21.2V3.4" stroke="#FFFFFF" strokeWidth="2.3" strokeLinecap="round" />
      <path d="M7.4 4.2h10.4l-3.1 3.6 3.1 3.6H7.4z" fill="#FFFFFF" />
    </Icon>
  );
}

/** Монета. */
export function CoinIcon({ size }: IconProps): ReactElement {
  return (
    <Icon size={size}>
      <circle cx="12" cy="12" r="9.2" fill="#F5B93B" />
      <circle cx="12" cy="12" r="6.7" fill="none" stroke="#B37C11" strokeWidth="1.6" />
      <path
        d="M12 7.4l1.5 3.1 3.4.5-2.5 2.4.6 3.3-3-1.6-3 1.6.6-3.3L7.1 11l3.4-.5z"
        fill="#B37C11"
      />
    </Icon>
  );
}

/** Пауза. */
export function PauseIcon({ size }: IconProps): ReactElement {
  return (
    <Icon size={size}>
      <rect x="7" y="5" width="3.6" height="14" rx="1.6" fill="currentColor" />
      <rect x="13.4" y="5" width="3.6" height="14" rx="1.6" fill="currentColor" />
    </Icon>
  );
}

/** Продолжить (треугольник). */
export function PlayIcon({ size }: IconProps): ReactElement {
  return (
    <Icon size={size}>
      <path d="M8 5.2l11 6.8-11 6.8z" fill="currentColor" />
    </Icon>
  );
}

/** Назад (шеврон). */
export function ChevronLeftIcon({ size }: IconProps): ReactElement {
  return (
    <Icon size={size}>
      <path
        d="M15 4.5L7.8 12l7.2 7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Icon>
  );
}

/** Подсказка «Показать мину»: глаз. */
export function EyeIcon({ size }: IconProps): ReactElement {
  return (
    <Icon size={size}>
      <path
        d="M2.2 12S5.8 5.8 12 5.8 21.8 12 21.8 12 18.2 18.2 12 18.2 2.2 12 2.2 12z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </Icon>
  );
}

/** Подсказка «Открыть клетку»: клетка с искрой. */
export function CellSparkIcon({ size }: IconProps): ReactElement {
  return (
    <Icon size={size}>
      <rect
        x="3.2"
        y="3.2"
        width="13"
        height="13"
        rx="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M18.4 12.6l1.1 2.7 2.7 1.1-2.7 1.1-1.1 2.7-1.1-2.7-2.7-1.1 2.7-1.1z" fill="currentColor" />
    </Icon>
  );
}

/** Подсказка «Убрать мину»: мина со стрелкой вниз (убрать). */
export function MineRemoveIcon({ size }: IconProps): ReactElement {
  return (
    <Icon size={size}>
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M9.4 2.6v2.8M9.4 15v2.8M2.6 9.4h2.8M15 9.4h2.8" />
        <path d="M5 5l2 2M13.8 13.8l2 2M13.8 5l-2 2M7 13.8l-2 2" />
      </g>
      <circle cx="9.4" cy="9.4" r="4.6" fill="currentColor" />
      <path
        d="M16.6 15.6h5.6M19.4 12.8v5.6"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
    </Icon>
  );
}

/** Кубок — экран победы. */
export function TrophyIcon({ size }: IconProps): ReactElement {
  return (
    <Icon size={size}>
      <path d="M7 3.6h10v5.1a5 5 0 01-10 0z" fill="currentColor" />
      <path
        d="M7.1 5.4H4.5a.9.9 0 00-.9.95C3.7 9.1 5.3 10.9 7.5 11M16.9 5.4h2.6c.5 0 .9.42.9.95 0 2.75-1.6 4.55-3.8 4.65"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path d="M12 13.4v3.4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M9.3 16.8h5.4l.7 3.6H8.6z" fill="currentColor" />
    </Icon>
  );
}

/** Звук включён / выключен. */
export function SoundIcon({ size, muted }: IconProps & { readonly muted: boolean }): ReactElement {
  return (
    <Icon size={size}>
      <path d="M4 9.4h3.2L12 5.4v13.2L7.2 14.6H4z" fill="currentColor" />
      {muted ? (
        <path
          d="M15.4 9.6l5 4.8M20.4 9.6l-5 4.8"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
      ) : (
        <g stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round">
          <path d="M15.2 9.4a4 4 0 010 5.2" />
          <path d="M18 7a7.6 7.6 0 010 10" />
        </g>
      )}
    </Icon>
  );
}

/** Стрелка вправо — «перейти на экран». */
export function ChevronRightIcon({ size }: IconProps): ReactElement {
  return (
    <Icon size={size}>
      <path
        d="M9 4.5l7.2 7.5L9 19.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Icon>
  );
}

/** Проверка — «выполнено». */
export function CheckIcon({ size }: IconProps): ReactElement {
  return (
    <Icon size={size}>
      <path
        d="M5 12.8l4.4 4.4L19 7.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Icon>
  );
}

/** Замок — тема или достижение ещё закрыты. */
export function LockIcon({ size }: IconProps): ReactElement {
  return (
    <Icon size={size}>
      <path d="M6.4 10.4h11.2v9.2H6.4z" fill="currentColor" />
      <path
        d="M8.6 10.4V8.2a3.4 3.4 0 016.8 0v2.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Icon>
  );
}

/** Карта — режим «Прохождение». */
export function MapIcon({ size }: IconProps): ReactElement {
  return (
    <Icon size={size}>
      <path
        d="M3 6.4l6-2.4 6 2.4 6-2.4v13.6l-6 2.4-6-2.4-6 2.4z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M9 4v13.6M15 6.4V20" stroke="currentColor" strokeWidth="1.4" />
    </Icon>
  );
}

/** Сетка — сложность «Любитель». */
export function GridIcon({ size }: IconProps): ReactElement {
  return (
    <Icon size={size}>
      <g fill="currentColor">
        <rect x="3.4" y="3.4" width="7.4" height="7.4" rx="2" />
        <rect x="13.2" y="3.4" width="7.4" height="7.4" rx="2" opacity="0.55" />
        <rect x="3.4" y="13.2" width="7.4" height="7.4" rx="2" opacity="0.55" />
        <rect x="13.2" y="13.2" width="7.4" height="7.4" rx="2" />
      </g>
    </Icon>
  );
}

/** Корона — сложность «Профессионал». */
export function CrownIcon({ size }: IconProps): ReactElement {
  return (
    <Icon size={size}>
      <path d="M3 8.4l4 3.2 5-6 5 6 4-3.2-1.8 10.4H4.8z" fill="currentColor" />
    </Icon>
  );
}

/** Искра — сложность «Особый». */
export function SparkIcon({ size }: IconProps): ReactElement {
  return (
    <Icon size={size}>
      <path d="M12 2.4l2.2 6.2 6.2 2.2-6.2 2.2L12 19.2l-2.2-6.2L3.6 10.8l6.2-2.2z" fill="currentColor" />
    </Icon>
  );
}

/** Звезда — премиальная валюта и «Новичок». */
export function StarIcon({ size, filled = true }: IconProps & { readonly filled?: boolean }): ReactElement {
  return (
    <Icon size={size}>
      <path
        d="M12 3.2l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </Icon>
  );
}

/** График — статистика. */
export function ChartIcon({ size }: IconProps): ReactElement {
  return (
    <Icon size={size}>
      <g fill="currentColor">
        <rect x="3.6" y="12.6" width="4.2" height="8" rx="1.4" />
        <rect x="9.9" y="7.6" width="4.2" height="13" rx="1.4" />
        <rect x="16.2" y="4" width="4.2" height="16.6" rx="1.4" />
      </g>
    </Icon>
  );
}

/** Палитра — темы оформления. */
export function PaletteIcon({ size }: IconProps): ReactElement {
  return (
    <Icon size={size}>
      <path
        d="M12 3.4c-4.8 0-8.6 3.6-8.6 8.1 0 4.4 3.4 6.6 6 6.6 1.6 0 2.1-.9 2.1-1.8 0-1.9 1.1-2.6 2.7-2.6h1.9c3 0 5.3-1.6 5.3-4.4 0-3.5-3.7-5.9-9.4-5.9z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <g fill="currentColor">
        <circle cx="8.2" cy="10.4" r="1.5" />
        <circle cx="12" cy="7.8" r="1.5" />
        <circle cx="15.9" cy="10.2" r="1.5" />
      </g>
    </Icon>
  );
}

/** Шестерёнка — настройки. */
export function GearIcon({ size }: IconProps): ReactElement {
  return (
    <Icon size={size}>
      <path
        d="M12 8.4a3.6 3.6 0 100 7.2 3.6 3.6 0 000-7.2zm9 3.6l-2-.4a7 7 0 00-.7-1.8l1.2-1.7-1.4-1.4-1.7 1.2a7 7 0 00-1.8-.7l-.4-2h-2l-.4 2a7 7 0 00-1.8.7L6.9 7.7 5.5 9.1l1.2 1.7a7 7 0 00-.7 1.8l-2 .4v2l2 .4a7 7 0 00.7 1.8l-1.2 1.7 1.4 1.4 1.7-1.2a7 7 0 001.8.7l.4 2h2l.4-2a7 7 0 001.8-.7l1.7 1.2 1.4-1.4-1.2-1.7a7 7 0 00.7-1.8l2-.4z"
        fill="currentColor"
      />
    </Icon>
  );
}

/** Вопросительный знак — «Как играть». */
export function QuestionIcon({ size }: IconProps): ReactElement {
  return (
    <Icon size={size}>
      <circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.22" />
      <path
        d="M9.4 9.4a2.7 2.7 0 015.3.6c0 1.9-2.7 2.2-2.7 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <circle cx="12" cy="17.2" r="1.3" fill="currentColor" />
    </Icon>
  );
}

/** Вибрация. */
export function VibrationIcon({ size }: IconProps): ReactElement {
  return (
    <Icon size={size}>
      <rect x="8.6" y="4.4" width="6.8" height="15.2" rx="2" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M5.4 9v6M2.8 10.6v2.8M18.6 9v6M21.2 10.6v2.8" />
      </g>
    </Icon>
  );
}

/** Часы — время и рекорды. */
export function ClockIcon({ size }: IconProps): ReactElement {
  return (
    <Icon size={size}>
      <circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <path
        d="M12 7.4V12l3.4 2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </Icon>
  );
}

