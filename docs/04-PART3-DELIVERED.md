# Part 3 — Orders · Returns · Customers 360 · Operations

**Status:** ✅ Delivered · 388 assertions passing · build green · deployed

**Live:** https://golden-granita-34f0ce.netlify.app (password `My-Drop-Site`)
**Claim (60 min):** https://app.netlify.com/drop/golden-granita-34f0ce

---

## 1. Naye engines (3 modules)

### `orders/orderEngine.js` — order lifecycle
Status ek free-text field nahi hai — ek **explicit transition graph** hai. Har move
batata hai kaun kar sakta hai (role), kya chahiye (AWB), aur paisa/stock pe kya asar hoga.

- `TRANSITIONS` — 10 states, har edge pe `role` · `requires` · `money` (capture/refund/void) · `stock` (reserve/release/consume/restock)
- `canTransition()` — kabhi throw nahi karta, hamesha **padhne-layak reason** deta hai ("Needs manager permission", "Missing required field: awb", "Order was never paid — cancel instead of refunding")
- `applyTransition()` / `bulkTransition()` — bulk me partial success normal hai, har fail apna reason leke aata hai
- `orderMargin()` — asli per-order P&L: COGS, payment fee, shipping, packaging, **reverse logistics** (RTO/return pe dono legs)
- `slaBreaches()` — payment/pack/ship/deliver, urgency ke hisaab se sorted
- `riskScore()` — COD + pichhle RTO + first-time buyer + tier-3 + adhura address → 0-100 score + concrete action

### `returns/returnEngine.js` — RMA
- 9 reason codes, har ek pe `fault` (customer/seller/courier), `restockable`, apna `windowDays`, `requiresPhoto`
- `checkEligibility()` — per-item window check, hygiene categories block, already-returned guard
- `calculateRefund()` — order-level discount aur GST **proportionally** unwind karta hai; poora order wapas aaye to shipping bhi refund; **fault seller ka ho to pickup free**; QC fail/partial pe penalty; store credit pe bonus
- `restockDecision()` — QC outcome + reason se decide karta hai stock main/outlet/scrap kahan jaye
- `returnAnalytics()` + `problemProducts()` — kaunsa SKU kis wajah se wapas aa raha hai, aur uska concrete fix

### `orders/customerEngine.js` — customer intelligence
- `rfmScores()` — pure base ke against **quintile-scored** R/F/M (relative, absolute nahi), 11 named segments
- `predictCLV()` — transparent margin × frequency × survival model; churn probability customer ki **apni cadence** ke against nikalta hai (400 din chup ek monthly buyer ke liye zyada risky hai bajaye ek yearly buyer ke)
- `cohortRetention()` — monthly acquisition cohorts, retention % + revenue per user
- `nextBestAction()` / `priorityCustomers()` — ek concrete ranked recommendation per customer

## 2. Naya data

`src/data/returnsSeed.js` — seed orders se derive kiya gaya deterministic RMA dataset.
Size/fit sabse bada reason (34%), jo Indian apparel me realistic hai. Har RMA order,
customer, line items, reason, QC outcome aur refund se linked hai.

## 3. Admin modules

**Orders** — 6 KPIs · order/customer/phone/AWB/pincode search · status pills · SLA-breach aur risk filters · per-row **asli profit** · bulk actions jo sirf **sabhi selected orders pe legal** transitions dikhate hain
→ **Order detail:** summary + risk banner, items with live return eligibility, reconstructed timeline, GST invoice (intra vs inter-state), internal notes + tags, transition modal jo AWB maangta hai aur bolta hai kitna paisa capture/refund hoga

**Returns** — 3 tabs
- *RMA queue:* stage pills, age tracking, fault attribution, bulk stage moves
- *Detail:* stage track, per-line reason + customer comment + photos, **full refund breakdown**, QC modal (pass/partial/fail with restock decision), refund modal
- *Analytics:* return reasons by fault, by category, **"products to fix"** with suggested action, preventable losses
- *Policy:* window, pickup fee, store credit bonus, QC penalty, automation toggles, reason-code table

**Customers** — 5 tabs
- *List:* RFM string, segment, predicted CLV per row
- *Segments:* 11 segment cards with % of value and recommended play
- *Churn risk:* value-at-risk sorted, churn % vs their usual gap
- *Cohorts:* 12-month retention heatmap with revenue per user
- *Action list:* ranked next-best-action across the base
- *Customer 360 drawer:* RFM breakdown, churn outlook, loyalty tier progress, orders with per-order profit, returns, activity feed, support tickets

**Operations** — 5 tabs
- *Today:* 6 fulfilment lanes, work queue (oldest first), risky dispatches
- *Pick & pack:* **consolidated pick list** — SKU-wise aggregated across orders, category-grouped so picker ek hi baar racks walk kare
- *SLA breaches:* live-tunable thresholds
- *Couriers:* scorecard **order book se derive** kiya gaya (delivery rate, RTO rate, avg days) + rate cards
- *Serviceability:* pincode checker, zone table

## 4. Bug jo testing me mila

**`DELIVERED` ko maine `TERMINAL` array me daal diya tha — jabki uska transition graph me `→ Returned` edge hai.** Result: har delivered order permanently locked ho jata, koi return kabhi process hi nahi hota. Ye poore returns feature ko silently tod deta aur sirf tab pata chalta jab koi asli return aata.

Fix sirf array se `DELIVERED` hataana nahi tha — maine **terminality ko graph se derive** kar diya (`TRANSITIONS[status].length === 0`), taki hand-maintained list aur asli graph kabhi drift na kar sakein. Test bhi add kiya jo ye invariant enforce karta hai.

## 5. Testing

| Suite | Assertions |
|---|---|
| `tests/render.mjs` | 74 |
| `tests/part2.mjs` | 146 |
| **`tests/part3.mjs`** | **168** |
| **Total** | **388 · 0 failed** |

Part 3 ke tests sirf "chalta hai" check nahi karte — **business rules** verify karte hain:
illegal transitions block hone chahiye *with a reason*, unpaid order refund na ho,
AWB ke bina ship na ho, proportional discount unwinding sahi ho, seller fault pe pickup
free ho, QC fail pe refund zero ho, silence se churn risk badhe, aur bulk ops partial
success handle karein.

```bash
cd /home/user/bharatcart && npm install --no-audit --no-fund
npx vite-node tests/render.mjs && npx vite-node tests/part2.mjs && npx vite-node tests/part3.mjs
npx vite build
```

## 6. Aage (Part 4)

Loyalty · Promotions · Marketing · Analytics · Finance · Settings — Part 2 ke
`loyaltyEngine`/`promoEngine` ko admin-configurable UI dena, aur Part 3 ke order/return
data ke upar financial reporting.
