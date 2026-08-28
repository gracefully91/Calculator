# Phase 1 — 그래프 엔진 + 슬라이더 연동 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 좌우 2패널(원함수/연동함수) 그래프 뷰어를 만들고, 왼쪽 패널의 `y=t` 수평선을 드래그하면 오른쪽 패널이 실시간으로 `h(t)=교점개수`를 계산해 보여주는 핵심 상호작용을 완성한다.

**Architecture:** 순수 로직(좌표변환, 수식평가, 구간함수 정의, 수치적 근찾기)을 UI와 완전히 분리한 `src/core/*` 모듈로 만들고, React 컴포넌트는 이 모듈들을 조립·렌더링만 담당한다. 전역 상태(`t`, 함수 정의, 파라미터)는 Zustand 스토어 하나로 공유한다.

**Tech Stack:** React 18, Vite, Vitest + Testing Library, math.js, Zustand, Canvas 2D API, @uiw/react-codemirror.

---

## 참고 문서
- 설계 문서: `docs/plans/2026-08-29-math-graph-app-design.md`
- 작업 디렉토리: `.worktrees/phase1-graph-engine` (branch `feature/phase1-graph-engine`)

## 검증 기준 문제 (Task 15의 acceptance test)

```
f(x) = 2x^3-6x+1        (x<=2)
f(x) = a(x-2)(x-b)+9    (x>2), a=3, b=6

L(t) (왼쪽 조각 교점수): t<-3 → 1, t=-3 → 2, -3<t<5 → 3, t=5 → 2, t>5 → 0
R(t) (오른쪽 조각 교점수, a=3,b=6): t<-3 → 0, t=-3 → 1, -3<t<9 → 2, t=9 → 1, t>9 → 1
g(t)=L(t)+R(t): t=-3에서 g(-3)=3, g(-3-)=1, g(-3+)=5, 합=9
```

이 값들을 Task별 자동화 테스트와 Task 15 수동 검증에서 그대로 재사용한다.

---

### Task 0: 프로젝트 스캐폴딩

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html`, `src/main.jsx`, `src/App.jsx`, `src/setupTests.js`

**Step 1: Vite + React 스캐폴딩**

```bash
cd .worktrees/phase1-graph-engine
npm create vite@latest . -- --template react --force
```

**Step 2: 의존성 설치**

```bash
npm install mathjs zustand @uiw/react-codemirror @codemirror/lang-javascript @codemirror/autocomplete
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

**Step 3: Vitest 설정 추가**

`vite.config.js`에 test 블록 추가:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.js'],
    globals: true,
  },
})
```

`src/setupTests.js`:

```js
import '@testing-library/jest-dom'
```

`package.json`의 `scripts`에 추가:

```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 4: 베이스라인 확인**

```bash
npm run test
```
Expected: `No test files found` 또는 0 tests, exit code 0 (vitest는 테스트 파일이 없으면 에러를 낼 수 있음 — 그 경우 `src/App.test.jsx`에 더미 스모크 테스트 하나를 추가해 통과시킨다).

```bash
npm run dev
```
Expected: 브라우저에서 Vite 기본 카운터 화면이 뜸 (수동 확인 후 Ctrl+C로 종료).

**Step 5: Commit**

```bash
git add -A
git commit -m "Scaffold Vite+React project with Vitest"
```

---

### Task 1: `viewport.js` — 좌표 변환

**Files:**
- Create: `src/core/viewport.js`
- Test: `src/core/viewport.test.js`

**Step 1: 실패하는 테스트 작성**

```js
// src/core/viewport.test.js
import { describe, it, expect } from 'vitest'
import { worldToScreen, screenToWorld, niceGridStep } from './viewport'

describe('worldToScreen / screenToWorld', () => {
  const view = { xMin: -5, xMax: 5, yMin: -5, yMax: 5, width: 400, height: 400 }

  it('maps world origin to screen center', () => {
    const p = worldToScreen(view, 0, 0)
    expect(p.x).toBeCloseTo(200)
    expect(p.y).toBeCloseTo(200)
  })

  it('round-trips screen -> world -> screen', () => {
    const screen = { x: 123, y: 77 }
    const world = screenToWorld(view, screen.x, screen.y)
    const back = worldToScreen(view, world.x, world.y)
    expect(back.x).toBeCloseTo(screen.x)
    expect(back.y).toBeCloseTo(screen.y)
  })

  it('flips y axis (screen y grows downward, world y grows upward)', () => {
    const top = worldToScreen(view, 0, 5)
    const bottom = worldToScreen(view, 0, -5)
    expect(top.y).toBeLessThan(bottom.y)
  })
})

describe('niceGridStep', () => {
  it('picks a step from {1,2,5} * 10^n for a given range', () => {
    expect(niceGridStep(10)).toBeCloseTo(2)
    expect(niceGridStep(1)).toBeCloseTo(0.2)
    expect(niceGridStep(100)).toBeCloseTo(20)
  })
})
```

**Step 2: 실패 확인**

```bash
npm run test -- viewport
```
Expected: FAIL (`viewport.js` 모듈이 없음)

**Step 3: 최소 구현**

```js
// src/core/viewport.js
export function worldToScreen(view, x, y) {
  const { xMin, xMax, yMin, yMax, width, height } = view
  return {
    x: ((x - xMin) / (xMax - xMin)) * width,
    y: height - ((y - yMin) / (yMax - yMin)) * height,
  }
}

export function screenToWorld(view, sx, sy) {
  const { xMin, xMax, yMin, yMax, width, height } = view
  return {
    x: xMin + (sx / width) * (xMax - xMin),
    y: yMin + ((height - sy) / height) * (yMax - yMin),
  }
}

// range 안에 대략 5~10개의 격자선이 들어오도록 1/2/5 * 10^n 중 하나를 고른다.
export function niceGridStep(range, targetTicks = 8) {
  const rough = range / targetTicks
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)))
  const residual = rough / magnitude
  let niceResidual
  if (residual < 1.5) niceResidual = 1
  else if (residual < 3.5) niceResidual = 2
  else if (residual < 7.5) niceResidual = 5
  else niceResidual = 10
  return niceResidual * magnitude
}
```

**Step 4: 통과 확인**

```bash
npm run test -- viewport
```
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add src/core/viewport.js src/core/viewport.test.js
git commit -m "Add viewport coordinate transform and grid-step helpers"
```

---

### Task 2: `mathEngine.js` — 수식 파싱/평가

**Files:**
- Create: `src/core/mathEngine.js`
- Test: `src/core/mathEngine.test.js`

**Step 1: 실패하는 테스트 작성**

```js
// src/core/mathEngine.test.js
import { describe, it, expect } from 'vitest'
import { tryCompileExpression } from './mathEngine'

