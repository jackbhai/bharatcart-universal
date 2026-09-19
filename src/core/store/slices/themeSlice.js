import { tokensFor, DEFAULT_TEMPLATE_ID, TEMPLATE_MAP } from '../../../theme/templates/index.js'
import { defaultTokens } from '../../../theme/tokens/schema.js'

const initialHeader = () => ({
  layout: 'logo-left',        // logo-left | centered | split
  sticky: true,
  transparentOnHero: false,
  announcement: {
    enabled: true,
    text: '🎉 Festive Sale — Extra 15% off with code FESTIVE15 · Free shipping above ₹999',
    speed: 28,
    bg: '',
    fg: '',
  },
  search: 'inline',           // icon | inline | full
  showWishlist: true,
  showAccount: true,
  showCart: true,
  nav: [
    { id: 'n1', label: 'New In', href: '/shop', children: [] },
    { id: 'n2', label: 'Sarees', href: '/shop', children: [] },
    { id: 'n3', label: 'Kurtas', href: '/shop', children: [] },
    { id: 'n4', label: 'Jewellery', href: '/shop', children: [] },
    { id: 'n5', label: 'Home & Decor', href: '/shop', children: [] },
  ],
  topLinks: [
    { id: 't1', label: 'Track Order', href: '/account/orders' },
    { id: 't2', label: 'Help', href: '/help' },
  ],
})

const initialFooter = () => ({
  columns: [
    { id: 'c1', title: 'Shop', links: [
      { id: 'l1', label: 'New Arrivals', href: '/shop' },
      { id: 'l2', label: 'Best Sellers', href: '/shop' },
      { id: 'l3', label: 'Sale', href: '/shop' },
    ]},
    { id: 'c2', title: 'Help', links: [
      { id: 'l4', label: 'Track Order', href: '/account/orders' },
      { id: 'l5', label: 'Returns', href: '/help' },
      { id: 'l6', label: 'Shipping', href: '/help' },
    ]},
    { id: 'c3', title: 'Company', links: [
      { id: 'l7', label: 'About Us', href: '/about' },
      { id: 'l8', label: 'Contact', href: '/contact' },
      { id: 'l9', label: 'Careers', href: '/careers' },
    ]},
  ],
  newsletter: true,
  newsletterTitle: 'Join our list',
  newsletterText: 'Early access to drops and festive offers.',
  socials: [
    { id: 's1', platform: 'instagram', url: 'https://instagram.com' },
    { id: 's2', platform: 'facebook', url: 'https://facebook.com' },
    { id: 's3', platform: 'youtube', url: 'https://youtube.com' },
  ],
  paymentBadges: true,
  trustBadges: true,
  appBadges: false,
  copyright: '© 2026 BharatCart. All rights reserved.',
  backToTop: true,
  legalLinks: [
    { id: 'g1', label: 'Privacy Policy', href: '/privacy' },
    { id: 'g2', label: 'Terms', href: '/terms' },
  ],
})

