import { CDN } from '../cdn.js';

const get = (u, t = 'text') => fetch(u).then(r => { if (!r.ok) throw Error(`Falha: ${u}`); return r[t](); });
const cjs = (code, req) => { const m = { exports: {} }; Function('module', 'exports', 'require', code)(m, m.exports, req); return m.exports; };
const dec = new OfflineAudioContext(1, 1, 44100);
let p;

export const loadTTS = () => p ??= (async () => {
  const B = CDN.mespeak;
  const [es, ix, cfg, pt] = await Promise.all([get(B + 'src/ESpeak.js'), get(B + 'src/index.js'), get(B + 'src/mespeak_config.json', 'json'), get(B + 'voices/pt.json', 'json')]);
  const E = cjs(es), ms = cjs(ix, () => E);
  ms.loadConfig(cfg); ms.loadVoice(pt);
  return ms;
})();

// texto -> AudioBuffer (44.1kHz mono)
export async function speak(text, { variant = '', pitch = 50, speed = 160, gap = 0 } = {}) {
  const ms = await loadTTS();
  const ab = ms.speak(text, { voice: 'pt', rawdata: 'arraybuffer', variant, pitch, speed, wordgap: gap, amplitude: 120 });
  if (!ab) throw Error('TTS falhou');
  return dec.decodeAudioData(ab);
}
