export interface BpmDetectionResult {
  bpm: number;
  /** 0..1 — how clearly a single dominant beat period stood out. */
  confidence: number;
}

/** Search range for the fundamental beat period. Covers house/techno up through hardcore/gabber. */
const MIN_BPM = 60;
const MAX_BPM = 250;
/** Resolution of the onset envelope, in samples per second. */
const ENVELOPE_RATE = 200;
/** Below this, the strongest autocorrelation peak isn't trusted as a real tempo. */
const CONFIDENCE_THRESHOLD = 0.15;
/**
 * When a peak at roughly half the currently chosen lag scores at least this
 * fraction of the chosen peak's score, prefer the half-lag (double BPM)
 * peak instead. Counters the classic tempo-halving error: a perfectly
 * regular beat correlates strongly at 2x its true period too.
 */
const SHORTEST_PEAK_TOLERANCE = 0.6;

function mixToMonoLowpassed(buffer: AudioBuffer, cutoffHz: number): Promise<Float32Array> {
  const offlineCtx = new OfflineAudioContext(1, buffer.length, buffer.sampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = buffer;
  const filter = offlineCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = cutoffHz;
  filter.Q.value = 0.7;
  source.connect(filter).connect(offlineCtx.destination);
  source.start(0);
  return offlineCtx.startRendering().then((rendered) => rendered.getChannelData(0));
}

/** Per-window RMS amplitude envelope, downsampled from the source rate to ENVELOPE_RATE. */
function computeEnvelope(samples: Float32Array, sourceSampleRate: number): Float32Array {
  const windowSize = Math.max(1, Math.round(sourceSampleRate / ENVELOPE_RATE));
  const numWindows = Math.floor(samples.length / windowSize);
  const envelope = new Float32Array(numWindows);
  for (let i = 0; i < numWindows; i++) {
    let sumSq = 0;
    const start = i * windowSize;
    for (let j = 0; j < windowSize; j++) {
      const s = samples[start + j];
      sumSq += s * s;
    }
    envelope[i] = Math.sqrt(sumSq / windowSize);
  }
  return envelope;
}

/** Half-wave rectified energy flux: emphasizes sudden onsets (kicks/hits), ignores decay. */
function computeNovelty(envelope: Float32Array): Float32Array {
  const novelty = new Float32Array(envelope.length);
  for (let i = 1; i < envelope.length; i++) {
    const diff = envelope[i] - envelope[i - 1];
    novelty[i] = diff > 0 ? diff : 0;
  }
  return novelty;
}

interface AutocorrelationResult {
  lagSamples: number;
  confidence: number;
}

function autocorrelate(signal: Float32Array, minLag: number, maxLag: number): AutocorrelationResult | null {
  let mean = 0;
  for (let i = 0; i < signal.length; i++) mean += signal[i];
  mean /= signal.length;

  const centered = new Float32Array(signal.length);
  for (let i = 0; i < signal.length; i++) centered[i] = signal[i] - mean;

  const scores: number[] = [];
  for (let lag = minLag; lag <= maxLag; lag++) {
    const n = centered.length - lag;
    if (n <= 0) break;
    let sum = 0;
    for (let i = 0; i < n; i++) sum += centered[i] * centered[i + lag];
    scores.push(sum / n);
  }
  if (scores.length < 3) return null;

  let scoreMean = 0;
  for (const s of scores) scoreMean += s;
  scoreMean /= scores.length;
  let variance = 0;
  for (const s of scores) variance += (s - scoreMean) ** 2;
  variance /= scores.length;
  const std = Math.sqrt(variance);
  if (std < 1e-9) return null;

  // Local maxima only: a real beat period shows up as a peak, not just a high plateau.
  const peakIndices: number[] = [];
  for (let i = 1; i < scores.length - 1; i++) {
    if (scores[i] > scores[i - 1] && scores[i] > scores[i + 1]) peakIndices.push(i);
  }
  if (peakIndices.length === 0) return null;

  let bestIndex = peakIndices[0];
  for (const i of peakIndices) if (scores[i] > scores[bestIndex]) bestIndex = i;

  // A perfectly regular beat (e.g. a straight four-on-the-floor kick) is
  // ambiguous with its own subharmonics: the autocorrelation score at twice
  // the true period can legitimately match or even exceed the score at the
  // true period, since every beat still lines up two periods later too.
  // Repeatedly check whether roughly half the current best lag is *also* a
  // strong peak; if so it's more likely the real, faster fundamental, so
  // prefer it. This targets genuine octave relationships specifically,
  // rather than just grabbing any nearby shorter lag.
  const findNearestPeak = (target: number, tolerance: number): number | null => {
    let nearest: number | null = null;
    for (const i of peakIndices) {
      if (Math.abs(i - target) <= tolerance) {
        if (nearest === null || Math.abs(i - target) < Math.abs(nearest - target)) nearest = i;
      }
    }
    return nearest;
  };

  let chosenIndex = bestIndex;
  for (let guard = 0; guard < 4; guard++) {
    // Halve in absolute lag space, then convert back to an index (indices
    // are offset from minLag, so halving the index directly would target
    // the wrong lag entirely).
    const chosenLag = minLag + chosenIndex;
    const halfIndexTarget = chosenLag / 2 - minLag;
    if (halfIndexTarget < 0) break;
    const candidate = findNearestPeak(halfIndexTarget, 3);
    if (candidate === null || candidate >= chosenIndex) break;
    if (scores[candidate] < scores[chosenIndex] * SHORTEST_PEAK_TOLERANCE) break;
    chosenIndex = candidate;
  }

  const zScore = (scores[chosenIndex] - scoreMean) / std;
  const confidence = Math.max(0, Math.min(1, zScore / 6));

  return { lagSamples: minLag + chosenIndex, confidence };
}

/**
 * Estimates the tempo of an audio buffer via onset-autocorrelation: a
 * lowpass-filtered, rectified energy-flux envelope is correlated against
 * itself over the plausible beat-period range, and the shortest strongly
 * periodic lag is reported as the tempo. Returns null when no reliable
 * periodicity is found (single one-shot hits, silence, non-rhythmic audio)
 * rather than guessing a number.
 */
export async function detectBpm(buffer: AudioBuffer): Promise<BpmDetectionResult | null> {
  const minDurationS = (60 / MIN_BPM) * 2;
  if (buffer.duration < minDurationS) return null;

  const filtered = await mixToMonoLowpassed(buffer, 150);
  const envelope = computeEnvelope(filtered, buffer.sampleRate);
  const novelty = computeNovelty(envelope);

  const minLag = Math.floor((60 / MAX_BPM) * ENVELOPE_RATE);
  const maxLag = Math.ceil((60 / MIN_BPM) * ENVELOPE_RATE);
  const result = autocorrelate(novelty, minLag, maxLag);
  if (!result || result.confidence < CONFIDENCE_THRESHOLD) return null;

  const bpm = 60 / (result.lagSamples / ENVELOPE_RATE);
  return { bpm: Math.round(bpm * 10) / 10, confidence: result.confidence };
}
