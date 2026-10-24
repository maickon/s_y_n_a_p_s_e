import { W, H, cl, ease, io } from './layouts.js';
import { rng } from '../core/script.js';

// Vinhetas de abertura: 8 modelos de composição (2D, determinísticas por tempo)
export const VIG_TPL = { reveal: 'Revelação com brilho', glitch: 'Glitch digital', particles: 'Partículas convergentes', lines: 'Moldura neon (HUD)', zoom: 'Zoom cinematográfico', split: 'Painéis se abrindo', rings: 'Anéis orbitais', cinema: 'Cinema (letterbox + flare)' };
export const VIG_SND = { auto: 'Som automático', cinematic: 'Cinemático', digital: 'Digital', ethereal: 'Etéreo', impact: 'Impacto', none: 'Sem som' };
export const VIG_AUTO_SND = { reveal: 'cinematic', glitch: 'digital', particles: 'ethereal', lines: 'digital', zoom: 'impact', split: 'cinematic', rings: 'digital', cinema: 'cinematic' };
const PAL = [['#00ff66', '#9d00ff'], ['#ffcc00', '#ff3366'], ['#38bdf8', '#a78bfa'], ['#f97316', '#fde047'], ['#22d3ee', '#e11d48'], ['#ffffff', '#00ff66']];

const text = (g, s, x, y, px, font, color, { sp = 0, glow, wt = 800, max = W * .82 } = {}) => {
  g.font = `${wt} ${px}px "${font}", sans-serif`; g.letterSpacing = `${sp}px`;
  const m = g.measureText(s).width;
  if (m > max) { px *= max / m; g.font = `${wt} ${px | 0}px "${font}", sans-serif`; }
  if (glow) { g.shadowColor = glow; g.shadowBlur = 30; }
  g.fillStyle = color; g.fillText(s, x, y); g.shadowBlur = 0; g.letterSpacing = '0px';
};
const coverImg = (g, im, k = 1, dx = 0, dy = 0) => { const s = Math.max(W / im.width, H / im.height) * k, w = im.width * s, h = im.height * s; g.drawImage(im, (W - w) / 2 + dx, (H - h) / 2 + dy, w, h); };
const containImg = (g, im, cx, cy, mw, mh) => { const s = Math.min(mw / im.width, mh / im.height); g.drawImage(im, cx - im.width * s / 2, cy - im.height * s / 2, im.width * s, im.height * s); };

