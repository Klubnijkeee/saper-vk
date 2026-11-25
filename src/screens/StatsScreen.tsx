/**
 * Экран статистики: сводка по всем партиям и разбивка по режимам.
 */

import type { ReactElement } from 'react';
import { formatClock } from '../game/clock';
import { MODES } from '../game/modes';
import { averageTimeMs, winRate } from '../game/stats';
import type { Stats } from '../game/types';
import { ScreenShell } from '../components/ScreenShell';

export interface StatsScreenProps {
  readonly stats: Stats;
  readonly onBack: () => void;
}

/** Строка «подпись — значение». */
function Row({
  label,
  value,
  hint,
}: {
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
}): ReactElement {
  return (
    <li className="row">
      <span className="row__text">
        <span className="row__label">{label}</span>
        {hint === undefined ? null : <span className="row__hint">{hint}</span>}
      </span>
      <span className="row__value">{value}</span>
    </li>
  );
}

export function StatsScreen({ stats, onBack }: StatsScreenProps): ReactElement {
  const average = averageTimeMs(stats);
  const rate = Math.round(winRate(stats) * 100);

  return (
    <ScreenShell title="Статистика" onBack={onBack}>
      {stats.gamesPlayed === 0 ? (
        <p className="empty">Сыграйте первую партию — здесь появятся цифры.</p>
      ) : null}

      <ul className="rows">
        <Row label="Партий сыграно" value={String(stats.gamesPlayed)} />
        <Row label="Побед" value={String(stats.wins)} />
        <Row label="Поражений" value={String(stats.losses)} />
        <Row label="Винрейт" value={`${rate}%`} />
        <Row
          label="Серия побед"
          value={String(stats.currentStreak)}
          hint={`лучшая — ${stats.bestStreak}`}
        />
        <Row label="Открыто клеток" value={stats.cellsOpened.toLocaleString('ru-RU')} />
        <Row label="Поставлено флагов" value={stats.flagsPlaced.toLocaleString('ru-RU')} />
        <Row label="Подсказок взято" value={stats.hintsUsed.toLocaleString('ru-RU')} />
        <Row label="Побед без подсказок" value={String(stats.cleanWins)} />
        <Row label="Побед быстрее минуты" value={String(stats.fastWins)} />
        <Row
          label="Среднее время партии"
          value={average === null ? '—' : formatClock(average)}
        />
        <Row label="Всего за игрой" value={formatClock(stats.playTimeMs)} />
      </ul>

      <h2 className="section-title">По режимам</h2>
      <ul className="rows">
        {MODES.map((mode) => {
          const modeStats = stats.byMode[mode.id];
          return (
            <Row
              key={mode.id}
              label={mode.title}
              hint={`партий ${modeStats?.played ?? 0} · побед ${modeStats?.wins ?? 0}`}
              value={
                modeStats?.bestTimeMs === null || modeStats?.bestTimeMs === undefined
                  ? '—'
                  : formatClock(modeStats.bestTimeMs)
              }
            />
          );
        })}
      </ul>
    </ScreenShell>
  );
}
