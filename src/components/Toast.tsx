/**
 * Тост: всплывашка снизу, исчезает сама (таймером управляет `useToast`).
 */

import type { ReactElement } from 'react';

export interface ToastProps {
  readonly text: string;
}

export function Toast({ text }: ToastProps): ReactElement {
  return (
    <div className="toast" role="status" aria-live="polite">
      {text}
    </div>
  );
}
