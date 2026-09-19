/** Store-wide settings that admin controls and storefront obeys. */
export const settingsSlice = {
  initial: () => ({
    store: {
      name: 'BharatCart',
      legalName: 'BharatCart Retail Pvt Ltd',
      gstin: '07AABCB1234C1Z5',
      email: 'hello@bharatcart.in',
      phone: '+91 98100 00000',
      address: { line1: '4th Floor, Cyber Hub', city: 'Gurugram', state: 'Haryana', pin: '122002', country: 'India' },
      currency: 'INR',
      currencySymbol: '₹',
      locale: 'en-IN',
      timezone: 'Asia/Kolkata',
      weightUnit: 'kg',
      dimensionUnit: 'cm',
    },
    languages: { enabled: ['en', 'hi'], default: 'en' },
    orderNumberFormat: 'BC-{YYYY}-{SEQ}',
    invoiceNumberFormat: 'INV/{YY}{MM}/{SEQ}',
    businessHours: { open: '10:00', close: '19:00', days: [1, 2, 3, 4, 5, 6] },
    maintenanceMode: false,
    maintenanceMessage: 'We are upgrading the store. Back in a few minutes.',
    featureFlags: {
      loyalty: true,
      reviews: true,
      wishlist: true,
      compare: true,
      guestCheckout: true,
      cod: true,
      giftCards: true,
      storeCredit: true,
      referrals: true,
      b2b: true,
      multiWarehouse: true,
      backInStock: true,
      liveChat: true,
      pwa: true,
    },
    checkout: {
      guestAllowed: true,
      requirePhone: true,
      askGstin: true,
      minOrderValue: 0,
      freeShippingAbove: 999,
      codFee: 49,
      codMaxValue: 15000,
      codDisabledStates: [],
      deliverySlots: false,
      giftWrapFee: 49,
    },
    payments: {
      // No simulated/demo mode exists: online gateways run the real SDKs.
      // Mode ('test' | 'live') is derived from the key prefix, not a setting.
      stripe: { enabled: true, publishableKey: '', methods: ['card'] },
      razorpay: { enabled: true, keyId: '', methods: ['upi', 'card', 'netbanking', 'wallet', 'emi'] },
      cod: { enabled: true },
    },
    seo: {
      title: 'BharatCart — Handcrafted in India',
      description: 'Authentic Indian handloom, crafts and jewellery. GI-tagged, artisan-made.',
      ogImage: '',
      keywords: 'handloom, saree, indian crafts, GI tag',
    },
  }),

  actions: {
    setStore: (s, patch) => ({ store: { ...s.store, ...patch } }),
    setAddress: (s, patch) => ({ store: { ...s.store, address: { ...s.store.address, ...patch } } }),
    setCheckout: (s, patch) => ({ checkout: { ...s.checkout, ...patch } }),
    setPayments: (s, patch) => ({ payments: { ...s.payments, ...patch } }),
    setGateway: (s, { gateway, patch }) => ({
      payments: { ...s.payments, [gateway]: { ...s.payments[gateway], ...patch } },
    }),
    setSeo: (s, patch) => ({ seo: { ...s.seo, ...patch } }),
    toggleFlag: (s, key) => ({ featureFlags: { ...s.featureFlags, [key]: !s.featureFlags[key] } }),
    setFlag: (s, { key, value }) => ({ featureFlags: { ...s.featureFlags, [key]: Boolean(value) } }),
    setMaintenance: (_s, v) => ({ maintenanceMode: Boolean(v) }),
    setLanguages: (s, patch) => ({ languages: { ...s.languages, ...patch } }),
    set: (_s, patch) => patch,
  },
}

export const selectFlags = (s) => s.settings.featureFlags
export const selectCheckout = (s) => s.settings.checkout
export const isEnabled = (s, flag) => Boolean(s.settings.featureFlags[flag])

export default settingsSlice
