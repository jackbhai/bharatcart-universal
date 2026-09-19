import { useEffect, useCallback, useMemo } from 'react'
import store from '../core/store/index.js'
import { useSlice } from './useStore.js'
import applyTokens, { contrastRatio, readableOn } from '../theme/tokens/applyTokens.js'
import { TEMPLATES, TEMPLATE_MAP } from '../theme/templates/index.js'
import { TOKEN_GROUPS, TOKEN_META } from '../theme/tokens/schema.js'
import { exportTheme } from '../core/store/slices/themeSlice.js'
import bus from '../core/events/EventBus.js'
import T from '../core/events/topics.js'

/** Mount once near the app root — keeps CSS variables in sync with the store. */
export function useThemeEffect() {
  const theme = useSlice('theme')

  useEffect(() => {
    applyTokens(theme.tokens)
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = theme.templateId
      document.documentElement.dataset.dark = theme.darkMode ? 'true' : 'false'
    }
    bus.emit(T.THEME_CHANGED, { templateId: theme.templateId, tokens: theme.tokens })
  }, [theme.tokens, theme.templateId, theme.darkMode])

  return theme
}

export function useTheme() {
  const theme = useSlice('theme')
  const d = store.dispatch

  const contrastWarnings = useMemo(() => {
    const t = theme.tokens
    const checks = [
      ['Text on background', t.text, t.bg],
      ['Text on surface', t.text, t.surface],
      ['Muted text on surface', t.textMuted, t.surface],
      ['Primary button label', t.primaryFg, t.primary],
    ]
    return checks
      .map(([label, fg, bg]) => ({ label, fg, bg, ratio: contrastRatio(fg, bg) }))
      .filter(c => c.ratio < 4.5)
  }, [theme.tokens])

  return {
    ...theme,
    templates: TEMPLATES,
    template: TEMPLATE_MAP[theme.templateId],
    groups: TOKEN_GROUPS,
    meta: TOKEN_META,
    contrastWarnings,

    applyTemplate: useCallback((id) => {
      d('theme/applyTemplate', id)
      bus.emit(T.THEME_TEMPLATE_APPLIED, { templateId: id })
    }, [d]),

    setToken: useCallback((key, value) => {
      d('theme/setToken', { key, value })
      bus.emit(T.THEME_TOKEN_CHANGED, { key, value })
    }, [d]),

    setTokens: useCallback((patch) => d('theme/setTokens', patch), [d]),
    resetToken: useCallback((key) => d('theme/resetToken', key), [d]),
    resetAll: useCallback(() => d('theme/resetAll'), [d]),
    hardReset: useCallback(() => d('theme/hardReset'), [d]),
    toggleDark: useCallback(() => d('theme/toggleDark'), [d]),
    setPreviewDevice: useCallback((v) => d('theme/setPreviewDevice', v), [d]),

    setHeader: useCallback((p) => d('theme/setHeader', p), [d]),
    setAnnouncement: useCallback((p) => d('theme/setAnnouncement', p), [d]),
    addNavItem: useCallback((i) => d('theme/addNavItem', i), [d]),
    updateNavItem: useCallback((id, patch) => d('theme/updateNavItem', { id, patch }), [d]),
    removeNavItem: useCallback((id) => d('theme/removeNavItem', id), [d]),
    reorderNav: useCallback((from, to) => d('theme/reorderNav', { from, to }), [d]),

    setFooter: useCallback((p) => d('theme/setFooter', p), [d]),
    addFooterColumn: useCallback(() => d('theme/addFooterColumn'), [d]),
    updateFooterColumn: useCallback((id, patch) => d('theme/updateFooterColumn', { id, patch }), [d]),
    removeFooterColumn: useCallback((id) => d('theme/removeFooterColumn', id), [d]),
    addFooterLink: useCallback((columnId, link) => d('theme/addFooterLink', { columnId, link }), [d]),
    removeFooterLink: useCallback((columnId, linkId) => d('theme/removeFooterLink', { columnId, linkId }), [d]),

    saveCustomTheme: useCallback((name) => d('theme/saveCustomTheme', name), [d]),
    applyCustomTheme: useCallback((id) => d('theme/applyCustomTheme', id), [d]),
    deleteCustomTheme: useCallback((id) => d('theme/deleteCustomTheme', id), [d]),
    importTheme: useCallback((json) => d('theme/importTheme', json), [d]),
    exportTheme: useCallback(() => exportTheme(store.get('theme')), []),
  }
}

export { readableOn, contrastRatio }
export default useTheme
