import { CDN } from '../cdn.js';
import { decode } from '../audio/util.js';

// eSpeak num Web Worker (não trava a interface); se Workers falharem, roda na thread principal
let w, seq = 0, p, main;
const jobs = new Map();
const call = (msg, tr) => new Promise((ok, no) => { const id = ++seq; jobs.set(id, [ok, no]); w.postMessage({ ...msg, id }, tr); });
const get = (u, t = 'text') => fetch(u).then(r => { if (!r.ok) throw Error(`Falha: ${u}`); return r[t](); });
const cjs = (code, req) => { const m = { exports: {} }; Function('module', 'exports', 'require', code)(m, m.exports, req); return m.exports; };

async function loadMain() {
  const B = CDN.mespeak, [es, ix, cfg, pt] = await Promise.all([get(B + 'src/ESpeak.js'), get(B + 'src/index.js'), get(B + 'src/mespeak_config.json', 'json'), get(B + 'voices/pt.json', 'json')]);
  const E = cjs(es), ms = cjs(ix, () => E);
  ms.loadConfig(cfg); ms.loadVoice(pt); main = ms;
}
export const loadTTS = () => p ??= (async () => {
  try {
    w = new Worker(new URL('./espeak.worker.js', import.meta.url));
    w.onerror = e => { jobs.forEach(j => j[1](Error('worker eSpeak'))); jobs.clear(); };
    w.onmessage = ({ data: d }) => { const j = jobs.get(d.id); if (!j) return; jobs.delete(d.id); d.err ? j[1](Error(d.err)) : j[0](d.ab); };
    await call({ init: CDN.mespeak });
  } catch (e) { console.warn('Worker do eSpeak indisponível, usando thread principal', e); w = null; await loadMain(); }
})();

// texto -> AudioBuffer (44.1kHz mono)
export async function speak(text, { variant = '', pitch = 50, speed = 160, gap = 0 } = {}) {
  await loadTTS();
  const opts = { variant, pitch, speed, wordgap: gap };
  const ab = w ? await call({ text, opts }) : main.speak(text, { ...opts, voice: 'pt', rawdata: 'arraybuffer', amplitude: 120 });
  if (!ab) throw Error('TTS falhou');
  return decode(ab);
}
