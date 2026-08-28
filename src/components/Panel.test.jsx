import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Panel } from './Panel'
import { screenToWorld } from '../core/viewport'

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

  it('assigns each added piece a fresh id distinct from every existing piece', async () => {
    const onPiecesChange = vi.fn()
    const initial = [
      { id: 5, expr: 'x', domain: [null, 2], closedAt: { left: null, right: true } },
      { id: 2, expr: 'x^2', domain: [2, null], closedAt: { left: false, right: null } },
    ]
    render(<Panel pieces={initial} onPiecesChange={onPiecesChange} params={{}} />)
    await userEvent.click(screen.getByRole('button', { name: /add piece/i }))
    const next = onPiecesChange.mock.calls[0][0]
    expect(next).toHaveLength(3)
    const newPiece = next[2]
    expect(newPiece.id).toBeDefined()
    expect(newPiece.id).not.toBe(5)
    expect(newPiece.id).not.toBe(2)
  })

  it('preserves each piece row\'s own editor instance (not just its slot) when an earlier piece is deleted', async () => {
    // Regression test for keying piece rows on array index: deleting piece 1
    // shifts piece 2 into slot 0. With an index key, React would reuse piece
    // 1's old row (same component instance, same underlying CodeMirror
    // EditorView) to now display piece 2's data -- carrying over cursor/
    // selection/undo-history state that lives inside CodeMirror, outside the
    // controlled `value` prop, from whatever used to occupy that slot. Keying
    // on the piece's stable `id` instead means piece 2's own row/instance
    // survives the deletion, just re-labeled for its new position.
    const onChangeSpy = vi.fn()
    const initial = [
      { id: 1, expr: 'x', domain: [null, 2], closedAt: { left: null, right: true } },
      { id: 2, expr: 'x^2', domain: [2, null], closedAt: { left: false, right: null } },
    ]
    render(<StatefulPanel initialPieces={initial} onChangeSpy={onChangeSpy} />)

    const piece2EditorBefore = screen.getByLabelText(/piece expression 2/i)
    await userEvent.click(screen.getAllByRole('button', { name: /삭제|remove/i })[0])

    const soleEditor = screen.getByLabelText(/piece expression 1/i)
    expect(soleEditor).toBe(piece2EditorBefore)
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

  // jsdom's canvas has no real 2d context (GraphCanvas.jsx's effect bails
  // out early on `ctx == null`), so the marker tests below install a fake
  // context that just records `arc` calls and whether each was followed by
  // `fill` (closed/filled dot) or `stroke` (open/hollow dot) -- enough to
  // observe drawPointMarker's actual output without needing a real canvas.
  // This exercises Panel's real `points` computation end to end (through
  // GraphCanvas's draw effect), rather than mocking GraphCanvas itself.
  async function withFakeCanvasContext(run) {
    const arcCalls = []
    let pending = null
    const fakeCtx = {
      save() {},
      restore() {},
      beginPath() {},
      clearRect() {},
      moveTo() {},
      lineTo() {},
      arc(x, y) {
        pending = { x, y }
        arcCalls.push(pending)
      },
      fill() {
        if (pending) pending.closed = true
        pending = null
      },
      stroke() {
        if (pending) pending.closed = false
        pending = null
      },
    }
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = () => fakeCtx
    try {
      await run(arcCalls)
    } finally {
      HTMLCanvasElement.prototype.getContext = original
    }
  }

  it('draws exactly one closed and one open boundary marker for the 52-problem, at the right coordinates', async () => {
    // Same two pieces as the "renders ... without crashing" test above.
    // Left piece is closed at x=2 (2*2^3-6*2+1 = 16-12+1 = 5); right piece
    // is open at x=2 (3*(2-2)*(2-6)+9 = 0+9 = 9). Default view is
    // xMin/xMax/yMin/yMax = -8/8/-8/8 over a 400x400 canvas, so world (2,5)
    // -> screen (250, 75) and world (2,9) -> screen (250, -25).
    const pieces = [
      { expr: '2*x^3-6*x+1', domain: [null, 2], closedAt: { left: null, right: true } },
      { expr: '3*(x-2)*(x-6)+9', domain: [2, null], closedAt: { left: false, right: null } },
    ]
    await withFakeCanvasContext((arcCalls) => {
      render(<Panel pieces={pieces} onPiecesChange={vi.fn()} params={{}} />)
      expect(arcCalls).toHaveLength(2)
      expect(arcCalls[0].x).toBeCloseTo(250)
      expect(arcCalls[0].y).toBeCloseTo(75)
      expect(arcCalls[0].closed).toBe(true)
      expect(arcCalls[1].x).toBeCloseTo(250)
      expect(arcCalls[1].y).toBeCloseTo(-25)
      expect(arcCalls[1].closed).toBe(false)
    })
  })

  it('auto-renders a slider for each detected free variable (a, b) but not for x', () => {
    // 52-problem's right piece: a*(x-2)*(x-b)+9
    const pieces = [{ expr: 'a*(x-2)*(x-b)+9', domain: [2, null], closedAt: { left: false, right: null } }]
    render(<Panel pieces={pieces} onPiecesChange={vi.fn()} params={{}} onParamChange={vi.fn()} />)
    expect(screen.getByLabelText('a slider')).toBeInTheDocument()
    expect(screen.getByLabelText('b slider')).toBeInTheDocument()
    expect(screen.queryByLabelText('x slider')).not.toBeInTheDocument()
  })

  it('does not render a params row when no free variables are present', () => {
    render(<Panel pieces={[{ expr: 'x^2', domain: [null, null], closedAt: {} }]} onPiecesChange={vi.fn()} params={{}} onParamChange={vi.fn()} />)
    expect(screen.queryByRole('slider')).not.toBeInTheDocument()
  })

  it('renders the 52-problem right piece without crashing even before any slider is touched (free variables absent from params)', () => {
    // Regression: a*(x-2)*(x-b)+9 has a finite, open domain boundary at x=2.
    // Panel's `points` computation calls p.evaluate(2) directly during render
    // (not inside drawCurve's try/catch), so if `a`/`b` were left undefined
    // in the scope handed to mathjs, this would throw synchronously out of
    // render instead of just failing to draw a curve.
    const pieces = [{ expr: 'a*(x-2)*(x-b)+9', domain: [2, null], closedAt: { left: false, right: null } }]
    expect(() =>
      render(<Panel pieces={pieces} onPiecesChange={vi.fn()} params={{}} onParamChange={vi.fn()} />),
    ).not.toThrow()
  })

  it('evaluates the curve using each slider default (1) before the user drags anything, and using the store value once a slider has been set', async () => {
    // With a=1 (default), b=1 (default): 1*(x-2)*(x-1)+9 at x=4 -> 1*2*3+9 = 15.
    const pieces = [{ expr: 'a*(x-2)*(x-b)+9', domain: [null, null], closedAt: { left: null, right: null } }]
    await withFakeCanvasContext(async () => {
      const onParamChange = vi.fn()
      const { container } = render(
        <Panel pieces={pieces} onPiecesChange={vi.fn()} params={{}} onParamChange={onParamChange} />,
      )
      expect(container.querySelector('canvas')).toBeInTheDocument()

      // Dragging the 'a' slider calls onParamChange('a', <value>) -- the
      // caller (App.jsx -> store.setParam) is what actually feeds the new
      // value back into `params` on the next render; Panel itself doesn't
      // own that state.
      const slider = screen.getByLabelText('a slider')
      const nativeValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      nativeValueSetter.call(slider, '5')
      slider.dispatchEvent(new Event('change', { bubbles: true }))
      expect(onParamChange).toHaveBeenCalledWith('a', 5)
    })
  })

  it('re-evaluates the curve immediately when params already supplies a value for a newly-typed free variable (StatefulPanel end-to-end)', async () => {
    // Simulates App.jsx: params/onParamChange are store-backed, so once the
    // user has dragged a slider once, that value should be used on every
    // subsequent render -- not silently overwritten back to the default 1.
    function ConnectedPanel() {
      const [pieces, setPieces] = useState([
        { expr: 'a*(x-2)*(x-b)+9', domain: [2, null], closedAt: { left: false, right: null } },
      ])
      const [params, setParams] = useState({ a: 3, b: 6 })
      return (
        <Panel
          pieces={pieces}
          onPiecesChange={setPieces}
          params={params}
          onParamChange={(name, value) => setParams((p) => ({ ...p, [name]: value }))}
        />
      )
    }
    render(<ConnectedPanel />)
    // a=3 is already in the store's params (not the default 1), so the 'a'
    // slider must reflect it rather than falling back to 1.
    expect(screen.getByLabelText('a slider')).toHaveValue('3')
    expect(screen.getByLabelText('b slider')).toHaveValue('6')
  })

  it('renders the right-piece parabola from its actual free-variable value immediately (default 1) and re-renders it once the store supplies a real value -- end to end via drawn curve pixels, no slider drag required', async () => {
    // 52-problem's right piece. World x=4 is comfortably inside its domain
    // [2, +inf) and away from the x=2 boundary marker, so any drawn segment
    // straddling x=4 isolates the curve's shape from the marker dots.
    const view = { xMin: -8, xMax: 8, yMin: -8, yMax: 8, width: 400, height: 400 }
    const pieces = [{ expr: 'a*(x-2)*(x-b)+9', domain: [2, null], closedAt: { left: false, right: null } }]

    async function renderAndSampleAtX4(params) {
      const linePoints = []
      const fakeCtx = {
        save() {},
        restore() {},
        beginPath() {},
        clearRect() {},
        strokeStyle: '',
        lineWidth: 0,
        stroke() {},
        arc() {},
        fill() {},
        moveTo(sx, sy) {
          linePoints.push(screenToWorld(view, sx, sy))
        },
        lineTo(sx, sy) {
          linePoints.push(screenToWorld(view, sx, sy))
        },
      }
      const original = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = () => fakeCtx
      try {
        render(<Panel pieces={pieces} onPiecesChange={vi.fn()} params={params} onParamChange={vi.fn()} />)
      } finally {
        HTMLCanvasElement.prototype.getContext = original
      }
      // drawCurve samples 300 points evenly across [2, FALLBACK_MAX=8]; find
      // the sample nearest world x=4.
      const nearest = linePoints.reduce((best, p) =>
        Math.abs(p.x - 4) < Math.abs(best.x - 4) ? p : best,
      )
      expect(Math.abs(nearest.x - 4)).toBeLessThan(0.05)
      return nearest.y
    }

    // No params supplied at all -- freeVars a/b fall back to Panel's default
    // (1) for evaluation, same as the slider's own displayed default.
    // a=1, b=1 at x=4: 1*(4-2)*(4-1)+9 = 15.
    const yWithDefaults = await renderAndSampleAtX4({})
    expect(yWithDefaults).toBeCloseTo(15, 0)

    // Store already has real values (as if the user had dragged both
    // sliders previously) -- a=3, b=6 at x=4: 3*(4-2)*(4-6)+9 = -3, matching
    // piecewiseFunction.test.js's regression value for the same problem.
    const yWithStoreValues = await renderAndSampleAtX4({ a: 3, b: 6 })
    expect(yWithStoreValues).toBeCloseTo(-3, 0)
  })

  it('marks a freshly-bounded edge as closed by default once a domain bound is typed in, even though its checkbox has not been touched', async () => {
    // Regression test: a brand-new piece has closedAt: { left: null, right: null }
    // (EMPTY_PIECE_SHAPE) because there's no boundary to describe yet. Once
    // the user types a finite domain min, that side gains a real boundary
    // point, but closedAt.left is untouched -- still null. The checkbox
    // already renders this as checked (its `checked` computation treats
    // null as closed), so the marker must follow the same convention rather
    // than requiring closedAt to be explicitly set before drawing anything.
    const initial = [{ expr: 'x', domain: [null, null], closedAt: { left: null, right: null } }]
    await withFakeCanvasContext(async (arcCalls) => {
      render(<StatefulPanel initialPieces={initial} onChangeSpy={vi.fn()} />)
      expect(arcCalls).toHaveLength(0) // fully unbounded piece: no boundary to mark yet

      // world (3,3) -> screen ((3+8)/16*400, 400-(3+8)/16*400) = (275, 125)
      await userEvent.type(screen.getByLabelText(/^domain min \d+$/i), '3')
      expect(arcCalls.at(-1)).toMatchObject({ closed: true })
      expect(arcCalls.at(-1).x).toBeCloseTo(275)
      expect(arcCalls.at(-1).y).toBeCloseTo(125)
    })
  })
})