describe('tryCompileExpression', () => {
  it('compiles and evaluates a polynomial', () => {
    const result = tryCompileExpression('2*x^3 - 6*x + 1')
    expect(result.ok).toBe(true)
    expect(result.compiled.evaluate({ x: 1 })).toBeCloseTo(-3)
  })

  it('supports abs/min/max out of the box', () => {
    expect(tryCompileExpression('abs(x)').compiled.evaluate({ x: -4 })).toBe(4)
    expect(tryCompileExpression('min(x, 2)').compiled.evaluate({ x: 5 })).toBe(2)
  })

  it('supports extra scope variables (parameters)', () => {
    const result = tryCompileExpression('a*(x-2)*(x-b)+9')
    expect(result.compiled.evaluate({ x: 4, a: 3, b: 6 })).toBeCloseTo(-3)
  })

  it('returns ok:false with a message on invalid syntax', () => {
    const result = tryCompileExpression('2*x +* 3')
    expect(result.ok).toBe(false)
    expect(typeof result.error).toBe('string')
  })
})
```

**Step 2: 실패 확인**

```bash
npm run test -- mathEngine
```
Expected: FAIL

**Step 3: 최소 구현**

```js
// src/core/mathEngine.js
import { compile } from 'mathjs'

export function tryCompileExpression(exprString) {
  try {
    const compiled = compile(exprString)
    return { ok: true, compiled }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}
```

**Step 4: 통과 확인**

```bash
npm run test -- mathEngine
```
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add src/core/mathEngine.js src/core/mathEngine.test.js
git commit -m "Add mathEngine wrapper around mathjs compile/evaluate"
```

---

### Task 3: `functionSchema.js` — 조각함수 정의 검증

**Files:**
- Create: `src/core/functionSchema.js`
- Test: `src/core/functionSchema.test.js`

**Step 1: 실패하는 테스트 작성**

```js
// src/core/functionSchema.test.js
import { describe, it, expect } from 'vitest'
import { validatePiecewise } from './functionSchema'

const validDef = {
  type: 'piecewise',
  pieces: [
    { expr: '2*x^3-6*x+1', domain: [null, 2], closedAt: { left: null, right: true } },
    { expr: 'a*(x-2)*(x-b)+9', domain: [2, null], closedAt: { left: false, right: null } },
  ],
}

describe('validatePiecewise', () => {
  it('accepts a well-formed definition', () => {
    const result = validatePiecewise(validDef)
    expect(result.ok).toBe(true)
    expect(result.normalized.pieces).toHaveLength(2)
  })

  it('rejects a definition with no pieces', () => {
    const result = validatePiecewise({ type: 'piecewise', pieces: [] })
    expect(result.ok).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('rejects a piece with an invalid expr', () => {
    const bad = { type: 'piecewise', pieces: [{ expr: '2*x +* 3', domain: [null, null], closedAt: {} }] }
    const result = validatePiecewise(bad)
    expect(result.ok).toBe(false)
  })

  it('rejects overlapping domains', () => {
    const overlapping = {
      type: 'piecewise',
      pieces: [
        { expr: 'x', domain: [null, 3], closedAt: { left: null, right: true } },
        { expr: 'x', domain: [1, null], closedAt: { left: true, right: null } },
      ],
    }
    const result = validatePiecewise(overlapping)
    expect(result.ok).toBe(false)
  })
})
```

**Step 2: 실패 확인**

```bash
npm run test -- functionSchema
```
Expected: FAIL

**Step 3: 최소 구현**

```js
// src/core/functionSchema.js
import { tryCompileExpression } from './mathEngine'

export function validatePiecewise(def) {
  const errors = []

  if (!def || !Array.isArray(def.pieces) || def.pieces.length === 0) {
    return { ok: false, errors: ['at least one piece is required'] }
  }

  const normalizedPieces = def.pieces.map((piece, i) => {
    const compileResult = tryCompileExpression(piece.expr || '')
    if (!compileResult.ok) {
      errors.push(`piece ${i}: invalid expression "${piece.expr}" (${compileResult.error})`)
    }
    const domain = piece.domain ?? [null, null]
    return {
      expr: piece.expr,
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
```

**Step 4: 통과 확인**

```bash
npm run test -- functionSchema
```
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add src/core/functionSchema.js src/core/functionSchema.test.js
git commit -m "Add piecewise function schema validation"
```

---

### Task 4: `piecewiseFunction.js` — 평가 가능한 함수 객체

**Files:**
- Create: `src/core/piecewiseFunction.js`
- Test: `src/core/piecewiseFunction.test.js`

**Step 1: 실패하는 테스트 작성**

```js
// src/core/piecewiseFunction.test.js
import { describe, it, expect } from 'vitest'
import { buildPiecewiseFunction } from './piecewiseFunction'

const def = {
  type: 'piecewise',
  pieces: [
    { expr: '2*x^3-6*x+1', domain: [null, 2], closedAt: { left: null, right: true } },
    { expr: 'a*(x-2)*(x-b)+9', domain: [2, null], closedAt: { left: false, right: null } },
  ],
}

describe('buildPiecewiseFunction', () => {
  it('evaluates the correct piece depending on x', () => {
    const f = buildPiecewiseFunction(def, { a: 3, b: 6 })
    expect(f.evaluateAt(1)).toBeCloseTo(-3) // left piece
    expect(f.evaluateAt(4)).toBeCloseTo(-3) // right piece vertex
  })

  it('respects open/closed boundary at x=2', () => {
    const f = buildPiecewiseFunction(def, { a: 3, b: 6 })
    expect(f.evaluateAt(2)).toBeCloseTo(5) // closed on the left piece -> included
    expect(Number.isNaN(f.evaluateAt(2.0000001))).toBe(false) // right piece open but 2.0000001 > 2 so included
  })

  it('returns NaN outside every domain (should not normally happen with -Inf/+Inf pieces)', () => {
    const singlePiece = {
      type: 'piecewise',
      pieces: [{ expr: 'x', domain: [0, 1], closedAt: { left: true, right: true } }],
    }
    const f = buildPiecewiseFunction(singlePiece, {})
    expect(Number.isNaN(f.evaluateAt(5))).toBe(true)
  })
})
```

**Step 2: 실패 확인**

```bash
npm run test -- piecewiseFunction
```
Expected: FAIL

**Step 3: 최소 구현**

```js
// src/core/piecewiseFunction.js
import { tryCompileExpression } from './mathEngine'

function contains(piece, x) {
  const [min, max] = piece.domain
  const lo = min === null || min === undefined ? -Infinity : min
  const hi = max === null || max === undefined ? Infinity : max
  if (x < lo || x > hi) return false
  if (x === lo && piece.closedAt.left === false) return false
  if (x === hi && piece.closedAt.right === false) return false
  return true
}

export function buildPiecewiseFunction(def, params = {}) {
  const pieces = def.pieces.map((piece) => {
    const { compiled } = { compiled: tryCompileExpression(piece.expr).compiled }
    return {
      domain: piece.domain,
      closedAt: piece.closedAt,
      evaluate: (x) => compiled.evaluate({ x, ...params }),
    }
  })

  function evaluateAt(x) {
    const piece = pieces.find((p) => contains(p, x))
    return piece ? piece.evaluate(x) : NaN
  }

  return { pieces, contains, evaluateAt }
}
```

**Step 4: 통과 확인**

```bash
npm run test -- piecewiseFunction
```
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/core/piecewiseFunction.js src/core/piecewiseFunction.test.js
git commit -m "Add piecewiseFunction evaluator with domain/boundary handling"
```

---

### Task 5: `rootFinder.js` — solution_count 핵심 로직

이 모듈이 앱의 핵심 가치(교점 개수 연동)를 구현하는 부분이라 테스트를 가장 두껍게 둔다. 52번 문제 값을 회귀 테스트로 그대로 사용한다.

**Files:**
- Create: `src/core/rootFinder.js`
- Test: `src/core/rootFinder.test.js`

**Step 1: 실패하는 테스트 작성**

```js
// src/core/rootFinder.test.js
import { describe, it, expect } from 'vitest'
import { buildPiecewiseFunction } from './piecewiseFunction'
import { findRoots, solutionCount } from './rootFinder'

describe('findRoots / solutionCount — basic parabola', () => {
  const f = buildPiecewiseFunction(
    { type: 'piecewise', pieces: [{ expr: 'x^2', domain: [null, null], closedAt: {} }] },
    {}
  )

  it('finds two roots for x^2 = 4', () => {
    const roots = findRoots(f, 4, [-10, 10])
    expect(roots).toHaveLength(2)
    expect(roots[0]).toBeCloseTo(-2, 3)
    expect(roots[1]).toBeCloseTo(2, 3)
  })

  it('finds one (tangent) root for x^2 = 0', () => {
    expect(solutionCount(f, 0, [-10, 10])).toBe(1)
  })

  it('finds zero roots for x^2 = -1', () => {
    expect(solutionCount(f, -1, [-10, 10])).toBe(0)
  })
})

describe('solutionCount — 52번 문제 회귀 테스트', () => {
  const def = {
    type: 'piecewise',
    pieces: [
      { expr: '2*x^3-6*x+1', domain: [null, 2], closedAt: { left: null, right: true } },
      { expr: '3*(x-2)*(x-6)+9', domain: [2, null], closedAt: { left: false, right: null } },
    ],
  }
  const f = buildPiecewiseFunction(def, {})
  const range = [-10, 10]

  it('matches L(t) table for the left cubic piece alone', () => {
    const leftOnly = buildPiecewiseFunction(
      { type: 'piecewise', pieces: [def.pieces[0]] },
      {}
    )
    expect(solutionCount(leftOnly, -4, range)).toBe(1)
    expect(solutionCount(leftOnly, -3, range)).toBe(2)
    expect(solutionCount(leftOnly, 0, range)).toBe(3)
    expect(solutionCount(leftOnly, 5, range)).toBe(2)
    expect(solutionCount(leftOnly, 6, range)).toBe(0)
  })

  it('matches R(t) table for the right parabola piece alone (a=3,b=6, m=-3)', () => {
    const rightOnly = buildPiecewiseFunction(
      { type: 'piecewise', pieces: [def.pieces[1]] },
      {}
    )
    expect(solutionCount(rightOnly, -4, range)).toBe(0)
    expect(solutionCount(rightOnly, -3, range)).toBe(1)
    expect(solutionCount(rightOnly, 0, range)).toBe(2)
    expect(solutionCount(rightOnly, 9, range)).toBe(1)
  })

  it('combined g(t)=L(t)+R(t) has the g(k-)+g(k)+g(k+)=9 signal only at k=-3', () => {
    const below = solutionCount(f, -3 - 1e-3, range)
    const at = solutionCount(f, -3, range)
    const above = solutionCount(f, -3 + 1e-3, range)
    expect(below).toBe(1)
    expect(at).toBe(3)
    expect(above).toBe(5)
    expect(below + at + above).toBe(9)
  })
})
```

**Step 2: 실패 확인**

```bash
npm run test -- rootFinder
```
Expected: FAIL (모듈 없음)

**Step 3: 최소 구현**

```js
// src/core/rootFinder.js

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
export function findRoots(piecewiseFn, t, searchRange, samples = 1000) {
  const roots = []

  piecewiseFn.pieces.forEach((piece) => {
    const [pMin, pMax] = piece.domain
    const lo = Math.max(pMin === null || pMin === undefined ? -Infinity : pMin, searchRange[0])
    const hi = Math.min(pMax === null || pMax === undefined ? Infinity : pMax, searchRange[1])
    if (lo >= hi) return

    const step = (hi - lo) / samples
    const f = (x) => piece.evaluate(x) - t

    let prevX = lo
    let prevVal = f(prevX)

    for (let i = 1; i <= samples; i++) {
      const x = lo + step * i
      const val = f(x)

      if (prevVal === 0 && piecewiseFn.contains(piece, prevX)) {
        roots.push(prevX)
      } else if (prevVal * val < 0) {
        const root = bisect(f, prevX, x)
        if (piecewiseFn.contains(piece, root)) roots.push(root)
      }

      prevX = x
      prevVal = val
    }

    if (prevVal === 0 && piecewiseFn.contains(piece, prevX)) {
      roots.push(prevX)
    }
  })

  return dedupeSorted(roots)
}

export function solutionCount(piecewiseFn, t, searchRange, samples) {
  return findRoots(piecewiseFn, t, searchRange, samples).length
}
```

**Step 4: 통과 확인**

```bash
npm run test -- rootFinder
```
Expected: PASS (7 tests)

**Step 5: Commit**

```bash
git add src/core/rootFinder.js src/core/rootFinder.test.js
git commit -m "Add numeric root finder powering solution_count"
```

---

### Task 6: `canvasRenderer.js` — 순수 드로잉 함수

**Files:**
- Create: `src/core/canvasRenderer.js`
- Test: `src/core/canvasRenderer.test.js`

Canvas 실제 렌더링 품질은 육안 확인(Task 7 이후 dev 서버)으로 검증하고, 여기서는 mock 2D context로 "올바른 API 호출이 일어나는지"만 스모크 테스트한다.

**Step 1: 실패하는 테스트 작성**

```js
// src/core/canvasRenderer.test.js
import { describe, it, expect, vi } from 'vitest'
import { drawAxes, drawCurve, drawPointMarker } from './canvasRenderer'

function createMockCtx() {
  return {
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    clearRect: vi.fn(),
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 1,
  }
}

const view = { xMin: -5, xMax: 5, yMin: -5, yMax: 5, width: 400, height: 400 }

describe('drawAxes', () => {
  it('draws x and y axis lines', () => {
    const ctx = createMockCtx()
    drawAxes(ctx, view)
    expect(ctx.moveTo).toHaveBeenCalled()
    expect(ctx.lineTo).toHaveBeenCalled()
    expect(ctx.stroke).toHaveBeenCalled()
  })
})

describe('drawCurve', () => {
  it('samples the function and strokes a path', () => {
    const ctx = createMockCtx()
    drawCurve(ctx, view, (x) => x * x, { xMin: -5, xMax: 5 }, 50)
    expect(ctx.moveTo).toHaveBeenCalledTimes(1)
    expect(ctx.lineTo.mock.calls.length).toBeGreaterThan(10)
    expect(ctx.stroke).toHaveBeenCalled()
  })

  it('skips NaN segments without throwing', () => {
    const ctx = createMockCtx()
    const f = (x) => (x > 0 ? x : NaN)
    expect(() => drawCurve(ctx, view, f, { xMin: -5, xMax: 5 }, 20)).not.toThrow()
  })
})

describe('drawPointMarker', () => {
  it('draws a filled circle for a closed point', () => {
    const ctx = createMockCtx()
    drawPointMarker(ctx, view, 0, 0, { closed: true })
    expect(ctx.arc).toHaveBeenCalled()
    expect(ctx.fill).toHaveBeenCalled()
  })

  it('draws a stroked (open) circle for an open point', () => {
    const ctx = createMockCtx()
    drawPointMarker(ctx, view, 0, 0, { closed: false })
    expect(ctx.arc).toHaveBeenCalled()
    expect(ctx.stroke).toHaveBeenCalled()
  })
})
```

**Step 2: 실패 확인**

```bash
npm run test -- canvasRenderer
```
Expected: FAIL

**Step 3: 최소 구현**

```js
// src/core/canvasRenderer.js
import { worldToScreen } from './viewport'

export function drawAxes(ctx, view) {
  const origin = worldToScreen(view, 0, 0)
  ctx.save()
  ctx.strokeStyle = '#888'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, origin.y)
  ctx.lineTo(view.width, origin.y)
  ctx.moveTo(origin.x, 0)
  ctx.lineTo(origin.x, view.height)
  ctx.stroke()
  ctx.restore()
}

// fn: (x) => y | NaN.  range: {xMin, xMax} (도메인/뷰포트 교집합은 호출자가 결정)
export function drawCurve(ctx, view, fn, range, samples = 300) {
  const step = (range.xMax - range.xMin) / samples
  ctx.save()
  ctx.strokeStyle = '#2563eb'
  ctx.lineWidth = 2
  ctx.beginPath()

  let penDown = false
  for (let i = 0; i <= samples; i++) {
    const x = range.xMin + step * i
    const y = fn(x)
    if (Number.isNaN(y) || !Number.isFinite(y)) {
      penDown = false
      continue
    }
    const { x: sx, y: sy } = worldToScreen(view, x, y)
    if (!penDown) {
      ctx.moveTo(sx, sy)
      penDown = true
    } else {
      ctx.lineTo(sx, sy)
    }
  }
  ctx.stroke()
  ctx.restore()
}

export function drawPointMarker(ctx, view, x, y, { closed, color = '#2563eb', radius = 5 } = {}) {
  const { x: sx, y: sy } = worldToScreen(view, x, y)
  ctx.save()
  ctx.beginPath()
  ctx.arc(sx, sy, radius, 0, 2 * Math.PI)
  if (closed) {
    ctx.fillStyle = color
    ctx.fill()
  } else {
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.stroke()
  }
  ctx.restore()
}
```

**Step 4: 통과 확인**

```bash
npm run test -- canvasRenderer
```
Expected: PASS (5 tests)

**Step 5: Commit**

```bash
git add src/core/canvasRenderer.js src/core/canvasRenderer.test.js
git commit -m "Add pure canvas drawing helpers (axes, curve, point markers)"
```

---

### Task 7: `state/store.js` — 전역 상태

**Files:**
- Create: `src/state/store.js`
- Test: `src/state/store.test.js`

**Step 1: 실패하는 테스트 작성**

```js
// src/state/store.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from './store'

describe('useAppStore', () => {
  beforeEach(() => {
    useAppStore.setState(useAppStore.getInitialState())
  })

  it('has a default t of 0', () => {
    expect(useAppStore.getState().t).toBe(0)
  })

  it('setT updates t', () => {
    useAppStore.getState().setT(3.5)
    expect(useAppStore.getState().t).toBe(3.5)
  })

  it('setParam updates a named parameter', () => {
    useAppStore.getState().setParam('a', 3)
    useAppStore.getState().setParam('b', 6)
    expect(useAppStore.getState().params).toEqual({ a: 3, b: 6 })
  })

  it('setLeftFunctionSource stores the raw editor text separately from the parsed def', () => {
    useAppStore.getState().setLeftFunctionSource('x^2')
    expect(useAppStore.getState().leftFunctionSource).toBe('x^2')
  })
})
```

**Step 2: 실패 확인**

```bash
npm run test -- store
```
Expected: FAIL

**Step 3: 최소 구현**

```js
// src/state/store.js
import { create } from 'zustand'

export const useAppStore = create((set, get) => ({
  t: 0,
  params: {},
  leftFunctionSource: '',
  leftFunctionDef: null,
  trace: [],
  traceOn: false,

  setT: (t) => set({ t }),
  setParam: (name, value) => set((s) => ({ params: { ...s.params, [name]: value } })),
  setLeftFunctionSource: (source) => set({ leftFunctionSource: source }),
  setLeftFunctionDef: (def) => set({ leftFunctionDef: def }),
  toggleTrace: () => set((s) => ({ traceOn: !s.traceOn })),
  pushTracePoint: (point) =>
    set((s) => (s.traceOn ? { trace: [...s.trace, point] } : {})),
  clearTrace: () => set({ trace: [] }),
}))
```

**Step 4: 통과 확인**

```bash
npm run test -- store
```
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add src/state/store.js src/state/store.test.js
git commit -m "Add Zustand store for t, params, and left function definition"
```

---

### Task 8: `GraphCanvas.jsx` — 캔버스 컴포넌트 (축/격자/줌팬)

**Files:**
- Create: `src/components/GraphCanvas.jsx`
- Test: `src/components/GraphCanvas.test.jsx`

**Step 1: 실패하는 테스트 작성 (스모크 테스트)**

```jsx
// src/components/GraphCanvas.test.jsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { GraphCanvas } from './GraphCanvas'

describe('GraphCanvas', () => {
  it('renders a canvas element without crashing', () => {
    const { container } = render(<GraphCanvas curves={[]} points={[]} />)
    expect(container.querySelector('canvas')).toBeInTheDocument()
  })
})
```

**Step 2: 실패 확인**

```bash
npm run test -- GraphCanvas
```
Expected: FAIL

**Step 3: 구현**

```jsx
// src/components/GraphCanvas.jsx
import { useRef, useEffect, useState, useCallback } from 'react'
import { drawAxes, drawCurve, drawPointMarker } from '../core/canvasRenderer'

const DEFAULT_VIEW = { xMin: -8, xMax: 8, yMin: -8, yMax: 8 }

// curves: [{ fn: (x)=>y, range: {xMin,xMax} }]
// points: [{ x, y, closed }]
// onViewChange: (view) => void  — 부모가 t 드래그 등에 재사용할 수 있도록 현재 뷰를 알려줌
export function GraphCanvas({ curves, points, width = 400, height = 400, onCanvasClick }) {
  const canvasRef = useRef(null)
  const [worldView, setWorldView] = useState(DEFAULT_VIEW)

  const view = { ...worldView, width, height }

  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, width, height)
    drawAxes(ctx, view)
    curves.forEach(({ fn, range }) => drawCurve(ctx, view, fn, range))
    points.forEach((p) => drawPointMarker(ctx, view, p.x, p.y, { closed: p.closed }))
  }, [curves, points, view, width, height])

  useEffect(() => {
    render()
  }, [render])

  function handleWheel(e) {
    e.preventDefault()
    const scale = e.deltaY > 0 ? 1.1 : 0.9
    setWorldView((v) => {
      const cx = (v.xMin + v.xMax) / 2
      const cy = (v.yMin + v.yMax) / 2
      const halfW = ((v.xMax - v.xMin) / 2) * scale
      const halfH = ((v.yMax - v.yMin) / 2) * scale
      return { xMin: cx - halfW, xMax: cx + halfW, yMin: cy - halfH, yMax: cy + halfH }
    })
  }

  let dragStart = null
  function handleMouseDown(e) {
    dragStart = { x: e.clientX, y: e.clientY, view: worldView }
  }
  function handleMouseMove(e) {
    if (!dragStart) return
    const dx = (e.clientX - dragStart.x) / width * (dragStart.view.xMax - dragStart.view.xMin)
    const dy = (e.clientY - dragStart.y) / height * (dragStart.view.yMax - dragStart.view.yMin)
    setWorldView({
      xMin: dragStart.view.xMin - dx,
      xMax: dragStart.view.xMax - dx,
      yMin: dragStart.view.yMin + dy,
      yMax: dragStart.view.yMax + dy,
    })
  }
  function handleMouseUp() {
    dragStart = null
  }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={(e) => onCanvasClick?.(e, view)}
    />
  )
}
```

**Step 4: 통과 확인**

```bash
npm run test -- GraphCanvas
```
Expected: PASS (1 test)

**Step 5: 수동 확인**

```bash
npm run dev
```
`App.jsx`에 임시로 `<GraphCanvas curves={[{fn: x=>x*x, range:{xMin:-5,xMax:5}}]} points={[]} />`를 렌더링해서 포물선이 그려지는지, 휠로 줌이 되는지, 드래그로 팬이 되는지 브라우저에서 직접 확인한다.

**Step 6: Commit**

```bash
git add src/components/GraphCanvas.jsx src/components/GraphCanvas.test.jsx
git commit -m "Add GraphCanvas component with zoom/pan"
```

---

### Task 9: `EquationInput.jsx` — 수식 입력 + 파싱 연결

**Files:**
- Create: `src/components/EquationInput.jsx`
- Test: `src/components/EquationInput.test.jsx`

**Step 1: 실패하는 테스트 작성**

```jsx
// src/components/EquationInput.test.jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EquationInput } from './EquationInput'

