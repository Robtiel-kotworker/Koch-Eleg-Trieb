export interface AutoSyncResult {
  /** Pitch/rate shift needed to stretch the sample onto the matched beat fraction. */
  semitones: number;
  /** The sample's onset-to-tail length, ignoring leading/trailing near-silence. */
  effectiveLengthMs: number;
  /** Human-readable label for the beat fraction the sample was matched to. */
  targetLabel: string;
}

/** Resolution of the amplitude envelope used to find the sample's onset/tail, in windows per second. */
const ENVELOPE_RATE = 200;
/** Envelope must rise above this fraction of the peak to count as "started". */
const ONSET_THRESHOLD_RATIO = 0.05;
/** Envelope must fall below this fraction of the peak to count as "decayed away". */
const TAIL_THRESHOLD_RATIO = 0.02;

const BEAT_FRACTIONS: { fraction: number; label: string }[] = [
  { fraction: 0.125, label: '1/8 Beat' },
  { fraction: 0.25, label: '1/4 Beat' },
  { fraction: 0.5, label: '1/2 Beat' },
  { fraction: 1, label: '1 Beat' },
  { fraction: 2, label: '2 Beats' },
  { fraction: 4, label: '1 Takt' },
  { fraction: 8, label: '2 Takte' },
];

function computeEnvelope(buffer: AudioBuffer): Float32Array {
  const windowSize = Math.max(1, Math.round(buffer.sampleRate / ENVELOPE_RATE));
  const numWindows = Math.floor(buffer.length / windowSize);
  const envelope = new Float32Array(numWindows);
  const channels = buffer.numberOfChannels;
  for (let w = 0; w < numWindows; w++) {
    let sumSq = 0;
    const start = w * windowSize;
    for (let ch = 0; ch < channels; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < windowSize; i++) sumSq += data[start + i] ** 2;
    }
    envelope[w] = Math.sqrt(sumSq / (windowSize * channels));
  }
  return envelope;
}

/** Trims leading/trailing near-silence, returning the onset..tail window in envelope-index space. */
function findEffectiveRange(envelope: Float32Array): { startIndex: number; endIndex: number } | null {
  let peak = 0;
  for (const v of envelope) if (v > peak) peak = v;
  if (peak < 1e-6) return null;

  const onsetThreshold = peak * ONSET_THRESHOLD_RATIO;
  const tailThreshold = peak * TAIL_THRESHOLD_RATIO;

  let startIndex = 0;
  while (startIndex < envelope.length && envelope[startIndex] < onsetThreshold) startIndex++;

  let endIndex = envelope.length - 1;
  while (endIndex > startIndex && envelope[endIndex] < tailThreshold) endIndex--;

  if (endIndex <= startIndex) return null;
  return { startIndex, endIndex };
}

/**
 * Fits a sample onto the project's beat grid by length rather than by
 * detecting an existing rhythm in it. Measures the sample's actual
 * onset-to-tail duration (trimming silence padding), finds the musical beat
 * fraction (1/8 beat .. 2 bars) it's closest to at the current project BPM,
 * and returns the pitch/rate shift that stretches it exactly onto that
 * fraction. Unlike tempo autodetection this works for single hits and other
 * very short samples that have no periodicity to correlate against.
 */
export function detectAutoSyncTarget(buffer: AudioBuffer, projectBpm: number): AutoSyncResult | null {
  const envelope = computeEnvelope(buffer);
  const range = findEffectiveRange(envelope);
  if (!range) return null;

  const effectiveLengthSeconds = (range.endIndex - range.startIndex) / ENVELOPE_RATE;
  if (effectiveLengthSeconds <= 0) return null;

  const beatSeconds = 60 / projectBpm;
  let best = BEAT_FRACTIONS[0];
  let bestDistance = Infinity;
  for (const candidate of BEAT_FRACTIONS) {
    const targetSeconds = candidate.fraction * beatSeconds;
    const distance = Math.abs(Math.log2(effectiveLengthSeconds / targetSeconds));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }

  const targetSeconds = best.fraction * beatSeconds;
  const rate = effectiveLengthSeconds / targetSeconds;
  const semitones = Math.round(12 * Math.log2(rate) * 10) / 10;

  return {
    semitones,
    effectiveLengthMs: Math.round(effectiveLengthSeconds * 1000),
    targetLabel: best.label,
  };
}
