// Player: toca o mix com seek e desenha o quadro do tempo atual
export function createPlayer({ draw, onTime, onEnd }) {
  let ctx, out, dest, src, buf = null, on = false, at = 0, t0 = 0, raf = 0, tmo = 0, cost = 0, range = null;
  const init = () => { if (ctx) return; ctx = new AudioContext(); out = new GainNode(ctx); dest = ctx.createMediaStreamDestination(); out.connect(ctx.destination); out.connect(dest); };
  const now = () => on ? ctx.currentTime - t0 : at;
  const stopSrc = () => { try { src?.stop(); } catch { } src?.disconnect(); src = null; };
  const startSrc = t => { stopSrc(); src = new AudioBufferSourceNode(ctx, { buffer: buf }); src.connect(out); const s = ctx.currentTime + .03; src.start(s, Math.min(t, buf.duration)); t0 = s - t; };
  const show = t => { const a = performance.now(); draw(t); onTime(t); cost = cost * .8 + (performance.now() - a) * .2; };
  // render adaptativo: se o quadro é caro, espera o mesmo tempo (o triplo enquanto se digita) para a interface responder
  const typing = () => /INPUT|TEXTAREA/.test(document.activeElement?.tagName);
  const next = () => { const gap = cost * (typing() ? 3 : 1); gap > 6 ? tmo = setTimeout(() => raf = requestAnimationFrame(loop), gap) : raf = requestAnimationFrame(loop); };
  const halt = () => { cancelAnimationFrame(raf); clearTimeout(tmo); };
  const loop = () => {
    if (!on) return;
    const t = now();
    if (range && (t >= range[1] || t < range[0] - .5)) { startSrc(range[0]); next(); return; }
    if (t >= buf.duration) { pause(); at = buf.duration; show(at); onEnd?.(); return; }
    show(t); next();
  };
  function play(t = now()) {
    if (!buf) return;
    init(); ctx.resume();
    if (t >= buf.duration - .05) t = 0;
    on = true; startSrc(t); halt(); loop();
  }
  function pause() { if (!on) return; at = now(); on = false; stopSrc(); halt(); onTime(at); }
  function seek(t) { t = Math.max(0, Math.min(t, buf?.duration || 0)); if (on) startSrc(t); else { at = t; show(t); } }
  return {
    play, pause, seek, toggle: () => on ? pause() : play(),
    get playing() { return on; }, get time() { return now(); },
    get range() { return range; }, setRange(r) { range = r; },
    // troca o áudio mantendo a posição (edição ao vivo)
    setBuffer(b) { const t = Math.min(now(), b.duration); buf = b; if (on) startSrc(t); else { at = t; show(t); } },
    stream() { init(); return dest.stream; }
  };
}