describe('EquationInput', () => {
  it('calls onChange with the raw text as the user types', async () => {
    const onChange = vi.fn()
    render(<EquationInput value="" onChange={onChange} error={null} />)
    const editor = screen.getByRole('textbox')
    await userEvent.type(editor, 'x')
    expect(onChange).toHaveBeenCalled()
  })

  it('shows the error message when error prop is set', () => {
    render(<EquationInput value="x +* 1" onChange={() => {}} error="Unexpected token" />)
    expect(screen.getByText(/Unexpected token/)).toBeInTheDocument()
  })
})
```

**Step 2: 실패 확인**

```bash
npm run test -- EquationInput
```
Expected: FAIL

**Step 3: 구현** (기본은 `@uiw/react-codemirror`, 자동완성은 함수명 4개로 한정)

```jsx
// src/components/EquationInput.jsx
import CodeMirror from '@uiw/react-codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { autocompletion } from '@codemirror/autocomplete'

const FUNCTION_NAMES = ['abs', 'min', 'max', 'sqrt']

function completions(context) {
  const word = context.matchBefore(/\w*/)
  if (!word || (word.from === word.to && !context.explicit)) return null
  return {
    from: word.from,
    options: FUNCTION_NAMES.map((name) => ({ label: name, type: 'function' })),
  }
}

