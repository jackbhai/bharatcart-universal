import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import DataTable from '../../ui/patterns/DataTable.jsx'
import KpiRow from '../../ui/patterns/KpiRow.jsx'
import Button from '../../ui/primitives/Button.jsx'
import { Input, Select, Switch, Slider } from '../../ui/primitives/Input.jsx'
import { Badge, Card, CardHead, Tabs, Progress, Empty, Divider } from '../../ui/primitives/Display.jsx'
import { SHIPPING_ZONES, zoneFor, quoteShipping, estimateDuty, servedCountries } from '../../geo/shipping.js'
import { COUNTRY_LIST, getCountry, methodsFor, supportsCod, validatePostal } from '../../geo/countries.js'
import { checkServiceability } from '../../engines/shipping/shippingEngine.js'
import { warehouseSummary } from '../../engines/inventory/warehouseEngine.js'
import { inr, inrShort } from '../../lib/analytics.js'

const TABS = [
  { id: 'zones', label: 'Zones & rates', icon: '◴' },
  { id: 'calculator', label: 'Rate calculator', icon: '⚖' },
  { id: 'coverage', label: 'Coverage', icon: '⌂' },
  { id: 'rules', label: 'Rules', icon: '⚙' },
]

export default function Shipping() {
  const [tab, setTab] = useState('zones')

  const zoneCount = Object.keys(SHIPPING_ZONES).length
  const countries = useMemo(() => servedCountries(), [])
  const warehouses = useMemo(() => warehouseSummary(), [])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--c-text)' }}>Shipping</h1>
        <p className="text-[12.5px]" style={{ color: 'var(--c-text-muted)' }}>
          What it costs to get a parcel to a customer, where you ship, and the rules that decide the price at checkout.
        </p>
      </div>

      <KpiRow columns={5} items={[
        { label: 'Zones', value: zoneCount, sub: 'rate bands', icon: '◴' },
        { label: 'Countries served', value: countries.length, sub: 'with a rate card', icon: '⌂' },
        { label: 'Warehouses', value: warehouses.length, sub: warehouses.reduce((n, w) => n + w.staff, 0) + ' staff', icon: '▤' },
        { label: 'Domestic base', value: inr(SHIPPING_ZONES.domestic.baseRate), sub: 'free above ' + inr(SHIPPING_ZONES.domestic.freeAbove), tone: 'success', icon: '₹' },
        { label: 'Fastest lane', value: SHIPPING_ZONES.domestic.expressMinDays + '-' + SHIPPING_ZONES.domestic.expressMaxDays + 'd', sub: 'express within India', icon: '◷' },
      ]} />

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          transition={{ duration: .18 }}>
          {tab === 'zones' && <Zones />}
          {tab === 'calculator' && <Calculator />}
          {tab === 'coverage' && <Coverage warehouses={warehouses} />}
          {tab === 'rules' && <Rules />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/* ------------------------------------------------------------------ Zones */

function Zones() {
  const rows = useMemo(
    () => Object.entries(SHIPPING_ZONES).map(([id, z]) => ({ id, ...z })),
    []
  )

  return (
    <div className="space-y-3">
      <Card padding={false}>
        <CardHead title="Zone rate card"
          subtitle="The first half kilo is included in the base rate; extra weight is charged per additional half kilo." />
        <DataTable
          rows={rows}
          rowKey="id"
          pageSize={12}
          columns={[
            { key: 'label', label: 'Zone', render: z => (
              <div>
                <div className="font-semibold text-[12.5px]">{z.label}</div>
                <div className="text-[11px]" style={{ color: 'var(--c-text-muted)' }}>{z.countries.length} countries</div>
              </div>
            ) },
            { key: 'baseRate', label: 'Base', align: 'right', render: z => <span className="tabular-nums text-[12px] font-semibold">{inr(z.baseRate)}</span> },
            { key: 'perKg', label: 'Per extra kg', align: 'right', render: z => (
              z.perKg ? <span className="tabular-nums text-[12px]">{inr(z.perKg)}</span>
                : <span className="text-[12px]" style={{ color: 'var(--c-text-muted)' }}>Included</span>
            ) },
            { key: 'expressRate', label: 'Express', align: 'right', render: z => (
              <div className="text-[12px] tabular-nums">
                {inr(z.expressRate)}
                <span className="block text-[10.5px]" style={{ color: 'var(--c-text-muted)' }}>{z.expressMinDays}-{z.expressMaxDays}d</span>
              </div>
            ) },
            { key: 'freeAbove', label: 'Free above', align: 'right', render: z => (
              z.freeAbove ? <span className="tabular-nums text-[12px]">{inr(z.freeAbove)}</span>
                : <span className="text-[12px]" style={{ color: 'var(--c-text-muted)' }}>Never</span>
            ) },
            { key: 'days', label: 'Transit', align: 'right', render: z => <span className="tabular-nums text-[12px]">{z.minDays}-{z.maxDays} days</span> },
          ]}
        />
      </Card>
    </div>
  )
}

/* ------------------------------------------------------------- Calculator */

function Calculator() {
  const [country, setCountry] = useState('IN')
  const [weight, setWeight] = useState(800)
  const [value, setValue] = useState(2500)
  const [express, setExpress] = useState(false)
  const [pincode, setPincode] = useState('110001')

  const quote = useMemo(
    () => quoteShipping({ country, weightG: weight, orderValueInr: value, express }),
    [country, weight, value, express]
  )
  const duty = useMemo(() => estimateDuty({ country, orderValueInr: value }), [country, value])
  const serviceability = useMemo(
    () => (country === 'IN' && /^\d{6}$/.test(pincode) ? checkServiceability(pincode) : null),
    [country, pincode]
  )
  const postal = useMemo(() => (country === 'IN' ? validatePostal(country, pincode) : null), [country, pincode])
  const info = getCountry(country)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <Card>
        <CardHead title="Quote a shipment" subtitle="The same engine the checkout uses." />
        <div className="space-y-3 mt-2">
          <Select label="Destination" value={country} onChange={e => setCountry(e.target.value)}
            options={COUNTRY_LIST.map(c => ({ value: c.iso2, label: c.name }))} />

          {country === 'IN' && (
            <Input label="Pincode" value={pincode} onChange={e => setPincode(e.target.value)} maxLength={6}
              error={postal && !postal.ok ? postal.reason : undefined} />
          )}

          <Slider label={`Weight — ${weight} g`} value={weight} onChange={setWeight} min={100} max={10000} step={100} />
          <Slider label={`Order value — ${inr(value)}`} value={value} onChange={setValue} min={0} max={50000} step={250} />
          <Switch checked={express} onChange={setExpress} label="Express service" />
        </div>
      </Card>

      <div className="space-y-3">
        <Card>
          <CardHead title="Result" />
          {!quote.ok
            ? <Empty icon="⚠" title="Not served" description={quote.reason ?? 'No rate card covers this destination.'} />
            : (
              <div className="space-y-2 mt-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-[12.5px]" style={{ color: 'var(--c-text-muted)' }}>Shipping charge</span>
                  <span className="text-[22px] font-bold tabular-nums"
                    style={{ color: quote.free ? 'var(--c-success, #16a34a)' : 'var(--c-text)' }}>
                    {quote.free ? 'Free' : inr(quote.cost)}
                  </span>
                </div>
                {quote.shortfall > 0 && (
                  <div className="text-[12px] rounded-[var(--radius-sm)] px-2.5 py-2"
                    style={{ background: 'var(--c-surface-2, rgba(0,0,0,0.03))' }}>
                    Spend {inr(quote.shortfall)} more for free shipping on this lane.
                  </div>
                )}
                <Divider />
                {Object.entries(quote.breakdown ?? {}).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-[12px]">
                    <span style={{ color: 'var(--c-text-muted)' }}>{k}</span>
                    <span className="tabular-nums">{typeof v === 'number' ? inr(v) : String(v)}</span>
                  </div>
                ))}
                <Divider />
                <div className="flex justify-between text-[12px]">
                  <span style={{ color: 'var(--c-text-muted)' }}>Zone</span>
                  <Badge tone="info" size="sm">{quote.zone}</Badge>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span style={{ color: 'var(--c-text-muted)' }}>Transit</span>
                  <span className="tabular-nums">{quote.minDays}-{quote.maxDays} days</span>
                </div>
              </div>
            )}
        </Card>

        <Card>
          <CardHead title="Destination rules" subtitle="What changes at the border and at the door." />
          <div className="space-y-1.5 mt-1 text-[12px]">
            <Row label="Country" value={info?.name ?? country} />
            <Row label="Cash on delivery" value={supportsCod(country) ? 'Supported' : 'Not available'} />
            <Row label="Payment rails" value={(methodsFor(country) ?? []).join(', ') || '—'} />
            <Row label="Import duty" value={duty.applies ? `${inr(duty.amount)} (over ${inr(duty.threshold)})` : 'Below de-minimis'} />
            {duty.note && <p className="text-[11.5px] pt-1" style={{ color: 'var(--c-text-muted)' }}>{duty.note}</p>}
            {serviceability && (
              <>
                <Divider />
                <Row label="Pincode serviceable" value={serviceability.ok ? 'Yes' : 'No'} />
                {serviceability.zone && <Row label="Delivery zone" value={serviceability.zone} />}
                {serviceability.days != null && <Row label="Estimated days" value={String(serviceability.days)} />}
                {serviceability.eta?.label && <Row label="Arrives" value={serviceability.eta.label} />}
                <Row label="COD at this pincode" value={serviceability.cod ? 'Available' : 'Not available'} />
                <Row label="Return pickup" value={serviceability.returnPickup ? 'Available' : 'Not available'} />
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-3">
      <span style={{ color: 'var(--c-text-muted)' }}>{label}</span>
      <span className="text-right">{value}</span>
    </div>
  )
}

