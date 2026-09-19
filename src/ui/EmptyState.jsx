/**
 * EmptyState — premium zero-data placeholder used across admin + storefront.
 * Theme-aware (uses CSS variables), no external dependencies.
 *
 * Illustrated composition: layered gradient orbs, a slowly spinning
 * decorative ring, and the icon floating in a glowing glass bubble —
 * so "zero data" looks intentional and beautiful, never broken.
 *
 * Props:
 *   icon        — glyph/emoji shown in the gradient bubble
 *   title       — headline
 *   message     — one-line explanation
 *   actionLabel — primary CTA label (optional)
 *   onAction    — primary CTA handler (optional)
 *   secondaryLabel / onSecondary — optional secondary action
 *   compact     — tighter padding for inline use
 */
export default function EmptyState({
  icon = '◌',
  title = 'Nothing here yet',
  message,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  compact = false,
}) {
  const bubble = compact ? 52 : 76
  return (
    <div
      className="t-empty anim-fade-up"
      style={{
        position: 'relative',
        overflow: 'hidden',
        textAlign: 'center',
        padding: compact ? '30px 18px' : '60px 28px',
        borderRadius: 'var(--radius)',
        background:
          'linear-gradient(180deg, color-mix(in srgb, var(--c-primary) 7%, transparent), transparent 72%)',
        border: '1px dashed color-mix(in srgb, var(--c-primary) 34%, transparent)',
      }}
    >
      {/* ambient orbs */}
      <span aria-hidden className="orb orb-a" style={{ width: 190, height: 190, left: '-60px', top: '-70px', opacity: .5 }} />
      <span aria-hidden className="orb orb-b" style={{ width: 170, height: 170, right: '-50px', bottom: '-60px', opacity: .45 }} />

      {/* illustration: spinning ring + floating glass bubble */}
      <div aria-hidden style={{ position: 'relative', width: bubble + 56, height: bubble + 56, margin: compact ? '0 auto 12px' : '0 auto 18px' }}>
        <svg className="spin-slower" width={bubble + 56} height={bubble + 56} viewBox={`0 0 ${bubble + 56} ${bubble + 56}`}
          style={{ position: 'absolute', inset: 0, opacity: .8 }}>
          <circle cx={(bubble + 56) / 2} cy={(bubble + 56) / 2} r={(bubble + 56) / 2 - 4}
            fill="none" stroke="var(--c-primary)" strokeWidth="1.5"
            strokeDasharray="4 9" strokeLinecap="round" opacity=".55" />
        </svg>
        <div
          className="float-slow"
          style={{
            position: 'absolute', left: 28, top: 28,
            width: bubble, height: bubble,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: compact ? 24 : 34,
            borderRadius: 'var(--radius-full)',
            background: 'linear-gradient(135deg, var(--c-primary), var(--c-accent))',
            color: '#fff',
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,.5), inset 0 -2px 6px rgba(0,0,0,.12), 0 16px 36px -10px color-mix(in srgb, var(--c-primary) 60%, transparent)',
          }}
        >
          {icon}
        </div>
      </div>

      <h3 style={{
        position: 'relative', margin: '0 0 8px',
        fontSize: compact ? 16 : 20, fontWeight: 800,
        color: 'var(--c-text)', fontFamily: 'var(--font-heading)',
        letterSpacing: '-0.01em',
      }}>
        {title}
      </h3>
      {message && (
        <p style={{
          position: 'relative', margin: '0 auto 22px', maxWidth: 440,
          fontSize: 14, color: 'var(--c-text-muted, #64748b)', lineHeight: 1.6,
        }}>
          {message}
        </p>
      )}
      {(actionLabel || secondaryLabel) && (
        <div style={{ position: 'relative', display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          {actionLabel && (
            <button type="button" className="t-btn t-btn-primary pressable glow-primary focus-ring" onClick={onAction}>
              {actionLabel}
            </button>
          )}
          {secondaryLabel && (
            <button type="button" className="t-btn pressable focus-ring" onClick={onSecondary}>
              {secondaryLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
