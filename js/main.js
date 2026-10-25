import { splitScenes, hash } from './core/script.js';
import { buildVoiceTrack } from './core/voicetrack.js';
import { EFFECTS, applyFx } from './audio/fx.js';
import { VOICES, synth, neural, setRef } from './tts/index.js';
import { audition, gallery, stop as stopAud, hooks as audHooks } from './ui/audition.js';
import { PROFILES, previewMusic, previewAmb, previewPack, previewSting, clip } from './audio/preview.js';
import { toWav } from './audio/wav.js';
import { mixdown, mixKey } from './audio/mix.js';
import { pack as packBuf, unpack as unpackBuf } from './audio/bufstore.js';
import { progress as prog, done as progDone } from './ui/toast.js';
import { AMBS } from './audio/ambience.js';
import { searchAudio, decodeAudio } from './media/audiosearch.js';
import { createBg } from './render/bg.js';
import { loadTTS } from './tts/mespeak.js';
import { transcribe } from './ai/whisper.js';
import { align, groups, toSRT } from './core/words.js';
import { createCompositor } from './render/compositor.js';
import { exportMP4 } from './export/mp4.js';
import { exportNative } from './export/ffmpeg.js';
import { exportHyperFrames } from './export/hyperframes.js';
import { direct, INTRO } from './core/direct.js';
import { LAYOUT_NAMES, TRANS_NAMES, GRADES, GRADE_NAMES, setAspect, W as VW, H as VH } from './render/layouts.js';
import { STYLES } from './core/styles.js';
import { PACKS } from './audio/sfx.js';
import { CAP_STYLES, FONTS, PALETTES } from './render/captions.js';
import { VIG_TPL, VIG_SND, VIG_AUTO_SND } from './render/vignette.js';
import { assets, addAsset, removeAsset, parseUrls, plan, searchScene, topicOf, autoQuery, CANDS } from './core/assets.js';
import { PROVIDERS, setConfig, active as activeSrc } from './media/search.js';
import { loadImage } from './media/loader.js';
import { SOURCES as TSRC, EXTERNAL as TEXT, trends } from './media/trends.js';
import { scriptFromTopic, sentences } from './core/scriptgen.js';
import { TYPES, PRESETS, parseScene, formatScript, cardEvents } from './core/vtypes.js';
import { createPlayer } from './ui/player.js';
import { createTimeline } from './ui/timeline.js';
import { enhance, enhanceSelects, refreshRanges, tooltips } from './ui/controls.js';
import { warn, ask, progress, modal } from './ui/modal.js';
import * as store from './core/store.js';
import * as projects from './core/projects.js';
import { isDesktop, info as nativeInfo, call as native, listen } from './native.js';

const $ = id => document.getElementById(id);
const PRESET = `A realidade é apenas uma simulação em baixa resolução.
As máquinas continuam sonhando com circuitos em chamas.
O tempo dobrou sobre si mesmo no limiar do abismo.
Esquecemos o som da chuva antes da entropia final.
Sua consciência foi transcrita com sucesso no servidor do nada.`;

const el = { txt: $('script-input'), voice: $('voice-select'), style: $('style-select'), pitch: $('voice-pitch'), rate: $('voice-rate') };
let cv = $('view-canvas'), bg = createBg(), comp = await createCompositor(cv, bg.canvas);
const frame = (t, o) => { bg.draw(); comp.render(t, o); };
const EXP = ['btn-export', 'btn-wav', 'btn-srt', 'btn-mp4', 'btn-hf'];
let ctx, rec, track, caps = [], segsCur = [], mix, music = null, busy = false, P = [], dir = {}, variation = 0, ov = [];

// status no topo + painel flutuante (etapas em andamento)
const status = (t, c = 'bg-zinc-600', p) => { $('status-text').textContent = t; $('status-indicator').className = `w-2 h-2 rounded-full ${c}`; if (!/animate-pulse/.test(c)) return progDone();
  const m = t.match(/ (\d+)\/(\d+)$/), L = t.replace(/ \d+\/\d+$/, '').replace(/\.\.\.$/, '');
  prog(L.charAt(0) + L.slice(1).toLowerCase(), p ?? (m ? (m[1] - 1) / m[2] : null), m ? `${m[1]} de ${m[2]}` : '');
};
const count = () => $('char-count').textContent = `${el.txt.value.length} caracteres`;
const enable = (b, on) => { b.disabled = !on; b.classList.toggle('opacity-40', !on); b.classList.toggle('cursor-not-allowed', !on); };
const download = (blob, name) => { const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name }); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1e3); };

el.voice.innerHTML = Object.entries(VOICES).map(([g, vs]) => `<optgroup label="${g}">${Object.entries(vs).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</optgroup>`).join('');
$('effect-select').innerHTML = Object.entries(EFFECTS).map(([k, v]) => `<option value="${k}">${v.n}</option>`).join('');
el.voice.value = 'piper:pt_BR-faber-medium'; $('effect-select').value = 'clean'; // padrão: voz natural, sem efeito
el.txt.value = PRESET; count();
el.txt.oninput = count;
$('btn-preset').onclick = () => { el.txt.value = PRESET; count(); };
for (const k of ['pitch', 'rate']) el[k].oninput = () => $(`${k}-val`).textContent = el[k].value;
frame(0);
loadTTS().then(() => status('MOTOR DE VOZ PRONTO', 'bg-emerald-500')).catch(e => status('ERRO AO CARREGAR VOZ', 'bg-red-500'));

let warned = false;
async function makeTrack(scenes) {
  const t = await buildVoiceTrack(scenes, {
    voice: el.voice.value, effect: $('effect-select').value, tom: +el.pitch.value, speed: +el.rate.value, lead: introCfg().dur,
    onDownload: e => e?.total && status(`BAIXANDO MODELO DE VOZ ${e.loaded / e.total * 100 | 0}%`, 'bg-yellow-400 animate-pulse'),
    onProgress: (i, n) => { status('SINTETIZANDO VOZ', 'bg-yellow-400 animate-pulse', i / n); prog('Sintetizando voz', i / n, `frase ${Math.min(i + 1, n)} de ${n} · frases já geradas vêm do cache`); }
  });
  t.lead = introCfg().dur;
  if (t.fallback && !warned) { warned = true; warn('Não foi possível carregar a voz escolhida (rede ou modelo indisponível).\nUsando eSpeak como alternativa.'); }
  return t;
}


const v = id => $(id).value / 100;
async function run(fn) {
  if (busy) return;
  busy = true; ['btn-manifest', 'btn-vary', ...EXP].forEach(b => enable($(b), false));
  try { await fn(); } catch (e) { console.error(e); status('ERRO: ' + e.message, 'bg-red-500'); }
  busy = false; enable($('btn-manifest'), true);
  if (pendingGen) { pendingGen = false; setTimeout(() => generate()); }
  if (mix) ['btn-vary', ...EXP].forEach(b => enable($(b), true));
}

// edição -> mix -> reprodução/gravação
async function render() {
  const ic = introCfg();
  if (Math.abs(track.lead - ic.dur) > .01) shiftTrack(ic.dur);
  dir = direct(track.timeline, P, { variation, ov, grades: STYLES[el.style.selectedIndex].grades, grade: $('grade-select').value, title: $('video-title').value.trim(),
    credits: ['Voz: ' + el.voice.selectedOptions[0].text + ' · ' + el.voice.value.split(':')[0], 'Música: ' + (music?.name || 'procedural S.Y.N.A.P.S.E')],
    vt: { type: $('vtype').value, cards }, intro: ic, outro: { on: $('outro-on').checked, auto: $('outro-auto').checked, title: $('outro-title').value.trim(), lines: $('outro-lines').value.split('\n').map(s => s.trim()).filter(Boolean) } });
  readText();
  comp.load(segsCur = dir.segs);
  if (!pl.playing) drawAt(pl.time); // o visual atualiza na hora; o áudio entra quando a mixagem terminar
  status('MIXANDO ÁUDIO...', 'bg-yellow-400 animate-pulse');
  const mo = { voice: track.buffer, voiceKey: track.key, timeline: track.timeline, segs: segsCur, duration: dir.duration, style: el.style.selectedIndex, seed: hash(curId) + variation,
    musicBuf: music?.buf, musicName: music?.name, amb: $('amb-select').value, pack: $('sfx-pack').value, prof: $('music-prof').value, extra: cardEvents(cards, track.timeline), intro: ic.vig && { dur: ic.dur, sound: ic.vig.snd === 'auto' ? VIG_AUTO_SND[ic.vig.tpl] : ic.vig.snd }, vol: { voice: 1, music: v('vol-music') * .7, amb: v('vol-amb') * .6, sfx: v('vol-sfx') * .8 } };
  // mixagem salva por projeto: se nada mudou, carrega na hora
  const mk = mixKey(mo), saved = mixMem?.key === mk ? mixMem : await store.get('mix:' + curId);
  if (saved?.key === mk && (saved.buf || saved.blob)) { prog('Carregando mixagem salva', null); mix = saved.buf || await unpackBuf(saved); }
  else {
    mix = await mixdown(mo, (stage, p) => prog(stage, p, 'camadas de áudio já geradas são reaproveitadas'));
    setTimeout(() => store.set('mix:' + curId, { key: mk, ...packBuf(mix) }), 50);
  }
  mixMem = { key: mk, buf: mix };
  // descarta resultados de busca automática que não estão mais em uso
  assets.filter(x => x.origin === 'search' && !P.some(l => l.includes(x)) && !ov.some(o => o?.img === x)).forEach(removeAsset);
  grid(P); editor(); marks();
  const first = !pl.time && !pl.playing;
  pl.setBuffer(mix);
  if (first && navigator.userActivation?.hasBeenActive) pl.play(0);
  status('PREVIEW PRONTO', 'bg-emerald-500');
  saveWS();
}

