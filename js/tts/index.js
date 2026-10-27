import { CDN } from '../cdn.js';
import { speak as espeak } from './mespeak.js';
import { decode, fromPCM } from '../audio/util.js';
import { isDesktop, call, onDownload } from '../native.js';
import * as store from '../core/store.js';

// catálogo de vozes por motor
const ES = { m1: 'Masculina 1', m2: 'Masculina 2', m3: 'Masculina 3', m4: 'Masculina 4', m5: 'Masculina 5', m6: 'Masculina 6', m7: 'Masculina 7', f1: 'Feminina 1', f2: 'Feminina 2', f3: 'Feminina 3', f4: 'Feminina 4', f5: 'Feminina 5', klatt3: 'Klatt (sintética)', croak: 'Rouca', whisper: 'Sussurro', '': 'Padrão' };
const KO = { af_heart: 'Heart ♀', af_bella: 'Bella ♀', af_nova: 'Nova ♀', af_sky: 'Sky ♀', am_michael: 'Michael ♂', am_fenrir: 'Fenrir ♂', am_onyx: 'Onyx ♂', am_echo: 'Echo ♂', bf_emma: 'Emma ♀ (UK)', bm_george: 'George ♂ (UK)', bm_fable: 'Fable ♂ (UK)' };
export const VOICES = {
  'Português natural (Piper · IA ~60MB)': { 'piper:pt_BR-faber-medium': 'Faber ♂ (pt-BR)', 'piper:pt_BR-edresson-low': 'Edresson ♂ (pt-BR)', 'piper:pt_PT-tugão-medium': 'Tugão ♂ (pt-PT)' },
  'Sintética eSpeak (instantânea)': Object.fromEntries(Object.entries(ES).map(([k, v]) => ['espeak:' + k, v])),
  ...isDesktop && { 'Neural desktop (Python · opcional)': { 'neural:kokoro:pf_dora': 'Dora ♀ (pt-BR)', 'neural:kokoro:pm_alex': 'Alex ♂ (pt-BR)', 'neural:kokoro:pm_santa': 'Santa ♂ (pt-BR)', 'neural:xtts:clone': 'Sua voz (clonagem XTTS)' } },
  'Kokoro (IA ~90MB · somente inglês)': Object.fromEntries(Object.entries(KO).map(([k, v]) => ['kokoro:' + k, v]))
};

let piper, kokoro, noNative = false;
export const engineState = { native: null, error: '' }; // exibido em Sistema
// vozes neurais: main define install(engine) -> bool; refTag muda quando a amostra de voz muda (invalida o cache)
export const neural = { install: null, installing: {} };
export let refTag = await store.get('voiceRefTag') || '';
export async function setRef(wav) { await store.set('voiceRef', wav); refTag = Date.now().toString(36); await store.set('voiceRefTag', refTag); }
const engines = {
  async espeak(text, v, speed) { return { buf: await espeak(text, { variant: v, pitch: 45, speed: Math.round(165 * speed) }), native: true }; },
  async piper(text, v, speed, prog) {
    if (isDesktop && !noNative) try { onDownload(prog); const r = { buf: await decode(await call('piper_tts', { text, voice: v, speed })), native: true }; engineState.native = true; return r; } // nativo: rápido e velocidade sem distorção
    catch (e) { console.warn('Piper nativo falhou, usando o do navegador', e); noNative = true; engineState.native = false; engineState.error = String(e).slice(0, 200); }
    const tts = await (piper ??= import(CDN.piper).catch(e => { piper = null; throw e; }));
    return { buf: await decode(await (await tts.predict({ text, voiceId: v }, prog)).arrayBuffer()) };
  },
  async neural(text, v, speed) {
    const [engine, voice] = v.split(':'), ref = engine === 'xtts' ? await store.get('voiceRef') : null;
    if (engine === 'xtts' && !ref) throw Error('Envie uma amostra da sua voz (aba Voz)');
    const go = async () => call('neural_tts', new Uint8Array(ref ? await ref.arrayBuffer() : 0), { headers: { engine, voice, text: encodeURIComponent(text), speed: '' + speed } });
    try { return { buf: await decode(await go()), native: true }; }
    catch (e) {
      if (!/NOT_INSTALLED/.test(e) || !neural.install) throw e;
      if (!await (neural.installing[engine] ??= neural.install(engine).finally(() => delete neural.installing[engine]))) throw Error('instalação cancelada');
      return { buf: await decode(await go()), native: true };
    }
  },
  async kokoro(text, v, speed, prog) {
    const tts = await (kokoro ??= import(CDN.kokoro).then(m => m.KokoroTTS.from_pretrained(CDN.kokoroModel, { dtype: 'q8', device: 'wasm', progress_callback: prog })).catch(e => { kokoro = null; throw e; }));
    const a = await tts.generate(text, { voice: v, speed });
    return { buf: await fromPCM(a.audio, a.sampling_rate), native: true };
  }
};

// -> { buf: AudioBuffer 44.1k mono, native: motor já aplicou a velocidade, fallback? }
export async function synth(text, voice, speed = 1, onProgress) {
  const [eng, ...r] = voice.split(':'), v = r.join(':');
  try { return await engines[eng](text, v, speed, onProgress); }
  catch (e) {
    if (eng === 'espeak') throw e;
    console.warn(`Motor ${eng} indisponível, usando eSpeak`, e);
    return { ...(await engines.espeak(text, 'm3', speed)), fallback: true };
  }
}
