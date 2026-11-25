/**
 * Настройки: звук, вибрация, повтор обучающего экрана.
 * Прогресс живёт в профиле ВК, поэтому «сброса» здесь нет — только поведение.
 */

import type { ReactElement } from 'react';
import { ScreenShell } from '../components/ScreenShell';
import { QuestionIcon, SoundIcon, VibrationIcon } from './../components/icons';

export interface SettingsScreenProps {
  readonly soundEnabled: boolean;
  readonly vibrationEnabled: boolean;
  readonly onBack: () => void;
  readonly onToggleSound: () => void;
  readonly onToggleVibration: () => void;
  readonly onOpenHowTo: () => void;
}

/** Строка-переключатель: подпись слева, тумблер справа. */
function ToggleRow({
  label,
  hint,
  icon,
  enabled,
  onToggle,
}: {
  readonly label: string;
  readonly hint: string;
  readonly icon: ReactElement;
  readonly enabled: boolean;
  readonly onToggle: () => void;
}): ReactElement {
  return (
    <li className="row">
      <span className="row__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="row__text">
        <span className="row__label">{label}</span>
        <span className="row__hint">{hint}</span>
      </span>
      <button
        type="button"
        className={`toggle${enabled ? ' is-on' : ''}`}
        role="switch"
        aria-checked={enabled}
        aria-label={label}
        onClick={onToggle}
      >
        <span className="toggle__knob" />
      </button>
    </li>
  );
}

export function SettingsScreen({
  soundEnabled,
  vibrationEnabled,
  onBack,
  onToggleSound,
  onToggleVibration,
  onOpenHowTo,
}: SettingsScreenProps): ReactElement {
  return (
    <ScreenShell title="Настройки" onBack={onBack}>
      <ul className="rows">
        <ToggleRow
          label="Звук"
          hint="Клик по клетке, взрыв, победа"
          icon={<SoundIcon size={20} muted={!soundEnabled} />}
          enabled={soundEnabled}
          onToggle={onToggleSound}
        />
        <ToggleRow
          label="Вибрация"
          hint="Короткий отклик на взрыве"
          icon={<VibrationIcon size={20} />}
          enabled={vibrationEnabled}
          onToggle={onToggleVibration}
        />
      </ul>

      <h2 className="section-title">Помощь</h2>
      <ul className="rows">
        <li className="row">
          <span className="row__icon" aria-hidden="true">
            <QuestionIcon size={20} />
          </span>
          <span className="row__text">
            <span className="row__label">Как играть</span>
            <span className="row__hint">Правила, флажки и быстрое открытие</span>
          </span>
          <button type="button" className="row__action" onClick={onOpenHowTo}>
            Открыть
          </button>
        </li>
      </ul>

      <p className="note">
        Монеты, уровень, рекорды, достижения и темы сохраняются в вашем профиле ВКонтакте —
        прогресс не потеряется при смене устройства.
      </p>
    </ScreenShell>
  );
}
