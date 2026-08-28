import { tryCompileExpression } from './mathEngine'

export function validatePiecewise(def) {
  const errors = []

  if (!def || !Array.isArray(def.pieces) || def.pieces.length === 0) {
    return { ok: false, errors: ['at least one piece is required'] }
  }

  const normalizedPieces = def.pieces.map((piece, i) => {
    const expr = piece.expr
    // tryCompileExpression('') returns ok:true (mathjs happily "compiles" an empty
    // string into something that evaluates to undefined), so a missing/blank expr
    // must be rejected explicitly rather than handed to the compiler as-is.
    if (typeof expr !== 'string' || expr.trim() === '') {
      errors.push(`piece ${i}: expr is required`)
    } else {
      const compileResult = tryCompileExpression(expr)
      if (!compileResult.ok) {
        errors.push(`piece ${i}: invalid expression "${expr}" (${compileResult.error})`)
      }
    }
    const domain = piece.domain ?? [null, null]
    return {
      expr,
      domain,
      closedAt: piece.closedAt ?? { left: null, right: null },
    }
  })

  // 도메인 겹침 검사: 정렬 후 인접 구간이 겹치면 에러 (경계 접점은 허용)
  const sorted = [...normalizedPieces].sort((a, b) => {
    const aLo = a.domain[0] ?? -Infinity
    const bLo = b.domain[0] ?? -Infinity
    return aLo - bLo
  })
  for (let i = 0; i < sorted.length - 1; i++) {
    const currHi = sorted[i].domain[1] ?? Infinity
    const nextLo = sorted[i + 1].domain[0] ?? -Infinity
    if (currHi > nextLo) {
      errors.push(`pieces overlap between domain ending ${currHi} and next starting ${nextLo}`)
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  return { ok: true, normalized: { type: 'piecewise', pieces: normalizedPieces } }
}
