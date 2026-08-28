// Tolerance for treating a local extremum's value as "touching" the target
// height t (a tangency, e.g. a parabola's vertex resting exactly on the
// line). Refined via golden-section search, so this only needs to absorb
// floating-point noise, not sampling coarseness.
const TANGENT_EPS = 1e-6

function bisect(fn, a, b, iterations = 50) {
  let lo = a
  let hi = b
  let fLo = fn(lo)
  for (let i = 0; i < iterations; i++) {
    const mid = (lo + hi) / 2
    const fMid = fn(mid)
    if (fLo * fMid <= 0) {
      hi = mid
    } else {
      lo = mid
      fLo = fMid
    }
  }
  return (lo + hi) / 2
}

// Golden-section search for the extremum (min or max) of fn over [a, b].
// Assumes fn is unimodal on [a, b], which holds for the small bracket
// between two adjacent samples where a direction change was detected.
function goldenSectionExtremum(fn, a, b, findMin, iterations = 60) {
  const gr = (Math.sqrt(5) - 1) / 2
  let lo = a
  let hi = b
  let c = hi - gr * (hi - lo)
  let d = lo + gr * (hi - lo)
  let fc = fn(c)
  let fd = fn(d)
  for (let i = 0; i < iterations; i++) {
    const cIsBetter = findMin ? fc <= fd : fc >= fd
    if (cIsBetter) {
      hi = d
      d = c
      fd = fc
      c = hi - gr * (hi - lo)
      fc = fn(c)
    } else {
      lo = c
      c = d
      fc = fd
      d = lo + gr * (hi - lo)
      fd = fn(d)
    }
  }
  const x = (lo + hi) / 2
  return { x, value: fn(x) }
}

function dedupeSorted(values, eps = 1e-4) {
  const sorted = [...values].sort((a, b) => a - b)
  const result = []
  for (const v of sorted) {
    if (result.length === 0 || Math.abs(v - result[result.length - 1]) > eps) {
      result.push(v)
    }
  }
  return result
}

// piecewiseFn: buildPiecewiseFunction()의 반환값
// t: 수평선 높이
// searchRange: [xMin, xMax] — 무한 도메인을 다루기 위한 유한 탐색 범위 (보통 뷰포트 범위)
//
// Per piece, roots come from two independent scans over the same samples:
//  1. Sign changes of (evaluate(x) - t) between consecutive samples, refined
//     with bisection — ordinary crossings.
//  2. Local extrema (turning points) of evaluate(x) itself, refined with
//     golden-section search — tangencies where the graph touches y = t at a
//     local min/max without crossing it (e.g. a parabola's vertex sitting
//     exactly on the line). A pure sign-change scan misses these because no
//     sign change ever occurs there, so they must be detected separately.
export function findRoots(piecewiseFn, t, searchRange, samples = 1000) {
  const roots = []

  piecewiseFn.pieces.forEach((piece) => {
    const [pMin, pMax] = piece.domain
    const lo = Math.max(pMin === null || pMin === undefined ? -Infinity : pMin, searchRange[0])
    const hi = Math.min(pMax === null || pMax === undefined ? Infinity : pMax, searchRange[1])
    if (lo >= hi) return

    const step = (hi - lo) / samples
    const xs = new Array(samples + 1)
    const ys = new Array(samples + 1)
    for (let i = 0; i <= samples; i++) {
      const x = i === samples ? hi : lo + step * i
      xs[i] = x
      ys[i] = piece.evaluate(x)
    }

    const addIfContained = (x) => {
      if (piecewiseFn.contains(piece, x)) roots.push(x)
    }

    // 1) Sign-change crossings.
    for (let i = 0; i < samples; i++) {
      const v0 = ys[i] - t
      const v1 = ys[i + 1] - t
      if (v0 === 0) {
        addIfContained(xs[i])
      } else if (v0 * v1 < 0) {
        const root = bisect((x) => piece.evaluate(x) - t, xs[i], xs[i + 1])
        addIfContained(root)
      }
    }
    if (ys[samples] - t === 0) addIfContained(xs[samples])

    // 2) Tangencies at local extrema.
    for (let i = 1; i < samples; i++) {
      const prev = ys[i - 1]
      const cur = ys[i]
      const next = ys[i + 1]
      const isLocalMin = cur <= prev && cur <= next && (cur < prev || cur < next)
      const isLocalMax = cur >= prev && cur >= next && (cur > prev || cur > next)
      if (!isLocalMin && !isLocalMax) continue

      const { x: extX, value: extVal } = goldenSectionExtremum(
        piece.evaluate,
        xs[i - 1],
        xs[i + 1],
        isLocalMin
      )
      if (Math.abs(extVal - t) <= TANGENT_EPS) {
        addIfContained(extX)
      }
    }
  })

  return dedupeSorted(roots)
}

export function solutionCount(piecewiseFn, t, searchRange, samples) {
  return findRoots(piecewiseFn, t, searchRange, samples).length
}
