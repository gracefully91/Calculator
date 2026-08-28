import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// App.jsx only ever asserts the *className* is applied (App.test.jsx) --
// jsdom doesn't run a real layout/cascade engine, so no RTL test can prove
// the stylesheet itself actually switches to a column layout under
// 768px. This reads the real file back and checks its structure directly
// (selectors present, media query present with the right condition, braces
// balanced) rather than trusting the CSS was typed correctly.
//
// Resolved from process.cwd() (the project root vitest runs from) rather
// than import.meta.url -- this project's Vite/Vitest transform pipeline
// doesn't hand test files a real file:// import.meta.url, so
// fileURLToPath(new URL(...)) throws "The URL must be of scheme file" here.
const cssPath = path.resolve(process.cwd(), 'src/App.css')
const css = readFileSync(cssPath, 'utf-8')

describe('App.css (Task 17 responsive layout)', () => {
  it('has balanced braces (no stray/missing { or })', () => {
    const opens = (css.match(/\{/g) || []).length
    const closes = (css.match(/\}/g) || []).length
    expect(opens).toBe(closes)
    expect(opens).toBeGreaterThan(0)
  })

  it('defines .main-row as a row-direction flex container by default', () => {
    const mainRowRule = css.match(/\.main-row\s*\{([^}]*)\}/)
    expect(mainRowRule).not.toBeNull()
    const body = mainRowRule[1]
    expect(body).toMatch(/display:\s*flex/)
    expect(body).toMatch(/flex-direction:\s*row/)
  })

  it('switches .main-row to column direction inside a max-width: 768px media query', () => {
    const mediaMatch = css.match(/@media\s*\(max-width:\s*768px\)\s*\{([\s\S]*?)\n\}/)
    expect(mediaMatch).not.toBeNull()
    const mediaBody = mediaMatch[1]
    const mainRowInMedia = mediaBody.match(/\.main-row\s*\{([^}]*)\}/)
    expect(mainRowInMedia).not.toBeNull()
    expect(mainRowInMedia[1]).toMatch(/flex-direction:\s*column/)
  })

  it('makes each direct child of .main-row a flexible 400px-basis item that can shrink below its content width', () => {
    const childRule = css.match(/\.main-row\s*>\s*\*\s*\{([^}]*)\}/)
    expect(childRule).not.toBeNull()
    const body = childRule[1]
    expect(body).toMatch(/flex:\s*1\s+1\s+400px/)
    expect(body).toMatch(/min-width:\s*0/)
  })
})