let pendingGen = false, restored = null, dirty = false, mixMem = null, cards = [];
$('btn-manifest').onclick = () => generate();
function generate() {
  if (busy) return pendingGen = true;
  const raw = splitScenes(el.txt.value), type = $('vtype').value;
  if (!raw.length) return warn('Digite um roteiro válido.');
  const parsed = raw.map((x, i) => parseScene(x, type, i, raw));
  run(async () => {
    track = await makeTrack(parsed.map(p => p.say)); cards = parsed.map(p => p.card);
    if ($('ai-sync').checked) try {
      status('WHISPER: CARREGANDO...', 'bg-yellow-400 animate-pulse');
      const ak = 'asr:' + track.key, asr = await store.get(ak) || await transcribe(track.dry, e => e.status === 'progress' && e.file?.endsWith('.onnx') && status('WHISPER: BAIXANDO MODELO', 'bg-yellow-400 animate-pulse', e.progress / 100));
      store.set(ak, asr);
      status('WHISPER: ALINHANDO...', 'bg-yellow-400 animate-pulse');
      track.timeline = align(track.timeline, asr);
    } catch (e) { console.warn('Whisper indisponível, usando estimativa', e); }
    caps = groups(track.timeline, capMax());
    await syncUrls();
    const texts = track.timeline.map(s => s.text), R = restored && restored.texts?.join('\n') === texts.join('\n') ? restored : null;
    if (R) { P = R.P.map(l => l.map(id => assets.find(a => a.id === id)).filter(Boolean)); variation = R.variation || 0; ov = (R.ov || []).map(o => o && { ...o, img: o.img && assets.find(a => a.id === o.img) }); }
    if (!R || P.some(l => !l.length)) P = await plan(track.timeline, { search: $('img-search').checked, clip: $('img-clip').checked, onStatus: m => status(m, 'bg-yellow-400 animate-pulse'), ar: VW / VH, queries: ov.map(o => o?.q) });
    if (!R) { variation = 0; ov = []; }
    restored = null;
    await render();
  });
}
$('btn-vary').onclick = () => track && run(() => (variation++, render()));

// --- Edição ao vivo: aplica mudanças sem parar o player ---
// níveis: 1 = remixar áudio, 2 = refazer edição, 3 = reassociar imagens, 4 = re-sintetizar voz
let pend = 0, liveT;
const live = lv => { if (!track) return; pend = Math.max(pend, lv); clearTimeout(liveT); liveT = setTimeout(flush, 400); };
async function flush() {
  if (busy) return liveT = setTimeout(flush, 300);
  const lv = pend; pend = 0;
  await run(async () => {
    if (lv >= 4) { track = await makeTrack(track.timeline.map(s => s.text)); caps = groups(track.timeline, capMax()); }
    if (lv >= 3) { await syncUrls(); P = await plan(track.timeline, { search: $('img-search').checked, clip: $('img-clip').checked, onStatus: m => status(m, 'bg-yellow-400 animate-pulse'), ar: VW / VH, queries: ov.map(o => o?.q) }); }
    await render();
  });
}
const on = (ids, ev, lv) => ids.split(' ').forEach(id => $(id).addEventListener(ev, () => live(lv)));
on('voice-select effect-select voice-pitch voice-rate', 'change', 4);
on('img-search img-clip', 'change', 3);
on('video-title outro-title outro-lines', 'input', 2);
on('outro-on outro-auto', 'change', 2);
on('style-select grade-select', 'change', 2);
on('amb-select sfx-pack music-prof vol-music vol-amb vol-sfx', 'change', 1);

// quadro determinístico no tempo t (preview e export)
function drawAt(t) {
  const tl = track?.timeline || [], i = tl.findLastIndex(s => t >= s.start - .05), s = tl[i], style = el.style.selectedIndex;
  bg.u.style.value = style; bg.u.seed.value = s ? hash(s.text) % 100 : 0; bg.u.glitch.value = s ? Math.max(0, 1 - (t - s.start) / .3) : 0; bg.u.t.value = t * 1.8;
  frame(t, { caps, timeline: tl, style, dir, tx: TX });
  return i;
}

// exportação em segundo plano: compositor próprio + retrato do projeto; o editor continua livre
let exporting = false;
$('btn-mp4').onclick = async () => {
  if (!mix) return;
  if (exporting) return warn('Já existe uma exportação em andamento.');
  $('export-menu').classList.add('hidden');
  const [h, fps] = $('mp4-q').value.split('p').map(Number), k = h / 1080, aspect = $('aspect').value;
  const S = { tl: track.timeline, caps, dir, segs: segsCur, style: el.style.selectedIndex, tx: { ...TX, wm: { ...TX.wm } }, mix };
  exporting = true;
  const xc = document.createElement('canvas'), xbg = createBg(VW, VH), xcomp = await createCompositor(xc, xbg.canvas);
  xcomp.load(S.segs);
  const out = h === 1080 ? xc : Object.assign(document.createElement('canvas'), { width: Math.round(xc.width * k / 2) * 2, height: Math.round(xc.height * k / 2) * 2 }), og = out !== xc ? out.getContext('2d') : null;
  const m = progress({ title: `Exportando MP4 ${aspect} ${h}p${fps} · pode continuar editando`, source: xc, floating: true });
  const draw = t => {
    const i = S.tl.findLastIndex(s => t >= s.start - .05), s = S.tl[i];
    xbg.u.style.value = S.style; xbg.u.seed.value = s ? hash(s.text) % 100 : 0; xbg.u.glitch.value = s ? Math.max(0, 1 - (t - s.start) / .3) : 0; xbg.u.t.value = t * 1.8;
    xbg.draw(); xcomp.render(t, { caps: S.caps, timeline: S.tl, style: S.style, dir: S.dir, tx: S.tx });
    og?.drawImage(xc, 0, 0, out.width, out.height);
  };
  try {
    const t = Date.now(), name = `SYNAPSE_${aspect.replace(':', 'x')}_${h}p${fps}_${Date.now()}.mp4`, onProgress = (p, i, n) => m.set(p, `Quadro ${i}/${n} · ${p * 100 | 0}%`);
    if (isDesktop) { // FFmpeg nativo, salvo direto em Vídeos/SYNAPSE
      m.set(0, 'Preparando FFmpeg (1º uso baixa ~80MB)...');
      const { path, enc } = await exportNative({ canvas: out, audio: S.mix, duration: S.mix.duration, fps, cancelled: () => m.cancelled, draw, onProgress, name });
      status(`MP4 PRONTO · ${enc.toUpperCase()} · ${((Date.now() - t) / 1e3).toFixed(1)}s`, 'bg-emerald-500');
      modal({ title: 'Vídeo exportado', msg: path, icon: '✓', buttons: [{ label: 'OK', value: false }, { label: 'Abrir pasta', value: true, primary: true }] }).then(v => v && native('reveal', { path }));
      return;
    }
    const { blob, vc, ac } = await exportMP4({ canvas: out, audio: S.mix, duration: S.mix.duration, fps, cancelled: () => m.cancelled, draw, onProgress });
    download(blob, name);
    status(`MP4 PRONTO · ${vc.toUpperCase()}/${(ac || 'sem áudio').toUpperCase()} · ${((Date.now() - t) / 1e3).toFixed(1)}s`, 'bg-emerald-500');
  } catch (e) { if (e.message !== 'CANCELADO') { console.error(e); warn('Falha na exportação: ' + e.message); } else status('EXPORTAÇÃO CANCELADA', 'bg-zinc-600'); }
  finally { m.close(); xcomp.destroy(); xbg.dispose(); exporting = false; }
};

// grava a reprodução em tempo real (WebM)
$('btn-export').onclick = () => {
  if (!mix || rec?.state === 'recording') return;
  const chunks = [], mime = ['video/webm;codecs=vp9,opus', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m));
  rec = new MediaRecorder(new MediaStream([...cv.captureStream(60).getVideoTracks(), ...pl.stream().getAudioTracks()]), { mimeType: mime, videoBitsPerSecond: 8e6 });
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  rec.onstop = () => { download(new Blob(chunks, { type: 'video/webm' }), `SYNAPSE_${Date.now()}.webm`); status('WEBM SALVO', 'bg-emerald-500'); };
  pl.pause(); pl.seek(0); rec.start(); pl.play(0);
  status('GRAVANDO WEBM...', 'bg-red-500 animate-pulse');
};
$('btn-wav').onclick = () => mix && download(toWav(mix), `SYNAPSE_AUDIO_${Date.now()}.wav`);
$('btn-hf').onclick = () => mix && run(async () => {
  const m = progress({ title: 'Empacotando HyperFrames' }); m.set(.3, 'Gerando composição, imagens e áudio...');
  try { download(await exportHyperFrames({ segs: segsCur, caps, dir, mix, style: el.style.selectedIndex, title: dir.intro.title }), `SYNAPSE_hyperframes_${Date.now()}.zip`); } finally { m.close(); }
  status('ZIP HYPERFRAMES PRONTO', 'bg-emerald-500');
});
$('btn-srt').onclick = () => caps.length && download(new Blob([toSRT(caps)], { type: 'text/plain' }), `SYNAPSE_${Date.now()}.srt`);

// --- Ilustrações ---
function grid(P = []) {
  const sc = a => P.map((x, i) => x.includes(a) ? i + 1 : 0).filter(Boolean).join(',');
  $('img-grid').replaceChildren(...assets.map(a => {
    const d = document.createElement('div');
    d.className = 'relative aspect-video rounded overflow-hidden border border-zinc-700 group cursor-pointer hover:border-emerald-400';
    d.title = [a.tag, a.credit].filter(Boolean).join(' · ');
    d.innerHTML = `<img src="${a.img.src}" class="w-full h-full object-cover"><span class="absolute bottom-0 left-0 text-[9px] bg-black/70 px-1 text-emerald-300">${sc(a) ? 'C' + sc(a) : a.origin === 'search' ? 'web' : ''}</span><button class="absolute top-0 right-0 hidden group-hover:block bg-red-600 text-white text-[10px] px-1">✕</button>`;
    d.querySelector('img').onclick = () => editAsset(a);
    d.querySelector('button').onclick = () => {
      removeAsset(a); live(3); if (a.origin === 'file') saveFiles();
      if (a.origin === 'url') $('img-urls').value = $('img-urls').value.split('\n').filter(l => !l.includes(a.src)).join('\n');
      grid();
    };
    return d;
  }));
}

