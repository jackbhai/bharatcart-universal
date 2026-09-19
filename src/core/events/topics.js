/** Canonical event names. Import these instead of raw strings. */
export const T = {
  // store
  STORE_READY: 'store:ready',
  STORE_HYDRATED: 'store:hydrated',
  STORE_RESET: 'store:reset',
  SLICE_CHANGED: 'store:slice-changed',
  CROSS_TAB_SYNC: 'store:cross-tab-sync',

  // auth
  AUTH_SIGNED_IN: 'auth:signed-in',
  AUTH_SIGNED_OUT: 'auth:signed-out',
  AUTH_SESSION_RESTORED: 'auth:session-restored',
  AUTH_ERROR: 'auth:error',
  AUTH_BACKEND_CHANGED: 'auth:backend-changed',

  // theme
  THEME_CHANGED: 'theme:changed',
  THEME_TOKEN_CHANGED: 'theme:token-changed',
  THEME_TEMPLATE_APPLIED: 'theme:template-applied',
  THEME_RESET: 'theme:reset',

  // catalogue
  PRODUCT_CREATED: 'catalogue:product-created',
  PRODUCT_UPDATED: 'catalogue:product-updated',
  PRODUCT_DELETED: 'catalogue:product-deleted',
  STOCK_CHANGED: 'catalogue:stock-changed',
  PRICE_CHANGED: 'catalogue:price-changed',

  // commerce
  CART_UPDATED: 'cart:updated',
  ORDER_PLACED: 'order:placed',
  ORDER_UPDATED: 'order:updated',

  // loyalty & promos
  LOYALTY_CONFIG_CHANGED: 'loyalty:config-changed',
  POINTS_EARNED: 'loyalty:points-earned',
  POINTS_REDEEMED: 'loyalty:points-redeemed',
  COUPON_CREATED: 'promo:coupon-created',
  PROMO_CONFIG_CHANGED: 'promo:config-changed',

  // settings
  SETTINGS_CHANGED: 'settings:changed',
  NAV_CHANGED: 'settings:nav-changed',

  // ui
  TOAST: 'ui:toast',
  MODAL_OPEN: 'ui:modal-open',
  MODAL_CLOSE: 'ui:modal-close',
}

export default T
