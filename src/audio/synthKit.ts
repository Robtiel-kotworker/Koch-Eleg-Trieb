import type { LoadedSample } from './types';

export const INIT_KIT_PACK_ID = 'init-kit';
export const INIT_KIT_PACK_NAME = 'Init Kit (built-in)';

const SAMPLE_RATE = 44100;

function offlineCtx(duration: number): OfflineAudioContext {
  return new OfflineAudioContext(1, Math.ceil(SAMPLE_RATE * duration), SAMPLE_RATE);
}

function whiteNoiseBuffer(ctx: BaseAudioContext, duration: number): AudioBuffer {
  const frameCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frameCount; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function expEnvelope(ctx: OfflineAudioContext, peak: number, duration: number): GainNode {
  const env = ctx.createGain();
  env.gain.setValueAtTime(peak, 0);
  env.gain.exponentialRampToValueAtTime(0.0001, duration);
  return env;
}

/** Pitched membrane hit: sine/triangle with a falling pitch envelope (kick/toms/perc). */
function membrane(
  ctx: OfflineAudioContext,
  startFreq: number,
  endFreq: number,
  duration: number,
  gain: number,
  type: OscillatorType = 'sine',
): void {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(startFreq, 0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), duration);
  const env = expEnvelope(ctx, gain, duration);
  osc.connect(env).connect(ctx.destination);
  osc.start(0);
  osc.stop(duration);
}

/** Filtered noise burst (hi-hats, snare body, cymbals, shaker). */
function noiseHit(
  ctx: OfflineAudioContext,
  duration: number,
  gain: number,
  filterType: BiquadFilterType,
  freq: number,
  q = 0.7,
  delay = 0,
): void {
  const src = ctx.createBufferSource();
  src.buffer = whiteNoiseBuffer(ctx, duration + delay);
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const env = expEnvelope(ctx, gain, duration);
  src.connect(filter).connect(env).connect(ctx.destination);
  src.start(delay);
  src.stop(delay + duration);
}

/** Short metallic tone made of a few inharmonic square partials (cowbell, clave, ride). */
function metallic(ctx: OfflineAudioContext, freqs: number[], duration: number, gain: number): void {
  for (const f of freqs) {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = f;
    const env = expEnvelope(ctx, gain / freqs.length, duration);
    osc.connect(env).connect(ctx.destination);
    osc.start(0);
    osc.stop(duration);
  }
}

interface KitVoiceDef {
  id: string;
  name: string;
  duration: number;
  build: (ctx: OfflineAudioContext) => void;
}

const KIT_VOICES: KitVoiceDef[] = [
  {
    id: 'kick',
    name: 'Kick',
    duration: 0.5,
    build: (ctx) => {
      membrane(ctx, 150, 45, 0.35, 1);
      noiseHit(ctx, 0.02, 0.5, 'lowpass', 400);
    },
  },
  {
    id: 'snare',
    name: 'Snare',
    duration: 0.3,
    build: (ctx) => {
      membrane(ctx, 200, 120, 0.12, 0.35, 'triangle');
      noiseHit(ctx, 0.22, 0.8, 'bandpass', 1800, 0.8);
    },
  },
  {
    id: 'closed-hat',
    name: 'Closed Hat',
    duration: 0.08,
    build: (ctx) => noiseHit(ctx, 0.06, 0.6, 'highpass', 7000, 0.9),
  },
  {
    id: 'open-hat',
    name: 'Open Hat',
    duration: 0.45,
    build: (ctx) => noiseHit(ctx, 0.4, 0.55, 'highpass', 6500, 0.8),
  },
  {
    id: 'clap',
    name: 'Clap',
    duration: 0.35,
    build: (ctx) => {
      noiseHit(ctx, 0.08, 0.6, 'bandpass', 1200, 1.2, 0);
      noiseHit(ctx, 0.08, 0.6, 'bandpass', 1200, 1.2, 0.02);
      noiseHit(ctx, 0.08, 0.6, 'bandpass', 1200, 1.2, 0.04);
      noiseHit(ctx, 0.25, 0.5, 'bandpass', 1200, 1.0, 0.06);
    },
  },
  {
    id: 'rimshot',
    name: 'Rimshot',
    duration: 0.12,
    build: (ctx) => {
      membrane(ctx, 900, 400, 0.05, 0.5, 'square');
      noiseHit(ctx, 0.04, 0.4, 'highpass', 3000);
    },
  },
  {
    id: 'low-tom',
    name: 'Low Tom',
    duration: 0.35,
    build: (ctx) => membrane(ctx, 130, 70, 0.3, 0.9),
  },
  {
    id: 'mid-tom',
    name: 'Mid Tom',
    duration: 0.32,
    build: (ctx) => membrane(ctx, 190, 100, 0.28, 0.9),
  },
  {
    id: 'hi-tom',
    name: 'Hi Tom',
    duration: 0.28,
    build: (ctx) => membrane(ctx, 260, 140, 0.24, 0.9),
  },
  {
    id: 'cowbell',
    name: 'Cowbell',
    duration: 0.3,
    build: (ctx) => metallic(ctx, [540, 800], 0.28, 0.6),
  },
  {
    id: 'clave',
    name: 'Clave',
    duration: 0.1,
    build: (ctx) => membrane(ctx, 2500, 2200, 0.08, 0.6, 'sine'),
  },
  {
    id: 'crash',
    name: 'Crash',
    duration: 1.6,
    build: (ctx) => {
      noiseHit(ctx, 1.5, 0.45, 'highpass', 5000, 0.5);
      metallic(ctx, [3200, 4700, 6300], 1.4, 0.25);
    },
  },
  {
    id: 'ride',
    name: 'Ride',
    duration: 0.8,
    build: (ctx) => {
      noiseHit(ctx, 0.7, 0.3, 'highpass', 6000, 0.6);
      metallic(ctx, [2600, 4200], 0.7, 0.3);
    },
  },
  {
    id: 'shaker',
    name: 'Shaker',
    duration: 0.12,
    build: (ctx) => noiseHit(ctx, 0.1, 0.45, 'bandpass', 8000, 1.5),
  },
  {
    id: 'conga',
    name: 'Conga',
    duration: 0.22,
    build: (ctx) => membrane(ctx, 320, 200, 0.18, 0.8),
  },
  {
    id: 'sub-bass',
    name: 'Sub Bass',
    duration: 0.45,
    build: (ctx) => membrane(ctx, 60, 50, 0.4, 1, 'sine'),
  },
];

/**
 * Renders the built-in "Init Kit" once, entirely in-memory via
 * OfflineAudioContext synthesis. No network or disk access is required,
 * so this kit is always available even fully offline.
 */
export async function renderInitKit(): Promise<LoadedSample[]> {
  const results = await Promise.all(
    KIT_VOICES.map(async (voice) => {
      const ctx = offlineCtx(voice.duration);
      voice.build(ctx);
      const buffer = await ctx.startRendering();
      const sample: LoadedSample = {
        id: `${INIT_KIT_PACK_ID}:${voice.id}`,
        name: voice.name,
        packId: INIT_KIT_PACK_ID,
        packName: INIT_KIT_PACK_NAME,
        builtIn: true,
        buffer,
      };
      return sample;
    }),
  );
  return results;
}
