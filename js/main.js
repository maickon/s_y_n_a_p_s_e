import { splitScenes, hash } from './core/script.js';
import { buildVoiceTrack } from './core/voicetrack.js';
import { EFFECTS } from './audio/fx.js';
import { VOICES } from './tts/index.js';
import { toWav } from './audio/wav.js';
import { mixdown } from './audio/mix.js';
import { AMBS } from './audio/ambience.js';
import { searchAudio, decodeAudio } from './media/audiosearch.js';
import { createBg } from './render/bg.js';
import { loadTTS } from './tts/mespeak.js';
import { transcribe } from './ai/whisper.js';
import { align, groups, toSRT } from './core/words.js';
import { createCompositor } from './render/compositor.js';
import { exportMP4 } from './export/mp4.js';
import { exportHyperFrames } from './export/hyperframes.js';
import { direct, INTRO } from './core/direct.js';
import { LAYOUT_NAMES, TRANS_NAMES } from './render/layouts.js';
import { assets, addAsset, removeAsset, parseUrls, plan } from './core/assets.js';
import { createPlayer } from './ui/player.js';

const $ = id => document.getElementById(id);
const PRESET = `A realidade é apenas uma simulação em baixa resolução.
As máquinas continuam sonhando com circuitos em chamas.
O tempo dobrou sobre si mesmo no limiar do abismo.
Esquecemos o som da chuva antes da entropia final.
Sua consciência foi transcrita com sucesso no servidor do nada.`;

const el = { txt: $('script-input'), voice: $('voice-select'), style: $('style-select'), pitch: $('voice-pitch'), rate: $('voice-rate') };
const cv = $('view-canvas'), bg = createBg(), comp = await createCompositor(cv, bg.canvas);
const frame = (t, o) => { bg.draw(); comp.render(t, o); };
const EXP = ['btn-export', 'btn-wav', 'btn-srt', 'btn-mp4', 'btn-hf'];
let ctx, rec, track, caps = [], segsCur = [], mix, music = null, busy = false, P = [], dir = {}, variation = 0, ov = [];

const status = (t, c = 'bg-zinc-600') => { $('status-text').textContent = t; $('status-indicator').className = `w-2 h-2 rounded-full ${c}`; };
const count = () => $('char-count').textContent = `${el.txt.value.length} caracteres`;
const enable = (b, on) => { b.disabled = !on; b.classList.toggle('opacity-40', !on); b.classList.toggle('cursor-not-allowed', !on); };
const download = (blob, name) => { const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name }); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1e3); };

el.voice.innerHTML = Object.entries(VOICES).map(([g, vs]) => `<optgroup label="${g}">${Object.entries(vs).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</optgroup>`).join('');
$('effect-select').innerHTML = Object.entries(EFFECTS).map(([k, v]) => `<option value="${k}">${v.n}</option>`).join('');
el.voice.value = 'piper:pt_BR-faber-medium'; $('effect-select').value = 'star';
el.txt.value = PRESET; count();
el.txt.oninput = count;
$('btn-preset').onclick = () => { el.txt.value = PRESET; count(); };
for (const k of ['pitch', 'rate']) el[k].oninput = () => $(`${k}-val`).textContent = el[k].value;
frame(0);
loadTTS().then(() => status('MOTOR DE VOZ PRONTO', 'bg-emerald-500')).catch(e => status('ERRO AO CARREGAR VOZ', 'bg-red-500'));

let warned = false;
async function makeTrack(scenes) {
  const t = await buildVoiceTrack(scenes, {
    voice: el.voice.value, effect: $('effect-select').value, tom: +el.pitch.value, speed: +el.rate.value, lead: scenes.length > 1 ? INTRO : .3,
    onDownload: e => e?.total && status(`BAIXANDO MODELO DE VOZ ${e.loaded / e.total * 100 | 0}%`, 'bg-yellow-400 animate-pulse'),
    onProgress: (i, n) => status(`SINTETIZANDO VOZ ${i + 1}/${n}`, 'bg-yellow-400 animate-pulse')
  });
  if (t.fallback && !warned) { warned = true; alert('Não foi possível carregar a voz escolhida (rede/modelo). Usando eSpeak como alternativa.'); }
  return t;
}

