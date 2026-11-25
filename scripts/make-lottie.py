#!/usr/bin/env python3
"""Генератор анимированной иконки (Lottie JSON) для панели ВКонтакте.

Панель принимает анимированную иконку 96×96 px в формате Lottie JSON
не больше 24 КБ. Рисуем её кодом, а не в редакторе: композиция описана
числами, поэтому её можно пересобрать и поправить одной командой.

Что показывает анимация: мина на тёмной плашке и красное кольцо-спиннер,
которое делает оборот за 2 секунды. Это универсальный «идёт загрузка»:
кольцо читается как прогресс, мина — как игра.

Запуск: python scripts/make-lottie.py [каталог]
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

# ── Палитра (совпадает с src/styles.css и scripts/make-art.py) ───────────────

PLATE = (26, 26, 26)        # #1A1A1A — фон плашки
PLATE_BORDER = (42, 42, 42)  # #2A2A2A — обводка плашки
DANGER = (255, 90, 95)      # #FF5A5F — кольцо-спиннер
MINE_BALL = (11, 11, 11)    # #0B0B0B — шар мины
MINE_SPIKE = (232, 232, 232)  # #E8E8E8 — шипы и окантовка
MINE_GLINT = (176, 176, 176)  # #B0B0B0 — блик

# ── Геометрия (холст 96×96) ─────────────────────────────────────────────────

SIZE = 96
CENTER = SIZE / 2.0
FPS = 30
FRAMES = 60                 # 2 секунды, затем цикл повторяется

PLATE_SIZE = 94.0
PLATE_RADIUS = 21.0
PLATE_STROKE = 2.0

RING_RADIUS = 34.0
RING_STROKE = 3.0
RING_SWEEP = 25.0           # четверть оборота — «загрузка»

MINE_TIP = 24.0             # радиус по кончикам шипов
MINE_INNER = 15.5           # откуда начинается шип
MINE_SPIKE_WIDTH = 4.5
MINE_BALL_RADIUS = 15.0
MINE_BALL_STROKE = 2.5
MINE_GLINT_RADIUS = 3.4
MINE_GLINT_OFFSET = -5.5


def color(rgb: tuple[int, int, int], alpha: float = 1.0) -> list[float]:
    """Цвет Lottie: 0..1 на канал, четвёртый — прозрачность."""
    return [round(channel / 255.0, 4) for channel in rgb] + [round(alpha, 4)]


def static(value: float | list[float], index: int) -> dict:
    """Свойство без анимации."""
    return {"a": 0, "k": value, "ix": index}


def linear(from_value: float, to_value: float, start: int, end: int) -> dict:
    """Линейная анимация одного числа между двумя кадрами."""
    return {
        "a": 1,
        "k": [
            {
                "t": start,
                "s": [from_value],
                "e": [to_value],
                "i": {"x": [0.5], "y": [0.5]},
                "o": {"x": [0.5], "y": [0.5]},
            },
            {"t": end, "s": [to_value]},
        ],
        "ix": 6,
    }


def rotation_keyframes() -> dict:
    """Оборот на 360° четырьмя шагами по 90° — так движение равномерное."""
    steps = [(0, 0, 90), (15, 90, 180), (30, 180, 270), (45, 270, 360)]
    keyframes = []
    for frame, start, end in steps:
        keyframes.append(
            {
                "t": frame,
                "s": [start],
                "e": [end],
                "i": {"x": [0.5], "y": [0.5]},
                "o": {"x": [0.5], "y": [0.5]},
            }
        )
    keyframes.append({"t": FRAMES, "s": [360]})
    return {"a": 1, "k": keyframes, "ix": 10}


def pulse_keyframes() -> dict:
    """Пульс мины: 100% → 107% → 100% за цикл."""
    return {
        "a": 1,
        "k": [
            {
                "t": 0,
                "s": [100, 100, 100],
                "e": [107, 107, 100],
                "i": {"x": [0.34], "y": [1]},
                "o": {"x": [0.16], "y": [1]},
            },
            {
                "t": 30,
                "s": [107, 107, 100],
                "e": [100, 100, 100],
                "i": {"x": [0.5], "y": [1]},
                "o": {"x": [0.5], "y": [1]},
            },
            {"t": FRAMES, "s": [100, 100, 100]},
        ],
        "ix": 6,
    }


def layer(index: int, name: str, shapes: list[dict], **transforms) -> dict:
    """Слой фигур с общими трансформациями."""
    # Точка привязки — начало координат слоя, а позиция — центр холста.
    # Если поставить привязку в центр, трансформация «сдвиг минус привязка»
    # обнулится и фигуры уедут в левый верхний угол.
    transform = {
        "o": static(100, 11),
        "r": transforms.get("rotation", static(0, 10)),
        "p": static([CENTER, CENTER, 0], 2),
        "a": static([0, 0, 0], 1),
        "s": transforms.get("scale", static([100, 100, 100], 6)),
    }
    return {
        "ddd": 0,
        "ind": index,
        "ty": 4,
        "nm": name,
        "sr": 1,
        "ks": transform,
        "ao": 0,
        "shapes": shapes,
        "ip": 0,
        "op": FRAMES,
        "st": 0,
        "bm": 0,
    }


def fill(rgb: tuple[int, int, int], alpha: float = 1.0) -> dict:
    return {
        "ty": "fl",
        "c": static(color(rgb, alpha), 4),
        "o": static(100, 5),
        "r": 1,
        "bm": 0,
        "nm": "Заливка",
    }


def stroke(rgb: tuple[int, int, int], width: float, alpha: float = 1.0) -> dict:
    return {
        "ty": "st",
        "c": static(color(rgb, alpha), 3),
        "o": static(100, 4),
        "w": static(width, 5),
        "lc": 2,   # круглые концы
        "lj": 2,   # круглые стыки
        "bm": 0,
        "nm": "Обводка",
    }


def group(name: str, items: list[dict]) -> dict:
    """Группа фигур: фигуры, заливка/обводка, трансформация."""
    return {
        "ty": "gr",
        "nm": name,
        "it": items + [{"ty": "tr", "p": static([0, 0], 2), "a": static([0, 0], 1),
                        "s": static([100, 100], 3), "r": static(0, 6),
                        "o": static(100, 7), "sk": static(0, 4), "sa": static(0, 5),
                        "nm": "Трансформация"}],
        "np": len(items),
        "bm": 0,
        "hd": False,
    }


def plate_layer() -> dict:
    """Плашка: скруглённый квадрат с тонкой обводкой."""
    rectangle = {
        "ty": "rc",
        "d": 1,
        "s": static([PLATE_SIZE, PLATE_SIZE], 2),
        "p": static([0, 0], 3),
        "r": static(PLATE_RADIUS, 4),
        "nm": "Плашка",
        "hd": False,
    }
    return layer(
        5,
        "plate",
        [group("plate", [rectangle, fill(PLATE), stroke(PLATE_BORDER, PLATE_STROKE)])],
    )


def ring_layer() -> dict:
    """Кольцо-спиннер: дуга в четверть оборота, вращается по кругу."""
    ellipse = {
        "ty": "el",
        "d": 1,
        "s": static([RING_RADIUS * 2, RING_RADIUS * 2], 2),
        "p": static([0, 0], 3),
        "nm": "Кольцо",
        "hd": False,
    }
    trim = {
        "ty": "tm",
        "s": static(0, 1),
        "e": static(RING_SWEEP, 2),
        "o": static(0, 3),
        "m": 1,
        "nm": "Дуга",
        "hd": False,
    }
    return layer(
        4,
        "ring",
        [group("ring", [ellipse, trim, stroke(DANGER, RING_STROKE)])],
        rotation=rotation_keyframes(),
    )


def spike_path() -> dict:
    """Восемь шипов мины: восемь открытых отрезков от центра наружу."""
    vertices = []
    for index in range(8):
        angle = math.radians(index * 45)
        cos, sin = math.cos(angle), math.sin(angle)
        vertices.append([round(MINE_INNER * cos, 3), round(MINE_INNER * sin, 3)])
        vertices.append([round(MINE_TIP * cos, 3), round(MINE_TIP * sin, 3)])
    return {
        "ty": "sh",
        "ks": static({"i": [[0, 0]] * len(vertices), "o": [[0, 0]] * len(vertices),
                      "v": vertices, "c": False}, 2),
        "nm": "Шипы",
        "hd": False,
    }


def spikes_layer() -> dict:
    return layer(
        3,
        "spikes",
        [group("spikes", [spike_path(), stroke(MINE_SPIKE, MINE_SPIKE_WIDTH)])],
        scale=pulse_keyframes(),
    )


def ball_layer() -> dict:
    circle = {
        "ty": "el",
        "d": 1,
        "s": static([MINE_BALL_RADIUS * 2, MINE_BALL_RADIUS * 2], 2),
        "p": static([0, 0], 3),
        "nm": "Шар",
        "hd": False,
    }
    return layer(
        2,
        "ball",
        [group("ball", [circle, fill(MINE_BALL), stroke(MINE_SPIKE, MINE_BALL_STROKE)])],
        scale=pulse_keyframes(),
    )


def glint_layer() -> dict:
    circle = {
        "ty": "el",
        "d": 1,
        "s": static([MINE_GLINT_RADIUS * 2, MINE_GLINT_RADIUS * 2], 2),
        "p": static([MINE_GLINT_OFFSET, MINE_GLINT_OFFSET], 3),
        "nm": "Блик",
        "hd": False,
    }
    return layer(
        1,
        "glint",
        [group("glint", [circle, fill(MINE_GLINT)])],
        scale=pulse_keyframes(),
    )


def build() -> dict:
    """Lottie: первый слой в массиве рисуется поверх остальных."""
    return {
        "v": "5.7.4",
        "fr": FPS,
        "ip": 0,
        "op": FRAMES,
        "w": SIZE,
        "h": SIZE,
        "nm": "Сапёр: загрузка",
        "ddd": 0,
        "assets": [],
        "layers": [
            glint_layer(),
            ball_layer(),
            spikes_layer(),
            ring_layer(),
            plate_layer(),
        ],
        "markers": [],
    }


def check(animation: dict, payload: bytes) -> list[str]:
    """Проверки, которые панель ВК применит при загрузке."""
    problems = []

    if animation["w"] != SIZE or animation["h"] != SIZE:
        problems.append(f"холст {animation['w']}×{animation['h']}, нужен {SIZE}×{SIZE}")
    if len(payload) > 24 * 1024:
        problems.append(f"размер {len(payload) / 1024:.1f} КБ, лимит 24 КБ")
    if not animation["layers"]:
        problems.append("нет слоёв")
    if animation["op"] <= animation["ip"]:
        problems.append("длительность анимации нулевая")

    for item in animation["layers"]:
        if item["op"] <= item["ip"]:
            problems.append(f"слой «{item['nm']}» пустой")

    return problems


def build_preview_strip(out_dir: Path) -> Path | None:
    """Собрать кадры проверки в одну полосу — по ней видно, как идёт анимация.

    Кадры пишет scripts/verify-lottie.mjs (рендер в настоящем Chrome).
    """
    from PIL import Image  # импорт здесь: PIL нужен только для превью

    frames_dir = out_dir / "preview-loading"
    if not frames_dir.exists():
        return None

    picks = ["frame-00.png", "frame-15.png", "frame-30.png", "frame-45.png"]
    images = []
    for name in picks:
        path = frames_dir / name
        if not path.exists():
            return None
        images.append(Image.open(path).convert("RGB"))

    width, height = images[0].size
    gap = 12
    strip = Image.new("RGB", (width * len(images) + gap * (len(images) - 1), height), (12, 12, 12))
    for index, image in enumerate(images):
        strip.paste(image, (index * (width + gap), 0))

    path = out_dir / "preview-loading-strip.png"
    strip.save(path, "PNG", optimize=True)
    return path


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    out_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / "art"
    out_dir.mkdir(parents=True, exist_ok=True)

    animation = build()
    # separators без пробелов: панель считает байты, а не «красоту»
    payload = json.dumps(animation, ensure_ascii=False, separators=(",", ":")).encode("utf-8")

    path = out_dir / "icon-loading-96.json"
    path.write_bytes(payload)

    problems = check(animation, payload)
    print(f"{path.name:26} {SIZE}×{SIZE}  {len(payload) / 1024:6.1f} КБ  "
          f"{len(animation['layers'])} слоёв  {FRAMES / FPS:.0f} с")

    if problems:
        for problem in problems:
            print(f"ОШИБКА: {problem}")
        return 1

    print("проверки пройдены: холст 96×96, размер в лимите 24 КБ, слои непустые")

    strip = build_preview_strip(out_dir)
    if strip is not None:
        print(f"{strip.name} — полоса кадров анимации")
    else:
        print("полоса кадров не собрана: нет art/preview-loading "
              "(сначала node scripts/verify-lottie.mjs)")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
