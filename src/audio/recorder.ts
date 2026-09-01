import { audioEngine } from './AudioEngine';

let workletModuleLoaded: Promise<void> | null = null;

function ensureWorkletLoaded(): Promise<void> {
  if (!workletModuleLoaded) {
    const url = new URL('./recorderProcessor.js', import.meta.url);
    workletModuleLoaded = audioEngine.context.audioWorklet.addModule(url);
  }
  return workletModuleLoaded;
}

interface RecorderMessage {
  channels: Float32Array[];
}

/**
 * Records everything passing through the app's master bus (sequencer
 * playback, live pad previews, ...) via an AudioWorklet tap, sample-accurate
 * to what was actually audible. `stop()` concatenates the captured render
 * quanta into a single AudioBuffer.
 */
export class MasterRecorder {
  private node: AudioWorkletNode | null = null;
  private silentGain: GainNode | null = null;
  private chunks: Float32Array[][] = [];
  private channelCount = 2;
  private recording = false;

  get isRecording(): boolean {
    return this.recording;
  }

  async start(): Promise<void> {
    if (this.recording) return;
    await ensureWorkletLoaded();
    const ctx = audioEngine.context;

    const node = new AudioWorkletNode(ctx, 'recorder-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: 2,
      channelCountMode: 'explicit',
      channelInterpretation: 'speakers',
    });
    this.chunks = [];
    node.port.onmessage = (event: MessageEvent<RecorderMessage>) => {
      this.channelCount = event.data.channels.length;
      this.chunks.push(event.data.channels);
    };

    // Route through a zero-gain node to the destination so the worklet
    // keeps processing (some browsers stop nodes with no path to the
    // destination) without anything becoming audibly louder.
    const silentGain = ctx.createGain();
    silentGain.gain.value = 0;
    node.connect(silentGain);
    silentGain.connect(ctx.destination);

    audioEngine.tapMaster(node);

    this.node = node;
    this.silentGain = silentGain;
    this.recording = true;
  }

  /** Stops recording and returns the captured audio, or null if nothing was captured. */
  stop(): AudioBuffer | null {
    if (!this.recording || !this.node) return null;
    this.recording = false;

    audioEngine.untapMaster(this.node);
    this.node.port.onmessage = null;
    this.node.disconnect();
    this.silentGain?.disconnect();
    this.node = null;
    this.silentGain = null;

    const totalFrames = this.chunks.reduce((sum, chunk) => sum + chunk[0].length, 0);
    if (totalFrames === 0) {
      this.chunks = [];
      return null;
    }

    const buffer = new AudioBuffer({
      numberOfChannels: this.channelCount,
      length: totalFrames,
      sampleRate: audioEngine.context.sampleRate,
    });

    for (let ch = 0; ch < this.channelCount; ch++) {
      const merged = new Float32Array(totalFrames);
      let offset = 0;
      for (const chunk of this.chunks) {
        merged.set(chunk[ch], offset);
        offset += chunk[ch].length;
      }
      buffer.copyToChannel(merged, ch);
    }

    this.chunks = [];
    return buffer;
  }
}
