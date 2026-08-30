import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProblemImportAssistant } from './ProblemImportAssistant'

describe('ProblemImportAssistant', () => {
  it('shows an explicit graph application action only for a valid LLM analysis', async () => {
    const onApply = vi.fn()
    render(<ProblemImportAssistant onApply={onApply} />)
    fireEvent.click(screen.getByText('LLM 문제 분석 가져오기'))
    fireEvent.change(screen.getByLabelText('LLM problem analysis response'), { target: { value: '{"left":{"pieces":[{"expr":"x^2","domain":[null,null],"closedAt":{}}]},"right":{"mode":"derivative"},"parameters":{},"t":0}' } })

    await userEvent.click(screen.getByRole('button', { name: '그래프에 적용' }))

    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ rightMode: 'derivative', t: 0 }))
  })
})
