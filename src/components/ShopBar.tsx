/**
 * Панель магазина: три подсказки внизу экрана.
 *
 * Кнопка показывает иконку, название и цену. Если монет не хватает —
 * кнопка выглядит неактивной (серая), но остаётся нажимаемой: тап по ней
 * объясняет причину тостом «Не хватает монет» (так и описано в ТЗ —
 * иначе игрок не поймёт, почему ничего не происходит).
 */

import type { ComponentType, ReactElement } from 'react';
import { canAfford, SHOP_ITEMS } from '../game/shop';
import type { ShopItemId } from '../game/types';
import { CellSparkIcon, CoinIcon, EyeIcon, MineRemoveIcon, type IconProps } from './icons';

const ITEM_ICONS: Readonly<Record<ShopItemId, ComponentType<IconProps>>> = {
  'show-mine': EyeIcon,
  'open-cell': CellSparkIcon,
  'remove-mine': MineRemoveIcon,
};

export interface ShopBarProps {
  readonly coins: number;
  /** Магазин доступен: партия идёт, не на паузе и не завершена. */
  readonly canUse: boolean;
  readonly onBuy: (id: ShopItemId) => void;
}

export function ShopBar({ coins, canUse, onBuy }: ShopBarProps): ReactElement {
  return (
    <footer className="shopbar">
      {SHOP_ITEMS.map((item) => {
        const affordable = canAfford(coins, item);
        const inactive = !affordable || !canUse;
        const HintIcon = ITEM_ICONS[item.id];

        return (
          <button
            key={item.id}
            type="button"
            className={`shop-btn${inactive ? ' shop-btn--inactive' : ''}`}
            aria-disabled={inactive}
            title={`${item.description} — ${item.price} монет`}
            onClick={() => {
              onBuy(item.id);
            }}
          >
            <span className="shop-btn__row">
              <HintIcon size={14} />
              <span className="shop-btn__label">{item.label}</span>
            </span>
            <span className="shop-btn__price">
              <CoinIcon size={11} />
              {item.price}
            </span>
          </button>
        );
      })}
    </footer>
  );
}
