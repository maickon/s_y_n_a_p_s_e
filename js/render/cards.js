import { W, H, cl, ease } from './layouts.js';
import { fontOf } from './captions.js';

// Cartões animados por cena e sobreposições fixas de cada tipo de vídeo
const back = x => (x = cl(x), 1 + 2.7 * (x - 1) ** 3 + 1.7 * (x - 1) ** 2); // easing com "pulo"
const pill = (g, x, y, txt, bg, fg = '#fff', px = 16) => { g.font = `800 ${px}px "Fira Code", monospace`; const w = g.measureText(txt).width + px * 1.3; g.fillStyle = bg; g.beginPath(); g.roundRect(x, y, w, px * 1.9, px * .5); g.fill(); g.fillStyle = fg; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillText(txt, x + px * .65, y + px * .98); return w; };
const fitFont = (g, txt, px, max, F, wt = 800) => { g.font = `${wt} ${px}px "${F}", sans-serif`; const m = g.measureText(txt).width; if (m > max) g.font = `${wt} ${px * max / m | 0}px "${F}", sans-serif`; };

// devolve true quando um cartão de tela cheia está ativo (a legenda fica oculta)
export function drawCards(g, t, D, tl, o = {}) {
  const { type = 'doc', cards = [] } = D || {};
  if (type === 'doc' || !tl.length) return false;
  let full = false;
  const F = fontOf(o, 'title'), A = o.accent || '#00ff66', C = o.color || '#fff', i = tl.findLastIndex(s => t >= s.start - .15), short = Math.min(W, H);
  g.save();
  // --- sobreposições fixas ---
  if (type === 'mystery') { const v = g.createRadialGradient(W / 2, H / 2, short * .3, W / 2, H / 2, Math.max(W, H) * .75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,0,0,${.62 + .05 * Math.sin(t * 9)})`); g.fillStyle = v; g.fillRect(0, 0, W, H); }
  if (type === 'news') {
    const blink = (t * 1.5 | 0) % 2;
    const w = pill(g, 18, 16, '  AO VIVO', '#dc2626'); g.fillStyle = blink ? '#fff' : '#fca5a5'; g.beginPath(); g.arc(34, 16 + 15, 5, 0, 6.28); g.fill();
    const by = H - 38, txt = tl.map(s => s.text.toUpperCase()).join('   •   ') + '   •   ';
    g.fillStyle = 'rgba(8,8,12,.92)'; g.fillRect(0, by, W, 38);
    g.font = '700 17px "Inter", sans-serif'; g.textBaseline = 'middle'; g.fillStyle = '#e5e7eb';
    const tw = g.measureText(txt).width, x0 = W - (t * 110) % (tw + W);
    g.save(); g.beginPath(); g.rect(130, by, W - 130, 38); g.clip(); g.fillText(txt, x0, by + 20); g.fillText(txt, x0 + tw, by + 20); g.restore();
    g.fillStyle = '#dc2626'; g.fillRect(0, by, 122, 38); g.fillStyle = '#fff'; g.font = '800 15px "Inter", sans-serif'; g.fillText('ÚLTIMAS', 16, by + 20);
  }
  if (type === 'sabia') pill(g, 18, 16, 'VOCÊ SABIA?', A, '#111', 15);
  const nums = cards.map((c, k) => c?.kind === 'number' ? [k, c.big] : null).filter(Boolean);
  if (type === 'top' && nums.length) { const cur = nums.filter(([k]) => tl[k] && t >= tl[k].start - .1).pop(); pill(g, 18, 16, `TOP ${nums.length}`, A, '#111', 15); if (cur) { g.font = `800 44px "${F}", sans-serif`; g.textAlign = 'right'; g.textBaseline = 'top'; g.fillStyle = C; g.shadowColor = A; g.shadowBlur = 18; g.fillText(cur[1], W - 22, 16); g.shadowBlur = 0; } }
  const steps = cards.map((c, k) => c?.kind === 'step' ? k : -1).filter(k => k >= 0);
  if (type === 'steps' && steps.length) { const n = steps.length, cur = steps.filter(k => tl[k] && t >= tl[k].start - .1).length, sw = (W - 40 - (n - 1) * 6) / n; for (let k = 0; k < n; k++) { g.fillStyle = k < cur ? A : 'rgba(255,255,255,.18)'; g.fillRect(20 + k * (sw + 6), 12, sw, 6); } if (cur) pill(g, 20, 26, `PASSO ${cur}/${n}`, 'rgba(0,0,0,.6)', C, 14); }
  const yrs = cards.map((c, k) => c?.kind === 'year' ? [k, c.big] : null).filter(Boolean);
  if (type === 'timeline' && yrs.length > 1) {
    const y = H - 30, x0 = 60, x1 = W - 60, cur = yrs.filter(([k]) => tl[k] && t >= tl[k].start - .1).length;
    g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke();
    g.strokeStyle = A; g.lineWidth = 3; g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + (x1 - x0) * Math.max(0, cur - 1) / (yrs.length - 1), y); g.stroke();
    g.font = '600 12px "Fira Code", monospace'; g.textAlign = 'center'; g.textBaseline = 'bottom';
    yrs.forEach(([, yv], k) => { const x = x0 + (x1 - x0) * k / (yrs.length - 1), on = k < cur; g.fillStyle = on ? A : 'rgba(255,255,255,.4)'; g.beginPath(); g.arc(x, y, on ? 6 : 4, 0, 6.28); g.fill(); g.fillText(yv, x, y - 9); });
  }
  // --- cartão da cena atual ---
  const c = cards[i], s = tl[i];
  if (c && s) {
    const p = t - (s.start - .15), dur = c.hold ? s.end - s.start + .5 : c.kind === 'headline' ? 3.8 : 2.4, out = cl((dur - p) / .35), k = Math.min(cl(p / .25), out);
    if (k > 0) {
      g.globalAlpha = k; full = /number|mystery|headline/.test(c.kind);
      if (c.kind === 'number') {
        const bgd = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * .7); bgd.addColorStop(0, 'rgba(0,0,0,.45)'); bgd.addColorStop(1, 'rgba(0,0,0,.85)'); g.fillStyle = bgd; g.fillRect(0, 0, W, H);
        const sc = back(p / .45); g.save(); g.translate(W / 2, H * .45); g.scale(sc, sc);
        fitFont(g, c.big, short * .46, W * .8, F); g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineWidth = short * .012; g.strokeStyle = A; g.shadowColor = A; g.shadowBlur = 40; g.strokeText(c.big, 0, 0); g.shadowBlur = 0; g.fillStyle = C; g.fillText(c.big, 0, 0); g.restore();
        if (c.label) { g.globalAlpha = k * cl((p - .35) / .3); fitFont(g, c.label.toUpperCase(), 40, W * .85, F); g.textAlign = 'center'; g.fillStyle = C; g.fillText(c.label.toUpperCase(), W / 2, H * .45 + short * .3 + (1 - cl((p - .35) / .3)) * 20); }
      } else if (c.kind === 'year') {
        const x = 40, y = H * .3; fitFont(g, c.big, 110, W * .7, F); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
        g.shadowColor = 'rgba(0,0,0,.8)'; g.shadowBlur = 20; g.fillStyle = C; g.fillText(c.big, x - (1 - ease(p / .4)) * 60, y); g.shadowBlur = 0;
        g.fillStyle = A; g.fillRect(x, y + 14, g.measureText(c.big).width * ease((p - .2) / .5), 6);
      } else if (c.kind === 'question') {
        const sc = back(p / .4) * (1 + .05 * Math.sin(p * 6)); g.save(); g.translate(W * (H > W ? .5 : .78), H * (H > W ? .3 : .42)); g.rotate(Math.sin(p * 2) * .08); g.scale(sc, sc);
        g.font = `800 ${short * .38 | 0}px "${F}", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = A; g.shadowBlur = 50; g.fillStyle = A; g.fillText('?', 0, 0); g.restore();
      } else if (c.kind === 'step') {
        g.globalAlpha = k; const x = 30 - (1 - ease(p / .3)) * 80, y = H * .2; g.textAlign = 'left'; g.textBaseline = 'middle';
        fitFont(g, `PASSO ${c.big}`, 64, W * .8, F); g.fillStyle = A; g.fillText(`PASSO ${c.big}`, x, y);
        if (c.label) { fitFont(g, c.label, 30, W * .85, F, 600); g.fillStyle = C; g.shadowColor = '#000'; g.shadowBlur = 12; g.fillText(c.label, x, y + 52); g.shadowBlur = 0; }
      } else if (c.kind === 'headline') {
        const sl = ease(p / .4), bw = W * .86, x = 24 - (1 - sl) * bw, y = H - 38 - 110;
        g.fillStyle = '#dc2626'; g.fillRect(x, y, 150, 40); g.fillStyle = '#fff'; g.font = '800 22px "Inter", sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('URGENTE', x + 16, y + 21);
        g.fillStyle = 'rgba(255,255,255,.95)'; g.fillRect(x, y + 40, bw, 56); fitFont(g, c.label.toUpperCase(), 28, bw - 30, 'Inter'); g.fillStyle = '#111'; g.fillText(c.label.toUpperCase(), x + 16, y + 69);
      } else if (c.kind === 'mystery') {
        g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, 0, W, H);
        const n = Math.floor(c.label.length * cl(p / 1.6)); fitFont(g, c.label, 44, W * .86, 'JetBrains Mono', 600); g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = '#e5e7eb'; g.shadowColor = '#7f1d1d'; g.shadowBlur = 24; g.fillText(c.label.slice(0, n) + (n < c.label.length && (t * 3 | 0) % 2 ? '▌' : ''), W / 2, H / 2);
      }
    }
  }
  g.restore();
  return full;
}
