import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { InkLayer } from './InkLayer'

function setCanvasRect(canvas) {
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 400 })
  canvas.getContext = () => ({
    beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, clearRect() {}, setTransform() {},
  })
}

describe('InkLayer', () => {
  it('keeps graph navigation active until the user explicitly selects the pen', () => {
    const onStrokesChange = vi.fn()
    render(<InkLayer strokes={[]} onStrokesChange={onStrokesChange} label="source graph" />)
    const canvas = screen.getByLabelText('source graph handwriting layer')
    setCanvasRect(canvas)
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 100, clientY: 100 })
    expect(onStrokesChange).not.toHaveBeenCalled()
  })

  it('records normalized pen points and clears them through the toolbar', () => {
    const onStrokesChange = vi.fn()
    const { rerender } = render(<InkLayer strokes={[]} onStrokesChange={onStrokesChange} label="source graph" />)
    const canvas = screen.getByLabelText('source graph handwriting layer')
    setCanvasRect(canvas)

    fireEvent.click(screen.getByRole('button', { name: 'draw on graph' }))
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 100, clientY: 80 })
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 200, clientY: 160 })
    fireEvent.pointerUp(canvas, { pointerId: 1 })

    const strokes = onStrokesChange.mock.calls.at(-1)[0]
    expect(strokes).toEqual([{ points: [{ x: 0.25, y: 0.2 }, { x: 0.5, y: 0.4 }] }])

    rerender(<InkLayer strokes={strokes} onStrokesChange={onStrokesChange} label="source graph" />)
    fireEvent.click(screen.getByRole('button', { name: 'clear handwriting' }))
    expect(onStrokesChange.mock.calls.at(-1)[0]).toEqual([])
  })

  it('erases only the stroke touched by the eraser', () => {
    const onStrokesChange = vi.fn()
    const strokes = [
      { points: [{ x: 0.2, y: 0.2 }, { x: 0.3, y: 0.3 }] },
      { points: [{ x: 0.8, y: 0.8 }, { x: 0.9, y: 0.9 }] },
    ]
    render(<InkLayer strokes={strokes} onStrokesChange={onStrokesChange} label="source graph" />)
    const canvas = screen.getByLabelText('source graph handwriting layer')
    setCanvasRect(canvas)
    fireEvent.click(screen.getByRole('button', { name: 'erase handwriting' }))
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 82, clientY: 82 })
    expect(onStrokesChange.mock.calls.at(-1)[0]).toEqual([strokes[1]])
  })
})