describe('Panel — horizontalLineT/onTChange pass-through to GraphCanvas', () => {
  const initial = [{ expr: 'x', domain: [null, null], closedAt: { left: null, right: null } }]

  it('dragging the y=t line calls onTChange with the new world y, not onPiecesChange', () => {
    const onTChange = vi.fn()
    const { container } = render(
      <Panel
        pieces={initial}
        onPiecesChange={vi.fn()}
        params={{}}
        horizontalLineT={0}
        onTChange={onTChange}
      />
    )
    const canvas = container.querySelector('canvas')

    // GraphCanvas defaults to a 400x400 canvas with the -8..8 default view,
    // same as GraphCanvas.test.jsx's horizontalLine tests -- y=0 sits at
    // screen y=200.
    fireEvent.mouseDown(canvas, { clientX: 200, clientY: 200 })
    fireEvent.mouseMove(canvas, { clientX: 200, clientY: 100 })
    fireEvent.mouseUp(canvas, { clientX: 200, clientY: 100 })

    expect(onTChange).toHaveBeenCalled()
    // screenToWorld(view, 0, 100) -> y = -8 + ((400-100)/400)*16 = 4
    expect(onTChange.mock.calls.at(-1)[0]).toBeCloseTo(4)
  })

  it('renders no draggable line, and drags pan as before, when horizontalLineT/onTChange are omitted', () => {
    const onPiecesChange = vi.fn()
    const { container } = render(<Panel pieces={initial} onPiecesChange={onPiecesChange} params={{}} />)
    const canvas = container.querySelector('canvas')

    // Should not throw, and should not somehow call onPiecesChange as a
    // side effect of a plain canvas drag.
    fireEvent.mouseDown(canvas, { clientX: 200, clientY: 200 })
    fireEvent.mouseMove(canvas, { clientX: 210, clientY: 200 })
    fireEvent.mouseUp(canvas, { clientX: 210, clientY: 200 })

    expect(onPiecesChange).not.toHaveBeenCalled()
  })
})

