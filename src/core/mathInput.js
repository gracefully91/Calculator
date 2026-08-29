import { convertLatexToAsciiMath } from 'mathlive/ssr'

// A lone identifier followed by parentheses is a multiplication in this
// calculator (a(x) means a * x), unless it names a real mathjs function.
// MathLive intentionally preserves the ambiguity in ASCII Math, so normalize
// it at the boundary before handing the value to the app's established model.
const MATH_FUNCTIONS = new Set([
  'abs', 'acos', 'acosh', 'asin', 'asinh', 'atan', 'atan2', 'atanh',
  'ceil', 'cos', 'cosh', 'exp', 'floor', 'log', 'log10', 'max', 'min',
  'round', 'sign', 'sin', 'sinh', 'sqrt', 'tan', 'tanh',
])

export function latexToExpression(latex) {
  const ascii = convertLatexToAsciiMath(latex).replace(/\s+/g, '')
  return ascii
    .replace(/([A-Za-z][A-Za-z0-9_]*)\(/g, (whole, name) => (
      MATH_FUNCTIONS.has(name.toLowerCase()) ? whole : `${name}*(`
    ))
    .replace(/\)\(/g, ')*(')
}
