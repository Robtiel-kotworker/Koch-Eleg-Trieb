export interface Step {
  on: boolean;
  /** 0..1 */
  velocity: number;
  /** Semitone offset added to the part's pitch for this step only ("param lock"). */
  pitch: number;
}

export interface Part {
  id: number;
  name: string;
  sampleId: string | null;
  /** 0..1 */
  level: number;
  /** -1..1 */
  pan: number;
  /** Semitones, -24..24 */
  pitch: number;
  /** Hz, 200..20000 */
  filterCutoff: number;
  /** Q, 0.1..20 */
  filterResonance: number;
  /** Seconds */
  attack: number;
  /** Seconds */
  release: number;
  mute: boolean;
  solo: boolean;
  steps: Step[];
}

export interface Pattern {
  id: string;
  name: string;
  stepCount: number;
  parts: Part[];
}

export const PART_COUNT = 16;
export const MAX_STEPS = 16;
