/**
 * Экран рекордов: лучшее время победы по каждому режиму.
 */

import type { ReactElement } from 'react';
import { formatClock } from '../game/clock';
import { MODES, configForMode } from '../game/modes';
import { bestTimeFor } from '../game/stats';
import type { Stats } from '../game/types';
import { ScreenShell } from '../components/ScreenShell';

export interface RecordsScreenProps {
  readonly stats: Stats;
  readonly onBack: () => void;
}

export function RecordsScreen({ stats, onBack }: RecordsScreenProps): ReactElement {
  return (
    <ScreenShell
      title="Рекорды"
      subtitle="Лучшее время победы в каждом режиме"
      onBack={onBack}
    >
      <ul className="rows">
        {MODES.map((mode) => {
          const config = configForMode(mode.id, 1);
          const record = bestTimeFor(stats, mode.id);
          const played = stats.byMode[mode.id]?.played ?? 0;
          return (
            <li key={mode.id} className="row">
              <span className="row__text">
                <span className="row__label">{mode.title}</span>
                <span className="row__hint">
                  {mode.id === 'campaign'
                    ? `Уровни · ${config.cols}×${config.rows}`
                    : `${config.cols}×${config.rows} · ${config.mines} мин`}
                  {played === 0 ? '' : ` · партий ${played}`}
                </span>
              </span>
              <span className={`row__value${record === null ? ' row__value--empty' : ''}`}>
                {record === null ? '—' : formatClock(record)}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="note">
        Рекорд засчитывается только за выигранную партию. Время на паузе не идёт, поэтому
        можно спокойно подумать.
      </p>
    </ScreenShell>
  );
}
