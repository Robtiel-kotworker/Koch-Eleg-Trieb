import type { VoiceOptions } from './types';

/** How long a stopped/choked voice takes to fade out before being stopped, in seconds. */
const FADE_OUT_S = 0.01;
/** Reserved choke group for sample-browser/cloud-library previews, so only one ever plays at once. */
const PREVIEW_CHOKE_GROUP = '__preview__';
/** Previews never play longer than this, regardless of the sample's own length. */
const PREVIEW_MAX_DURATION_S = 5;

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
  private readonly activeVoices = new Set<ActiveVoice>();
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

  /** Taps the master bus into `node`, e.g. for recording everything that's audible. */
  tapMaster(node: AudioNode): void {
    this.master.connect(node);
  }

  /** Removes a tap previously attached via {@link tapMaster}. */
  untapMaster(node: AudioNode): void {
    try {
      this.master.disconnect(node);
    } catch {
      // Already disconnected; nothing to do.
    }
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
    const naturalDuration = buffer.duration / rate;
    const rawDuration = Math.min(naturalDuration, opts.maxDuration ?? Infinity);
    const release = Math.max(0.005, Math.min(opts.release, rawDuration));
    const sustainEnd = Math.max(t + attack, t + rawDuration - release);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + attack);
    gain.gain.setValueAtTime(peak, sustainEnd);
    gain.gain.linearRampToValueAtTime(0.0001, sustainEnd + release);

    source.connect(filter).connect(panner).connect(gain).connect(this.master);
    source.start(t);
    source.stop(t + rawDuration + 0.05);

    const voice: ActiveVoice = { source, gain };
    this.activeVoices.add(voice);
    const chokeGroup = opts.chokeGroup;
    if (chokeGroup) {
      this.activeVoicesByChokeGroup.set(chokeGroup, voice);
    }
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      panner.disconnect();
      gain.disconnect();
      this.activeVoices.delete(voice);
      if (chokeGroup && this.activeVoicesByChokeGroup.get(chokeGroup) === voice) {
        this.activeVoicesByChokeGroup.delete(chokeGroup);
      }
    };
  }

  /**
   * Plays a sample preview (Sample Browser / Cloud Library): capped to
   * {@link PREVIEW_MAX_DURATION_S} regardless of the sample's own length,
   * and always hard-cuts whatever preview was playing before it so previews
   * never overlap.
   */
  playPreview(buffer: AudioBuffer): void {
    this.playVoice(buffer, {
      time: this.context.currentTime,
      velocity: 1,
      level: 1,
      pan: 0,
      pitchSemitones: 0,
      filterCutoff: 20000,
      filterResonance: 0.7,
      attack: 0.002,
      release: 0.05,
      chokeGroup: PREVIEW_CHOKE_GROUP,
      maxDuration: PREVIEW_MAX_DURATION_S,
    });
  }

  /** Immediately fades out and stops every currently playing voice (e.g. on transport stop). */
  stopAllVoices(): void {
    const now = this.context.currentTime;
    for (const voice of Array.from(this.activeVoices)) {
      this.fadeAndStop(voice, now);
    }
  }

  /** Fades out and stops whatever voice is currently active for this choke group, if any. */
  private choke(chokeGroup: string, atTime: number): void {
    const active = this.activeVoicesByChokeGroup.get(chokeGroup);
    if (!active) return;
    this.activeVoicesByChokeGroup.delete(chokeGroup);
    this.fadeAndStop(active, atTime);
  }

  private fadeAndStop(voice: ActiveVoice, atTime: number): void {
    try {
      voice.gain.gain.cancelScheduledValues(atTime);
      voice.gain.gain.setValueAtTime(voice.gain.gain.value, atTime);
      voice.gain.gain.linearRampToValueAtTime(0.0001, atTime + FADE_OUT_S);
      voice.source.stop(atTime + FADE_OUT_S + 0.005);
    } catch {
      // Voice may have already finished/stopped on its own; nothing to do.
    }
  }
}

export const audioEngine = new AudioEngine();