export function drawVignette(g, t, v, o = {}) {
  const d = v.dur, p = cl(t / d), out = cl((d + .2 - t) / .5), [c1, c2] = PAL[v.seed % PAL.length], F = o.titleFont && o.titleFont !== 'auto' ? o.titleFont : 'Syne';
  const name = (v.name || 'S.Y.N.A.P.S.E').toUpperCase(), sub = v.sub || '', im = v.img, cx = W / 2, cy = H / 2;
  if (out <= 0) return;
  g.save(); g.globalAlpha = out; g.textAlign = 'center'; g.textBaseline = 'middle';
  const bg = g.createRadialGradient(cx, cy, 0, cx, cy, W * .7); bg.addColorStop(0, '#15101f'); bg.addColorStop(1, '#000'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const subT = (y, a = 1) => { if (!sub) return; g.globalAlpha = out * a; text(g, sub, cx, y, 20, 'Fira Code', c1, { wt: 500, sp: 4 }); g.globalAlpha = out; };
  switch (v.tpl) {
    case 'reveal': {
      if (im) { g.globalAlpha = out * ease(p * 2); containImg(g, im, cx, cy - 70, 360 * (.7 + .3 * ease(p * 2)), 200); g.globalAlpha = out; }
      g.globalAlpha = out * ease(p * 2.5 - .5); text(g, name, cx, im ? cy + 90 : cy, 76, F, '#fff', { glow: c2, sp: 18 * (1 - ease(p * 2)) });
      const sx = W * (-.2 + 1.4 * io(p * 1.4 - .2)), gr = g.createLinearGradient(sx - 120, 0, sx + 120, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = out; g.fillStyle = gr; g.fillRect(sx - 120, cy - 160, 240, 320); g.globalCompositeOperation = 'source-over';
      subT(im ? cy + 150 : cy + 64, ease(p * 3 - 1.5)); break;
    }
    case 'glitch': {
      if (im) { g.globalAlpha = out * .35; coverImg(g, im, 1.05); g.globalAlpha = out; }
      const k = 1 - ease(p * 1.6), r = rng(v.seed + (t * 20 | 0)), ox = (r() - .5) * 40 * k;
      g.globalCompositeOperation = 'lighter';
      text(g, name, cx - 8 * k + ox, cy, 84, F, c2); text(g, name, cx + 8 * k - ox, cy + 3 * k, 84, F, c1);
      g.globalCompositeOperation = 'source-over'; text(g, name, cx, cy, 84, F, k > .2 && r() > .7 ? 'rgba(255,255,255,.2)' : '#fff');
      for (let i = 0; i < 9 * k; i++) { const y = r() * H, h = 4 + r() * 30; g.drawImage(g.canvas, 0, y * (g.canvas.height / H), g.canvas.width, h * (g.canvas.height / H), (r() - .5) * 80 * k, y, W, h); }
      for (let i = 0; i < 20 * k; i++) { g.fillStyle = r() > .5 ? c1 : c2; g.globalAlpha = out * .5 * r(); g.fillRect(r() * W, r() * H, r() * 200, 2); }
      g.globalAlpha = out; subT(cy + 70, ease(p * 3 - 1.2)); break;
    }
    case 'particles': {
      const r = rng(v.seed), q = ease(p / .45), fl = cl(1 - Math.abs(p - .45) / .08);
      for (let i = 0; i < 160; i++) {
        const a0 = r() * 6.28, r0 = 400 + r() * 500, sp = .5 + r(), ang = a0 + t * sp * .6, rad = r0 * (1 - q) + (p > .45 ? 30 + 260 * r() : 0) * ease((p - .45) * 2);
        g.globalAlpha = out * (.4 + .6 * r()); g.fillStyle = i % 2 ? c1 : c2; g.beginPath(); g.arc(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad * .6, 1 + r() * 2.5, 0, 6.28); g.fill();
      }
      if (fl) { const f = g.createRadialGradient(cx, cy, 0, cx, cy, 500); f.addColorStop(0, `rgba(255,255,255,${fl})`); f.addColorStop(1, 'rgba(255,255,255,0)'); g.globalAlpha = out; g.fillStyle = f; g.fillRect(0, 0, W, H); }
      g.globalAlpha = out * ease((p - .45) * 3);
      if (im) containImg(g, im, cx, cy - 60, 300, 170);
      text(g, name, cx, im ? cy + 90 : cy, 72, F, '#fff', { glow: c1 }); g.globalAlpha = out; subT(im ? cy + 145 : cy + 60, ease((p - .6) * 3)); break;
    }
    case 'lines': {
      g.strokeStyle = c1 + '22'; g.lineWidth = 1;
      for (let x = 0; x < W; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
      const bw = Math.min(760, W * .9), bh = 260, x0 = cx - bw / 2, y0 = cy - bh / 2, per = 2 * (bw + bh), L = per * io(p * 1.6);
      g.strokeStyle = c1; g.lineWidth = 3; g.shadowColor = c1; g.shadowBlur = 16; g.beginPath(); g.moveTo(x0, y0);
      [[bw, 0], [0, bh], [-bw, 0], [0, -bh]].reduce((acc, [dx, dy], i, arr) => { const seg = Math.abs(dx + dy), u = cl((L - acc.l) / seg), pt = { x: acc.x + dx * u, y: acc.y + dy * u }; if (u > 0) g.lineTo(pt.x, pt.y); return { l: acc.l + seg, x: acc.x + dx, y: acc.y + dy }; }, { l: 0, x: x0, y: y0 });
      g.stroke(); g.shadowBlur = 0;
      const n = Math.floor(name.length * cl((p - .35) / .35));
      if (im) { g.globalAlpha = out * ease((p - .3) * 3); containImg(g, im, x0 + 110, cy, 160, 160); g.globalAlpha = out; }
      text(g, name.slice(0, n) + (n < name.length && (t * 4 | 0) % 2 ? '▌' : ''), im ? cx + 70 : cx, cy, 64, F, '#fff', { max: im ? bw - 260 : bw - 60 });
      subT(y0 + bh + 40, ease((p - .7) * 4)); break;
    }
    case 'zoom': {
      if (im) { g.globalAlpha = out * ease(p * 3); coverImg(g, im, 1.7 - .65 * io(p)); g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, 0, W, H); g.globalAlpha = out; }
      g.globalAlpha = out * ease(p * 2 - .3); text(g, name, cx, cy, 96, F, '#fff', { sp: 70 * (1 - ease(p * 1.5)) + 6, glow: c2 }); g.globalAlpha = out;
      g.fillStyle = c1; g.fillRect(cx - 200 * ease(p * 2 - .6), cy + 62, 400 * ease(p * 2 - .6), 3); subT(cy + 100, ease(p * 3 - 1.6)); break;
    }
    case 'split': {
      if (im) { coverImg(g, im, 1.1 - .08 * p); g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, 0, W, H); }
      text(g, name, cx, cy, 84, F, '#fff', { glow: c1 }); subT(cy + 70);
      const k = io(p * 1.8 - .45), hh = H / 2 * (1 - k);
      g.fillStyle = '#0b0712'; g.fillRect(0, 0, W, hh); g.fillRect(0, H - hh, W, hh);
      g.fillStyle = c1; const lw = W * ease(p * 3); if (k < 1) { g.fillRect(cx - lw / 2, hh - 2, lw, 3); g.fillRect(cx - lw / 2, H - hh - 1, lw, 3); } break;
    }
    case 'rings': {
      const R = 150;
      for (let i = 0; i < 4; i++) { g.strokeStyle = i % 2 ? c2 : c1; g.lineWidth = 2 + i; g.setLineDash([20 + i * 10, 14 + i * 6]); g.globalAlpha = out * ease(p * 3 - i * .2) * .8; g.beginPath(); g.arc(cx, cy - 30, R + i * 26, t * (i % 2 ? -1 : 1) * (.6 + i * .2), t * (i % 2 ? -1 : 1) * (.6 + i * .2) + 6.28 * ease(p * 2 - i * .1)); g.stroke(); }
      g.setLineDash([]); g.globalAlpha = out;
      if (im) { g.save(); g.beginPath(); g.arc(cx, cy - 30, R - 12, 0, 6.28); g.clip(); g.globalAlpha = out * ease(p * 2 - .3); coverImg(g, im, .45); g.restore(); }
      g.globalAlpha = out * ease(p * 2.5 - .8); text(g, name, cx, cy + R + 40, 54, F, '#fff', { glow: c1, sp: 6 }); g.globalAlpha = out; subT(cy + R + 90, ease(p * 3 - 1.8)); break;
    }
    default: { // cinema
      if (im) { g.globalAlpha = out * ease(p * 2); coverImg(g, im, 1.12 - .1 * p); g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(0, 0, W, H); g.globalAlpha = out; }
      g.globalAlpha = out * ease(p * 2 - .4); text(g, name, cx, cy, 70, F === 'Syne' ? 'Cinzel' : F, '#f5efe0', { wt: 600, sp: 12 }); g.globalAlpha = out;
      const fx = W * (.2 + .6 * p), fg = g.createLinearGradient(0, 0, W, 0); fg.addColorStop(0, 'rgba(120,180,255,0)'); fg.addColorStop(cl(fx / W), `rgba(200,230,255,${.5 * Math.sin(Math.PI * p)})`); fg.addColorStop(1, 'rgba(120,180,255,0)');
      g.globalCompositeOperation = 'lighter'; g.fillStyle = fg; g.fillRect(0, cy - 3, W, 6); g.globalCompositeOperation = 'source-over';
      const bh = H * .5 - (H * .5 - H * .12) * io(p * 1.6); g.fillStyle = '#000'; g.fillRect(0, 0, W, bh); g.fillRect(0, H - bh, W, bh); subT(cy + 60, ease(p * 3 - 1.5));
    }
  }
  g.restore();
}
