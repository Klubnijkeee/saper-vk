/**
 * Тесты определения площадки: внутри ВКонтакте или в обычном браузере.
 *
 * От этого зависит, какой бэкенд хранения прогресса выбран и вызовем ли мы
 * обязательный `VKWebAppInit`. Ошибка в сторону «не ВК» привела бы к тому,
 * что внутри ВК прогресс уходил бы в localStorage.
 */

import { describe, expect, it } from 'vitest';
import { looksLikeVk } from '../src/vk/bridge';

describe('vk: определение площадки', () => {
  it('внутри фрейма считаем, что это ВК', () => {
    expect(looksLikeVk({ insideFrame: true, search: '' })).toBe(true);
  });

  it('без фрейма, но с launch-параметрами — тоже ВК (мобильный WebView)', () => {
    expect(looksLikeVk({ insideFrame: false, search: '?vk_app_id=123&vk_user_id=1&sign=abc' })).toBe(
      true,
    );
    expect(looksLikeVk({ insideFrame: false, search: '?vk_user_id=1' })).toBe(true);
    expect(looksLikeVk({ insideFrame: false, search: '?sign=abc123' })).toBe(true);
  });

  it('обычный браузер — не ВК, мост не ждём', () => {
    expect(looksLikeVk({ insideFrame: false, search: '' })).toBe(false);
    expect(looksLikeVk({ insideFrame: false, search: '?dev=win' })).toBe(false);
    expect(looksLikeVk({ insideFrame: false, search: '?utm_source=vk' })).toBe(false);
  });

  it('похожие, но не те параметры не считаются признаком ВК', () => {
    expect(looksLikeVk({ insideFrame: false, search: '?signature=abc' })).toBe(false);
    expect(looksLikeVk({ insideFrame: false, search: '?vk_app_id_extra=1' })).toBe(false);
    expect(looksLikeVk({ insideFrame: false, search: '?app_id=1&user_id=2' })).toBe(false);
  });

  it('параметры находятся и в середине строки, и с другими ключами', () => {
    expect(looksLikeVk({ insideFrame: false, search: '?dev=play&vk_app_id=42&foo=bar' })).toBe(true);
    expect(looksLikeVk({ insideFrame: false, search: '?foo=bar&sign=xyz&dev=play' })).toBe(true);
  });
});
