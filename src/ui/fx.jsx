import React, { useEffect, useRef, useState, useMemo } from 'react'
import { motion, useInView, useSpring, useMotionValue, useTransform, useScroll, AnimatePresence } from 'framer-motion'
import { getDeviceProfile, loop } from './useDeviceProfile.js'

export const cx = (...a) => a.filter(Boolean).join(' ')

/* ============================================================
   Animated number that springs to its value when scrolled into view
============================================================ */
/**
 * Is scroll detection available at all?
 *
 * Every effect below starts at opacity 0 and waits for an intersection to
 * become visible. If IntersectionObserver is missing — an old browser, a test
 * renderer, a server render — that intersection never fires and the content
 * stays invisible permanently. That is the exact failure that took the admin
 * panel down once already, and it must not be reintroduced through fx.jsx.
 *
 * When detection is unavailable, these components skip the animation and
 * render their content plainly. A missing entrance is a cosmetic loss; missing
 * content is an outage.
 */
const CAN_OBSERVE = typeof IntersectionObserver !== 'undefined'

export function Counter({ value, format = (v) => Math.round(v).toLocaleString('en-IN'), className, duration = 1.1 }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const mv = useMotionValue(0)
  const spring = useSpring(mv, { duration: duration * 1000, bounce: 0 })
  // Start at the final value when we cannot detect scroll, so the figure is
  // correct on screen even though it never animates.
  const [txt, setTxt] = useState(() => format(CAN_OBSERVE ? 0 : value))
  useEffect(() => {
    if (!CAN_OBSERVE) { setTxt(format(value)); return }
    if (inView) mv.set(value)
  }, [inView, value, format, mv])
  useEffect(() => spring.on('change', v => setTxt(format(v))), [spring, format])
  return <span ref={ref} className={className}>{txt}</span>
}

/* ============================================================
   Scroll reveal
============================================================ */

export function Reveal({ children, delay = 0, y = 14, className }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  if (!CAN_OBSERVE) return <div className={className}>{children}</div>
  return (
    <motion.div ref={ref} className={className}
      initial={{ opacity: 0, y }}
      // Always animate to the visible state; `inView` only gates the timing.
      // Passing {} while out of view leaves the element at `initial`, so the
      // fallback above is what actually guarantees it is never stranded.
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: .55, delay, ease: [0.21, 0.47, 0.32, 0.98] }}>
      {children}
    </motion.div>
  )
}

export function Stagger({ children, className, gap = 0.05 }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-50px' })
  // Children start at opacity 0 and are released by the "show" variant, so
  // without observation they would never appear. Render them plainly instead.
  if (!CAN_OBSERVE) return <div className={className}>{children}</div>
  return (
    <motion.div ref={ref} className={className}
      initial="hidden" animate={inView ? 'show' : 'hidden'}
      variants={{ show: { transition: { staggerChildren: gap } } }}>
      {children}
    </motion.div>
  )
}
export const StaggerItem = ({ children, className }) => (
  <motion.div className={className}
    variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: .5, ease: [0.21, 0.47, 0.32, 0.98] } } }}>
    {children}
  </motion.div>
)

