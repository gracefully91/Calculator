import { useRef, useEffect, useState } from 'react'
import { drawAxes, drawCurve, drawPointMarker } from '../core/canvasRenderer'
import { worldToScreen, screenToWorld } from '../core/viewport'

const DEFAULT_VIEW = { xMin: -8, xMax: 8, yMin: -8, yMax: 8 }

// Proximity (in screen pixels, vertical distance only) within which a
// mousedown is treated as "grabbing" the horizontalLine instead of starting
// a pan. Chosen to be comfortably clickable without swallowing clicks/drags
// that are clearly meant for panning elsewhere in the canvas.
const LINE_HIT_THRESHOLD_PX = 8

// curves: [{ fn: (x)=>y, range: {xMin,xMax} }]
// points: [{ x, y, closed }]
// onCanvasClick: (mouseEvent, view) => void — 클릭 좌표를 world 좌표로 바꿀 때 필요한 view를 함께 전달
// horizontalLine: { y: number, onDrag: (newWorldY) => void } | undefined — 있으면
//   y=horizontalLine.y 위치에 드래그 가능한 빨간 점선을 그린다. 이 선 근처(8px 이내)에서
//   mousedown하면 팬 대신 onDrag가 호출된다 (팬과 달리 GraphCanvas의 로컬 worldView는
//   바뀌지 않고, 부모가 준 콜백을 통해 t 같은 외부 상태를 갱신하는 용도).
export function GraphCanvas({ curves, points, width = 400, height = 400, onCanvasClick, horizontalLine }) {
  const canvasRef = useRef(null)
  const [worldView, setWorldView] = useState(DEFAULT_VIEW)
  // Drag state must survive re-renders (setWorldView during a drag causes
  // one), so a plain `let` in the component body would be reset to null on
  // every re-render and break the drag after its first mousemove. A ref's
  // identity is stable across renders, so it can safely hold mutable state
  // that isn't itself meant to trigger re-renders.
  //
  // `mode` ('pan' | 'line') is decided once, at mousedown, from the cursor's
  // proximity to horizontalLine at that instant, and never re-evaluated
  // while the drag is in progress. Re-testing proximity on every mousemove
  // would let a drag flip modes mid-gesture if the cursor happened to cross
  // the line's y-coordinate while panning (or vice versa) -- picking the
  // mode once at mousedown and sticking with it for the whole gesture avoids
  // that.
  const dragStartRef = useRef(null)

  const view = { ...worldView, width, height }

  // Task 17 (responsive layout) lets CSS stretch the canvas's *rendered*
  // size (style width:100%/height:auto below) away from its *resolution*
  // (the width/height attributes, which stay fixed -- worldToScreen/
  // screenToWorld and the draw effect below all operate in that resolution
  // pixel space). getBoundingClientRect() reports the rendered CSS size,
  // not the resolution, so any handler that turns a MouseEvent's
  // clientX/clientY into a resolution-space pixel value must first divide
  // out that ratio -- otherwise a rendered canvas larger than its
  // resolution (e.g. a wide flex column) makes drags/hit-tests act as if
  // the cursor moved less than it visually did, throwing off both the
  // horizontalLine hit test/drag and panning by the scale factor. This is
  // exactly the risk flagged in Task 14's code review as "latent" pending
  // "a future layout [that] applies CSS sizing" -- this is that layout.
  //
  // jsdom's getBoundingClientRect() always reports width/height 0 (it does
  // no real layout), which would otherwise turn this into a divide-by-zero
  // for every existing unit test -- falling back to the resolution
  // width/height whenever the rendered size reads as 0 keeps those tests'
  // pixel math (written assuming rendered size === resolution) unchanged,
  // while still applying the real ratio in a browser where the rect is
  // non-zero.
  function renderedSize() {
    const rect = canvasRef.current.getBoundingClientRect()
    return {
      rect,
      renderedWidth: rect.width || width,
      renderedHeight: rect.height || height,
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    // jsdom (unit tests) has no real 2d canvas context and returns null here.
    if (!ctx) return
    ctx.clearRect(0, 0, width, height)
    drawAxes(ctx, view)
    curves.forEach(({ fn, range }) => drawCurve(ctx, view, fn, range))
    points.forEach((p) => drawPointMarker(ctx, view, p.x, p.y, { closed: p.closed }))
    if (horizontalLine) {
      const { x: x0, y: sy } = worldToScreen(view, view.xMin, horizontalLine.y)
      const { x: x1 } = worldToScreen(view, view.xMax, horizontalLine.y)
      ctx.save()
      ctx.strokeStyle = '#dc2626'
      ctx.setLineDash([6, 4])
      ctx.beginPath()
      ctx.moveTo(x0, sy)
      ctx.lineTo(x1, sy)
      ctx.stroke()
      ctx.restore()
    }
    // `view` is a fresh object every render, so listing it as a dep here
    // would make this effect run on every render anyway — same as listing
    // its parts (worldView, width, height) directly, but more honest about
    // what actually needs to change to justify a redraw.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curves, points, worldView, width, height, horizontalLine])

  function handleWheel(e) {
    e.preventDefault()
    const scale = e.deltaY > 0 ? 1.1 : 0.9
    setWorldView((v) => {
      const cx = (v.xMin + v.xMax) / 2
      const cy = (v.yMin + v.yMax) / 2
      const halfW = ((v.xMax - v.xMin) / 2) * scale
      const halfH = ((v.yMax - v.yMin) / 2) * scale
      return { xMin: cx - halfW, xMax: cx + halfW, yMin: cy - halfH, yMax: cy + halfH }
    })
  }

  function handleMouseDown(e) {
    if (horizontalLine) {
      const { rect, renderedHeight } = renderedSize()
      // e.clientY - rect.top is a rendered-CSS-pixel offset; scale it into
      // the resolution pixel space that lineScreenY (from worldToScreen,
      // which uses view.height = the resolution height) is expressed in.
      const my = (e.clientY - rect.top) * (height / renderedHeight)
      const { y: lineScreenY } = worldToScreen(view, view.xMin, horizontalLine.y)
      if (Math.abs(my - lineScreenY) <= LINE_HIT_THRESHOLD_PX) {
        dragStartRef.current = { mode: 'line' }
        return
      }
    }
    dragStartRef.current = { mode: 'pan', x: e.clientX, y: e.clientY, view: worldView }
  }

  function handleMouseMove(e) {
    const dragStart = dragStartRef.current
    if (!dragStart) return

    if (dragStart.mode === 'line') {
      const { rect, renderedHeight } = renderedSize()
      const my = (e.clientY - rect.top) * (height / renderedHeight)
      const { y: newY } = screenToWorld(view, 0, my)
      horizontalLine?.onDrag?.(newY)
      return
    }

    // Pan converts a raw clientX/clientY delta (rendered CSS pixels)
    // directly into a fraction of the world range -- that fraction must be
    // taken over the *rendered* size (renderedWidth/Height), not the fixed
    // resolution width/height, or panning would run faster/slower than the
    // cursor once CSS stretches the canvas away from its resolution.
    const { renderedWidth, renderedHeight } = renderedSize()
    const dx = ((e.clientX - dragStart.x) / renderedWidth) * (dragStart.view.xMax - dragStart.view.xMin)
    const dy = ((e.clientY - dragStart.y) / renderedHeight) * (dragStart.view.yMax - dragStart.view.yMin)
    setWorldView({
      xMin: dragStart.view.xMin - dx,
      xMax: dragStart.view.xMax - dx,
      yMin: dragStart.view.yMin + dy,
      yMax: dragStart.view.yMax + dy,
    })
  }

  function handleMouseUp() {
    dragStartRef.current = null
  }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      // Task 17: let the canvas's *rendered* size follow its flex container
      // (width:100%) while keeping its drawing-buffer *resolution* fixed at
      // the width/height attributes above -- aspect ratio is preserved via
      // height:auto. See renderedSize() above for why every handler that
      // touches getBoundingClientRect() has to correct for the resulting
      // rendered-vs-resolution scale.
      style={{ width: '100%', height: 'auto' }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={(e) => onCanvasClick?.(e, view)}
    />
  )
}
