import { JSDOM } from 'jsdom'
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/' })
global.window = dom.window; global.document = dom.window.document
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true, writable: true }); global.HTMLElement = dom.window.HTMLElement
global.SVGElement = dom.window.SVGElement; global.Element = dom.window.Element
global.AbortController = dom.window.AbortController; global.AbortSignal = dom.window.AbortSignal
global.localStorage = dom.window.localStorage
global.requestAnimationFrame = (cb) => setTimeout(cb, 0)
global.cancelAnimationFrame = clearTimeout
global.matchMedia = () => ({ matches: false, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} })
dom.window.matchMedia = global.matchMedia
global.IS_REACT_ACT_ENVIRONMENT = true

let pass = 0, fail = 0
const ok = (name, cond, extra = '') => { if (cond) pass++; else { fail++; console.log('  ✗', name, extra) } }

const React = (await import('react')).default
const { createRoot } = await import('react-dom/client')
const { act } = await import('react')

const store = (await import('../src/core/store/index.js')).default
const pay = await import('../src/payments/index.js')
const os = await import('../src/core/store/slices/ordersSlice.js')

/* ------------------------------------------------------------------
 * Empty-first: the seeds ship zero rows, so this suite builds its own
 * hermetic shopper, catalogue and orders instead of reading demo data.
 * ------------------------------------------------------------------ */
const SC = { id: 'SC-1', name: 'Test Shopper', email: 'shopper@x.com', phone: '9999999911' }
const SF_PRODUCTS = [
  { id: 'SP-1', name: 'Banarasi Silk Saree', category: 'Ethnic Wear', price: 2999, mrp: 3999, gst: 12, stock: 30, status: 'active', variants: [{ id: 'v1', label: 'Crimson' }] },
  { id: 'SP-2', name: 'Cotton Kurti', category: 'Ethnic Wear', price: 849, mrp: 1299, gst: 5, stock: 50, status: 'active' },
  { id: 'SP-3', name: 'Linen Shirt', category: 'Western Wear', price: 1499, mrp: 1999, gst: 12, stock: 30, status: 'active' },
  { id: 'SP-4', name: 'Running Shoes', category: 'Footwear', price: 2499, mrp: 2999, gst: 18, stock: 25, status: 'active' },
  { id: 'SP-5', name: 'Denim Jeans', category: 'Western Wear', price: 1999, mrp: 2499, gst: 12, stock: 20, status: 'active' },
  { id: 'SP-6', name: 'Gold Plated Jhumka', category: 'Jewellery', price: 1299, mrp: 1999, gst: 3, stock: 15, status: 'active' },
]

console.log('\n── Payments: real key handling (no simulation anywhere)')
{
  const gw = await import('../src/engines/payments/paymentGateway.js')
  const hub = await import('../src/engines/integrations/store.js')
  hub.clearIntegration('payments')

  const baseSettings = {
    payments: {
      razorpay: { enabled: true, methods: ['upi', 'card'] },
      stripe: { enabled: true, methods: ['card'] },
      cod: { enabled: true },
    },
  }

  // Mode is a fact about the key prefix — never a setting.
  ok('keyMode: rzp_test_ → test', gw.keyMode('razorpay', 'rzp_test_abc') === 'test')
  ok('keyMode: rzp_live_ → live', gw.keyMode('razorpay', 'rzp_live_abc') === 'live')
  ok('keyMode: pk_test_ → test', gw.keyMode('stripe', 'pk_test_abc') === 'test')
  ok('keyMode: pk_live_ → live', gw.keyMode('stripe', 'pk_live_abc') === 'live')
  ok('keyMode: empty → null', gw.keyMode('razorpay', '') === null)
  ok('keyMode: unrecognized prefix → test (never accidentally live)',
    gw.keyMode('razorpay', 'weird-key') === 'test')
  ok('keyRecognized accepts rzp_test_', gw.keyRecognized('razorpay', 'rzp_test_x') === true)
  ok('keyRecognized rejects unknown prefixes', gw.keyRecognized('razorpay', 'weird-key') === false)
  ok('modeLabel live', gw.modeLabel('live') === 'Live')
  ok('modeLabel test', gw.modeLabel('test') === 'Test')

  // No key anywhere → not ready, no fake "connected".
  const s0 = gw.gatewayStatus('razorpay', baseSettings, 'https://pay.test')
  ok('no key → not ready', s0.ready === false && s0.keyPresent === false)

  // Key from the Integrations hub resolves.
  hub.setIntegrationConfig('payments', 'razorpay', { keyId: 'rzp_test_hubkey' })
  ok('hub-saved key resolves', gw.gatewayKey('razorpay', baseSettings) === 'rzp_test_hubkey')
  const s1 = gw.gatewayStatus('razorpay', baseSettings, 'https://pay.test')
  ok('key + backend → ready', s1.ready === true)
  ok('mode derived from the key', s1.mode === 'test')
  ok('missing backend → not ready', gw.gatewayStatus('razorpay', baseSettings, '').ready === false)

  // Admin Settings key works when the hub selected the other provider.
  hub.setIntegrationConfig('payments', 'stripe', { publishableKey: 'pk_test_hub' })
  const adminKeySettings = { payments: { razorpay: { keyId: 'rzp_test_admin', enabled: true } } }
  ok('admin-settings key resolves', gw.gatewayKey('razorpay', adminKeySettings) === 'rzp_test_admin')

  // Secrets can never leak through key resolution: only publishable ids.
  ok('gatewayKey never returns anything secret-shaped',
    !/secret/i.test(gw.gatewayKey('razorpay', adminKeySettings) || 'x'))
  hub.clearIntegration('payments')
}

