/**
 * The provider registry.
 *
 * One list, describing every sign-in method the app can offer, which backends
 * actually support each one, and — the part that usually gets glossed over —
 * whether it is genuinely free.
 *
 * The brief was "support every free auth provider so the operator can pick
 * whichever they want". The honest version of that has caveats, and they are
 * recorded here rather than discovered by the operator after a surprise bill:
 *
 *   - Phone / SMS OTP is NOT free anywhere. Firebase moved phone auth behind
 *     the Blaze (pay-as-you-go) plan in September 2024, with no SMS allowance
 *     on the free Spark plan. Supabase requires you to bring your own paid SMS
 *     provider (Twilio, MessageBird, Vonage). It is listed and wired, but it is
 *     flagged `free: false` and the UI says so before the operator enables it.
 *
 *   - SAML and custom OIDC on Firebase need Identity Platform, which is free
 *     only up to 50 monthly active users. Also flagged.
 *
 *   - Everything else — email/password, magic link, anonymous, and the whole
 *     social set — is free to 50,000 monthly active users on both Supabase and
 *     Firebase, which is far beyond what this project will ever need.
 *
 * `backends` lists the adapters that can really perform the flow. The local
 * adapter simulates all of them so the UI is fully explorable with no keys,
 * and that simulation is clearly labelled as a demo in the interface.
 */

export const PROVIDER_KIND = {
  PASSWORD: 'password',
  MAGIC: 'magic',
  OAUTH: 'oauth',
  OTP: 'otp',
  ANON: 'anon',
}

/**
 * Brand colours are used for the button accent. Kept as plain hex so the
 * theming layer can override them without touching this file.
 */
export const PROVIDERS = [
  // ---------------------------------------------------------------- core
  {
    id: 'password',
    kind: PROVIDER_KIND.PASSWORD,
    label: 'Email & password',
    icon: '✉',
    colour: '#64748b',
    free: true,
    backends: ['local', 'supabase', 'firebase', 'cloudflare'],
    note: 'Works on every backend. No third-party setup required.',
  },
  {
    id: 'magic',
    kind: PROVIDER_KIND.MAGIC,
    label: 'Magic link',
    icon: '🔗',
    colour: '#8b5cf6',
    free: true,
    backends: ['local', 'supabase', 'firebase'],
    note: 'Passwordless email link. Free on Supabase and Firebase.',
  },
  {
    id: 'anonymous',
    kind: PROVIDER_KIND.ANON,
    label: 'Continue as guest',
    icon: '👤',
    colour: '#475569',
    free: true,
    backends: ['local', 'supabase', 'firebase'],
    note: 'Guest session that can be upgraded to a real account later.',
  },

  // -------------------------------------------------------------- social
  {
    id: 'google',
    kind: PROVIDER_KIND.OAUTH,
    label: 'Google',
    icon: 'G',
    colour: '#ea4335',
    free: true,
    backends: ['local', 'supabase', 'firebase', 'cloudflare'],
    setup: 'Google Cloud console → OAuth client ID (free).',
  },
  {
    id: 'github',
    kind: PROVIDER_KIND.OAUTH,
    label: 'GitHub',
    icon: '⌥',
    colour: '#24292f',
    free: true,
    backends: ['local', 'supabase', 'firebase', 'cloudflare'],
    setup: 'GitHub → Settings → Developer settings → OAuth Apps (free).',
  },
  {
    id: 'apple',
    kind: PROVIDER_KIND.OAUTH,
    label: 'Apple',
    icon: '',
    colour: '#000000',
    free: false,
    backends: ['local', 'supabase', 'firebase'],
    note: 'Sign in with Apple needs a paid Apple Developer account ($99/yr).',
    setup: 'Apple Developer → Certificates, Identifiers & Profiles.',
  },
  {
    id: 'facebook',
    kind: PROVIDER_KIND.OAUTH,
    label: 'Facebook',
    icon: 'f',
    colour: '#1877f2',
    free: true,
    backends: ['local', 'supabase', 'firebase'],
    setup: 'Meta for Developers → create an app (free).',
  },
  {
    id: 'twitter',
    kind: PROVIDER_KIND.OAUTH,
    label: 'X / Twitter',
    icon: '𝕏',
    colour: '#0f1419',
    free: true,
    backends: ['local', 'supabase', 'firebase'],
    setup: 'X Developer Portal → free tier app.',
  },
  {
    id: 'discord',
    kind: PROVIDER_KIND.OAUTH,
    label: 'Discord',
    icon: '◈',
    colour: '#5865f2',
    free: true,
    backends: ['local', 'supabase'],
    setup: 'Discord Developer Portal → New Application (free).',
  },
  {
    id: 'microsoft',
    kind: PROVIDER_KIND.OAUTH,
    label: 'Microsoft',
    icon: '⊞',
    colour: '#0078d4',
    free: true,
    backends: ['local', 'supabase', 'firebase'],
    setup: 'Azure portal → App registrations (free tier).',
  },
  {
    id: 'gitlab',
    kind: PROVIDER_KIND.OAUTH,
    label: 'GitLab',
    icon: '◭',
    colour: '#fc6d26',
    free: true,
    backends: ['local', 'supabase'],
    setup: 'GitLab → Applications (free).',
  },
  {
    id: 'linkedin',
    kind: PROVIDER_KIND.OAUTH,
    label: 'LinkedIn',
    icon: 'in',
    colour: '#0a66c2',
    free: true,
    backends: ['local', 'supabase'],
    setup: 'LinkedIn Developers → create an app (free).',
  },
  {
    id: 'spotify',
    kind: PROVIDER_KIND.OAUTH,
    label: 'Spotify',
    icon: '♫',
    colour: '#1db954',
    free: true,
    backends: ['local', 'supabase'],
    setup: 'Spotify Developer Dashboard (free).',
  },
  {
    id: 'twitch',
    kind: PROVIDER_KIND.OAUTH,
    label: 'Twitch',
    icon: '▶',
    colour: '#9146ff',
    free: true,
    backends: ['local', 'supabase'],
    setup: 'Twitch Developer Console (free).',
  },
  {
    id: 'slack',
    kind: PROVIDER_KIND.OAUTH,
    label: 'Slack',
    icon: '#',
    colour: '#4a154b',
    free: true,
    backends: ['local', 'supabase'],
    setup: 'Slack API → Your Apps (free).',
  },
  {
    id: 'notion',
    kind: PROVIDER_KIND.OAUTH,
    label: 'Notion',
    icon: 'N',
    colour: '#191919',
    free: true,
    backends: ['local', 'supabase'],
    setup: 'Notion → My integrations (free).',
  },
  {
    id: 'figma',
    kind: PROVIDER_KIND.OAUTH,
    label: 'Figma',
    icon: '◐',
    colour: '#f24e1e',
    free: true,
    backends: ['local', 'supabase'],
    setup: 'Figma → Developers → OAuth app (free).',
  },
  {
    id: 'zoom',
    kind: PROVIDER_KIND.OAUTH,
    label: 'Zoom',
    icon: '▣',
    colour: '#2d8cff',
    free: true,
    backends: ['local', 'supabase'],
    setup: 'Zoom App Marketplace → OAuth app (free).',
  },
  {
    id: 'kakao',
    kind: PROVIDER_KIND.OAUTH,
    label: 'Kakao',
    icon: 'K',
    colour: '#fee500',
    free: true,
    backends: ['local', 'supabase'],
    setup: 'Kakao Developers (free).',
  },
  {
    id: 'yahoo',
    kind: PROVIDER_KIND.OAUTH,
    label: 'Yahoo',
    icon: 'Y',
    colour: '#6001d2',
    free: true,
    backends: ['local', 'firebase'],
    setup: 'Yahoo Developer Network (free).',
  },

  // ----------------------------------------------------------- metered
  {
    id: 'phone',
    kind: PROVIDER_KIND.OTP,
    label: 'Phone OTP',
    icon: '📱',
    colour: '#0ea5e9',
    free: false,
    backends: ['local', 'supabase', 'firebase'],
    note: 'SMS costs money on every provider. Firebase needs the Blaze plan; '
      + 'Supabase needs your own Twilio/MessageBird/Vonage account.',
    setup: 'Firebase: upgrade to Blaze. Supabase: Auth → Providers → Phone.',
  },
  {
    id: 'oidc',
    kind: PROVIDER_KIND.OAUTH,
    label: 'Custom OIDC / SAML',
    icon: '🏢',
    colour: '#0f766e',
    free: false,
    backends: ['local', 'supabase', 'firebase'],
    note: 'Firebase requires Identity Platform, free only to 50 monthly users. '
      + 'Supabase SSO is a paid add-on.',
  },
]