async function syncUrls() {
  const list = parseUrls($('img-urls').value), srcs = new Set(list.map(x => x.src));
  assets.filter(a => a.origin === 'url' && !srcs.has(a.src)).forEach(removeAsset);
  for (const [i, x] of list.entries()) {
    status(`CARREGANDO IMAGENS ${i + 1}/${list.length}`, 'bg-yellow-400 animate-pulse');
    try { Object.assign(await addAsset(x), { tag: x.tag || '' }); } catch (e) { console.warn('Imagem falhou:', x.src); }
  }
  grid();
}

$('img-files').onchange = async e => {
  for (const f of e.target.files) await addFile(f);
  saveFiles();
  e.target.value = ''; grid(); live(3);
};
$('img-urls').onchange = () => track ? live(3) : syncUrls().then(() => status('IMAGENS PRONTAS', 'bg-emerald-500'));
// render determinístico por tempo (debug/export)
// --- Player ---
const fmt = t => `${t / 60 | 0}:${String(t % 60 | 0).padStart(2, '0')}`;
let lastScene = -1;
const pl = createPlayer({
  draw: drawAt,
  onTime: t => {
    const D = mix?.duration || 0, sk = $('pl-seek');
    if (document.activeElement !== sk) sk.value = t;
    $('pl-time').textContent = `${fmt(t)} / ${fmt(D)}`;
    $('pl-play').textContent = pl.playing ? '❚❚' : '▶';
    tl.set(t);
    const sc = track?.timeline || [], i = sc.findLastIndex(s => t >= s.start - .05);
    if (i !== lastScene) {
      lastScene = i; $('scene-counter').textContent = `${Math.max(i + 1, 0)}/${sc.length}`;
      if (i >= 0) $('scene-hash').textContent = `HASH: 0x${hash(sc[i].text).toString(16).slice(0, 6).toUpperCase()}`;
      if (follow && pl.playing && i >= 0 && i !== sel) { sel = i; tl.select(i); inspector(); }
    }
  },
  onEnd: () => rec?.state === 'recording' && rec.stop()
});
function marks() {
  const D = mix.duration;
  $('pl-seek').max = D;
  $('pl-marks').innerHTML = track.timeline.map((s, i) => `<span title="Cena ${i + 1}" style="left:${s.start / D * 100}%" class="absolute top-0 w-px h-2 bg-purple-400"></span>`).join('');
}
$('pl-play').onclick = () => { follow = true; stopAud(); pl.toggle(); };
$('pl-back').onclick = () => pl.seek(pl.time - 5);
$('pl-fwd').onclick = () => pl.seek(pl.time + 5);
$('pl-seek').oninput = e => pl.seek(+e.target.value);
$('pl-full').onclick = () => document.fullscreenElement ? document.exitFullscreen() : $('stage').requestFullscreen();
document.addEventListener('keydown', e => {
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || document.querySelector('.z-\\[100\\]')) return;
  if (e.code === 'Space' && mix) { e.preventDefault(); pl.toggle(); }
  if (e.code === 'KeyF') $('pl-full').click();
});
const goTo = img => { const s = segsCur.find(x => x.img === img); if (s) { selectScene(s.scene); pl.seek(s.a + .5); } };

window.synapse = { assets, get timeline() { return track?.timeline; }, get range() { return pl.range; }, get comp() { return comp; }, get segs() { return segsCur; }, frame: drawAt, get duration() { return mix?.duration || 0; } };

// --- Trilha sonora ---
el.style.innerHTML = STYLES.map(s => `<option>${s.n}</option>`).join('');
$('grade-select').innerHTML = '<option value="auto">Tratamento: automático (pelo estilo)</option>' + GRADE_NAMES.map(k => `<option value="${k}">Tratamento: ${GRADES[k][0]}</option>`).join('');
$('sfx-pack').innerHTML = '<option value="auto">Automático</option>' + Object.entries(PACKS).map(([k, v]) => `<option value="${k}">${v.n}</option>`).join('');
$('amb-select').innerHTML = Object.entries(AMBS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
$('amb-select').value = 'none'; // padrão: sem som ambiente
const setMusic = m => {
  music = m; live(1);
  m?.blob ? store.set('music', { name: m.name, blob: m.blob }) : !m && store.del('music');
  $('music-name').textContent = m ? '♪ ' + m.name : '♪ Procedural (gerada pelo estilo)';
  $('music-clear').classList.toggle('hidden', !m);
};
$('music-clear').onclick = () => setMusic(null);
$('music-file').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try { setMusic({ name: f.name, buf: await decodeAudio(f), blob: f }); } catch { warn('Formato de áudio não suportado.'); }
  e.target.value = '';
};
$('music-search').onclick = async () => {
  const box = $('music-results'), q = $('music-q').value.trim();
  if (!q) return;
  box.textContent = 'Buscando...';
  try {
    const rs = await searchAudio(q);
    box.replaceChildren(...rs.map(x => {
      const d = document.createElement('div');
      d.className = 'flex items-center gap-2 bg-black/40 rounded px-2 py-1';
      d.innerHTML = `<button class="text-emerald-400">▶</button><span class="flex-1 truncate" title="${x.credit.replace(/"/g, '')}">${x.title} <span class="text-zinc-600">${x.dur ? Math.round(x.dur) + 's' : ''}</span></span><button class="text-purple-400 font-bold">USAR</button>`;
      const [pl, , us] = d.children, au = new Audio(x.url);
      pl.onclick = () => au.paused ? (document.querySelectorAll('audio').forEach(a => a.pause()), au.play(), pl.textContent = '■') : (au.pause(), pl.textContent = '▶');
      us.onclick = async () => {
        us.textContent = '...';
        try { const blob = await (await fetch(x.url)).blob(); setMusic({ name: x.credit, buf: await decodeAudio(blob), blob }); us.textContent = '✓'; }
        catch { us.textContent = 'USAR'; warn('Essa fonte bloqueia download direto (CORS).\nBaixe o arquivo e use "Enviar".'); }
      };
      return d;
    }));
    if (!rs.length) box.textContent = 'Nada encontrado.';
  } catch (e) { box.textContent = 'Busca indisponível: ' + e.message; }
};
$('music-q').onkeydown = e => { if (e.key === 'Enter') $('music-search').click(); };

// --- Editor de cenas ---
const LN = { full: 'Tela cheia', push: 'Push-in', pan: 'Pan horizontal', tilt: 'Pan vertical', rotate: 'Rotação lenta', focus: 'Rack focus', zoomout: 'Zoom revelação', letterbox: 'Letterbox', vignette: 'Vinheta', spotlight: 'Holofote', frame: 'Moldura', polaroid: 'Polaroid', archive: 'Foto de arquivo', parallax: 'Parallax', window: 'Janela', split: 'Dividida', diptych: 'Díptico', triptych: 'Tríptico', mosaic: 'Mosaico', stack: 'Pilha de fotos', filmstrip: 'Película', tv: 'TV antiga', diagonal: 'Diagonal', circle: 'Círculo', strips: 'Faixas', double: 'Dupla exposição' },
  TNm = { fade: 'Fade', dissolve: 'Dissolver', dipblack: 'Fade p/ preto', dipwhite: 'Fade p/ branco', flash: 'Flash', lightleak: 'Light leak', burn: 'Film burn', blur: 'Desfoque', zoom: 'Zoom', whip: 'Whip pan', push: 'Push', slide: 'Slide', wipe: 'Wipe', iris: 'Íris', barn: 'Portas', blinds: 'Persianas', glitch: 'Glitch', rgb: 'RGB split', pixel: 'Pixel', warp: 'Distorção', shake: 'Impacto' },
  GN = Object.fromEntries(GRADE_NAMES.map(k => [k, GRADES[k][0]]));
