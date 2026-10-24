import { splitScenes, hash } from './core/script.js';
import { buildVoiceTrack } from './core/voicetrack.js';
import { VOICES } from './audio/fx.js';
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
import { direct, INTRO } from './core/direct.js';
import { LAYOUT_NAMES, TRANS_NAMES } from './render/layouts.js';
import { assets, addAsset, removeAsset, parseUrls, plan } from './core/assets.js';

const $ = id => document.getElementById(id);
const PRESET = `A realidade é apenas uma simulação em baixa resolução.
As máquinas continuam sonhando com circuitos em chamas.
O tempo dobrou sobre si mesmo no limiar do abismo.
Esquecemos o som da chuva antes da entropia final.
Sua consciência foi transcrita com sucesso no servidor do nada.`;

const el = { txt: $('script-input'), voice: $('voice-select'), style: $('style-select'), pitch: $('voice-pitch'), rate: $('voice-rate') };
const cv = $('view-canvas'), bg = createBg(), comp = await createCompositor(cv, bg.canvas);
const frame = (t, o) => { bg.draw(); comp.render(t, o); };
const EXP = ['btn-export', 'btn-wav', 'btn-srt', 'btn-mp4'];
let ctx, rec, chunks = [], track, caps = [], segsCur = [], mix, music = null, busy = false, P = [], dir = {}, variation = 0, ov = [];

const status = (t, c = 'bg-zinc-600') => { $('status-text').textContent = t; $('status-indicator').className = `w-2 h-2 rounded-full ${c}`; };
const count = () => $('char-count').textContent = `${el.txt.value.length} caracteres`;
const enable = (b, on) => { b.disabled = !on; b.classList.toggle('opacity-40', !on); b.classList.toggle('cursor-not-allowed', !on); };
const download = (blob, name) => { const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name }); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1e3); };

el.voice.innerHTML = Object.entries(VOICES).map(([k, v]) => `<option value="${k}">${v.n}</option>`).join('');
el.txt.value = PRESET; count();
el.txt.oninput = count;
$('btn-preset').onclick = () => { el.txt.value = PRESET; count(); };
for (const k of ['pitch', 'rate']) el[k].oninput = () => $(`${k}-val`).textContent = el[k].value;
frame(0);
loadTTS().then(() => status('MOTOR DE VOZ PRONTO', 'bg-emerald-500')).catch(e => status('ERRO AO CARREGAR VOZ', 'bg-red-500'));

async function makeTrack(scenes) {
  return buildVoiceTrack(scenes, {
    preset: el.voice.value, pitch: +el.pitch.value, speed: +el.rate.value, lead: scenes.length > 1 ? INTRO : .3,
    onProgress: (i, n) => status(`SINTETIZANDO VOZ ${i + 1}/${n}`, 'bg-yellow-400 animate-pulse')
  });
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
  busy = true; ['btn-manifest', 'btn-vary', 'btn-apply', ...EXP].forEach(b => enable($(b), false));
  try { await fn(); } catch (e) { console.error(e); status('ERRO: ' + e.message, 'bg-red-500'); }
  busy = false; enable($('btn-manifest'), true);
  if (mix) ['btn-vary', 'btn-apply', 'btn-wav', 'btn-srt', 'btn-mp4'].forEach(b => enable($(b), true));
  enable($('btn-export'), chunks.length > 0);
}

