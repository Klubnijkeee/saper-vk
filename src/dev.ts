/**
 * Признак того, что сборка поддерживает отладочные возможности.
 *
 * В обычной (production) сборке ветка вырезается сборщиком по `import.meta.env`,
 * поэтому проверки вроде `if (!DEV_BRIDGE_ENABLED) return` не оставляют следа
 * в бандле. Живёт отдельным модулем, потому что нужен и приложению
 * (переход по `?screen=`), и игровому экрану (мост `window.__SAPER__`).
 */

export const DEV_BRIDGE_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_DEV_BRIDGE === '1';