const opts = (list, names, cur, auto) => `<option value="">Auto${auto ? ' (' + names[auto] + ')' : ''}</option>` + list.map(k => `<option value="${k}" ${k === cur ? 'selected' : ''}>${names[k]}</option>`).join('');
const escH = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
let sel = 0, follow = true;
// timeline + inspetor da cena selecionada
function editor() {
  tl.render({ duration: mix.duration, segs: segsCur, caps, wave: track.dry.getChannelData(0), intro: dir.intro.b - .2, outro: dir.outro.off ? null : [dir.outro.a, dir.outro.b], music: music?.name || 'Trilha procedural · ' + STYLES[el.style.selectedIndex].n, sting: !!introCfg().vig });
  sel = Math.min(sel, track.timeline.length - 1); tl.select(sel); inspector();
}
function selectScene(i, seek) {
  if (!track) return;
  follow = false;
  if (pl.range && i !== sel) pl.setRange(null);
  sel = Math.max(0, Math.min(i, track.timeline.length - 1)); tl.select(sel); inspector();
  if (seek) pl.seek(Math.max(0, track.timeline[sel].start - .3));
}
function inspector() {
  const b = $('insp-body'), i = sel, s = track.timeline[i], o = ov[i] || {}, sg = segsCur.find(x => x.scene === i), n = track.timeline.length;
  const cur = o.img || assets.find(a => a.img === sg?.img);
  b.innerHTML = `<div class="flex items-center justify-between"><button data-nav="-1" class="pbtn">◀</button><b class="text-zinc-200">Cena ${i + 1} de ${n}</b><button data-nav="1" class="pbtn">▶</button></div>
    <p class="text-zinc-300 bg-black/40 rounded-lg p-2 leading-relaxed">${escH(s.text)}</p>
    <label class="fl">Layout<select data-k="layout" class="inp">${opts(LAYOUT_NAMES, LN, o.layout, !o.layout && sg?.layout)}</select></label>
    <label class="fl">Transição<select data-k="trans" class="inp">${opts(TRANS_NAMES, TNm, o.trans, !o.trans && sg?.trans)}</select></label>
    <label class="fl">Tratamento<select data-k="grade" class="inp">${opts(GRADE_NAMES, GN, o.grade, !o.grade && sg?.grade)}</select></label>
    <div class="fl">Imagem<div data-edit class="relative aspect-video rounded-lg bg-black bg-cover bg-center border border-zinc-700 hover:border-emerald-400 cursor-pointer group" style="${cur && !o.noimg ? `background-image:url('${cur.img.src}')` : ''}">${!cur || o.noimg ? '<span class="absolute inset-0 flex items-center justify-center text-zinc-600">Sem imagem</span>' : ''}<span class="absolute inset-0 hidden group-hover:flex items-center justify-center bg-black/50 text-white font-bold">✎ Trocar / editar</span></div>
      <button data-edit class="btn bg-purple-700 hover:bg-purple-600 text-white"><i data-lucide="image-plus" class="w-4 h-4"></i> Buscar / trocar imagem</button>
      <span class="text-zinc-600 text-[10px]">Imagens do projeto (clique para usar nesta cena):</span>
      <div class="grid grid-cols-4 gap-1.5"><div data-img="" class="tile ${!o.img && !o.noimg ? 'on' : ''} flex items-center justify-center text-[10px]">Auto</div>
      ${assets.map((a, k) => `<div data-img="${k}" class="tile ${o.img === a ? 'on' : ''}" title="${escH(a.tag || a.origin)}" style="background-image:url('${a.img.src}')"></div>`).join('')}</div></div>
    <div class="grid grid-cols-2 gap-2"><button data-go class="btn bg-zinc-800 hover:bg-zinc-700 text-zinc-200"><i data-lucide="play" class="w-4 h-4"></i> Ir para</button>
      <button data-loop class="btn ${pl.range ? 'bg-emerald-700 hover:bg-emerald-600 text-white' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'}" title="Toca só esta cena, repetindo"><i data-lucide="repeat" class="w-4 h-4"></i> ${pl.range ? 'Parar loop' : 'Loop da cena'}</button></div>`;
  const set = (k, v) => { ov[i] = { ...ov[i], [k]: v }; live(2); };
  b.querySelectorAll('select').forEach(x => x.onchange = () => set(x.dataset.k, x.value || undefined));
  b.querySelectorAll('[data-img]').forEach(x => x.onclick = () => { ov[i] = { ...ov[i], noimg: undefined }; set('img', x.dataset.img === '' ? undefined : assets[x.dataset.img]); b.querySelectorAll('[data-img]').forEach(y => y.classList.toggle('on', y === x)); });
  b.querySelectorAll('[data-nav]').forEach(x => x.onclick = () => selectScene(i + +x.dataset.nav, true));
  b.querySelector('[data-go]').onclick = () => selectScene(i, true);
  b.querySelector('[data-loop]').onclick = () => { if (pl.range) pl.setRange(null); else { const a0 = Math.max(0, s.start - .4); pl.setRange([a0, (track.timeline[i + 1]?.start ?? mix.duration) - .2]); stopAud(); pl.play(a0); } inspector(); };
  b.querySelectorAll('[data-edit]').forEach(x => x.onclick = () => imageEditor({ i }));
  lucide.createIcons({ root: b }); enhanceSelects(b);
}
const tl = createTimeline($('tl-inner'), $('tl-scroll'), { onEdit: i => imageEditor({ i }), onSeek: t => { if (pl.range && (t < pl.range[0] || t > pl.range[1])) { pl.setRange(null); inspector(); } pl.seek(t); }, onSelect: i => selectScene(i) });
$('tl-zoom').oninput = e => tl.setZoom(+e.target.value);
$('screen').addEventListener('dblclick', () => track && lastScene >= 0 && imageEditor({ i: lastScene }));

