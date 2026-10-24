// Legenda karaokê desenhada no canvas (entra no vídeo exportado)
const ease = x => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3;

export function drawCaptions(g, gs, t, W, H) {
  const c = gs.find(x => t >= x.s - .08 && t < x.e);
  if (!c) return;
  const inA = ease((t - c.s + .08) / .18), outA = ease((c.e - t) / .15), a = Math.min(inA, outA);
  g.save();
  g.font = '800 46px Syne, "Fira Code", sans-serif'; g.textBaseline = 'middle';
  const sp = g.measureText(' ').width, ws = c.words.map(w => ({ ...w, t: w.w.toUpperCase(), m: g.measureText(w.w.toUpperCase()).width }));
  const tw = ws.reduce((s, w) => s + w.m, 0) + sp * (ws.length - 1), y = H - 95 + (1 - inA) * 25;
  let x = (W - tw) / 2;
  g.globalAlpha = a;
  g.fillStyle = 'rgba(0,0,0,.62)'; g.beginPath(); g.roundRect(x - 28, y - 40, tw + 56, 80, 14); g.fill();
  g.strokeStyle = 'rgba(0,255,102,.35)'; g.lineWidth = 2; g.stroke();
  for (const w of ws) {
    const on = t >= w.s && t < w.e, done = t >= w.e, k = on ? 1 + .14 * (1 - ease((t - w.s) / .12)) : 1;
    g.save(); g.translate(x + w.m / 2, y); g.scale(k, k);
    if (on) { g.shadowColor = '#00ff66'; g.shadowBlur = 18; }
    g.fillStyle = on ? '#00ff66' : done ? '#fff' : 'rgba(255,255,255,.45)';
    g.textAlign = 'center'; g.fillText(w.t, 0, 2); g.restore();
    x += w.m + sp;
  }
  g.restore();
}
