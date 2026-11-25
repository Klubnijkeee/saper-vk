/**
 * Экран достижений: прогресс по каждому, отдельно полученные и оставшиеся.
 */

import type { ReactElement } from 'react';
import { ACHIEVEMENTS, achievementProgress } from '../game/achievements';
import type { Stats, ThemeId } from '../game/types';
import { ScreenShell } from '../components/ScreenShell';
import { CheckIcon, StarIcon } from './../components/icons';

export interface AchievementsScreenProps {
  readonly stats: Stats;
  readonly level: number;
  readonly achievements: readonly string[];
  readonly themeId: ThemeId;
  readonly onBack: () => void;
}

/** Карточка достижения: иконка-медаль, название, шкала и награда. */
function AchievementCard({
  title,
  description,
  stars,
  progress,
  unlocked,
}: {
  readonly title: string;
  readonly description: string;
  readonly stars: number;
  readonly progress: number;
  readonly unlocked: boolean;
}): ReactElement {
  return (
    <li className={`achievement${unlocked ? ' is-unlocked' : ''}`}>
      <span className="achievement__medal" aria-hidden="true">
        {unlocked ? <CheckIcon size={18} /> : <StarIcon size={18} filled={false} />}
      </span>
      <span className="achievement__text">
        <span className="achievement__title">{title}</span>
        <span className="achievement__description">{description}</span>
        <span className="progress" aria-hidden="true">
          <span className="progress__fill" style={{ width: `${progress * 100}%` }} />
        </span>
      </span>
      <span className="achievement__reward">
        <StarIcon size={12} />
        {stars}
      </span>
    </li>
  );
}

export function AchievementsScreen({
  stats,
  level,
  achievements,
  onBack,
}: AchievementsScreenProps): ReactElement {
  const input = { stats, level };
  const unlockedList = ACHIEVEMENTS.filter((item) => achievements.includes(item.id));
  const lockedList = ACHIEVEMENTS.filter((item) => !achievements.includes(item.id));
  const share = Math.round((unlockedList.length / ACHIEVEMENTS.length) * 100);

  return (
    <ScreenShell
      title="Достижения"
      subtitle={`${unlockedList.length} из ${ACHIEVEMENTS.length}`}
      onBack={onBack}
    >
      <div className="progress progress--big" aria-hidden="true">
        <span className="progress__fill" style={{ width: `${share}%` }} />
      </div>
      <p className="note">{share}% открыто. Звёзды за достижения можно тратить на темы.</p>

      {unlockedList.length > 0 ? (
        <>
          <h2 className="section-title">Получено</h2>
          <ul className="achievements">
            {unlockedList.map((item) => (
              <AchievementCard
                key={item.id}
                title={item.title}
                description={item.description}
                stars={item.stars}
                progress={1}
                unlocked
              />
            ))}
          </ul>
        </>
      ) : null}

      <h2 className="section-title">Осталось</h2>
      <ul className="achievements">
        {lockedList.map((item) => (
          <AchievementCard
            key={item.id}
            title={item.title}
            description={item.description}
            stars={item.stars}
            progress={achievementProgress(item, input)}
            unlocked={false}
          />
        ))}
      </ul>
    </ScreenShell>
  );
}
