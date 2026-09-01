/** Resolution of the amplitude envelope used to find onset/tail, in windows per second. */
const ENVELOPE_RATE = 200;
/** Envelope must be below this fraction of the recording's peak to count as silence. */
const SILENCE_THRESHOLD_RATIO = 0.02;

/**
 * Trims leading/trailing near-silence from a recording. Returns a new,
 * shorter AudioBuffer; if the recording is silent throughout, or trimming
 * would remove everything, the original buffer is returned unchanged.
 */
export function trimSilence(buffer: AudioBuffer): AudioBuffer {
  const channels = buffer.numberOfChannels;
  const windowSize = Math.max(1, Math.round(buffer.sampleRate / ENVELOPE_RATE));
  const numWindows = Math.floor(buffer.length / windowSize);
  if (numWindows < 2) return buffer;

  const envelope = new Float32Array(numWindows);
  for (let w = 0; w < numWindows; w++) {
    let sumSq = 0;
    const start = w * windowSize;
    for (let ch = 0; ch < channels; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < windowSize; i++) sumSq += data[start + i] ** 2;
    }
    envelope[w] = Math.sqrt(sumSq / (windowSize * channels));
  }

  let peak = 0;
  for (const v of envelope) if (v > peak) peak = v;
  if (peak < 1e-6) return buffer;

  const threshold = peak * SILENCE_THRESHOLD_RATIO;
  let startWindow = 0;
  while (startWindow < envelope.length && envelope[startWindow] < threshold) startWindow++;
  let endWindow = envelope.length - 1;
  while (endWindow > startWindow && envelope[endWindow] < threshold) endWindow--;
  if (endWindow <= startWindow) return buffer;

  const startSample = startWindow * windowSize;
  const endSample = Math.min(buffer.length, (endWindow + 1) * windowSize);
  const trimmedLength = endSample - startSample;
  if (trimmedLength <= 0 || trimmedLength >= buffer.length) return buffer;

  const trimmed = new AudioBuffer({ numberOfChannels: channels, length: trimmedLength, sampleRate: buffer.sampleRate });
  for (let ch = 0; ch < channels; ch++) {
    trimmed.copyToChannel(buffer.getChannelData(ch).subarray(startSample, endSample), ch);
  }
  return trimmed;
}
