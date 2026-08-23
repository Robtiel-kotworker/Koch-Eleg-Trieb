import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { audioEngine } from '../audio/AudioEngine';
import { renderInitKit } from '../audio/synthKit';
import { listPacks, loadAllUserSamples } from '../audio/sampleStore';
import type { LoadedSample, SamplePack } from '../audio/types';
import { createDefaultPattern, createDemoPattern } from './defaultPattern';
import type { Part, Pattern, Step } from './types';

function randomId(): string {
  return crypto.randomUUID();
}

function mapPart(pattern: Pattern, partId: number, fn: (part: Part) => Part): Pattern {
  return { ...pattern, parts: pattern.parts.map((p) => (p.id === partId ? fn(p) : p)) };
}

function mapStep(part: Part, stepIndex: number, fn: (step: Step) => Step): Part {
  return { ...part, steps: part.steps.map((s, i) => (i === stepIndex ? fn(s) : s)) };
}

interface AppState {
  patterns: Pattern[];
  currentPatternId: string;
  bpm: number;
  swing: number;
  masterVolume: number;
  selectedPartId: number;

  playing: boolean;
  audioReady: boolean;
  samples: LoadedSample[];
  packs: SamplePack[];
  /** Sample id -> last auto-detected tempo, so re-selecting a sample remembers it. */
  detectedBpmBySampleId: Record<string, number>;

  init: () => Promise<void>;
  setPlaying: (playing: boolean) => void;

  toggleStep: (partId: number, stepIndex: number) => void;
  setStepVelocity: (partId: number, stepIndex: number, velocity: number) => void;
  setStepPitch: (partId: number, stepIndex: number, pitch: number) => void;
  clearPart: (partId: number) => void;

  setPartName: (partId: number, name: string) => void;
  setPartSample: (partId: number, sampleId: string) => void;
  setPartLevel: (partId: number, level: number) => void;
  setPartPan: (partId: number, pan: number) => void;
  setPartPitch: (partId: number, pitch: number) => void;
  setPartFilterCutoff: (partId: number, cutoff: number) => void;
  setPartFilterResonance: (partId: number, resonance: number) => void;
  setPartAttack: (partId: number, attack: number) => void;
  setPartRelease: (partId: number, release: number) => void;
  toggleMute: (partId: number) => void;
  toggleSolo: (partId: number) => void;
  toggleChoke: (partId: number) => void;

  setStepCount: (count: number) => void;
  setBpm: (bpm: number) => void;
  setSwing: (swing: number) => void;
  setMasterVolume: (volume: number) => void;
  selectPart: (partId: number) => void;

  newPattern: () => void;
  duplicateCurrentPattern: () => void;
  deletePattern: (id: string) => void;
  renamePattern: (id: string, name: string) => void;
  selectPattern: (id: string) => void;

  refreshSamplesFromDb: () => Promise<void>;
  addLoadedSamples: (samples: LoadedSample[]) => void;
  addPack: (pack: SamplePack) => void;
  removePackFromState: (packId: string) => void;
  removeSampleFromState: (sampleId: string) => void;

  setDetectedBpm: (sampleId: string, bpm: number) => void;
}

