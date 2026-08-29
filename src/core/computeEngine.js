import { ComputeEngine } from '@cortex-js/compute-engine'
import { convertAsciiMathToLatex } from 'mathlive/ssr'

// Keep one Compute Engine instance for the application. It is deliberately a
// semantic companion to the existing mathjs evaluator during this migration:
// mathjs remains the numeric execution path used by piecewiseFunction and the
// root finder, while this module supplies the lossless MathJSON representation
// that MathLive and future algebra tools (differentiate/simplify/etc.) share.
const engine = new ComputeEngine()

/**
 * Parse one of the app's established ASCII expressions into MathJSON.
 *
 * Compute Engine's `parse()` consumes LaTeX. Converting first is important:
 * passing ASCII `abs(x)` directly makes it look like a product of letters,
 * whereas MathLive's LaTeX `|x|` has the intended absolute-value meaning.
 */
export function toMathJson(expression) {
  if (typeof expression !== 'string' || expression.trim() === '') {
    return { ok: false, error: 'expression is required' }
  }

  try {
    const latex = convertAsciiMathToLatex(expression)
    const parsed = engine.parse(latex)
    if (!parsed?.isValid) return { ok: false, error: 'could not parse expression' }
    return { ok: true, latex, mathJson: parsed.json }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

export { engine as computeEngine }