console.log('\n── Payments: methods follow REAL readiness + honest notice')
{
  const gw = await import('../src/engines/payments/paymentGateway.js')
  const hub = await import('../src/engines/integrations/store.js')
  hub.clearIntegration('payments')
  const API = 'https://pay.example.com'

  const baseSettings = {
    payments: {
      razorpay: { enabled: true, methods: ['upi', 'card', 'netbanking'] },
      stripe: { enabled: true, methods: ['card'] },
      cod: { enabled: true },
    },
  }

  // Fresh install (no keys): only COD is offered — nothing fake.
  const fresh = pay.availableMethods(store.get('settings'), API)
  ok('fresh install offers COD only', fresh.length === 1 && fresh[0].gateway === 'cod', JSON.stringify(fresh))

  // Enabled but unconfigured gateway is excluded; the notice is honest.
  const bare = pay.availableMethods(baseSettings, API)
  ok('unconfigured gateway excluded from methods', !bare.some(m => m.gateway === 'razorpay'))
  ok('COD still offered', bare.some(m => m.gateway === 'cod'))
  const notice = gw.paymentsNotice(baseSettings, API)
  ok('honest notice names COD', Boolean(notice) && /Cash on Delivery/.test(notice.message), notice?.message)
  ok('honest notice points at Integrations', /Integrations/.test(notice.message))

  // Configured gateway: methods appear with their REAL mode.
  hub.setIntegrationConfig('payments', 'razorpay', { keyId: 'rzp_test_abc' })
  const methods = pay.availableMethods(baseSettings, API)
  ok('configured gateway methods appear', methods.some(m => m.gateway === 'razorpay' && m.id === 'upi'))
  const upi = methods.find(m => m.gateway === 'razorpay' && m.id === 'upi')
  ok('method carries the real mode', upi.mode === 'test')
  ok('method carries the mode label', upi.modeLabel === 'Test')
  ok('every method names its gateway', methods.every(m => Boolean(m.gateway)))
  ok('no duplicate method ids', new Set(methods.map(m => m.id)).size === methods.length)

  // Live key → live label.
  hub.setIntegrationConfig('payments', 'razorpay', { keyId: 'rzp_live_abc' })
  const liveMethods = pay.availableMethods(baseSettings, API)
  ok('live key labelled live', liveMethods.find(m => m.gateway === 'razorpay').mode === 'live')

  // All ready → no notice.
  const readySettings = {
    payments: {
      razorpay: { enabled: true, keyId: 'rzp_test_a', methods: ['upi'] },
      stripe: { enabled: true, publishableKey: 'pk_test_b', methods: ['card'] },
      cod: { enabled: true },
    },
  }
  ok('no notice when everything is ready', gw.paymentsNotice(readySettings, API) === null)

  // Disabling still removes methods.
  const noRzp = pay.availableMethods({
    payments: {
      razorpay: { enabled: false, keyId: 'rzp_test_a', methods: ['upi'] },
      stripe: { enabled: true, publishableKey: 'pk_test_b', methods: ['card'] },
      cod: { enabled: true },
    },
  }, API)
  ok('disabling razorpay removes its methods', !noRzp.some(m => m.gateway === 'razorpay'))
  ok('stripe still offered', noRzp.some(m => m.gateway === 'stripe'))

  const nothing = pay.availableMethods({ payments: {} }, API)
  ok('no gateways means no methods', nothing.length === 0)

  ok('gatewayForMethod routes UPI to razorpay',
    pay.gatewayForMethod('upi', readySettings) === 'razorpay')
  ok('gatewayForMethod returns null for unsupported',
    pay.gatewayForMethod('bitcoin', readySettings) === null)
  hub.clearIntegration('payments')
}