function updateCurrentPattern(state: AppState, fn: (pattern: Pattern) => Pattern): Pick<AppState, 'patterns'> {
  return {
    patterns: state.patterns.map((p) => (p.id === state.currentPatternId ? fn(p) : p)),
  };
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      patterns: [createDemoPattern('pattern-1', 'Pattern 1')],
      currentPatternId: 'pattern-1',
      bpm: 120,
      swing: 0,
      masterVolume: 0.85,
      selectedPartId: 0,

      playing: false,
      audioReady: false,
      samples: [],
      packs: [],
      detectedBpmBySampleId: {},

      init: async () => {
        const [initKit, userSamples, packs] = await Promise.all([
          renderInitKit(),
          loadAllUserSamples(),
          listPacks(),
        ]);
        set({ samples: [...initKit, ...userSamples], packs, audioReady: true });
      },

      setPlaying: (playing) => set({ playing }),

      toggleStep: (partId, stepIndex) =>
        set((state) =>
          updateCurrentPattern(state, (pattern) =>
            mapPart(pattern, partId, (part) => mapStep(part, stepIndex, (step) => ({ ...step, on: !step.on }))),
          ),
        ),

      setStepVelocity: (partId, stepIndex, velocity) =>
        set((state) =>
          updateCurrentPattern(state, (pattern) =>
            mapPart(pattern, partId, (part) => mapStep(part, stepIndex, (step) => ({ ...step, velocity }))),
          ),
        ),

      setStepPitch: (partId, stepIndex, pitch) =>
        set((state) =>
          updateCurrentPattern(state, (pattern) =>
            mapPart(pattern, partId, (part) => mapStep(part, stepIndex, (step) => ({ ...step, pitch }))),
          ),
        ),

      clearPart: (partId) =>
        set((state) =>
          updateCurrentPattern(state, (pattern) =>
            mapPart(pattern, partId, (part) => ({
              ...part,
              steps: part.steps.map((s) => ({ ...s, on: false })),
            })),
          ),
        ),

      setPartName: (partId, name) =>
        set((state) => updateCurrentPattern(state, (pattern) => mapPart(pattern, partId, (p) => ({ ...p, name })))),
      setPartSample: (partId, sampleId) =>
        set((state) => updateCurrentPattern(state, (pattern) => mapPart(pattern, partId, (p) => ({ ...p, sampleId })))),
      setPartLevel: (partId, level) =>
        set((state) => updateCurrentPattern(state, (pattern) => mapPart(pattern, partId, (p) => ({ ...p, level })))),
      setPartPan: (partId, pan) =>
        set((state) => updateCurrentPattern(state, (pattern) => mapPart(pattern, partId, (p) => ({ ...p, pan })))),
      setPartPitch: (partId, pitch) =>
        set((state) => updateCurrentPattern(state, (pattern) => mapPart(pattern, partId, (p) => ({ ...p, pitch })))),
      setPartFilterCutoff: (partId, filterCutoff) =>
        set((state) => updateCurrentPattern(state, (pattern) => mapPart(pattern, partId, (p) => ({ ...p, filterCutoff })))),
      setPartFilterResonance: (partId, filterResonance) =>
        set((state) =>
          updateCurrentPattern(state, (pattern) => mapPart(pattern, partId, (p) => ({ ...p, filterResonance }))),
        ),
      setPartAttack: (partId, attack) =>
        set((state) => updateCurrentPattern(state, (pattern) => mapPart(pattern, partId, (p) => ({ ...p, attack })))),
      setPartRelease: (partId, release) =>
        set((state) => updateCurrentPattern(state, (pattern) => mapPart(pattern, partId, (p) => ({ ...p, release })))),
      toggleMute: (partId) =>
        set((state) =>
          updateCurrentPattern(state, (pattern) => mapPart(pattern, partId, (p) => ({ ...p, mute: !p.mute }))),
        ),
      toggleSolo: (partId) =>
        set((state) =>
          updateCurrentPattern(state, (pattern) => mapPart(pattern, partId, (p) => ({ ...p, solo: !p.solo }))),
        ),
      toggleChoke: (partId) =>
        set((state) =>
          updateCurrentPattern(state, (pattern) => mapPart(pattern, partId, (p) => ({ ...p, choke: !p.choke }))),
        ),

      setStepCount: (count) =>
        set((state) => updateCurrentPattern(state, (pattern) => ({ ...pattern, stepCount: count }))),
      setBpm: (bpm) => set({ bpm: Math.max(40, Math.min(300, bpm)) }),
      setSwing: (swing) => set({ swing: Math.max(0, Math.min(0.75, swing)) }),
      setMasterVolume: (masterVolume) => {
        audioEngine.setMasterVolume(masterVolume);
        set({ masterVolume });
      },
      selectPart: (selectedPartId) => set({ selectedPartId }),

      newPattern: () =>
        set((state) => {
          const pattern = createDefaultPattern(randomId(), `Pattern ${state.patterns.length + 1}`);
          return { patterns: [...state.patterns, pattern], currentPatternId: pattern.id };
        }),
      duplicateCurrentPattern: () =>
        set((state) => {
          const current = state.patterns.find((p) => p.id === state.currentPatternId);
          if (!current) return state;
          const copy: Pattern = {
            ...current,
            id: randomId(),
            name: `${current.name} copy`,
            parts: current.parts.map((p) => ({ ...p, steps: p.steps.map((s) => ({ ...s })) })),
          };
          return { patterns: [...state.patterns, copy], currentPatternId: copy.id };
        }),
      deletePattern: (id) =>
        set((state) => {
          if (state.patterns.length <= 1) return state;
          const patterns = state.patterns.filter((p) => p.id !== id);
          const currentPatternId = state.currentPatternId === id ? patterns[0].id : state.currentPatternId;
          return { patterns, currentPatternId };
        }),
      renamePattern: (id, name) =>
        set((state) => ({ patterns: state.patterns.map((p) => (p.id === id ? { ...p, name } : p)) })),
      selectPattern: (id) => set({ currentPatternId: id }),

      refreshSamplesFromDb: async () => {
        const [userSamples, packs] = await Promise.all([loadAllUserSamples(), listPacks()]);
        set((state) => ({
          samples: [...state.samples.filter((s) => s.builtIn), ...userSamples],
          packs,
        }));
      },
      addLoadedSamples: (newSamples) =>
        set((state) => {
          const byId = new Map(state.samples.map((s) => [s.id, s]));
          for (const s of newSamples) byId.set(s.id, s);
          return { samples: Array.from(byId.values()) };
        }),
      addPack: (pack) =>
        set((state) => ({
          packs: state.packs.some((p) => p.id === pack.id) ? state.packs : [...state.packs, pack],
        })),
      removePackFromState: (packId) =>
        set((state) => ({
          packs: state.packs.filter((p) => p.id !== packId),
          samples: state.samples.filter((s) => s.packId !== packId),
        })),
      removeSampleFromState: (sampleId) =>
        set((state) => ({ samples: state.samples.filter((s) => s.id !== sampleId) })),

      setDetectedBpm: (sampleId, bpm) =>
        set((state) => ({ detectedBpmBySampleId: { ...state.detectedBpmBySampleId, [sampleId]: bpm } })),
    }),
    {
      name: 'eleg-trieb-clone-state',
      partialize: (state) => ({
        patterns: state.patterns,
        currentPatternId: state.currentPatternId,
        bpm: state.bpm,
        swing: state.swing,
        masterVolume: state.masterVolume,
        selectedPartId: state.selectedPartId,
        detectedBpmBySampleId: state.detectedBpmBySampleId,
      }),
    },
  ),
);
