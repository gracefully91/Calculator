import { compile } from 'mathjs'
import { toMathJson } from './computeEngine'

export function tryCompileExpression(exprString) {
  try {
    const compiled = compile(exprString)
    // Do not make a MathJSON parse failure reject an expression that the
    // existing evaluator accepts. This preserves every current worksheet
    // while exposing a shared semantic form wherever it is available.
    const semantic = toMathJson(exprString)
    return { ok: true, compiled, mathJson: semantic.ok ? semantic.mathJson : null, latex: semantic.ok ? semantic.latex : null }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}
