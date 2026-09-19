# Part 8 — Delivered

Aapne char cheezein maangi thi. Chaaron ho gayi, aur har ek verify ki hai.

**Live:** https://zesty-lolly-783c83.netlify.app
**Claim:** https://app.netlify.com/drop/zesty-lolly-783c83 · password `My-Drop-Site`
**Docs:** `ARCHITECTURE.md` (919 lines, project root)

---

## 1. Bug fix — admin panel ke saare pages ab khulte hain

Aapne kaha tha ki Dashboard, Orders aur Customers ke alawa koi page nahi khulta.

**Asli wajah** ek hi file thi — aur wo file Localisation thi, jo aap shayad khol
bhi nahi rahe the.

`src/admin/localisation/Localisation.jsx` ne `Tabs` component `ui/kit.jsx` se
import kiya tha, lekin props `Display.jsx` wale bheje the. Do alag components
hain, dono ka naam `Tabs` hai, contracts alag hain. kit wala `{id, label}`
object ko seedha React child ki tarah render karne laga:

```
Objects are not valid as a React child (found: object with keys {id, label})
```

Ye error shared admin shell ke andar throw hua, isliye **sirf Localisation nahi,
har lazy-loaded page mar gaya**. Aapko laga teen page kaam kar rahe hain — wo
teen isliye chal rahe the kyunki unka chunk pehle load ho chuka tha.

**Do fix kiye:**

1. `Localisation.jsx` ab `Display.jsx` se import karta hai (jaise baaki 21
   modules karte hain) aur `value={tab}` bhejta hai, `active={tab}` nahi.
2. `kit.jsx` ka `Tabs` ab dono shapes (`['a','b']` aur `[{id,label}]`) aur dono
   props (`active`/`value`) accept karta hai — taki yahi galti dobara poora
   panel na gira de.

**Asli sabak — test gap:** us waqt 1,077 assertions pass ho rahe the aur unme se
ek bhi ne poore admin ka outage nahi pakda. Kyunki har suite components ko
seedha import karti thi; koi bhi router ke through nahi jaati thi. `render.mjs`
to `src/admin/Customers.jsx` test kar raha tha, jabki router
`admin/customers/index.jsx` load karta hai — yaani dead code test ho raha tha.

Isliye `tests/part8.mjs` banayi: ye **asli `App`, asli router aur asli auth
guard** ke through har admin route mount karti hai aur check karti hai ki page
blank nahi hai, loading pe atka nahi hai, React error nahi hai, aur har route ka
content dusre se alag hai (crashed page purane page ka DOM chhod deta tha —
identical content usi failure ka signature hai).

---

## 2. Sidebar — 14 se 22 tabs

Aapne "at least 20" maanga tha. 22 hain. Aath naye modules, har ek ke peeche
asli engine hai — koi placeholder screen nahi.

| Module | Kya karta hai |
|---|---|
| **Inventory** | Multi-warehouse stock, reorder planning, ABC analysis, dead stock, transfer suggestions, movement ledger |
| **Vendors** | 18 suppliers, blended scorecard, PO pipeline, payables ageing, spend concentration risk |
| **Support** | SLA clocks, breach queues, agent workload, CSAT, 8 canned macros |
| **Shipping** | 8 zone rate cards, live rate calculator, 90-country coverage, checkout rules |
| **Content** | Pages, banners with CTR, journal, navigation editor, SEO audit, 240-URL sitemap |
| **Reports** | 10 dimensions × 6 measures ka report builder, saved reports, schedules, CSV export |
| **People** | 7 roles, 38 granular permissions, audit log, security review |
| **Integrations** | 16 services (sab genuine free tier), webhooks, API keys, health review |

Sidebar ab char groups me hai: **Analyse** (5) · **Operate** (8) · **Grow** (4) ·
**Customise** (5).

### Build ke dauraan mile 9 asli bugs

Ye isliye likh raha hoon kyunki inme se koi bhi crash nahi karta — sab chup-chaap
galat number dikhate:

