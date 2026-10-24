// URLs das libs: locais (vendor/) ou CDN para runtimes de IA
export const CDN = {
  mespeak: new URL('../vendor/mespeak/', import.meta.url).href,
  transformers: 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1',
  whisper: 'onnx-community/whisper-base_timestamped'
};
CDN.clip = 'Xenova/clip-vit-base-patch32';
CDN.piper = 'https://cdn.jsdelivr.net/npm/@diffusionstudio/vits-web@1.0.3/dist/vits-web.js';
CDN.kokoro = 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js';
CDN.kokoroModel = 'onnx-community/Kokoro-82M-v1.0-ONNX';
