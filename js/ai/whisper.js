import { CDN, localWasm } from '../cdn.js';
import { isDesktop, call, onDownload } from '../native.js';

let p, prog;
const asr = () => p ??= import(CDN.transformers).then(({ pipeline, env }) => {
  env.allowLocalModels = false; localWasm(env);
  return pipeline('automatic-speech-recognition', CDN.whisper, { device: 'wasm', progress_callback: e => prog?.(e) });
}).catch(e => { p = null; throw e; });

export async function to16k(b) {
  const c = new OfflineAudioContext(1, Math.ceil(b.duration * 16000), 16000), s = new AudioBufferSourceNode(c, { buffer: b });
  s.connect(c.destination); s.start();
  return (await c.startRendering()).getChannelData(0);
}

// AudioBuffer -> [{w, s, e}]
let noNative = false;
export async function transcribe(buf, onProgress) {
  prog = onProgress;
  if (isDesktop && !noNative) try { // whisper.cpp nativo (modelo small, mais preciso e rápido)
    onDownload(d => d.total && onProgress?.({ status: 'progress', file: 'whisper.onnx', progress: d.loaded / d.total * 100 }));
    return (await call('whisper', new Uint8Array((await to16k(buf)).slice().buffer))).filter(x => x.w && isFinite(x.s));
  } catch (e) { console.warn('Whisper nativo falhou, usando o do navegador', e); noNative = true; }
  const r = await (await asr())(await to16k(buf), { language: 'portuguese', task: 'transcribe', return_timestamps: 'word', chunk_length_s: 30, stride_length_s: 5 });
  return (r.chunks || []).map(c => ({ w: c.text.trim(), s: c.timestamp[0], e: c.timestamp[1] ?? c.timestamp[0] + .3 })).filter(x => x.w && isFinite(x.s));
}