// --- Texto, cores e marca d'água (só visual: redesenha sem refazer áudio) ---
const TX = { wm: { type: 'none' } };
$('cap-style').innerHTML = '<option value="auto">Automático (pelo estilo)</option>' + Object.entries(CAP_STYLES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
$('cap-font').innerHTML = $('title-font').innerHTML = '<option value="auto">Automática</option>' + FONTS.map(f => `<option style="font-family:'${f}'">${f}</option>`).join('');
function readText() {
  const v = id => $(id).value, auto = $('col-auto').checked, pal = PALETTES[(hash(el.txt.value) + variation) % PALETTES.length], st = STYLES[el.style.selectedIndex];
  Object.assign(TX, { cap: v('cap-style') === 'auto' ? st.cap || 'karaoke' : v('cap-style'), font: v('cap-font'), titleFont: v('title-font'), pos: v('cap-pos'), size: v('cap-size') / 100, opacity: v('cap-op') / 100,
    color: auto ? pal[0] : v('col-text'), accent: auto ? pal[1] : v('col-accent'), capOff: $('cap-off').checked });
  Object.assign(TX.wm, { type: v('wm-type'), text: v('wm-text'), pos: v('wm-pos'), size: +v('wm-size'), opacity: v('wm-op') / 100, font: TX.titleFont === 'auto' ? 'Syne' : TX.titleFont });
  for (const [id, s] of [['cap-size', '%'], ['cap-op', '%'], ['wm-size', '%'], ['wm-op', '%']]) $(id + '-v').textContent = v(id) + s;
  [TX.font, TX.titleFont, 'Syne'].forEach(f => f !== 'auto' && document.fonts.load(`800 40px "${f}"`).then(() => !pl.playing && drawAt(pl.time)));
  if (!pl.playing) drawAt(pl.time);
}
$('text-panel').addEventListener('input', e => !/wm-file|outro|vig/.test(e.target.id) && readText());
$('text-panel').addEventListener('change', e => !/wm-file|outro|vig/.test(e.target.id) && readText());
const setWm = async f => { if (!f) return; const im = new Image(); im.src = URL.createObjectURL(f); await im.decode(); TX.wm.img = im; };
$('wm-file').onchange = async e => { const f = e.target.files[0]; if (!f) return; await setWm(f); store.set('wm', f); $('wm-type').value = 'image'; readText(); };

// --- Vinhetas de abertura ---
let vigs = await store.get('vigs') || [], vEdit = null;
const vimg = {}, TPLS = Object.keys(VIG_TPL);
const loadVimg = async v => { if (v.img && !vimg[v.id]) { const i = new Image(); i.src = URL.createObjectURL(v.img); await i.decode().catch(() => { }); vimg[v.id] = i; } };
for (const v of vigs) await loadVimg(v);
function introCfg() {
  const a = $('vig-active').value, v = vigs.find(x => x.id === a);
  return a === 'none' ? { dur: .3 } : v ? { dur: v.dur, vig: { ...v, img: v.img && vimg[v.id] } } : { dur: INTRO };
}
// desloca a trilha de voz quando a duração da abertura muda (sem re-sintetizar)
function shiftTrack(L) {
  const d = L - track.lead, sr = track.buffer.sampleRate, n = Math.round(d * sr);
  const mv = b => { const o = new AudioBuffer({ length: Math.max(1, b.length + n), sampleRate: sr, numberOfChannels: b.numberOfChannels }); for (let c = 0; c < b.numberOfChannels; c++) n >= 0 ? o.getChannelData(c).set(b.getChannelData(c), n) : o.getChannelData(c).set(b.getChannelData(c).subarray(-n)); return o; };
  track.buffer = mv(track.buffer); track.dry = mv(track.dry);
  track.timeline.forEach(s => { s.start += d; s.end += d; s.words.forEach(w => { w.s += d; w.e += d; }); });
  track.duration += d; track.lead = L; caps = groups(track.timeline, capMax());
}
$('vig-tpl').innerHTML = Object.entries(VIG_TPL).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
$('vig-snd').innerHTML = Object.entries(VIG_SND).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
const saveVigs = () => store.set('vigs', vigs);
function vigUI() {
  const cur = $('vig-active').value;
  $('vig-active').innerHTML = '<option value="title">Título automático</option><option value="none">Sem abertura</option>' + vigs.map(v => `<option value="${v.id}">★ ${v.name}</option>`).join('');
  $('vig-active').value = [...$('vig-active').options].some(o => o.value === cur) ? cur : 'title';
  $('vig-edit').innerHTML = vigs.map(v => `<option value="${v.id}">${v.name}</option>`).join('');
  const v = vigs.find(x => x.id === vEdit) || vigs[0];
  $('vig-form').classList.toggle('hidden', !v);
  if (!v) return;
  vEdit = v.id; $('vig-edit').value = v.id;
  for (const k of ['name', 'sub', 'dur', 'tpl', 'snd']) $('vig-' + k).value = v[k] ?? '';
  $('vig-dur-v').textContent = v.dur + 's'; refreshRanges($('vig-form'));
  $('vig-thumb').classList.toggle('hidden', !v.img); $('vig-img-x').classList.toggle('hidden', !v.img);
  if (v.img) $('vig-thumb').src = vimg[v.id]?.src || '';
}
const vigChanged = () => { saveVigs(); vigUI(); if (introCfg().vig?.id === vEdit) live(2); else if (!pl.playing) drawAt(pl.time); };
$('vig-new').onclick = () => {
  const id = 'v' + Date.now().toString(36), seed = Math.random() * 1e6 | 0;
  vigs.push({ id, name: $('video-title').value.trim() || 'Minha Vinheta', sub: '', dur: 3, tpl: TPLS[seed % TPLS.length], snd: 'auto', seed, img: null });
  vEdit = id; saveVigs(); vigUI(); $('vig-active').value = id; $('vig-active').dispatchEvent(new Event('change'));
};
$('vig-edit').onchange = e => { vEdit = e.target.value; vigUI(); };
for (const k of ['name', 'sub', 'dur', 'tpl', 'snd']) $('vig-' + k).addEventListener(k === 'name' || k === 'sub' ? 'input' : 'change', e => {
  const v = vigs.find(x => x.id === vEdit); if (!v) return;
  v[k] = k === 'dur' ? +e.target.value : e.target.value; vigChanged();
});
$('vig-dur').oninput = e => $('vig-dur-v').textContent = e.target.value + 's';
$('vig-rand').onclick = () => { const v = vigs.find(x => x.id === vEdit); if (!v) return; v.seed = Math.random() * 1e6 | 0; v.tpl = TPLS[v.seed % TPLS.length]; vigChanged(); };
$('vig-del').onclick = async () => { if (!vEdit || !await ask('Excluir esta vinheta?')) return; vigs = vigs.filter(v => v.id !== vEdit); vEdit = null; vigChanged(); live(2); };
$('vig-img').onchange = async e => { const v = vigs.find(x => x.id === vEdit), f = e.target.files[0]; if (!v || !f) return; v.img = f; delete vimg[v.id]; await loadVimg(v); e.target.value = ''; vigChanged(); };
$('vig-img-x').onclick = () => { const v = vigs.find(x => x.id === vEdit); if (v) { v.img = null; vigChanged(); } };
$('vig-active').addEventListener('change', () => live(2));
// prévia: toca a abertura (com som se o vídeo já foi manifestado)
$('vig-prev').onclick = () => {
  if (mix) { pl.seek(0); pl.play(0); return; }
  const ic = introCfg(), t0 = performance.now(), d = { intro: { title: ($('video-title').value || 'S.Y.N.A.P.S.E').toUpperCase(), b: ic.dur + .2, code: 7, vig: ic.vig, none: ic.dur < .5 } };
  const loop = () => { const t = (performance.now() - t0) / 1e3; frame(t, { dir: d, tx: TX, style: el.style.selectedIndex }); if (t < ic.dur + .3) requestAnimationFrame(loop); };
  loop();
  const k = ic.vig && (ic.vig.snd === 'auto' ? VIG_AUTO_SND[ic.vig.tpl] : ic.vig.snd);
  if (k && k !== 'none') previewSting(k, ic.dur).then(b => audition(b));
};
vigUI();

// --- Prévias rápidas (vozes, efeitos, trilhas, ambientes, efeitos sonoros) ---
const PHRASES = ['Saudações, habitantes da Terra. Esta é uma transmissão de teste.', 'A realidade é apenas uma simulação em baixa resolução.', 'Sinal recebido. Iniciando protocolo de contato com a sua civilização.', 'Bem-vindos ao arquivo secreto do universo.', 'O tempo dobrou sobre si mesmo no limiar do abismo.'];
let phr = 0;
const vcache = new Map(), phrase = v => v.startsWith('kokoro') ? 'Greetings, people of Earth. This is a test transmission from beyond the stars.' : ($('test-phrase').value.trim() || PHRASES[phr % PHRASES.length]);
function voiceSample(voice = el.voice.value, effect = $('effect-select').value) {
  const txt = phrase(voice), key = [voice, effect, el.pitch.value, el.rate.value, txt].join('|');
  if (!vcache.has(key)) vcache.set(key, synth(txt, voice, +el.rate.value, e => e?.total && status(`BAIXANDO VOZ ${e.loaded / e.total * 100 | 0}%`, 'bg-yellow-400 animate-pulse')).then(r => {
    if (r.fallback && !warned) { warned = true; warn('Não foi possível carregar essa voz (rede ou modelo indisponível).\nTocando com eSpeak.'); }
    status('VOZ PRONTA', 'bg-emerald-500');
    return applyFx(r.buf, EFFECTS[effect].fx, +el.pitch.value, r.native ? 1 : +el.rate.value);
  }).catch(e => { vcache.delete(key); throw e; }));
  return vcache.get(key);
}
audHooks.onStart = () => pl.playing && pl.pause();
const pick = id => k => { $(id).value = k; $(id).dispatchEvent(new Event('change', { bubbles: true })); };
$('music-prof').innerHTML = '<option value="auto">auto</option>' + PROFILES.map((n, i) => `<option value="${i}">${n}</option>`).join('');
const G = {};
function galleries() {
  const sty = () => STYLES[el.style.selectedIndex];
  G.voice = gallery($('voice-gal'), { items: Object.entries(VOICES).flatMap(([g, vs]) => Object.entries(vs).map(([key, label]) => ({ key, label, group: g }))), value: el.voice.value, onPick: pick('voice-select'), render: k => voiceSample(k) });
  G.effect = gallery($('effect-gal'), { items: Object.entries(EFFECTS).map(([key, v]) => ({ key, label: v.n })), value: $('effect-select').value, onPick: pick('effect-select'), render: k => voiceSample(el.voice.value, k) });
  G.prof = gallery($('prof-gal'), { items: [{ key: 'auto', label: 'Automática (pelo estilo)' }, ...PROFILES.map((label, i) => ({ key: String(i), label }))], value: $('music-prof').value,
    onPick: k => { if (music) setMusic(null); pick('music-prof')(k); }, render: k => previewMusic(k === 'auto' ? sty().mus : +k) });
  G.amb = gallery($('amb-gal'), { items: Object.entries(AMBS).map(([key, label]) => ({ key, label })), value: $('amb-select').value, onPick: pick('amb-select'), render: k => previewAmb(k === 'auto' ? sty().amb : k) });
  G.sfx = gallery($('sfx-gal'), { items: [{ key: 'auto', label: 'Automático (pelo estilo)' }, ...Object.entries(PACKS).map(([key, v]) => ({ key, label: v.n }))], value: $('sfx-pack').value, onPick: pick('sfx-pack'), render: k => previewPack(k === 'auto' ? sty().sfx : k) });
}
$('phrase-rand').onclick = () => { phr++; $('test-phrase').value = ''; $('test-phrase').placeholder = PHRASES[phr % PHRASES.length]; };
$('btn-test').onclick = async () => { const b = $('btn-test'); b.classList.add('opacity-60'); try { audition(await voiceSample(), b); } finally { b.classList.remove('opacity-60'); } };
$('music-play').onclick = async () => {
  const b = $('music-play'); if (b.classList.contains('playing')) return stopAud();
  b.classList.add('loading');
  try { audition(music?.buf ? clip(music.buf) : await previewMusic($('music-prof').value === 'auto' ? STYLES[el.style.selectedIndex].mus : +$('music-prof').value), b); } finally { b.classList.remove('loading'); }
};

// --- Formato do vídeo (16:9, 9:16, 1:1): recria o compositor nas novas dimensões ---
const capMax = () => VH > VW ? 18 : VH === VW ? 22 : 30;
async function applyAspect() {
  const a = $('aspect').value;
  document.querySelectorAll('.asp').forEach(b => b.classList.toggle('on', b.dataset.a === a));
  setAspect(a);
  const sc = $('screen'), r = VW / VH;
  sc.style.aspectRatio = `${VW}/${VH}`; sc.style.setProperty('--ar', r);
  if (cv.width === VW * 1.5 && cv.height === VH * 1.5) return;
  comp.destroy(); bg.dispose();
  cv = Object.assign(document.createElement('canvas'), { id: 'view-canvas', className: 'w-full h-full' }); sc.prepend(cv);
  bg = createBg(VW, VH); comp = await createCompositor(cv, bg.canvas);
  if (track) { caps = groups(track.timeline, capMax()); comp.load(segsCur); }
  drawAt(pl.time);
}
document.querySelectorAll('.asp').forEach(b => b.onclick = async () => {
  if (exporting) return warn('Aguarde a exportação terminar para trocar o formato.');
  if (busy || $('aspect').value === b.dataset.a) return;
  $('aspect').value = b.dataset.a; $('aspect').dispatchEvent(new Event('change'));
  await applyAspect(); live(2);
});

// --- Abas do painel, menu de exportação, prévia automática ---
const showTab = k => { document.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.tab === k)); document.querySelectorAll('.pane').forEach(p => p.classList.toggle('on', p.dataset.pane === k)); store.set('tab', k); };
document.querySelectorAll('.tab').forEach(b => b.onclick = () => showTab(b.dataset.tab));
showTab(await store.get('tab') || 'script');
$('btn-export-menu').onclick = e => { e.stopPropagation(); $('export-menu').classList.toggle('hidden'); };
document.addEventListener('click', e => !e.target.closest('#export-menu') && $('export-menu').classList.add('hidden'));
let lastGen = '', genT;
const gen = () => { if (busy) return genT = setTimeout(gen, 800); if (el.txt.value.trim() && el.txt.value !== lastGen) { lastGen = el.txt.value; generate(); } };
el.txt.addEventListener('input', () => { clearTimeout(genT); if ($('auto-gen').checked) genT = setTimeout(gen, 1800); });
el.txt.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); lastGen = el.txt.value; generate(); } });

// --- Editor de imagem (cena ou imagem do projeto): busca externa/integrada, URL, arquivo, colar, arrastar, remover ---
const EXT = [['Google Imagens', q => `https://www.google.com/search?tbm=isch&q=${q}`], ['Bing', q => `https://www.bing.com/images/search?q=${q}`], ['Pexels', q => `https://www.pexels.com/pt-br/procurar/${q}/`],
  ['Unsplash', q => `https://unsplash.com/s/fotos/${q}`], ['Pixabay', q => `https://pixabay.com/pt/images/search/${q}/`], ['Wikimedia', q => `https://commons.wikimedia.org/w/index.php?title=Special:MediaSearch&type=image&search=${q}`], ['Openverse', q => `https://openverse.org/search/image?q=${q}`]];