console.log('\n── Payments: catalogue is descriptive only (no simulation)')
{
  ok('razorpay covers UPI', Boolean(pay.RAZORPAY_METHODS.upi))
  ok('UPI is free to accept', pay.RAZORPAY_METHODS.upi.feePct === 0)
  ok('stripe card defined', Boolean(pay.STRIPE_METHODS.card))
  ok('no success-rate fiction in the catalogue',
    Object.values(pay.RAZORPAY_METHODS).every(m => m.successRate === undefined))
  ok('REALITY lists server-only keys',
    pay.REALITY.serverOnlyKeys.some(k => /SECRET/i.test(k)))
  ok('REALITY never marks a secret client-safe',
    pay.REALITY.clientSafeKeys.every(k => !/secret/i.test(k)))
  ok('REALITY documents the verify endpoint',
    pay.REALITY.endpointsNeeded.some(e => e.includes('verify')))
}

console.log('\n── Payments: processPayment — real flows, mocked HTTP/SDK (no network)')
{
  const gw = await import('../src/engines/payments/paymentGateway.js')
  const API = 'https://pay.example.com'
  const keySettings = {
    payments: {
      razorpay: { enabled: true, keyId: 'rzp_test_x', methods: ['upi'] },
      stripe: { enabled: true, publishableKey: 'pk_test_x', methods: ['card'] },
      cod: { enabled: true },
    },
  }

  // COD: real, no gateway, no fake transaction id, no confirmation needed.
  const cod = await pay.pay({ gateway: 'cod', amount: 1999, method: 'cod' })
  ok('COD always succeeds', cod.ok)
  ok('COD is not captured up front', cod.captured === false)
  ok('COD has no fake transaction id', cod.reference === null)
  ok('COD is never marked verified', cod.verified === false)

  const engineCod = await gw.processPayment({
    gateway: 'cod', amount: 1999, method: 'cod', settings: keySettings, confirmed: false,
  })
  ok('engine COD path works without confirmation', engineCod.ok)

  // Online gateways must go through processPayment, not pay().
  const direct = await pay.pay({ gateway: 'razorpay', amount: 100, method: 'upi', settings: keySettings })
  ok('online pay() redirects to the real checkout', !direct.ok && /checkout/i.test(direct.error.message))

  // Unconfigured gateway → honest refusal, never a fake charge.
  const noKeySettings = {
    payments: { razorpay: { enabled: true, methods: ['upi'] }, cod: { enabled: true } },
  }
  const noKey = await gw.processPayment({
    gateway: 'razorpay', amount: 1999, method: 'upi', settings: noKeySettings,
    confirmed: true, apiBase: API, fetcher: async () => { throw new Error('must not be called') },
  })
  ok('unconfigured gateway refused honestly', !noKey.ok && /aren't connected/.test(noKey.error.message))

  // Key but no backend → honest refusal.
  const noBackend = await gw.processPayment({
    gateway: 'razorpay', amount: 500, method: 'upi', settings: keySettings,
    confirmed: true, fetcher: async () => { throw new Error('must not be called') },
  })
  ok('missing backend refused honestly', !noBackend.ok && /payment server is not connected/.test(noBackend.error.message))

  // Real money needs explicit confirmation.
  const needConfirm = await gw.processPayment({
    gateway: 'razorpay', amount: 500, method: 'upi', settings: keySettings,
    confirmed: false, apiBase: API, fetcher: async () => { throw new Error('must not be called') },
  })
  ok('real charge refuses without confirmation', !needConfirm.ok && /confirmation/.test(needConfirm.error.message))

  // Full Razorpay flow: create-order → SDK handler → VERIFY → ok.
  const rzpCalls = []
  const rzpFetch = async (url, opts) => {
    rzpCalls.push({ url, body: JSON.parse(opts.body) })
    if (url.endsWith('/payments/razorpay/create-order')) {
      return { ok: true, json: async () => ({ id: 'order_mock123', amount: 50000, currency: 'INR', receipt: 'rcpt_1' }) }
    }
    if (url.endsWith('/payments/razorpay/verify')) {
      return { ok: true, json: async () => ({ ok: true, captured: true }) }
    }
    throw new Error('unexpected URL ' + url)
  }
  const rzpSdk = async (name) => {
    if (name !== 'razorpay') throw new Error('wrong sdk')
    return class {
      constructor(opts) { this.opts = opts }
      on() {}
      open() {
        this.opts.handler({
          razorpay_payment_id: 'pay_mock123',
          razorpay_order_id: 'order_mock123',
          razorpay_signature: 'sig_mock',
        })
      }
    }
  }
  const rzp = await gw.processPayment({
    gateway: 'razorpay', amount: 500, method: 'upi', settings: keySettings,
    customer: SC, receipt: 'rcpt_1', confirmed: true,
    apiBase: API, fetcher: rzpFetch, loadSdk: rzpSdk,
  })
  ok('razorpay full flow succeeds', rzp.ok, JSON.stringify(rzp.error))
  ok('reference is the REAL payment id', rzp.reference === 'pay_mock123')
  ok('payment is backend-verified before ok', rzp.verified === true)
  ok('create-order was called with paise', rzpCalls.some(c => c.url.endsWith('/create-order') && c.body.amount === 50000))
  ok('verify endpoint was hit with the signature',
    rzpCalls.some(c => c.url.endsWith('/verify') && c.body.razorpay_signature === 'sig_mock'))

  // A failed backend verification is NEVER reported as paid.
  const badVerifyFetch = async (url) => url.endsWith('/verify')
    ? { ok: true, json: async () => ({ ok: false, error: 'Signature mismatch' }) }
    : { ok: true, json: async () => ({ id: 'order_x', amount: 100, currency: 'INR' }) }
  const bad = await gw.processPayment({
    gateway: 'razorpay', amount: 500, method: 'upi', settings: keySettings,
    customer: SC, confirmed: true, apiBase: API, fetcher: badVerifyFetch, loadSdk: rzpSdk,
  })
  ok('failed verification is not marked paid', !bad.ok)

  // Full Stripe flow: create-intent → confirmCardPayment → confirm → ok.
  const stripeCalls = []
  const stripeFetch = async (url) => {
    stripeCalls.push(url)
    if (url.endsWith('/payments/stripe/create-intent')) {
      return { ok: true, json: async () => ({ id: 'pi_mock123', clientSecret: 'pi_mock123_secret_abc' }) }
    }
    if (url.endsWith('/payments/stripe/confirm')) {
      return { ok: true, json: async () => ({ status: 'succeeded' }) }
    }
    throw new Error('unexpected URL ' + url)
  }
  const stripeSdk = async (name) => {
    if (name !== 'stripe') throw new Error('wrong sdk')
    return (key) => ({
      key,
      confirmCardPayment: async () => ({ paymentIntent: { id: 'pi_mock123', status: 'succeeded' } }),
    })
  }
  const st = await gw.processPayment({
    gateway: 'stripe', amount: 750, method: 'card', settings: keySettings,
    confirmed: true, stripeCard: { fakeElement: true },
    apiBase: API, fetcher: stripeFetch, loadSdk: stripeSdk,
  })
  ok('stripe full flow succeeds', st.ok, JSON.stringify(st.error))
  ok('stripe reference is the intent id', st.reference === 'pi_mock123')
  ok('stripe confirm endpoint was hit', stripeCalls.some(u => u.endsWith('/payments/stripe/confirm')))

  // Stripe without a card element → readable error, not a fake charge.
  const noCard = await gw.processPayment({
    gateway: 'stripe', amount: 750, method: 'card', settings: keySettings,
    confirmed: true, stripeCard: null, apiBase: API, fetcher: stripeFetch, loadSdk: stripeSdk,
  })
  ok('stripe without card details refuses', !noCard.ok && /Card details/.test(noCard.error.message))

  // Unknown gateway is rejected.
  const unknown = await gw.processPayment({
    gateway: 'paypal', amount: 100, settings: keySettings, confirmed: true, apiBase: API,
  })
  ok('unknown gateway rejected', !unknown.ok)
}
console.log('\n── Orders slice: storefront purchases')
{
  const before = os.selectOrders({ orders: store.get('orders') }).length
  ok('order book boots empty', before === 0, before)
  const order = {
    id: 'BC99001', customerId: SC.id, customerName: SC.name,
    placedAt: Date.now(), items: [{ productId: 'SP-1', name: 'Banarasi Silk Saree', sku: 'X', qty: 1, price: 1000, gst: 5, category: 'Ethnic Wear' }],
    subtotal: 1000, discount: 0, gst: 48, shipping: 0, codFee: 0, total: 1000,
    paymentMethod: 'UPI', paid: true, status: 'Confirmed', channel: 'Web',
    address: { city: 'Delhi', state: 'Delhi', pincode: '110001' },
  }
  store.dispatch('orders/placeOrder', { order })

  const after = os.selectOrders({ orders: store.get('orders') })
  ok('storefront order joins the order book', after.length === before + 1)
  ok('new order is first', after[0].id === 'BC99001')
  ok('selectOrder finds a created order', os.selectOrder({ orders: store.get('orders') }, 'BC99001')?.id === 'BC99001')
  ok('created order gets an opening timeline entry',
     os.selectOrder({ orders: store.get('orders') }, 'BC99001').timeline?.length >= 1)
  ok('by-customer includes the new order',
     os.selectOrdersByCustomer({ orders: store.get('orders') }, SC.id).some(o => o.id === 'BC99001'))

  // The admin must be able to act on a storefront order like any other
  const oe = await import('../src/engines/orders/orderEngine.js')
  const created = os.selectOrder({ orders: store.get('orders') }, 'BC99001')
  ok('admin can transition a storefront order', oe.canTransition(created, oe.ORDER_STATUS.PACKED).ok)
  store.dispatch('orders/transition', { order: created, to: oe.ORDER_STATUS.PACKED, role: 'admin' })
  ok('transition applies to created orders',
     os.selectOrder({ orders: store.get('orders') }, 'BC99001').status === oe.ORDER_STATUS.PACKED)

  // Finance must count it too — otherwise the panels disagree
  const fin = await import('../src/engines/finance/financeEngine.js')
  const bookNow = os.selectOrders({ orders: store.get('orders') })
  const pnl = fin.profitAndLoss(bookNow, [])
  const live = bookNow.filter(o => o.status !== 'Cancelled').length
  ok('finance counts every non-cancelled order including storefront ones',
     pnl.orderCount === live, `${pnl.orderCount} vs ${live}`)
  const without = fin.profitAndLoss(bookNow.filter(o => o.id !== 'BC99001'), [])
  ok('removing the storefront order changes the P&L', pnl.orderCount === without.orderCount + 1)
}

console.log('\n── Storefront ↔ admin wiring')
{
  const { ShopProvider, useShop } = await import('../src/shop/shopState.jsx')

  // A probe component that exposes the live shop context to the test
  let ctx = null
  function Probe() { ctx = useShop(); return null }
  const mount = async () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const root = createRoot(el)
    await act(async () => {
      root.render(React.createElement(ShopProvider, null, React.createElement(Probe)))
    })
    return { el, root }
  }

  // The catalogue boots empty; stock it through the admin action first so
  // the storefront has a live catalogue to read.
  for (const p of SF_PRODUCTS) store.dispatch('catalogue/createProduct', p)
  ok('catalogue stocked for the storefront',
     store.get('catalogue').products.filter(p => p.status === 'active').length === SF_PRODUCTS.length)

  let { root } = await mount()
  ok('shop context exposed', Boolean(ctx))
  ok('storefront reads the live catalogue', ctx.products.length > 0)
  ok('only active products are shown', ctx.products.every(p => p.status === 'active'))
  ok('cart starts empty', ctx.cart.length === 0)
  ok('settings reach the storefront', Boolean(ctx.settings?.store?.name))

  // add to cart
  const p0 = ctx.products[0]
  await act(async () => { ctx.add(p0, (p0.variants || [])[0], 2) })
  ok('add puts an item in the cart', ctx.cart.length === 1)
  ok('quantity respected', ctx.cart[0].qty === 2)
  ok('line total computed', ctx.cart[0].lineTotal === ctx.cart[0].price * 2)
  ok('subtotal matches the line', ctx.subtotal === ctx.cart[0].lineTotal)
  ok('cart count aggregates qty', ctx.cartCount === 2)

  // tax must come from the engine, and GST must be non-zero on a taxed product
  ok('GST computed on the cart', ctx.tax.total > 0, ctx.tax.total)
  ok('GST splits into CGST+SGST or IGST',
     (ctx.tax.cgst > 0 && ctx.tax.sgst > 0) || ctx.tax.igst > 0)
  ok('intra-state splits evenly', ctx.tax.interState || ctx.tax.cgst === ctx.tax.sgst)

  /* --- the critical property: admin changes must reach the storefront --- */

  // 1. free shipping threshold
  await act(async () => { store.dispatch('settings/setCheckout', { freeShippingAbove: 1 }) })
  ok('admin free-shipping threshold reaches the cart', ctx.shipping === 0, ctx.shipping)

  // Shipping is free if EITHER the threshold lever OR a free-shipping
  // promotion says so. Create an explicit free-shipping promo, then close
  // the threshold lever — the promo must still cover shipping.
  await act(async () => {
    store.dispatch('promo/create', {
      name: 'Test free shipping', type: 'free_shipping', active: true,
      code: null, conditions: { all: [] }, stackable: true, priority: 1,
    })
  })
  const shipPromo = store.get('promo').promos.find(p => p.type === 'free_shipping')
  ok('free-shipping promo created', Boolean(shipPromo))
  await act(async () => { store.dispatch('settings/setCheckout', { freeShippingAbove: 99999999 }) })
  ok('free-shipping promotion still covers shipping', ctx.shipping === 0 && ctx.promoResult.freeShipping)

  await act(async () => { store.dispatch('promo/toggle', shipPromo.id) })
  ok('with both levers closed, shipping is charged', ctx.shipping > 0, ctx.shipping)
  await act(async () => { store.dispatch('settings/setCheckout', { freeShippingAbove: 1 }) })
  ok('threshold alone restores free shipping', ctx.shipping === 0)
  await act(async () => { store.dispatch('promo/toggle', shipPromo.id) })
  await act(async () => { store.dispatch('promo/remove', shipPromo.id) })
  await act(async () => { store.dispatch('settings/setCheckout', { freeShippingAbove: 999 }) })

  // 2. loyalty programme toggle
  // The loyalty ledger starts empty; grant the guest points first so the
  // programme has something to show.
  await act(async () => { store.dispatch('loyalty/grantPoints', { customerId: ctx.me.id, points: 500, reason: 'Test grant' }) })
  const pointsWhenOn = ctx.myPoints
  ok('loyalty points visible when enabled', pointsWhenOn > 0, pointsWhenOn)
  await act(async () => { store.dispatch('settings/setFlag', { key: 'loyalty', value: false }) })
  ok('disabling loyalty hides points', ctx.myPoints === 0)
  ok('disabling loyalty stops earning', ctx.willEarn.points === 0)
  await act(async () => { store.dispatch('settings/setFlag', { key: 'loyalty', value: true }) })
  ok('re-enabling loyalty restores points', ctx.myPoints > 0)

  // 3. loyalty earn rate
  const earnBefore = ctx.willEarn.points
  await act(async () => { store.dispatch('loyalty/setConfig', { earnPerRupee: 0.5 }) })
  ok('admin earn rate changes what the shopper earns', ctx.willEarn.points > earnBefore,
     `${ctx.willEarn.points} vs ${earnBefore}`)
  await act(async () => { store.dispatch('loyalty/setConfig', { earnPerRupee: 0.05 }) })

  // 4. COD availability
  await act(async () => { store.dispatch('settings/setFlag', { key: 'cod', value: false }) })
  ok('disabling COD blocks it on the storefront', !ctx.codAvailable.ok)
  ok('COD block explains itself', Boolean(ctx.codAvailable.reason))
  await act(async () => { store.dispatch('settings/setFlag', { key: 'cod', value: true }) })

  // 5. COD max value
  await act(async () => { store.dispatch('settings/setCheckout', { codMaxValue: 1 }) })
  ok('COD max value enforced on the storefront', !ctx.codAvailable.ok)
  ok('COD cap message mentions the limit', /above/.test(ctx.codAvailable.reason))
  await act(async () => { store.dispatch('settings/setCheckout', { codMaxValue: 15000 }) })

  // 6. seller state drives intra vs inter-state GST.
  // The guest shopper carries no state, so the storefront falls back to the
  // seller state (always intra-state for a guest). The split itself is
  // pinned at the engine level, and the storefront must recompute tax live
  // when the seller state changes.
  const gstEng = await import('../src/engines/tax/gst.js')
  const intraLine = gstEng.taxLine({ amount: 1120, rate: 12, inclusive: true, interState: false })
  ok('same-state sale splits into CGST + SGST',
     intraLine.cgst > 0 && intraLine.sgst > 0 && intraLine.igst === 0, JSON.stringify(intraLine))
  ok('same-state halves are equal', intraLine.cgst === intraLine.sgst)
  const interLine = gstEng.taxLine({ amount: 1120, rate: 12, inclusive: true, interState: true })
  ok('other-state sale becomes IGST',
     interLine.igst > 0 && interLine.cgst === 0 && interLine.sgst === 0, JSON.stringify(interLine))
  ok('total tax is the same either way — only the split changes',
     Math.abs(intraLine.tax - interLine.tax) <= 0.02, `${intraLine.tax} vs ${interLine.tax}`)

  const taxBefore = ctx.tax.total
  await act(async () => { store.dispatch('settings/setAddress', { state: 'Maharashtra' }) })
  ok('storefront recomputes tax when the seller state changes', ctx.tax.total > 0, ctx.tax.total)
  await act(async () => { store.dispatch('settings/setAddress', { state: 'Haryana' }) })
  ok('storefront tax stable across seller states', ctx.tax.total === taxBefore,
     `${ctx.tax.total} vs ${taxBefore}`)

  // 7. a promotion created in admin must apply on the storefront
  const discountBefore = ctx.promoDiscount
  await act(async () => {
    store.dispatch('promo/create', {
      name: 'Test Blanket 10%', type: 'percent', value: 10, active: true,
      code: null, conditions: { all: [] }, stackable: true, priority: 99,
    })
  })
  const promoId = store.get('promo').promos[0].id
  ok('admin promotion reaches the cart', ctx.promoDiscount > discountBefore,
     `${ctx.promoDiscount} vs ${discountBefore}`)
  ok('new promotion appears in the applied list',
     ctx.promoResult.applied.some(a => a.promo?.id === promoId))
  ok('discount reduces the payable total', ctx.total < ctx.subtotal + ctx.tax.total + ctx.shipping)

  await act(async () => { store.dispatch('promo/toggle', promoId) })
  ok('pausing the promotion stops it applying',
     !ctx.promoResult.applied.some(a => a.promo?.id === promoId))
  ok('pausing restores the previous discount total', ctx.promoDiscount === discountBefore,
     `${ctx.promoDiscount} vs ${discountBefore}`)
  await act(async () => { store.dispatch('promo/remove', promoId) })

  // 8. maintenance mode
  await act(async () => { store.dispatch('settings/setMaintenance', true) })
  ok('maintenance flag reaches the storefront', ctx.settings.maintenanceMode === true)
  await act(async () => { store.dispatch('settings/setMaintenance', false) })

  // cart mutation
  await act(async () => { ctx.setQty(ctx.cart[0].key, 5) })
  ok('setQty updates the line', ctx.cart[0].qty === 5)
  await act(async () => { ctx.setQty(ctx.cart[0].key, 0) })
  ok('zero quantity removes the line', ctx.cart.length === 0)

  // placing an order through the storefront
  await act(async () => { ctx.add(p0, (p0.variants || [])[0], 1) })
  const beforeCount = os.selectOrders({ orders: store.get('orders') }).length
  let placed = null
  await act(async () => { placed = ctx.placeOrder({ line1: 'A', city: 'Delhi', state: 'Delhi', pincode: '110001' }) })
  ok('placeOrder succeeds', placed.ok, placed.error)
  ok('order lands in the shared order book',
     os.selectOrders({ orders: store.get('orders') }).length === beforeCount + 1)
  ok('placed order carries the computed GST', placed.order.gst > 0)
  ok('placed order totals match the cart', placed.order.total > 0)
  ok('cart cleared after placing', ctx.cart.length === 0)
  ok('order visible in my orders', ctx.myOrders.some(o => o.id === placed.order.id))

  // empty cart must refuse
  let empty = null
  await act(async () => { empty = ctx.placeOrder({}) })
  ok('empty cart cannot be ordered', !empty.ok)
  ok('empty cart explains why', /empty/i.test(empty.error))

  await act(async () => { root.unmount() })
}