/* ============================================================
   3D tilt card — follows pointer with spring physics
============================================================ */
export function Tilt({ children, className, max = 9, scale = 1.02, glare = true }) {
  const ref = useRef(null)
  const mx = useMotionValue(0.5), my = useMotionValue(0.5)
  const sx = useSpring(mx, { stiffness: 220, damping: 22 })
  const sy = useSpring(my, { stiffness: 220, damping: 22 })
  const rotX = useTransform(sy, [0, 1], [max, -max])
  const rotY = useTransform(sx, [0, 1], [-max, max])
  const gX = useTransform(sx, [0, 1], ['0%', '100%'])
  const gY = useTransform(sy, [0, 1], ['0%', '100%'])
  const [hover, setHover] = useState(false)

  const move = (e) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    mx.set((e.clientX - r.left) / r.width)
    my.set((e.clientY - r.top) / r.height)
  }
  return (
    <motion.div ref={ref}
      onMouseMove={move}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); mx.set(0.5); my.set(0.5) }}
      style={{ rotateX: rotX, rotateY: rotY, transformPerspective: 900 }}
      animate={{ scale: hover ? scale : 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className={cx('relative [transform-style:preserve-3d]', className)}>
      {children}
      {glare && (
        <motion.div className="pointer-events-none absolute inset-0 rounded-[inherit] overflow-hidden"
          animate={{ opacity: hover ? 1 : 0 }} transition={{ duration: .25 }}>
          <motion.div className="absolute w-[160%] h-[160%] -translate-x-1/2 -translate-y-1/2"
            style={{
              left: gX, top: gY,
              background: 'radial-gradient(circle, rgba(255,255,255,.35) 0%, transparent 55%)',
            }} />
        </motion.div>
      )}
    </motion.div>
  )
}

/* ============================================================
   Magnetic button — pulls toward cursor
============================================================ */
export function Magnetic({ children, strength = 0.28, className }) {
  const ref = useRef(null)
  const x = useMotionValue(0), y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 300, damping: 20 })
  const sy = useSpring(y, { stiffness: 300, damping: 20 })
  const move = (e) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    x.set((e.clientX - (r.left + r.width / 2)) * strength)
    y.set((e.clientY - (r.top + r.height / 2)) * strength)
  }
  return (
    <motion.div ref={ref} onMouseMove={move} onMouseLeave={() => { x.set(0); y.set(0) }}
      style={{ x: sx, y: sy }} className={cx('inline-block', className)}>
      {children}
    </motion.div>
  )
}

/* ============================================================
   Animated aurora / mesh gradient background
============================================================ */
export function Aurora({ className, colors = ['#F97316', '#6366F1', '#10B981'], opacity = 0.5, blobs = 3 }) {
  return (
    <div className={cx('absolute inset-0 overflow-hidden pointer-events-none', className)} style={{ opacity }}>
      {Array.from({ length: blobs }).map((_, i) => (
        <motion.div key={i}
          className="absolute rounded-full blur-3xl"
          style={{
            background: colors[i % colors.length],
            width: `${45 + i * 12}%`, height: `${45 + i * 12}%`,
            mixBlendMode: 'screen',
          }}
          animate={{
            x: ['-10%', '55%', '15%', '-10%'],
            y: ['5%', '35%', '-15%', '5%'],
            scale: [1, 1.25, 0.9, 1],
          }}
          transition={loop({ duration: 22 + i * 7, ease: 'easeInOut', delay: i * 2 })}
        />
      ))}
    </div>
  )
}

/* ============================================================
   Silk / flowing ribbon SVG background
============================================================ */
export function Silk({ className, stroke = 'rgba(255,255,255,.16)', lines = 7 }) {
  return (
    <svg className={cx('absolute inset-0 w-full h-full pointer-events-none', className)} preserveAspectRatio="none" viewBox="0 0 1200 500">
      {Array.from({ length: lines }).map((_, i) => (
        <motion.path key={i}
          d={`M -100 ${120 + i * 45} C 200 ${40 + i * 48}, 450 ${240 + i * 30}, 700 ${140 + i * 42} S 1100 ${60 + i * 46}, 1300 ${170 + i * 38}`}
          fill="none" stroke={stroke} strokeWidth={1.1}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 2.2, delay: i * 0.12, ease: 'easeOut' }}
        />
      ))}
    </svg>
  )
}

