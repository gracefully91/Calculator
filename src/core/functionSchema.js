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
    // domain must be a [min, max] tuple where each bound is either null (unbounded)
    // or a finite number. Task 4's piecewiseFunction.js destructures
    // `const [min, max] = piece.domain`, which throws a TypeError on anything that
    // isn't array-like (e.g. domain: 5) — catch that shape mismatch here instead.
    let domain = piece.domain ?? [null, null]
    const isValidBound = (v) => v === null || (typeof v === 'number' && Number.isFinite(v))
    if (!Array.isArray(domain) || domain.length !== 2 || !domain.every(isValidBound)) {
      errors.push(`piece ${i}: domain must be a [min, max] tuple of null or finite numbers`)
      domain = [null, null]
    } else if (domain[0] !== null && domain[1] !== null && domain[0] > domain[1]) {
      // An inverted domain (min > max) doesn't crash anything downstream, but it
      // silently produces a piece whose interval is empty (never applies) — almost
      // certainly a typo'd bound, so fail loudly instead of accepting a dead piece.
      errors.push(`piece ${i}: domain min (${domain[0]}) must not exceed domain max (${domain[1]})`)
    }

    return {
      expr,
      domain,
      independent: piece.independent === true,
      // Default per-field, not the whole object: a partial closedAt like {} or
      // { right: true } must not leave the other field as `undefined` — `undefined`
      // isn't valid JSON and would silently drop out of a JSON.stringify round-trip.
      closedAt: {
        left: piece.closedAt?.left ?? null,
        right: piece.closedAt?.right ?? null,
      },
    }
  })

  // 도메인 겹침 검사: 정렬 후 인접 구간이 겹치면 에러 (경계 접점은 허용)
  const sorted = [...normalizedPieces].sort((a, b) => {
    const aLo = a.domain[0] ?? -Infinity
    const bLo = b.domain[0] ?? -Infinity
    return aLo - bLo
  })
  for (let i = 0; i < sorted.length - 1; i++) {
    // A GeoGebra-style “+ 입력” row is an independent graph, not another
    // piece of the same f(x), so it may overlap any other graph.
    if (sorted[i].independent || sorted[i + 1].independent) continue
    const currHi = sorted[i].domain[1] ?? Infinity
    const nextLo = sorted[i + 1].domain[0] ?? -Infinity
    if (currHi > nextLo) {
      errors.push(`pieces overlap between domain ending ${currHi} and next starting ${nextLo}`)
    } else if (
      currHi === nextLo &&
      sorted[i].closedAt.right !== false &&
      sorted[i + 1].closedAt.left !== false
    ) {
      // The intervals themselves don't overlap, but if both pieces include the
      // shared boundary point (both closed there), that single x has two different
      // y-values — a genuinely ill-defined function, not just an adjacent pair.
      // `!== false` (not a truthy check) because the normalized closedAt above
      // defaults an unset side to `null`, and null means closed here — same
      // convention as piecewiseFunction.js's contains() (a boundary is only
      // excluded when its side is explicitly `false`). A truthy check let two
      // pieces both implicitly closed (closedAt: null on both sides) at a
      // shared boundary slip past this guard undetected.
      errors.push(`pieces both include boundary point ${currHi} (both closed there)`)
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  return { ok: true, normalized: { type: 'piecewise', pieces: normalizedPieces } }
}
