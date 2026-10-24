import { CDN } from '../cdn.js';

let p, prog;
const asr = () => p ??= import(CDN.transformers).then(({ pipeline, env }) => {
  env.allowLocalModels = false;
  return pipeline('automatic-speech-recognition', CDN.whisper, { device: 'wasm', progress_callback: e => prog?.(e) });
}).catch(e => { p = null; throw e; });

export async function to16k(b) {
  const c = new OfflineAudioContext(1, Math.ceil(b.duration * 16000), 16000), s = new AudioBufferSourceNode(c, { buffer: b });
  s.connect(c.destination); s.start();
  return (await c.startRendering()).getChannelData(0);
}

// AudioBuffer -> [{w, s, e}]
export async function transcribe(buf, onProgress) {
  prog = onProgress;
  const r = await (await asr())(await to16k(buf), { language: 'portuguese', task: 'transcribe', return_timestamps: 'word', chunk_length_s: 30, stride_length_s: 5 });
  return (r.chunks || []).map(c => ({ w: c.text.trim(), s: c.timestamp[0], e: c.timestamp[1] ?? c.timestamp[0] + .3 })).filter(x => x.w && isFinite(x.s));
}
