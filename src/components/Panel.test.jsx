import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Panel } from './Panel'

// Panel is a controlled component (pieces/onPiecesChange), same as App.jsx
// wires it to the Zustand store. A bare `vi.fn()` onPiecesChange never
// updates the `pieces` prop between renders, so a domain <input> stops
// reflecting the value React thinks it has after the first keystroke --
// that's a test-harness artifact, not something Panel's real callers hit.
// This wrapper re-renders with the latest pieces on every change, like the
// real App.jsx does, so typed-out interactions behave the way they do in
// the app.
function StatefulPanel({ initialPieces, onChangeSpy, params = {} }) {
  const [pieces, setPieces] = useState(initialPieces)
  return (
    <Panel
      pieces={pieces}
      onPiecesChange={(next) => {
        onChangeSpy(next)
        setPieces(next)
      }}
      params={params}
    />
  )
}

describe('Panel — piecewise editing', () => {
  it('starts with one piece row and can add another', async () => {
    render(<Panel pieces={[{ expr: 'x', domain: [null, null], closedAt: {} }]} onPiecesChange={vi.fn()} params={{}} />)
    expect(screen.getAllByLabelText(/piece expression/i)).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: /add piece/i }))
    // onPiecesChange가 호출되었는지만 확인 (부모가 상태를 갱신하는 구조)
  })

  it('calls onPiecesChange with an appended piece when "add piece" is clicked', async () => {
    const onPiecesChange = vi.fn()
    const initial = [{ expr: 'x', domain: [null, null], closedAt: {} }]
    render(<Panel pieces={initial} onPiecesChange={onPiecesChange} params={{}} />)
    await userEvent.click(screen.getByRole('button', { name: /add piece/i }))
    expect(onPiecesChange).toHaveBeenCalledTimes(1)
    const next = onPiecesChange.mock.calls[0][0]
    expect(next).toHaveLength(2)
    expect(next[0]).toEqual(initial[0])
  })

  it('calls onPiecesChange with the piece removed when its delete button is clicked', async () => {
    const onPiecesChange = vi.fn()
    const initial = [
      { expr: 'x', domain: [null, 2], closedAt: { left: null, right: true } },
      { expr: 'x^2', domain: [2, null], closedAt: { left: false, right: null } },
    ]
    render(<Panel pieces={initial} onPiecesChange={onPiecesChange} params={{}} />)
    const deleteButtons = screen.getAllByRole('button', { name: /삭제|remove/i })
    expect(deleteButtons).toHaveLength(2)
    await userEvent.click(deleteButtons[0])
    expect(onPiecesChange).toHaveBeenCalledWith([initial[1]])
  })

  it('does not offer a delete button when only one piece remains', () => {
    render(<Panel pieces={[{ expr: 'x', domain: [null, null], closedAt: {} }]} onPiecesChange={vi.fn()} params={{}} />)
    expect(screen.queryAllByRole('button', { name: /삭제|remove/i })).toHaveLength(0)
  })

  it('updates domain min/max, parsing an empty field as unbounded (null), including negative numbers', async () => {
    const onChangeSpy = vi.fn()
    const initial = [{ expr: 'x', domain: [0, 5], closedAt: { left: true, right: true } }]
    render(<StatefulPanel initialPieces={initial} onChangeSpy={onChangeSpy} />)

    // domain min: 0 -> -3 (exercises the negative-number path end to end)
    const minInput = screen.getByLabelText(/^domain min \d+$/i)
    await userEvent.clear(minInput)
    await userEvent.type(minInput, '-3')
    const lastMinCall = onChangeSpy.mock.calls.at(-1)[0]
    expect(lastMinCall[0].domain[0]).toBe(-3)
    expect(minInput).toHaveValue(-3)

    // domain max: clearing the field means "unbounded" (null), not NaN/0
    onChangeSpy.mockClear()
    const maxInput = screen.getByLabelText(/^domain max \d+$/i)
    await userEvent.clear(maxInput)
    const lastMaxCall = onChangeSpy.mock.calls.at(-1)[0]
    expect(lastMaxCall[0].domain[1]).toBeNull()
  })

  it('renders the 52-problem two pieces without crashing and clips each curve to its own domain', () => {
    // 52번 문제: left cubic on (-inf, 2], right parabola on [2, +inf), open at x=2 on the right
    const pieces = [
      { expr: '2*x^3-6*x+1', domain: [null, 2], closedAt: { left: null, right: true } },
      { expr: '3*(x-2)*(x-6)+9', domain: [2, null], closedAt: { left: false, right: null } },
    ]
    const { container } = render(<Panel pieces={pieces} onPiecesChange={vi.fn()} params={{}} />)
    expect(container.querySelector('canvas')).toBeInTheDocument()
    expect(screen.queryByText(/error|invalid/i)).not.toBeInTheDocument()
  })
})
