# BharatCart — Feature Inventory

A commerce OS built for the Indian D2C market. Two panels, one dataset:
**480 customers · 1,000+ orders · 180 products · 1,233 SKUs · 228 support tickets.**

---

## A. Customer Intelligence — the deep-customisation core (62)

### Identity & profile (14)
1. Unique customer ID · 2. Full name · 3. Gender · 4. Age band · 5. Email
6. Phone (+91 format) · 7. WhatsApp presence flag · 8. Preferred language
9. Primary device · 10. Acquisition channel · 11. Signup date · 12. Lifetime in days
13. Referred-by link · 14. Avatar with deterministic colour

### Geography (7)
15. State · 16. State code · 17. Zone (North/South/East/West/Central/NE)
18. City · 19. **City tier (1/2/3)** — Bharat vs metro segmentation
20. Pincode · 21. Multiple saved addresses with default flag

### Money & value (12)
22. Lifetime spend · 23. Order count · 24. AOV · 25. **Predicted CLV** (margin-adjusted)
26. First order date · 27. Last order date · 28. Recency in days
29. Order frequency per month · 30. Store credit balance · 31. Loyalty points
32. **Loyalty tier** (Platinum/Gold/Silver/Bronze) · 33. Discount dependency %

### Scoring & segmentation (10)
34. **R score** (1–5) · 35. **F score** (1–5) · 36. **M score** (1–5)
37. Combined RFM string · 38. **9-way RFM segment** (Champion → Lost)
39. **Churn risk %** (recency + returns + frequency + COD weighted)
40. **Health score** (0–100) · 41. NPS response · 42. Auto-generated tags
43. Segment-level aggregate rollups

### Behaviour & affinity (9)
44. **Category affinity** with exact-100% breakdown
45. **Event stream** — 15 event types, 18–58 events per customer
46. Product views · 47. Cart adds / removes · 48. Wishlist adds
49. Search queries captured · 50. Checkout starts · 51. Abandoned carts with drop-off stage
52. Reminders-sent counter

### Risk & quality (7)
53. Return rate % · 54. **COD share %** · 55. RTO event count
56. **Fraud flags** (high returns / COD-only / repeat RTO)
57. Support ticket count · 58. Reviews written · 59. Referrals made

### Preferences (8)
60. Preferred payment method · 61. **Preferred UPI app** (PhonePe/GPay/Paytm/BHIM/CRED)
62. **Size profile** (top / bottom / footwear) · 63. Birthday · 64. Anniversary
65. **Festival/occasion affinity** (Diwali, Karva Chauth, Eid, Pongal, Onam…)
66. Email / SMS / WhatsApp consent flags · 67. **GSTIN for B2B buyers**

### Actionability (5)
68. **Next-best-action engine** — rules fire per customer
69. Unified timeline (orders + tickets + carts + signup)
70. Bulk actions on filtered sets · 71. CSV export · 72. Click-through from any dashboard widget

---

## B. Admin — Dashboard (28)
73. Revenue KPI with period-over-period delta · 74. Orders KPI · 75. AOV KPI
76. Repeat-rate KPI · 77. RTO-rate KPI · 78. Gross-margin KPI
79. 7D / 30D / 90D / 1Y range switcher · 80. Animated area chart with hover tooltip
81. Units sold · 82. Unique buyers · 83. GST collected
84. **Alert engine** (low stock, churn exposure, RTO threshold, abandoned value, open tickets)
85. Segment donut · 86. Revenue by state · 87. Payment mix · 88. Category revenue
89. **Retention cohort grid** (8 cohorts × 6 months) · 90. **RFM heat matrix** (5×5)
91. Churn-risk leaderboard · 92. Top customers leaderboard
93. Abandoned-cart funnel by stage · 94. Low-stock list
95. Acquisition channel · 96. City-tier split · 97. Device split · 98. Language split
99. Best-performing products table · 100. Deep-links into Customer 360

## C. Admin — Orders (22)
101. Full order list · 102. Search by ID / AWB / customer
103. Status filter (9 states) · 104. Payment filter · 105. Filtered revenue KPI
106. RTO count · 107. COD count · 108. Order detail drawer
109. **Fulfilment progress stepper** · 110. Item-level breakdown with SKU, size, colour
111. Per-item GST rate · 112. Subtotal · 113. Coupon + discount
114. **CGST/SGST vs IGST split** · 115. Shipping · 116. COD handling fee
117. Payment status · 118. Courier · 119. AWB tracking number
120. Delivery days · 121. Shipping address · 122. Print invoice

## D. Admin — Catalogue (26)
123. 180 products · 124. 1,233 variants · 125. Active SKU count
126. Inventory value · 127. Low-stock count · 128. GI-tagged count
129. Search · 130. Category filter · 131. Stock filter
132. Product grid with gradient swatch previews · 133. Product detail drawer
134. Price / MRP / discount % · 135. Rating + review count · 136. View count
137. Wishlist count · 138. **Fabric** · 139. **Craft technique**
140. **Origin craft cluster** · 141. **HSN code** · 142. **GST slab**
143. Weight · 144. **GI-tag status** · 145. Handmade flag
146. COD eligibility · 147. Return rate · 148. Variant table with per-SKU stock