/* --------------------------------------------------------------- Coverage */

function Coverage({ warehouses }) {
  const [q, setQ] = useState('')
  const served = useMemo(() => new Set(servedCountries()), [])
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return COUNTRY_LIST
      .filter(c => !needle || c.name.toLowerCase().includes(needle) || c.iso2.toLowerCase().includes(needle))
      .map(c => ({ ...c, zone: zoneFor(c.iso2), served: served.has(c.iso2) }))
  }, [q, served])

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
        {warehouses.map((w, i) => (
          <motion.div key={w.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.25 }}>
            <Card>
              <div className="font-semibold text-[13px]">{w.name}</div>
              <div className="text-[11.5px]" style={{ color: 'var(--c-text-muted)' }}>{w.city}, {w.state}</div>
              <div className="mt-2">
                <Progress value={w.utilisation} tone={w.utilisation > 90 ? 'danger' : 'success'} height={6} />
                <div className="text-[11px] mt-1 tabular-nums" style={{ color: 'var(--c-text-muted)' }}>
                  {w.utilisation}% full · {w.skus} SKUs
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card padding={false}>
        <div className="p-3">
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search country" />
        </div>
        <DataTable
          rows={rows}
          rowKey="iso2"
          pageSize={15}
          columns={[
            { key: 'name', label: 'Country', render: c => <span className="text-[12.5px]">{c.name}</span> },
            { key: 'iso2', label: 'Code', render: c => <span className="font-mono text-[11.5px]">{c.iso2}</span> },
            { key: 'region', label: 'Region', render: c => <span className="text-[12px]">{c.subregion}</span> },
            { key: 'zone', label: 'Zone', render: c => (
              c.zone ? <Badge tone="info" size="sm">{c.zone}</Badge> : <span className="text-[12px]" style={{ color: 'var(--c-text-muted)' }}>—</span>
            ) },
            { key: 'currency', label: 'Currency', render: c => <span className="text-[12px]">{c.currency}</span> },
            { key: 'cod', label: 'COD', render: c => (
              supportsCod(c.iso2) ? <Badge tone="success" size="sm">Yes</Badge> : <span className="text-[12px]" style={{ color: 'var(--c-text-muted)' }}>No</span>
            ) },
            { key: 'served', label: 'Served', render: c => (
              c.served ? <Badge tone="success" size="sm">Shipping</Badge> : <Badge tone="neutral" size="sm">Not yet</Badge>
            ) },
          ]}
        />
      </Card>
    </div>
  )
}

