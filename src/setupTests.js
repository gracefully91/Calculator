import '@testing-library/jest-dom'

// jsdom intentionally reports an unimplemented-feature error every time a
// canvas context is requested. GraphCanvas and InkLayer both tolerate a null
// context, while the renderer tests install their own per-test fake context.
// A quiet null default keeps unrelated test output readable and avoids the
// thousands of repeated jsdom warnings obscuring real failures.
HTMLCanvasElement.prototype.getContext = () => null

// jsdom doesn't implement Range.getClientRects/getBoundingClientRect, which
// CodeMirror 6's view layer calls during its internal layout measurement
// (see @uiw/react-codemirror, used by EquationInput). Without this, that
// measurement throws inside a requestAnimationFrame callback, producing an
// unhandled exception that fails the whole `vitest run` invocation even
// though every test still passes.
// https://github.com/jsdom/jsdom/issues/3729
document.createRange = () => {
  const range = new Range()
  range.getBoundingClientRect = () => ({
    bottom: 0,
    height: 0,
    left: 0,
    right: 0,
    top: 0,
    width: 0,
    x: 0,
    y: 0,
    toJSON() {
      return {}
    },
  })
  range.getClientRects = () => ({
    item: () => null,
    length: 0,
    [Symbol.iterator]: [][Symbol.iterator],
  })
  return range
}
