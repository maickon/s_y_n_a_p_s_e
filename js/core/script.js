export const splitScenes = t => t.trim().split(/(?<=[.!?…])\s+|\n+/).map(s => s.trim()).filter(Boolean);

export function hash(s) {
  let h = 0;
  for (const c of s) h = (h << 5) - h + c.charCodeAt(0) | 0;
  return Math.abs(h);
}

// PRNG determinístico
export const rng = s => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