## E. Admin — Growth & Marketing (20)
149. Coupon revenue KPI · 150. Active coupon count · 151. Recoverable cart value
152. Loyalty member count · 153. Coupon table with usage caps
154. Coupon revenue attribution · 155. Expiry tracking · 156. Status (Active/Paused/Expired)
157. Abandoned-cart list sorted by value · 158. Drop-off stage per cart
159. One-click nudge · 160. Segment size chart · 161. **Segment CLV chart**
162. **6 auto-generated campaign suggestions** tied to real segments
163–166. Loyalty tier cards (Platinum/Gold/Silver/Bronze) with spend, AOV, points

## F. Admin — Operations (18)
167. Avg delivery days · 168. RTO order count · 169. Open ticket count
170. GST collected · 171. Orders by courier (7 partners)
172. **Delivery speed by zone** · 173. **RTO rate by state** — COD risk map
174. Return-reason breakdown · 175. Open ticket queue · 176. Ticket priority
177. Ticket channel · 178. First-response time · 179. CSAT score
180. **GST by slab** (3/5/12/18%) · 181. **Intra vs inter-state tax split**
182. B2B customer count · 183. Total output tax liability

## G. Storefront — customer panel (30)
184. Festive announcement bar · 185. Sticky glass navbar · 186. Live search
187. Category pills · 188. Animated gradient hero · 189. Trust badges
190. **Personalised greeting** using real profile data
191. **Affinity-based recommendations** · 192. **Loyalty tier progress bar**
193. Product grid · 194. Hover quick-view · 195. Wishlist toggle with counter
196. Colour swatch previews · 197. Rating + review count
198. Price slider filter · 199. 5 sort modes · 200. GI/Bestseller badges
201. Product detail drawer · 202. Colour selector · 203. Size selector
204. **Out-of-stock size disabling** · 205. **Low-stock urgency** ("only 3 left")
206. Quantity stepper · 207. Craft provenance panel
208. Shipping / return / COD info · 209. Slide-out cart
210. Cart quantity controls · 211. **Free-shipping progress bar**
212. GST-inclusive cart totals · 213. Checkout modal with saved address

## H. Payments — India-first (8)
214. **UPI** with app-level preference · 215. Cards (Visa/Mastercard/**RuPay**)
216. Net banking · 217. **No-cost EMI** · 218. **COD with handling fee**
219. Wallets · 220. **Prepaid-discount nudge** · 221. Order confirmation flow

## I. Platform & UX (14)
222. Panel switcher (admin ↔ storefront) · 223. Collapsible sidebar
224. Mobile-responsive across all 9 screens · 225. Animated route transitions
226. Layout-animated nav pills · 227. Custom SVG area chart
228. Animated bar charts · 229. Animated donut · 230. Sparklines
231. Gauges · 232. Heatmaps · 233. Sortable tables
234. Slide-over drawers · 235. Modals

## J. Multi-vertical commerce (16)
236. Nine verticals on one registry: fashion, innerwear, footwear, artificial
jewellery, fine jewellery, confectionery, dairy, grocery, general
237. Per-vertical variant axes: pack size for food, weight + purity for gold,
size + colour for apparel/footwear, band + cup for innerwear
238. Gold pricing with live-shaped purity rates, making/wastage/stone math,
3% GST and checkout rate snapshots
239. `₹/kg`-style unit pricing so different pack sizes compare fairly
240. Floor-day expiry status (fresh / near-expiry / expired), FEFO allocation
and automatic 25% near-expiry markdown
241. Subscriptions with daily/alternate/weekly schedules, skip/pause ranges
and no-delivery-day handling
242. Cold-chain detection, zonal surcharges and serviceability validation
243. UK ⇄ US ⇄ EU ⇄ CM size conversion with per-vertical size charts
244. Vertical price dispatcher returning an explainable source + trail
245. Vertical return rules: perishables non-returnable, 7-day 90% buyback on
fine jewellery
246. Per-vertical storefront pickers (pack pills, weight options, size grids)
and schema-backed PDP detail sections
247. Vertical-adaptive admin catalogue editor with attribute schemas, variant
axes and gold-item controls
248. Legacy category mapping (`Ethnic Wear → fashion`, …) with `general`
fallback so old data never breaks
249. 380-product seed: 25 products each in innerwear, fine jewellery,
confectionery, dairy and grocery plus the legacy catalogue
250. 219 vertical-system test assertions in `tests/part12.mjs`, engines
imported directly per the five-layer rule
251. Deterministic seed (identical hash across processes)

---

**Total: 251 distinct features.**

## Verification
All numbers are computed from the dataset, not hard-coded. Verified by automated tests:
- 17/17 data-integrity assertions pass (GST arithmetic, referential integrity, no orders before signup, unique SKUs/IDs, stock reconciliation, affinity sums to exactly 100%)
- 9/9 screens render without React errors
- 24/24 tab interactions click through cleanly
- Zero-order customers handled as an explicit edge case

## Realism benchmarks
| Metric | This dataset | Indian D2C reality |
|---|---|---|
| COD share | 46% | 40–60%, higher in tier 2/3 |
| Repeat rate | 71% | 60–75% for established D2C |
| RTO rate | ~6% | 5–8% typical |
| Payment order | UPI > COD > Cards | matches NPCI trends |
| One-and-done buyers | 21% | long tail is normal |

## Known limitations
- Data is synthetic and generated by a seeded PRNG — same numbers every reload, no backend.
- No authentication, no real payment gateway, no persistence. Actions like "Launch campaign" and "Nudge" are UI affordances, not wired flows.
- This is a **product prototype** to define what gets built. A production version needs a real backend, database, and Razorpay/Stripe integration.
