import { compile } from 'mathjs'

export function tryCompileExpression(exprString) {
  try {
    const compiled = compile(exprString)
    return { ok: true, compiled }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}
