export const RIGHT_GRAPH_MODES = {
  INTERSECTION_COUNT: 'intersection-count',
  DERIVATIVE: 'derivative',
  CUSTOM: 'custom',
}

export const RIGHT_GRAPH_MODE_LABELS = {
  [RIGHT_GRAPH_MODES.INTERSECTION_COUNT]: '프리셋: y=t 교점 개수',
  [RIGHT_GRAPH_MODES.DERIVATIVE]: '프리셋: 도함수 f′(x)',
  [RIGHT_GRAPH_MODES.CUSTOM]: '사용자 수식 g(x)',
}

// This is a calculation range for numerical root finding, not a drawing
// range. Curves themselves follow the board viewport.
export const INTERSECTION_SEARCH_RANGE = [-8, 8]

export function numericalDerivative(piecewiseFn, x) {
  const step = Math.max(1e-4, Math.abs(x) * 1e-4)
  const before = piecewiseFn.evaluateAt(x - step)
  const after = piecewiseFn.evaluateAt(x + step)
  if (Number.isFinite(before) && Number.isFinite(after)) return (after - before) / (2 * step)
  const center = piecewiseFn.evaluateAt(x)
  if (Number.isFinite(center) && Number.isFinite(after)) return (after - center) / step
  if (Number.isFinite(center) && Number.isFinite(before)) return (center - before) / step
  return NaN
}
