import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LinkedFunctionPanel } from './LinkedFunctionPanel'

const pieces = [
  { expr: '2*x^3-6*x+1', domain: [null, 2], closedAt: { left: null, right: true } },
  { expr: '3*(x-2)*(x-6)+9', domain: [2, null], closedAt: { left: false, right: null } },
]

// jsdom's canvas has no real 2d context, so GraphCanvas's draw effect bails
// out on `ctx == null`. These tests install a fake context (same pattern as
// Panel.test.jsx) so we can observe how many point markers LinkedFunctionPanel
// actually hands GraphCanvas -- e.g. to verify trace accumulation.
async function withFakeCanvasContext(run) {
  const arcCalls = []
  const fakeCtx = {
    save() {},
    restore() {},
    beginPath() {},
    // Each full draw pass starts with clearRect (see GraphCanvas.jsx's draw
    // effect). LinkedFunctionPanel's trace-accumulation effect can trigger a
    // second draw pass on top of the initial mount's (setTrace -> re-render
    // -> GraphCanvas's effect fires again), so without resetting here,
    // arcCalls would keep growing across every internal re-render instead of
    // reflecting only the latest, settled draw -- resetting on clearRect
    // keeps each assertion about "points in the current draw", matching what
    // a real canvas would actually show on screen.
    clearRect() {
      arcCalls.length = 0
    },
    moveTo() {},
    lineTo() {},
    setLineDash() {},
    arc(x, y) {
      arcCalls.push({ x, y })
    },
    fill() {},
    stroke() {},
  }
  const original = HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext = () => fakeCtx
  try {
    await run(arcCalls)
  } finally {
    HTMLCanvasElement.prototype.getContext = original
  }
}

describe('LinkedFunctionPanel', () => {
  it('shows the correct solution count for t=-3', () => {
    render(<LinkedFunctionPanel pieces={pieces} params={{}} t={-3} />)
    expect(screen.getByText(/h\(-3(\.00)?\)\s*=\s*3/)).toBeInTheDocument()
  })

  // 52번 문제 acceptance criteria (plan doc): g(-3-)=1, g(-3)=3, g(-3+)=5,
  // summing to 9 -- proven at the pure-function level by rootFinder.test.js;
  // this closes the loop by checking the actual rendered component.
  it('reproduces the 52-problem g(k-)+g(k)+g(k+)=9 signal at k=-3 through the rendered component', () => {
    const { rerender: rr } = render(<LinkedFunctionPanel pieces={pieces} params={{}} t={-3 - 1e-3} />)
    expect(screen.getByText(/h\(-3\.00\)\s*=\s*1/)).toBeInTheDocument()

    rr(<LinkedFunctionPanel pieces={pieces} params={{}} t={-3} />)
    expect(screen.getByText(/h\(-3\.00\)\s*=\s*3/)).toBeInTheDocument()

    rr(<LinkedFunctionPanel pieces={pieces} params={{}} t={-3 + 1e-3} />)
    expect(screen.getByText(/h\(-3\.00\)\s*=\s*5/)).toBeInTheDocument()
  })

  it('does not throw and shows an error message instead of h(t) when a piece fails to compile', () => {
    const badPieces = [{ expr: 'x +* 2', domain: [null, null], closedAt: { left: null, right: null } }]
    expect(() => render(<LinkedFunctionPanel pieces={badPieces} params={{}} t={0} />)).not.toThrow()
    expect(screen.queryByText(/h\(/)).not.toBeInTheDocument()
    expect(screen.getByText(/invalid expression/i)).toBeInTheDocument()
  })

  it('evaluates a piece with an untouched free variable using the same default (1) Panel.jsx uses, instead of throwing', () => {
    // a*(x-2)*(x-b)+9 with a=1,b=1 (default): (x-2)(x-1)+9 = x^2-3x+11, vertex
    // value 8.75 at x=1.5 -- two roots for t=9 (x=1 or x=4... actually solve
    // x^2-3x+11=9 => x^2-3x+2=0 => x=1,2).
    const freeVarPieces = [{ expr: 'a*(x-2)*(x-b)+9', domain: [null, null], closedAt: { left: null, right: null } }]
    expect(() => render(<LinkedFunctionPanel pieces={freeVarPieces} params={{}} t={9} />)).not.toThrow()
    expect(screen.getByText(/h\(9\.00\)\s*=\s*2/)).toBeInTheDocument()
  })

  it('accumulates a trace point per rendered t while traceOn, in addition to the current point', async () => {
    await withFakeCanvasContext(async (arcCalls) => {
      const { rerender: rr } = render(<LinkedFunctionPanel pieces={pieces} params={{}} t={-6} traceOn />)
      expect(arcCalls).toHaveLength(1) // just the current point

      rr(<LinkedFunctionPanel pieces={pieces} params={{}} t={-4} traceOn />)
      expect(arcCalls).toHaveLength(2) // previous trace point + current

      rr(<LinkedFunctionPanel pieces={pieces} params={{}} t={0} traceOn />)
      expect(arcCalls).toHaveLength(3)
    })
  })

  it('shows only the current point (no accumulation) when traceOn is false', async () => {
    await withFakeCanvasContext(async (arcCalls) => {
      const { rerender: rr } = render(<LinkedFunctionPanel pieces={pieces} params={{}} t={-6} />)
      expect(arcCalls).toHaveLength(1)

      rr(<LinkedFunctionPanel pieces={pieces} params={{}} t={-4} />)
      expect(arcCalls).toHaveLength(1)

      rr(<LinkedFunctionPanel pieces={pieces} params={{}} t={0} />)
      expect(arcCalls).toHaveLength(1)
    })
  })

  it('clears the accumulated trace when traceOn is switched off', async () => {
    await withFakeCanvasContext(async (arcCalls) => {
      const { rerender: rr } = render(<LinkedFunctionPanel pieces={pieces} params={{}} t={-6} traceOn />)
      rr(<LinkedFunctionPanel pieces={pieces} params={{}} t={-4} traceOn />)
      expect(arcCalls).toHaveLength(2)

      arcCalls.length = 0
      rr(<LinkedFunctionPanel pieces={pieces} params={{}} t={-4} traceOn={false} />)
      expect(arcCalls).toHaveLength(1)
    })
  })
})