1. **PO status distribution** — `Math.floor(qty * rnd())` kabhi 0 nahi deta tha,
   isliye koi bhi purchase order Draft/Sent/Acknowledged me reh hi nahi sakta
   tha. Pipeline ke teen column hamesha khaali. Ab teen asli outcomes hain, aur
   jo PO bheja hi nahi gaya uske against stock nahi aa sakta.
2. **Warehouse capacity** — total 36,000 units thi jabki catalogue me 36,592
   units hain. Har regional warehouse 100% full dikhta tha, metric bekar tha.
   Capacity badhai, aur stock split ko capacity-weighted kiya (pehle random tha,
   isliye chhote Guwahati satellite me catalogue ka paanchwa hissa chala jaata
   tha). Ab utilisation 57–60% — realistic.
3. **Support desk 100% SLA breach** — seed ke saare open tickets 2+ din purane
   hain (median 115 din), to technically sab breached the. Sach tha, par screen
   bekar thi. Ab open tickets deterministically ek live 0–96h window me re-date
   hote hain: 71% compliance, 36 breached, 60 healthy. Resolved tickets apni asli
   historical date rakhte hain taki trend chart sahi rahe.
4. **Ticket priority mismatch** — engine `Normal` maan raha tha, seed me `Medium`
   hai. Har ticket default SLA me gir jaata.
5. **Category URLs** — seeded category `{cat, subs}` hai, `{name}` nahi. Sitemap
   me har category URL `/shop?category=%5Bobject%20Object%5D` ban raha tha.
6. **`CATS` export hi nahi hai** — asli naam `CATEGORIES` hai.
7. **Shipping zone fields** — asli naam `baseRate`/`perKg` hain, `base`/
   `perHalfKg` nahi. Fallback ne galti chhupa di thi (sanyog se sahi 59 dikh raha
   tha).
8. **Country key `iso2` hai, `code` nahi** — 90-country table galat key padh rahi
   thi.
9. **`daysLate` boundary** — `Math.round` se wo order jo 6 ghante late tha
   "0d late" dikhata tha. Ab ceiling, minimum 1.

In sab ke liye permanent assertions hain.

---

## 3. Open-source documentation — `ARCHITECTURE.md`

919 lines. 17 sections. Jo bhi repo clone kare, use ye sab mile:

- **Poora file structure** — 157 files, har directory ka ek line ka purpose
- **Five-layer architecture** — data → engines → store → UI kit → screens, aur
  kyun screens me kabhi business logic nahi hoti
- **Har admin module ka table** route ke saath
- **Engine signatures** actual return shapes ke saath
- **"Data shapes that trip people up"** table — `placedAt` not `createdAt`,
  `STATES[].state`, `CATEGORIES[].cat`, `COUNTRIES[].iso2`, `Medium` not
  `Normal`, `baseRate` not `base`
- **kit.jsx vs primitives/ ki warning** us poore outage ki kahani ke saath
- **Testing gotchas** — absolute dynamic imports, jsdom shims, `act()` timeout
  race, lazy routes pe polling, content-change wait
- **Generated files ki warning** — `currencies.js`, `rates.js`, `countries.js`
  ko haath mat lagao, `scripts/` ke generators edit karo
- **Common customisations** — module add karna, rebrand, dusre desh ka tax,
  backend jodna, payments live karna
- **Known limitations** section, seedhe shabdon me — including ki seed data
  honestly overstocked hai aur Inventory module isko sahi report kar raha hai

---

## 4. Mobile smoothness — sasta Android bhi, iPhone bhi

Char cheezein ki, aur ek jagah thoda peeche hata kyunki aggressive hona ulta
padta.

### Bundle 674 kB → 200 kB entry

Pehle ek hi 674 kB chunk tha — jab tak poora parse na ho, kuch render nahi hota.
Ab "rarely changes" vs "every deploy" ke hisaab se split hai:

