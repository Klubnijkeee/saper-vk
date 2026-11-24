import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { initVkBridge } from './vk/bridge';

// Инициализация VK Mini App: без VKWebAppInit приложение не откроется внутри ВК.
// Запуск не блокируем: вне ВК (или если ВК не ответил за 3 с) игра работает
// на localStorage — см. src/vk/storage.ts.
void initVkBridge();

const container = document.getElementById('root');
if (container === null) {
  throw new Error('Не найден контейнер #root в index.html');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
