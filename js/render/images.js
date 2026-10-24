// Render básico: cover + Ken Burns + crossfade (substituído na Etapa 4)
const ease = x => x * x * (3 - 2 * x), cl = x => Math.min(1, Math.max(0, x));

function cover(g, s, W, H, p) {
  const im = s.img, r = Math.max(W / im.width, H / im.height), z = s.seed & 1 ? 1.18 - .13 * p : 1.05 + .13 * p;
  const w = im.width * r * z, h = im.height * r * z, dx = (s.seed & 2 ? 1 : -1) * 30 * (p - .5);
  g.drawImage(im, (W - w) / 2 + dx, (H - h) / 2, w, h);
}

export function drawImages(g, segs, t, W, H) {
  const j = segs.findIndex(s => t >= s.a && t < s.b);
  if (j < 0) return;
  const s = segs[j], pv = segs[j - 1], F = .5, p = (t - s.a) / (s.b - s.a);
  const glued = pv && Math.abs(pv.b - s.a) < .01, nx = segs[j + 1], out = nx && Math.abs(nx.a - s.b) < .01 ? 1 : cl((s.b - t) / F);
  g.save();
  if (glued && t - s.a < F) { g.globalAlpha = .92; cover(g, pv, W, H, 1); }
  g.globalAlpha = .92 * ease(cl((t - s.a) / F)) * ease(out);
  cover(g, s, W, H, p);
  // vinheta inferior p/ legibilidade da legenda
  const gr = g.createLinearGradient(0, H * .55, 0, H);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.6)');
  g.globalAlpha = 1; g.fillStyle = gr; g.fillRect(0, H * .55, W, H * .45);
  if (s.credit) { g.font = '13px "Fira Code", monospace'; g.fillStyle = 'rgba(255,255,255,.55)'; g.textAlign = 'right'; g.fillText(s.credit.slice(0, 80), W - 16, H - 14); }
  g.restore();
}
