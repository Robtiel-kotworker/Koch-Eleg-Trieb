import { Mp3Encoder } from '@breezystack/lamejs';

/** Samples per MP3 frame; lamejs expects buffers chunked at (roughly) this size. */
const SAMPLES_PER_FRAME = 1152;
const BITRATE_KBPS = 192;

function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

/** Encodes an AudioBuffer (mono or stereo) to an MP3 Blob. */
export function encodeMp3(buffer: AudioBuffer): Blob {
  const channels = Math.min(2, buffer.numberOfChannels);
  const encoder = new Mp3Encoder(channels, buffer.sampleRate, BITRATE_KBPS);
  const left = floatTo16BitPCM(buffer.getChannelData(0));
  const right = channels === 2 ? floatTo16BitPCM(buffer.getChannelData(1)) : undefined;

  const chunks: Uint8Array[] = [];
  for (let i = 0; i < left.length; i += SAMPLES_PER_FRAME) {
    const leftChunk = left.subarray(i, i + SAMPLES_PER_FRAME);
    const rightChunk = right?.subarray(i, i + SAMPLES_PER_FRAME);
    const encoded = encoder.encodeBuffer(leftChunk, rightChunk);
    if (encoded.length > 0) chunks.push(encoded);
  }
  const tail = encoder.flush();
  if (tail.length > 0) chunks.push(tail);

  return new Blob(
    chunks.map((c) => new Uint8Array(c)),
    { type: 'audio/mpeg' },
  );
}
