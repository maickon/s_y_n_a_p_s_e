import { Container, Sprite, Texture, Graphics } from 'pixi.js';
import { GlitchFilter, RGBSplitFilter, ZoomBlurFilter, PixelateFilter, DropShadowFilter } from 'pixi-filters';

export const W = 1280, H = 720, T = .7; // T = duração da transição
export const cl = x => Math.min(1, Math.max(0, x)), ease = x => 1 - (1 - cl(x)) ** 3, io = x => (x = cl(x), x < .5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
export const rng = s => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;

const tc = new WeakMap(), bc = new WeakMap();
const tex = im => tc.get(im) ?? (tc.set(im, Texture.from(im)), tc.get(im));
// fundo desfocado pré-renderizado (barato)
const blurTex = im => {
  if (!bc.has(im)) {
    const c = Object.assign(document.createElement('canvas'), { width: 384, height: 216 }), g = c.getContext('2d'), k = Math.max(384 / im.width, 216 / im.height);
    g.filter = 'blur(10px) brightness(.55) saturate(1.3)';
    g.drawImage(im, (384 - im.width * k) / 2, (216 - im.height * k) / 2, im.width * k, im.height * k);
    bc.set(im, Texture.from(c));
  }
  return bc.get(im);
};
const spr = (t, c) => { const s = new Sprite(t); s.anchor.set(.5); c.addChild(s); return s; };
const cover = (s, w = W, h = H) => Math.max(w / s.texture.width, h / s.texture.height);
const blurBg = (im, c) => { const s = spr(blurTex(im), c); s.position.set(W / 2, H / 2); s.scale.set(cover(s) * 1.1); return s; };

// cada layout monta o container e devolve update(p, r) com p = progresso 0..1
const LAYOUTS = {
  full(c, im) {
    const s = spr(tex(im), c);
    return (p, r) => { s.scale.set(cover(s) * (r.zin ? 1.04 + .14 * p : 1.18 - .14 * p)); s.position.set(W / 2 + r.dx * 50 * (p - .5), H / 2 + r.dy * 25 * (p - .5)); };
  },
  frame(c, im) {
    const bg = blurBg(im, c), card = new Container(), s = spr(tex(im), card), k = Math.min(W * .72 / s.texture.width, H * .74 / s.texture.height);
    s.scale.set(k);
    const w = s.texture.width * k, h = s.texture.height * k;
    card.addChildAt(new Graphics().rect(-w / 2 - 8, -h / 2 - 8, w + 16, h + 16).fill({ color: 0xffffff, alpha: .92 }), 0);
    card.filters = [new DropShadowFilter({ offset: { x: 0, y: 14 }, blur: 12, alpha: .6 })];
    c.addChild(card);
    return (p, r) => { card.position.set(W / 2 + r.dx * 30 * (p - .5), H / 2 - 10); card.rotation = r.rot * .035 * (1 - p * 2); card.scale.set(1 + .06 * p); bg.x = W / 2 - r.dx * 20 * p; };
  },
  split(c, im, r) {
    const L = r.side, w = W * .56, x0 = L ? 0 : W - w, s = spr(tex(im), c);
    const m = new Graphics().rect(x0, 0, w, H).fill(0xffffff); c.addChild(m); s.mask = m;
    const edge = new Graphics().rect(L ? w - 3 : x0, 0, 3, H).fill({ color: 0x00ff66, alpha: .9 }); c.addChild(edge);
    const shade = new Graphics().rect(L ? w : 0, 0, W - w, H).fill({ color: 0x000000, alpha: .35 }); c.addChildAt(shade, 0);
    return p => { s.scale.set(cover(s, w, H) * (1.05 + .1 * p)); s.position.set(x0 + w / 2 + (L ? -1 : 1) * 30 * p, H / 2); };
  },
  double(c, im) {
    const a = spr(tex(im), c), b = spr(tex(im), c);
    b.blendMode = 'screen'; b.alpha = .45; b.tint = 0xb066ff;
    return (p, r) => {
      a.scale.set(cover(a) * (1.08 + .08 * p)); a.position.set(W / 2 + r.dx * 30 * p, H / 2);
      b.scale.set(cover(b) * (1.5 - .15 * p)); b.position.set(W / 2 - r.dx * 120 * (p - .5), H / 2 + 40 * (p - .5));
    };
  },
  circle(c, im, r) {
    blurBg(im, c);
    const R = H * .36, cx = W / 2 + (r.side ? -1 : 1) * W * .18, s = spr(tex(im), c), m = new Graphics().circle(cx, H / 2, R).fill(0xffffff);
    c.addChild(m); s.mask = m;
    const ring = new Graphics().circle(0, 0, R + 10).stroke({ width: 3, color: 0x00ff66, alpha: .8 }).circle(0, 0, R + 22).stroke({ width: 1, color: 0x9d00ff, alpha: .7 });
    ring.position.set(cx, H / 2); c.addChild(ring);
    return p => { s.scale.set(cover(s, R * 2, R * 2) * (1.1 + .15 * p)); s.position.set(cx, H / 2); ring.scale.set(1 + .03 * Math.sin(p * 6)); };
  }
};

// transições de entrada: devolvem update(q) com q = 0..1
const TRANS = {
  fade: c => q => { c.alpha = io(q); },
  glitch: c => {
    const g = new GlitchFilter({ slices: 12, offset: 0, fillMode: 2 }), s = new RGBSplitFilter();
    c.filters = [...(c.filters || []), g, s];
    return q => { const k = 1 - ease(q); c.alpha = q < .08 ? 0 : 1; g.offset = 90 * k; g.seed = (q * 13.37) % 1; g.refresh(); s.red = { x: -18 * k, y: 0 }; s.blue = { x: 18 * k, y: 4 * k }; g.enabled = s.enabled = q < 1; };
  },
  zoom: c => {
    const z = new ZoomBlurFilter({ strength: .4, center: { x: W / 2, y: H / 2 }, innerRadius: 40 });
    c.filters = [...(c.filters || []), z];
    return q => { z.strength = .45 * (1 - ease(q)); z.enabled = q < 1; c.alpha = ease(q * 1.6); c.scale.set(1.3 - .3 * ease(q)); };
  },
  pixel: c => {
    const f = new PixelateFilter(40);
    c.filters = [...(c.filters || []), f];
    return q => { f.size = Math.max(1, Math.round(48 * (1 - ease(q)))); f.enabled = q < 1; c.alpha = ease(q * 2.5); };
  },
  wipe: (c, r, o) => {
    const m = new Graphics(); o.addChild(m); c.mask = m;
    return q => { const w = (W + 200) * io(q); m.clear().poly(r.side ? [W, 0, W - w, 0, W - w - 200, H, W, H] : [0, 0, w + 200, 0, w, H, 0, H]).fill(0xffffff); };
  },
  slide: (c, r) => q => { c.x = W / 2 + (r.side ? 1 : -1) * W * (1 - io(q)); }
};

const LW = { full: 3, frame: 2, split: 2, double: 1, circle: 1 }, TN = Object.keys(TRANS);
const pick = (r, w) => { let x = r() * Object.values(w).reduce((a, b) => a + b); for (const [k, v] of Object.entries(w)) if ((x -= v) < 0) return k; };

// escolhe layout/transição sem repetir o anterior
export function prepare(segs) {
  segs.forEach((s, i) => {
    if (s.layout) return;
    const r = rng(s.seed + 1), pv = segs[i - 1];
    let L = pick(r, LW), t = TN[r() * TN.length | 0];
    if (pv && L === pv.layout) L = pick(r, { ...LW, [L]: 0 });
    if (pv && t === pv.trans) t = TN[(TN.indexOf(t) + 1) % TN.length];
    Object.assign(s, { layout: L, trans: t, r: { zin: r() > .5, dx: r() > .5 ? 1 : -1, dy: r() > .5 ? 1 : -1, rot: r() > .5 ? 1 : -1, side: r() > .5 } });
  });
}

export function build(s) {
  const o = new Container(), c = new Container();
  c.pivot.set(W / 2, H / 2); c.position.set(W / 2, H / 2); o.addChild(c);
  const up = LAYOUTS[s.layout](c, s.img, s.r), tr = TRANS[s.trans](c, s.r, o);
  return { c: o, update(t, out) { const p = cl((t - s.a) / (s.b - s.a + T)); up(p, s.r); tr(cl((t - s.a) / T)); o.alpha = out; } };
}
