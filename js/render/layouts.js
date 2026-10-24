import { Container, Sprite, Texture, Graphics, BlurFilter, ColorMatrixFilter, DisplacementFilter } from 'pixi.js';
import { rng } from '../core/script.js';
import { GlitchFilter, RGBSplitFilter, ZoomBlurFilter, PixelateFilter, DropShadowFilter, OldFilmFilter, AdvancedBloomFilter, DotFilter, TiltShiftFilter, MotionBlurFilter } from 'pixi-filters';

// dimensões lógicas (render interno = ×1.5); mudam com o formato do vídeo
export let W = 1280, H = 720;
export const T = .7; // duração da transição
export const ASPECTS = { '16:9': [1280, 720], '9:16': [720, 1280], '1:1': [720, 720] };
export const setAspect = a => [W, H] = ASPECTS[a] || ASPECTS['16:9'];
const tall = () => H > W;
export const cl = x => Math.min(1, Math.max(0, x)), ease = x => 1 - (1 - cl(x)) ** 3, io = x => (x = cl(x), x < .5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);

// ---------- texturas ----------
const tc = new WeakMap(), bc = new WeakMap(), gc = {};
const tex = im => tc.get(im) ?? (tc.set(im, Texture.from(im)), tc.get(im));
const canvasTex = (w, h, draw) => { const c = Object.assign(document.createElement('canvas'), { width: w, height: h }); draw(c.getContext('2d'), w, h); return Texture.from(c); };
const blurTex = im => bc.get(im) ?? (bc.set(im, canvasTex(384, 216, (g, w, h) => { const k = Math.max(w / im.width, h / im.height); g.filter = 'blur(10px) brightness(.55) saturate(1.3)'; g.drawImage(im, (w - im.width * k) / 2, (h - im.height * k) / 2, im.width * k, im.height * k); })), bc.get(im));
const radial = (stops, key) => gc[key] ??= canvasTex(512, 512, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); stops.forEach(([o, c]) => r.addColorStop(o, c)); g.fillStyle = r; g.fillRect(0, 0, w, w); });
const linear = (stops, key) => gc[key] ??= canvasTex(512, 64, (g, w, h) => { const r = g.createLinearGradient(0, 0, w, 0); stops.forEach(([o, c]) => r.addColorStop(o, c)); g.fillStyle = r; g.fillRect(0, 0, w, h); });
const noiseTex = () => gc.noise ??= canvasTex(256, 256, (g, w, h) => { const d = g.createImageData(w, h); for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data.set([v, v, v, 255], i); } g.putImageData(d, 0, 0); });
const vign = () => radial([[0, 'rgba(0,0,0,0)'], [.55, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.92)']], 'vign');

// ---------- helpers ----------
const spr = (t, c) => { const s = new Sprite(t); s.anchor.set(.5); c.addChild(s); return s; };
const cover = (s, w = W, h = H) => Math.max(w / s.texture.width, h / s.texture.height);
const contain = (s, w, h) => Math.min(w / s.texture.width, h / s.texture.height);
const blurBg = (im, c) => { const s = spr(blurTex(im), c); s.position.set(W / 2, H / 2); s.scale.set(cover(s) * 1.1); return s; };
const rect = (c, x, y, w, h, color = 0xffffff, a = 1) => { const g = new Graphics().rect(x, y, w, h).fill({ color, alpha: a }); c.addChild(g); return g; };
const masked = (c, im, shape) => { const s = spr(tex(im), c), m = shape(new Graphics()).fill(0xffffff); c.addChild(m); s.mask = m; return s; };
const shadow = (o = 14) => new DropShadowFilter({ offset: { x: 0, y: o }, blur: 12, alpha: .6 });
const card = (c, im, w, h, border = 8, bottom = border, color = 0xffffff) => {
  const k = new Container(), s = spr(tex(im), k), z = contain(s, w, h);
  s.scale.set(z);
  const sw = s.texture.width * z, sh = s.texture.height * z;
  k.addChildAt(new Graphics().rect(-sw / 2 - border, -sh / 2 - border, sw + border * 2, sh + border + bottom).fill(color), 0);
  s.y = 0; k.filters = [shadow()]; c.addChild(k);
  return k;
};

// cada layout monta o container e devolve update(p) com p = progresso 0..1 do segmento
const LAYOUTS = {
  full(c, s, r) { const a = spr(tex(s.img), c); return p => { a.scale.set(cover(a) * (r.zin ? 1.04 + .14 * p : 1.18 - .14 * p)); a.position.set(W / 2 + r.dx * 50 * (p - .5), H / 2 + r.dy * 25 * (p - .5)); }; },
  push(c, s) { const a = spr(tex(s.img), c); a.position.set(W / 2, H / 2); return p => a.scale.set(cover(a) * (1 + .22 * io(p))); },
  pan(c, s, r) { const a = spr(tex(s.img), c); a.scale.set(cover(a) * 1.35); const m = (a.width - W) / 2; return p => a.position.set(W / 2 + r.dx * m * (1 - 2 * p), H / 2); },
  tilt(c, s, r) { const a = spr(tex(s.img), c); a.scale.set(cover(a) * 1.35); const m = (a.height - H) / 2; return p => a.position.set(W / 2, H / 2 + r.dy * m * (1 - 2 * p)); },
  rotate(c, s, r) { const a = spr(tex(s.img), c); a.position.set(W / 2, H / 2); return p => { a.scale.set(cover(a) * (1.28 + .08 * p)); a.rotation = r.rot * (.035 - .07 * p); }; },
  focus(c, s) { const a = spr(tex(s.img), c), b = new BlurFilter({ strength: 14 }); a.filters = [b]; a.position.set(W / 2, H / 2); return p => { b.strength = 14 * (1 - ease(p * 3)); b.enabled = b.strength > .2; a.scale.set(cover(a) * (1.12 - .06 * p)); }; },
  zoomout(c, s, r) { const a = spr(tex(s.img), c); return p => { a.scale.set(cover(a) * (2.1 - 1.02 * ease(p * 1.4))); a.position.set(W / 2 + r.dx * 120 * (1 - ease(p * 1.4)), H / 2 + r.dy * 60 * (1 - ease(p * 1.4))); }; },
  letterbox(c, s, r) { const a = spr(tex(s.img), c); rect(c, 0, 0, W, H * .12, 0); rect(c, 0, H * .88, W, H * .12, 0); return p => { a.scale.set(cover(a) * (1.06 + .1 * p)); a.position.set(W / 2 + r.dx * 40 * (p - .5), H / 2); }; },
  vignette(c, s, r) { const a = spr(tex(s.img), c), v = spr(vign(), c); v.position.set(W / 2, H / 2); v.scale.set(W * 1.15 / 512, H * 1.25 / 512); return p => { a.scale.set(cover(a) * (1.05 + .12 * p)); a.position.set(W / 2 + r.dx * 30 * p, H / 2); }; },
  spotlight(c, s, r) {
    const a = spr(tex(s.img), c), l = spr(radial([[0, 'rgba(0,0,0,0)'], [.35, 'rgba(0,0,0,0)'], [.7, 'rgba(0,0,0,.85)'], [1, 'rgba(0,0,0,.92)']], 'spot'), c);
    a.position.set(W / 2, H / 2); l.scale.set(Math.max(W, H) * 2.6 / 512);
    return p => { a.scale.set(cover(a) * (1.08 + .06 * p)); l.position.set(W * (.5 + r.dx * .25 * Math.cos(p * Math.PI)), H * (.5 + .12 * Math.sin(p * 4))); };
  },
  frame(c, s, r) { const bg = blurBg(s.img, c), k = card(c, s.img, W * .72, H * .72, 8); return p => { k.position.set(W / 2 + r.dx * 30 * (p - .5), H / 2 - 10); k.rotation = r.rot * .035 * (1 - p * 2); k.scale.set(1 + .06 * p); bg.x = W / 2 - r.dx * 20 * p; }; },
  polaroid(c, s, r) { blurBg(s.img, c); const k = card(c, s.img, W * .42, H * .56, 14, 58, 0xf5f2ea); return p => { k.position.set(W / 2 + r.dx * (60 - 40 * p), H / 2 - 12); k.rotation = r.rot * (.07 - .03 * p); k.scale.set(1.02 + .05 * p); }; },
  archive(c, s, r) {
    spr(linear([[0, '#3b2f22'], [.5, '#5a4632'], [1, '#2a2118']], 'paper'), c).position.set(W / 2, H / 2); c.children[0].scale.set(W * 1.1 / 512, H * 1.2 / 64);
    const k = card(c, s.img, W * .6, H * .66, 16, 16, 0xe8dfc8);
    return p => { k.position.set(W / 2, H / 2); k.rotation = r.rot * (.025 + .01 * p); k.scale.set(.98 + .06 * p); };
  },
  parallax(c, s, r) { const bg = blurBg(s.img, c), k = card(c, s.img, W * .66, H * .66, 0); return p => { bg.x = W / 2 + r.dx * 60 * (.5 - p); k.position.set(W / 2 + r.dx * 50 * (p - .5), H / 2); k.scale.set(1 + .1 * p); }; },
  window(c, s, r) {
    blurBg(s.img, c);
    const T_ = tall(), w = T_ ? W * .86 : W * .52, h = T_ ? H * .5 : H * .7, x0 = T_ ? (W - w) / 2 : r.side ? W * .05 : W * .43, y0 = T_ ? (r.side ? H * .08 : H * .42) : (H - h) / 2;
    const a = masked(c, s.img, g => g.roundRect(x0, y0, w, h, 18));
    c.addChild(new Graphics().roundRect(x0, y0, w, h, 18).stroke({ width: 2, color: 0xffffff, alpha: .6 }));
    return p => { a.scale.set(cover(a, w, h) * (1.06 + .12 * p)); a.position.set(x0 + w / 2 + r.dx * 20 * p, y0 + h / 2); };
  },
  split(c, s, r) {
    const L = r.side;
    if (tall()) { // retrato: metade de cima/baixo
      const h = H * .56, y0 = L ? 0 : H - h;
      rect(c, 0, L ? h : 0, W, H - h, 0, .35);
      const a = masked(c, s.img, g => g.rect(0, y0, W, h)); rect(c, 0, L ? h - 3 : y0, W, 3, 0x00ff66, .9);
      return p => { a.scale.set(cover(a, W, h) * (1.05 + .1 * p)); a.position.set(W / 2, y0 + h / 2 + (L ? -1 : 1) * 30 * p); };
    }
    const w = W * .56, x0 = L ? 0 : W - w;
    rect(c, L ? w : 0, 0, W - w, H, 0, .35);
    const a = masked(c, s.img, g => g.rect(x0, 0, w, H)); rect(c, L ? w - 3 : x0, 0, 3, H, 0x00ff66, .9);
    return p => { a.scale.set(cover(a, w, H) * (1.05 + .1 * p)); a.position.set(x0 + w / 2 + (L ? -1 : 1) * 30 * p, H / 2); };
  },
  diptych(c, s, r) {
    const g = 6, T_ = tall(), w = T_ ? W : (W - g) / 2, h = T_ ? (H - g) / 2 : H, ox = T_ ? 0 : w + g, oy = T_ ? h + g : 0;
    const a = masked(c, s.img, m => m.rect(0, 0, w, h)), b = masked(c, s.alt || s.img, m => m.rect(ox, oy, w, h));
    if (!s.alt || s.alt === s.img) b.scale.x = -1;
    return p => { a.scale.set(cover(a, w, h) * (1.05 + .1 * p)); a.position.set(w / 2 + (T_ ? 20 * (p - .5) : 0), h / 2 + (T_ ? 0 : 20 * (p - .5))); const k = cover(b, w, h) * (1.15 - .1 * p); b.scale.set(b.scale.x < 0 ? -k : k, k); b.position.set(ox + w / 2, oy + h / 2); };
  },
  triptych(c, s) {
    const g = 6, T_ = tall(), w = T_ ? W : (W - 2 * g) / 3, h = T_ ? (H - 2 * g) / 3 : H, ss = [0, 1, 2].map(i => masked(c, s.img, m => m.rect(T_ ? 0 : i * (w + g), T_ ? i * (h + g) : 0, w, h)));
    return p => ss.forEach((a, i) => { const d = (i % 2 ? 1 : -1) * 30 * (p - .5); a.scale.set(cover(a) * (1.1 + .05 * i)); a.position.set(W / 2 + (T_ ? d : 0), H / 2 + (T_ ? 0 : d)); });
  },
  mosaic(c, s) {
    const g = 6, w = (W - g) / 2, h = (H - g) / 2, D = [[1, 1], [-1, 1], [1, -1], [-1, -1]];
    const ss = D.map(([dx, dy], i) => masked(c, s.img, m => m.rect((i % 2) * (w + g), (i >> 1) * (h + g), w, h)));
    return p => ss.forEach((a, i) => { const [dx, dy] = D[i]; a.scale.set(cover(a) * (1.3 + .1 * i % 2)); a.position.set(W / 2 + dx * 60 * p, H / 2 + dy * 30 * p); });
  },
  stack(c, s, r) {
    blurBg(s.img, c);
    const ks = [s.alt || s.img, s.alt || s.img, s.img].map((im, i) => card(c, im, W * .5, H * .58, 10));
    return p => ks.forEach((k, i) => { const o = (2 - i) * (1 - .5 * p); k.position.set(W / 2 + r.dx * o * 40, H / 2 - o * 12); k.rotation = r.rot * (i - 2) * .06 * (1 - .4 * p); k.scale.set(.95 + .05 * p); });
  },
  filmstrip(c, s, r) {
    rect(c, 0, 0, W, H, 0x050505); const bh = H * .62, y0 = (H - bh) / 2;
    const a = masked(c, s.img, g => g.rect(0, y0, W, bh)), holes = new Graphics();
    for (let x = -40; x < W + 80; x += 44) holes.rect(x, y0 - 34, 24, 18).rect(x, y0 + bh + 16, 24, 18);
    holes.fill({ color: 0xdddddd, alpha: .85 }); c.addChild(holes);
    return p => { a.scale.set(cover(a, W, bh) * 1.12); a.position.set(W / 2 + r.dx * 50 * (p - .5), H / 2); holes.x = -r.dx * (p * 44 * 3 % 44); };
  },
  tv(c, s) {
    rect(c, 0, 0, W, H, 0x0b0b0f); const w = W * .66, h = H * .7, x0 = (W - w) / 2, y0 = (H - h) / 2 - 10;
    c.addChild(new Graphics().roundRect(x0 - 26, y0 - 26, w + 52, h + 52, 40).fill(0x2a2a30).stroke({ width: 3, color: 0x55555f }));
    const a = masked(c, s.img, g => g.roundRect(x0, y0, w, h, 26));
    return p => { a.scale.set(cover(a, w, h) * (1.05 + .08 * p)); a.position.set(W / 2, y0 + h / 2); };
  },
  diagonal(c, s, r) {
    blurBg(s.img, c);
    const pts = tall() ? (r.side ? [0, H * .3, W, H * .45, W, H, 0, H] : [0, 0, W, 0, W, H * .55, 0, H * .7]) : r.side ? [W * .3, 0, W, 0, W, H, W * .55, H] : [0, 0, W * .7, 0, W * .45, H, 0, H];
    const a = masked(c, s.img, g => g.poly(pts));
    if (tall()) c.addChild(new Graphics().moveTo(0, r.side ? H * .3 : H * .7).lineTo(W, r.side ? H * .45 : H * .55).stroke({ width: 4, color: 0x00ff66, alpha: .8 }));
    else c.addChild(new Graphics().moveTo(r.side ? W * .3 : W * .7, 0).lineTo(r.side ? W * .55 : W * .45, H).stroke({ width: 4, color: 0x00ff66, alpha: .8 }));
    return p => { a.scale.set(cover(a) * (1.08 + .1 * p)); a.position.set(W / 2 + (tall() ? 0 : (r.side ? 1 : -1) * W * .18), H / 2 + (tall() ? (r.side ? 1 : -1) * H * .15 : 0)); };
  },
  circle(c, s, r) {
    blurBg(s.img, c);
    const R = Math.min(W, H) * .36, T_ = tall(), cx = T_ ? W / 2 : W / 2 + (r.side ? -1 : 1) * W * .18, cy = T_ ? H / 2 + (r.side ? -1 : 1) * H * .14 : H / 2, a = masked(c, s.img, g => g.circle(cx, cy, R));
    const ring = new Graphics().circle(0, 0, R + 10).stroke({ width: 3, color: 0x00ff66, alpha: .8 }).circle(0, 0, R + 22).stroke({ width: 1, color: 0x9d00ff, alpha: .7 });
    ring.position.set(cx, cy); c.addChild(ring);
    return p => { a.scale.set(cover(a, R * 2, R * 2) * (1.1 + .15 * p)); a.position.set(cx, cy); ring.scale.set(1 + .03 * Math.sin(p * 6)); };
  },
  strips(c, s, r) {
    const n = 8, h = H / n, a = spr(tex(s.img), c), m = new Graphics(); c.addChild(m); a.mask = m;
    return p => { m.clear(); for (let i = 0; i < n; i++) { const k = io((p * 6) - i * .08); m.rect(0, i * h + (1 - k) * h / 2, W, h * k); } m.fill(0xffffff); a.scale.set(cover(a) * (1.05 + .08 * p)); a.position.set(W / 2 + r.dx * 30 * p, H / 2); };
  },
  double(c, s, r) {
    const a = spr(tex(s.img), c), b = spr(tex(s.alt || s.img), c); b.blendMode = 'screen'; b.alpha = .45; b.tint = 0xb066ff;
    return p => { a.scale.set(cover(a) * (1.08 + .08 * p)); a.position.set(W / 2 + r.dx * 30 * p, H / 2); b.scale.set(cover(b) * (1.5 - .15 * p)); b.position.set(W / 2 - r.dx * 120 * (p - .5), H / 2 + 40 * (p - .5)); };
  }
};

// ---------- transições de entrada (update(q), q = 0..1) ----------
const add = (c, f) => (c.filters = [...(c.filters || []), f], f);
const overlay = (o, t, blend, w = W, h = H) => { const s = new Sprite(t); s.anchor.set(.5); s.position.set(W / 2, H / 2); s.width = w; s.height = h; s.blendMode = blend; o.addChild(s); return s; };
const TRANS = {
  fade: c => q => { c.alpha = io(q); },
  dissolve: c => q => { c.alpha = q; },
  dipblack: (c, r, o) => { const b = rect(o, 0, 0, W, H, 0); o.setChildIndex(b, 0); return q => { b.alpha = Math.min(1, q * 2); c.alpha = cl(q * 2 - 1); b.visible = q < 1; }; },
  dipwhite: (c, r, o) => { const b = rect(o, 0, 0, W, H, 0xffffff); return q => { b.alpha = q < .4 ? q / .4 : 1 - (q - .4) / .6; c.alpha = cl(q * 2.5 - .9); b.visible = q < 1; }; },
  flash: (c, r, o) => { const b = overlay(o, radial([[0, '#fff'], [.6, 'rgba(255,255,255,.7)'], [1, 'rgba(255,255,255,0)']], 'flash'), 'add', W * 1.6, W * 1.6); return q => { b.alpha = q < .15 ? q / .15 : 1 - ease((q - .15) / .5); c.alpha = cl(q * 6); b.visible = q < 1; }; },
  lightleak: (c, r, o) => { const b = overlay(o, linear([[0, 'rgba(255,120,0,0)'], [.35, 'rgba(255,90,20,.9)'], [.55, 'rgba(255,210,120,1)'], [.75, 'rgba(255,40,80,.8)'], [1, 'rgba(255,0,60,0)']], 'leak'), 'add', W * 1.4, H * 1.3); return q => { b.x = W / 2 + (r.side ? 1 : -1) * W * (1.1 - 2.2 * io(q)); b.alpha = Math.sin(Math.PI * q); c.alpha = io(q * 1.3); b.visible = q < 1; }; },
  burn: (c, r, o) => { const b = overlay(o, radial([[0, '#fffbe6'], [.3, '#ffb347'], [.6, 'rgba(200,60,0,.8)'], [1, 'rgba(120,20,0,0)']], 'burn'), 'add'); return q => { const k = .2 + 3 * ease(q); b.scale.set(k * W / 512); b.alpha = q < .45 ? 1 : 1 - (q - .45) / .55; c.alpha = cl(q * 2 - .3); b.visible = q < 1; }; },
  blur: c => { const f = add(c, new BlurFilter({ strength: 30 })); return q => { f.strength = 30 * (1 - ease(q)); f.enabled = q < 1; c.alpha = io(q); }; },
  zoom: c => { const z = add(c, new ZoomBlurFilter({ strength: .4, center: { x: W / 2, y: H / 2 }, innerRadius: 40 })); return q => { z.strength = .45 * (1 - ease(q)); z.enabled = q < 1; c.alpha = ease(q * 1.6); c.scale.set(1.3 - .3 * ease(q)); }; },
  whip: (c, r) => { const f = add(c, new MotionBlurFilter({ velocity: { x: 0, y: 0 }, kernelSize: 15 })); return q => { const k = 1 - ease(q * 1.3); c.x = W / 2 + (r.side ? 1 : -1) * W * k; f.velocity = { x: (r.side ? -1 : 1) * 90 * k, y: 0 }; f.enabled = k > .01; }; },
  push: (c, r) => q => { c.y = H / 2 + (r.dy > 0 ? 1 : -1) * H * (1 - io(q)); },
  slide: (c, r) => q => { c.x = W / 2 + (r.side ? 1 : -1) * W * (1 - io(q)); },
  wipe: (c, r, o) => { const m = new Graphics(); o.addChild(m); c.mask = m; return q => { const w = (W + 200) * io(q); m.clear().poly(r.side ? [W, 0, W - w, 0, W - w - 200, H, W, H] : [0, 0, w + 200, 0, w, H, 0, H]).fill(0xffffff); }; },
  iris: (c, r, o) => { const m = new Graphics(); o.addChild(m); c.mask = m; return q => m.clear().circle(W / 2, H / 2, Math.hypot(W, H) / 2 * io(q) + 1).fill(0xffffff); },
  barn: (c, r, o) => { const m = new Graphics(); o.addChild(m); c.mask = m; return q => m.clear().rect(W / 2 * (1 - io(q)), 0, W * io(q) + 1, H).fill(0xffffff); },
  blinds: (c, r, o) => { const m = new Graphics(); o.addChild(m); c.mask = m; return q => { m.clear(); for (let i = 0; i < 10; i++) m.rect(0, i * H / 10, W, H / 10 * io(q * 1.3 - i * .03) + .5); m.fill(0xffffff); }; },
  glitch: c => { const g = add(c, new GlitchFilter({ slices: 12, offset: 0, fillMode: 2 })), s = add(c, new RGBSplitFilter()); return q => { const k = 1 - ease(q); c.alpha = q < .08 ? 0 : 1; g.offset = 90 * k; g.seed = (q * 13.37) % 1; g.refresh(); s.red = { x: -18 * k, y: 0 }; s.blue = { x: 18 * k, y: 4 * k }; g.enabled = s.enabled = q < 1; }; },
  rgb: c => { const s = add(c, new RGBSplitFilter()); return q => { const k = 1 - ease(q); s.red = { x: -45 * k, y: 6 * k }; s.blue = { x: 45 * k, y: -6 * k }; s.enabled = q < 1; c.alpha = ease(q * 3); }; },
  pixel: c => { const f = add(c, new PixelateFilter(40)); return q => { f.size = Math.max(1, Math.round(48 * (1 - ease(q)))); f.enabled = q < 1; c.alpha = ease(q * 2.5); }; },
  warp: c => { const n = new Sprite(noiseTex()); n.texture.source.addressMode = 'repeat'; n.scale.set(4); c.parent?.addChild?.(n); const f = add(c, new DisplacementFilter({ sprite: n, scale: 120 })); return q => { f.scale.x = f.scale.y = 160 * (1 - ease(q)); f.enabled = q < 1; c.alpha = io(q); }; },
  shake: (c, r, o) => { const b = rect(o, 0, 0, W, H, 0xffffff); return q => { const k = (1 - ease(q)) * 26; c.x = W / 2 + Math.sin(q * 70) * k; c.y = H / 2 + Math.cos(q * 53) * k * .6; b.alpha = .7 * (1 - ease(q * 4)); b.visible = q < .3; }; }
};

// ---------- tratamentos de cor ----------
const cm = (m, f) => { const x = new ColorMatrixFilter(); f ? f(x) : x.matrix = m; return x; };
const duo = (a, b) => { const k = b.map((v, i) => v - a[i]); return cm([.3 * k[0], .59 * k[0], .11 * k[0], 0, a[0], .3 * k[1], .59 * k[1], .11 * k[1], 0, a[1], .3 * k[2], .59 * k[2], .11 * k[2], 0, a[2], 0, 0, 0, 1, 0]); };
export const GRADES = {
  none: ['Original', () => []],
  bw: ['Preto & Branco', () => [cm(0, f => { f.desaturate(); f.contrast(.25, true); })]],
  contrast: ['Alto Contraste', () => [cm(0, f => { f.contrast(.45, true); f.saturate(.15, true); })]],
  sepia: ['Sépia', () => [new OldFilmFilter({ sepia: .6, noise: .08, scratch: .15, vignetting: .3 })]],
  oldfilm: ['Filme Antigo', () => [new OldFilmFilter({ sepia: .35, noise: .22, scratch: .5, scratchDensity: .4, vignetting: .4 })]],
  vintage: ['Vintage', () => [cm(0, f => f.vintage())]],
  kodachrome: ['Kodachrome', () => [cm(0, f => f.kodachrome())]],
  technicolor: ['Technicolor', () => [cm(0, f => f.technicolor())]],
  polaroid: ['Polaroid', () => [cm(0, f => f.polaroid())]],
  tealorange: ['Teal & Orange', () => [cm([1.12, -.05, -.07, 0, .02, -.03, 1.04, -.01, 0, 0, -.1, .05, .9, 0, .06, 0, 0, 0, 1, 0])]],
  cold: ['Frio', () => [cm([.9, 0, .05, 0, 0, 0, .98, .05, 0, 0, .05, .05, 1.15, 0, .02, 0, 0, 0, 1, 0])]],
  warm: ['Quente', () => [cm([1.12, .03, 0, 0, .02, 0, 1.02, 0, 0, 0, 0, 0, .85, 0, 0, 0, 0, 0, 1, 0])]],
  dreamy: ['Sonho (bloom)', () => [new AdvancedBloomFilter({ threshold: .45, bloomScale: .7, brightness: 1.05, blur: 6 })]],
  neon: ['Neon', () => [cm(0, f => { f.saturate(.8, true); f.contrast(.15, true); }), new AdvancedBloomFilter({ threshold: .5, bloomScale: 1.1, blur: 8 })]],
  duotone: ['Duotone Roxo/Verde', () => [duo([.18, 0, .35], [.3, 1, .55])]],
  matrix: ['Verde Matrix', () => [duo([0, .02, 0], [.45, 1, .5])]],
  halftone: ['Retícula (halftone)', () => [new DotFilter({ scale: 1.2, angle: 5, grayscale: true })]],
  tiltshift: ['Tilt-shift (miniatura)', () => [new TiltShiftFilter({ blur: 60, gradientBlur: 500 })]],
  lomo: ['Lomo', () => [cm(0, f => { f.saturate(.5, true); f.contrast(.3, true); }), new OldFilmFilter({ sepia: 0, noise: .05, scratch: 0, vignetting: .45, vignettingAlpha: 1 })]]
};

const LW = { full: 4, push: 3, pan: 3, tilt: 2, rotate: 1, focus: 2, zoomout: 2, letterbox: 2, vignette: 2, spotlight: 1, frame: 2, polaroid: 1, archive: 1, parallax: 2, window: 2, split: 2, diptych: 1, triptych: 1, mosaic: 1, stack: 1, filmstrip: 1, tv: 1, diagonal: 1, circle: 1, strips: 1, double: 1 };
const TW = { fade: 3, dissolve: 3, dipblack: 2, dipwhite: 1, flash: 1, lightleak: 2, burn: 1, blur: 2, zoom: 2, whip: 2, push: 1, slide: 1, wipe: 1, iris: 1, barn: 1, blinds: 1, glitch: 1, rgb: 1, pixel: 1, warp: 1, shake: 1 };
export const LAYOUT_NAMES = Object.keys(LW), TRANS_NAMES = Object.keys(TW), GRADE_NAMES = Object.keys(GRADES);
const pick = (r, w) => { let x = r() * Object.values(w).reduce((a, b) => a + b); for (const [k, v] of Object.entries(w)) if ((x -= v) < 0) return k; return Object.keys(w)[0]; };

// escolhe layout/transição/tratamento sem repetir o anterior
export function prepare(segs, { grades = ['none'], grade = 'auto' } = {}) {
  segs.forEach((s, i) => {
    const r = rng(s.seed + 1), pv = segs[i - 1];
    let L = pick(r, LW), t = pick(r, TW);
    if (pv && L === pv.layout) L = pick(r, { ...LW, [L]: 0 });
    if (pv && t === pv.trans) t = pick(r, { ...TW, [t]: 0 });
    const gr = grades[r() * grades.length | 0];
    Object.assign(s, { layout: s.layout || L, trans: s.trans || t, grade: s.grade || (grade === 'auto' ? gr : grade), r: { zin: r() > .5, dx: r() > .5 ? 1 : -1, dy: r() > .5 ? 1 : -1, rot: r() > .5 ? 1 : -1, side: r() > .5 } });
  });
}

export function build(s) {
  const o = new Container(), c = new Container(), inner = new Container();
  c.pivot.set(W / 2, H / 2); c.position.set(W / 2, H / 2); c.addChild(inner); o.addChild(c);
  const up = LAYOUTS[s.layout](inner, s, s.r), tr = TRANS[s.trans](c, s.r, o), fx = GRADES[s.grade]?.[1]() || [];
  inner.filters = fx;
  return { c: o, update(t, out) { const p = cl((t - s.a) / (s.b - s.a + T)); up(p); tr(cl((t - s.a) / T)); fx.forEach(f => 'seed' in f && f instanceof OldFilmFilter && (f.seed = (t * 7.3) % 1)); o.alpha = out; } };
}
