import { useEffect, useRef } from 'react'

const EMPTY_STROKES = []

function localPoint(point, view, width, height) {
  return {
    x: ((point.x - view.xMin) / (view.xMax - view.xMin)) * width,
    y: ((view.yMax - point.y) / (view.yMax - view.yMin)) * height,
  }
}

function worldPoint(event, canvas, view) {
  const rect = canvas.getBoundingClientRect()
  const width = rect.width || 400
  const height = rect.height || 400
  const u = Math.max(0, Math.min(1, (event.clientX - rect.left) / width))
  const v = Math.max(0, Math.min(1, (event.clientY - rect.top) / height))
  return {
    x: view.xMin + u * (view.xMax - view.xMin),
    y: view.yMax - v * (view.yMax - view.yMin),
  }
}

/** Captures a proposed mathematical curve in world coordinates, unlike InkLayer's annotation pixels. */
export function SketchLayer({ active, strokes = EMPTY_STROKES, onStrokesChange, view, label = 'graph' }) {
  const canvasRef = useRef(null)
  const activeStrokeRef = useRef(null)
  const strokesRef = useRef(strokes)

  useEffect(() => {
    strokesRef.current = strokes
  }, [strokes])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    function repaint() {
      const rect = canvas.getBoundingClientRect()
      const width = rect.width || 400
      const height = rect.height || 400
      const ratio = window.devicePixelRatio || 1
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      const context = canvas.getContext('2d')
      if (!context) return
      context.setTransform?.(ratio, 0, 0, ratio, 0, 0)
      context.clearRect(0, 0, width, height)
      context.strokeStyle = '#f97316'
      context.lineWidth = 3
      context.lineJoin = 'round'
      context.lineCap = 'round'
      strokesRef.current.forEach((stroke) => {
        if (!stroke.points?.length) return
        context.beginPath()
        stroke.points.forEach((point, index) => {
          const local = localPoint(point, view, width, height)
          if (index === 0) context.moveTo(local.x, local.y)
          else context.lineTo(local.x, local.y)
        })
        context.stroke()
      })
    }

    repaint()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(repaint)
    observer?.observe(canvas)
    return () => observer?.disconnect()
  }, [strokes, view])

  function commit(next) {
    strokesRef.current = next
    onStrokesChange?.(next)
  }

  function handlePointerDown(event) {
    const canvas = canvasRef.current
    if (!active || !canvas) return
    event.preventDefault()
    canvas.setPointerCapture?.(event.pointerId)
    const stroke = { points: [worldPoint(event, canvas, view)] }
    activeStrokeRef.current = { pointerId: event.pointerId, stroke }
    commit([...strokesRef.current, stroke])
  }

  function handlePointerMove(event) {
    const activeStroke = activeStrokeRef.current
    const canvas = canvasRef.current
    if (!activeStroke || activeStroke.pointerId !== event.pointerId || !canvas) return
    const stroke = { points: [...activeStroke.stroke.points, worldPoint(event, canvas, view)] }
    activeStroke.stroke = stroke
    commit([...strokesRef.current.slice(0, -1), stroke])
  }

  function finishPointer(event) {
    if (activeStrokeRef.current?.pointerId === event.pointerId) activeStrokeRef.current = null
  }

  return (
    <div className={`sketch-layer${active ? ' sketch-layer--active' : ''}`} aria-hidden={!active}>
      <canvas ref={canvasRef} className="sketch-layer__canvas" aria-label={`${label} function sketch layer`} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={finishPointer} onPointerCancel={finishPointer} />
      {active && <p className="sketch-layer__hint">함수 개형을 한 번에 그려 보세요</p>}
    </div>
  )
}
