import { describe, it, expect } from 'vitest'
import { worldToScreen, screenToWorld, niceGridStep } from './viewport'

describe('worldToScreen / screenToWorld', () => {
  const view = { xMin: -5, xMax: 5, yMin: -5, yMax: 5, width: 400, height: 400 }

  it('maps world origin to screen center', () => {
    const p = worldToScreen(view, 0, 0)
    expect(p.x).toBeCloseTo(200)
    expect(p.y).toBeCloseTo(200)
  })

  it('round-trips screen -> world -> screen', () => {
    const screen = { x: 123, y: 77 }
    const world = screenToWorld(view, screen.x, screen.y)
    const back = worldToScreen(view, world.x, world.y)
    expect(back.x).toBeCloseTo(screen.x)
    expect(back.y).toBeCloseTo(screen.y)
  })

  it('flips y axis (screen y grows downward, world y grows upward)', () => {
    const top = worldToScreen(view, 0, 5)
    const bottom = worldToScreen(view, 0, -5)
    expect(top.y).toBeLessThan(bottom.y)
  })
})

describe('niceGridStep', () => {
  it('picks a step from {1,2,5} * 10^n for a given range', () => {
    expect(niceGridStep(10)).toBeCloseTo(2)
    expect(niceGridStep(1)).toBeCloseTo(0.2)
    expect(niceGridStep(100)).toBeCloseTo(20)
  })
})
