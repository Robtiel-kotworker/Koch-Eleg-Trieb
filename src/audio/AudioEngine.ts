import type { VoiceOptions } from './types';

/** How long a choked voice takes to fade out before being stopped, in seconds. */
const CHOKE_FADE_S = 0.01;

interface ActiveVoice {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

/**
 * Thin wrapper around a single shared AudioContext + master bus.
 * The context is created lazily because browsers require a user gesture
 * before audio can start.
 */
class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private readonly activeVoicesByChokeGroup = new Map<string, ActiveVoice>();

  get context(): AudioContext {
    if (!this.ctx) {
      const ctx = new AudioContext();
      const master = ctx.createGain();
      master.gain.value = 0.85;
      master.connect(ctx.destination);
      this.ctx = ctx;
      this.masterGain = master;
    }
    return this.ctx;
  }

  private get master(): GainNode {
    void this.context;
    return this.masterGain as GainNode;
  }

  /** Must be called from a user gesture handler (click, keydown) before playback starts. */
  async resume(): Promise<void> {
    const ctx = this.context;
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
  }

  setMasterVolume(value: number): void {
    const ctx = this.context;
    this.master.gain.setTargetAtTime(value, ctx.currentTime, 0.01);
  }

  /** Decode raw audio file data into an AudioBuffer usable by playVoice. */
  async decode(data: ArrayBuffer): Promise<AudioBuffer> {
    return this.context.decodeAudioData(data);
  }

  /**
   * Trigger a one-shot playback of `buffer` with per-voice pitch, filter,
   * pan and amp-envelope shaping. Fully self-cleaning: all nodes are
   * garbage-collected once the voice finishes.
   */
  playVoice(buffer: AudioBuffer, opts: VoiceOptions): void {
    const ctx = this.context;
    const t = Math.max(opts.time, ctx.currentTime);

    if (opts.chokeGroup) {
      this.choke(opts.chokeGroup, t);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const rate = Math.pow(2, opts.pitchSemitones / 12);
    source.playbackRate.value = rate;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = opts.filterCutoff;
    filter.Q.value = opts.filterResonance;

    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, opts.pan));

    const gain = ctx.createGain();
    const peak = Math.max(0.0001, Math.min(1, opts.velocity * opts.level));
    const attack = Math.max(0.002, opts.attack);
    const rawDuration = buffer.duration / rate;
    const release = Math.max(0.005, Math.min(opts.release, rawDuration));
    const sustainEnd = Math.max(t + attack, t + rawDuration - release);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + attack);
    gain.gain.setValueAtTime(peak, sustainEnd);
    gain.gain.linearRampToValueAtTime(0.0001, sustainEnd + release);

    source.connect(filter).connect(panner).connect(gain).connect(this.master);
    source.start(t);
    source.stop(t + rawDuration + 0.05);

    const chokeGroup = opts.chokeGroup;
    if (chokeGroup) {
      this.activeVoicesByChokeGroup.set(chokeGroup, { source, gain });
    }
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      panner.disconnect();
      gain.disconnect();
      if (chokeGroup && this.activeVoicesByChokeGroup.get(chokeGroup)?.source === source) {
        this.activeVoicesByChokeGroup.delete(chokeGroup);
      }
    };
  }

  /** Fades out and stops whatever voice is currently active for this choke group, if any. */
  private choke(chokeGroup: string, atTime: number): void {
    const active = this.activeVoicesByChokeGroup.get(chokeGroup);
    if (!active) return;
    this.activeVoicesByChokeGroup.delete(chokeGroup);
    try {
      active.gain.gain.cancelScheduledValues(atTime);
      active.gain.gain.setValueAtTime(active.gain.gain.value, atTime);
      active.gain.gain.linearRampToValueAtTime(0.0001, atTime + CHOKE_FADE_S);
      active.source.stop(atTime + CHOKE_FADE_S + 0.005);
    } catch {
      // Voice may have already finished/stopped on its own; nothing to do.
    }
  }
}

export const audioEngine = new AudioEngine();
