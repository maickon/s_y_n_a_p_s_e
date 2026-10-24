// DSP em JS puro: time-stretch (WSOLA) e pitch shift sem alterar duração
export function wsola(x, sr, tempo) {
  if (Math.abs(tempo - 1) < .01) return x;
  const N = Math.round(sr * .04), Hs = N >> 1, Ha = Hs * tempo, tol = Math.round(sr * .008);
  const win = Float32Array.from({ length: N }, (_, i) => .5 - .5 * Math.cos(2 * Math.PI * i / N));
  const L = Math.ceil(x.length / tempo) + N, y = new Float32Array(L), w = new Float32Array(L);
  let prev = 0, end = 0;
  for (let k = 0, o = 0; ; k++, o += Hs) {
    const nom = Math.round(k * Ha);
    if (nom + N + tol >= x.length || o + N > L) break;
    let best = nom;
    if (k) { // alinha com a continuação natural do grão anterior
      let bc = -Infinity; const ref = prev + Hs;
      for (let d = -tol; d <= tol; d += 2) { const c0 = nom + d; if (c0 < 0) continue; let c = 0; for (let j = 0; j < Hs; j += 3) c += x[ref + j] * x[c0 + j]; if (c > bc) { bc = c; best = c0; } }
    }
    for (let j = 0; j < N; j++) { y[o + j] += x[best + j] * win[j]; w[o + j] += win[j]; }
    prev = best; end = o + N;
  }
  for (let i = 0; i < end; i++) if (w[i] > 1e-3) y[i] /= w[i];
  return y.subarray(0, end);
}

const resample = (x, r) => { const n = Math.floor(x.length / r), y = new Float32Array(n); for (let i = 0; i < n; i++) { const p = i * r, k = p | 0, f = p - k; y[i] = x[k] * (1 - f) + (x[k + 1] || 0) * f; } return y; };

// semis = semitons; tempo > 1 acelera
export function shift(x, sr, semis = 0, tempo = 1) {
  if (!semis) return wsola(x, sr, tempo);
  const r = 2 ** (semis / 12);
  return resample(wsola(x, sr, tempo / r), r);
}
