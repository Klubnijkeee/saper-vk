import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles.css';
import { initVkBridge } from './vk/bridge';

/**
 * Если приложение падает при запуске, игрок видит пустой тёмный экран и ничего
 * не может сообщить. Показываем причину прямо на странице: обработчик ошибок
 * лежит в `index.html` (он должен стоять до модулей), здесь только вызываем.
 */
function reportBootFailure(reason: unknown): void {
  const problems = (window as { __SAPER_PROBLEMS__?: string[] }).__SAPER_PROBLEMS__;
  problems?.push(reason instanceof Error ? reason.message : String(reason));
}

// Инициализация VK Mini App: без VKWebAppInit приложение не откроется внутри ВК.
// Запуск не блокируем: вне ВК (или если ВК не ответил за 3 с) игра работает
// на localStorage — см. src/vk/storage.ts.
void initVkBridge().catch(reportBootFailure);

try {
  const container = document.getElementById('root');
  if (container === null) {
    throw new Error('Не найден контейнер #root в index.html');
  }

  createRoot(container).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
} catch (error) {
  reportBootFailure(error);
  // Даём наблюдателю из index.html показать причину сразу, не ожидая таймаута.
  if (typeof window.setTimeout === 'function') {
    window.setTimeout(() => {
      (window as { __SAPER_SHOW_PROBLEM__?: (reason: string) => void }).__SAPER_SHOW_PROBLEM__?.(
        String(error),
      );
    }, 0);
  }
}
