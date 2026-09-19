import createStore from './createStore.js'
import authSlice from './slices/authSlice.js'
import themeSlice from './slices/themeSlice.js'
import settingsSlice from './slices/settingsSlice.js'
import uiSlice from './slices/uiSlice.js'
import catalogueSlice from './slices/catalogueSlice.js'
import promoSlice from './slices/promoSlice.js'
import loyaltySlice from './slices/loyaltySlice.js'
import ordersSlice from './slices/ordersSlice.js'
import returnsSlice from './slices/returnsSlice.js'
import marketingSlice from './slices/marketingSlice.js'
import localeSlice from './slices/localeSlice.js'

export const slices = {
  auth: authSlice,
  theme: themeSlice,
  settings: settingsSlice,
  ui: uiSlice,
  catalogue: catalogueSlice,
  promo: promoSlice,
  loyalty: loyaltySlice,
  orders: ordersSlice,
  returns: returnsSlice,
  marketing: marketingSlice,
  locale: localeSlice,
}

export const store = createStore(slices)

if (typeof window !== 'undefined') {
  // handy for debugging in the console
  window.__BC_STORE__ = store
}

export { createStore }
export default store