export const themeSlice = {
  initial: () => ({
    templateId: DEFAULT_TEMPLATE_ID,
    tokens: tokensFor(DEFAULT_TEMPLATE_ID),
    overrides: {},              // user edits on top of the template
    darkMode: false,
    header: initialHeader(),
    footer: initialFooter(),
    customThemes: [],           // saved user themes
    history: [],                // token change log
    previewDevice: 'desktop',   // desktop | tablet | mobile
  }),

  actions: {
    applyTemplate: (s, templateId) => {
      if (!TEMPLATE_MAP[templateId]) return
      return {
        templateId,
        tokens: tokensFor(templateId),
        overrides: {},
        history: [...s.history.slice(-49), { type: 'template', templateId, at: Date.now() }],
      }
    },

    setToken: (s, { key, value }) => ({
      tokens: { ...s.tokens, [key]: value },
      overrides: { ...s.overrides, [key]: value },
      history: [...s.history.slice(-49), { type: 'token', key, value, at: Date.now() }],
    }),

    setTokens: (s, patch) => ({
      tokens: { ...s.tokens, ...patch },
      overrides: { ...s.overrides, ...patch },
    }),

    resetToken: (s, key) => {
      const base = tokensFor(s.templateId)
      const { [key]: _drop, ...rest } = s.overrides
      return { tokens: { ...s.tokens, [key]: base[key] }, overrides: rest }
    },

    resetAll: (s) => ({
      tokens: tokensFor(s.templateId),
      overrides: {},
    }),

    hardReset: () => ({
      templateId: DEFAULT_TEMPLATE_ID,
      tokens: tokensFor(DEFAULT_TEMPLATE_ID),
      overrides: {},
      header: initialHeader(),
      footer: initialFooter(),
    }),

    toggleDark: (s) => ({ darkMode: !s.darkMode }),
    setDark: (_s, v) => ({ darkMode: Boolean(v) }),

    setPreviewDevice: (_s, d) => ({ previewDevice: d }),

    // ---- header
    setHeader: (s, patch) => ({ header: { ...s.header, ...patch } }),
    setAnnouncement: (s, patch) => ({
      header: { ...s.header, announcement: { ...s.header.announcement, ...patch } },
    }),
    addNavItem: (s, item) => ({
      header: { ...s.header, nav: [...s.header.nav, { id: 'n' + Date.now(), children: [], ...item }] },
    }),
    updateNavItem: (s, { id, patch }) => ({
      header: { ...s.header, nav: s.header.nav.map(n => n.id === id ? { ...n, ...patch } : n) },
    }),
    removeNavItem: (s, id) => ({
      header: { ...s.header, nav: s.header.nav.filter(n => n.id !== id) },
    }),
    reorderNav: (s, { from, to }) => {
      const nav = [...s.header.nav]
      const [m] = nav.splice(from, 1)
      nav.splice(to, 0, m)
      return { header: { ...s.header, nav } }
    },

    // ---- footer
    setFooter: (s, patch) => ({ footer: { ...s.footer, ...patch } }),
    addFooterColumn: (s) => ({
      footer: { ...s.footer, columns: [...s.footer.columns, { id: 'c' + Date.now(), title: 'New Column', links: [] }] },
    }),
    updateFooterColumn: (s, { id, patch }) => ({
      footer: { ...s.footer, columns: s.footer.columns.map(c => c.id === id ? { ...c, ...patch } : c) },
    }),
    removeFooterColumn: (s, id) => ({
      footer: { ...s.footer, columns: s.footer.columns.filter(c => c.id !== id) },
    }),
    addFooterLink: (s, { columnId, link }) => ({
      footer: {
        ...s.footer,
        columns: s.footer.columns.map(c => c.id === columnId
          ? { ...c, links: [...c.links, { id: 'l' + Date.now(), label: 'New link', href: '#', ...link }] }
          : c),
      },
    }),
    removeFooterLink: (s, { columnId, linkId }) => ({
      footer: {
        ...s.footer,
        columns: s.footer.columns.map(c => c.id === columnId
          ? { ...c, links: c.links.filter(l => l.id !== linkId) } : c),
      },
    }),

    // ---- custom themes
    saveCustomTheme: (s, name) => ({
      customThemes: [...s.customThemes, {
        id: 'custom_' + Date.now(),
        name: name || `My Theme ${s.customThemes.length + 1}`,
        tokens: { ...s.tokens },
        header: s.header,
        footer: s.footer,
        createdAt: Date.now(),
      }],
    }),
    applyCustomTheme: (s, id) => {
      const t = s.customThemes.find(c => c.id === id)
      if (!t) return
      return { tokens: { ...defaultTokens(), ...t.tokens }, header: t.header || s.header, footer: t.footer || s.footer }
    },
    deleteCustomTheme: (s, id) => ({ customThemes: s.customThemes.filter(c => c.id !== id) }),

    importTheme: (s, json) => {
      try {
        const parsed = typeof json === 'string' ? JSON.parse(json) : json
        return {
          tokens: { ...defaultTokens(), ...(parsed.tokens || {}) },
          header: parsed.header || s.header,
          footer: parsed.footer || s.footer,
          templateId: parsed.templateId || s.templateId,
        }
      } catch { return }
    },
  },
}

/* ---------------------------------------------------------- selectors */
export const selectTokens = (s) => s.theme.tokens
export const selectHeader = (s) => s.theme.header
export const selectFooter = (s) => s.theme.footer
export const selectTemplate = (s) => TEMPLATE_MAP[s.theme.templateId]

export function exportTheme(themeState) {
  return JSON.stringify({
    templateId: themeState.templateId,
    tokens: themeState.tokens,
    header: themeState.header,
    footer: themeState.footer,
    exportedAt: new Date().toISOString(),
    app: 'BharatCart',
  }, null, 2)
}

export default themeSlice
