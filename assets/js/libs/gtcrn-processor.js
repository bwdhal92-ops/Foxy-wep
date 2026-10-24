import { GtcrnProcessor, loadGtcrnModule } from "./gtcrn-wasm.js";

class GtcrnAudioProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.frameSize = 768;
    this.inputFrame = new Float32Array(this.frameSize);
    this.outputFrame = new Float32Array(this.frameSize);
    this.inputIndex = 0;
    this.outputIndex = this.frameSize;
    this.ready = false;
    this.failed = false;
    this.wasmBinary = options?.processorOptions?.wasmBinary || null;
    this.port.onmessage = (event) => {
      if (event.data?.type === "bypass") this.bypass = !!event.data.value;
    };
    this.initialize();
  }

  async initialize() {
    try {
      const module = await loadGtcrnModule({ wasmBinary: this.wasmBinary });
      this.denoiser = new GtcrnProcessor(module, { sampleRate: 48000 });
      this.ready = true;
      this.port.postMessage({ type: "ready" });
    } catch (error) {
      this.failed = true;
      this.port.postMessage({ type: "error", error: error?.message || String(error) });
    }
  }

  process(inputs, outputs) {
    const input = inputs[0]?.[0];
    const output = outputs[0]?.[0];
    if (!input || !output) return true;

    if (!this.ready || this.failed || this.bypass) {
      output.set(input);
      return true;
    }

    for (let i = 0; i < input.length; i++) {
      this.inputFrame[this.inputIndex++] = input[i];
      if (this.inputIndex === this.frameSize) {
        this.outputFrame = this.denoiser.process(this.inputFrame);
        this.inputIndex = 0;
        this.outputIndex = 0;
      }
      output[i] = this.outputIndex < this.frameSize ? this.outputFrame[this.outputIndex++] : 0;
    }
    return true;
  }
}

registerProcessor("gtcrn-audio-processor", GtcrnAudioProcessor);
