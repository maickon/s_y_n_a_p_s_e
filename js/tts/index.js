import { CDN } from '../cdn.js';
import { speak as espeak } from './mespeak.js';
import { decode, fromPCM } from '../audio/util.js';

// catálogo de vozes por motor
const ES = { m1: 'Masculina 1', m2: 'Masculina 2', m3: 'Masculina 3', m4: 'Masculina 4', m5: 'Masculina 5', m6: 'Masculina 6', m7: 'Masculina 7', f1: 'Feminina 1', f2: 'Feminina 2', f3: 'Feminina 3', f4: 'Feminina 4', f5: 'Feminina 5', klatt3: 'Klatt (sintética)', croak: 'Rouca', whisper: 'Sussurro', '': 'Padrão' };
const KO = { af_heart: 'Heart ♀', af_bella: 'Bella ♀', af_nova: 'Nova ♀', af_sky: 'Sky ♀', am_michael: 'Michael ♂', am_fenrir: 'Fenrir ♂', am_onyx: 'Onyx ♂', am_echo: 'Echo ♂', bf_emma: 'Emma ♀ (UK)', bm_george: 'George ♂ (UK)', bm_fable: 'Fable ♂ (UK)' };
export const VOICES = {
  'Português natural (Piper · IA ~60MB)': { 'piper:pt_BR-faber-medium': 'Faber ♂ (pt-BR)', 'piper:pt_BR-edresson-low': 'Edresson ♂ (pt-BR)', 'piper:pt_PT-tugão-medium': 'Tugão ♂ (pt-PT)' },
  'Sintética eSpeak (instantânea)': Object.fromEntries(Object.entries(ES).map(([k, v]) => ['espeak:' + k, v])),
  'Kokoro (IA ~90MB · somente inglês)': Object.fromEntries(Object.entries(KO).map(([k, v]) => ['kokoro:' + k, v]))
};

let piper, kokoro;
const engines = {
  async espeak(text, v, speed) { return { buf: await espeak(text, { variant: v, pitch: 45, speed: Math.round(165 * speed) }), native: true }; },
  async piper(text, v, speed, prog) {
    const tts = await (piper ??= import(CDN.piper).catch(e => { piper = null; throw e; }));
    return { buf: await decode(await (await tts.predict({ text, voiceId: v }, prog)).arrayBuffer()) };
  },
  async kokoro(text, v, speed, prog) {
    const tts = await (kokoro ??= import(CDN.kokoro).then(m => m.KokoroTTS.from_pretrained(CDN.kokoroModel, { dtype: 'q8', device: 'wasm', progress_callback: prog })).catch(e => { kokoro = null; throw e; }));
    const a = await tts.generate(text, { voice: v, speed });
    return { buf: await fromPCM(a.audio, a.sampling_rate), native: true };
  }
};

// -> { buf: AudioBuffer 44.1k mono, native: motor já aplicou a velocidade, fallback? }
export async function synth(text, voice, speed = 1, onProgress) {
  const [eng, v] = voice.split(':');
  try { return await engines[eng](text, v, speed, onProgress); }
  catch (e) {
    if (eng === 'espeak') throw e;
    console.warn(`Motor ${eng} indisponível, usando eSpeak`, e);
    return { ...(await engines.espeak(text, 'm3', speed)), fallback: true };
  }
}