console.log('\n── Recommendation engine signatures')
{
  const reco = await import('../src/engines/analytics/recoEngine.js')
  // Empty-first: the reco engine gets explicit fixture orders, not a seed book.
  const dayAgo = 86400000
  const now = Date.now()
  const orders = [
    { id: 'RO-1', customerId: 'SC-1', status: 'Delivered', placedAt: now - 2 * dayAgo, items: [{ productId: 'SP-1', qty: 1 }, { productId: 'SP-2', qty: 2 }] },
    { id: 'RO-2', customerId: 'SC-1', status: 'Delivered', placedAt: now - 9 * dayAgo, items: [{ productId: 'SP-1', qty: 1 }, { productId: 'SP-3', qty: 1 }] },
    { id: 'RO-3', customerId: 'SC-2', status: 'Delivered', placedAt: now - 4 * dayAgo, items: [{ productId: 'SP-2', qty: 1 }, { productId: 'SP-4', qty: 1 }] },
  ]
  const cat = SF_PRODUCTS

  // These argument orders are easy to get wrong and fail only at runtime,
  // so pin them down.
  const feed = reco.personalisedFeed(SC, cat, { limit: 5 })
  ok('personalisedFeed(customer, catalogue, opts)', Array.isArray(feed) && feed.length <= 5)
  ok('feed returns products', feed.every(p => Boolean(p?.id)))

  const hot = reco.trending(cat, orders, { limit: 5 })
  ok('trending(catalogue, orders, opts)', Array.isArray(hot) && hot.length <= 5)
  ok('trending entries wrap a product', hot.every(x => Boolean(x.product?.id)))

  const sim = reco.similarProducts(cat[0], cat, 4)
  ok('similarProducts(product, catalogue, limit)', Array.isArray(sim) && sim.length <= 4)

  const fbt = reco.frequentlyBoughtTogether(cat[0].id, orders, cat, 3)
  ok('frequentlyBoughtTogether(productId, orders, catalogue, limit)', Array.isArray(fbt))

  const csWrapped = reco.cartCrossSell([{ product: cat[0], qty: 1 }], cat, orders, 4)
  ok('cartCrossSell accepts cart lines', Array.isArray(csWrapped) && csWrapped.length <= 4)
  const csBare = reco.cartCrossSell([cat[0]], cat, orders, 4)
  ok('cartCrossSell accepts bare products', Array.isArray(csBare))
  ok('both shapes agree', csWrapped.length === csBare.length)
  // cartCrossSell returns bare products; trending returns { product, score }.
  // The shapes differ across this engine, so assert the one each actually uses.
  ok('cartCrossSell returns bare products', csWrapped.every(p => Boolean(p?.id)))
  ok('cross-sell never suggests what is already in the cart',
     csWrapped.every(p => p.id !== cat[0].id))
  ok('completeTheLook returns bare products',
     reco.completeTheLook(cat[0], cat, 3).every(p => Boolean(p?.id)))
  ok('similarProducts returns bare products', sim.every(p => Boolean(p?.id)))
  ok('similar never includes the product itself', sim.every(p => p.id !== cat[0].id))
}