/* ============================================================
   Rangoli — animated radial mandala (Indian motif)
============================================================ */
export function Rangoli({ size = 320, className, color = '#F97316', petals = 12, spin = 60 }) {
  const pts = Array.from({ length: petals })
  return (
    <motion.svg width={size} height={size} viewBox="0 0 200 200" className={className}
      animate={{ rotate: 360 }} transition={loop({ duration: spin, ease: 'linear' })}>
      {pts.map((_, i) => {
        const a = (i / petals) * 360
        return (
          <motion.ellipse key={i} cx="100" cy="52" rx="11" ry="30"
            fill="none" stroke={color} strokeWidth="1"
            transform={`rotate(${a} 100 100)`}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: [0, .8, .45] }}
            transition={{ duration: 1.6, delay: i * .06, ease: 'easeOut' }} />
        )
      })}
      {[26, 40, 54].map((r, i) => (
        <motion.circle key={r} cx="100" cy="100" r={r} fill="none" stroke={color} strokeWidth="0.8"
          strokeDasharray="3 6"
          initial={{ opacity: 0 }} animate={{ opacity: .5 }} transition={{ delay: .5 + i * .2 }} />
      ))}
    </motion.svg>
  )
}

/* ============================================================
   Marquee
============================================================ */
export function Marquee({ items, speed = 26, className, sep = '◆' }) {
  const row = [...items, ...items]
  return (
    <div className={cx('relative overflow-hidden', className)}>
      <motion.div className="flex gap-8 whitespace-nowrap w-max"
        animate={{ x: ['0%', '-50%'] }}
        transition={loop({ duration: speed, ease: 'linear' })}>
        {row.map((t, i) => (
          <span key={i} className="flex items-center gap-8 text-[12px] font-medium tracking-wide">
            {t}<span className="opacity-40">{sep}</span>
          </span>
        ))}
      </motion.div>
    </div>
  )
}

/* ============================================================
   Shimmer skeleton
============================================================ */
export const Shimmer = ({ className }) => (
  <div className={cx('relative overflow-hidden bg-slate-200/70 rounded-lg', className)}>
    <motion.div className="absolute inset-0"
      style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.85), transparent)' }}
      animate={{ x: ['-100%', '200%'] }}
      transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }} />
  </div>
)

/* ============================================================
   Confetti burst (canvas-free, pure motion)
============================================================ */
export function Confetti({ fire, count = 34 }) {
  const colors = ['#F97316', '#6366F1', '#10B981', '#EC4899', '#F59E0B', '#06B6D4']
  const bits = useMemo(() => Array.from({ length: count }, (_, i) => ({
    i,
    x: (Math.random() - 0.5) * 320,
    y: -(120 + Math.random() * 190),
    r: Math.random() * 620,
    c: colors[i % colors.length],
    s: 5 + Math.random() * 7,
    d: Math.random() * 0.22,
  })), [fire, count])
  if (!fire) return null
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center overflow-visible z-10">
      {bits.map(b => (
        <motion.span key={b.i} className="absolute rounded-[2px]"
          style={{ width: b.s, height: b.s * 1.5, background: b.c }}
          initial={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
          animate={{ opacity: [1, 1, 0], x: b.x, y: [0, b.y, b.y + 260], rotate: b.r, scale: [1, 1, .5] }}
          transition={{ duration: 1.5 + Math.random() * 0.5, delay: b.d, ease: [0.16, 0.84, 0.44, 1] }} />
      ))}
    </div>
  )
}

/* ============================================================
   Cursor spotlight that follows pointer inside a container
============================================================ */
export function Spotlight({ className, color = 'rgba(99,102,241,.17)', size = 380 }) {
  const ref = useRef(null)
  const x = useMotionValue(-999), y = useMotionValue(-999)
  const sx = useSpring(x, { stiffness: 180, damping: 26 })
  const sy = useSpring(y, { stiffness: 180, damping: 26 })
  useEffect(() => {
    const el = ref.current?.parentElement
    if (!el) return
    const move = e => {
      const r = el.getBoundingClientRect()
      x.set(e.clientX - r.left); y.set(e.clientY - r.top)
    }
    const out = () => { x.set(-999); y.set(-999) }
    el.addEventListener('mousemove', move); el.addEventListener('mouseleave', out)
    return () => { el.removeEventListener('mousemove', move); el.removeEventListener('mouseleave', out) }
  }, [])
  return (
    <motion.div ref={ref} className={cx('pointer-events-none absolute inset-0 rounded-[inherit] overflow-hidden', className)}>
      <motion.div className="absolute rounded-full blur-2xl"
        style={{ left: sx, top: sy, width: size, height: size, x: '-50%', y: '-50%', background: color }} />
    </motion.div>
  )
}