export const PROVIDERS_BY_ID = Object.fromEntries(PROVIDERS.map(p => [p.id, p]))

/** Providers a given backend can genuinely perform. */
export function providersFor(backendId, { freeOnly = false } = {}) {
  return PROVIDERS.filter(p =>
    p.backends.includes(backendId) && (!freeOnly || p.free))
}

/** Just the social buttons, in display order. */
export function oauthProvidersFor(backendId, opts) {
  return providersFor(backendId, opts).filter(p => p.kind === PROVIDER_KIND.OAUTH)
}

export function isFree(id) { return !!PROVIDERS_BY_ID[id]?.free }

export function supports(backendId, providerId) {
  return !!PROVIDERS_BY_ID[providerId]?.backends.includes(backendId)
}

/**
 * Which providers the operator has switched on, defaulting to the free ones
 * the active backend supports. Stored so the storefront and the admin agree.
 */
export const ENABLED_KEY = 'bharatcart:auth:enabled'

export function defaultEnabled(backendId) {
  return providersFor(backendId, { freeOnly: true }).map(p => p.id)
}

export function readEnabled(backendId) {
  try {
    const raw = localStorage.getItem(ENABLED_KEY)
    if (!raw) return defaultEnabled(backendId)
    const list = JSON.parse(raw)
    if (!Array.isArray(list) || !list.length) return defaultEnabled(backendId)
    // A provider the current backend cannot perform must never be shown, even
    // if it was enabled while a different backend was active.
    const usable = list.filter(id => supports(backendId, id))
    return usable.length ? usable : defaultEnabled(backendId)
  } catch {
    return defaultEnabled(backendId)
  }
}

export function writeEnabled(list) {
  try { localStorage.setItem(ENABLED_KEY, JSON.stringify(list)) } catch { /* private mode */ }
  return list
}

export default PROVIDERS
