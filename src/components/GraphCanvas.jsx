import { useRef, useEffect, useState } from 'react'
import { drawAxes, drawCurve, drawPointMarker } from '../core/canvasRenderer'

const DEFAULT_VIEW = { xMin: -8, xMax: 8, yMin: -8, yMax: 8 }

// curves: [{ fn: (x)=>y, range: {xMin,xMax} }]
// points: [{ x, y, closed }]
// onCanvasClick: (mouseEvent, view) => void — 클릭 좌표를 world 좌표로 바꿀 때 필요한 view를 함께 전달
export function GraphCanvas({ curves, points, width = 400, height = 400, onCanvasClick }) {
  const canvasRef = useRef(null)
  const [worldView, setWorldView] = useState(DEFAULT_VIEW)
  // Drag state must survive re-renders (setWorldView during a drag causes
  // one), so a plain `let` in the component body would be reset to null on
  // every re-render and break the drag after its first mousemove. A ref's
  // identity is stable across renders, so it can safely hold mutable state
  // that isn't itself meant to trigger re-renders.
  const dragStartRef = useRef(null)

  const view = { ...worldView, width, height }

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
    // `view` is a fresh object every render, so listing it as a dep here
    // would make this effect run on every render anyway — same as listing
    // its parts (worldView, width, height) directly, but more honest about
    // what actually needs to change to justify a redraw.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curves, points, worldView, width, height])

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
    dragStartRef.current = { x: e.clientX, y: e.clientY, view: worldView }
  }

  function handleMouseMove(e) {
    const dragStart = dragStartRef.current
    if (!dragStart) return
    const dx = ((e.clientX - dragStart.x) / width) * (dragStart.view.xMax - dragStart.view.xMin)
    const dy = ((e.clientY - dragStart.y) / height) * (dragStart.view.yMax - dragStart.view.yMin)
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
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={(e) => onCanvasClick?.(e, view)}
    />
  )
}
