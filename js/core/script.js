export const splitScenes = t => t.trim().split(/(?<=[.!?…])\s+|\n+/).map(s => s.trim()).filter(Boolean);

export function hash(s) {
  let h = 0;
  for (const c of s) h = (h << 5) - h + c.charCodeAt(0) | 0;
  return Math.abs(h);
}
