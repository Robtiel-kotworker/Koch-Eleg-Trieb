import { useEffect, useRef, useState } from 'react';
import { audioEngine } from './AudioEngine';
import { Scheduler } from './scheduler';
import { useAppStore } from '../state/store';

/**
 * Owns the Scheduler instance and bridges it to React: starts/stops it in
 * response to the `playing` flag, and exposes a throttled `currentStep`
 * for UI highlighting. All step-trigger logic reads the store fresh via
 * `getState()` on every tick, so it never sees stale closures.
 */
export function useSequencer() {
  const schedulerRef = useRef<Scheduler | null>(null);
  const [currentStep, setCurrentStep] = useState<number | null>(null);
  const playing = useAppStore((s) => s.playing);

  useEffect(() => {
    const scheduler = new Scheduler(
      audioEngine.context,
      () => {
        const state = useAppStore.getState();
        const pattern = state.patterns.find((p) => p.id === state.currentPatternId);
        return { bpm: state.bpm, swing: state.swing, stepCount: pattern?.stepCount ?? 16 };
      },
      (step, time) => {
        const state = useAppStore.getState();
        const pattern = state.patterns.find((p) => p.id === state.currentPatternId);
        if (!pattern) return;
        const anySolo = pattern.parts.some((p) => p.solo);
        for (const part of pattern.parts) {
          if (part.mute) continue;
          if (anySolo && !part.solo) continue;
          const stepData = part.steps[step];
          if (!stepData?.on) continue;
          const sample = state.samples.find((s) => s.id === part.sampleId);
          if (!sample) continue;
          audioEngine.playVoice(sample.buffer, {
            time,
            velocity: stepData.velocity,
            level: part.level,
            pan: part.pan,
            pitchSemitones: part.pitch + stepData.pitch,
            filterCutoff: part.filterCutoff,
            filterResonance: part.filterResonance,
            attack: part.attack,
            release: part.release,
            chokeGroup: part.choke ? `part:${part.id}` : undefined,
          });
        }
      },
    );
    schedulerRef.current = scheduler;
    return () => scheduler.stop();
  }, []);

  useEffect(() => {
    const scheduler = schedulerRef.current;
    if (!scheduler) return;
    if (playing) {
      scheduler.start();
    } else {
      scheduler.stop();
    }
  }, [playing]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let lastStep: number | null = null;
    const loop = () => {
      const step = schedulerRef.current?.displayStep() ?? null;
      if (step !== lastStep) {
        lastStep = step;
        setCurrentStep(step);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const togglePlay = async (): Promise<void> => {
    await audioEngine.resume();
    const state = useAppStore.getState();
    state.setPlaying(!state.playing);
  };

  return { currentStep: playing ? currentStep : null, playing, togglePlay };
}