$('btn-test').onclick = async () => {
  if (busy) return;
  busy = true;
  try {
    ctx ??= new AudioContext();
    const { buffer } = await makeTrack([splitScenes(el.txt.value)[0] || 'Teste de voz.']);
    const s = new AudioBufferSourceNode(ctx, { buffer }); s.connect(ctx.destination); s.start();
    status('TESTE DE VOZ', 'bg-purple-500');
  } catch (e) { console.error(e); status('ERRO: ' + e.message, 'bg-red-500'); }
  busy = false;
};

const v = id => $(id).value / 100;
async function run(fn) {
  if (busy) return;
  busy = true; ['btn-manifest', 'btn-vary', ...EXP].forEach(b => enable($(b), false));
  try { await fn(); } catch (e) { console.error(e); status('ERRO: ' + e.message, 'bg-red-500'); }
  busy = false; enable($('btn-manifest'), true);
  if (mix) ['btn-vary', ...EXP].forEach(b => enable($(b), true));
}

// edição -> mix -> reprodução/gravação
async function render() {
  dir = direct(track.timeline, P, { variation, ov, title: $('video-title').value.trim(), credits: ['Música: ' + (music?.name || 'procedural S.Y.N.A.P.S.E')] });
  comp.load(segsCur = dir.segs);
  status('MIXANDO ÁUDIO...', 'bg-yellow-400 animate-pulse');
  mix = await mixdown({ voice: track.buffer, timeline: track.timeline, segs: segsCur, duration: dir.duration, style: el.style.selectedIndex, seed: hash(el.txt.value) + variation,
    musicBuf: music?.buf, amb: $('amb-select').value, vol: { voice: 1, music: v('vol-music') * .7, amb: v('vol-amb') * .6, sfx: v('vol-sfx') * .8 } });
  grid(P); editor(); marks();
  const first = !pl.time && !pl.playing;
  pl.setBuffer(mix);
  if (first) pl.play(0);
  status('PREVIEW PRONTO', 'bg-emerald-500');
}

$('btn-manifest').onclick = () => {
  const scenes = splitScenes(el.txt.value);
  if (!scenes.length) return alert('Digite um roteiro válido.');
  run(async () => {
    track = await makeTrack(scenes);
    if ($('ai-sync').checked) try {
      status('WHISPER: CARREGANDO...', 'bg-yellow-400 animate-pulse');
      const asr = await transcribe(track.dry, e => e.status === 'progress' && e.file?.endsWith('.onnx') && status(`WHISPER: BAIXANDO ${e.progress | 0}%`, 'bg-yellow-400 animate-pulse'));
      status('WHISPER: ALINHANDO...', 'bg-yellow-400 animate-pulse');
      track.timeline = align(track.timeline, asr);
    } catch (e) { console.warn('Whisper indisponível, usando estimativa', e); }
    caps = groups(track.timeline);
    await syncUrls();
    P = await plan(track.timeline, { search: $('img-search').checked, clip: $('img-clip').checked, onStatus: m => status(m, 'bg-yellow-400 animate-pulse') });
    variation = 0; ov = [];
    await render();
  });
};
$('btn-vary').onclick = () => track && run(() => (variation++, render()));

// --- Edição ao vivo: aplica mudanças sem parar o player ---
// níveis: 1 = remixar áudio, 2 = refazer edição, 3 = reassociar imagens, 4 = re-sintetizar voz
let pend = 0, liveT;
const live = lv => { if (!track) return; pend = Math.max(pend, lv); clearTimeout(liveT); liveT = setTimeout(flush, 400); };
async function flush() {
  if (busy) return liveT = setTimeout(flush, 300);
  const lv = pend; pend = 0;
  await run(async () => {
    if (lv >= 4) { track = await makeTrack(track.timeline.map(s => s.text)); caps = groups(track.timeline); }
    if (lv >= 3) { await syncUrls(); P = await plan(track.timeline, { search: $('img-search').checked, clip: $('img-clip').checked, onStatus: m => status(m, 'bg-yellow-400 animate-pulse') }); }
    await render();
  });
}
const on = (ids, ev, lv) => ids.split(' ').forEach(id => $(id).addEventListener(ev, () => live(lv)));
on('voice-select effect-select voice-pitch voice-rate', 'change', 4);
on('img-search img-clip', 'change', 3);
on('video-title', 'input', 2);
on('style-select amb-select vol-music vol-amb vol-sfx', 'change', 1);