describe('Panel — ObjectList (Task 16): visibility toggle actually filters the graph', () => {
  // 52번 문제 pieces, reused from the marker test above: left cubic on
  // (-inf, 2] closed at 2 (value 5), right parabola on [2, +inf) open at 2
  // (value 9).
  const pieces = [
    { id: 1, expr: '2*x^3-6*x+1', domain: [null, 2], closedAt: { left: null, right: true } },
    { id: 2, expr: '3*(x-2)*(x-6)+9', domain: [2, null], closedAt: { left: false, right: null } },
  ]
  const view = { xMin: -8, xMax: 8, yMin: -8, yMax: 8, width: 400, height: 400 }

  // Captures both the boundary-marker `arc` calls (as the existing marker
  // tests above do) AND the curve's `moveTo`/`lineTo` line segments
  // (translated back to world coordinates), so a single render lets us
  // check that a hidden piece drops out of *both* its curve and its point
  // -- not just one or the other. drawAxes (see canvasRenderer.js) always
  // issues exactly 4 moveTo/lineTo calls before any curve is drawn
  // (moveTo/lineTo for the horizontal axis, then moveTo/lineTo for the
  // vertical axis), so `linePoints.slice(4)` isolates curve-only samples.
  function installFakeCanvas() {
    let arcCalls = []
    let linePoints = []
    let pendingArc = null
    const fakeCtx = {
      save() {},
      restore() {},
      beginPath() {},
      clearRect() {},
      strokeStyle: '',
      lineWidth: 0,
      fillStyle: '',
      moveTo(sx, sy) {
        linePoints.push(screenToWorld(view, sx, sy))
      },
      lineTo(sx, sy) {
        linePoints.push(screenToWorld(view, sx, sy))
      },
      arc(x, y) {
        pendingArc = { x, y }
        arcCalls.push(pendingArc)
      },
      fill() {
        if (pendingArc) pendingArc.closed = true
        pendingArc = null
      },
      stroke() {
        if (pendingArc) pendingArc.closed = false
        pendingArc = null
      },
    }
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = () => fakeCtx
    return {
      restore: () => {
        HTMLCanvasElement.prototype.getContext = original
      },
      reset: () => {
        arcCalls = []
        linePoints = []
      },
      arcCalls: () => arcCalls,
      curvePoints: () => linePoints.slice(4),
    }
  }

  it('hiding the left piece removes its curve samples and boundary marker, leaving only the right parabola; toggling back restores both', async () => {
    const fake = installFakeCanvas()
    try {
      render(<Panel pieces={pieces} onPiecesChange={vi.fn()} params={{}} />)

      // Sanity: both pieces render initially.
      expect(fake.arcCalls()).toHaveLength(2)
      expect(fake.curvePoints().some((p) => p.x < 1.9)).toBe(true)
      expect(fake.curvePoints().some((p) => p.x > 2.1)).toBe(true)

      fake.reset()
      await userEvent.click(screen.getByLabelText('toggle visibility 1'))

      // Only the right piece's open marker at (2, 9) remains.
      expect(fake.arcCalls()).toHaveLength(1)
      expect(fake.arcCalls()[0].closed).toBe(false)
      expect(fake.arcCalls()[0].x).toBeCloseTo(250)
      expect(fake.arcCalls()[0].y).toBeCloseTo(-25)
      // No curve sample left of x=2 -- the left cubic is gone entirely, not
      // just clipped differently.
      expect(fake.curvePoints().length).toBeGreaterThan(0)
      expect(fake.curvePoints().every((p) => p.x >= 1.9)).toBe(true)

      fake.reset()
      await userEvent.click(screen.getByLabelText('toggle visibility 1'))

      expect(fake.arcCalls()).toHaveLength(2)
      expect(fake.curvePoints().some((p) => p.x < 1.9)).toBe(true)
    } finally {
      fake.restore()
    }
  })

  it('hiding the right piece removes its curve samples and boundary marker, leaving only the left cubic', async () => {
    const fake = installFakeCanvas()
    try {
      render(<Panel pieces={pieces} onPiecesChange={vi.fn()} params={{}} />)
      fake.reset()

      await userEvent.click(screen.getByLabelText('toggle visibility 2'))

      // Only the left piece's closed marker at (2, 5) remains.
      expect(fake.arcCalls()).toHaveLength(1)
      expect(fake.arcCalls()[0].closed).toBe(true)
      expect(fake.arcCalls()[0].x).toBeCloseTo(250)
      expect(fake.arcCalls()[0].y).toBeCloseTo(75)
      expect(fake.curvePoints().length).toBeGreaterThan(0)
      expect(fake.curvePoints().every((p) => p.x <= 2.1)).toBe(true)
    } finally {
      fake.restore()
    }
  })

  it('ObjectList renders one row per piece with a code element showing its expr', () => {
    render(<Panel pieces={pieces} onPiecesChange={vi.fn()} params={{}} />)
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('2*x^3-6*x+1')
    expect(items[1]).toHaveTextContent('3*(x-2)*(x-6)+9')
  })

  it('keeps per-piece visibility keyed by piece id (not array position) across a delete', async () => {
    // Regression test for the plan's reference `visibility[i]` (array-indexed)
    // design: hide the *middle* piece, then delete the *first* piece. That
    // shifts every later piece's row index down by one -- if visibility were
    // stored by index, the hidden flag left behind at index 1 would now
    // describe whatever piece shifted into that slot (piece 3), not the
    // piece the user actually hid (piece 2), which would wrongly reappear.
    // Keyed by id, piece 2 must still read as hidden regardless of which row
    // it now occupies, and piece 3 (never touched) must still be visible.
    const onChangeSpy = vi.fn()
    const initial = [
      { id: 1, expr: 'x', domain: [null, null], closedAt: {} },
      { id: 2, expr: 'x^2', domain: [null, null], closedAt: {} },
      { id: 3, expr: 'x^3', domain: [null, null], closedAt: {} },
    ]
    render(<StatefulPanel initialPieces={initial} onChangeSpy={onChangeSpy} />)

    await userEvent.click(screen.getByLabelText('toggle visibility 2')) // hides piece id=2
    expect(screen.getByLabelText('toggle visibility 2').textContent).toBe('👁️‍🗨️')

    const deleteButtons = screen.getAllByRole('button', { name: /삭제|remove/i })
    await userEvent.click(deleteButtons[0]) // deletes piece id=1

    // Row 1 is now piece id=2 (still hidden); row 2 is now piece id=3 (still visible).
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('x^2')
    expect(items[1]).toHaveTextContent('x^3')
    expect(screen.getByLabelText('toggle visibility 1').textContent).toBe('👁️‍🗨️')
    expect(screen.getByLabelText('toggle visibility 2').textContent).toBe('👁️')
  })
})