// edição -> mix -> reprodução/gravação
async function render() {
  dir = direct(track.timeline, P, { variation, ov, title: $('video-title').value.trim(), credits: ['Música: ' + (music?.name || 'procedural S.Y.N.A.P.S.E')] });
  comp.load(segsCur = dir.segs);
  status('MIXANDO ÁUDIO...', 'bg-yellow-400 animate-pulse');
  mix = await mixdown({ voice: track.buffer, timeline: track.timeline, segs: segsCur, duration: dir.duration, style: el.style.selectedIndex, seed: hash(el.txt.value) + variation,
    musicBuf: music?.buf, amb: $('amb-select').value, vol: { voice: 1, music: v('vol-music') * .7, amb: v('vol-amb') * .6, sfx: v('vol-sfx') * .8 } });
  grid(P); editor();
  await play(track.timeline, mix.duration);
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
$('btn-apply').onclick = () => track && run(render);

function play(timeline, duration) {
  ctx ??= new AudioContext();
  ctx.resume();
  const dest = ctx.createMediaStreamDestination();
  const bus = new GainNode(ctx, { gain: .8 }), lim = new DynamicsCompressorNode(ctx, { threshold: -6, ratio: 20, attack: .002 }), outs = [bus];
  bus.connect(lim); lim.connect(ctx.destination); lim.connect(dest);
  const t0 = ctx.currentTime + .1, src = new AudioBufferSourceNode(ctx, { buffer: mix });
  outs.forEach(o => src.connect(o)); src.start(t0);

  const stream = new MediaStream([...cv.captureStream(60).getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const mime = ['video/webm;codecs=vp9,opus', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m));
  rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8e6 }); chunks = [];
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  rec.start();

  status('TRANSMITINDO...', 'bg-emerald-400 animate-ping');
  let cur = -1;
  return new Promise(res => {
    const loop = () => {
      const t = ctx.currentTime - t0, i = drawAt(t);
      if (i !== cur && i >= 0) {
        cur = i; const h = hash(timeline[i].text);
        $('scene-counter').textContent = `${i + 1}/${timeline.length}`;
        $('scene-hash').textContent = `HASH: 0x${h.toString(16).slice(0, 6).toUpperCase()}`;
      }
      if (t < duration) return requestAnimationFrame(loop);
      rec.onstop = () => { enable($('btn-export'), true); res(); };
      rec.stop(); status('CONCLUÍDO', 'bg-purple-500');
    };
    loop();
  });
}

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

$('btn-export').onclick = () => chunks.length && download(new Blob(chunks, { type: 'video/webm' }), `SYNAPSE_${Date.now()}.webm`);
$('btn-wav').onclick = () => mix && download(toWav(mix), `SYNAPSE_AUDIO_${Date.now()}.wav`);
$('btn-srt').onclick = () => caps.length && download(new Blob([toSRT(caps)], { type: 'text/plain' }), `SYNAPSE_${Date.now()}.srt`);

// --- Ilustrações ---
function grid(P = []) {
  const sc = a => P.map((x, i) => x.includes(a) ? i + 1 : 0).filter(Boolean).join(',');
  $('img-grid').replaceChildren(...assets.map(a => {
    const d = document.createElement('div');
    d.className = 'relative aspect-video rounded overflow-hidden border border-zinc-700 group';
    d.title = [a.tag, a.credit].filter(Boolean).join(' · ');
    d.innerHTML = `<img src="${a.img.src}" class="w-full h-full object-cover"><span class="absolute bottom-0 left-0 text-[9px] bg-black/70 px-1 text-emerald-300">${sc(a) ? 'C' + sc(a) : a.origin === 'search' ? 'web' : ''}</span><button class="absolute top-0 right-0 hidden group-hover:block bg-red-600 text-white text-[10px] px-1">✕</button>`;
    d.querySelector('button').onclick = () => {
      removeAsset(a);
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
  e.target.value = ''; grid();
};
$('img-urls').onchange = () => syncUrls().then(() => status('IMAGENS PRONTAS', 'bg-emerald-500'));
// render determinístico por tempo (debug/export)
window.synapse = { comp, get segs() { return segsCur; }, frame: drawAt, get duration() { return mix?.duration || 0; } };

// --- Trilha sonora ---
$('amb-select').innerHTML = Object.entries(AMBS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
const setMusic = m => {
  music = m;
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
    d.innerHTML = `<span class="col-span-1 text-purple-400 text-center">${i + 1}</span><span class="col-span-5 truncate text-zinc-300" title="${s.text.replace(/"/g, '')}">${s.text}</span>
      <select data-k="layout" class="col-span-2 ${sel}">${opts(LAYOUT_NAMES, LN, o.layout, !o.layout && sg?.layout)}</select>
      <select data-k="trans" class="col-span-2 ${sel}">${opts(TRANS_NAMES, TNm, o.trans, !o.trans && sg?.trans)}</select>
      <select data-k="img" class="col-span-2 ${sel}">${opts(Object.keys(imgs), imgs, o.img ? String(assets.indexOf(o.img)) : '', '')}</select>`;
    d.querySelectorAll('select').forEach(x => x.onchange = () => { ov[i] = { ...ov[i], [x.dataset.k]: x.value === '' ? undefined : x.dataset.k === 'img' ? assets[x.value] : x.value }; });
    return d;
  }));
}
