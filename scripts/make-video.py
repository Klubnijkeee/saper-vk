#!/usr/bin/env python3
"""Сборка промовидео из кадров, записанных capture-video.mjs.

Что делает:
  1. читает .video-work/manifest.json (кадры + таймкоды);
  2. сжимает длинные статичные паузы — иначе в кадре «зависает» экран победы;
  3. раскладывает кадры в ровные 30 к/с;
  4. добавляет интро и аутро в стиле игры (тот же рисунок, что на иконках);
  5. кодирует MP4 через ffmpeg (из пакета imageio-ffmpeg в .tools).

Запуск: python scripts/make-video.py [--app-id 54919633]
Требуется: dist/, собранный с VITE_DEV_BRIDGE=1, и уже записанные кадры
(node scripts/capture-video.mjs).
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw

SCRIPTS = Path(__file__).resolve().parent
PROJECT = SCRIPTS.parent
WORK = PROJECT / ".video-work"
FRAMES = WORK / "frames"
SEQUENCE = WORK / "sequence"
ART = PROJECT / "art"


def load_make_art():
    """Подключаем рисовалку иконок: у неё та же палитра и примитивы."""
    spec = importlib.util.spec_from_file_location("make_art", SCRIPTS / "make-art.py")
    if spec is None or spec.loader is None:
        raise RuntimeError("не удалось загрузить make-art.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


art = load_make_art()

WIDTH, HEIGHT = 1080, 1920
FPS = 30
MAX_HOLD_SECONDS = 1.1   # дольше этого статичный кадр в видео не держим
INTRO_SECONDS = 1.8
OUTRO_SECONDS = 2.2
FADE_SECONDS = 0.35


def find_ffmpeg() -> str:
    """ffmpeg из локального .tools (ставится один раз)."""
    tools = PROJECT / ".tools"
    if tools.exists():
        for candidate in tools.rglob("ffmpeg-*.exe"):
            return str(candidate)
    found = shutil.which("ffmpeg")
    if found:
        return found
    raise RuntimeError(
        "ffmpeg не найден. Установите локально:\n"
        "  python -m pip install --target .tools imageio-ffmpeg"
    )


def build_card(kind: str, app_id: str) -> Image.Image:
    """Интро и аутро: тёмный фон, мина и название игры."""
    image = art.vertical_gradient(
        WIDTH, HEIGHT, [(0.0, art.BG_TOP), (0.45, art.BG_MID), (1.0, art.BG_BOTTOM)]
    ).convert("RGBA")
    image = art.append_glow(image, (WIDTH * 0.5, -HEIGHT * 0.3, WIDTH * 1.3, HEIGHT * 0.55),
                            art.ACCENT_LIGHT, 34, 140)
    image = art.append_glow(image, (-WIDTH * 0.2, HEIGHT * 0.5, WIDTH * 0.6, HEIGHT * 1.3),
                            art.DANGER, 22, 160)

    draw = ImageDraw.Draw(image)
    center_x = WIDTH / 2

    # мина в клетке — как на иконке приложения
    cell = WIDTH * 0.46
    box = (center_x - cell / 2, HEIGHT * 0.24, center_x + cell / 2, HEIGHT * 0.24 + cell)
    art.closed_cell(draw, box, cell * 0.19, cell / art.APP_CELL)
    art.mine(draw, (center_x, box[1] + cell / 2), cell * 0.3)

    def centered(text: str, y: float, font, fill) -> None:
        width = draw.textlength(text, font=font)
        draw.text((center_x - width / 2, y), text, font=font, fill=fill)

    if kind == "intro":
        centered("Сапёр", HEIGHT * 0.56, art.load_font(112), art.TEXT)
        centered("Магазин подсказок", HEIGHT * 0.635, art.load_font(54), art.GOLD)
        centered("Мины, монеты и три подсказки", HEIGHT * 0.695,
                 art.load_font(32, bold=False), art.TEXT_DIM)
    else:
        centered("Сапёр: Магазин подсказок", HEIGHT * 0.57, art.load_font(62), art.TEXT)
        centered("Мины, монеты и три подсказки", HEIGHT * 0.635,
                 art.load_font(32, bold=False), art.TEXT_DIM)
        centered(f"vk.com/app{app_id}", HEIGHT * 0.71, art.load_font(34), art.ACCENT_LIGHT)

    return image.convert("RGB")


def timeline(frames: list[dict]) -> tuple[list[float], float]:
    """Сжатая шкала времени: длинные паузы укорачиваем, движение не трогаем."""
    times: list[float] = []
    current = 0.0
    previous: float | None = None

    for frame in frames:
        if previous is not None:
            current += min(frame["timestamp"] - previous, MAX_HOLD_SECONDS)
        times.append(current)
        previous = frame["timestamp"]

    return times, current


def main() -> int:
    parser = argparse.ArgumentParser(description="Сборка промовидео")
    parser.add_argument("--app-id", default="54919633", help="идентификатор мини-приложения")
    parser.add_argument("--keep-sequence", action="store_true", help="не удалять кадры после сборки")
    options = parser.parse_args()

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    manifest_path = WORK / "manifest.json"
    if not manifest_path.exists():
        print("нет .video-work/manifest.json — сначала запустите node scripts/capture-video.mjs")
        return 1

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    frames = manifest["frames"]
    times, gameplay_seconds = timeline(frames)

    # Раскладка по 30 к/с: каждому кадру видео достаётся последний снятый кадр.
    total = int(gameplay_seconds * FPS) + 1
    picks: list[int] = []
    pointer = 0
    for index in range(total):
        moment = index / FPS
        while pointer + 1 < len(times) and times[pointer + 1] <= moment:
            pointer += 1
        picks.append(pointer)

    intro_frames = int(INTRO_SECONDS * FPS)
    outro_frames = int(OUTRO_SECONDS * FPS)
    fade_frames = int(FADE_SECONDS * FPS)

    intro = build_card("intro", options.app_id)
    outro = build_card("outro", options.app_id)

    def load_gameplay(path: Path) -> Image.Image:
        """Кадры пишутся в 720×1280 — поднимаем до размера видео."""
        image = Image.open(path).convert("RGB")
        if image.size != (WIDTH, HEIGHT):
            image = image.resize((WIDTH, HEIGHT), Image.LANCZOS)
        return image

    first_gameplay = load_gameplay(FRAMES / frames[picks[0]]["file"])
    last_gameplay = load_gameplay(FRAMES / frames[picks[-1]]["file"])

    shutil.rmtree(SEQUENCE, ignore_errors=True)
    SEQUENCE.mkdir(parents=True, exist_ok=True)

    index = 0

    def emit(image: Image.Image) -> None:
        nonlocal index
        index += 1
        image.save(SEQUENCE / f"frame-{index:05d}.png")

    # интро целиком
    for _ in range(intro_frames):
        emit(intro)

    # растворение интро в игру
    for step in range(fade_frames):
        emit(Image.blend(intro, first_gameplay, (step + 1) / (fade_frames + 1)))

    # сама игра
    for pick in picks:
        emit(load_gameplay(FRAMES / frames[pick]["file"]))

    # растворение игры в аутро
    for step in range(fade_frames):
        emit(Image.blend(last_gameplay, outro, (step + 1) / (fade_frames + 1)))

    for _ in range(outro_frames):
        emit(outro)

    seconds = index / FPS
    output = ART / f"promo-{WIDTH}x{HEIGHT}.mp4"

    command = [
        find_ffmpeg(), "-y",
        "-framerate", str(FPS),
        "-i", str(SEQUENCE / "frame-%05d.png"),
        "-c:v", "libx264",
        "-preset", "slow",
        "-crf", "20",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        str(output),
    ]
    result = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if result.returncode != 0:
        print("ffmpeg упал:")
        print((result.stderr or "").strip()[-1500:])
        return 1

    size_mb = output.stat().st_size / (1024 * 1024)
    print(f"записано кадров: {len(frames)}, игровой отрезок {gameplay_seconds:.1f} с "
          f"(паузы сжаты до {MAX_HOLD_SECONDS:.1f} с)")
    print(f"{output.name:24} {WIDTH}×{HEIGHT}  {seconds:.1f} с  {size_mb:.1f} МБ")

    if seconds > 30:
        print(f"ВНИМАНИЕ: {seconds:.1f} с — панель ВК принимает видео не длиннее 30 с")
        return 1

    if not options.keep_sequence:
        shutil.rmtree(SEQUENCE, ignore_errors=True)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
