import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { useAppStore } from './state/store'
import { screenToWorld, worldToScreen } from './core/viewport'

// Task 18: the plan's own manual scenario, driven through the REAL <App/>
// via the same affordances a person would use -- typing into the actual
// CodeMirror EquationInput editors, ticking real domain-boundary checkboxes,
// dragging real range-slider inputs, and mouse-dragging the real y=t line on
// the real GraphCanvas -- rather than calling store setters directly (that
// version already exists at the bottom of App.test.jsx, covering the same
// numeric acceptance signal but constructing state directly instead of
// driving the UI). This file is the "an actual person doing exactly what
// Step 1 says" pass, as close as jsdom/RTL gets without a real browser.
//
// App.jsx wires both panels to the same Zustand store (a real module-level
// singleton), so state from one test would otherwise leak into the next --
// mirrors store.test.js's/App.test.jsx's own beforeEach.
beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState())
})

// GraphCanvas's default viewport/resolution (see GraphCanvas.jsx's
// DEFAULT_VIEW and default width/height props). Neither panel is panned or
// zoomed anywhere in this scenario, so this is the coordinate space both
// canvases actually draw in throughout the whole test.
const VIEW = { xMin: -8, xMax: 8, yMin: -8, yMax: 8, width: 400, height: 400 }

