# Part 4 — Loyalty · Promotions · Marketing · Analytics · Finance · Settings

**Status:** ✅ Delivered · 551 assertions passing · build green · deployed

**Live:** https://shiny-starship-ab2f5d.netlify.app (password `My-Drop-Site`)
**Claim (60 min):** https://app.netlify.com/drop/shiny-starship-ab2f5d

---

## 1. Naye engines (2 modules)

### `finance/financeEngine.js`
Sab kuch order book se derive hota hai — koi alag ledger nahi, to har number wapas
asli orders tak trace ho sakta hai.

- `profitAndLoss()` — poora waterfall: GST pass-through deduct, RTO/returns ka lost revenue, COGS, payment fees, shipping, **reverse logistics** (dono legs), packaging, marketing. RTO pe stock wapas aata hai wo bhi credit hota hai.
- `monthlyPnL()` — 12-month trend series
- `gstSummary()` — **GSTR-1 shape**: rate-wise slabs + HSN, place-of-supply (intra→CGST+SGST, inter→IGST), B2B/B2C split
- `filingCalendar()` — GSTR-1 (11th), GSTR-3B (20th), GSTR-8 with overdue/due-soon status
- `settlements()` + `payoutSchedule()` — gateway hold periods; **prepaid T+2, COD T+7 after delivery**
- `unitEconomics()` — contribution margin by channel / payment / category
- `discountAnalysis()` — coupon-wise ROI (margin returned per rupee discounted)

### `marketing/campaignEngine.js`
- **Rule-based live audiences** — 16 fields, type-aware operators. Ye lists nahi hain, rules hain: aaj 400 customers resolve karein to agle hafte alag 400 honge.
- `estimateCampaign()` — bhejne se *pehle* forecast: reach → opens → clicks → conversions → revenue → margin − send cost = net return
- `compareChannels()` — same audience, same offer, chaaron channels ka comparison
- `attribution()` — last-touch / first-touch / linear
- `cartRecovery()` — 3-stage recovery sizing

## 2. Admin modules (6)

**Loyalty** (6 tabs) — Overview (tier distribution + **liability**), Earning rules (rate, bonuses, category multipliers), Tiers (threshold/multiplier/colour/perks), Redemption (caps, point value, blackout categories), Members (live balances + manual grant), **Simulator** (scenario → earn/redeem breakdown)

**Promotions** (4 tabs) — list with conflict warnings, full rule editor (8 discount types, 26-field conditions, stacking/exclusive/margin-guard), **evaluation-order view**, **cart simulator** jo dikhata hai kaun laga aur kaun *kyun nahi* laga, coupon ROI performance

**Growth** (4 tabs) — Campaigns (forecast card per campaign, send blocked agar loss-making ho), Audiences (rule builder + live preview), Automations (4 flows with step chains), Attribution (3 models + cart recovery + channel benchmarks)

**Analytics** (4 tabs) — Overview (daily revenue, status mix, repeat rate), Products (revenue/profit/return-rate/stock + top-10 concentration warning), Geography (state RTO rates, top cities), Retention (cohort heatmap)

**Finance** (4 tabs) — P&L waterfall with tunable assumptions + 12-month chart + cost structure, GST (filing calendar, rate slabs, place of supply), Settlements (**cash-flow gap**), Unit economics

**Settings** (6 tabs) — Store identity + GSTIN validation, Checkout, **Payments** (Razorpay + Stripe, method toggles), Features (14 flags), SEO with live preview, Backend

## 3. Bugs jo testing me mile

Char asli bugs — ek to poora screen blank kar deta tha:

1. **`Select` primitive object options pe crash karta tha.** Settings me `STATES.map(x => x.name ?? x)` likha tha, par seed records me key `state` hai, `name` nahi — to poora object `<option>` child ban gaya aur React ne throw kar diya. **Settings screen bilkul blank** (0 bytes render). Do jagah fix kiya: call sites sahi kiye, *aur* `Select` ko defensive banaya taki strings, `{value,label}`, ya arbitrary records — teeno chalein. Ab 4 shapes ka test coverage hai.

2. **GST summary me HSN codes hamesha khaali aa rahe the.** Seed order lines `gst` rate to rakhte hain par `hsn` nahi, aur engine sirf `it.hsn` padh raha tha. **HSN ke bina GSTR-1 reject ho jaata hai** — matlab ye screen filing ke liye bekaar thi. Ab catalogue se resolve hota hai (productId → category fallback). Test verify karta hai ki har slab me HSN ho *aur* wo asli catalogue code ho.

3. **Campaign conversion rates 3-4× zyada optimistic the** (WhatsApp 4.5%). Ye screen ka poora maqsad hi ye hai ki loss-making sends rok de — over-optimistic model ulta unhe green-light karta. Realistic broadcast rates pe laaya (WhatsApp 1.4%, email 0.4%) aur ek test add kiya jo enforce karta hai ki koi bhi channel 2% se upar na jaye.

4. **COD ke baare me meri assumption galat thi.** Maine test likha tha ki COD ka gateway fee zyada hoga — engine me 2.0% COD vs 2.1% prepaid tha. Engine sahi tha: COD ka asli kharcha fee nahi, **remittance delay** hai. Test badal diya taki wo asli cost measure kare — 21-day COD cycle kitna cash strand karta hai.

## 4. Testing

| Suite | Assertions |
|---|---|
| `tests/render.mjs` | 74 |
| `tests/part2.mjs` | 146 |
| `tests/part3.mjs` | 168 |
| **`tests/part4.mjs`** | **163** |
| **Total** | **551 · 0 failed** |

Part 4 ke tests specifically **reconciliation** check karte hain — P&L waterfall apne total se match kare, GST me CGST=SGST ho, settlements me settled+pending=net, attribution models same total revenue baantein. Ye wo cheezein hain jo chup-chaap galat ho jaati hain aur koi crash nahi karta.

## 5. Aage (Part 5)

Storefront — user panel ko in sab engines se wire karna (loyalty widget, promo application, checkout with both gateways), code-splitting, aur final deploy.
