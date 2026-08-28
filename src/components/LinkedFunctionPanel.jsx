import { useEffect, useMemo, useState } from 'react'
import { GraphCanvas } from './GraphCanvas'
import { validatePiecewise } from '../core/functionSchema'
import { buildPiecewiseFunction } from '../core/piecewiseFunction'
import { detectFreeVariables } from '../core/freeVariables'
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

// Mirrors Panel.jsx's own fallback for a free variable's value before any
// slider has touched it.
const DEFAULT_PARAM_VALUE = 1

// buildPiecewiseFunction (Task 4) throws synchronously if a piece's
// expression fails to compile. Unlike Panel.jsx, this component doesn't
// author `pieces` itself (it's fed the *same* leftPieces the user is
// actively editing in the left panel), so a mid-edit invalid expression can
// reach here at any time. Following Panel.jsx's own pattern (validate first,
// only build on success, render an error string otherwise) instead of a bare
// try/catch keeps both panels handling the identical invalid-input case the
// identical way, rather than one throwing errors and the other bubbling a
// caught exception through a different code path.
export function LinkedFunctionPanel({ pieces, params, t, traceOn = false }) {
  const parsed = useMemo(() => {
    const validation = validatePiecewise({ type: 'piecewise', pieces })
    return validation.ok ? { def: validation.normalized } : { error: validation.errors.join('; ') }
  }, [pieces])

  // Same free-variable defaulting Panel.jsx does: a piece referencing a
  // parameter (e.g. 'a', 'b') that hasn't been touched via a slider yet is
  // otherwise missing from `params`, and mathjs's compiled.evaluate would
  // throw "Undefined symbol" the first time solutionCount samples it.
  const freeVars = useMemo(
    () => detectFreeVariables(pieces.map((p) => p.expr), ['x']).sort(),
    [pieces],
  )
  const effectiveParams = useMemo(() => {
    const merged = { ...params }
    freeVars.forEach((name) => {
      if (!(name in merged)) merged[name] = DEFAULT_PARAM_VALUE
    })
    return merged
  }, [freeVars, params])

  const fn = useMemo(
    () => (parsed.def ? buildPiecewiseFunction(parsed.def, effectiveParams) : null),
    [parsed.def, effectiveParams],
  )
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
    if (count === null) return []
    const current = { x: t, y: count, closed: true }
    if (!traceOn) return [current]
    const last = trace[trace.length - 1]
    if (last && last.x === t && last.y === count) return trace
    return [...trace, current]
  }, [trace, traceOn, t, count])

  return (
    <div>
      <GraphCanvas curves={[]} points={points} />
      {parsed.error ? (
        <div style={{ color: '#dc2626' }}>{parsed.error}</div>
      ) : (
        <div>
          h({t.toFixed(2)}) = {count}
        </div>
      )}
    </div>
  )
}