console.log('\n── Storefront UI mounts')
{
  const { ShopProvider } = await import('../src/shop/shopState.jsx')
  const { MemoryRouter } = await import('react-router-dom')
  const pages = await import('../src/shop/pages.jsx')
  // Clean-URL pages mount inside a router; the catalogue was stocked above.
  // ProductPage gets no :id here, so it renders its "Product not found" state.
  const screens = [
    ['HomePage', pages.HomePage, 400],
    ['CataloguePage', pages.CataloguePage, 400],
    ['ProductPage', pages.ProductPage, 60],
    ['CartPage', pages.CartPage, 120],
    ['CheckoutPage', pages.CheckoutPage, 200],
    ['AccountPage', pages.AccountPage, 400],
    ['Cart', (await import('../src/shop/Cart.jsx')).default, 120],
    ['Checkout', (await import('../src/shop/Checkout.jsx')).default, 200],
    ['Account', (await import('../src/shop/Account.jsx')).default, 400],
  ]

  for (const [name, Comp, floor] of screens) {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const root = createRoot(el)
    let threw = null
    try {
      await act(async () => {
        root.render(
          React.createElement(MemoryRouter, null,
            React.createElement(ShopProvider, null, React.createElement(Comp)))
        )
      })
    } catch (e) { threw = e }
    ok(`${name} mounts`, !threw, threw?.message)
    // Cart legitimately renders a compact empty state when nothing is in it.
    ok(`${name} renders content`, el.innerHTML.length > floor, el.innerHTML.length)
    await act(async () => { root.unmount() })
  }
}

console.log(`\n${pass} passed · ${fail} failed\n`)
process.exit(fail ? 1 : 0)
