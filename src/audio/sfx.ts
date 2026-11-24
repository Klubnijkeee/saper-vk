/**
 * Звук на Web Audio API: без файлов, без библиотек, без канваса.
 *
 * Все короткие эффекты синтезируются на лету (осцилляторы + шум). Модуль
 * полностью безопасен: если Web Audio недоступен или контекст не создался —
 * функции молча ничего не делают, игра работает дальше.
 *
 * Браузеры (и веб-вью ВКонтакте) требуют создания AudioContext после жеста
 * пользователя, поэтому `initAudio()` вызывается из первого тапа.
 */

type AudioContextCtor = new () => AudioContext;

let context: AudioContext | null = null;
let output: GainNode | null = null;

/** Инициализация/возобновление звука. Безопасно вызывать на каждый жест. */
export function initAudio(): void {
  if (context !== null) {
    if (context.state === 'suspended') {
      void context.resume().catch(() => undefined);
    }
    return;
  }

  const ctor = getAudioContextCtor();
  if (ctor === null) return;

  try {
    const created = new ctor();
    const master = created.createGain();
    master.gain.value = 0.6;
    master.connect(created.destination);
    context = created;
    output = master;
  } catch {
    context = null;
    output = null;
  }
}

interface AudioHandle {
  readonly ctx: AudioContext;
  readonly out: GainNode;
}

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  const candidate: {
    readonly AudioContext?: AudioContextCtor;
    readonly webkitAudioContext?: AudioContextCtor;
  } = window;
  return candidate.AudioContext ?? candidate.webkitAudioContext ?? null;
}

/** Готовый контекст или `null`, если звук недоступен. */
function audio(): AudioHandle | null {
  initAudio();
  if (context === null || output === null) return null;
  return { ctx: context, out: output };
}

/** Шумовой буфер с линейным затуханием — основа взрыва и «дымка». */
function noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const frames = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  }
  return buffer;
}

/** Короткий «клик» открытия клетки. */
export function playReveal(): void {
  const handle = audio();
  if (handle === null) return;
  const { ctx, out } = handle;
  const t = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(660, t);
  osc.frequency.exponentialRampToValueAtTime(1120, t + 0.05);

  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.15, t + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.085);

  osc.connect(gain);
  gain.connect(out);
  osc.start(t);
  osc.stop(t + 0.1);
}

/** «Бум» взрыва: шумовой удар + низкий уходящий тон. */
export function playExplosion(): void {
  const handle = audio();
  if (handle === null) return;
  const { ctx, out } = handle;
  const t = ctx.currentTime;

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer(ctx, 0.4);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1500, t);
  filter.frequency.exponentialRampToValueAtTime(180, t + 0.35);
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.0001, t);
  noiseGain.gain.exponentialRampToValueAtTime(0.5, t + 0.012);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(out);
  noise.start(t);
  noise.stop(t + 0.42);

  const boom = ctx.createOscillator();
  const boomGain = ctx.createGain();
  boom.type = 'sine';
  boom.frequency.setValueAtTime(165, t);
  boom.frequency.exponentialRampToValueAtTime(42, t + 0.3);
  boomGain.gain.setValueAtTime(0.0001, t);
  boomGain.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
  boomGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
  boom.connect(boomGain);
  boomGain.connect(out);
  boom.start(t);
  boom.stop(t + 0.36);
}

/** Короткая фанфара победы. */
export function playWin(): void {
  const handle = audio();
  if (handle === null) return;
  const { ctx, out } = handle;
  const start = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5];

  notes.forEach((frequency, index) => {
    const at = start + index * 0.09;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.14, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.32);
    osc.connect(gain);
    gain.connect(out);
    osc.start(at);
    osc.stop(at + 0.34);
  });
}

/** Короткий сигнал подсказки «Показать мину»: два быстрых тона вверх. */
export function playHint(): void {
  const handle = audio();
  if (handle === null) return;
  const { ctx, out } = handle;
  const start = ctx.currentTime;
  const notes = [880, 1318.5];

  notes.forEach((frequency, index) => {
    const at = start + index * 0.08;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.15, at + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
    osc.connect(gain);
    gain.connect(out);
    osc.start(at);
    osc.stop(at + 0.18);
  });
}

/** «Пшик» — для подсказок магазина (белый дымок). */
export function playPuff(): void {
  const handle = audio();
  if (handle === null) return;
  const { ctx, out } = handle;
  const t = ctx.currentTime;

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer(ctx, 0.25);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(2600, t);
  filter.frequency.exponentialRampToValueAtTime(700, t + 0.22);
  filter.Q.value = 0.9;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  noise.start(t);
  noise.stop(t + 0.26);
}