// jsdom's canvas has no real 2d context (GraphCanvas.jsx's draw effect bails
// out on `ctx == null`), so -- same technique as Panel.test.jsx and
// LinkedFunctionPanel.test.jsx -- this installs a fake context that records
// arc()/fill()/stroke() (point markers) and moveTo()/lineTo() (curve/line
// segments). Unlike those single-canvas tests, App renders TWO canvases at
// once (the left Panel's and the right LinkedFunctionPanel's), so this
// keeps a separate recorder PER <canvas> element (keyed by the element
// itself) instead of one shared array -- otherwise the left panel's
// boundary markers and the right panel's trace points would land in the
// same list with no way to tell which canvas drew what.
//
// Each recorder resets on clearRect (the first call GraphCanvas.jsx's draw
// effect makes every render) so a recorder's contents always reflect only
// the most recently completed draw for that canvas -- matching what would
// actually be visible on screen at any instant, not an accumulation across
// every intermediate re-render a multi-keystroke edit or a multi-step drag
// produces along the way.
function installFakeCanvas() {
  const perCanvas = new WeakMap()
  function recorderFor(canvas) {
    if (!perCanvas.has(canvas)) {
      const state = { arcCalls: [], linePoints: [] }
      let pendingArc = null
      const ctx = {
        save() {},
        restore() {},
        beginPath() {},
        clearRect() {
          state.arcCalls.length = 0
          state.linePoints.length = 0
        },
        moveTo(sx, sy) {
          state.linePoints.push({ sx, sy })
        },
        lineTo(sx, sy) {
          state.linePoints.push({ sx, sy })
        },
        setLineDash() {},
        strokeStyle: '',
        fillStyle: '',
        lineWidth: 0,
        arc(x, y) {
          pendingArc = { x, y }
          state.arcCalls.push(pendingArc)
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
      perCanvas.set(canvas, { ctx, state })
    }
    return perCanvas.get(canvas)
  }
  const original = HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext = function fakeGetContext() {
    return recorderFor(this).ctx
  }
  return {
    restore() {
      HTMLCanvasElement.prototype.getContext = original
    },
    stateFor(canvas) {
      return recorderFor(canvas).state
    },
  }
}

// Screen-space y (resolution pixels) that GraphCanvas's horizontalLine sits
// at for a given world t, in the default VIEW -- used to compute clientY for
// each step of the simulated drag below.
function screenYForT(t) {
  return worldToScreen(VIEW, 0, t).y
}

describe('Task 18 — end-to-end verification against the 52-problem, driven through the real UI', () => {
  it('reproduces every step of the plan\'s manual scenario through real typing, checkbox clicks, slider drags, and a mouse-dragged y=t line', async () => {
    const user = userEvent.setup()
    const fakeCanvas = installFakeCanvas()

    try {
      // ---- Step 1: the app boots ----
      const { container } = render(<App />)
      const canvases = container.querySelectorAll('.graph-canvas--fallback')
      expect(canvases).toHaveLength(2)
      const [leftCanvas, rightCanvas] = canvases

      // ---- Step 2: enter both pieces via the real left-panel UI ----

      // Piece 1 starts out as the store's default 'x' -- replace it with the
      // 52-problem's left cubic by focusing the real CodeMirror editor,
      // selecting all, and typing the new text, exactly like a person
      // editing an existing formula would.
      const expr1 = screen.getByLabelText('piece expression 1')
      await user.click(expr1)
      await user.keyboard('{Control>}a{/Control}{Backspace}')
      await user.type(expr1, '2*x^3-6*x+1')

      const domainMax1 = screen.getByLabelText('domain max 1')
      await user.type(domainMax1, '2')
      // "오른쪽 닫힘": Panel.jsx defaults a freshly-bounded edge's checkbox to
      // checked (closedAt.right is still null, and null !== false reads as
      // closed) -- confirm the real checkbox already reflects that instead
      // of assuming it, since the scenario depends on this being correct.
      expect(screen.getByLabelText('closed at max 1')).toBeChecked()

      await user.click(screen.getByRole('button', { name: 'add piece' }))

      const expr2 = screen.getByLabelText('piece expression 2')
      await user.click(expr2)
      await user.keyboard('{Control>}a{/Control}{Backspace}')
      await user.type(expr2, 'a*(x-2)*(x-b)+9')

      const domainMin2 = screen.getByLabelText('domain min 2')
      await user.type(domainMin2, '2')
      // "왼쪽 열림": this checkbox also defaults to checked once a bound is
      // typed -- must be explicitly unchecked via a real click to make the
      // boundary open, same as a person would.
      const closedMin2 = screen.getByLabelText('closed at min 2')
      expect(closedMin2).toBeChecked()
      await user.click(closedMin2)
      expect(closedMin2).not.toBeChecked()

      // closedAt.right stays `null` (not `true`) here -- the checkbox was
      // already checked by Panel's own default (see the assertion above),
      // and a real user does not click a box that already shows what they
      // want, so it's never touched. `null` and `true` are equivalent
      // everywhere this is read (Panel's own `checked` computation,
      // piecewiseFunction.js's contains(), functionSchema.js's overlap
      // check all treat "not explicitly false" as closed -- see those
      // files' own comments), so this is the actual, correct end state, not
      // an assertion gap.
      const [storedPiece1, storedPiece2] = useAppStore.getState().leftPieces
      expect(storedPiece1).toMatchObject({ expr: '2*x^3-6*x+1', domain: [null, 2] })
      expect(storedPiece1.closedAt.right).not.toBe(false)
      expect(storedPiece2).toMatchObject({
        expr: 'a*(x-2)*(x-b)+9',
        domain: [2, null],
        closedAt: { left: false, right: null },
      })

      // ---- Step 3: the a/b sliders auto-appear; set a=3, b=6 ----
      const aSlider = await screen.findByLabelText('a slider')
      const bSlider = await screen.findByLabelText('b slider')
      // userEvent doesn't drive <input type="range"> realistically (same
      // documented limitation ParamSliders.test.jsx works around) -- set the
      // value through the native setter, then dispatch the 'change' event
      // React's real onChange listener is wired to, so this still goes
      // through the actual ParamSliders -> Panel -> App -> store.setParam
      // path rather than calling setParam directly.
      const nativeValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      nativeValueSetter.call(aSlider, '3')
      aSlider.dispatchEvent(new Event('change', { bubbles: true }))
      nativeValueSetter.call(bSlider, '6')
      bSlider.dispatchEvent(new Event('change', { bubbles: true }))

      expect(useAppStore.getState().params).toEqual({ a: 3, b: 6 })
      expect(aSlider).toHaveValue('3')
      expect(bSlider).toHaveValue('6')

      // ---- Step 4: closed marker (left piece) and open marker (right
      // piece) both render at x=2 on the left graph ----
      // Left piece at x=2: 2*8-12+1 = 5 (closed). Right piece at x=2:
      // a*0*(2-b)+9 = 9 regardless of a/b (open) -- same coordinates
      // Panel.test.jsx's own Task-12 marker test already pins down
      // (screen (250,75) closed, (250,-25) open), reproduced here through
      // the fully assembled app instead of a bare <Panel/>.
      const leftState = fakeCanvas.stateFor(leftCanvas)
      const screenX2 = worldToScreen(VIEW, 2, 0).x
      const markersAtX2 = leftState.arcCalls.filter((m) => Math.abs(m.x - screenX2) < 1)
      expect(markersAtX2).toHaveLength(2)
      const closedMarker = markersAtX2.find((m) => m.closed)
      const openMarker = markersAtX2.find((m) => !m.closed)
      expect(closedMarker).toBeDefined()
      expect(openMarker).toBeDefined()
      expect(closedMarker.y).toBeCloseTo(worldToScreen(VIEW, 2, 5).y)
      expect(openMarker.y).toBeCloseTo(worldToScreen(VIEW, 2, 9).y)

      // ---- Step 5: Trace On, then drag y=t from t=-6 to t=6 ----
      const traceCheckbox = screen.getByRole('checkbox', { name: /trace on/i })
      expect(traceCheckbox).not.toBeChecked()
      await user.click(traceCheckbox)
      expect(traceCheckbox).toBeChecked()
      expect(useAppStore.getState().traceOn).toBe(true)

      // A real mousedown/mousemove*/mouseup drag sequence on the left
      // canvas -- not a direct setT call. mousedown lands within
      // GraphCanvas's 8px hit threshold of the y=0 line (t starts at the
      // store's default 0), which is what puts the whole gesture into
      // "line drag" mode (see GraphCanvas.jsx's handleMouseDown).
      fireEvent.mouseDown(leftCanvas, { clientX: 200, clientY: screenYForT(0) })

      // "천천히 드래그": many small steps rather than one jump, sweeping the
      // whole range the scenario calls for while bracketing t=-3 tightly
      // enough (±1e-3) to catch the exact 1 -> 3 -> 5 step described in
      // Step 6/7 (matches rootFinder.test.js's own regression tolerance for
      // the identical signal).
      const preSteps = [-6, -5.5, -5, -4.5, -4, -3.5]
      for (const t of preSteps) {
        fireEvent.mouseMove(leftCanvas, { clientX: 200, clientY: screenYForT(t) })
      }

      fireEvent.mouseMove(leftCanvas, { clientX: 200, clientY: screenYForT(-3 - 1e-3) })
      expect(useAppStore.getState().t).toBeCloseTo(-3 - 1e-3)
      expect(screen.getByText(/h\(-3\.00\)\s*=\s*1/)).toBeInTheDocument()

      // ---- Step 7: h(-3) reads exactly 3 while dragging through t=-3 ----
      fireEvent.mouseMove(leftCanvas, { clientX: 200, clientY: screenYForT(-3) })
      expect(useAppStore.getState().t).toBeCloseTo(-3)
      expect(screen.getByText(/h\(-3\.00\)\s*=\s*3/)).toBeInTheDocument()

      fireEvent.mouseMove(leftCanvas, { clientX: 200, clientY: screenYForT(-3 + 1e-3) })
      expect(useAppStore.getState().t).toBeCloseTo(-3 + 1e-3)
      expect(screen.getByText(/h\(-3\.00\)\s*=\s*5/)).toBeInTheDocument()

      const postSteps = [-3, -2.5, -2, -1, 0, 1, 2, 3, 4, 5, 6]
      for (const t of postSteps) {
        fireEvent.mouseMove(leftCanvas, { clientX: 200, clientY: screenYForT(t) })
      }
      fireEvent.mouseUp(leftCanvas, { clientX: 200, clientY: screenYForT(6) })
      expect(useAppStore.getState().t).toBeCloseTo(6)

      // ---- Step 6: the right panel's trace shows the 1 -> 3 -> 5 step at
      // t=-3, reconstructed from the actual canvas draw calls (not from
      // LinkedFunctionPanel's internal React state) ----
      const rightState = fakeCanvas.stateFor(rightCanvas)
      const worldTrace = rightState.arcCalls
        .map((m) => screenToWorld(VIEW, m.x, m.y))
        .sort((p, q) => p.x - q.x)

      function countNear(t) {
        const nearest = worldTrace.reduce((best, p) => (Math.abs(p.x - t) < Math.abs(best.x - t) ? p : best))
        expect(Math.abs(nearest.x - t)).toBeLessThan(1e-2)
        return Math.round(nearest.y)
      }

      expect(countNear(-3 - 1e-3)).toBe(1)
      expect(countNear(-3)).toBe(3)
      expect(countNear(-3 + 1e-3)).toBe(5)
      // The trace persisted across the whole drag (not just the three
      // points right at the boundary) -- e.g. it still holds the very first
      // point recorded (t=-6) and the very last (t=6).
      expect(worldTrace[0].x).toBeCloseTo(-6, 1)
      expect(worldTrace.at(-1).x).toBeCloseTo(6, 1)
    } finally {
      fakeCanvas.restore()
    }
  }, 10000)
})