// quadro determinístico no tempo t (preview e export)
function drawAt(t) {
  const tl = track?.timeline || [], i = tl.findLastIndex(s => t >= s.start - .05), s = tl[i], style = el.style.selectedIndex;
  bg.u.style.value = style; bg.u.seed.value = s ? hash(s.text) % 100 : 0; bg.u.glitch.value = s ? Math.max(0, 1 - (t - s.start) / .3) : 0; bg.u.t.value = t * 1.8;
  frame(t, { caps, timeline: tl, style, dir });
  return i;
}

$('btn-mp4').onclick = () => mix && run(async () => {
  const [h, fps] = $('mp4-q').value.split('p').map(Number), out = h === 1080 ? cv : Object.assign(document.createElement('canvas'), { width: 1280, height: 720 }), og = out !== cv ? out.getContext('2d') : null;
  try {
    const t = Date.now(), { blob, vc, ac } = await exportMP4({ canvas: out, audio: mix, duration: mix.duration, fps, draw: t => { drawAt(t); og?.drawImage(cv, 0, 0, 1280, 720); }, onProgress: p => status(`RENDERIZANDO MP4 ${p * 100 | 0}%`, 'bg-yellow-400 animate-pulse') });
    download(blob, `SYNAPSE_${h}p${fps}_${Date.now()}.mp4`);
    status(`MP4 PRONTO · ${vc.toUpperCase()}/${(ac || 'sem áudio').toUpperCase()} · ${((Date.now() - t) / 1e3).toFixed(1)}s`, 'bg-emerald-500');
  } finally { drawAt(0); }
});

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
  status('EMPACOTANDO HYPERFRAMES...', 'bg-yellow-400 animate-pulse');
  download(await exportHyperFrames({ segs: segsCur, caps, dir, mix, style: el.style.selectedIndex, title: dir.intro.title }), `SYNAPSE_hyperframes_${Date.now()}.zip`);
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
    d.querySelector('img').onclick = () => goTo(a.img);
    d.querySelector('button').onclick = () => {
      removeAsset(a); live(3);
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
    status(`CARREGANDO IMAGEM ${i + 1}/${list.length}`, 'bg-yellow-400 animate-pulse');
    try { Object.assign(await addAsset(x), { tag: x.tag || '' }); } catch (e) { console.warn('Imagem falhou:', x.src); }
  }
  grid();
}

$('img-files').onchange = async e => {
  for (const f of e.target.files) await addAsset({ src: URL.createObjectURL(f), tag: f.name.replace(/\.\w+$/, '').replace(/[-_]/g, ' '), origin: 'file' }).catch(() => {});
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
    const tl = track?.timeline || [], i = tl.findLastIndex(s => t >= s.start - .05);
    if (i !== lastScene) {
      lastScene = i; $('scene-counter').textContent = `${Math.max(i + 1, 0)}/${tl.length}`;
      if (i >= 0) $('scene-hash').textContent = `HASH: 0x${hash(tl[i].text).toString(16).slice(0, 6).toUpperCase()}`;
      document.querySelectorAll('#scene-list > div').forEach((d, k) => d.classList.toggle('ring-1', k === i));
    }
  },
  onEnd: () => rec?.state === 'recording' && rec.stop()
});
function marks() {
  const D = mix.duration;
  $('pl-seek').max = D;
  $('pl-marks').innerHTML = track.timeline.map((s, i) => `<span title="Cena ${i + 1}" style="left:${s.start / D * 100}%" class="absolute top-0 w-px h-2 bg-purple-400"></span>`).join('');
}
$('pl-play').onclick = () => pl.toggle();
$('pl-back').onclick = () => pl.seek(pl.time - 5);
$('pl-fwd').onclick = () => pl.seek(pl.time + 5);
$('pl-seek').oninput = e => pl.seek(+e.target.value);
document.addEventListener('keydown', e => { if (e.code === 'Space' && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && mix) { e.preventDefault(); pl.toggle(); } });
const goTo = img => { const s = segsCur.find(x => x.img === img); if (s) pl.seek(s.a + .5); };