export function EquationInput({ value, onChange, error }) {
  return (
    <div>
      <CodeMirror
        value={value}
        height="2.5em"
        basicSetup={{ lineNumbers: false, foldGutter: false }}
        extensions={[javascript(), autocompletion({ override: [completions] })]}
        onChange={onChange}
      />
      {error && <div style={{ color: '#dc2626', fontSize: '0.85em' }}>{error}</div>}
    </div>
  )
}
```

**Step 4: 통과 확인**

```bash
npm run test -- EquationInput
```
Expected: PASS (2 tests) — CodeMirror 내부 textarea가 `role=textbox`로 잡히는지 라이브러리 버전에 따라 다를 수 있음. 실패 시 `screen.getByRole('textbox')` 대신 `container.querySelector('.cm-content')`로 대체.

**Step 5: Commit**

```bash
git add src/components/EquationInput.jsx src/components/EquationInput.test.jsx
git commit -m "Add EquationInput with CodeMirror and basic function-name autocomplete"
```

---

### Task 10: 왼쪽 패널 조립 — 타이핑 → 그래프

**Files:**
- Create: `src/components/Panel.jsx`
- Modify: `src/App.jsx`

**Step 1: 구현**

```jsx
// src/components/Panel.jsx
import { useMemo } from 'react'
import { GraphCanvas } from './GraphCanvas'
import { EquationInput } from './EquationInput'
import { validatePiecewise } from '../core/functionSchema'
import { buildPiecewiseFunction } from '../core/piecewiseFunction'
import { tryCompileExpression } from '../core/mathEngine'

