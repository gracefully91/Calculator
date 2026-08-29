import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import App from './App'
import { useAppStore } from './state/store'

// App.jsx wires both panels to the same Zustand store (a real module-level
// singleton), so state from one test would otherwise leak into the next --
// mirrors store.test.js's own beforeEach.
beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState())
})

describe('App — responsive layout (Task 17)', () => {
  it('applies the main-row class to the container holding the left Panel and right LinkedFunctionPanel column, with exactly those two as its direct children', () => {
    const { container } = render(<App />)
    const mainRow = container.querySelector('.main-row')
    expect(mainRow).toBeInTheDocument()

    // .main-row > * (App.css) must resolve to exactly two flex items: the
    // left Panel's own root div (containing its canvas) and the right-hand
    // wrapper div (containing the Trace On checkbox + LinkedFunctionPanel's
    // canvas) -- not, say, individual descendants deeper inside either
    // panel, which would make the CSS's `flex: 1 1 400px` target the wrong
    // elements.
    expect(mainRow.children).toHaveLength(2)
    const [leftColumn, rightColumn] = mainRow.children
    expect(leftColumn.querySelector('canvas')).toBeInTheDocument()
    expect(rightColumn.querySelector('canvas')).toBeInTheDocument()
    expect(rightColumn.querySelector('input[type="checkbox"]')).toBeInTheDocument()
  })
})

describe('App — full two-panel layout (Task 15)', () => {
  it('renders both the left Panel and the right LinkedFunctionPanel, plus LinkBar, side by side', () => {
    const { container } = render(<App />)
    const canvases = container.querySelectorAll('.graph-canvas--fallback')
    expect(canvases).toHaveLength(2)
    expect(screen.getByText(/현재 t = 0\.00/)).toBeInTheDocument()
    // Default left piece is `x` over (-inf, inf): y=x=0 crosses y=t=0 once.
    expect(screen.getByText(/h\(0\.00\)\s*=\s*1/)).toBeInTheDocument()
  })

  it('dragging the left y=t line updates the store t, LinkBar, and the right panel h(t) reading together', () => {
    const { container } = render(<App />)
    const leftCanvas = container.querySelectorAll('.graph-canvas--fallback')[0]

    // Same geometry as Panel.test.jsx's horizontalLineT drag test: default
    // 400x400 view -8..8, y=0 line sits at screen y=200; dragging to
    // clientY=100 moves the line to world y=4.
    fireEvent.mouseDown(leftCanvas, { clientX: 200, clientY: 200 })
    fireEvent.mouseMove(leftCanvas, { clientX: 200, clientY: 100 })
    fireEvent.mouseUp(leftCanvas, { clientX: 200, clientY: 100 })

    expect(useAppStore.getState().t).toBeCloseTo(4)
    expect(screen.getByText(/현재 t = 4\.00/)).toBeInTheDocument()
    // Default left piece y=x still crosses y=4 exactly once, at x=4.
    expect(screen.getByText(/h\(4\.00\)\s*=\s*1/)).toBeInTheDocument()
  })

  it('the Trace On checkbox toggles the store\'s traceOn flag', async () => {
    render(<App />)
    expect(useAppStore.getState().traceOn).toBe(false)
    const checkbox = screen.getByRole('checkbox', { name: /trace on/i })
    expect(checkbox).not.toBeChecked()

    fireEvent.click(checkbox)
    expect(useAppStore.getState().traceOn).toBe(true)
    expect(checkbox).toBeChecked()

    fireEvent.click(checkbox)
    expect(useAppStore.getState().traceOn).toBe(false)
    expect(checkbox).not.toBeChecked()
  })

  // End-to-end verification of the 52-problem's core acceptance signal
  // (plan doc: g(-3-)=1, g(-3)=3, g(-3+)=5, sum=9) through the fully wired
  // app -- store holds the parametrized pieces + a/b sliders, exactly as a
  // real user would enter them (Task 18's manual scenario), not the
  // pre-substituted literal pieces rootFinder.test.js/LinkedFunctionPanel.test.jsx
  // already cover at the pure-function/component level.
  it('reproduces the 52-problem g(k-)+g(k)+g(k+)=9 signal at k=-3 end to end through the real store and both rendered panels', () => {
    useAppStore.getState().setLeftPieces([
      { id: 1, expr: '2*x^3-6*x+1', domain: [null, 2], closedAt: { left: null, right: true } },
      { id: 2, expr: 'a*(x-2)*(x-b)+9', domain: [2, null], closedAt: { left: false, right: null } },
    ])
    useAppStore.getState().setParam('a', 3)
    useAppStore.getState().setParam('b', 6)

    useAppStore.getState().setT(-3 - 1e-3)
    render(<App />)
    expect(screen.getByText(/h\(-3\.00\)\s*=\s*1/)).toBeInTheDocument()
  })

  it('shows g(-3)=3 and g(-3+)=5 as t is moved through the store, matching the 52-problem table', () => {
    useAppStore.getState().setLeftPieces([
      { id: 1, expr: '2*x^3-6*x+1', domain: [null, 2], closedAt: { left: null, right: true } },
      { id: 2, expr: 'a*(x-2)*(x-b)+9', domain: [2, null], closedAt: { left: false, right: null } },
    ])
    useAppStore.getState().setParam('a', 3)
    useAppStore.getState().setParam('b', 6)
    useAppStore.getState().setT(-3)

    const { rerender } = render(<App />)
    expect(screen.getByText(/h\(-3\.00\)\s*=\s*3/)).toBeInTheDocument()

    useAppStore.getState().setT(-3 + 1e-3)
    rerender(<App />)
    expect(screen.getByText(/h\(-3\.00\)\s*=\s*5/)).toBeInTheDocument()
  })
})
