/**
 * Part 11 — animation and interaction feedback.
 *
 * The audit behind this work found a lopsided animation surface: 176 `motion.`
 * usages in the admin panel but only 7 hover states and 1 press state, and ten
 * finished effect components in fx.jsx that were never imported anywhere.
 * Plenty of decoration, almost no feedback.
 *
 * These assertions protect the feedback (which users feel on every click) and
 * the guardrails (caps, reduced-motion, disabled states) rather than trying to
 * assert that something "looks nice".
 */
import { JSDOM } from 'jsdom'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

/*
 * Resolve paths relative to this file rather than hard-coding an absolute one.
 *
 * These suites originally used an absolute /home/... path, which worked only
 * on the machine they were written on. A fresh clone anywhere else loaded a
 * SECOND copy of React from the old absolute path, producing "Invalid hook
 * call / cannot read properties of null (reading 'useContext')" — an error
 * that points at React and has nothing to do with React.
 */
const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const SRC_DIR = resolve(ROOT, 'src')


const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  pretendToBeVisual: true, url: 'http://localhost/',
})
global.window = dom.window
global.document = dom.window.document
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true, writable: true })
global.localStorage = dom.window.localStorage
global.matchMedia = () => ({ matches: false, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} })
global.window.matchMedia = global.matchMedia
global.requestAnimationFrame = cb => setTimeout(() => cb(Date.now()), 16)
global.cancelAnimationFrame = clearTimeout
global.HTMLElement = dom.window.HTMLElement
global.Element = dom.window.Element
global.Node = dom.window.Node
global.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} }
global.window.ResizeObserver = global.ResizeObserver
// Report every observed element as on-screen, so scroll-triggered effects run.
global.IntersectionObserver = class {
  constructor(cb) { this.cb = cb }
  observe(el) { this.cb([{ isIntersecting: true, target: el, intersectionRatio: 1 }]) }
  unobserve() {} disconnect() {}
}
global.window.IntersectionObserver = global.IntersectionObserver
for (const k of ['SVGElement','SVGSVGElement','DOMRect','MutationObserver','CSS','getComputedStyle',
  'Event','CustomEvent','KeyboardEvent','MouseEvent','HTMLInputElement','HTMLButtonElement','Blob','URL']) {
  if (dom.window[k] !== undefined) global[k] = dom.window[k]
}
if (!global.structuredClone) global.structuredClone = v => JSON.parse(JSON.stringify(v))

const React = (await import('react')).default
const { createRoot } = await import('react-dom/client')
const { act } = await import('react')
const settle = (ms = 700) => act(async () => { await new Promise(r => setTimeout(r, ms)) })

