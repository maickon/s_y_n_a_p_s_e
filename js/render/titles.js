import { W, H, cl, ease } from './layouts.js';
import { fontOf } from './captions.js';
import { drawVignette } from './vignette.js';

const GL = '█▓▒░<>/\\|_=+*#@$%&01';
const scramble = (s, p, seed) => [...s].map((c, i) => { const k = p * s.length * 1.5 - i; return k >= 1 || c === ' ' ? c : k > 0 ? GL[(seed + i * 7 + (p * 90 | 0)) % GL.length] : ' '; }).join('');
let FONT = 'Syne';
const fit = (g, txt, px, max, w = 800) => { g.font = `${w} ${px}px "${FONT}", sans-serif`; const m = g.measureText(txt).width; if (m > max) g.font = `${w} ${px * max / m | 0}px "${FONT}", sans-serif`; };

export function drawIntro(g, t, I, o = {}) {
  if (!I || I.none || t > I.b) return;
  if (I.vig) return drawVignette(g, t, I.vig, o);
  FONT = fontOf(o, 'title');
  g.save();
  g.globalAlpha = cl((I.b - t) / .5);
  g.fillStyle = `rgba(0,0,0,${.88 - .3 * cl(t / 2)})`; g.fillRect(0, 0, W, H);
  const lw = W * .62 * ease(t / .8);
  g.fillStyle = o.accent || '#00ff66'; g.fillRect((W - lw) / 2, H / 2 - 72, lw, 2); g.fillRect((W - lw) / 2, H / 2 + 72, lw, 2);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  fit(g, I.title, 78, W * .84);
  g.shadowColor = o.accent || '#9d00ff'; g.shadowBlur = 28; g.fillStyle = o.color || '#fff';
  g.fillText(scramble(I.title, cl((t - .25) / 1.3), I.code), W / 2, H / 2 - 8);
  g.shadowBlur = 0; g.font = '500 17px "Fira Code", monospace'; g.fillStyle = '#00ff66';
  g.fillText(scramble(`// TRANSMISSÃO 0x${(I.code >>> 0).toString(16).slice(0, 6).toUpperCase()} · S.Y.N.A.P.S.E`, cl((t - .9) / .9), 3), W / 2, H / 2 + 44);
  g.restore();
}

export function drawOutro(g, t, O, o = {}) {
  if (!O || t < O.a) return;
  FONT = fontOf(o, 'title');
  const k = ease((t - O.a) / .8), p = t - O.a;
  g.save();
  g.fillStyle = `rgba(0,0,0,${.78 * k})`; g.fillRect(0, 0, W, H);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.globalAlpha = k;
  if (!O.off) {
  fit(g, O.title, 54, W * .85); g.shadowColor = o.accent || '#ff0055'; g.shadowBlur = 22; g.fillStyle = o.color || '#fff';
  g.fillText(scramble(O.title, cl(p / 1.1), 9), W / 2, H * .3);
  g.shadowBlur = 0;
  g.beginPath(); g.rect(0, H * .42, W, H * .5); g.clip();
  g.font = '14px "Fira Code", monospace'; g.fillStyle = 'rgba(209,213,219,.85)';
  const y0 = H * .48 - Math.max(0, p - 1.4) * 26;
  (O.credits.length ? ['CRÉDITOS', '', ...O.credits] : []).forEach((c, i) => { g.fillStyle = i ? 'rgba(209,213,219,.85)' : o.accent || '#00ff66'; g.fillText(c.slice(0, 110), W / 2, y0 + i * 24); });
  }
  g.restore();
  const f = cl((t - (O.b - .7)) / .7);
  if (f) { g.fillStyle = `rgba(0,0,0,${f})`; g.fillRect(0, 0, W, H); }
}

// posição/largura do título conforme o layout ativo
export const posFor = (L, r = {}) => H > W ? (/split|window|circle|diagonal/.test(L) ? { x: W / 2, y: r.side ? H * .78 : H * .2, al: 'center', mw: W * .84 } : { x: W / 2, y: H * .16, al: 'center', mw: W * .84 })
  : L === 'split' ? { x: r.side ? W * .78 : W * .22, y: H * .42, al: 'center', mw: W * .38 }
  : L === 'circle' ? { x: W / 2 + (r.side ? 1 : -1) * W * .3, y: H * .45, al: 'center', mw: W * .34 }
  : L === 'frame' ? { x: W / 2, y: H * .1, al: 'center', mw: W * .8 } : { x: W * .07, y: H * .2, al: 'left', mw: W * .6 };

export function drawKinetic(g, t, K = [], segs = [], o = {}) {
  FONT = fontOf(o, 'title');
  for (const k of K) {
    if (t < k.a || t > k.b) continue;
    if (!k.pos) { const s = segs.findLast(x => k.a + .3 >= x.a && k.a + .3 < x.b); k.pos = posFor(s?.layout, s?.r); }
    const { x: kx, y: ky, al, mw } = k.pos;
    const p = t - k.a, out = cl((k.b - t) / .35), ls = [...k.text];
    g.save();
    fit(g, k.text, 86, mw);
    g.textBaseline = 'middle'; g.textAlign = 'left'; g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.75)'; g.lineJoin = 'round';
    const sp = (1 - out) * 14, ws = ls.map(c => g.measureText(c).width), tw = ws.reduce((a, b) => a + b, 0) + sp * (ls.length - 1);
    let x = al === 'center' ? kx - tw / 2 : kx;
    const gr = g.createLinearGradient(x, 0, x + tw, 0);
    gr.addColorStop(0, o.color || '#c084fc'); gr.addColorStop(1, o.accent || '#00ff66');
    ls.forEach((c, i) => {
      const q = ease((p - i * .035) / .28);
      g.globalAlpha = q * out;
      const y = ky + (1 - q) * 46;
      g.shadowColor = o.accent || '#9d00ff'; g.shadowBlur = 20; g.strokeText(c, x, y); g.shadowBlur = 0;
      g.fillStyle = gr; g.fillText(c, x, y);
      x += ws[i] + sp;
    });
    g.globalAlpha = out; g.fillStyle = o.accent || '#00ff66';
    const bw = tw * ease((p - .2) / .5), bx = al === 'center' ? kx - tw / 2 : kx;
    g.fillRect(bx, ky + 52, bw, 4);
    g.restore();
  }
}
