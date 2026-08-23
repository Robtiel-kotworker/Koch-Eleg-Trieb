import { INIT_KIT_PACK_ID } from '../audio/synthKit';
import { MAX_STEPS, PART_COUNT, type Pattern, type Part, type Step } from './types';

const INIT_KIT_VOICE_IDS = [
  'kick',
  'snare',
  'closed-hat',
  'open-hat',
  'clap',
  'rimshot',
  'low-tom',
  'mid-tom',
  'hi-tom',
  'cowbell',
  'clave',
  'crash',
  'ride',
  'shaker',
  'conga',
  'sub-bass',
];

function emptySteps(): Step[] {
  return Array.from({ length: MAX_STEPS }, () => ({ on: false, velocity: 0.85, pitch: 0 }));
}

function defaultPart(index: number): Part {
  const voiceId = INIT_KIT_VOICE_IDS[index % INIT_KIT_VOICE_IDS.length];
  return {
    id: index,
    name: voiceId
      .split('-')
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(' '),
    color: null,
    sampleId: `${INIT_KIT_PACK_ID}:${voiceId}`,
    level: 0.85,
    pan: 0,
    pitch: 0,
    filterCutoff: 20000,
    filterResonance: 0.7,
    attack: 0.002,
    release: 0.3,
    mute: false,
    solo: false,
    choke: false,
    steps: emptySteps(),
  };
}

export function createDefaultPattern(id: string, name: string): Pattern {
  return {
    id,
    name,
    stepCount: 16,
    parts: Array.from({ length: PART_COUNT }, (_, i) => defaultPart(i)),
  };
}

/** A simple four-on-the-floor starter beat so the app makes sound immediately. */
export function createDemoPattern(id: string, name: string): Pattern {
  const pattern = createDefaultPattern(id, name);
  const on = (partIndex: number, steps: number[], velocity = 0.9) => {
    const part = pattern.parts[partIndex];
    for (const s of steps) part.steps[s] = { on: true, velocity, pitch: 0 };
  };
  on(0, [0, 4, 8, 12]); // kick
  on(2, [2, 6, 10, 14], 0.7); // closed hat on off-beats
  on(2, [0, 4, 8, 12], 0.5);
  on(1, [4, 12], 0.85); // snare
  return pattern;
}