// 단일 수식(비-piecewise) 입력을 임시로 지원: EquationInput에 'x^2' 같은 한 줄만 입력받아
// piecewise 스키마의 단일 조각으로 감싼다. (조각함수 UI는 Task 12에서 확장)
export function Panel({ source, onSourceChange, params }) {
  const parsed = useMemo(() => {
    const compileResult = tryCompileExpression(source || '0')
    if (!compileResult.ok) return { error: compileResult.error }

    const def = { type: 'piecewise', pieces: [{ expr: source || '0', domain: [null, null], closedAt: {} }] }
    const validation = validatePiecewise(def)
    if (!validation.ok) return { error: validation.errors.join('; ') }

    return { def: validation.normalized }
  }, [source])

  const fn = parsed.def ? buildPiecewiseFunction(parsed.def, params) : null

  const curves = fn ? [{ fn: fn.evaluateAt, range: { xMin: -8, xMax: 8 } }] : []

  return (
    <div>
      <GraphCanvas curves={curves} points={[]} />
      <EquationInput value={source} onChange={onSourceChange} error={parsed.error} />
    </div>
  )
}
```

```jsx
// src/App.jsx
import { useAppStore } from './state/store'
import { Panel } from './components/Panel'

export default function App() {
  const leftFunctionSource = useAppStore((s) => s.leftFunctionSource)
  const setLeftFunctionSource = useAppStore((s) => s.setLeftFunctionSource)
  const params = useAppStore((s) => s.params)

  return (
    <div style={{ display: 'flex', gap: '1rem', padding: '1rem' }}>
      <Panel source={leftFunctionSource} onSourceChange={setLeftFunctionSource} params={params} />
    </div>
  )
}
```

**Step 2: 수동 확인**

```bash
npm run dev
```
입력창에 `x^2`를 타이핑하면 왼쪽 그래프에 포물선이 그려지는지 확인. `x +* 1`처럼 틀린 수식을 넣으면 에러 메시지가 뜨는지 확인.

**Step 3: Commit**

```bash
git add src/components/Panel.jsx src/App.jsx
git commit -m "Wire typed equation input to live-rendered graph"
```

---

### Task 11: 조각함수 UI — 조각 추가/삭제 + 열린/닫힌점

**Files:**
- Modify: `src/components/Panel.jsx`
- Test: `src/components/Panel.test.jsx`

**Step 1: 실패하는 테스트 작성**

```jsx
// src/components/Panel.test.jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Panel } from './Panel'

