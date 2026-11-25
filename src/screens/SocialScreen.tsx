/**
 * Друзья и рейтинги.
 *
 * Что работает уже сейчас: приглашение друзей, добавление в избранное,
 * разрешение на уведомления и ссылка «поделиться» — это клиентские методы
 * VK Bridge, сервер не нужен.
 *
 * Чего пока нет: таблицы рекордов. Общий и дружеский рейтинги требуют, чтобы
 * очки писались на сервере приложения секретным ключом (secure.addAppEvent),
 * поэтому здесь честно стоит «скоро» — зато свой прогресс видно сразу.
 */

import { useCallback, useState, type ReactElement } from 'react';
import { ScreenShell } from '../components/ScreenShell';
import { ChevronRightIcon, StarIcon, TrophyIcon } from '../components/icons';
import { LEVEL_PATTERNS } from '../game/patterns';
import { bestTimeFor } from '../game/stats';
import type { MetaState } from '../game/types';
import { formatClock } from '../game/clock';
import {
  addToFavorites,
  allowNotifications,
  inviteFriends,
  shareApp,
} from '../vk/bridge';

export interface SocialScreenProps {
  readonly meta: MetaState;
  readonly onBack: () => void;
  /** Показать тост (например, «доступно внутри ВКонтакте»). */
  readonly onNotify: (text: string) => void;
}

/** Строка-кнопка с иконкой, подписью и стрелкой. */
function ActionRow({
  title,
  hint,
  icon,
  onClick,
  badge,
}: {
  readonly title: string;
  readonly hint: string;
  readonly icon: ReactElement;
  readonly onClick: () => void;
  readonly badge?: string;
}): ReactElement {
  return (
    <li className="row">
      <span className="row__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="row__text">
        <span className="row__label">
          {title}
          {badge === undefined ? null : <em className="row__badge">{badge}</em>}
        </span>
        <span className="row__hint">{hint}</span>
      </span>
      <button type="button" className="row__go" onClick={onClick} aria-label={title}>
        <ChevronRightIcon size={18} />
      </button>
    </li>
  );
}

export function SocialScreen({ meta, onBack, onNotify }: SocialScreenProps): ReactElement {
  const [notificationsAsked, setNotificationsAsked] = useState(false);
  const level = meta.campaignLevel;
  const collected = Math.min(Math.max(0, level - 1), LEVEL_PATTERNS.length);
  const record = bestTimeFor(meta.stats, 'campaign');

  /** Общий обработчик: вне ВК методы моста недоступны, говорим об этом прямо. */
  const run = useCallback(
    (action: () => Promise<boolean>, successText: string): void => {
      void action().then((ok) => {
        onNotify(ok ? successText : 'Это работает внутри ВКонтакте');
      });
    },
    [onNotify],
  );

  return (
    <ScreenShell
      title="Друзья и рейтинг"
      subtitle="Соревнование и приглашения"
      onBack={onBack}
    >
      <ul className="rows">
        <li className="row">
          <span className="row__icon" aria-hidden="true">
            <TrophyIcon size={20} />
          </span>
          <span className="row__text">
            <span className="row__label">
              Рейтинг друзей
              <em className="row__badge">скоро</em>
            </span>
            <span className="row__hint">
              Нужен сервер: очки в общую таблицу пишутся секретным ключом приложения
            </span>
          </span>
        </li>
        <li className="row">
          <span className="row__icon" aria-hidden="true">
            <StarIcon size={20} />
          </span>
          <span className="row__text">
            <span className="row__label">
              Глобальный рейтинг
              <em className="row__badge">скоро</em>
            </span>
            <span className="row__hint">
              Очки уже считаются и сохраняются — место в таблице займёшь сразу, как появится
            </span>
          </span>
        </li>
      </ul>

      <h2 className="section-title">Ваш прогресс</h2>
      <ul className="rows">
        <li className="row">
          <span className="row__text">
            <span className="row__label">Уровень кампании</span>
            <span className="row__hint">
              фигур собрано {collected} из {LEVEL_PATTERNS.length}
            </span>
          </span>
          <span className="row__value">{level}</span>
        </li>
        <li className="row">
          <span className="row__text">
            <span className="row__label">Победы и серия</span>
            <span className="row__hint">лучшая серия — {meta.stats.bestStreak}</span>
          </span>
          <span className="row__value">{meta.stats.wins}</span>
        </li>
        <li className="row">
          <span className="row__text">
            <span className="row__label">Лучшее время кампании</span>
            <span className="row__hint">рекорд по выигранным партиям</span>
          </span>
          <span className={`row__value${record === null ? ' row__value--empty' : ''}`}>
            {record === null ? '—' : formatClock(record)}
          </span>
        </li>
      </ul>

      <h2 className="section-title">Друзья</h2>
      <ul className="rows">
        <ActionRow
          title="Пригласить друзей"
          hint="Стандартный диалог приглашения ВКонтакте"
          icon={<ChevronRightIcon size={20} />}
          onClick={() => {
            run(inviteFriends, 'Приглашение открыто');
          }}
        />
        <ActionRow
          title="Рассказать о игре"
          hint="Поделиться ссылкой на приложение"
          icon={<ChevronRightIcon size={20} />}
          onClick={() => {
            run(shareApp, 'Окно «поделиться» открыто');
          }}
        />
      </ul>

      <h2 className="section-title">Приложение</h2>
      <ul className="rows">
        <ActionRow
          title="Добавить в избранное"
          hint="Игра всегда под рукой в списке приложений"
          icon={<StarIcon size={20} />}
          onClick={() => {
            run(addToFavorites, 'Добавлено в избранное');
          }}
        />
        <ActionRow
          title={notificationsAsked ? 'Уведомления разрешены' : 'Включить уведомления'}
          hint="Напомним про восстановившиеся жизни и задачи дня"
          icon={<StarIcon size={20} />}
          onClick={() => {
            setNotificationsAsked(true);
            run(allowNotifications, 'Уведомления подключены');
          }}
        />
      </ul>

      <p className="note">
        Жизни восстанавливаются сами: одна каждые 8 минут, максимум 5. Если не хочется
        ждать — жизнь можно купить за звёзды во вкладке «Кампания».
      </p>
    </ScreenShell>
  );
}
