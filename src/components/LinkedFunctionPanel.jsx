import { useEffect, useMemo, useState } from 'react'
import { GraphCanvas } from './GraphCanvas'
import { usePiecewiseFunction } from '../hooks/usePiecewiseFunction'
import { solutionCount } from '../core/rootFinder'

// GraphCanvas's own DEFAULT_VIEW ([-8,8] on both axes). This is a known
// limitation, not a full fix: GraphCanvas (Task 14) supports independent
// pan/zoom per instance, and this panel has no way to know if the user
// panned/zoomed the LEFT graph to inspect roots outside [-8, 8] -- h(t) would
// then quietly disagree with what's visible there (undercounting roots that
// exist beyond this fixed window). A proper fix means lifting GraphCanvas's
// worldView out to a shared/prop-driven state and threading it into both
// panels -- out of scope for this task (Task 15 wasn't asked to add a view
// prop anywhere, and neither Panel nor App currently expose one). Flagging
// here rather than fixing; revisit if Phase 2 needs h(t) to stay accurate
// after the user pans/zooms.
const SEARCH_RANGE = [-8, 8]

// buildPiecewiseFunction (Task 4) throws synchronously if a piece's
// expression fails to compile. Unlike Panel.jsx, this component doesn't
// author `pieces` itself (it's fed the *same* leftPieces the user is
// actively editing in the left panel), so a mid-edit invalid expression can
// reach here at any time. usePiecewiseFunction (shared with Panel.jsx --
// see src/hooks/usePiecewiseFunction.js) validates first and only builds on
// success, surfacing an error string instead of throwing, so both panels
// handle the identical invalid-input case the identical way rather than one
// throwing and the other bubbling a caught exception through a different
// code path. It also merges in the same default (1) for any free variable
// (e.g. 'a', 'b') not yet touched via a slider, so evaluation doesn't throw
// "Undefined symbol" the first time solutionCount samples it.
export function LinkedFunctionPanel({ pieces, params, t, traceOn = false, inkStrokes, onInkStrokesChange }) {
  const { fn, error } = usePiecewiseFunction(pieces, params)
  const count = useMemo(() => (fn ? solutionCount(fn, t, SEARCH_RANGE) : null), [fn, t])

  // Trace history lives as local component state, not in the store (see
  // store.js's traceOn comment) -- only the on/off flag is shared state.
  const [trace, setTrace] = useState([])

  useEffect(() => {
    if (!traceOn || count === null) return
    // Each drag mousemove reports a (very likely) distinct `t` (GraphCanvas's
    // line-drag handler calls onDrag on every mousemove with a freshly
    // computed screenToWorld value), so this effect's deps ([t, count,
    // traceOn]) genuinely change on every mousemove during a drag and this
    // runs once per event -- there's no redundant re-firing for an unchanged
    // t to dedupe here. A single drag gesture across the panel produces at
    // most a few hundred points (bounded by mousemove event count, not by
    // time), which canvas 2D draws without any perceptible cost -- not worth
    // adding point-thinning logic for.
    setTrace((prev) => [...prev, { x: t, y: count, closed: true }])
  }, [t, count, traceOn])

  // Turning trace off (and leaving it off) clears the accumulated history,
  // so re-enabling it later starts a fresh trace instead of resuming a stale
  // one from a previous drag.
  useEffect(() => {
    if (!traceOn) setTrace([])
  }, [traceOn])

  // The render right after the effect above commits a point to `trace`
  // carries that same (t, count) both as `trace`'s own last entry and, if
  // naively re-appended here, a second time as "the current point" -- i.e.
  // every trace point would get drawn twice, on top of itself, one render
  // after it's recorded (harmless-looking on screen since the dots exactly
  // overlap, but it's real duplicate state and doubles GraphCanvas's draw
  // work). Appending "the current point" unconditionally is still needed for
  // the render that happens *before* the effect has committed it (otherwise
  // the newest drag position would lag by one render) -- so only append when
  // it isn't already trace's last entry.
  const points = useMemo(() => {
    // A momentarily invalid expression (e.g. mid-keystroke in the left
    // panel's EquationInput, which fires onChange per keystroke) must not
    // wipe out an already-accumulated trace -- only skip adding a new point
    // for this invalid instant. Losing the whole trace here would flicker it
    // away on every multi-character edit, undercutting the point of a trace
    // ("watch it build as you interact").
    if (count === null) return traceOn ? trace : []
    const current = { x: t, y: count, closed: true }
    if (!traceOn) return [current]
    const last = trace[trace.length - 1]
    if (last && last.x === t && last.y === count) return trace
    return [...trace, current]
  }, [trace, traceOn, t, count])

  return (
    <div className="linked-function-panel">
      <div className="graph-stage">
        <GraphCanvas curves={[]} points={points} inkStrokes={inkStrokes} onInkStrokesChange={onInkStrokesChange} inkLabel="linked graph" />
        <p className="graph-stage__hint">왼쪽의 y = t 변화가 이곳에 기록됩니다</p>
      </div>
      <div className="expression-sheet expression-sheet--linked">
        <div className="sheet-handle" aria-hidden="true" />
        {error ? <div className="expression-error">{error}</div> : <>
          <div className="linked-equation"><span className="linked-equation__dot" /> h(t) = 교점 개수</div>
          <div className="linked-reading"><span>현재 연결값</span><strong>h({t.toFixed(2)}) = {count}</strong></div>
        </>}
      </div>
    </div>
  )
}
