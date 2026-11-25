// Forwards microphone samples to the main thread, tagged with the frame
// they arrived at, so we can line them up against scheduled clicks.
class RecorderProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) this.port.postMessage({ frame: currentFrame, data: ch.slice(0) });
    return true;
  }
}
registerProcessor('recorder', RecorderProcessor);