let pass = 0, fail = 0
const ok = (label, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ✓ ${label}`) }
  else { fail++; console.log(`  ✗ ${label}${detail ? ' · ' + detail : ''}`) }
}
const section = t => console.log(`\n── ${t}`)
const SRC = SRC_DIR

async function allJsx(dir) {
  const out = []
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...await allJsx(p))
    else if (e.name.endsWith('.jsx')) out.push(p)
  }
  return out
}

/* ============================================================ */
section('No duplicate motion props (they silently override each other)')
{
  /*
   * This check exists because it caught a real bug during this work. A card
   * ended up with both `initial={{...}}` and `initial="rest"`; the later prop
   * wins silently, so the entrance animation vanished with no error and no
   * build failure. Exactly the kind of thing only a linter catches.
   */
  const files = await allJsx(`${SRC}`)
  const offences = []
  for (const f of files) {
    const src = await readFile(f, 'utf8')
    const re = /<motion\.[a-zA-Z]+\s([^>]*?)\/?>/gs
    let m
    while ((m = re.exec(src))) {
      const body = m[1].replace(/\/\*[\s\S]*?\*\//g, '')
      for (const prop of ['initial', 'animate', 'whileHover', 'whileTap', 'variants', 'exit']) {
        const n = (body.match(new RegExp('(^|\\s)' + prop + '=', 'g')) || []).length
        if (n > 1) offences.push(`${f.replace(SRC, '')}:${prop}×${n}`)
      }
    }
  }
  ok('every motion element declares each prop once', offences.length === 0, offences.join(' '))
}

/* ============================================================ */
section('Shared interaction presets')
{
  const I = await import(`${SRC}/ui/motion/interactions.js`)

  for (const name of ['press', 'pressSoft', 'pressIcon', 'lift', 'liftHigh', 'rowHover']) {
    ok(`"${name}" preset exists`, !!I[name])
  }

  // Presses must be subtle. An operator clicks these thousands of times a
  // shift; anything dramatic becomes irritating fast.
  ok('press hover stays under 5%', I.press.whileHover.scale <= 1.05, String(I.press.whileHover.scale))
  ok('press tap stays above 95%', I.press.whileTap.scale >= 0.95, String(I.press.whileTap.scale))
  ok('large surfaces move less than small ones',
    I.pressSoft.whileHover.scale < I.press.whileHover.scale)

  // Durations must feel instant. Anything past ~300ms on a press reads as lag.
  const durs = Object.values(I.DUR)
  ok('no interaction duration exceeds 600ms', Math.max(...durs) <= 0.6)
  ok('the press response is under 200ms', I.press.transition.duration < 0.2)

  // Entrance presets must always end visible — the blank-screen class of bug.
  for (const name of ['fadeIn', 'fadeUp', 'scaleIn', 'popIn']) {
    ok(`"${name}" ends fully opaque`, I[name].animate.opacity === 1)
  }
  ok('listItem ends fully opaque', I.listItem.variants.show.opacity === 1)

  // The stagger cap is the important one: elegant on 12 rows, unusable on 480.
  ok('stagger is capped on long lists', I.staggerDelay(479, 480) <= 0.4,
    String(I.staggerDelay(479, 480)))
  ok('stagger still spaces out short lists', I.staggerDelay(5, 8) > 0.05)
  ok('a single item has no delay', I.staggerDelay(0, 1) === 0)
  ok('the last item of a long list is not left behind',
    I.staggerDelay(999, 1000) <= 0.4, String(I.staggerDelay(999, 1000)))

  // withMotion must never strand an element invisible.
  const stripped = I.withMotion(I.fadeUp, false)
  ok('disabling motion keeps the element visible', stripped.animate.opacity === 1)
  ok('disabling motion removes the hidden initial state',
    !stripped.initial || stripped.initial.opacity === 1)
  ok('withoutHover strips hover but keeps the entrance',
    !I.withoutHover(I.fadeUp).whileHover && I.withoutHover(I.fadeUp).animate.opacity === 1)
}

/* ============================================================ */
section('Buttons give feedback, disabled buttons do not')
{
  const btn = await readFile(`${SRC}/ui/primitives/Button.jsx`, 'utf8')
  ok('the shared Button has a hover state', btn.includes('whileHover'))
  ok('the shared Button has a press state', btn.includes('whileTap'))
  // The important half: a control that cannot act must not pretend it can.
  ok('a disabled button has no hover response', /whileHover=\{disabled \|\| loading \? undefined/.test(btn))
  ok('a loading button has no press response', /whileTap=\{disabled \|\| loading \? undefined/.test(btn))

  const css = await readFile(`${SRC}/index.css`, 'utf8')
  ok('raw buttons get feedback from CSS', css.includes("button:not(.no-fx):not(:disabled):active"))
  ok('disabled controls are inert in CSS too', /button:disabled[^{]*\{[^}]*transform:\s*none/.test(css))
  ok('feedback animates transform, not layout properties',
    !/button[^{]*:hover\s*\{[^}]*(width|height|margin|padding):/.test(css))
  ok('an opt-out class exists for controls that need none', css.includes('.no-fx'))
}

/* ============================================================ */
section('Skeleton loaders replaced the spinners')
{
  const skel = await readFile(`${SRC}/ui/feedback/Skeleton.jsx`, 'utf8')
  const app = await readFile(`${SRC}/App.jsx`, 'utf8')
  const css = await readFile(`${SRC}/index.css`, 'utf8')

  ok('route loading uses a skeleton, not a spinner',
    app.includes('<SkeletonScreen') && !/RouteLoading[\s\S]{0,300}animate-spin/.test(app))
  for (const c of ['SkeletonText', 'SkeletonKpis', 'SkeletonTable', 'SkeletonCard', 'SkeletonProducts', 'SkeletonChart', 'SkeletonScreen']) {
    ok(`${c} is exported`, skel.includes(`export function ${c}`))
  }

  // Skeletons render while the main thread is busy, so they must not add to it.
  // Check the IMPORTS, not the prose. The file's own comment explains why it
  // avoids framer-motion, and matching that comment reported the opposite.
  ok('skeletons import no animation library',
    !/^import .*framer-motion/m.test(skel) && !/<motion\./.test(skel))
  ok('the shimmer is defined in CSS', css.includes('@keyframes skeleton-sweep'))
  ok('the shimmer animates background-position, not layout',
    /@keyframes skeleton-sweep[\s\S]{0,140}background-position/.test(css))
  ok('the shimmer stops under reduced motion',
    /prefers-reduced-motion[\s\S]{0,200}\.skeleton\s*\{\s*animation:\s*none/.test(css))

  // Placeholders are decorative; announcing every bar would be noise.
  ok('skeleton shapes are hidden from screen readers', skel.includes('aria-hidden="true"'))
  ok('the loading state itself is announced once', skel.includes('role="status"'))
}

/* ============================================================ */
section('KPI count-up parses values conservatively')
{
  const { parseCountable } = await import(`${SRC}/ui/patterns/KpiRow.jsx`)

  // Must animate: plain and simply-decorated numbers.
  ok('a plain number counts up', parseCountable(1018)?.n === 1018)
  ok('a formatted integer counts up', parseCountable('1,018')?.n === 1018)
  ok('a currency value counts up', parseCountable('₹1,23,456')?.n === 123456)
  ok('the currency prefix is preserved', parseCountable('₹1,23,456')?.prefix === '₹')
  ok('a percentage counts up', parseCountable('71%')?.n === 71)
  ok('the percent suffix is preserved', parseCountable('71%')?.suffix === '%')
  ok('decimals are preserved', parseCountable('1,234.50')?.decimals === 2)

  /*
   * Must NOT animate. This half matters more: counting up a value we cannot
   * reassemble exactly would print a wrong number on a dashboard, which is
   * far worse than a value that simply appears.
   */
  ok('a compacted unit is left alone', parseCountable('₹7.34 Cr') === null)
  ok('text is left alone', parseCountable('In Transit') === null)
  ok('a composite value is left alone', parseCountable('12 of 18') === null)
  ok('an em dash placeholder is left alone', parseCountable('—') === null)
  ok('"N/A" is left alone', parseCountable('N/A') === null)
  ok('null is handled', parseCountable(null) === null)
  ok('an empty string is handled', parseCountable('') === null)
  ok('tiny numbers do not bother counting', parseCountable('7') === null)
  ok('zero does not count up', parseCountable('0') === null)

  const kpi = await readFile(`${SRC}/ui/patterns/KpiRow.jsx`, 'utf8')
  ok('count-up respects the device profile', kpi.includes('device.motion'))
  ok('count-up can be switched off per card', kpi.includes('countUp = true'))
  ok('clickable KPIs have a press state', kpi.includes('whileTap={clickable'))
}

/* ============================================================ */
section('Previously-dead effects are now in use')
{
  const files = (await allJsx(SRC)).filter(f => !f.endsWith('ui/fx.jsx'))
  const all = (await Promise.all(files.map(f => readFile(f, 'utf8')))).join('\n')

  // Confetti was fully written and never imported. The order confirmation is
  // the highest-emotion moment in the storefront and was the plainest screen.
  ok('Confetti is used on the order confirmation', /<Confetti/.test(all))
  ok('Counter drives at least one live figure', /<Counter/.test(all))

  const checkout = await readFile(`${SRC}/shop/Checkout.jsx`, 'utf8')
  ok('the celebration fires once rather than looping', checkout.includes('setCelebrate(false)'))
  ok('the celebration is cleaned up on unmount', checkout.includes('clearTimeout'))
  ok('the celebration respects the device profile', checkout.includes('device.effects'))
}

/* ============================================================ */
section('Motion never overrides a user preference')
{
  const css = await readFile(`${SRC}/index.css`, 'utf8')

  // Counted rather than asserted once: this preference must be honoured by
  // every layer that adds movement, not just the first one that remembered.
  const blocks = (css.match(/prefers-reduced-motion/g) || []).length
  ok('reduced motion is honoured in several layers', blocks >= 4, `${blocks} blocks`)
  ok('hover transforms are removed, not just shortened',
    /prefers-reduced-motion[\s\S]{0,400}transform:\s*none\s*!important/.test(css))

  const device = await readFile(`${SRC}/ui/useDeviceProfile.js`, 'utf8')
  ok('the device profile exposes a motion flag', device.includes('motion'))
  ok('the device profile exposes an effects flag', device.includes('effects'))

  // Interaction feedback is cheap AND informative, so it should survive a
  // mid-tier device even when decorative effects are dropped.
  const inter = await readFile(`${SRC}/ui/motion/interactions.js`, 'utf8')
  ok('the reasoning for keeping feedback on low tiers is recorded',
    inter.includes('not make the phone faster'))
}

/* ============================================================ */
section('Animation did not cost bundle size or correctness')
{
  const pkg = JSON.parse(await readFile(resolve(ROOT, 'package.json'), 'utf8'))
  const deps = Object.keys(pkg.dependencies || {})
  ok('no new animation library was added', deps.length === 4, deps.join(', '))
  ok('framer-motion is still the only motion dependency',
    deps.includes('framer-motion') && !deps.some(d => /gsap|lottie|anime|spring/i.test(d)))

  // Long lists are where animation turns into a performance bug.
  const table = await readFile(`${SRC}/ui/patterns/DataTable.jsx`, 'utf8')
  ok('table row stagger is capped', /Math\.min\(i \* [\d.]+, [\d.]+\)/.test(table))
  ok('only clickable rows respond to hover', table.includes('whileHover={onRowClick'))

  const store = await readFile(`${SRC}/shop/Storefront.jsx`, 'utf8')
  ok('product grid stagger is capped', /Math\.min\(i \* [\d.]+, [\d.]+\)/.test(store))
}

/* ============================================================ */
section('Scroll-triggered effects actually become visible')
{
  /*
   * The highest-severity bug this project has had was a page that rendered its
   * content and then sat at opacity 0 forever. Any effect that STARTS hidden
   * and animates to visible can reintroduce it, so every such component gets
   * rendered for real and measured — never assumed.
   */
  const { Reveal, Stagger, StaggerItem } = await import(`${SRC}/ui/fx.jsx`)

  const mount = async (el) => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => { root.render(el) })
    await settle()
    return { host, root }
  }
  const opacityOf = (el) => {
    const m = (el?.getAttribute('style') || '').match(/opacity:\s*([\d.]+)/)
    return m ? parseFloat(m[1]) : 1
  }

  const r = await mount(React.createElement(Reveal, null, React.createElement('p', null, 'shelf content')))
  ok('Reveal renders its children', r.host.textContent.includes('shelf content'))
  ok('Reveal ends fully visible, not stranded at opacity 0',
    opacityOf(r.host.firstElementChild) > 0.9,
    `opacity=${opacityOf(r.host.firstElementChild)}`)
  await act(async () => { r.root.unmount() })

  const st = await mount(
    React.createElement(Stagger, null,
      React.createElement(StaggerItem, null, React.createElement('p', null, 'row one')),
      React.createElement(StaggerItem, null, React.createElement('p', null, 'row two')),
    )
  )
  ok('Stagger renders every child', st.host.textContent.includes('row one') && st.host.textContent.includes('row two'))
  const kids = [...(st.host.firstElementChild?.children || [])]
  ok('every staggered child ends visible',
    kids.length > 0 && kids.every(k => opacityOf(k) > 0.9),
    kids.map(k => opacityOf(k)).join(','))
  await act(async () => { st.root.unmount() })
}

/* ============================================================ */
section('Scroll effects degrade safely without IntersectionObserver')
{
  /*
   * A real regression caught by this work.
   *
   * Wiring Reveal into the storefront broke tests/part5 — its harness has no
   * IntersectionObserver, and Reveal starts at opacity 0 waiting for an
   * intersection that never arrives. The content rendered and stayed
   * invisible: the same outage-class failure as the original blank admin
   * screens, arriving through a different door.
   *
   * Old browsers and server renderers have the same gap, so this is not just a
   * test artefact. Every scroll-triggered effect now detects the missing API
   * and renders plainly. A missing entrance is cosmetic; missing content is an
   * outage.
   */
  const fx = await readFile(`${SRC}/ui/fx.jsx`, 'utf8')
  ok('fx detects whether scroll observation is possible', fx.includes('CAN_OBSERVE'))
  ok('the detection is a capability check, not a browser sniff',
    fx.includes("typeof IntersectionObserver !== 'undefined'"))

  // Every component that hides its content pending an intersection needs the
  // bail-out. Counted, so a newly added effect cannot quietly skip it.
  const guards = (fx.match(/if \(!CAN_OBSERVE\)/g) || []).length
  ok('components that start hidden bail out', guards >= 2, `${guards} guards`)
  ok('Counter shows its real value when it cannot animate',
    fx.includes('format(CAN_OBSERVE ? 0 : value)'))
  ok('Ring draws its arc when it cannot animate',
    fx.includes('CAN_OBSERVE ? c : c - (value / 100) * c'))

  // Prove it by removing the API and rendering for real.
  const { Reveal, Stagger, StaggerItem } = await import(`${SRC}/ui/fx.jsx`)
  const savedIO = global.IntersectionObserver
  const savedWinIO = global.window.IntersectionObserver
  try {
    delete global.IntersectionObserver
    delete global.window.IntersectionObserver

    // Re-import with the API absent so the module-level check re-evaluates.
    const fresh = await import(`${SRC}/ui/fx.jsx?noio=1`)
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(React.createElement(fresh.Reveal, null, React.createElement('p', null, 'must still show')))
    })
    await settle(400)
    ok('Reveal still renders its content with no IntersectionObserver',
      host.textContent.includes('must still show'))
    const style = host.firstElementChild?.getAttribute('style') || ''
    ok('and it is not left at opacity 0', !/opacity:\s*0(\D|$)/.test(style), style || '(no inline style)')
    await act(async () => { root.unmount() })
  } finally {
    global.IntersectionObserver = savedIO
    global.window.IntersectionObserver = savedWinIO
  }
  void Reveal; void Stagger; void StaggerItem
}

console.log(`\n${pass} passed · ${fail} failed\n`)
if (fail) process.exitCode = 1
