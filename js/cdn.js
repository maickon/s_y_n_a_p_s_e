// URLs das libs: locais (vendor/) ou CDN para runtimes de IA; no app desktop as de IA vêm embutidas (vendor/ai/)
const L = globalThis.__TAURI__ ? new URL('../vendor/ai/', import.meta.url).href : '';
export const CDN = {
  local: L,
  mespeak: new URL('../vendor/mespeak/', import.meta.url).href,
  transformers: L ? L + 'transformers/transformers.min.js' : 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1',
  whisper: 'onnx-community/whisper-base_timestamped'
};
CDN.clip = 'Xenova/clip-vit-base-patch32';
CDN.piper = L ? L + 'vits/vits-web.js' : 'https://cdn.jsdelivr.net/npm/@diffusionstudio/vits-web@1.0.3/dist/vits-web.js';
CDN.kokoro = 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js';
CDN.kokoroModel = 'onnx-community/Kokoro-82M-v1.0-ONNX';
// runtime ONNX do transformers.js embutido (senão ele busca os .wasm no CDN)
export const localWasm = env => { if (L) env.backends.onnx.wasm.wasmPaths = L + 'transformers/'; };
