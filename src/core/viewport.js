export function worldToScreen(view, x, y) {
  const { xMin, xMax, yMin, yMax, width, height } = view
  return {
    x: ((x - xMin) / (xMax - xMin)) * width,
    y: height - ((y - yMin) / (yMax - yMin)) * height,
  }
}

export function screenToWorld(view, sx, sy) {
  const { xMin, xMax, yMin, yMax, width, height } = view
  return {
    x: xMin + (sx / width) * (xMax - xMin),
    y: yMin + ((height - sy) / height) * (yMax - yMin),
  }
}

// Task 17 (responsive layout): a GraphCanvas's <canvas> can now be
// CSS-stretched (style width:100%/height:auto) to a *rendered* size that
// differs from its drawing-buffer *resolution* (the width/height passed
// into `view` above, which worldToScreen/screenToWorld operate in). Falls
// back to the resolution size whenever the rendered rect reads 0 -- jsdom
// (unit tests) has no real layout engine and always reports
// getBoundingClientRect() as all-zero, so without this fallback any caller
// would divide by zero instead of getting the pre-Task-17 1:1 behavior.
// Exported (not just used by toResolutionXY below) so GraphCanvas's own
// internal handlers -- which read the rect via canvasRef rather than a
// MouseEvent's currentTarget -- share the exact same correction instead of
// a second, possibly-drifting copy of it.
export function resolveRenderedSize(rect, resolutionWidth, resolutionHeight) {
  return {
    renderedWidth: rect.width || resolutionWidth,
    renderedHeight: rect.height || resolutionHeight,
  }
}

// Converts a MouseEvent fired on a GraphCanvas <canvas> element into
// resolution-space pixel coordinates -- the space `view` and
// worldToScreen/screenToWorld operate in. GraphCanvas's own onCanvasClick
// prop hands its consumer only the raw MouseEvent and view (not
// GraphCanvas's internal canvasRef), so a caller wiring up "convert this
// click to world coordinates" has no way to replicate this scale
// correction without it: `e.currentTarget` is the <canvas> itself (set
// synchronously, valid for the duration of an onClick callback), and its
// getBoundingClientRect() reports the *rendered* CSS size, not the
// resolution `view.width`/`view.height` the rest of the coordinate math
// assumes.
//
// Usage: `const { x, y } = toResolutionXY(e, view); const world =
// screenToWorld(view, x, y)` turns a click straight into world
// coordinates, correctly scaled whether or not CSS is stretching the
// canvas away from its resolution.
export function toResolutionXY(e, view) {
  const rect = e.currentTarget.getBoundingClientRect()
  const { renderedWidth, renderedHeight } = resolveRenderedSize(rect, view.width, view.height)
  return {
    x: (e.clientX - rect.left) * (view.width / renderedWidth),
    y: (e.clientY - rect.top) * (view.height / renderedHeight),
  }
}

// range 안에 대략 5개의 격자선이 들어오도록 1/2/5 * 10^n 중 하나를 고른다.
export function niceGridStep(range, targetTicks = 5) {
  const rough = range / targetTicks
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)))
  const residual = rough / magnitude
  let niceResidual
  if (residual < 1.5) niceResidual = 1
  else if (residual < 3.5) niceResidual = 2
  else if (residual < 7.5) niceResidual = 5
  else niceResidual = 10
  return niceResidual * magnitude
}