describe('Panel — piecewise editing', () => {
  it('starts with one piece row and can add another', async () => {
    render(<Panel pieces={[{ expr: 'x', domain: [null, null], closedAt: {} }]} onPiecesChange={vi.fn()} params={{}} />)
    expect(screen.getAllByLabelText(/piece expression/i)).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: /add piece/i }))
    // onPiecesChange가 호출되었는지만 확인 (부모가 상태를 갱신하는 구조)
  })
})
```

**Step 2: 실패 확인**

```bash
npm run test -- Panel
```
Expected: FAIL

**Step 3: `Panel.jsx`를 여러 조각을 다루도록 리팩터링**

`source: string` 대신 `pieces: [{expr, domain:[min,max], closedAt}]` 배열을 props로 받도록 변경. 각 조각 행에 `expr` 입력(EquationInput 재사용), 도메인 min/max 숫자 입력 2개, 왼쪽/오른쪽 닫힘 체크박스 2개, 삭제 버튼을 둔다. 상단에 "조각 추가" 버튼.

```jsx
// src/components/Panel.jsx (교체)
import { useMemo } from 'react'
import { GraphCanvas } from './GraphCanvas'
import { EquationInput } from './EquationInput'
import { validatePiecewise } from '../core/functionSchema'
import { buildPiecewiseFunction } from '../core/piecewiseFunction'

const EMPTY_PIECE = { expr: 'x', domain: [null, null], closedAt: { left: true, right: true } }

export function Panel({ pieces, onPiecesChange, params }) {
  const parsed = useMemo(() => {
    const validation = validatePiecewise({ type: 'piecewise', pieces })
    return validation.ok ? { def: validation.normalized } : { error: validation.errors.join('; ') }
  }, [pieces])

  const fn = parsed.def ? buildPiecewiseFunction(parsed.def, params) : null
  const curves = fn
    ? fn.pieces.map((p) => ({
        fn: (x) => (fn.contains(p, x) ? p.evaluate(x) : NaN),
        range: {
          xMin: p.domain[0] ?? -8,
          xMax: p.domain[1] ?? 8,
        },
      }))
    : []

  function updatePiece(index, patch) {
    const next = pieces.map((p, i) => (i === index ? { ...p, ...patch } : p))
    onPiecesChange(next)
  }

  function addPiece() {
    onPiecesChange([...pieces, { ...EMPTY_PIECE }])
  }

  function removePiece(index) {
    onPiecesChange(pieces.filter((_, i) => i !== index))
  }

  return (
    <div>
      <GraphCanvas curves={curves} points={[]} />
      {pieces.map((piece, i) => (
        <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <label>
            piece expression
            <EquationInput
              value={piece.expr}
              onChange={(expr) => updatePiece(i, { expr })}
              error={null}
            />
          </label>
          <input
            type="number"
            aria-label="domain min"
            value={piece.domain[0] ?? ''}
            placeholder="-inf"
            onChange={(e) => updatePiece(i, { domain: [e.target.value === '' ? null : Number(e.target.value), piece.domain[1]] })}
          />
          <input
            type="number"
            aria-label="domain max"
            value={piece.domain[1] ?? ''}
            placeholder="+inf"
            onChange={(e) => updatePiece(i, { domain: [piece.domain[0], e.target.value === '' ? null : Number(e.target.value)] })}
          />
          <button onClick={() => removePiece(i)}>삭제</button>
        </div>
      ))}
      <button onClick={addPiece}>조각 추가</button>
      {parsed.error && <div style={{ color: '#dc2626' }}>{parsed.error}</div>}
    </div>
  )
}
```

**Step 4: 테스트 라벨 정리 후 통과 확인**

`EquationInput`의 CodeMirror 인스턴스에 접근성 라벨을 붙이기 어려우면, 테스트는 `getAllByLabelText`가 아니라 `container.querySelectorAll('.cm-editor')`로 개수를 세는 방식으로 조정한다. 실제 구현하면서 CodeMirror의 DOM 구조를 보고 맞춘다.

```bash
npm run test -- Panel
```
Expected: PASS

**Step 5: `App.jsx`를 pieces 배열 기반으로 갱신, 수동 확인**

52번 문제의 두 조각을 직접 입력해서 x=2 경계에서 닫힌/열린점이 올바르게(닫힌 원 vs 빈 원) 그려지는지 확인.

**Step 6: Commit**

```bash
git add src/components/Panel.jsx src/components/Panel.test.jsx src/App.jsx
git commit -m "Support multi-piece function editing with domain and open/closed boundaries"
```

---

### Task 12: 열린/닫힌점 마커를 GraphCanvas에 자동 표시

**Files:**
- Modify: `src/components/Panel.jsx`

**Step 1: 구현**

각 piece의 도메인 경계값에서 `evaluate`한 좌표를 `points` 배열로 만들어 `GraphCanvas`에 넘긴다. `closedAt.left`/`right`가 `null`(무한대라 경계가 없음)이면 마커를 만들지 않는다.

```jsx
// Panel.jsx 안, curves 계산 아래에 추가
const points = fn
  ? fn.pieces.flatMap((p) => {
      const marks = []
      const [lo, hi] = p.domain
      if (lo !== null && lo !== undefined && p.closedAt.left !== null && p.closedAt.left !== undefined) {
        marks.push({ x: lo, y: p.evaluate(lo), closed: p.closedAt.left })
      }
      if (hi !== null && hi !== undefined && p.closedAt.right !== null && p.closedAt.right !== undefined) {
        marks.push({ x: hi, y: p.evaluate(hi), closed: p.closedAt.right })
      }
      return marks
    })
  : []