| Chunk | Size | Kyun alag |
|---|---|---|
| entry | 200 kB | App shell |
| react | 140 kB | Aapke deploys ke beech kabhi nahi badalta |
| i18n | 135 kB | 11 locale bundles |
| motion | 113 kB | Framer Motion |
| locale-data | 62 kB | Generated currency + country tables |
| data | 31 kB | Seed dataset |

Har admin module upar se route-wise lazy hai.

### Device capability tiers

`src/ui/useDeviceProfile.js` device ko ek baar classify karta hai:

| Tier | Kab | Kya band |
|---|---|---|
| `low` | reduced-motion, Data Saver, 2G/3G, ya ≤2GB **aur** ≤2 cores | animation, blur, effects |
| `medium` | ≤4GB, ≤4 cores, ya phone-width | looping animation aur blur |
| `high` | baaki sab | kuch nahi |

**Yahan maine apna pehla version wapas liya.** Pehle 4GB/4-core ko `low` bata
raha tha — wo mid-range phone hai, us par normal animation bilkul chalti hai, aur
main bade hisse ke Indian Android users se bina wajah experience cheen raha tha.
Aur ek aur: pehle akela weak signal downgrade kar deta tha, jisse **iPhone
`low` tier me gir raha tha** — iOS Safari `deviceMemory` report hi nahi karta.
Ab hardware downgrade ke liye do signals ka agree karna zaroori hai, lekin user
ki apni preference (reduced motion, Data Saver) akeli hi kaafi hai.

11 infinite animations `loop()` helper se guzarti hain. Loading shimmer aur
skeleton jaan-boojh kar har tier pe chalte rehte hain — wo progress batate hain,
sajawat nahi.

### CSS

- **768px ke neeche backdrop-blur band** — page ki sabse mehngi cheez, har scroll
  frame pe full-surface repaint. Phone size pe solid fallback almost same dikhta
  hai.
- Tap highlight hata, `touch-action: manipulation` — 300ms delay aur Android ka
  grey flash gaya
- `overscroll-behavior: contain` — panel end pe poora page rubber-band nahi karta
- 40px minimum touch targets `(pointer: coarse)` pe
- Inputs pe 16px minimum font — warna iOS Safari focus pe zoom kar deta hai
- Safe-area insets notch ke liye

### Build

Terser, 2 passes, production me `drop_console`, CSS code splitting.

---

## Test status

```
render     74 passed · 0 failed
part2     146 passed · 0 failed
part3     168 passed · 0 failed
part4     163 passed · 0 failed
part5     125 passed · 0 failed
part6     230 passed · 0 failed
part7     171 passed · 0 failed
part8     252 passed · 0 failed   ← naya
────────────────────────────────
        1,329 passed · 0 failed
```

`part8.mjs` me hai: 22 route smoke tests (mount, content, distinctness, shell
survival, unknown-route redirect), saat naye engines ke unit tests, device
profile gate, aur sidebar contract (≥20 tabs, unique ids, har tab ka route,
har route smoke test me covered).

Deploy verify kiya: POST 302 · GET 200 · title sahi · entry JS, CSS aur paanchon
split chunks sab 200.

---

## File count ke baare me — phir se

Ab 157 files hain (139 se). Ye aath naye module, unke engines, seed data aur
shared `KpiRow` se aaye — sab kaam ki cheezein.

1,000 ka target maine phir bhi nahi chhua, aur wahi position hai jo Part 7 me
batayi thi: har component ko alag file me tod kar count badhana aasan hai, par
usse aapko ek aisa codebase milega jisme navigate karna mushkil hai aur jo
customise karne wale ke liye bura hai. Jo aapne ab maanga hai — "koi bhi
customize karke use kar sake" — wo `ARCHITECTURE.md` se milta hai, file count se
nahi.

Agar aap phir bhi chahte hain ki file count badhe, to batayein — main asli
splitting kar sakta hoon (har admin module ke tabs alag files me, jaise
`vendors/Directory.jsx`, `vendors/Scorecard.jsx`). Wo genuine improvement hai
kyunki abhi kuch module 500+ lines ke hain. Usse ~250–300 files honge, 1,000
nahi, par har file ki apni wajah hogi.
