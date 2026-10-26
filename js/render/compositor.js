import { Application, Container, Sprite, Texture, CanvasSource } from 'pixi.js';
import { RGBSplitFilter, GlitchFilter, CRTFilter } from 'pixi-filters';
import { build, prepare, refreshTex, W, H, T, cl, ease } from './layouts.js';
import { Input, BlobSource, ALL_FORMATS, CanvasSink } from 'mediabunny';
import { STYLES } from '../core/styles.js';
import { drawCaptions, drawWatermark } from './captions.js';
import { drawCards } from './cards.js';
import { drawIntro, drawOutro, drawKinetic, drawChapter } from './titles.js';

const K = 1.5; // render interno 1920x1080

// tempo dentro do vídeo (com loop se o trecho for maior que o vídeo)
const vt = (s, t) => { const d = s.vid.dur || 1e9, x = (s.vin || 0) + Math.max(0, t - s.a); return x < d - .05 ? x : x % Math.max(.5, d - .05); };

// exact = exportação: cada segmento de vídeo tem seu canvas e é decodificado quadro a quadro (Mediabunny)
export async function createCompositor(canvas, bgCanvas, { exact = false, onNeedFrame } = {}) {
  const app = new Application();
  await app.init({ canvas, width: W, height: H, resolution: K, preference: 'webgl', preserveDrawingBuffer: true, autoStart: false, antialias: true, background: '#000' });
  const cap = Object.assign(document.createElement('canvas'), { width: W * K, height: H * K }), g = cap.getContext('2d');
  g.setTransform(K, 0, 0, K, 0, 0);
  const mk = c => new Texture({ source: new CanvasSource({ resource: c }) }), layer = new Container({ sortableChildren: true });
  let bgT = mk(bgCanvas), capT = mk(cap);
  const bgS = new Sprite(bgT), capS = new Sprite(capT);
  bgS.setSize(W, H); capS.setSize(W, H);
  app.stage.addChild(bgS, layer, capS);
  const rgb = new RGBSplitFilter(), gl = new GlitchFilter({ slices: 8, fillMode: 2 }), crt = new CRTFilter({ lineWidth: 1.2, lineContrast: .18, noise: .08, noiseSize: 1, vignetting: .32, vignettingAlpha: .8, curvature: 0 });
  app.stage.filters = [gl, rgb, crt];
  let segs = [], live = new Map();
  const VX = new Map(), act = (s, t) => t >= s.a - .05 && t < s.b + T + .05;
  async function exactFrame(s, t) {
    let x = VX.get(s);
    if (!x) { const inp = new Input({ source: new BlobSource(s.vid.blob), formats: ALL_FORMATS }), tr = await inp.getPrimaryVideoTrack(); x = { sink: new CanvasSink(tr, { width: s.img.width, height: s.img.height, fit: 'cover', poolSize: 3 }) }; VX.set(s, x); }
    const lt = vt(s, t);
    if (!x.it || lt < x.t0 - .01) { x.it = x.sink.canvases(lt); x.cur = x.nx = null; }
    x.t0 = lt; x.nx ??= (await x.it.next()).value;
    while (x.nx && x.nx.timestamp <= lt + 1e-3) { x.cur = x.nx; x.nx = (await x.it.next()).value; }
    const c = (x.cur || x.nx)?.canvas; if (c) { s.img.getContext('2d').drawImage(c, 0, 0, s.img.width, s.img.height); refreshTex(s.img); }
  }
  // prévia: o <video> toca junto com o player (corrige deriva) e o quadro é copiado para o canvas
  const playingEls = new Set();
  function liveFrame(s, t, playing) {
    const el = s.vid.el, lt = vt(s, t);
    if (playing) { if (el.paused) el.play().catch(() => { }); if (Math.abs(el.currentTime - lt) > .3) el.currentTime = lt; playingEls.add(el); }
    else { if (!el.paused) el.pause(); if (Math.abs(el.currentTime - lt) > .04 && !el.seeking) { el.currentTime = lt; el.onseeked = () => onNeedFrame?.(); } }
    if (el.readyState >= 2) { s.img.getContext('2d').drawImage(el, 0, 0, s.img.width, s.img.height); refreshTex(s.img); }
  }

  return {
    destroy() { app.destroy({ removeView: true }, { children: true }); },
    load(s) {
      live.forEach(x => x.c.destroy({ children: true })); live = new Map(); VX.clear();
      // exportação: canvas próprio por segmento de vídeo (não disputa com a prévia)
      segs = exact ? s.map(x => x.vid ? { ...x, img: Object.assign(document.createElement('canvas'), { width: x.img.width, height: x.img.height }) } : x) : s; prepare(segs);
    },
    async prefetch(t) { for (const s of segs) if (s.vid && act(s, t)) await exactFrame(s, t).catch(e => console.warn('quadro de vídeo', e)); },
    render(t, { caps = [], timeline = [], style = 0, dir = {}, tx = {}, playing = false } = {}) {
      bgT.source.update();
      if (!exact) { const on = new Set(); segs.forEach(s => s.vid && act(s, t) && (on.add(s.vid.el), liveFrame(s, t, playing))); playingEls.forEach(el => on.has(el) || (el.pause(), playingEls.delete(el))); }
      // segmentos ativos (o anterior fica por baixo durante a transição)
      segs.forEach((s, i) => {
        const nx = segs[i + 1], glued = nx && Math.abs(nx.a - s.b) < .01, end = glued ? s.b + T : s.b;
        const on = t >= s.a && t < end;
        let x = live.get(s);
        if (on && !x) { x = build(s); x.c.zIndex = i; live.set(s, x); layer.addChild(x.c); }
        if (x) { x.c.visible = on; if (on) x.update(t, glued ? 1 : ease((s.b - t) / .5)); else if (t > end + 1) { x.c.destroy({ children: true }); live.delete(s); } }
      });
      // pulso de glitch na troca de cena
      const sc = timeline.findLast(s => t >= s.start - .05), k = sc ? 1 - cl((t - sc.start + .05) / .35) : 0;
      gl.enabled = rgb.enabled = k > 0;
      if (k > 0) { gl.offset = 40 * k; gl.seed = (t * 7.7) % 1; gl.refresh(); rgb.red = { x: -10 * k, y: 0 }; rgb.blue = { x: 10 * k, y: 0 }; }
      const ck = STYLES[style]?.crt ?? 1; crt.enabled = ck > 0; crt.time = t * 10; crt.seed = (t * 3.1) % 1; crt.lineContrast = .15 * ck; crt.noise = .08 * Math.min(ck, 1); crt.vignetting = .32 * Math.min(ck, 1);
      // legendas + créditos
      g.clearRect(0, 0, W, H);
      const cs = segs.find(s => t >= s.a && t < s.b)?.credit;
      if (segs.some(s => t >= s.a && t < s.b + T)) { const gr = g.createLinearGradient(0, H * .55, 0, H); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.55)'); g.fillStyle = gr; g.fillRect(0, H * .55, W, H * .45); }
      if (cs) { g.font = '13px "Fira Code", monospace'; g.fillStyle = 'rgba(255,255,255,.5)'; const L = tx.wm?.type !== 'none' && tx.wm?.pos === 'br'; g.textAlign = L ? 'left' : 'right'; g.fillText(cs.slice(0, 80), L ? 18 : W - 18, H - 12); }
      const full = drawCards(g, t, dir.vt, timeline, tx);
      if (tx.cap && !full) { drawKinetic(g, t, dir.kin, segs, tx); drawCaptions(g, caps, t, W, H, tx); }
      drawChapter(g, t, dir.chapters, tx);
      drawIntro(g, t, dir.intro, tx); drawOutro(g, t, dir.outro, tx); drawWatermark(g, W, H, tx.wm);
      capT.source.update();
      app.renderer.render(app.stage);
    }
  };
}
