import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SketchLayer } from './SketchLayer'

describe('SketchLayer', () => {
  it('converts a screen stroke into graph-world coordinates', () => {
    const onStrokesChange = vi.fn()
    render(<SketchLayer active strokes={[]} onStrokesChange={onStrokesChange} view={{ xMin: -8, xMax: 8, yMin: -8, yMax: 8 }} label="source graph" />)
    const canvas = screen.getByLabelText('source graph function sketch layer')
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 400 })

    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 200, clientY: 100 })
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 300, clientY: 200 })
    fireEvent.pointerUp(canvas, { pointerId: 1 })

    expect(onStrokesChange.mock.calls.at(-1)[0]).toEqual([
      { points: [{ x: 0, y: 4 }, { x: 4, y: 0 }] },
    ])
  })
})
