/**
 * Runs on the audio rendering thread. Forwards every render quantum's PCM
 * data (per channel) to the main thread via the message port, using
 * transferable buffers so no copying/GC pressure builds up during long
 * recordings.
 */
class RecorderProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input.length > 0 && input[0].length > 0) {
      const channels = input.map((channel) => channel.slice());
      this.port.postMessage(
        { channels },
        channels.map((channel) => channel.buffer),
      );
    }
    return true;
  }
}

registerProcessor('recorder-processor', RecorderProcessor);
