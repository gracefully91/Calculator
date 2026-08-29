import { useEffect, useRef, useState } from 'react'

const EMPTY_STROKES = []
const ERASER_RADIUS = 0.035

function pointFromEvent(event, canvas) {
  const rect = canvas.getBoundingClientRect()
  // jsdom has no layout; the fallback makes pointer-contract tests use the
  // same 400px coordinate system as GraphCanvas's legacy test canvas.
  const width = rect.width || 400
  const height = rect.height || 400
  return {
    x: Math.max(0, Math.min(1, (event.clientX - rect.left) / width)),
    y: Math.max(0, Math.min(1, (event.clientY - rect.top) / height)),
  }
}

function paintStroke(context, stroke, width, height) {
  if (!stroke.points?.length) return
  context.beginPath()
  stroke.points.forEach((point, index) => {
    const x = point.x * width
    const y = point.y * height
    if (index === 0) context.moveTo(x, y)
    else context.lineTo(x, y)
  })
  context.stroke()
}

function strokeTouches(stroke, point) {
  return stroke.points?.some((candidate) => Math.hypot(candidate.x - point.x, candidate.y - point.y) <= ERASER_RADIUS)
}

/**
 * A screen-space annotation layer. Its normalized coordinates deliberately
 * remain independent from JSXGraph's world coordinates: moving the graph is
 * like moving paper under transparent teacher notes, not moving the notes.
 */
export function InkLayer({ strokes = EMPTY_STROKES, onStrokesChange, label = 'graph' }) {
  const canvasRef = useRef(null)
  const activeStrokeRef = useRef(null)
  const strokesRef = useRef(strokes)
  const [mode, setMode] = useState('navigate')

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
      context.lineCap = 'round'
      context.lineJoin = 'round'
      context.strokeStyle = '#7c3aed'
      context.lineWidth = 3
      strokesRef.current.forEach((stroke) => paintStroke(context, stroke, width, height))
    }

    repaint()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(repaint)
    observer?.observe(canvas)
    return () => observer?.disconnect()
  }, [strokes])

  function commit(next) {
    strokesRef.current = next
    onStrokesChange?.(next)
  }

  function handlePointerDown(event) {
    const canvas = canvasRef.current
    if (!canvas || mode === 'navigate') return
    const point = pointFromEvent(event, canvas)

    if (mode === 'erase') {
      commit(strokesRef.current.filter((stroke) => !strokeTouches(stroke, point)))
      return
    }

    event.preventDefault()
    canvas.setPointerCapture?.(event.pointerId)
    const stroke = { points: [point] }
    activeStrokeRef.current = { pointerId: event.pointerId, stroke }
    commit([...strokesRef.current, stroke])
  }

  function handlePointerMove(event) {
    const active = activeStrokeRef.current
    const canvas = canvasRef.current
    if (!active || active.pointerId !== event.pointerId || !canvas) return
    const nextStroke = { points: [...active.stroke.points, pointFromEvent(event, canvas)] }
    active.stroke = nextStroke
    const next = [...strokesRef.current.slice(0, -1), nextStroke]
    commit(next)
  }

  function finishPointer(event) {
    if (activeStrokeRef.current?.pointerId === event.pointerId) activeStrokeRef.current = null
  }

  return (
    <div className="ink-layer">
      <canvas
        ref={canvasRef}
        className={`ink-layer__canvas${mode === 'navigate' ? '' : ' ink-layer__canvas--active'}`}
        aria-label={`${label} handwriting layer`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
      />
      <div className="ink-toolbar" role="group" aria-label={`${label} handwriting tools`}>
        <button type="button" aria-label="navigate graph" aria-pressed={mode === 'navigate'} onClick={() => setMode('navigate')}>이동</button>
        <button type="button" aria-label="draw on graph" aria-pressed={mode === 'draw'} onClick={() => setMode('draw')}>펜</button>
        <button type="button" aria-label="erase handwriting" aria-pressed={mode === 'erase'} onClick={() => setMode('erase')}>지우개</button>
        <button type="button" aria-label="clear handwriting" disabled={strokes.length === 0} onClick={() => commit([])}>전체 지우기</button>
      </div>
    </div>
  )
}