window.synapse = { comp, get segs() { return segsCur; }, frame: drawAt, get duration() { return mix?.duration || 0; } };

// --- Trilha sonora ---
$('amb-select').innerHTML = Object.entries(AMBS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
const setMusic = m => {
  music = m; live(1);
  $('music-name').textContent = m ? '♪ ' + m.name : '♪ Procedural (gerada pelo estilo)';
  $('music-clear').classList.toggle('hidden', !m);
};
$('music-clear').onclick = () => setMusic(null);
$('music-file').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try { setMusic({ name: f.name, buf: await decodeAudio(f) }); } catch { alert('Formato de áudio não suportado.'); }
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
        try { setMusic({ name: x.credit, buf: await decodeAudio(x.url) }); us.textContent = '✓'; }
        catch { us.textContent = 'USAR'; alert('Essa fonte bloqueia download direto (CORS). Baixe o arquivo e use "Enviar".'); }
      };
      return d;
    }));
    if (!rs.length) box.textContent = 'Nada encontrado.';
  } catch (e) { box.textContent = 'Busca indisponível: ' + e.message; }
};
$('music-q').onkeydown = e => e.key === 'Enter' && $('music-search').click();

// --- Editor de cenas ---
const LN = { full: 'Tela cheia', frame: 'Moldura', split: 'Dividida', double: 'Dupla exp.', circle: 'Círculo' }, TNm = { fade: 'Fade', glitch: 'Glitch', zoom: 'Zoom', pixel: 'Pixel', wipe: 'Wipe', slide: 'Slide' };
const opts = (list, names, cur, auto) => `<option value="">Auto${auto ? ' (' + names[auto] + ')' : ''}</option>` + list.map(k => `<option value="${k}" ${k === cur ? 'selected' : ''}>${names[k]}</option>`).join('');
function editor() {
  const sel = 'bg-zinc-900 border border-zinc-800 rounded p-1 w-full';
  $('scene-list').replaceChildren(...track.timeline.map((s, i) => {
    const o = ov[i] || {}, sg = segsCur.find(x => x.scene === i), d = document.createElement('div');
    d.className = 'grid grid-cols-12 gap-1 items-center bg-black/30 rounded p-1';
    const imgs = Object.fromEntries(assets.map((a, k) => [k, `${k + 1}. ${(a.tag || a.origin).slice(0, 14)}`]));
    d.innerHTML = `<button class="col-span-1 text-purple-400 text-center hover:text-emerald-300" title="Ir para a cena">▶${i + 1}</button><span class="col-span-5 truncate text-zinc-300" title="${s.text.replace(/"/g, '')}">${s.text}</span>
      <select data-k="layout" class="col-span-2 ${sel}">${opts(LAYOUT_NAMES, LN, o.layout, !o.layout && sg?.layout)}</select>
      <select data-k="trans" class="col-span-2 ${sel}">${opts(TRANS_NAMES, TNm, o.trans, !o.trans && sg?.trans)}</select>
      <select data-k="img" class="col-span-2 ${sel}">${opts(Object.keys(imgs), imgs, o.img ? String(assets.indexOf(o.img)) : '', '')}</select>`;
    d.querySelector('button').onclick = () => pl.seek(Math.max(0, s.start - .3));
    d.querySelectorAll('select').forEach(x => x.onchange = () => { ov[i] = { ...ov[i], [x.dataset.k]: x.value === '' ? undefined : x.dataset.k === 'img' ? assets[x.value] : x.value };  live(2); });
    return d;
  }));
}