const sceneAsset = i => ov[i]?.noimg ? null : ov[i]?.img || assets.find(x => x.img === segsCur.find(g => g.scene === i)?.img);
function editAsset(a) { imageEditor({ a }); }
function imageEditor({ i = null, a = null }) {
  const scene = i != null, cur = scene ? sceneAsset(i) : a;
  const used = cur ? P.map((l, k) => l.includes(cur) || ov[k]?.img === cur ? k + 1 : 0).filter(Boolean) : [];
  const term = scene ? ov[i]?.q || CANDS[i]?.q || autoQuery(track.timeline[i].text) : cur.tag || '';
  const o = document.createElement('div');
  o.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4';
  o.innerHTML = `<div class="w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-zinc-950 border border-purple-800/60 rounded-xl shadow-2xl p-5 flex flex-col gap-3 text-zinc-300">
    <div class="flex items-center"><h3 class="pane-h flex-1"><i data-lucide="image" class="w-4 h-4"></i> ${scene ? `Imagem da cena ${i + 1}` : 'Editar imagem'}</h3><button data-x class="pbtn">✕</button></div>
    ${scene ? `<p class="text-[11px] text-zinc-500 italic">“${escH(track.timeline[i].text)}”</p>` : ''}
    <div data-drop class="relative aspect-video rounded-lg bg-black bg-center bg-contain bg-no-repeat border-2 border-dashed border-zinc-800 flex items-center justify-center text-zinc-600" data-prev ${cur ? `style="background-image:url('${cur.img.src}')"` : ''}><span data-msg>${cur ? '' : 'Sem imagem'}</span><span class="absolute bottom-1 right-2 text-[10px] text-zinc-500">arraste uma imagem aqui · ou Ctrl+V para colar</span></div>
    <div class="text-[11px] text-zinc-500">${cur ? escH(cur.credit || (cur.origin === 'file' ? 'Arquivo enviado' : cur.origin === 'search' ? 'Busca automática' : 'URL')) + ' · ' + (used.length ? 'usada na(s) cena(s) ' + used.join(', ') : 'não usada') : ''}</div>
    <div class="fl">Pesquisar imagem<div class="flex gap-2"><input data-q class="inp !p-2" value="${escH(term)}"><button data-search class="btn !py-2 bg-purple-700 hover:bg-purple-600 text-white"><i data-lucide="search" class="w-4 h-4"></i> Buscar aqui</button></div>
      <div class="flex flex-wrap gap-1.5">${EXT.map(([n], k) => `<button data-ext="${k}" class="px-2.5 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 text-[11px] flex items-center gap-1">${n} <i data-lucide="external-link" class="w-3 h-3"></i></button>`).join('')}</div>
      <p class="text-[10px] text-zinc-500 leading-relaxed">Nas fontes externas: botão direito na imagem → <b>Copiar endereço da imagem</b> (cole no campo URL) ou <b>Copiar imagem</b> (volte aqui e aperte Ctrl+V).</p>
      <div data-res class="grid grid-cols-4 gap-1.5"></div></div>
    <label class="fl">URL da imagem<div class="flex gap-2"><input data-url class="inp !p-2 text-[11px]" placeholder="https://..." value="${cur && cur.origin !== 'file' ? escH(cur.src) : ''}"><button data-load class="btn !py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200">Usar URL</button></div></label>
    <label class="upl"><i data-lucide="upload" class="w-4 h-4"></i> Enviar do computador<input data-file type="file" accept="image/*" hidden></label>
    ${scene ? '' : `<label class="fl">Palavra-chave (liga a imagem à cena que contém a palavra)<input data-tag class="inp !p-2" value="${escH(cur.tag || '')}"></label>`}
    <div class="flex flex-wrap gap-2 justify-between mt-1">
      <button data-del class="btn bg-red-900 hover:bg-red-800 text-white" ${cur ? '' : 'disabled'}><i data-lucide="trash-2" class="w-4 h-4"></i> ${scene ? 'Remover da cena' : 'Excluir imagem'}</button>
      <div class="flex gap-2"><button data-go class="btn bg-zinc-800 hover:bg-zinc-700 text-zinc-200"><i data-lucide="play" class="w-4 h-4"></i> Ver no vídeo</button>
      <button data-save class="btn bg-emerald-700 hover:bg-emerald-600 text-white"><i data-lucide="check" class="w-4 h-4"></i> Aplicar</button></div></div></div>`;
  document.body.appendChild(o); lucide.createIcons();
  const Q = sel => o.querySelector(sel), msg = t => { Q('[data-prev]').style.backgroundImage = ''; Q('[data-msg]').textContent = t; };
  let next = null; // { src, img, blob, credit }
  const pick = async (src, blob, credit = '') => {
    msg('Carregando...');
    try { const img = await loadImage(blob ? URL.createObjectURL(blob) : src); next = { src: blob ? img.src : src, img, blob, credit }; Q('[data-msg]').textContent = ''; Q('[data-prev]').style.backgroundImage = `url('${img.src}')`; }
    catch { msg('Não foi possível carregar essa imagem'); next = null; }
  };
  const close = () => { o.remove(); removeEventListener('paste', paste); };
  const paste = e => {
    const f = [...(e.clipboardData?.files || [])].find(f => f.type.startsWith('image/')), t = e.clipboardData?.getData('text');
    if (f) { e.preventDefault(); pick(null, f); } else if (/^https?:\/\//.test(t || '') && !/INPUT|TEXTAREA/.test(e.target.tagName)) { Q('[data-url]').value = t; pick(t); }
  };
  addEventListener('paste', paste);
  const drop = Q('[data-drop]');
  drop.ondragover = e => { e.preventDefault(); drop.classList.add('border-emerald-500'); };
  drop.ondragleave = () => drop.classList.remove('border-emerald-500');
  drop.ondrop = e => { e.preventDefault(); drop.classList.remove('border-emerald-500'); const f = [...e.dataTransfer.files].find(f => f.type.startsWith('image/')), u = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text'); f ? pick(null, f) : /^https?:/.test(u) && (Q('[data-url]').value = u, pick(u)); };
  o.onclick = e => (e.target === o || e.target.closest('[data-x]')) && close();
  o.querySelectorAll('[data-ext]').forEach(b => b.onclick = () => open(EXT[b.dataset.ext][1](encodeURIComponent(Q('[data-q]').value.trim())), '_blank', 'noopener'));
  const search = async () => {
    const q = Q('[data-q]').value.trim(), R = Q('[data-res]'); if (!q) return;
    R.innerHTML = '<span class="col-span-4 text-zinc-500">Buscando...</span>';
    const l = await searchScene(scene ? i : 'x' + q, q, track ? topicOf(track.timeline) : '', VW / VH);
    if (scene) ov[i] = { ...ov[i], q };
    R.innerHTML = l.length ? l.slice(0, 16).map((c, k) => `<div data-c="${k}" class="tile" title="${escH(c.credit)}" style="background-image:url('${c.thumb}')"></div>`).join('') : '<span class="col-span-4 text-zinc-500">Nada encontrado. Tente outro termo, use as fontes externas ou ative mais fontes na aba Mídia.</span>';
    R.querySelectorAll('[data-c]').forEach(x => x.onclick = () => { R.querySelectorAll('.tile').forEach(y => y.classList.toggle('on', y === x)); const c = l[x.dataset.c]; Q('[data-url]').value = c.src; pick(c.src, null, c.credit); });
  };
  Q('[data-search]').onclick = search; Q('[data-q]').onkeydown = e => e.key === 'Enter' && search();
  if (scene && CANDS[i]?.list) search();
  Q('[data-load]').onclick = () => { const u = Q('[data-url]').value.trim(); /^https?:\/\//.test(u) ? pick(u) : warn('Informe uma URL começando com http(s)://'); };
  Q('[data-file]').onchange = e => e.target.files[0] && pick(null, e.target.files[0]);
  Q('[data-go]').onclick = () => { close(); scene ? selectScene(i, true) : cur && goTo(cur.img); };
  Q('[data-del]').onclick = async () => {
    if (scene) { ov[i] = { ...ov[i], img: undefined, noimg: true }; close(); return live(2); }
    if (!await ask('Excluir esta imagem do projeto?')) return;
    removeAsset(a); if (a.origin === 'file') saveFiles();
    if (a.origin === 'url') $('img-urls').value = $('img-urls').value.split('\n').filter(l => !l.includes(a.src)).join('\n');
    ov.forEach(x => x?.img === a && delete x.img); P = P.map(l => l.filter(x => x !== a));
    close(); grid(P); live(2);
  };
  Q('[data-save]').onclick = async () => {
    const u = Q('[data-url]').value.trim();
    if (!next && u && u !== cur?.src && /^https?:/.test(u)) await pick(u);
    if (scene) {
      if (!next) return close();
      const na = await addAsset({ src: next.blob ? next.src : next.src, credit: next.credit, tag: Q('[data-q]').value.trim(), origin: next.blob ? 'file' : 'custom' });
      if (next.blob) { na.blob = next.blob; saveFiles(); }
      ov[i] = { ...ov[i], img: na, noimg: undefined }; close(); grid(P); return live(2);
    }
    const oldSrc = a.src, wasUrl = a.origin === 'url', tag = Q('[data-tag]').value.trim();
    if (next) { Object.assign(a, { src: next.src, img: next.img, credit: next.credit }); a.blob = next.blob; a.origin = next.blob ? 'file' : wasUrl ? 'url' : 'custom'; }
    a.tag = tag;
    if (wasUrl) { const L = $('img-urls').value.split('\n'), k = L.findIndex(l => l.includes(oldSrc)); const line = a.origin === 'url' ? (tag ? `${tag} | ${a.src}` : a.src) : null; if (k >= 0) line ? L[k] = line : L.splice(k, 1); $('img-urls').value = L.join('\n'); $('img-urls').dispatchEvent(new Event('input')); }
    saveFiles(); close(); grid(P); live(next ? 2 : 3);
  };
}

// --- Fontes de imagem (chaves grátis ficam só neste navegador) ---
let imgCfg = await store.get('imgcfg') || { keys: {}, off: {} };
setConfig(imgCfg);
function srcUI() {
  $('src-cfg').innerHTML = Object.entries(PROVIDERS).map(([k, p]) => `<div class="flex flex-col gap-1 bg-zinc-900/60 rounded-lg p-2">
    <label class="row justify-between"><span class="text-zinc-200">${p.n}</span><input type="checkbox" data-on="${k}" ${imgCfg.off[k] ? '' : 'checked'}></label>
    ${p.key ? `<div class="flex gap-1.5 items-center"><input data-key="${k}" type="password" class="inp !p-1.5 text-[11px]" placeholder="Chave da API" value="${escH(imgCfg.keys[k] || '')}"><a href="${p.url}" target="_blank" rel="noopener" class="text-emerald-400 whitespace-nowrap hover:underline">obter grátis</a></div>` : ''}</div>`).join('');
  $('src-count').textContent = `(${activeSrc().length} ativas)`;
}
$('src-cfg').addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.on) imgCfg.off[t.dataset.on] = !t.checked;
  if (t.dataset.key) imgCfg.keys[t.dataset.key] = t.value.trim();
  setConfig(imgCfg); store.set('imgcfg', imgCfg); srcUI(); Object.keys(CANDS).forEach(k => delete CANDS[k]);
});
srcUI();

