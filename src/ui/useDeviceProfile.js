import { useEffect, useState } from 'react'

/**
 * Decide how much visual work this device can actually afford.
 *
 * The site was designed on a fast machine, where infinite aurora blobs and
 * backdrop blur are free. On a budget Android they are not: they keep the GPU
 * busy every frame, drain battery, and make scrolling stutter. Rather than
 * shipping one experience and hoping, we detect the device once and let
 * components step down gracefully.
 *
 * Detection is deliberately cheap and synchronous-ish — no benchmarking loop,
 * which would itself cost a frame on the slowest devices we are trying to help.
 */

function detect() {
  if (typeof window === 'undefined') {
    return { tier: 'high', motion: true, blur: true, coarse: false, narrow: false, saveData: false }
  }

  const nav = window.navigator ?? {}
  const media = (q) => {
    try { return window.matchMedia?.(q)?.matches ?? false } catch { return false }
  }

  const reducedMotion = media('(prefers-reduced-motion: reduce)')
  const coarse = media('(pointer: coarse)')
  const narrow = media('(max-width: 767px)')
  // Data Saver is an explicit "I am on an expensive or slow connection" signal.
  const saveData = Boolean(nav.connection?.saveData)
  const slowNetwork = ['slow-2g', '2g', '3g'].includes(nav.connection?.effectiveType)

  // deviceMemory and hardwareConcurrency are absent on iOS Safari, so a missing
  // value must never be read as "slow" — it would downgrade every iPhone.
  const memory = typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null
  const cores = typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : null

  // Thresholds matter. 4 GB / 4 cores is a mid-range phone that handles normal
  // UI animation perfectly well — treating it as "low" stripped motion from a
  // large share of real Indian Android users for no reason. Only genuinely
  // constrained hardware (2 GB, dual core) drops to the lowest tier.
  const veryLowMemory = memory != null && memory <= 2
  const veryFewCores = cores != null && cores <= 2
  const lowMemory = memory != null && memory <= 4
  const fewCores = cores != null && cores <= 4

  // A single weak signal is not enough to strip the experience: iOS Safari
  // reports no deviceMemory at all and some browsers under-report cores, so
  // "2 cores" on its own would wrongly downgrade perfectly capable phones.
  // Hardware only drops to the lowest tier when two signals agree.
  const weakHardware = [veryLowMemory, veryFewCores].filter(Boolean).length >= 2

  let tier = 'high'
  // An explicit user or network preference is authoritative on its own.
  if (reducedMotion || saveData || slowNetwork) tier = 'low'
  else if (weakHardware) tier = 'low'
  else if (lowMemory || fewCores || narrow) tier = 'medium'

  return {
    tier,
    // Normal entry/exit animation is affordable everywhere except the lowest
    // tier — it is the infinite loops and blur below that actually cost frames.
    motion: !reducedMotion && tier !== 'low',
    // Decorative *looping* animation is reserved for capable devices.
    loops: !reducedMotion && tier === 'high',
    // Backdrop blur costs a full-surface repaint per frame while scrolling.
    blur: tier === 'high' && !narrow,
    // Heavy one-off effects (aurora, spotlight, confetti).
    effects: tier === 'high',
    coarse,
    narrow,
    saveData: saveData || slowNetwork,
    reducedMotion,
  }
}

let cached = null

/** Read the profile outside React (module singletons, animation configs). */
export function getDeviceProfile() {
  if (!cached) cached = detect()
  return cached
}

/**
 * Device profile as a hook. Re-evaluates when the viewport crosses the phone
 * breakpoint or the user flips their reduced-motion preference, so rotating a
 * tablet or toggling the OS setting takes effect without a reload.
 */
export function useDeviceProfile() {
  const [profile, setProfile] = useState(getDeviceProfile)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const queries = [
      window.matchMedia('(max-width: 767px)'),
      window.matchMedia('(prefers-reduced-motion: reduce)'),
    ]
    const update = () => { cached = detect(); setProfile(cached) }
    for (const q of queries) q.addEventListener?.('change', update)
    return () => { for (const q of queries) q.removeEventListener?.('change', update) }
  }, [])

  return profile
}

/**
 * Transition helper: returns a finite transition on devices that should not run
 * looping animations, so callers can keep one code path.
 *
 *   transition={loop({ duration: 2 })}   // repeats on capable devices only
 */
export function loop(transition = {}) {
  const { loops } = getDeviceProfile()
  return loops ? { ...transition, repeat: Infinity } : { duration: 0 }
}

export default useDeviceProfile
