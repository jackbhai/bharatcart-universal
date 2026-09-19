export function cx(...args) {
  const out = []
  for (const a of args) {
    if (!a) continue
    if (typeof a === 'string' || typeof a === 'number') out.push(a)
    else if (Array.isArray(a)) { const r = cx(...a); if (r) out.push(r) }
    else if (typeof a === 'object') for (const [k, v] of Object.entries(a)) if (v) out.push(k)
  }
  return out.join(' ')
}
export default cx
