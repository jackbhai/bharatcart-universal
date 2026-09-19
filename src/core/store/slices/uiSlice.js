/** Ephemeral UI state — toasts, modals, drawers, command palette. */
export const uiSlice = {
  persist: false,
  initial: () => ({
    toasts: [],
    modal: null,
    drawer: null,
    commandOpen: false,
    sidebarOpen: false,
    themeEditorOpen: false,
    globalLoading: false,
  }),
  actions: {
    toast: (s, t) => ({
      toasts: [...s.toasts, {
        id: 't' + Date.now() + Math.random().toString(36).slice(2, 5),
        type: 'info', duration: 3200, ...(typeof t === 'string' ? { message: t } : t),
      }].slice(-5),
    }),
    dismissToast: (s, id) => ({ toasts: s.toasts.filter(t => t.id !== id) }),
    clearToasts: () => ({ toasts: [] }),

    openModal: (_s, modal) => ({ modal }),
    closeModal: () => ({ modal: null }),
    openDrawer: (_s, drawer) => ({ drawer }),
    closeDrawer: () => ({ drawer: null }),

    setCommand: (_s, v) => ({ commandOpen: Boolean(v) }),
    toggleCommand: (s) => ({ commandOpen: !s.commandOpen }),
    setSidebar: (_s, v) => ({ sidebarOpen: Boolean(v) }),
    setThemeEditor: (_s, v) => ({ themeEditorOpen: Boolean(v) }),
    setLoading: (_s, v) => ({ globalLoading: Boolean(v) }),
  },
}
export default uiSlice
