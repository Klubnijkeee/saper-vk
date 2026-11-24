/**
 * Каркас модального окна: затемнение на весь экран + карточка по центру.
 * Используется экраном завершения партии и паузой.
 */

import type { ReactElement, ReactNode } from 'react';
import { Confetti } from './Confetti';

export interface ModalProps {
  readonly title: string;
  readonly tone: 'danger' | 'success' | 'neutral';
  readonly children: ReactNode;
  /** Конфетти за карточкой (экран победы). */
  readonly celebrate?: boolean;
  /**
   * Тап мимо карточки. На экране завершения партии это «подсмотр»:
   * оверлей закрывается, и игрок видит поле, на котором проиграл или выиграл.
   */
  readonly onDismiss?: (() => void) | undefined;
}

export function Modal({
  title,
  tone,
  children,
  celebrate = false,
  onDismiss,
}: ModalProps): ReactElement {
  return (
    <div
      className="overlay"
      onClick={
        onDismiss === undefined
          ? undefined
          : (event) => {
              if (event.target === event.currentTarget) onDismiss();
            }
      }
    >
      {celebrate ? <Confetti /> : null}
      <div className={`modal modal--${tone}`} role="dialog" aria-modal="true" aria-label={title}>
        {children}
      </div>
    </div>
  );
}
