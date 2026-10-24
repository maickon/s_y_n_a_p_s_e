import { Application, Container, Sprite, Texture, CanvasSource } from 'pixi.js';
import { RGBSplitFilter, GlitchFilter, CRTFilter } from 'pixi-filters';
import { build, prepare, W, H, T, cl, ease } from './layouts.js';
import { STYLES } from '../core/styles.js';
import { drawCaptions, drawWatermark } from './captions.js';
import { drawIntro, drawOutro, drawKinetic } from './titles.js';

const K = 1.5; // render interno 1920x1080

export async function createCompositor(canvas, bgCanvas) {
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

  return {
    load(s) { live.forEach(x => x.c.destroy({ children: true })); live = new Map(); segs = s; prepare(segs); },
    render(t, { caps = [], timeline = [], style = 0, dir = {}, tx = {} } = {}) {
      bgT.source.update();
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
      if (tx.cap) { drawKinetic(g, t, dir.kin, segs, tx); drawCaptions(g, caps, t, W, H, tx); }
      drawIntro(g, t, dir.intro, tx); drawOutro(g, t, dir.outro, tx); drawWatermark(g, W, H, tx.wm);
      capT.source.update();
      app.renderer.render(app.stage);
    }
  };
}
