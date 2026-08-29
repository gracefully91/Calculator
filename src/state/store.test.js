import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from './store'

describe('useAppStore', () => {
  beforeEach(() => {
    useAppStore.setState(useAppStore.getInitialState())
  })

  it('has a default t of 0', () => {
    expect(useAppStore.getState().t).toBe(0)
  })

  it('setT updates t', () => {
    useAppStore.getState().setT(3.5)
    expect(useAppStore.getState().t).toBe(3.5)
  })

  it('setParam updates a named parameter', () => {
    useAppStore.getState().setParam('a', 3)
    useAppStore.getState().setParam('b', 6)
    expect(useAppStore.getState().params).toEqual({ a: 3, b: 6 })
  })

  it('setLeftFunctionSource stores the raw editor text separately from the parsed def', () => {
    useAppStore.getState().setLeftFunctionSource('x^2')
    expect(useAppStore.getState().leftFunctionSource).toBe('x^2')
  })

  // Additional coverage beyond the Task 7 baseline. Task 11/13/14's Panel and App.jsx
  // reference code store the left panel's function as an array of pieces
  // (`{ expr, domain, closedAt }`) under `leftPieces`/`setLeftPieces` on the store
  // (see plan doc note at Task 14: "leftPieces/setLeftPieces를 store에 추가하는
  // 작은 변경 포함 — Task 7 스토어 확장"), not as a single `leftFunctionDef` object.
  it('has a default leftPieces of one valid piece', () => {
    const pieces = useAppStore.getState().leftPieces
    expect(Array.isArray(pieces)).toBe(true)
    expect(pieces).toHaveLength(1)
    expect(pieces[0]).toMatchObject({ expr: expect.any(String) })
  })

  it('setLeftPieces replaces the pieces array', () => {
    const nextPieces = [
      { expr: 'x^2', domain: [null, 0], closedAt: { left: null, right: true } },
      { expr: 'x', domain: [0, null], closedAt: { left: false, right: null } },
    ]
    useAppStore.getState().setLeftPieces(nextPieces)
    expect(useAppStore.getState().leftPieces).toEqual(nextPieces)
  })

  // Task 15's LinkedFunctionPanel toggles trace via a store-backed `traceOn` flag
  // (plan doc Task 15 Step 5: "traceOn 토글 UI를 App.jsx에 추가하고 스토어와 연결").
  // The trace point history itself is kept as local component state inside
  // LinkedFunctionPanel (see its reference `useState`), so the store only needs
  // the on/off flag, not a `trace` array or point-pushing actions.
  it('has traceOn off by default and toggleTrace flips it', () => {
    expect(useAppStore.getState().traceOn).toBe(false)
    useAppStore.getState().toggleTrace()
    expect(useAppStore.getState().traceOn).toBe(true)
    useAppStore.getState().toggleTrace()
    expect(useAppStore.getState().traceOn).toBe(false)
  })

  it('keeps independent freehand stroke lists for the two graph panels', () => {
    const left = [{ points: [{ x: 0.1, y: 0.2 }] }]
    const right = [{ points: [{ x: 0.8, y: 0.7 }] }]
    useAppStore.getState().setLeftInkStrokes(left)
    useAppStore.getState().setRightInkStrokes(right)
    expect(useAppStore.getState().leftInkStrokes).toEqual(left)
    expect(useAppStore.getState().rightInkStrokes).toEqual(right)
  })
})
