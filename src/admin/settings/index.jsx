import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useSlice } from '../../hooks/useStore.js'
import store from '../../core/store/index.js'
import useToast from '../../hooks/useToast.js'
import { STATES } from '../../data/seed.js'
import Button from '../../ui/primitives/Button.jsx'
import { Input, Select, Switch, Slider, Textarea, Label } from '../../ui/primitives/Input.jsx'
import { Badge, Card, CardHead, Tabs, Divider, Tooltip, Empty } from '../../ui/primitives/Display.jsx'
import { gatewayStatus, paymentsApiUrl, modeLabel } from '../../engines/payments/paymentGateway.js'
import { getEnvStatus } from '../../engines/integrations/store.js'
import { validateGstin } from '../../engines/tax/gst.js'
import BackendSettings from './BackendSettings.jsx'
import { inr } from '../../lib/analytics.js'

const TABS = [
  { id: 'store', label: 'Store', icon: '⌂' },
  { id: 'checkout', label: 'Checkout', icon: '▭' },
  { id: 'payments', label: 'Payments', icon: '₹' },
  { id: 'features', label: 'Features', icon: '⚙' },
  { id: 'seo', label: 'SEO', icon: '◎' },
  { id: 'backend', label: 'Backend', icon: '⛁' },
]

export default function Settings() {
  const [tab, setTab] = useState('store')
  const nav = useNavigate()

  const replayWizard = () => {
    try { localStorage.removeItem('bharatcart_setup_done') } catch { /* storage unavailable */ }
    nav('/admin/setup')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--c-text)' }}>Settings</h1>
          <p className="text-[12.5px]" style={{ color: 'var(--c-text-muted)' }}>
            Store identity, checkout rules, payment gateways and feature toggles — all read live by the storefront.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={replayWizard}>↻ Replay setup wizard</Button>
      </div>
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          transition={{ duration: .18 }}>
          {tab === 'store' && <StoreTab />}
          {tab === 'checkout' && <CheckoutTab />}
          {tab === 'payments' && <PaymentsTab />}
          {tab === 'features' && <FeaturesTab />}
          {tab === 'seo' && <SeoTab />}
          {tab === 'backend' && <BackendSettings />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/* -------------------------------------------------------------- store */

function StoreTab() {
  const settings = useSlice('settings')
  const { success } = useToast()
  const s = settings.store
  const set = (patch) => store.dispatch('settings/setStore', patch)
  const setAddr = (patch) => store.dispatch('settings/setAddress', patch)

  const gstinCheck = s.gstin ? validateGstin(s.gstin) : null

  return (
    <div className="grid lg:grid-cols-2 gap-3">
      <Card>
        <CardHead title="Business identity" subtitle="Appears on invoices, emails and the storefront footer." />
        <div className="space-y-3">
          <Input label="Store name" value={s.name} onChange={e => set({ name: e.target.value })} />
          <Input label="Registered legal name" value={s.legalName} onChange={e => set({ legalName: e.target.value })} />
          <Input label="GSTIN" value={s.gstin} onChange={e => set({ gstin: e.target.value.toUpperCase() })}
            error={gstinCheck && gstinCheck.valid === false ? 'That is not a valid GSTIN format' : undefined}
            hint={gstinCheck?.valid ? `Valid · registered in ${gstinCheck.state ?? 'India'}` : '15 characters, e.g. 07AABCB1234C1Z5'} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Support email" type="email" value={s.email} onChange={e => set({ email: e.target.value })} />
            <Input label="Support phone" value={s.phone} onChange={e => set({ phone: e.target.value })} />
          </div>
        </div>
      </Card>

      <Card>
        <CardHead title="Registered address"
          subtitle="This decides whether an order attracts CGST+SGST or IGST — get it right." />
        <div className="space-y-3">
          <Input label="Address line" value={s.address.line1} onChange={e => setAddr({ line1: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="City" value={s.address.city} onChange={e => setAddr({ city: e.target.value })} />
            <Input label="PIN code" value={s.address.pin} maxLength={6}
              onChange={e => setAddr({ pin: e.target.value.replace(/\D/g, '') })} />
          </div>
          <Select label="State (place of supply)" value={s.address.state}
            onChange={e => setAddr({ state: e.target.value })}
            options={STATES.map(x => x.state)} />
          <p className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>
            Orders shipped within <strong style={{ color: 'var(--c-text)' }}>{s.address.state}</strong> are
            intra-state (CGST+SGST). Everything else is inter-state (IGST).
          </p>
        </div>
      </Card>

      <Card>
        <CardHead title="Locale & units" />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Currency" value={s.currency} onChange={e => set({ currency: e.target.value })}
            options={['INR', 'USD', 'GBP', 'AED']} />
          <Select label="Locale" value={s.locale} onChange={e => set({ locale: e.target.value })}
            options={['en-IN', 'hi-IN', 'en-GB', 'en-US']} />
          <Select label="Weight unit" value={s.weightUnit} onChange={e => set({ weightUnit: e.target.value })}
            options={['kg', 'g', 'lb']} />
          <Select label="Dimension unit" value={s.dimensionUnit} onChange={e => set({ dimensionUnit: e.target.value })}
            options={['cm', 'in']} />
        </div>
        <Divider />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Order number format" value={settings.orderNumberFormat}
            onChange={e => store.dispatch('settings/set', { orderNumberFormat: e.target.value })}
            hint="{YYYY} {YY} {MM} {SEQ}" />
          <Input label="Invoice number format" value={settings.invoiceNumberFormat}
            onChange={e => store.dispatch('settings/set', { invoiceNumberFormat: e.target.value })} />
        </div>
      </Card>

      <Card>
        <CardHead title="Storefront availability" />
        <div className="space-y-3">
          <Switch label="Maintenance mode" checked={settings.maintenanceMode}
            onChange={v => { store.dispatch('settings/setMaintenance', v); success(v ? 'Store is now offline' : 'Store is live') }} />
          {settings.maintenanceMode && (
            <Textarea label="Message shown to visitors" rows={2} value={settings.maintenanceMessage}
              onChange={e => store.dispatch('settings/set', { maintenanceMessage: e.target.value })} />
          )}
          <Divider />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Opens at" type="time" value={settings.businessHours.open}
              onChange={e => store.dispatch('settings/set', { businessHours: { ...settings.businessHours, open: e.target.value } })} />
            <Input label="Closes at" type="time" value={settings.businessHours.close}
              onChange={e => store.dispatch('settings/set', { businessHours: { ...settings.businessHours, close: e.target.value } })} />
          </div>
          <div>
            <Label>Support days</Label>
            <div className="flex gap-1">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => {
                const on = settings.businessHours.days.includes(i)
                return (
                  <button key={d} onClick={() => store.dispatch('settings/set', {
                    businessHours: {
                      ...settings.businessHours,
                      days: on ? settings.businessHours.days.filter(x => x !== i) : [...settings.businessHours.days, i],
                    },
                  })}
                    className="flex-1 py-1.5 text-[11px] rounded-lg border font-medium transition-all"
                    style={on
                      ? { background: 'var(--c-primary)', color: 'var(--c-primary-fg)', borderColor: 'var(--c-primary)' }
                      : { color: 'var(--c-text-muted)', borderColor: 'var(--c-border)' }}>
                    {d}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

/* ----------------------------------------------------------- checkout */

function CheckoutTab() {
  const settings = useSlice('settings')
  const c = settings.checkout
  const set = (patch) => store.dispatch('settings/setCheckout', patch)

  return (
    <div className="grid lg:grid-cols-2 gap-3">
      <Card>
        <CardHead title="Checkout flow" subtitle="Every extra field costs you conversions — be deliberate." />
        <div className="space-y-3">
          <Switch label="Allow guest checkout" checked={c.guestAllowed} onChange={v => set({ guestAllowed: v })} />
          <Switch label="Require phone number" checked={c.requirePhone} onChange={v => set({ requirePhone: v })} />
          <Switch label="Ask for GSTIN (B2B invoices)" checked={c.askGstin} onChange={v => set({ askGstin: v })} />
          <Switch label="Offer delivery slots" checked={c.deliverySlots} onChange={v => set({ deliverySlots: v })} />
          <Divider />
          <Input label="Minimum order value" type="number" prefix="₹" value={c.minOrderValue}
            onChange={e => set({ minOrderValue: Number(e.target.value) })}
            hint="0 means no minimum" />
          <Input label="Gift wrap fee" type="number" prefix="₹" value={c.giftWrapFee}
            onChange={e => set({ giftWrapFee: Number(e.target.value) })} />
        </div>
      </Card>

      <Card>
        <CardHead title="Shipping & COD"
          subtitle="Free-shipping thresholds are the highest-leverage AOV lever you have." />
        <div className="space-y-4">
          <div>
            <Input label="Free shipping above" type="number" prefix="₹" value={c.freeShippingAbove}
              onChange={e => set({ freeShippingAbove: Number(e.target.value) })} />
            <p className="text-[11px] mt-1" style={{ color: 'var(--c-text-muted)' }}>
              Set this around 1.3× your current AOV so it pulls baskets up rather than giving away shipping
              on orders that would have converted anyway.
            </p>
          </div>
          <Divider />
          <Input label="COD fee" type="number" prefix="₹" value={c.codFee}
            onChange={e => set({ codFee: Number(e.target.value) })}
            hint="Discourages casual COD orders that turn into RTOs" />
          <Input label="COD maximum order value" type="number" prefix="₹" value={c.codMaxValue}
            onChange={e => set({ codMaxValue: Number(e.target.value) })}
            hint="High-value COD carries the most RTO risk" />
          <div>
            <Label>Disable COD in these states</Label>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {STATES.map(st => {
                const name = st.state
                const on = (c.codDisabledStates || []).includes(name)
                return (
                  <button key={name}
                    onClick={() => set({
                      codDisabledStates: on
                        ? c.codDisabledStates.filter(x => x !== name)
                        : [...(c.codDisabledStates || []), name],
                    })}
                    className="px-2 py-0.5 text-[10.5px] rounded border transition-all"
                    style={on
                      ? { background: 'var(--c-danger)', color: '#fff', borderColor: 'var(--c-danger)' }
                      : { color: 'var(--c-text-muted)', borderColor: 'var(--c-border)' }}>
                    {name}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

/* ----------------------------------------------------------- payments */

function PaymentsTab() {
  const settings = useSlice('settings')
  const { success } = useToast()
  const navigate = useNavigate()
  const p = settings.payments

  const RZP_METHODS = ['upi', 'card', 'netbanking', 'wallet', 'emi', 'paylater']
  const STRIPE_METHODS = ['card']

  const rzp = gatewayStatus('razorpay', settings)
  const strp = gatewayStatus('stripe', settings)
  const backendUrl = paymentsApiUrl()

  return (
    <div className="space-y-3">
      <Card>
        <div className="flex items-start gap-2">
          <span>💳</span>
          <div className="flex-1">
            <p className="text-[12.5px] font-semibold" style={{ color: 'var(--c-text)' }}>
              Real payments — no demo mode
            </p>
            <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--c-text-muted)' }}>
              Online payments run through the genuine Razorpay / Stripe SDKs and your own
              backend, which creates the order and verifies the signature before any order
              is marked paid. Publishable keys are safe in the browser; key secrets stay
              on your server only.
            </p>
            <div className="flex items-center gap-2 mt-2 text-[11.5px]">
              <span style={{ color: 'var(--c-text-muted)' }}>Backend:</span>
              {backendUrl ? (
                <Badge size="sm" tone="success">Connected · {hostOf(backendUrl)}</Badge>
              ) : (
                <Badge size="sm" tone="danger">Not set — set VITE_PAYMENTS_API_URL</Badge>
              )}
              <button className="underline" style={{ color: 'var(--c-primary)' }}
                onClick={() => navigate('/admin/integrations')}>
                Connect in Integrations →
              </button>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-3">
        <GatewayCard
          id="razorpay" title="Razorpay" subtitle="The default for Indian D2C — UPI, cards, netbanking, EMI"
          gateway={p.razorpay} methods={RZP_METHODS} status={rzp}
          keyLabel="Key ID" keyField="keyId" envVar="VITE_RAZORPAY_KEY_ID"
          note="UPI has the lowest fees and the highest success rate in India — keep it first in the list." />

        <GatewayCard
          id="stripe" title="Stripe" subtitle="International cards, via Stripe Elements"
          gateway={p.stripe} methods={STRIPE_METHODS} status={strp}
          keyLabel="Publishable key" keyField="publishableKey" envVar="VITE_STRIPE_PUBLISHABLE_KEY"
          note="Stripe does not support UPI natively in India — pair it with Razorpay rather than replacing it." />
      </div>

      <Card>
        <CardHead title="Cash on delivery" subtitle="Still a third of Indian ecommerce, and the biggest RTO source." />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[12.5px]" style={{ color: 'var(--c-text)' }}>Accept cash on delivery</p>
            <p className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>
              Currently ₹{settings.checkout.codFee} fee, max order {inr(settings.checkout.codMaxValue)}
            </p>
          </div>
          <Switch checked={p.cod?.enabled}
            onChange={v => store.dispatch('settings/setGateway', { gateway: 'cod', patch: { enabled: v } })} />
        </div>
      </Card>
    </div>
  )
}

function hostOf(url) {
  try { return new URL(url).host } catch { return url }
}

/** Honest one-line status for a gateway, derived from the real key + backend. */
function GatewayStatusLine({ status }) {
  if (!status.enabled) return <Badge size="sm" tone="neutral">Disabled</Badge>
  if (!status.keyPresent) return <Badge size="sm" tone="danger">Not connected — no key</Badge>
  if (!status.backendReady) return <Badge size="sm" tone="danger">Key set — backend missing</Badge>
  return (
    <Badge size="sm" tone={status.mode === 'live' ? 'success' : 'warning'}>
      {modeLabel(status.mode)} mode{status.keyRecognized ? '' : ' · unrecognized key'}
    </Badge>
  )
}

function GatewayCard({ id, title, subtitle, gateway = {}, methods, status, keyLabel, keyField, envVar, note }) {
  const { success } = useToast()
  const set = (patch) => store.dispatch('settings/setGateway', { gateway: id, patch })
  const envSet = getEnvStatus(envVar) === 'set'
  const keySource = envSet ? `from ${envVar}` : (gateway[keyField] ? 'saved below' : 'missing')

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-[14px]" style={{ color: 'var(--c-text)' }}>{title}</p>
            <GatewayStatusLine status={status} />
          </div>
          <p className="text-[11.5px]" style={{ color: 'var(--c-text-muted)' }}>{subtitle}</p>
          <p className="text-[11px] mt-1" style={{ color: 'var(--c-text-muted)' }}>
            Key: <strong style={{ color: envSet ? 'var(--c-success)' : 'var(--c-warning)' }}>
              {envSet ? 'Set' : gateway[keyField] ? 'Set' : 'Missing'}
            </strong> <span>({keySource} — value never displayed)</span>
          </p>
        </div>
        <Switch checked={gateway.enabled} onChange={v => set({ enabled: v })} />
      </div>

      <div className="space-y-3">
        <Input label={keyLabel} value={gateway[keyField] ?? ''} onChange={e => set({ [keyField]: e.target.value })}
          placeholder={id === 'razorpay' ? 'rzp_test_...' : 'pk_test_...'}
          hint="Publishable keys are safe in the browser and never displayed back. Never put a secret key here." />
        <div>
          <Label>Enabled methods</Label>
          <div className="flex flex-wrap gap-1.5">
            {methods.map(m => {
              const on = (gateway.methods || []).includes(m)
              return (
                <button key={m}
                  onClick={() => set({
                    methods: on ? gateway.methods.filter(x => x !== m) : [...(gateway.methods || []), m],
                  })}
                  className="px-2.5 py-1 text-[11px] rounded-lg border capitalize transition-all"
                  style={on
                    ? { background: 'var(--c-primary)', color: 'var(--c-primary-fg)', borderColor: 'var(--c-primary)' }
                    : { color: 'var(--c-text-muted)', borderColor: 'var(--c-border)' }}>
                  {m}
                </button>
              )
            })}
          </div>
        </div>
        <p className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>{note}</p>
      </div>
    </Card>
  )
}

/* ----------------------------------------------------------- features */

function FeaturesTab() {
  const settings = useSlice('settings')
  const { success } = useToast()

  const GROUPS = {
    'Shopping experience': ['wishlist', 'compare', 'reviews', 'backInStock', 'pwa'],
    'Checkout & payment': ['guestCheckout', 'cod', 'giftCards', 'storeCredit'],
    'Growth': ['loyalty', 'referrals', 'liveChat'],
    'Operations': ['multiWarehouse', 'b2b'],
  }

  const LABEL = {
    wishlist: 'Wishlist', compare: 'Product comparison', reviews: 'Customer reviews',
    backInStock: 'Back-in-stock alerts', pwa: 'Install as app (PWA)',
    guestCheckout: 'Guest checkout', cod: 'Cash on delivery', giftCards: 'Gift cards',
    storeCredit: 'Store credit', loyalty: 'Loyalty programme', referrals: 'Referral programme',
    liveChat: 'Live chat widget', multiWarehouse: 'Multiple warehouses', b2b: 'B2B pricing & GSTIN',
  }

  const NOTE = {
    loyalty: 'Turning this off hides points across the whole storefront',
    cod: 'COD drives volume but also most RTOs',
    b2b: 'Unlocks GSTIN capture and customer-group pricing',
    reviews: 'Reviews lift conversion but need moderation',
  }

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {Object.entries(GROUPS).map(([group, keys]) => (
        <Card key={group}>
          <CardHead title={group} />
          <div className="space-y-3">
            {keys.filter(k => settings.featureFlags[k] !== undefined).map(k => (
              <div key={k}>
                <Switch label={LABEL[k] ?? k} checked={settings.featureFlags[k]}
                  onChange={() => { store.dispatch('settings/toggleFlag', k); success(`${LABEL[k]} ${settings.featureFlags[k] ? 'disabled' : 'enabled'}`) }} />
                {NOTE[k] && (
                  <p className="text-[10.5px] mt-0.5 ml-[54px]" style={{ color: 'var(--c-text-muted)' }}>{NOTE[k]}</p>
                )}
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  )
}

/* ----------------------------------------------------------------- SEO */

function SeoTab() {
  const settings = useSlice('settings')
  const seo = settings.seo
  const set = (patch) => store.dispatch('settings/setSeo', patch)

  return (
    <div className="grid lg:grid-cols-2 gap-3">
      <Card>
        <CardHead title="Search metadata" subtitle="What Google shows when someone searches for your brand." />
        <div className="space-y-3">
          <Input label="Site title" value={seo.title} onChange={e => set({ title: e.target.value })}
            hint={`${seo.title.length}/60 characters`}
            error={seo.title.length > 60 ? 'Google will truncate this' : undefined} />
          <Textarea label="Meta description" rows={3} value={seo.description}
            onChange={e => set({ description: e.target.value })}
            hint={`${seo.description.length}/160 characters`}
            error={seo.description.length > 160 ? 'Too long — will be cut off' : undefined} />
          <Input label="Keywords" value={seo.keywords} onChange={e => set({ keywords: e.target.value })}
            hint="Comma separated. Low SEO value today, but harmless." />
          <Input label="Social share image URL" value={seo.ogImage} onChange={e => set({ ogImage: e.target.value })}
            placeholder="https://..." hint="1200×630 works best across platforms" />
        </div>
      </Card>

      <div className="space-y-3">
        <Card>
          <CardHead title="Search preview" />
          <div className="p-3 rounded-lg" style={{ background: 'var(--c-surface-alt)' }}>
            <p className="text-[13.5px] leading-tight" style={{ color: '#1a0dab' }}>
              {seo.title || 'Untitled store'}
            </p>
            <p className="text-[11px]" style={{ color: '#006621' }}>
              bharatcart.in
            </p>
            <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--c-text-muted)' }}>
              {seo.description || 'No description set.'}
            </p>
          </div>
        </Card>

        <Card>
          <CardHead title="Languages" subtitle="Which locales the storefront offers." />
          <div className="flex flex-wrap gap-1.5 mb-3">
            {[['en', 'English'], ['hi', 'हिन्दी'], ['ta', 'தமிழ்'], ['bn', 'বাংলা'], ['mr', 'मराठी'], ['te', 'తెలుగు']].map(([code, label]) => {
              const on = settings.languages.enabled.includes(code)
              return (
                <button key={code}
                  onClick={() => store.dispatch('settings/setLanguages', {
                    enabled: on
                      ? settings.languages.enabled.filter(x => x !== code)
                      : [...settings.languages.enabled, code],
                  })}
                  className="px-2.5 py-1 text-[11.5px] rounded-lg border transition-all"
                  style={on
                    ? { background: 'var(--c-primary)', color: 'var(--c-primary-fg)', borderColor: 'var(--c-primary)' }
                    : { color: 'var(--c-text-muted)', borderColor: 'var(--c-border)' }}>
                  {label}
                </button>
              )
            })}
          </div>
          <Select label="Default language" value={settings.languages.default}
            onChange={e => store.dispatch('settings/setLanguages', { default: e.target.value })}
            options={settings.languages.enabled} />
        </Card>
      </div>
    </div>
  )
}
