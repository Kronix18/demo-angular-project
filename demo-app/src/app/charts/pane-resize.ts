/** Pane-border dragging: the panes are stacked scales with `stackWeight`s, so resizing is moving weight between neighbours. */
const GRAB = 4; // px either side of a separator

/** New weights after dragging the boundary below pane `index` by `dy` pixels (total weight is conserved). */
export function resizeWeights(weights: number[], index: number, dy: number, totalHeight: number, min = 0.4): number[] {
  if (index < 0 || index >= weights.length - 1 || !(totalHeight > 0)) return weights.slice();
  const total = weights.reduce((a, b) => a + b, 0);
  const pair = weights[index] + weights[index + 1];
  let a = weights[index] + (dy / totalHeight) * total;
  a = Math.min(pair - min, Math.max(min, a));
  const out = weights.slice();
  out[index] = a;
  out[index + 1] = pair - a;
  return out;
}

/** The separator under a canvas y: the boundary above pane k+1 (panes are ordered by their top edge). */
export function paneBoundaryAt(chart: any, y: number): { index: number; ids: string[] } | null {
  const ids = Object.keys(chart?.scales ?? {}).filter((k) => k.startsWith('y')).sort((a, b) => chart.scales[a].top - chart.scales[b].top);
  for (let k = 1; k < ids.length; k++) if (Math.abs(y - chart.scales[ids[k]].top) <= GRAB) return { index: k - 1, ids };
  return null;
}
