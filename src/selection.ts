// Inclusive index range between a shift-click anchor and target, order-agnostic.
// Callers filter the result to selectable rows (drop the parent row / hidden).
export function selectionRange(anchor: number, target: number): number[] {
  const lo = Math.min(anchor, target);
  const hi = Math.max(anchor, target);
  const out: number[] = [];
  for (let i = lo; i <= hi; i++) out.push(i);
  return out;
}
