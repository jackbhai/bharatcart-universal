# Part 7 — Har desh ki currency + geo layer

**Live:** https://amazing-tapioca-0ac877.netlify.app
**Password:** `My-Drop-Site`
**Claim (60 min):** https://app.netlify.com/drop/amazing-tapioca-0ac877

**Tests:** 1077 passing · 0 failing
`render 74 · part2 146 · part3 168 · part4 163 · part5 125 · part6 230 · part7 171`
**Build:** ✓ 4.88s · 139 src files

---

## 1. Currencies: 56 → **157**

Ab sirf naam ki list nahi — poori ISO 4217, har circulating national currency.
**209 countries** mapped hain.

Aapne jo naam liye, sab hain:

| Desh | Currency | Format |
|------|----------|--------|
| Pakistan | PKR | ₨8,337.99 |
| Nepal | NPR | रू3,998.99 |
| **Myanmar** | **MMK** | K62,900 |
| Indonesia | IDR | Rp486.000,00 |
| Bhutan | BTN | Nu.2,498.99 |
| Sri Lanka | LKR | Rs8,873.99 |
| Bangladesh | BDT | ৳3,586.99 |
| Maldives | MVR | ރ.461.99 |
| Afghanistan | AFN | ؋2,062.99 |

Myanmar (MMK) pehle missing tha — ab hai.

10 regions: South Asia · Southeast Asia · East Asia · Central Asia · Middle East · Europe · Americas · Oceania · Africa · Metals (XAU/XAG/XDR).

### Har currency ka asli data
`code · numeric (ISO) · symbol · name · decimals · locale · flag · region · countries[]`

**Minor units sach me sahi hain** — yahi woh jagah hai jahan zyadatar implementations girti hain:
- **16 zero-decimal:** JPY, KRW, VND, ISK, CLP, PYG, XPF, VUV, UGX, KMF, DJF, RWF, BIF, XAF, XOF, GNF
- **7 three-decimal:** KWD, BHD, OMR, JOD, IQD, TND, LYD
- Baaki 2

XOF/XAF (CFA francs, 14 African countries) zero-decimal hain — inko 2 dene se galat prices banti.

### Country se search
Shopper "MMK" nahi sochta, "Myanmar" sochta hai. Picker me country search hai:
`myanmar → MMK` · `nepal → NPR` · `indonesia → IDR` · `pakistan → PKR`

Har row me currency ke neeche uske countries dikhte hain.

---

## 2. Naya geo layer — 90 countries ka asli data

Currency switcher akela adhoora tha. Jakarta se koi checkout kare to store ko ye bhi pata hona chahiye ki wahan **tax kya hai, payment kaise hota hai, address kaise likha jata hai**.

### Local tax — India ka GST sabko dikhana galat invoice hai
| Desh | Tax | Rate |
|------|-----|------|
| India | GST | 18% |
| Germany | MwSt | 19% |
| Hungary | ÁFA | 27% |
| Singapore | GST | 9% |
| Indonesia | PPN | 11% |
| Qatar/Kuwait | — | 0% |

**23 alag tax names** — VAT, TVA, IVA, MwSt, KDV, ПДВ, PPN, SST, IGV, ICMS...

### Local payment rails — ye intensely local hote hain
- India → **UPI**, netbanking, EMI, COD
- Brazil → **PIX**, boleto
- Netherlands → **iDEAL**
- Kenya/Tanzania → **M-Pesa**
- Poland → **BLIK**
- Indonesia → **QRIS**
- Philippines → **GCash**
- Sweden → **Swish** · Denmark → MobilePay · Norway → Vipps
- Mexico → **OXXO**, SPEI
- Saudi → **Mada** · Kuwait → **KNET**

Brazil me PIX na dena = sale gayi. UPI Germany me dena = bewakoofi. Test isko verify karta hai: `!methodsFor('US').includes('upi')`.

**COD** har jagah nahi hai — South Asia me common, Germany me nahi.

### Address formats
Japan postal code **pehle** likhta hai, Britain **aakhir me**. Indian form Japanese buyer ko dikhana tuta hua lagta hai.

- `JP: name > postal > state > city > line1`
- `GB: name > line1 > line2 > city > postal`
- `SG: name > line1 > line2 > postal` (koi city line nahi)

Subdivision ka naam bhi local hai: Canada **Province**, Japan **Prefecture**, UK **County**, Switzerland **Canton**, UAE **Emirate**, Egypt **Governorate**.

Postal validation har desh ke apne regex se — UK postcode ko `^\d{6}$` se check karna har asli address reject kar deta.

### International shipping — 8 zones
Domestic ₹59 se lekar Oceania ₹2,600 + ₹1,080/kg tak. Pehla aadha kilo base rate me shamil (asli carriers aise hi charge karte hain), uske baad per-kg.

**Duty estimate** bhi hai — de-minimis threshold se upar customer ko warning milti hai ki carrier arrival pe tax lega. Chupana hi woh cheez hai jisse customer ko darwaze pe surprise bill milta hai.

---

## 3. Part 7 me pakde gaye bugs

1. **`INR: 0.999971` — base currency exactly 1 nahi thi.** Generator har USD rate ko rounded `0.01198` se multiply kar raha tha; INR ke liye `83.47 × 0.01198 = 0.999971`. 3e-5 ka drift har INR total ko halka sa kharab karta. Ab `1 / 83.47` se divide hota hai, INR construction se hi exactly 1.

2. **Bhutan → INR resolve ho raha tha.** INR apni countries me Bhutan list karta hai aur pehle aata hai. Ab jo currency **kam countries** cover karti hai woh jeetti hai — BTN Bhutan ke liye, PAB Panama ke liye.

3. **Native digits.** `hi-IN`/`ne-NP`/`bn-BD`/`my-MM` Intl me `३,९९८` aur `၆၂,၉၀၀` dete hain. Technically sahi, par picker me 157 currencies saath dikhti hain — mix karke compare karna namumkin. Ab `-u-nu-latn` se Latin digits pinned.

4. **Nigeria ka addressOrder me payment methods paste ho gaye the** — `["card","banktransfer"]`. Generator me ab assertion hai jo har address token validate karti hai, to ye dobara nahi ho sakta.

5. **Test galat tha, code nahi:** `₫760.000` ko fraction samajh raha tha. Woh grouping separator hai. Regex ab `[.,]\d{1,2}$` hai — group separator ke baad hamesha 3 digits hote hain.

---

## 4. File count — 139/1000, aur mai ise inflate nahi karunga

Part 7 ne 4 files add ki: `geo/countries.js` (generated), `geo/shipping.js`, `geo/addressFormat.js`, `geo/index.js`. Plus 2 generator scripts aur `tests/part7.mjs`.

Aap ne kaha "old features ko strong/deep karo taki 1000 ho jaye" — maine wahi kiya, par sach ye hai: **is Part me 157 currencies aur 90 countries ka asli data aaya, 4 files me.** Agar mai isi data ko 157 alag currency files aur 90 country files me tod du to count 390 pahunch jayega, par woh codebase behtar nahi hoga — bas navigate karna mushkil.

Mera plan: features add karta rahunga (har ek me asli kaam), files natural taur pe badhengi. 1000 ka number chase karne ke liye artificial splitting nahi karunga jab tak aap specifically na kaho.

Agle Part me kya deep karun — ye batayein:
- **Checkout** ko is geo layer pe chalana (abhi data ready hai, checkout abhi bhi India-only hai)
- **Admin** me country/zone management screens
- **Baaki app ka translation** (abhi header/PDP translated hai, Cart/Checkout/Account/admin modules nahi)