```

`<GraphCanvas curves={curves} points={points} />`로 전달.

**Step 2: 수동 확인**

52번 문제의 `x=2` 경계에서 왼쪽 조각은 닫힌 원(●), 오른쪽 조각은 빈 원(○)이 겹쳐 그려지는지 확인.

**Step 3: Commit**

```bash
git add src/components/Panel.jsx
git commit -m "Auto-render open/closed boundary markers from piece domains"
```

---

### Task 13: 미지 변수 감지 → 파라미터 슬라이더 자동생성

**Files:**
- Create: `src/core/freeVariables.js`
- Test: `src/core/freeVariables.test.js`
- Create: `src/components/ParamSliders.jsx`

**Step 1: 실패하는 테스트 작성**

```js
// src/core/freeVariables.test.js
import { describe, it, expect } from 'vitest'
import { detectFreeVariables } from './freeVariables'

describe('detectFreeVariables', () => {
  it('finds parameters excluding x and known built-in function names', () => {
    const vars = detectFreeVariables(['a*(x-2)*(x-b)+9', '2*x^3-6*x+1'], ['x'])
    expect(vars.sort()).toEqual(['a', 'b'])
  })

  it('returns an empty array when there are no free variables', () => {
    expect(detectFreeVariables(['x^2 + abs(x)'], ['x'])).toEqual([])
  })
})
```

**Step 2: 실패 확인**

```bash
npm run test -- freeVariables
```
Expected: FAIL

**Step 3: 구현** (math.js의 `parse(...).filter()`로 SymbolNode 추출, math.js 내장 함수명은 제외)

```js
// src/core/freeVariables.js
import { parse, FunctionNode } from 'mathjs'

const BUILTIN_NAMES = new Set(['abs', 'min', 'max', 'sqrt', 'pi', 'e'])

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
        const isFunctionName = parent instanceof FunctionNode && parent.fn === n
        if (!isFunctionName && !bound.has(n.name) && !BUILTIN_NAMES.has(n.name)) {
          found.add(n.name)
        }
      }
    })
  })

  return [...found]
}
```

**Step 4: 통과 확인**

```bash
npm run test -- freeVariables
```
Expected: PASS (2 tests)

**Step 5: `ParamSliders.jsx` 구현**

```jsx
// src/components/ParamSliders.jsx
export function ParamSliders({ names, values, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '1rem' }}>
      {names.map((name) => (
        <label key={name}>
          {name} = {values[name] ?? 1}
          <input
            type="range"
            min={-20}
            max={20}
            step={0.5}
            value={values[name] ?? 1}
            onChange={(e) => onChange(name, Number(e.target.value))}
          />
        </label>
      ))}
    </div>
  )
}
```

**Step 6: Panel/App에 연결**

`Panel`에서 `detectFreeVariables(pieces.map(p => p.expr), ['x'])`로 이름 목록을 구하고, 스토어의 `params`/`setParam`과 함께 `ParamSliders`를 렌더링한다.

**Step 7: 수동 확인**

52번 문제 입력 후 `a`, `b` 슬라이더가 자동으로 나타나고, 움직이면 오른쪽 조각 포물선이 실시간으로 변형되는지 확인.

**Step 8: Commit**

```bash
git add src/core/freeVariables.js src/core/freeVariables.test.js src/components/ParamSliders.jsx src/components/Panel.jsx
git commit -m "Auto-generate parameter sliders for undefined variables in expressions"
```

---

### Task 14: LinkBar + `y=t` 드래그 → 연동함수 패널

**Files:**
- Create: `src/components/LinkBar.jsx`
- Modify: `src/components/GraphCanvas.jsx` (드래그 가능한 `y=t` 선 옵션 추가)
- Modify: `src/App.jsx` (오른쪽 패널 추가, `solutionCount` 연동)

**Step 1: `GraphCanvas`에 `horizontalLine` prop 추가**

```jsx
// GraphCanvas.jsx — props에 horizontalLine={{ y: t, onDrag: (newY) => void }} 추가
// render() 안, drawAxes 다음 줄에 추가:
if (horizontalLine) {
  const { x: x0, y: sy } = worldToScreen(view, view.xMin, horizontalLine.y)
  const { x: x1 } = worldToScreen(view, view.xMax, horizontalLine.y)
  ctx.save()
  ctx.strokeStyle = '#dc2626'
  ctx.setLineDash([6, 4])
  ctx.beginPath()
  ctx.moveTo(x0, sy)
  ctx.lineTo(x1, sy)
  ctx.stroke()
  ctx.restore()
}
```

드래그 처리는 기존 `handleMouseMove`에 "y=t 선 근처를 클릭했는지" 판정 로직을 추가하고, 근처면 팬 대신 `horizontalLine.onDrag(newWorldY)`를 호출하도록 분기한다 (정확한 픽셀 임계값은 구현하며 조정, 예: 8px 이내).

**Step 2: `LinkBar.jsx` 구현**

```jsx
// src/components/LinkBar.jsx
export function LinkBar({ t }) {
  return (
    <div style={{ textAlign: 'center', padding: '0.5rem', borderTop: '1px solid #ddd' }}>
      현재 t = {t.toFixed(2)} — 왼쪽 그래프의 <b>y=t</b>와 오른쪽 그래프의 <b>x=t</b>는 같은 값입니다.
    </div>
  )
}
```

**Step 3: `App.jsx`에서 오른쪽 패널 연결**

오른쪽 패널은 별도의 `Panel`이 아니라, 왼쪽 함수의 `solutionCount(t)`를 계산해 점 하나(또는 trace)를 그리는 전용 컴포넌트로 둔다 (Task 15에서 분리).

```jsx
// App.jsx
import { useAppStore } from './state/store'
import { Panel } from './components/Panel'
import { LinkBar } from './components/LinkBar'
import { LinkedFunctionPanel } from './components/LinkedFunctionPanel' // Task 15에서 생성

export default function App() {
  const t = useAppStore((s) => s.t)
  const setT = useAppStore((s) => s.setT)
  const pieces = useAppStore((s) => s.leftPieces)
  const setPieces = useAppStore((s) => s.setLeftPieces)
  const params = useAppStore((s) => s.params)

  return (
    <div>
      <div style={{ display: 'flex', gap: '1rem', padding: '1rem', flexWrap: 'wrap' }}>
        <Panel pieces={pieces} onPiecesChange={setPieces} params={params} horizontalLineT={t} onTChange={setT} />
        <LinkedFunctionPanel pieces={pieces} params={params} t={t} />
      </div>
      <LinkBar t={t} />
    </div>
  )
}
```

(`leftPieces`/`setLeftPieces`를 store에 추가하는 작은 변경 포함 — Task 7 스토어 확장.)

**Step 4: 수동 확인**

왼쪽 그래프의 빨간 점선(`y=t`)을 마우스로 드래그하면 LinkBar의 t 값이 실시간으로 바뀌는지 확인.

**Step 5: Commit**

```bash
git add src/components/LinkBar.jsx src/components/GraphCanvas.jsx src/App.jsx src/state/store.js
git commit -m "Add draggable y=t line and LinkBar showing synchronized t value"
```

---

### Task 15: `LinkedFunctionPanel.jsx` — h(t) 계산 + Trace On

**Files:**
- Create: `src/components/LinkedFunctionPanel.jsx`
- Test: `src/components/LinkedFunctionPanel.test.jsx`

**Step 1: 실패하는 테스트 작성**

```jsx
// src/components/LinkedFunctionPanel.test.jsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LinkedFunctionPanel } from './LinkedFunctionPanel'