/* ------------------------------------------------------------------ Rules */

function Rules() {
  const [freeAbove, setFreeAbove] = useState(999)
  const [codFee, setCodFee] = useState(49)
  const [expressSurcharge, setExpressSurcharge] = useState(120)
  const [codEnabled, setCodEnabled] = useState(true)
  const [expressEnabled, setExpressEnabled] = useState(true)
  const [freeForGold, setFreeForGold] = useState(true)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <Card>
        <CardHead title="Checkout rules" subtitle="These apply on top of the zone rate card." />
        <div className="space-y-3 mt-2">
          <Slider label={`Free domestic shipping above — ${inr(freeAbove)}`} value={freeAbove}
            onChange={setFreeAbove} min={0} max={5000} step={50} />
          <Divider />
          <Switch checked={codEnabled} onChange={setCodEnabled} label="Offer cash on delivery" />
          {codEnabled && (
            <Slider label={`COD handling fee — ${inr(codFee)}`} value={codFee} onChange={setCodFee} min={0} max={200} step={5} />
          )}
          <Divider />
          <Switch checked={expressEnabled} onChange={setExpressEnabled} label="Offer express delivery" />
          {expressEnabled && (
            <Slider label={`Express surcharge — ${inr(expressSurcharge)}`} value={expressSurcharge}
              onChange={setExpressSurcharge} min={0} max={500} step={10} />
          )}
          <Divider />
          <Switch checked={freeForGold} onChange={setFreeForGold} label="Free express for Gold and Platinum members" />
        </div>
        <div className="mt-3">
          <Button size="sm" variant="primary">Save rules</Button>
        </div>
      </Card>

      <Card>
        <CardHead title="What a customer sees" subtitle="A live preview of the rules above at three cart values." />
        <div className="space-y-2 mt-2">
          {[499, 1499, 4999].map(cart => {
            const free = cart >= freeAbove
            return (
              <div key={cart} className="rounded-[var(--radius-sm)] px-3 py-2.5"
                style={{ background: 'var(--c-surface-2, rgba(0,0,0,0.03))' }}>
                <div className="flex justify-between text-[12.5px]">
                  <span>Cart of {inr(cart)}</span>
                  <span className="font-semibold" style={{ color: free ? 'var(--c-success, #16a34a)' : 'inherit' }}>
                    {free ? 'Free shipping' : inr(59) + ' shipping'}
                  </span>
                </div>
                {!free && (
                  <div className="text-[11.5px] mt-1" style={{ color: 'var(--c-text-muted)' }}>
                    "Add {inr(freeAbove - cart)} more for free delivery" — this nudge is what lifts average order value.
                  </div>
                )}
                {codEnabled && (
                  <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--c-text-muted)' }}>
                    Cash on delivery available, {codFee ? `+${inr(codFee)} fee` : 'no extra fee'}.
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
