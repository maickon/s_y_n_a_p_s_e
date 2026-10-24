import { splitScenes, hash } from './core/script.js';
import { buildVoiceTrack } from './core/voicetrack.js';
import { VOICES } from './audio/fx.js';
import { toWav } from './audio/wav.js';
import { drone, glitch } from './audio/ambient.js';
import { createBg } from './render/bg.js';
import { loadTTS } from './tts/mespeak.js';

const $ = id => document.getElementById(id);
const PRESET = `A realidade é apenas uma simulação em baixa resolução.
As máquinas continuam sonhando com circuitos em chamas.
O tempo dobrou sobre si mesmo no limiar do abismo.
Esquecemos o som da chuva antes da entropia final.
Sua consciência foi transcrita com sucesso no servidor do nada.`;

const el = { txt: $('script-input'), voice: $('voice-select'), style: $('style-select'), pitch: $('voice-pitch'), rate: $('voice-rate'), sub: $('subtitle-box'), subT: $('subtitle-text') };
const bg = createBg($('view-canvas'));
let ctx, rec, chunks = [], track, busy = false;

const status = (t, c = 'bg-zinc-600') => { $('status-text').textContent = t; $('status-indicator').className = `w-2 h-2 rounded-full ${c}`; };
const count = () => $('char-count').textContent = `${el.txt.value.length} caracteres`;
const enable = (b, on) => { b.disabled = !on; b.classList.toggle('opacity-40', !on); b.classList.toggle('cursor-not-allowed', !on); };
const download = (blob, name) => { const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name }); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1e3); };

el.voice.innerHTML = Object.entries(VOICES).map(([k, v]) => `<option value="${k}">${v.n}</option>`).join('');
el.txt.value = PRESET; count();
el.txt.oninput = count;
$('btn-preset').onclick = () => { el.txt.value = PRESET; count(); };
for (const k of ['pitch', 'rate']) el[k].oninput = () => $(`${k}-val`).textContent = el[k].value;
bg.draw();
loadTTS().then(() => status('MOTOR DE VOZ PRONTO', 'bg-emerald-500')).catch(e => status('ERRO AO CARREGAR VOZ', 'bg-red-500'));

async function makeTrack(scenes) {
  return buildVoiceTrack(scenes, {
    preset: el.voice.value, pitch: +el.pitch.value, speed: +el.rate.value,
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

$('btn-manifest').onclick = async () => {
  if (busy) return;
  const scenes = splitScenes(el.txt.value);
  if (!scenes.length) return alert('Digite um roteiro válido.');
  busy = true; enable($('btn-manifest'), false); enable($('btn-export'), false); enable($('btn-wav'), false);
  try {
    track = await makeTrack(scenes);
    await play(track);
  } catch (e) { console.error(e); status('ERRO: ' + e.message, 'bg-red-500'); }
  busy = false; enable($('btn-manifest'), true);
};

function play({ buffer, timeline, duration }) {
  ctx ??= new AudioContext();
  ctx.resume();
  const dest = ctx.createMediaStreamDestination(), style = el.style.selectedIndex;
  const bus = new GainNode(ctx, { gain: .8 }), lim = new DynamicsCompressorNode(ctx, { threshold: -6, ratio: 20, attack: .002 }), outs = [bus];
  bus.connect(lim); lim.connect(ctx.destination); lim.connect(dest);
  const t0 = ctx.currentTime + .1, src = new AudioBufferSourceNode(ctx, { buffer });
  outs.forEach(o => src.connect(o)); src.start(t0);
  const stop = drone(ctx, outs, style, t0);
  timeline.forEach(s => glitch(ctx, outs, t0 + s.start - .05));

  const stream = new MediaStream([...$('view-canvas').captureStream(60).getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const mime = ['video/webm;codecs=vp9,opus', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m));
  rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8e6 }); chunks = [];
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  rec.start();

  el.sub.classList.remove('hidden'); bg.u.style.value = style;
  status('TRANSMITINDO...', 'bg-emerald-400 animate-ping');
  let cur = -1;
  return new Promise(res => {
    const loop = () => {
      const t = ctx.currentTime - t0, i = timeline.findLastIndex(s => t >= s.start - .05);
      if (i !== cur && i >= 0) {
        cur = i; const h = hash(timeline[i].text);
        el.subT.textContent = timeline[i].text;
        $('scene-counter').textContent = `${i + 1}/${timeline.length}`;
        $('scene-hash').textContent = `HASH: 0x${h.toString(16).slice(0, 6).toUpperCase()}`;
        bg.u.seed.value = h % 100;
      }
      const dt = cur >= 0 ? t - timeline[cur].start : 9;
      bg.u.glitch.value = Math.max(0, 1 - dt / .3);
      bg.u.t.value = t * 1.8; bg.draw();
      if (t < duration + .3) return requestAnimationFrame(loop);
      stop(); rec.onstop = () => { enable($('btn-export'), true); enable($('btn-wav'), true); res(); };
      rec.stop(); el.subT.textContent = '[TRANSMISSÃO FINALIZADA]'; status('CONCLUÍDO', 'bg-purple-500');
    };
    loop();
  });
}

$('btn-export').onclick = () => chunks.length && download(new Blob(chunks, { type: 'video/webm' }), `SYNAPSE_${Date.now()}.webm`);
$('btn-wav').onclick = () => track && download(toWav(track.buffer), `SYNAPSE_VOZ_${Date.now()}.wav`);
