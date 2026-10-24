// Legendas (8 modelos), marca d'água e configuração de texto
const cl = x => Math.min(1, Math.max(0, x)), ease = x => 1 - (1 - cl(x)) ** 3;
export const CAP_STYLES = { karaoke: 'Karaokê (caixa)', doc: 'Documentário (serifa)', lower: 'Lower third', typewriter: 'Máquina de escrever', highlight: 'Marca-texto', outline: 'Contorno forte', minimal: 'Minimalista', neon: 'Neon' };
export const FONTS = ['Syne', 'Inter', 'Montserrat', 'Bebas Neue', 'Anton', 'Oswald', 'Archivo Black', 'Space Grotesk', 'Playfair Display', 'IBM Plex Serif', 'Cinzel', 'JetBrains Mono', 'Fira Code'];
export const AUTO_FONT = { karaoke: 'Syne', doc: 'Playfair Display', lower: 'Inter', typewriter: 'JetBrains Mono', highlight: 'Montserrat', outline: 'Anton', minimal: 'Inter', neon: 'Bebas Neue' };
export const PALETTES = [['#ffffff', '#00ff66'], ['#ffffff', '#ffcc00'], ['#f5f5f5', '#ff3366'], ['#ffffff', '#38bdf8'], ['#fefce8', '#f97316'], ['#ffffff', '#a78bfa'], ['#e5e7eb', '#22d3ee'], ['#ffffff', '#e11d48']];
const UP = new Set(['karaoke', 'outline', 'neon', 'highlight']), SIZE = { karaoke: 46, doc: 40, lower: 34, typewriter: 32, highlight: 42, outline: 58, minimal: 28, neon: 56 };
export const fontOf = (o, kind = 'cap') => { const f = kind === 'cap' ? o.font : o.titleFont; return f === 'auto' ? (kind === 'cap' ? AUTO_FONT[o.cap] : 'Syne') : f; };

export function drawCaptions(g, gs, t, W, H, o) {
  const c = gs.find(x => t >= x.s - .08 && t < x.e);
  if (!c || o.capOff) return;
  const st = o.cap, font = fontOf(o), wt = /doc|minimal|lower/.test(st) ? 600 : 800, inA = ease((t - c.s + .08) / .18);
  let px = SIZE[st] * o.size, sp, tw;
  const ws = c.words.map(w => ({ ...w, t: UP.has(st) ? w.w.toUpperCase() : w.w }));
  const measure = () => { g.font = `${wt} ${px | 0}px "${font}", sans-serif`; ws.forEach(w => w.m = g.measureText(w.t).width); sp = g.measureText(' ').width; tw = ws.reduce((s, w) => s + w.m, 0) + sp * (ws.length - 1); };
  measure();
  const left = st === 'lower' || o.pos === 'lowerleft', maxW = W * (left ? .7 : .86);
  if (tw > maxW) { px *= maxW / tw; measure(); }
  const y = (o.pos === 'top' ? 90 : o.pos === 'middle' ? H / 2 : o.pos === 'lowerleft' ? H * .8 : H - 95) + (st === 'minimal' ? 0 : (1 - inA) * 25 * (o.pos === 'top' ? -1 : 1));
  let x = left ? 80 : (W - tw) / 2;
  g.save();
  g.globalAlpha = Math.min(inA, ease((c.e - t) / .15)) * o.opacity; g.textBaseline = 'middle'; g.textAlign = 'center';
  if (st === 'karaoke') { g.fillStyle = 'rgba(0,0,0,.62)'; g.beginPath(); g.roundRect(x - 28, y - px * .87, tw + 56, px * 1.74, 14); g.fill(); g.strokeStyle = o.accent + '59'; g.lineWidth = 2; g.stroke(); }
  if (st === 'lower') { const gr = g.createLinearGradient(x - 80, 0, x + tw + 160, 0); gr.addColorStop(0, 'rgba(0,0,0,.75)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - 80, y - px * .9, tw + 240, px * 1.8); g.fillStyle = o.accent; g.fillRect(x - 24, y - px * .7, 6, px * 1.4 * ease((t - c.s) / .3)); }
  if (st === 'typewriter') { g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(x - 16, y - px * .75, tw + 32, px * 1.5); }
  for (const w of ws) {
    const on = t >= w.s && t < w.e, done = t >= w.e, pop = on ? 1 + (st === 'outline' ? .22 : .14) * (1 - ease((t - w.s) / .12)) : 1;
    let s = w.t, fill = o.color, a = 1;
    g.save(); g.translate(x + w.m / 2, y);
    if (st === 'karaoke') { fill = on ? o.accent : o.color; a = on || done ? 1 : .45; if (on) { g.shadowColor = o.accent; g.shadowBlur = 18; } g.scale(pop, pop); }
    else if (st === 'doc' || st === 'lower') { a = on || done ? 1 : st === 'doc' ? .35 : .8; g.shadowColor = 'rgba(0,0,0,.8)'; g.shadowBlur = 12; }
    else if (st === 'typewriter') { const f = done ? 1 : on ? cl((t - w.s) / Math.max(.05, w.e - w.s)) : 0; s = w.t.slice(0, Math.ceil(w.t.length * f)); g.textAlign = 'left'; g.translate(-w.m / 2, 0); if (on && (t * 2 | 0) % 2 === 0) { g.fillStyle = o.accent; g.fillRect(g.measureText(s).width + 2, -px * .45, px * .5, px * .9); } }
    else if (st === 'highlight') { if (on || done) { g.fillStyle = on ? o.accent : o.accent + '66'; g.fillRect(-w.m / 2 - 6, -px * .62, w.m + 12, px * 1.24); } fill = on ? '#111' : o.color; g.scale(pop, pop); }
    else if (st === 'outline') { fill = on ? o.accent : o.color; g.scale(pop, pop); g.lineWidth = px * .16; g.lineJoin = 'round'; g.strokeStyle = '#000'; g.strokeText(s, 0, 2); }
    else if (st === 'minimal') a = .92;
    else if (st === 'neon') { const fl = t - c.s < .3 ? (Math.sin(t * 90) > 0 ? 1 : .4) : 1; g.shadowColor = o.accent; g.shadowBlur = on ? 30 : 16; fill = on ? '#fff' : o.accent; a = fl; }
    g.globalAlpha *= a; g.fillStyle = fill; g.fillText(s, 0, 2);
    g.restore();
    x += w.m + sp;
  }
  g.restore();
}

// marca d'água: texto ou imagem, 5 posições
export function drawWatermark(g, W, H, wm) {
  if (!wm || wm.type === 'none' || (wm.type === 'image' && !wm.img) || (wm.type === 'text' && !wm.text)) return;
  const m = 24, w = W * wm.size / 100;
  let ww, hh;
  g.save(); g.globalAlpha = wm.opacity;
  if (wm.type === 'text') { g.font = `700 ${Math.max(10, w * .22) | 0}px "${wm.font}", sans-serif`; ww = g.measureText(wm.text).width; hh = w * .22; }
  else { ww = w; hh = w * wm.img.height / wm.img.width; }
  const x = /l$/.test(wm.pos) ? m : /r$/.test(wm.pos) ? W - m - ww : (W - ww) / 2, y = /^t/.test(wm.pos) ? m : /^b/.test(wm.pos) ? H - m - hh : (H - hh) / 2;
  if (wm.type === 'text') { g.textBaseline = 'top'; g.fillStyle = '#fff'; g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 6; g.fillText(wm.text, x, y); }
  else g.drawImage(wm.img, x, y, ww, hh);
  g.restore();
}