/* ============================================================
   Scroll progress bar
============================================================ */
export function ScrollProgress({ target }) {
  const { scrollYProgress } = useScroll(target ? { container: target } : {})
  const w = useSpring(scrollYProgress, { stiffness: 240, damping: 34, restDelta: 0.001 })
  return (
    <motion.div className="fixed top-0 left-0 right-0 h-[3px] z-[60] origin-left bg-gradient-to-r from-orange-500 via-amber-400 to-indigo-500"
      style={{ scaleX: w }} />
  )
}

/* ============================================================
   Animated ring / radial progress
============================================================ */
export function Ring({ value, size = 92, stroke = 8, color, label, sub }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const col = color || (value > 66 ? '#EF4444' : value > 33 ? '#F59E0B' : '#10B981')
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  return (
    <div ref={ref} className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E9EEF5" strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: CAN_OBSERVE ? c : c - (value / 100) * c }}
          animate={(inView || !CAN_OBSERVE) ? { strokeDashoffset: c - (value / 100) * c } : {}}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }} />
      </svg>
      <div className="absolute text-center">
        <div className="text-[17px] font-bold text-slate-900 leading-none">
          <Counter value={value} format={v => Math.round(v)} />
        </div>
        {label && <div className="text-[9px] uppercase tracking-wide text-slate-400 mt-0.5">{label}</div>}
      </div>
      {sub && <div className="absolute -bottom-4 text-[10px] text-slate-400 whitespace-nowrap">{sub}</div>}
    </div>
  )
}

/* ============================================================
   Gradient text
============================================================ */
export const Gradient = ({ children, from = '#F97316', to = '#FBBF24', className }) => (
  <span className={cx('text-transparent bg-clip-text', className)}
    style={{ backgroundImage: `linear-gradient(100deg, ${from}, ${to})` }}>{children}</span>
)

/* ============================================================
   Animated grid backdrop
============================================================ */
export const GridBg = ({ className, color = 'rgba(255,255,255,.07)' }) => (
  <div className={cx('absolute inset-0 pointer-events-none', className)}
    style={{
      backgroundImage: `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`,
      backgroundSize: '46px 46px',
      maskImage: 'radial-gradient(ellipse 75% 65% at 50% 40%, #000 55%, transparent 100%)',
      WebkitMaskImage: 'radial-gradient(ellipse 75% 65% at 50% 40%, #000 55%, transparent 100%)',
    }} />
)

/* ============================================================
   Noise texture overlay
============================================================ */
export const Noise = ({ opacity = 0.035 }) => (
  <div className="absolute inset-0 pointer-events-none mix-blend-overlay" style={{
    opacity,
    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 220 220' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
  }} />
)

/* ============================================================
   Page transition wrapper
============================================================ */
export const PageFade = ({ children, k }) => (
  <AnimatePresence mode="wait">
    <motion.div key={k}
      initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -6, filter: 'blur(4px)' }}
      transition={{ duration: .32, ease: [0.21, 0.47, 0.32, 0.98] }}>
      {children}
    </motion.div>
  </AnimatePresence>
)

/* ============================================================
   Glow border wrapper
============================================================ */
export const GlowCard = ({ children, className, glow = 'rgba(99,102,241,.35)' }) => (
  <div className={cx('relative group', className)}>
    <div className="absolute -inset-px rounded-[inherit] opacity-0 group-hover:opacity-100 transition duration-500 blur-sm"
      style={{ background: `linear-gradient(120deg, ${glow}, transparent 40%, ${glow})` }} />
    <div className="relative rounded-[inherit] h-full">{children}</div>
  </div>
)