const pieces = [
  { expr: '2*x^3-6*x+1', domain: [null, 2], closedAt: { left: null, right: true } },
  { expr: '3*(x-2)*(x-6)+9', domain: [2, null], closedAt: { left: false, right: null } },
]

describe('LinkedFunctionPanel', () => {
  it('shows the correct solution count for t=-3', () => {
    render(<LinkedFunctionPanel pieces={pieces} params={{}} t={-3} />)
    expect(screen.getByText(/h\(-3(\.00)?\)\s*=\s*3/)).toBeInTheDocument()
  })
})
```

**Step 2: 실패 확인**

```bash
npm run test -- LinkedFunctionPanel
```
Expected: FAIL

**Step 3: 구현**

```jsx
// src/components/LinkedFunctionPanel.jsx
import { useEffect, useMemo, useState } from 'react'
import { GraphCanvas } from './GraphCanvas'
import { buildPiecewiseFunction } from '../core/piecewiseFunction'
import { solutionCount } from '../core/rootFinder'

const SEARCH_RANGE = [-8, 8]

export function LinkedFunctionPanel({ pieces, params, t, traceOn = false }) {
  const fn = useMemo(() => buildPiecewiseFunction({ type: 'piecewise', pieces }, params), [pieces, params])
  const count = useMemo(() => solutionCount(fn, t, SEARCH_RANGE), [fn, t])

  const [trace, setTrace] = useState([])
  useEffect(() => {
    if (!traceOn) return
    setTrace((prev) => [...prev, { x: t, y: count, closed: true }])
  }, [t, count, traceOn])
  useEffect(() => {
    if (!traceOn) setTrace([])
  }, [traceOn])

  const points = [...trace, { x: t, y: count, closed: true }]

  return (
    <div>
      <GraphCanvas curves={[]} points={points} />
      <div>h({t.toFixed(2)}) = {count}</div>
    </div>
  )
}
```

**Step 4: 통과 확인**

```bash
npm run test -- LinkedFunctionPanel
```
Expected: PASS

**Step 5: `traceOn` 토글 UI를 `App.jsx`에 추가하고 스토어와 연결**

**Step 6: Commit**

```bash
git add src/components/LinkedFunctionPanel.jsx src/components/LinkedFunctionPanel.test.jsx src/App.jsx
git commit -m "Add LinkedFunctionPanel computing h(t) via solutionCount, with trace toggle"
```

---

### Task 16: 대수뷰(ObjectList) — 표시/숨김 + 색상

**Files:**
- Create: `src/components/ObjectList.jsx`

**Step 1: 구현**

```jsx
// src/components/ObjectList.jsx
export function ObjectList({ pieces, visibility, onToggle, colors }) {
  return (
    <ul style={{ listStyle: 'none', padding: 0 }}>
      {pieces.map((piece, i) => (
        <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ width: 10, height: 10, background: colors[i], display: 'inline-block' }} />
          <button onClick={() => onToggle(i)}>{visibility[i] === false ? '👁️‍🗨️' : '👁️'}</button>
          <code>{piece.expr}</code>
        </li>
      ))}
    </ul>
  )
}
```

이 단계는 자동화 테스트보다 시각 확인 우선. `Panel`에 `visibility` state를 추가하고, `curves`/`points`를 필터링해 GraphCanvas에 전달.

**Step 2: 수동 확인**

눈 아이콘을 눌러 조각을 숨기면 해당 곡선이 그래프에서 사라지는지 확인.

**Step 3: Commit**

```bash
git add src/components/ObjectList.jsx src/components/Panel.jsx
git commit -m "Add algebra-view style object list with visibility toggle"
```

---

### Task 17: 반응형 레이아웃

**Files:**
- Create: `src/App.css`
- Modify: `src/App.jsx` (className 적용)

**Step 1: 구현**

```css
/* src/App.css */
.main-row {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  flex-direction: row;
  flex-wrap: wrap;
}

@media (max-width: 768px) {
  .main-row {
    flex-direction: column;
  }
}

.main-row > * {
  flex: 1 1 400px;
  min-width: 0;
}
```

`App.jsx`의 컨테이너 div에 `className="main-row"` 적용, `GraphCanvas`의 `width`/`height`를 고정 400 대신 부모 크기에 맞춰 `ResizeObserver`로 조정 (간단히는 CSS `width:100%`에 `canvas` 자체 픽셀 크기는 유지하고 `style={{width:'100%', height:'auto'}}`로 스케일).

**Step 2: 수동 확인**

브라우저 개발자도구에서 화면 폭을 768px 아래로 줄이면 좌우 배치가 세로 스택으로 바뀌는지 확인 (데스크톱/모바일 폭 모두 확인).

**Step 3: Commit**

```bash
git add src/App.css src/App.jsx src/components/GraphCanvas.jsx
git commit -m "Add responsive breakpoint switching side-by-side to stacked layout"
```

---

### Task 18: 엔드투엔드 수동 검증 (52번 문제)

**Files:** 없음 (검증 전용, 코드 변경 없음)

**Step 1: 시나리오**

1. `npm run dev`로 앱 실행
2. 왼쪽 패널에 조각 2개 입력:
   - `2*x^3-6*x+1`, domain `(-inf, 2]`, 오른쪽 닫힘
   - `a*(x-2)*(x-b)+9`, domain `(2, inf)`, 왼쪽 열림
3. 자동 생성된 슬라이더에서 `a=3`, `b=6`으로 설정
4. `x=2` 지점에서 닫힌점(왼쪽 조각)과 열린점(오른쪽 조각)이 겹쳐 보이는지 확인
5. Trace On 켜고, `y=t` 선을 `t=-6`부터 `t=6`까지 천천히 드래그
6. 오른쪽 패널에 궤적이 남으면서 `t=-3` 근처에서 값이 `1 → 3 → 5`로 튀는 계단 모양이 보이는지 확인
7. `h(-3)` 텍스트가 정확히 `3`으로 표시되는지 확인

**Step 2: 문제 발견 시**

`rootFinder.js`의 `samples` 파라미터를 늘리거나, `GraphCanvas`의 드래그 민감도를 조정하는 후속 커밋으로 수정.

**Step 3: 통과 시 최종 커밋**

```bash
git add -A
git commit -m "Phase 1 complete: verified against 52-problem intersection-count scenario" --allow-empty
```

---

## 완료 조건

- [ ] Task 0~17의 모든 자동화 테스트 통과 (`npm run test`)
- [ ] Task 18 수동 시나리오가 기대한 대로 동작
- [ ] `feature/phase1-graph-engine` 브랜치에 위 커밋들이 순서대로 쌓여 있음
