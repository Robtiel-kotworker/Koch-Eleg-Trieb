/** A decoded, ready-to-play sample plus the metadata needed to list and select it. */
export interface SampleMeta {
  id: string;
  name: string;
  packId: string;
  packName: string;
  /** Built-in samples are synthesized at startup and never need network/disk access. */
  builtIn: boolean;
}

export interface LoadedSample extends SampleMeta {
  buffer: AudioBuffer;
}

/** A user-imported collection of samples, persisted in IndexedDB. */
export interface SamplePack {
  id: string;
  name: string;
  createdAt: number;
}

export interface VoiceOptions {
  /** Absolute AudioContext time to trigger the voice at. */
  time: number;
  /** Step velocity, 0..1. */
  velocity: number;
  /** Part level, 0..1. */
  level: number;
  /** Stereo position, -1..1. */
  pan: number;
  /** Pitch offset in semitones. */
  pitchSemitones: number;
  /** Lowpass filter cutoff in Hz. */
  filterCutoff: number;
  /** Filter resonance (Q). */
  filterResonance: number;
  /** Amp envelope attack, seconds. */
  attack: number;
  /** Amp envelope release, seconds. */
  release: number;
}
