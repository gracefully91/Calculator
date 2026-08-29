import { create } from 'zustand'

// Default left-panel piece: a single valid, non-empty expression covering the
// whole domain, so Panel (Task 11) always has a well-formed row to render/edit
// and validatePiecewise (src/core/functionSchema.js) never rejects the initial
// state (an empty `expr` is explicitly invalid there).
//
// `id` is a stable identity for React's row keys in Panel.jsx -- it's not
// part of the piecewise function schema (validatePiecewise/buildPiecewiseFunction
// only read expr/domain/closedAt and ignore it) so it survives untouched
// through updatePiece's `{ ...p, ...patch }` spreads. Without it, Panel keyed
// rows on array index, and deleting a piece shifted every later row's index
// down, causing React to reuse a EquationInput CodeMirror instance across a
// slot change -- the displayed value stayed correct (it's a controlled prop),
// but cursor/selection/scroll/undo-history are held inside CodeMirror's own
// EditorView state, outside that prop, and silently carried over.
const DEFAULT_LEFT_PIECES = [{ id: 1, expr: 'x', domain: [null, null], closedAt: { left: null, right: null } }]

export const useAppStore = create((set) => ({
  // t: the shared value driving both the left graph's y=t line and the right
  // (linked function) panel's x=t — see Task 14/15.
  t: 0,

  // params: named slider values (e.g. { a: 3, b: 6 }) for free variables
  // detected in the entered expressions — see Task 13 (ParamSliders).
  params: {},

  // leftFunctionSource: raw single-line editor text, used by the Task 10
  // single-expression version of Panel/App before the piecewise editor
  // (Task 11) replaces it with leftPieces. Kept because later components
  // switch to leftPieces instead of parsing this into a def.
  leftFunctionSource: '',

  // leftPieces: the left panel's piecewise function definition, as an array
  // of { expr, domain: [min, max], closedAt: { left, right } }. This is what
  // Task 11's Panel edits and Task 14's App.jsx reads/writes via
  // s.leftPieces / s.setLeftPieces (see plan doc Task 14 note: "leftPieces/
  // setLeftPieces를 store에 추가하는 작은 변경 포함 — Task 7 스토어 확장").
  leftPieces: DEFAULT_LEFT_PIECES,

  // traceOn: whether LinkedFunctionPanel (Task 15) accumulates h(t) trace
  // points as t is dragged. The trace points themselves are kept as local
  // component state in LinkedFunctionPanel, not in the store.
  traceOn: false,

  // Freehand annotations are screen-space note strokes, independent from the
  // mathematical objects. Each panel owns its own list so a note on f(x)
  // never appears on the linked h(t) graph.
  leftInkStrokes: [],
  rightInkStrokes: [],
  rightGraphMode: 'intersection-count',
  rightGraphExpression: 'x',

  setT: (t) => set({ t }),
  setParam: (name, value) => set((s) => ({ params: { ...s.params, [name]: value } })),
  setLeftFunctionSource: (source) => set({ leftFunctionSource: source }),
  setLeftPieces: (pieces) => set({ leftPieces: pieces }),
  setLeftInkStrokes: (strokes) => set({ leftInkStrokes: strokes }),
  setRightInkStrokes: (strokes) => set({ rightInkStrokes: strokes }),
  setRightGraphMode: (rightGraphMode) => set({ rightGraphMode }),
  setRightGraphExpression: (rightGraphExpression) => set({ rightGraphExpression }),
  toggleTrace: () => set((s) => ({ traceOn: !s.traceOn })),
}))
