import { parse, FunctionNode } from 'mathjs'

// Names that resolve inside mathjs's own scope (built-in functions and
// constants) even when nothing binds them in `boundNames` -- these should
// never surface as "undefined parameter that needs a slider". Note that for
// a function name (abs/min/max/sqrt) this set is redundant with the
// isFunctionName structural check below -- `abs` in `abs(x)` is already
// excluded because it's a FunctionNode's `.fn`, not because it's listed
// here. This set only does real work for the bare constants `pi`/`e`, which
// appear as ordinary SymbolNodes with no enclosing FunctionNode to exclude
// them structurally. It's kept for the function names too as a harmless,
// explicit safety net in case one is ever referenced without being called
// (e.g. passed as a value, which isFunctionName wouldn't catch).
const BUILTIN_NAMES = new Set(['abs', 'min', 'max', 'sqrt', 'pi', 'e'])

// Scans each expression string for SymbolNodes that are neither an
// already-bound name (e.g. 'x') nor a mathjs builtin, and returns the
// distinct set of the rest -- these are the "free variables" (a, b, ...)
// that Panel.jsx should offer sliders for. Expressions that fail to parse
// (e.g. mid-edit, incomplete text) are skipped rather than thrown, since
// this runs on every keystroke via Panel's live preview.
export function detectFreeVariables(exprStrings, boundNames = []) {
  const bound = new Set(boundNames)
  const found = new Set()

  exprStrings.forEach((exprString) => {
    let node
    try {
      node = parse(exprString)
    } catch {
      return
    }
    node.traverse((n, path, parent) => {
      if (n.isSymbolNode) {
        // A SymbolNode that names the function being called (e.g. the `abs`
        // in abs(x)) is a function reference, not a variable read -- only
        // FunctionNode.fn holds that role; a symbol passed as an argument
        // (e.g. the `x` in abs(x)) is a separate node and still counted.
        const isFunctionName = parent instanceof FunctionNode && parent.fn === n
        if (!isFunctionName && !bound.has(n.name) && !BUILTIN_NAMES.has(n.name)) {
          found.add(n.name)
        }
      }
    })
  })

  return [...found]
}
