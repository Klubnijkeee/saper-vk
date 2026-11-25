#!/usr/bin/env python3
"""Генератор оформления для VK Mini App «Сапёр: Магазин подсказок».

Рисует изображения, которые просит панель ВКонтакте:
    icon-universal-576.png    универсальная иконка        576×576
    icon-catalog-278.png      иконка для каталога         278×278
    icon-small-150.png        маленькая иконка            150×150
    favicon-32.png            фавикон                      32×32
    snippet-1120x630.png/.jpg большой сниппет           1120×630
    preview-icon-sizes.png    контактный лист (не для загрузки, для проверки)

Визуальный язык тот же, что в приложении (src/styles.css): тёмный градиент,
объёмные закрытые клетки, плоские открытые, мина с белыми шипами, классические
цвета цифр, золотая монета магазина.

Запуск: python scripts/make-art.py [каталог]
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

# ── Палитра (совпадает с src/styles.css) ────────────────────────────────────

BG_TOP = (26, 26, 26)
BG_MID = (18, 18, 18)
BG_BOTTOM = (14, 14, 14)

CELL_CLOSED = (42, 42, 42)
CELL_BORDER = (58, 58, 58)
CELL_LEDGE = (26, 26, 26)
CELL_OPEN = (30, 30, 30)
CELL_OPEN_SHADE = (22, 22, 22)

FLAG_BG = (179, 38, 30)
FLAG_BORDER = (210, 69, 78)

DANGER = (255, 90, 95)
HINT_BG = (107, 26, 26)

GOLD = (245, 185, 59)
GOLD_DARK = (179, 124, 17)

N1 = (76, 141, 255)
N2 = (61, 220, 132)
N3 = (255, 90, 95)

TEXT = (242, 243, 245)
TEXT_DIM = (155, 155, 155)

ACCENT_LIGHT = (74, 134, 255)
ACCENT_DARK = (47, 106, 224)

WHITE = (255, 255, 255)
BLACK_GLOSS = (176, 176, 176)

#: Во сколько раз рисуем больше и потом уменьшаем (сглаживание краёв).
SS = 4

#: Клетка приложения — 32 px, её «ножка» — 2 px. Отсюда пропорции для любого размера.
APP_CELL = 32.0

FONT_BOLD = "C:/Windows/Fonts/segoeuib.ttf"
FONT_REGULAR = "C:/Windows/Fonts/segoeui.ttf"

# ── Базовая графика ─────────────────────────────────────────────────────────


def load_font(size_px: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    """Шрифт с кириллицей."""
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REGULAR, max(1, int(size_px)))


def vertical_gradient(width: int, height: int,
                      stops: list[tuple[float, tuple[int, int, int]]]) -> Image.Image:
    """Вертикальный градиент по опорным точкам (позиция 0..1, цвет)."""
    positions = np.array([stop[0] for stop in stops], dtype=float)
    colors = np.array([stop[1] for stop in stops], dtype=float)

    ys = np.linspace(0.0, 1.0, height)
    rows = np.zeros((height, width, 3), dtype=float)
    for channel in range(3):
        rows[:, :, channel] = np.interp(ys, positions, colors[:, channel])[:, None]

    return Image.fromarray(rows.astype(np.uint8), "RGB")


def soft_glow(size: tuple[int, int], box: tuple[float, float, float, float],
              color: tuple[int, int, int], alpha: int, blur: float,
              radius: float = 0.0, shape: str = "ellipse") -> Image.Image:
    """Размытое пятно или скруглённый прямоугольник — свечение и объём."""
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    fill = (*color, alpha)

    if shape == "ellipse":
        draw.ellipse(box, fill=fill)
    else:
        draw.rounded_rectangle(box, radius=radius, fill=fill)

    return layer.filter(ImageFilter.GaussianBlur(blur))


def append_glow(image: Image.Image, *args, **kwargs) -> Image.Image:
    """Наложить свечение и вернуть новое изображение."""
    return Image.alpha_composite(image, soft_glow(image.size, *args, **kwargs))


def closed_cell(draw: ImageDraw.ImageDraw, box, radius: float, scale: float) -> None:
    """Объёмная закрытая клетка: ножка снизу + светлая обводка."""
    x0, y0, x1, y1 = box
    ledge = 2.0 * scale
    draw.rounded_rectangle((x0, y0 + ledge, x1, y1 + ledge), radius=radius, fill=CELL_LEDGE)
    draw.rounded_rectangle(box, radius=radius, fill=CELL_CLOSED, outline=CELL_BORDER,
                           width=max(1, round(scale)))


def open_cell(draw: ImageDraw.ImageDraw, box, radius: float, scale: float) -> None:
    """Открытая клетка: плоская, с намёком на утопленную тень сверху."""
    x0, y0, x1, y1 = box
    draw.rounded_rectangle(box, radius=radius, fill=CELL_OPEN)
    shade = (y1 - y0) * 0.3
    draw.rounded_rectangle((x0, y0, x1, y0 + shade), radius=radius, fill=CELL_OPEN_SHADE)


def flag_cell(draw: ImageDraw.ImageDraw, box, radius: float, scale: float) -> None:
    """Клетка с флажком: белое полотнище на красном фоне."""
    x0, y0, x1, y1 = box
    size = x1 - x0
    draw.rounded_rectangle((x0, y0 + 2.0 * scale, x1, y1 + 2.0 * scale), radius=radius,
                           fill=CELL_LEDGE)
    draw.rounded_rectangle(box, radius=radius, fill=FLAG_BG, outline=FLAG_BORDER,
                           width=max(1, round(scale)))

    def px(value: float) -> float:
        """X из viewBox 24×24 иконки флажка в пиксели клетки."""
        return x0 + size * value / 24.0

    def py(value: float) -> float:
        """Y из того же viewBox — считается от верхней границы клетки."""
        return y0 + size * value / 24.0

    draw.line([(px(7.4), py(21.0)), (px(7.4), py(3.6))], fill=WHITE,
              width=max(2, round(size * 0.095)))
    draw.polygon(
        [
            (px(7.4), py(4.4)),
            (px(17.6), py(4.4)),
            (px(14.6), py(7.9)),
            (px(17.6), py(11.4)),
            (px(7.4), py(11.4)),
        ],
        fill=WHITE,
    )


def mine(draw: ImageDraw.ImageDraw, center: tuple[float, float], extent: float) -> None:
    """Мина: чёрный шар с белой окантовкой и восемью шипами.

    Пропорции как в иконке приложения (viewBox 24×24 при шипах до R):
    шар ≈ 0.6R, шипы от 0.62R до R, толщина ≈ 0.18R.
    `extent` — радиус по кончикам шипов.
    """
    cx, cy = center
    inner = extent * 0.62
    ball = extent * 0.6
    width = max(2, round(extent * 0.18))

    for index in range(8):
        angle = math.radians(index * 45)
        dx, dy = math.cos(angle), math.sin(angle)
        start = (cx + dx * inner, cy + dy * inner)
        end = (cx + dx * extent, cy + dy * extent)
        draw.line([start, end], fill=WHITE, width=width)
        for point in (start, end):  # круглые концы
            draw.ellipse((point[0] - width / 2, point[1] - width / 2,
                          point[0] + width / 2, point[1] + width / 2), fill=WHITE)

    draw.ellipse((cx - ball, cy - ball, cx + ball, cy + ball), fill=(11, 11, 11),
                 outline=WHITE, width=max(2, round(extent * 0.13)))

    gloss = extent * 0.2
    gx, gy = cx - ball * 0.42, cy - ball * 0.42
    draw.ellipse((gx - gloss, gy - gloss, gx + gloss, gy + gloss), fill=BLACK_GLOSS)


def digit(draw: ImageDraw.ImageDraw, box, text: str, color, font) -> None:
    """Цифра, отцентрованная в клетке."""
    x0, y0, x1, y1 = box
    bbox = draw.textbbox((0, 0), text, font=font)
    width = bbox[2] - bbox[0]
    height = bbox[3] - bbox[1]
    draw.text(((x0 + x1) / 2 - width / 2 - bbox[0], (y0 + y1) / 2 - height / 2 - bbox[1]),
              text, font=font, fill=color)


def star(cx: float, cy: float, outer: float, inner: float, points: int = 5):
    coords = []
    for index in range(points * 2):
        angle = math.radians(-90 + index * 180 / points)
        radius = outer if index % 2 == 0 else inner
        coords.append((cx + radius * math.cos(angle), cy + radius * math.sin(angle)))
    return coords


def coin(draw: ImageDraw.ImageDraw, center: tuple[float, float], radius: float,
         with_star: bool = True) -> None:
    """Монета магазина: золотой круг с тёмным кольцом."""
    cx, cy = center
    draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=GOLD)
    ring = radius * 0.66
    draw.ellipse((cx - ring, cy - ring, cx + ring, cy + ring), outline=GOLD_DARK,
                 width=max(2, round(radius * 0.17)))
    if with_star:
        draw.polygon(star(cx, cy, radius * 0.48, radius * 0.2), fill=GOLD_DARK)


# ── Поле ────────────────────────────────────────────────────────────────────


def grid_boxes(size: float, columns: int, cell: float, gap: float):
    """Коробки клеток сетки columns×columns, отцентрованные в квадрате size."""
    total = columns * cell + (columns - 1) * gap
    left = (size - total) / 2
    top = (size - total) / 2

    boxes = []
    for row in range(columns):
        for column in range(columns):
            x0 = left + column * (cell + gap)
            y0 = top + row * (cell + gap)
            boxes.append((x0, y0, x0 + cell, y0 + cell))
    return boxes


CELL_KINDS_3 = {
    (0, 0): ("digit", "1", N1),
    (0, 1): ("closed", "", None),
    (0, 2): ("digit", "2", N2),
    (1, 0): ("closed", "", None),
    (1, 1): ("mine", "", None),
    (1, 2): ("open", "", None),
    (2, 0): ("flag", "", None),
    (2, 1): ("digit", "3", N3),
    (2, 2): ("closed", "", None),
}

CELL_KINDS_2 = {
    (0, 0): ("mine", "", None),
    (0, 1): ("digit", "2", N2),
    (1, 0): ("flag", "", None),
    (1, 1): ("closed", "", None),
}


def render_board(layer: Image.Image, columns: int, cell: float, gap: float,
                 hint_mine: bool = False, with_coin: bool = True) -> None:
    """Рисует поле: мина, цифры, флажок, открытая клетка и монета-бейдж.

    Пропорции обводок считаются от размера клетки (как в CSS приложения),
    поэтому картинка одинаково выглядит в любом размере.
    """
    scale = max(0.8, cell / APP_CELL)
    radius = cell * 0.19
    boxes = grid_boxes(layer.size[0], columns, cell, gap)
    kinds = CELL_KINDS_3 if columns == 3 else CELL_KINDS_2

    mine_index = 1 * columns + 1 if columns == 3 else 0

    if hint_mine:
        box = boxes[mine_index]
        layer.alpha_composite(
            soft_glow(
                layer.size,
                (box[0] - cell * 0.17, box[1] - cell * 0.17,
                 box[2] + cell * 0.17, box[3] + cell * 0.17),
                DANGER, 165, cell * 0.14, radius=radius * 1.8, shape="rect",
            )
        )

    draw = ImageDraw.Draw(layer)
    digit_font = load_font(cell * 0.56)

    for index, box in enumerate(boxes):
        row, column = divmod(index, columns)
        kind, text, color = kinds.get((row, column), ("closed", "", None))

        if kind == "closed":
            closed_cell(draw, box, radius, scale)
        elif kind == "open":
            open_cell(draw, box, radius, scale)
        elif kind == "flag":
            flag_cell(draw, box, radius, scale)
        elif kind == "digit":
            closed_cell(draw, box, radius, scale)
            digit(draw, box, text, color, digit_font)
        elif kind == "mine":
            if hint_mine:
                draw.rounded_rectangle(box, radius=radius, fill=HINT_BG, outline=DANGER,
                                       width=max(2, round(scale * 1.8)))
            else:
                closed_cell(draw, box, radius, scale)
            mine(draw, ((box[0] + box[2]) / 2, (box[1] + box[3]) / 2), cell * 0.315)

    if not with_coin:
        return

    last = boxes[-1]
    radius_coin = cell * 0.36
    cx = last[2] - radius_coin * 0.3
    cy = last[3] - radius_coin * 0.3
    draw.ellipse((cx - radius_coin * 1.13, cy - radius_coin * 1.13,
                  cx + radius_coin * 1.13, cy + radius_coin * 1.13), fill=BG_MID)
    coin(draw, (cx, cy), radius_coin, with_star=cell > 26)


# ── Иконки ──────────────────────────────────────────────────────────────────


def render_icon(size: int) -> Image.Image:
    """Иконка приложения: состав зависит от размера (мелкие детали не читаются)."""
    canvas = size * SS
    image = vertical_gradient(canvas, canvas, [(0.0, BG_TOP), (0.45, BG_MID), (1.0, BG_BOTTOM)]).convert("RGBA")
    image = append_glow(image, (-canvas * 0.3, -canvas * 0.5, canvas * 0.9, canvas * 0.55),
                        (255, 255, 255), 10, canvas * 0.07)
    image = append_glow(image, (canvas * 0.1, canvas * 0.55, canvas * 1.25, canvas * 1.3),
                        ACCENT_LIGHT, 30, canvas * 0.13)

    if size >= 200:
        # сетка занимает 70% кадра: при круглой маске (ВК маскирует иконки
        # по-разному) углы не срезаются — квадрат 70% целиком вписан в круг
        render_board(image, 3, canvas * 0.222, canvas * 0.019, with_coin=True)
    elif size >= 100:
        render_board(image, 2, canvas * 0.33, canvas * 0.04, with_coin=False)
    else:
        # 32 px: одна клетка с миной — сетка и цифры всё равно смажутся
        draw = ImageDraw.Draw(image)
        cell = canvas * 0.76
        box = ((canvas - cell) / 2, (canvas - cell) / 2,
               (canvas + cell) / 2, (canvas + cell) / 2)
        closed_cell(draw, box, cell * 0.19, max(0.8, cell / APP_CELL * 0.9))
        mine(draw, (canvas / 2, canvas / 2), cell * 0.3)

    return image.resize((size, size), Image.LANCZOS).convert("RGB")


# ── Большой сниппет ─────────────────────────────────────────────────────────


def render_snippet(width: int = 1120, height: int = 630) -> Image.Image:
    """Сниппет: название, подзаголовок, поле с подсвеченной миной и три подсказки."""
    scale = 3
    canvas_w, canvas_h = width * scale, height * scale
    image = vertical_gradient(canvas_w, canvas_h,
                              [(0.0, BG_TOP), (0.45, BG_MID), (1.0, BG_BOTTOM)]).convert("RGBA")
    image = append_glow(image, (canvas_w * 0.5, -canvas_h * 0.5, canvas_w * 1.4, canvas_h * 0.9),
                        ACCENT_LIGHT, 36, 90 * scale)
    image = append_glow(image, (-canvas_w * 0.15, canvas_h * 0.4, canvas_w * 0.5, canvas_h * 1.45),
                        DANGER, 24, 110 * scale)

    # поле справа: снизу оставляем место под кнопки магазина
    side = int(canvas_w * 0.38)
    board_layer = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    render_board(board_layer, 3, side * 0.222, side * 0.019, hint_mine=True, with_coin=True)
    image.alpha_composite(board_layer, (int(canvas_w * 0.565), int(canvas_h * 0.055)))

    draw = ImageDraw.Draw(image)
    left = canvas_w * 0.062

    draw.text((left, canvas_h * 0.185), "Сапёр", font=load_font(112 * scale), fill=TEXT)
    draw.text((left, canvas_h * 0.185 + 128 * scale), "Магазин подсказок",
              font=load_font(53 * scale), fill=GOLD)
    draw.text((left, canvas_h * 0.185 + 202 * scale), "Мины, монеты и три подсказки",
              font=load_font(29 * scale, bold=False), fill=TEXT_DIM)

    # три кнопки-подсказки
    pills = [("Показать мину", "50"), ("Открыть клетку", "30"), ("Убрать мину", "100")]
    pill_w = canvas_w * 0.288
    pill_h = 66 * scale
    pill_gap = canvas_w * 0.02
    pill_y = canvas_h - pill_h - 72 * scale
    label_font = load_font(22 * scale)
    price_font = load_font(22 * scale)

    for index, (label, price) in enumerate(pills):
        x0 = left + index * (pill_w + pill_gap)
        box = (x0, pill_y, x0 + pill_w, pill_y + pill_h)

        shadow = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
        ImageDraw.Draw(shadow).rounded_rectangle(
            (box[0], box[1] + 5 * scale, box[2], box[3] + 5 * scale),
            radius=pill_h / 2, fill=(*ACCENT_DARK, 150),
        )
        image.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(9 * scale)))
        draw = ImageDraw.Draw(image)

        draw.rounded_rectangle(box, radius=pill_h / 2, fill=ACCENT_DARK)
        draw.rounded_rectangle((box[0], box[1], box[2], box[3] - 3 * scale),
                               radius=pill_h / 2, fill=ACCENT_LIGHT)
        draw.text((x0 + pill_w * 0.075, pill_y + pill_h * 0.29), label, font=label_font,
                  fill=WHITE)

        coin_center = (x0 + pill_w * 0.82, pill_y + pill_h / 2)
        coin(draw, coin_center, pill_h * 0.2, with_star=False)
        draw.text((coin_center[0] + pill_h * 0.27, pill_y + pill_h * 0.29), price,
                  font=price_font, fill=(255, 255, 255))

    # конфетти — только в пустых зонах, чтобы не садиться на текст, поле и кнопки
    for fx, fy, color in [(0.46, 0.08, (168, 107, 255)), (0.52, 0.32, (61, 220, 132)),
                          (0.44, 0.70, (76, 141, 255)), (0.97, 0.07, (255, 209, 102)),
                          (0.98, 0.52, (255, 90, 95))]:
        dot = canvas_w * 0.0055
        cx, cy = canvas_w * fx, canvas_h * fy
        draw.rounded_rectangle((cx - dot, cy - dot, cx + dot, cy + dot), radius=dot * 0.4,
                               fill=color)

    return image.resize((width, height), Image.LANCZOS).convert("RGB")


def render_background_preview(icon: Image.Image) -> Image.Image:
    """Как иконка выглядит на разных цветах фона за ней.

    В панели ВК по умолчанию стоит белый фон — на нём тёмная иконка
    выглядит чужеродно и мигает при загрузке. Показываем варианты рядом.
    """
    panel = 300
    gap = 24
    label_h = 46
    variants = [("(16, 16, 18)", "#101012"), ("(18, 18, 18)", "#121212"),
                ("(26, 26, 26)", "#1A1A1A"), ("(255, 255, 255)", "#FFFFFF")]

    width = gap + len(variants) * (panel + gap)
    height = panel + label_h + gap * 2
    sheet = vertical_gradient(width, height,
                              [(0.0, (20, 20, 20)), (1.0, (12, 12, 12))]).convert("RGBA")
    draw = ImageDraw.Draw(sheet)
    label_font = load_font(15, bold=False)

    for index, (label, color) in enumerate(variants):
        x0 = gap + index * (panel + gap)
        y0 = gap
        draw.rounded_rectangle((x0, y0, x0 + panel, y0 + panel), radius=18, fill=color)
        icon_size = int(panel * 0.62)
        sheet.alpha_composite(icon.convert("RGBA").resize((icon_size, icon_size), Image.LANCZOS),
                              (x0 + (panel - icon_size) // 2, y0 + (panel - icon_size) // 2))
        text_width = draw.textlength(label, font=label_font)
        draw.text((x0 + (panel - text_width) / 2, y0 + panel + 14), label,
                  font=label_font, fill=TEXT_DIM)

    return sheet.convert("RGB")


def render_contact_sheet(icons: dict[int, Image.Image],
                         out_size: tuple[int, int] = (1180, 400)) -> Image.Image:
    """Контактный лист: как иконка читается в разных размерах (не для загрузки)."""
    sheet = vertical_gradient(out_size[0], out_size[1],
                              [(0.0, (24, 24, 24)), (1.0, (12, 12, 12))]).convert("RGBA")
    label_font = load_font(15, bold=False)

    def rgba(size: int) -> Image.Image:
        return icons[size].convert("RGBA")

    sheet.alpha_composite(rgba(576).resize((260, 260), Image.LANCZOS), (40, 40))
    ImageDraw.Draw(sheet).text((40, 312), "576 × 576 — универсальная", font=label_font,
                               fill=TEXT_DIM)

    x = 340
    for size in (278, 150, 32):
        sheet.alpha_composite(rgba(size), (x, 300 - size))
        ImageDraw.Draw(sheet).text((x, 312), f"{size} × {size}", font=label_font, fill=TEXT_DIM)
        x += size + 44

    sheet.alpha_composite(rgba(32).resize((128, 128), Image.NEAREST), (x, 172))
    ImageDraw.Draw(sheet).text((x, 312), "32 × 32 (увеличено ×4)", font=label_font, fill=TEXT_DIM)

    return sheet.convert("RGB")


def main() -> int:
    # Windows-консоль по умолчанию в cp1251: печатаем в UTF-8,
    # иначе скрипт падает на символах вроде «×».
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    out_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / "art"
    out_dir.mkdir(parents=True, exist_ok=True)

    icons = {size: render_icon(size) for size in (576, 278, 150, 96, 32)}

    for name, size in (("icon-universal-576.png", 576), ("icon-catalog-278.png", 278),
                       ("icon-small-150.png", 150), ("icon-loading-fallback-96.png", 96),
                       ("favicon-32.png", 32)):
        path = out_dir / name
        icons[size].save(path, "PNG", optimize=True)
        print(f"{name:26} {size}×{size:<5} {path.stat().st_size / 1024:7.1f} КБ")

    snippet = render_snippet()
    for name, kwargs in (("snippet-1120x630.png", {"optimize": True}),
                         ("snippet-1120x630.jpg", {"quality": 92, "optimize": True,
                                                   "progressive": True})):
        path = out_dir / name
        snippet.save(path, **kwargs)
        print(f"{name:26} 1120×630 {path.stat().st_size / 1024:7.1f} КБ")

    sheet_path = out_dir / "preview-icon-sizes.png"
    render_contact_sheet(icons).save(sheet_path, "PNG", optimize=True)
    print(f"{sheet_path.name:26} превью для проверки читаемости")

    background_path = out_dir / "preview-icon-background.png"
    render_background_preview(icons[576]).save(background_path, "PNG", optimize=True)
    print(f"{background_path.name:26} превью фона под иконкой")

    favicon_kb = (out_dir / "favicon-32.png").stat().st_size / 1024
    if favicon_kb > 50:
        print(f"ВНИМАНИЕ: фавикон больше 50 КБ ({favicon_kb:.1f} КБ)")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
