import { tryCompileExpression } from './mathEngine'

function contains(piece, x) {
  const [min, max] = piece.domain
  const lo = min === null || min === undefined ? -Infinity : min
  const hi = max === null || max === undefined ? Infinity : max
  if (x < lo || x > hi) return false
  if (x === lo && piece.closedAt.left === false) return false
  if (x === hi && piece.closedAt.right === false) return false
  return true
}

export function buildPiecewiseFunction(def, params = {}) {
  const pieces = def.pieces.map((piece, i) => {
    const result = tryCompileExpression(piece.expr)
    if (!result.ok) {
      // buildPiecewiseFunction is not always called downstream of validatePiecewise
      // (Task 3) -- e.g. LinkedFunctionPanel builds directly from raw `pieces` props.
      // Fail loudly here, at construction time, rather than silently trusting
      // result.compiled exists and crashing later inside evaluateAt() with a
      // confusing "Cannot read properties of undefined (reading 'evaluate')".
      throw new Error(`piece ${i}: invalid expression "${piece.expr}" (${result.error})`)
    }
    const { compiled } = result
    return {
      domain: piece.domain,
      closedAt: piece.closedAt,
      evaluate: (x) => compiled.evaluate({ x, ...params }),
    }
  })

  function evaluateAt(x) {
    const piece = pieces.find((p) => contains(p, x))
    return piece ? piece.evaluate(x) : NaN
  }

  return { pieces, contains, evaluateAt }
}
