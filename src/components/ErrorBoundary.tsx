/**
 * Ловушка ошибок отрисовки.
 *
 * Если компонент падает при рендере, React размонтирует дерево и игрок видит
 * пустой экран. Показываем причину и кнопку перезагрузки — в веб-вью ВК это
 * единственный способ увидеть, что именно сломалось.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  readonly children: ReactNode;
}

interface ErrorBoundaryState {
  readonly error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    const problems = (window as { __SAPER_PROBLEMS__?: string[] }).__SAPER_PROBLEMS__;
    problems?.push(`${error.message}${info.componentStack ?? ''}`);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (error === null) return this.props.children;

    return (
      <div className="boot-error">
        <h1 className="boot-error__title">Что-то сломалось</h1>
        <p className="boot-error__hint">
          Экран не отрисовался. Попробуйте обновить — обычно этого достаточно.
        </p>
        <pre className="boot-error__details">{error.message}</pre>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => {
            window.location.reload();
          }}
        >
          Обновить
        </button>
      </div>
    );
  }
}
