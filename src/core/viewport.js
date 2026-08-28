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
