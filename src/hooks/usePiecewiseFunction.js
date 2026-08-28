import { useMemo } from 'react'
import { validatePiecewise } from '../core/functionSchema'
import { buildPiecewiseFunction } from '../core/piecewiseFunction'
import { detectFreeVariables } from '../core/freeVariables'

// Default value assumed for a free variable (e.g. the 52-problem's `a`/`b`)
// before its slider has ever been touched. Exported so any caller displaying
// that default (ParamSliders' own `values[name] ?? 1` fallback, currently)
// can keep agreeing with what evaluation actually uses.
export const DEFAULT_PARAM_VALUE = 1

// Panel.jsx (the editable left function) and LinkedFunctionPanel.jsx (Task
// 15's h(t) readout) both need to turn the same {pieces, params} into a
// validated, evaluatable piecewise function, the identical way -- validate,
// merge in default values for any free variable not yet in `params`, build.
// The whole premise of "linked" is that both panels are reading the SAME
// function; two independently-maintained copies of this pipeline would risk
// silently drifting apart (e.g. one gains a new default or validation
// tweak the other doesn't), which would show up as the left curve and the
// right panel's h(t) quietly disagreeing about what "the function" is.
// Extracted here so there's exactly one place this logic can change.
export function usePiecewiseFunction(pieces, params) {
  const parsed = useMemo(() => {
    const validation = validatePiecewise({ type: 'piecewise', pieces })
    return validation.ok ? { def: validation.normalized } : { error: validation.errors.join('; ') }
  }, [pieces])

  // Names referenced in the pieces' expressions that are neither `x` nor a
  // mathjs builtin -- e.g. entering 'a*(x-2)*(x-b)+9' surfaces ['a', 'b'].
  const freeVars = useMemo(
    () => detectFreeVariables(pieces.map((p) => p.expr), ['x']).sort(),
    [pieces],
  )

  // A name detected in freeVars but never touched via a slider has no entry
  // in `params` yet. Without this merge, buildPiecewiseFunction below would
  // hand mathjs a scope missing that symbol, and evaluating would throw
  // "Undefined symbol a" the first time anything samples the curve.
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

  return { fn, error: parsed.error, freeVars, effectiveParams }
}
