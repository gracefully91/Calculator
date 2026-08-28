import { worldToScreen } from './viewport'

export function drawAxes(ctx, view) {
  const origin = worldToScreen(view, 0, 0)
  ctx.save()
  ctx.strokeStyle = '#888'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, origin.y)
  ctx.lineTo(view.width, origin.y)
  ctx.moveTo(origin.x, 0)
  ctx.lineTo(origin.x, view.height)
  ctx.stroke()
  ctx.restore()
}

// fn: (x) => y | NaN.  range: {xMin, xMax} (도메인/뷰포트 교집합은 호출자가 결정)
export function drawCurve(ctx, view, fn, range, samples = 300) {
  // 퇴화한 range나 samples <= 0이면 그릴 것이 없으므로 조용히 반환한다.
  if (!(range.xMax > range.xMin) || !(samples > 0)) return

  const step = (range.xMax - range.xMin) / samples
  ctx.save()
  ctx.strokeStyle = '#2563eb'
  ctx.lineWidth = 2
  ctx.beginPath()

  let penDown = false
  for (let i = 0; i <= samples; i++) {
    const x = range.xMin + step * i
    let y
    try {
      y = fn(x)
    } catch {
      penDown = false
      continue
    }
    if (Number.isNaN(y) || !Number.isFinite(y)) {
      penDown = false
      continue
    }
    const { x: sx, y: sy } = worldToScreen(view, x, y)
    if (!penDown) {
      ctx.moveTo(sx, sy)
      penDown = true
    } else {
      ctx.lineTo(sx, sy)
    }
  }
  ctx.stroke()
  ctx.restore()
}

export function drawPointMarker(ctx, view, x, y, { closed, color = '#2563eb', radius = 5 } = {}) {
  const { x: sx, y: sy } = worldToScreen(view, x, y)
  ctx.save()
  ctx.beginPath()
  ctx.arc(sx, sy, radius, 0, 2 * Math.PI)
  if (closed) {
    ctx.fillStyle = color
    ctx.fill()
  } else {
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.stroke()
  }
  ctx.restore()
}
