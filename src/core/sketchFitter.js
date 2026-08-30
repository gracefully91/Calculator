function solve(matrix, vector) {
  const size = vector.length
  const augmented = matrix.map((row, index) => [...row, vector[index]])
  for (let column = 0; column < size; column += 1) {
    let pivot = column
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row
    }
    if (Math.abs(augmented[pivot][column]) < 1e-10) return null
    ;[augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]]
    const divisor = augmented[column][column]
    for (let index = column; index <= size; index += 1) augmented[column][index] /= divisor
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue
      const factor = augmented[row][column]
      for (let index = column; index <= size; index += 1) augmented[row][index] -= factor * augmented[column][index]
    }
  }
  return augmented.map((row) => row[size])
}

function fitPolynomial(points, degree) {
  const size = degree + 1
  const matrix = Array.from({ length: size }, () => Array(size).fill(0))
  const vector = Array(size).fill(0)
  points.forEach(({ x, y }) => {
    const powers = Array.from({ length: size * 2 }, (_, index) => x ** index)
    for (let row = 0; row < size; row += 1) {
      vector[row] += y * powers[row]
      for (let column = 0; column < size; column += 1) matrix[row][column] += powers[row + column]
    }
  })
  const coefficients = solve(matrix, vector)
  if (!coefficients) return null
  const squaredError = points.reduce((sum, point) => {
    const estimated = coefficients.reduce((total, coefficient, index) => total + coefficient * point.x ** index, 0)
    return sum + (point.y - estimated) ** 2
  }, 0)
  return { coefficients, rmse: Math.sqrt(squaredError / points.length) }
}

function rounded(value) {
  const result = Math.round(value * 1000) / 1000
  return Object.is(result, -0) ? 0 : result
}

function expressionFromCoefficients(coefficients) {
  const terms = []
  for (let power = coefficients.length - 1; power >= 0; power -= 1) {
    const coefficient = rounded(coefficients[power])
    if (Math.abs(coefficient) < 0.001) continue
    const absolute = Math.abs(coefficient)
    const factor = absolute === 1 && power > 0 ? '' : String(absolute)
    const body = power === 0 ? factor : power === 1 ? `${factor}${factor ? '*' : ''}x` : `${factor}${factor ? '*' : ''}x^${power}`
    terms.push({ sign: coefficient < 0 ? '-' : '+', body })
  }
  if (terms.length === 0) return '0'
  return terms.map((term, index) => `${index === 0 ? (term.sign === '-' ? '-' : '') : term.sign}${term.body}`).join('')
}

export function fitSketchStrokes(strokes) {
  const candidates = (strokes ?? []).flatMap((stroke) => {
    const points = (stroke.points ?? []).filter(({ x, y }) => Number.isFinite(x) && Number.isFinite(y))
    if (points.length < 2) return []
    const yValues = points.map((point) => point.y)
    const ySpread = Math.max(...yValues) - Math.min(...yValues) || 1
    const fits = [1, 2, 3]
      .filter((degree) => points.length > degree)
      .map((degree) => ({ degree, ...fitPolynomial(points, degree) }))
      .filter((fit) => fit.coefficients)
      .map((fit) => ({ ...fit, score: fit.rmse + ySpread * 0.025 * fit.degree }))
    if (fits.length === 0) return []
    const best = fits.reduce((current, candidate) => candidate.score < current.score ? candidate : current)
    return [{
      expr: expressionFromCoefficients(best.coefficients),
      domain: [rounded(Math.min(...points.map((point) => point.x))), rounded(Math.max(...points.map((point) => point.x)))],
      rmse: rounded(best.rmse),
      degree: best.degree,
    }]
  })

  return {
    candidates,
    pieces: candidates.map((candidate, index) => ({
      expr: candidate.expr,
      domain: candidate.domain,
      closedAt: { left: null, right: null },
      independent: index > 0,
    })),
  }
}
