/// <reference types="vite/client" />

/**
 * Переменные окружения сборки.
 *
 * `VITE_DEV_BRIDGE=1` включает отладочный мост (`window.__SAPER__`) и сценарии
 * `?dev=...` в собранной версии — нужен только инструментам скриншотов.
 * По умолчанию выключен, в релизной сборке кода моста нет.
 */
interface ImportMetaEnv {
  readonly VITE_DEV_BRIDGE?: string;
}
