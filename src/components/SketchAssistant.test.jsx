import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SketchAssistant } from './SketchAssistant'

const strokes = [{ points: [{ x: -2, y: 4 }, { x: 0, y: 0 }, { x: 2, y: 4 }] }]

describe('SketchAssistant', () => {
  it('offers a local polynomial correction without requiring any LLM', async () => {
    const onApply = vi.fn()
    render(<SketchAssistant strokes={strokes} onClear={vi.fn()} onApply={onApply} />)

    await userEvent.click(screen.getByRole('button', { name: '자동 보정 식 적용' }))

    expect(onApply).toHaveBeenCalledWith([
      expect.objectContaining({ expr: expect.stringContaining('x^2'), domain: [-2, 2] }),
    ])
  })

  it('only offers application after a pasted LLM response passes math validation', async () => {
    const onApply = vi.fn()
    render(<SketchAssistant strokes={strokes} onClear={vi.fn()} onApply={onApply} />)

    const response = screen.getByLabelText('LLM function response')
    fireEvent.change(response, { target: { value: '{"pieces":[{"expr":"x^2","domain":[-2,2],"closedAt":{}}]}' } })

    expect(screen.getByText('미리보기')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '이 식 적용' }))
    expect(onApply).toHaveBeenCalledWith([
      { expr: 'x^2', domain: [-2, 2], independent: false, closedAt: { left: null, right: null } },
    ])
  })
})