// --- Tipos de vídeo ---
$('vtype').innerHTML = Object.entries(TYPES).map(([k, v]) => `<option value="${k}">${v.n}</option>`).join('');
const typeUI = () => { const t = $('vtype').value; $('vtype-d').textContent = TYPES[t].d + (t === 'doc' ? '' : ' · use os marcadores ao lado ou "Reformatar roteiro"'); $('vtype-n-w').classList.toggle('hidden', t !== 'top'); };
function applyPreset() {
  const P = PRESETS[$('vtype').value]; if (!P || !$('vtype-auto').checked) return;
  const set = (id, v) => { if (v == null) return; $(id).value = v; $(id).dispatchEvent(new Event('change', { bubbles: true })); };
  set('style-select', el.style.options[P.style].value); set('cap-style', P.cap); set('music-prof', P.prof); set('sfx-pack', P.sfx); set('amb-select', P.amb); if (P.grade) set('grade-select', P.grade);
  G.prof?.select(P.prof); G.sfx?.select(P.sfx); G.amb?.select(P.amb); readText();
}
$('vtype').addEventListener('change', () => { typeUI(); applyPreset(); if (track) { lastGen = el.txt.value; generate(); } });
$('vtype-fmt').onclick = () => {
  const t = $('vtype').value, ss = sentences(el.txt.value.replace(/^(#\s*\d+.*|passo\s*\d+\s*:\s*|\d{1,4}(\s*a\.C\.)?\s*\|\s*|urgente\s*:\s*|você sabia que\s*)/gim, ''));
  el.txt.value = formatScript(t, ss.length ? ss : splitScenes(el.txt.value), { n: +$('vtype-n').value || 5, title: $('video-title').value.trim() });
  el.txt.dispatchEvent(new Event('input')); count(); lastGen = el.txt.value; generate();
};
typeUI();

// --- Ideias & Tendências: listas em alta + roteiro automático a partir da Wikipedia ---
let trSrc = 'wiki', trCfg = await store.get('trendcfg') || {};
$('yt-key').value = trCfg.ytKey || '';
$('yt-key').onchange = e => { trCfg.ytKey = e.target.value.trim(); store.set('trendcfg', trCfg); loadTrends(); };
$('tr-src').innerHTML = Object.entries(TSRC).map(([k, v]) => `<button data-s="${k}" class="px-2 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-purple-600 text-[11px] flex items-center gap-1.5"><i data-lucide="${v.icon}" class="w-3.5 h-3.5"></i>${v.n}</button>`).join('');
$('tr-ext').innerHTML = TEXT.map(([n, u]) => `<a href="${u}" target="_blank" rel="noopener" class="px-2.5 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 text-[11px] flex items-center gap-1">${n} <i data-lucide="external-link" class="w-3 h-3"></i></a>`).join('');
async function loadTrends() {
  document.querySelectorAll('#tr-src [data-s]').forEach(b => b.classList.toggle('!border-emerald-500', b.dataset.s === trSrc));
  $('tr-key').classList.toggle('hidden', trSrc !== 'yt'); $('tr-key').classList.toggle('flex', trSrc === 'yt');
  const L = $('tr-list'); L.innerHTML = '<span class="text-zinc-500">Carregando...</span>';
  try {
    const f = $('tr-q').value.trim().toLowerCase();
    let l = await trends(trSrc, { lang: $('tr-lang').value, q: f, ytKey: trCfg.ytKey });
    if (f && trSrc !== 'news') l = l.filter(x => x.title.toLowerCase().includes(f));
    L.innerHTML = l.length ? l.map((x, k) => `<div class="flex gap-2 items-start bg-zinc-900/70 rounded-lg p-2 border border-zinc-800">
      ${x.thumb ? `<img src="${x.thumb}" class="w-14 h-9 object-cover rounded flex-none">` : `<span class="w-6 text-center text-purple-400 font-bold">${k + 1}</span>`}
      <div class="flex-1 min-w-0"><b class="block text-zinc-200 text-[11px] leading-snug">${escH(x.title)}</b><span class="text-[10px] text-zinc-500">${escH(x.sub)}</span>
        <div class="flex gap-1.5 mt-1"><button data-make="${k}" class="px-2 py-0.5 rounded bg-purple-700 hover:bg-purple-600 text-white text-[10px] font-bold">CRIAR VÍDEO</button><a href="${x.url}" target="_blank" rel="noopener" class="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px]">abrir ↗</a></div></div></div>`).join('') : '<span class="text-zinc-500">Nada encontrado.</span>';
    L.querySelectorAll('[data-make]').forEach(b => b.onclick = () => makeFrom(l[b.dataset.make]));
  } catch (e) { L.innerHTML = `<span class="text-red-400">${escH(e.message || String(e))}</span>`; }
}
$('tr-src').onclick = e => { const b = e.target.closest('[data-s]'); if (b) { trSrc = b.dataset.s; loadTrends(); } };
$('tr-go').onclick = loadTrends; $('tr-q').onkeydown = e => e.key === 'Enter' && loadTrends(); $('tr-lang').addEventListener('change', loadTrends);
let trLoaded = false;
document.querySelector('[data-tab=ideas]').addEventListener('click', () => trLoaded || (trLoaded = true, loadTrends()));
if ((await store.get('tab')) === 'ideas') { trLoaded = true; loadTrends(); }
// cria o roteiro (Wikipedia) e oferece novo projeto ou substituir o atual
async function makeFrom(item) {
  const topic = typeof item === 'string' ? item : item.wiki || item.title;
  prog('Montando roteiro a partir da Wikipedia', null);
  let r;
  try { r = await scriptFromTopic(topic, { lang: item.lang || $('tr-lang').value, size: +$('tr-size').value }); }
  catch { r = { title: item.title || topic, text: [item.title, item.desc].filter(Boolean).join('. ').slice(0, 600) || topic }; }
  if ($('vtype').value !== 'doc') r.text = formatScript($('vtype').value, r.text.split('\n').filter(Boolean), { n: +$('vtype-n').value || 5, title: r.title });
  progDone(0);
  const pr = modal({ title: 'Criar vídeo', html: `<label class="fl">Título<input id="mk-title" class="inp !p-2" value="${escH(r.title)}"></label>
    <label class="fl">Roteiro (edite à vontade)<textarea id="mk-text" class="inp h-56 text-[12px] leading-relaxed">${escH(r.text)}</textarea></label>${r.url ? `<a href="${r.url}" target="_blank" rel="noopener" class="text-[10px] text-emerald-400">Fonte: Wikipedia ↗</a>` : ''}`,
    buttons: [{ label: 'Cancelar', value: null }, { label: 'Usar neste projeto', value: 'here' }, { label: 'Criar novo projeto', value: 'new', primary: true }] });
  const box = [...document.querySelectorAll('.z-\\[100\\]')].pop(); box.querySelector('.max-w-md')?.classList.replace('max-w-md', 'max-w-2xl');
  let T = r.title, X = r.text;
  document.getElementById('mk-title').oninput = e => T = e.target.value; document.getElementById('mk-text').oninput = e => X = e.target.value;
  const v = await pr;
  if (v === 'new') { await flushProj(); return projects.create({ 'script-input': X, 'video-title': T }); }
  if (v === 'here') { el.txt.value = X; $('video-title').value = T; el.txt.dispatchEvent(new Event('input')); $('video-title').dispatchEvent(new Event('input')); count(); showTab('script'); lastGen = X; generate(); }
}
$('tr-own').onclick = async () => {
  const pr = modal({ title: 'Criar vídeo sobre um tema', html: '<input id="own-q" class="inp !p-2" placeholder="Ex.: Pirâmides do Egito">', buttons: [{ label: 'Cancelar', value: null }, { label: 'Montar roteiro', value: 1, primary: true }] });
  const inp = document.getElementById('own-q'); let q = ''; inp.oninput = e => q = e.target.value; inp.focus();
  inp.onkeydown = e => e.key === 'Enter' && inp.closest('.z-\\[100\\]').querySelector('.bg-purple-700').click();
  if (await pr && q.trim()) makeFrom(q.trim());
};

// --- Projetos: autosave do espaço de trabalho + gerenciador ---
let curId = await store.get('curProject');
if (!curId) { curId = projects.newId(); await store.set('curProject', curId); }
const saveWS = () => { store.set('ws', { variation, texts: track?.timeline.map(s => s.text), ov: ov.map(o => o && { ...o, img: o.img?.id }), P: P.map(l => l.map(a => a.id)),
  ext: assets.filter(a => a.origin !== 'file').map(({ id, src, tag, credit, origin }) => ({ id, src, tag, credit, origin })) }); dirty = true; };
const projName = () => $('video-title').value.trim() || el.txt.value.trim().split(/[.!?\n]/)[0].slice(0, 40) || 'Sem título';
const thumb = () => { const c = Object.assign(document.createElement('canvas'), { width: 192, height: Math.round(192 * VH / VW) }); c.getContext('2d').drawImage(cv, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', .6); };
async function saveProject() { dirty = false; await projects.snapshot(curId, { name: projName(), thumb: mix ? thumb() : undefined, aspect: $('aspect').value, scenes: track?.timeline.length || 0 }); showProj(); }
const showProj = async () => { const p = (await projects.list()).find(x => x.id === curId); $('proj-name').textContent = p?.name || projName(); $('proj-saved').textContent = '✓'; };
document.addEventListener('input', () => dirty = true, true); document.addEventListener('change', () => dirty = true, true);
setInterval(() => dirty && !busy && saveProject(), 3000);
const flushProj = async () => { await new Promise(r => setTimeout(r, 450)); saveWS(); await saveProject(); };
const ago = t => { const s = (Date.now() - t) / 1e3; return s < 60 ? 'agora' : s < 3600 ? `${s / 60 | 0} min` : s < 86400 ? `${s / 3600 | 0} h` : new Date(t).toLocaleDateString('pt-BR'); };
async function manager() {
  await flushProj();
  const o = document.createElement('div');
  o.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4';
  const draw = async () => {
    const l = await projects.list();
    o.innerHTML = `<div class="w-full max-w-3xl max-h-[85vh] flex flex-col bg-zinc-950 border border-purple-800/60 rounded-xl shadow-2xl p-5 gap-4 text-zinc-300">
      <div class="flex items-center gap-3"><h3 class="pane-h flex-1"><i data-lucide="folder-open" class="w-4 h-4"></i> Meus projetos <span class="text-zinc-600 normal-case tracking-normal">(${l.length})</span></h3>
        <button data-imp class="btn !py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200" title="Abrir arquivo .synapse"><i data-lucide="upload" class="w-4 h-4"></i> Importar</button>
        <button data-new class="btn !py-1.5 bg-purple-700 hover:bg-purple-600 text-white"><i data-lucide="plus" class="w-4 h-4"></i> Novo projeto</button><button data-x class="pbtn text-zinc-400">✕</button></div>
      <div class="grid grid-cols-2 md:grid-cols-3 gap-3 overflow-y-auto pr-1">${l.map(p => `
        <div data-id="${p.id}" class="rounded-lg border ${p.id === curId ? 'border-emerald-500' : 'border-zinc-800 hover:border-purple-600'} bg-zinc-900/60 overflow-hidden flex flex-col">
          <div data-open class="aspect-video bg-black bg-center bg-contain bg-no-repeat cursor-pointer relative" style="background-image:url('${p.thumb || ''}')">${p.id === curId ? '<span class="absolute top-1 left-1 text-[10px] bg-emerald-600 text-white px-1.5 rounded">ABERTO</span>' : ''}<span class="absolute bottom-1 right-1 text-[10px] bg-black/70 px-1.5 rounded">${p.aspect || '16:9'}</span></div>
          <div class="p-2 flex flex-col gap-1"><b class="truncate text-zinc-200 text-xs" title="${escH(p.name)}">${escH(p.name)}</b><span class="text-[10px] text-zinc-500">${p.scenes || 0} cenas · editado ${ago(p.updated)}</span>
            <div class="flex gap-1 mt-1"><button data-open class="flex-1 text-[11px] py-1 rounded bg-emerald-800 hover:bg-emerald-700 text-white">Abrir</button>
              <button data-ren class="pbtn" title="Renomear"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button><button data-exp class="pbtn" title="Exportar .synapse"><i data-lucide="download" class="w-3.5 h-3.5"></i></button><button data-dup class="pbtn" title="Duplicar"><i data-lucide="copy" class="w-3.5 h-3.5"></i></button><button data-del class="pbtn text-red-400" title="Excluir"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button></div></div></div>`).join('')}</div></div>`;
    lucide.createIcons({ root: o });
  };
  document.body.appendChild(o); await draw();
  const close = () => o.remove();
  o.onclick = async e => {
    if (e.target === o || e.target.closest('[data-x]')) return close();
    if (e.target.closest('[data-new]')) return projects.create();
    if (e.target.closest('[data-imp]')) return Object.assign(document.createElement('input'), { type: 'file', accept: '.synapse', onchange: async ev => {
      try { const f = ev.target.files[0]; if (f) { await projects.unpack(await f.arrayBuffer()); draw(); } } catch (x) { warn(x.message); }
    } }).click();
    const card = e.target.closest('[data-id]'); if (!card) return;
    const id = card.dataset.id, p = (await projects.list()).find(x => x.id === id);
    if (e.target.closest('[data-open]')) return id === curId ? close() : projects.open(id);
    if (e.target.closest('[data-exp]')) {
      if (id === curId) await flushProj();
      const blob = await projects.pack(id), name = `${p.name.replace(/[\/:*?"<>|]+/g, '_').slice(0, 60) || 'projeto'}.synapse`;
      if (!isDesktop) return download(blob, name);
      const path = await native('save_doc', new Uint8Array(await blob.arrayBuffer()), { headers: { name: encodeURIComponent(name) } });
      return modal({ title: 'Projeto exportado', msg: path, icon: '✓', buttons: [{ label: 'OK', value: false }, { label: 'Abrir pasta', value: true, primary: true }] }).then(v => v && native('reveal', { path }));
    }
    if (e.target.closest('[data-dup]')) { await projects.duplicate(id); return draw(); }
    if (e.target.closest('[data-ren]')) {
      const pr = modal({ title: 'Renomear projeto', html: `<input id="ren-in" class="inp" value="${escH(p.name)}">`, buttons: [{ label: 'Cancelar', value: null }, { label: 'Salvar', value: 'ok', primary: true }] });
      const inp = document.getElementById('ren-in'); let nv = inp.value; inp.oninput = e => nv = e.target.value; inp.focus(); inp.select();
      if (await pr && nv.trim()) await projects.rename(id, nv.trim()); return draw();
    }
    if (e.target.closest('[data-del]')) {
      if (!await ask(`Excluir o projeto "${p.name}"? Isso não pode ser desfeito.`)) return;
      await projects.remove(id);
      if (id === curId) { const r = await projects.list(); return r.length ? projects.open(r[0].id) : projects.create(); }
      return draw();
    }
  };
}
$('btn-projects').onclick = manager;

// --- Persistência (IndexedDB) ---
const addFile = (f, id) => addAsset({ src: URL.createObjectURL(f), tag: (f.name || '').replace(/\.\w+$/, '').replace(/[-_]/g, ' '), origin: 'file', id }).then(a => (a.blob = f, a)).catch(() => { });
const saveFiles = () => { store.set('imgs', assets.filter(a => a.blob).map(a => ({ id: a.id, blob: a.blob }))); dirty = true; };
await store.bindForm(() => {
  vigUI(); typeUI(); refreshRanges(); count(); $('pitch-val').textContent = el.pitch.value; $('rate-val').textContent = el.rate.value; });
await applyAspect();
galleries(); enhance(); tooltips();
if (isDesktop) nativeInfo.then(i => { document.querySelector('h1')?.insertAdjacentHTML('afterend', `<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300" title="${i ? i.os + ' · ' + i.cpus + ' núcleos' : ''}">DESKTOP</span>`); });
// vozes neurais (desktop): instala o motor Python na 1ª vez, com confirmação e progresso
neural.install = async engine => {
  const xt = engine === 'xtts', ok = await modal({ title: xt ? 'Instalar XTTS (clonagem de voz)' : 'Instalar vozes Kokoro pt-BR', icon: '◈',
    msg: xt ? 'Requer Python 3.9+. Baixa ~3 GB (PyTorch + modelo). Mais lenta sem placa NVIDIA. Licença do modelo XTTS-v2 (Coqui CPML): somente uso NÃO comercial. Continuar?' : 'Requer Python 3.9+. Baixa ~450 MB. Vozes naturais em português, rápidas no processador. Continuar?',
    buttons: [{ label: 'Cancelar', value: false }, { label: 'Instalar', value: true, primary: true }] });
  if (!ok) return false;
  const m = progress({ title: 'Instalando vozes neurais' }); let n = 0;
  const off = await listen('neural-setup', l => l && m.set(Math.min(.95, ++n / 400), l.slice(0, 110)));
  try { await native('neural_setup', { engine }); return true; } catch (e) { warn(String(e)); return false; } finally { off(); m.close(); }
};
// amostra da voz para clonagem (XTTS): convertida para WAV mono e cortada em 20 s
const refBox = () => $('ref-box')?.classList.toggle('hidden', !el.voice.value.includes('xtts'));
$('ref-file') && ($('ref-file').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const b = await new AudioContext().decodeAudioData(await f.arrayBuffer()), n = Math.min(b.length, b.sampleRate * 20), c = new AudioBuffer({ length: n, sampleRate: b.sampleRate });
    c.copyToChannel(b.getChannelData(0).slice(0, n), 0);
    await setRef(toWav(c)); $('ref-name').textContent = `${f.name} · ${(n / b.sampleRate).toFixed(1)} s`; store.set('voiceRefName', $('ref-name').textContent);
    el.voice.dispatchEvent(new Event('change', { bubbles: true }));
  } catch { warn('Não consegui ler esse áudio. Use WAV ou MP3.'); }
});
el.voice.addEventListener('change', refBox); refBox();
store.get('voiceRefName').then(v => v && $('ref-name') && ($('ref-name').textContent = v));
if (!await store.get('mig-clean')) { // aplica uma vez os novos padrões (voz natural, sem ambiente)
  for (const [id, v] of [['effect-select', 'clean'], ['amb-select', 'none']]) { $(id).value = v; $(id).dispatchEvent(new Event('change', { bubbles: true })); G[id === 'amb-select' ? 'amb' : 'effect']?.select(v); }
  store.set('mig-clean', 1);
}
await setWm(await store.get('wm')).catch(() => { });
readText();
for (const f of await store.get('imgs') || []) await (f instanceof Blob ? addFile(f) : addFile(f.blob, f.id));
grid();
const ws = await store.get('ws');
if (ws) { await Promise.allSettled((ws.ext || []).map(a => addAsset(a))); restored = ws; grid(); }
const ms = await store.get('music');
if (ms) try { music = { ...ms, buf: await decodeAudio(ms.blob) }; $('music-name').textContent = '♪ ' + ms.name; $('music-clear').classList.remove('hidden'); } catch { }
// prévia automática ao abrir
if ($('auto-gen').checked && el.txt.value.trim()) { lastGen = el.txt.value; generate(); }
showProj();
dirty = true;
