// eSpeak (meSpeak) rodando fora da thread da interface
let ms, ready;
const get = (u, t = 'text') => fetch(u).then(r => { if (!r.ok) throw Error(`Falha: ${u}`); return r[t](); });
const cjs = (code, req) => { const m = { exports: {} }; Function('module', 'exports', 'require', code)(m, m.exports, req); return m.exports; };
async function init(B) {
  const [es, ix, cfg, pt] = await Promise.all([get(B + 'src/ESpeak.js'), get(B + 'src/index.js'), get(B + 'src/mespeak_config.json', 'json'), get(B + 'voices/pt.json', 'json')]);
  const E = cjs(es); ms = cjs(ix, () => E);
  ms.loadConfig(cfg); ms.loadVoice(pt);
}
onmessage = async ({ data: d }) => {
  try {
    if (d.init) { await (ready ??= init(d.init)); return postMessage({ id: d.id }); }
    await ready;
    const ab = ms.speak(d.text, { ...d.opts, voice: 'pt', rawdata: 'arraybuffer', amplitude: 120 });
    if (!ab) throw Error('TTS falhou');
    postMessage({ id: d.id, ab }, [ab]);
  } catch (e) { postMessage({ id: d.id, err: String(e?.message || e) }); }
};
