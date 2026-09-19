/**
 * Vertical registry — the heart of BharatCart's multi-vertical catalogue.
 *
 * A "vertical" is a business line (fashion, grocery, fine jewellery, …).
 * Every vertical declares:
 *   - variantAxes     — the dimensions a product varies along (size × colour,
 *                       purity × weight, pack × flavour, …)
 *   - attributeSchema — the structured fields shown on the product form,
 *                       grouped into sections for the admin UI
 *   - uom             — default unit of measure for unit pricing
 *   - perishable / needsColdChain / supportsSubscription / goldPriced — flags
 *                       consumed by the inventory, pricing and shipping engines
 *   - sizeChart       — which size-chart table applies (null when N/A)
 *   - taxHints        — default tax hints; every store overrides these per
 *                       country in its tax settings (world-generic defaults)
 *   - defaults        — sane product defaults for this vertical
 *   - storefront      — hints for the storefront (which variant picker to
 *                       render, which trust badges to show)
 *
 * Pure logic, no React imports. Add a vertical here and the admin product
 * form, the storefront PDP picker and the seed data all follow automatically.
 */

/* ------------------------------------------------------------------ types
 * Field definition: { key, label, type, options?, required?, unit?, hint?, section? }
 *   type: 'text' | 'number' | 'select' | 'date' | 'switch' | 'multiselect' | 'textarea'
 * Variant axis:     { key, label, type: 'select' | 'color' | 'number', options?, unit?, required }
 */

const OCCASIONS_APPAREL = ['Casual', 'Formal', 'Party', 'Wedding', 'Festive', 'Workwear', 'Vacation']
const OCCASIONS_JEWEL = ['Daily', 'Party', 'Wedding', 'Festive', 'Office', 'Gifting']
const CARE_OPTIONS = ['Machine wash cold', 'Hand wash only', 'Dry clean recommended', 'Do not bleach', 'Line dry in shade']

export const VERTICALS = {
  /* ------------------------------------------------------- fashion */
  'fashion': {
    id: 'fashion',
    label: 'Fashion & Apparel',
    description: 'Clothing and apparel for all ages — tees, dresses, denims, ethnic wear and more.',
    variantAxes: [
      { key: 'size', label: 'Size', type: 'select', options: ['XS', 'S', 'M', 'L', 'XL', 'XXL'], required: true },
      { key: 'color', label: 'Colour', type: 'color', required: true },
    ],
    attributeSchema: [
      { key: 'fabric', label: 'Fabric', type: 'select', required: true, section: 'Details',
        options: ['Cotton', 'Linen', 'Denim', 'Silk', 'Polyester Blend', 'Wool Blend', 'Rayon', 'Velvet', 'Chiffon'] },
      { key: 'fit', label: 'Fit', type: 'select', section: 'Details',
        options: ['Slim', 'Regular', 'Relaxed', 'Oversized', 'Tailored'] },
      { key: 'pattern', label: 'Pattern', type: 'select', section: 'Details',
        options: ['Solid', 'Striped', 'Floral', 'Checked', 'Printed', 'Embroidered', 'Pleated'] },
      { key: 'sleeveLength', label: 'Sleeve length', type: 'select', section: 'Details',
        options: ['Sleeveless', 'Short', 'Three-Quarter', 'Full'] },
      { key: 'occasion', label: 'Occasion', type: 'multiselect', section: 'Details', options: OCCASIONS_APPAREL },
      { key: 'sizeChartRef', label: 'Size chart', type: 'select', section: 'Fit',
        options: ['apparel', 'petite', 'tall', 'plus'], hint: 'Which size-chart table shoppers see on the PDP' },
      { key: 'care', label: 'Care instructions', type: 'textarea', section: 'Care', options: CARE_OPTIONS },
    ],
    uom: { base: 'pc', label: 'per piece' },
    perishable: false,
    needsColdChain: false,
    supportsSubscription: false,
    goldPriced: false,
    sizeChart: 'apparel',
    taxHints: { gst: 12, hsn: '6204' },
    defaults: { codEligible: true, returnDays: 30 },
    storefront: { picker: 'fashion', badges: ['size-guide'] },
  },

  /* ------------------------------------------------------ innerwear */
  'innerwear': {
    id: 'innerwear',
    label: 'Innerwear & Lingerie',
    description: 'Undergarments, lingerie and nightwear — band/alpha sizing with comfort attributes.',
    variantAxes: [
      { key: 'size', label: 'Size', type: 'select', required: true,
        options: ['28', '30', '32', '34', '36', '38', '40', '42', '44', 'XS', 'S', 'M', 'L', 'XL', 'XXL'],
        hint: 'Band sizes 28–44 or alpha sizes XS–XXL depending on the garment' },
      { key: 'color', label: 'Colour', type: 'color', required: true },
    ],
    attributeSchema: [
      { key: 'fabric', label: 'Fabric', type: 'select', required: true, section: 'Details',
        options: ['Cotton', 'Modal', 'Microfiber', 'Bamboo', 'Lace Blend', 'Satin'] },
      { key: 'padding', label: 'Padding', type: 'select', section: 'Details',
        options: ['None', 'Light', 'Medium', 'Heavy', 'Removable'] },
      { key: 'wired', label: 'Underwired', type: 'switch', section: 'Details' },
      { key: 'care', label: 'Care instructions', type: 'textarea', section: 'Care', options: CARE_OPTIONS,
        hint: 'Delicates usually need gentler care — call it out clearly' },
    ],
    uom: { base: 'pc', label: 'per piece' },
    perishable: false,
    needsColdChain: false,
    supportsSubscription: false,
    goldPriced: false,
    sizeChart: 'innerwear',
    taxHints: { gst: 12, hsn: '6212' },
    defaults: { codEligible: true, returnDays: 15 },
    storefront: { picker: 'fashion', badges: ['size-guide', 'discreet-packaging'] },
  },

  /* ------------------------------------------------------- footwear */
  'footwear': {
    id: 'footwear',
    label: 'Footwear',
    description: 'Shoes, sneakers, sandals and boots — sized by foot measurement.',
    variantAxes: [
      { key: 'size', label: 'Size', type: 'select', required: true,
        options: ['UK 5', 'UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11'] },
      { key: 'color', label: 'Colour', type: 'color', required: true },
    ],
    attributeSchema: [
      { key: 'upperMaterial', label: 'Upper material', type: 'select', required: true, section: 'Details',
        options: ['Leather', 'Suede', 'Canvas', 'Mesh', 'Synthetic', 'Patent', 'Knit'] },
      { key: 'soleType', label: 'Sole type', type: 'select', section: 'Details',
        options: ['Rubber', 'EVA', 'TPR', 'Leather', 'Foam'] },
      { key: 'closure', label: 'Closure', type: 'select', section: 'Details',
        options: ['Lace-up', 'Slip-on', 'Velcro', 'Buckle', 'Zip'] },
      { key: 'heelHeight', label: 'Heel height', type: 'number', unit: 'cm', section: 'Details',
        hint: '0 for flat footwear' },
      { key: 'care', label: 'Care instructions', type: 'textarea', section: 'Care',
        options: ['Wipe with a dry cloth', 'Use leather conditioner', 'Air dry away from heat', 'Waterproof spray recommended'] },
    ],
    uom: { base: 'pair', label: 'per pair' },
    perishable: false,
    needsColdChain: false,
    supportsSubscription: false,
    goldPriced: false,
    sizeChart: 'footwear',
    taxHints: { gst: 12, hsn: '6403' },
    defaults: { codEligible: true, returnDays: 30 },
    storefront: { picker: 'fashion', badges: ['size-guide', 'try-at-home'] },
  },

  /* ------------------------------------------ artificial jewellery */
  'artificial-jewellery': {
    id: 'artificial-jewellery',
    label: 'Artificial Jewellery',
    description: 'Fashion and imitation jewellery — plated pieces, festive wear, everyday accessories.',
    variantAxes: [
      { key: 'design', label: 'Design', type: 'select', required: true,
        options: ['Classic', 'Oxidised', 'Antique', 'Meenakari', 'Temple', 'Polished'] },
      { key: 'color', label: 'Colour / tone', type: 'select', required: true,
        options: ['Gold', 'Silver', 'Rose Gold', 'Multicolour', 'Black'] },
    ],
    attributeSchema: [
      { key: 'baseMaterial', label: 'Base material', type: 'select', required: true, section: 'Details',
        options: ['Brass', 'Copper Alloy', 'Zinc Alloy', 'Stainless Steel'] },
      { key: 'plating', label: 'Plating', type: 'select', section: 'Details',
        options: ['Gold Plated', 'Silver Plated', 'Rhodium Plated', 'Oxidised Silver', 'None'] },
      { key: 'stoneType', label: 'Stone type', type: 'select', section: 'Details',
        options: ['None', 'American Diamond', 'Pearl', 'Cubic Zirconia', 'Crystal', 'Enamel'] },
      { key: 'nickelFree', label: 'Nickel free', type: 'switch', section: 'Details',
        hint: 'Important for sensitive skin — shown as a trust badge' },
      { key: 'occasion', label: 'Occasion', type: 'multiselect', section: 'Details', options: OCCASIONS_JEWEL },
      { key: 'weightG', label: 'Weight', type: 'number', unit: 'g', section: 'Details' },
      { key: 'care', label: 'Care instructions', type: 'textarea', section: 'Care',
        options: ['Keep away from perfume and water', 'Store in an airtight pouch', 'Wipe with a soft dry cloth'] },
    ],
    uom: { base: 'pc', label: 'per piece' },
    perishable: false,
    needsColdChain: false,
    supportsSubscription: false,
    goldPriced: false,
    sizeChart: null,
    taxHints: { gst: 12, hsn: '7117' },
    defaults: { codEligible: true, returnDays: 15 },
    storefront: { picker: 'jewellery', badges: ['nickel-free', 'tarnish-care'] },
  },

  /* ------------------------------------------------ fine jewellery */
  'fine-jewellery': {
    id: 'fine-jewellery',
    label: 'Fine Jewellery',
    description: 'Gold, platinum and diamond jewellery — live metal pricing, hallmarking and certification.',
    variantAxes: [
      { key: 'purity', label: 'Purity', type: 'select', required: true, options: ['14K', '18K', '22K'] },
      { key: 'weightG', label: 'Weight', type: 'number', unit: 'g', required: true,
        hint: 'Gross weight in grams — price is computed from the live metal rate' },
    ],
    attributeSchema: [
      { key: 'metal', label: 'Metal', type: 'select', required: true, section: 'Metal',
        options: ['Yellow Gold', 'White Gold', 'Rose Gold', 'Platinum', 'Silver'] },
      { key: 'purity', label: 'Purity', type: 'select', required: true, section: 'Metal',
        options: ['14K', '18K', '22K', '950 Platinum', '925 Silver'] },
      { key: 'weightG', label: 'Gross weight', type: 'number', unit: 'g', required: true, section: 'Metal' },
      { key: 'makingPct', label: 'Making charges', type: 'number', unit: '%', section: 'Pricing',
        hint: 'Applied on the metal value to compute the selling price' },
      { key: 'stoneValue', label: 'Stone value', type: 'number', section: 'Pricing',
        hint: 'Total value of diamonds/gemstones in store currency (0 for plain gold)' },
      { key: 'bisHallmark', label: 'Hallmarked', type: 'switch', section: 'Certification',
        hint: 'Independently hallmarked for purity' },
      { key: 'certification', label: 'Certification', type: 'select', section: 'Certification',
        options: ['BIS Hallmark', 'IGI', 'GIA', 'SGL', 'None'] },
      { key: 'care', label: 'Care instructions', type: 'textarea', section: 'Care',
        options: ['Store separately in a soft pouch', 'Clean with a soft dry cloth', 'Annual professional cleaning recommended'] },
    ],
    uom: { base: 'pc', label: 'per piece' },
    perishable: false,
    needsColdChain: false,
    supportsSubscription: false,
    goldPriced: true,          // the pricing engine re-prices from the live metal rate
    sizeChart: null,
    taxHints: { gst: 3, hsn: '7113' },
    defaults: { codEligible: false, returnDays: 7 },
    storefront: { picker: 'jewellery', badges: ['certified', 'hallmarked', 'gold-priced', 'insured-shipping'] },
  },

  /* ------------------------------------------------- confectionery */
  'confectionery': {
    id: 'confectionery',
    label: 'Confectionery & Bakery',
    description: 'Cakes, chocolates, cookies and bakes — flavour and pack-size variants, allergen aware.',
    variantAxes: [
      { key: 'packWeight', label: 'Pack size', type: 'select', required: true,
        options: ['250 g', '500 g', '1 kg'] },
      { key: 'flavour', label: 'Flavour', type: 'select', required: true,
        options: ['Chocolate', 'Vanilla', 'Red Velvet', 'Butterscotch', 'Mango', 'Pistachio', 'Coffee', 'Lemon', 'Strawberry', 'Caramel'] },
    ],
    attributeSchema: [
      { key: 'flavour', label: 'Flavour', type: 'select', required: true, section: 'Details',
        options: ['Chocolate', 'Vanilla', 'Red Velvet', 'Butterscotch', 'Mango', 'Pistachio', 'Coffee', 'Lemon', 'Strawberry', 'Caramel'] },
      { key: 'allergens', label: 'Allergens', type: 'multiselect', required: true, section: 'Food safety',
        options: ['Gluten', 'Dairy', 'Eggs', 'Nuts', 'Soy', 'Sesame'],
        hint: 'Legally required on the label in most countries' },
      { key: 'vegMark', label: 'Diet mark', type: 'select', section: 'Food safety',
        options: ['Veg', 'Contains Egg', 'Vegan'] },
      { key: 'bestBeforeDays', label: 'Best before', type: 'number', unit: 'days', section: 'Shelf life',
        hint: 'Used to stamp the expiry date on every batch' },
      { key: 'storageNote', label: 'Storage note', type: 'textarea', section: 'Shelf life',
        options: ['Keep refrigerated at 4 °C', 'Store in a cool, dry place', 'Refrigerate after opening', 'Consume within 24 hours of opening'] },
      { key: 'customMessage', label: 'Custom message allowed', type: 'switch', section: 'Details',
        hint: 'Buyer can add a message on the cake or gift box' },
    ],
    uom: { base: 'kg', label: 'per kg' },
    perishable: true,
    needsColdChain: false,
    supportsSubscription: false,
    goldPriced: false,
    sizeChart: null,
    taxHints: { gst: 12, hsn: '1905' },
    defaults: { codEligible: true, returnDays: 0 },
    storefront: { picker: 'food', badges: ['perishable', 'allergen-info', 'customisable'] },
  },

  /* ---------------------------------------------------------- dairy */
  'dairy': {
    id: 'dairy',
    label: 'Dairy',
    description: 'Milk, curd, paneer, butter and cheese — cold-chain fulfilment with subscriptions.',
    variantAxes: [
      { key: 'pack', label: 'Pack', type: 'select', required: true,
        options: ['200 ml', '500 ml', '1 L'] },
    ],
    attributeSchema: [
      { key: 'fatPct', label: 'Fat content', type: 'number', unit: '%', section: 'Details' },
      { key: 'pasteurized', label: 'Pasteurized', type: 'switch', section: 'Food safety' },
      { key: 'shelfLifeDays', label: 'Shelf life', type: 'number', unit: 'days', section: 'Shelf life',
        hint: 'Used to stamp the expiry date on every batch' },
      { key: 'storageTemp', label: 'Storage temperature', type: 'text', section: 'Shelf life',
        hint: 'e.g. 2–4 °C' },
      { key: 'fssai', label: 'Food licence no.', type: 'text', section: 'Compliance',
        hint: 'Food safety licence number (FSSAI in India, equivalent elsewhere)' },
    ],
    uom: { base: 'l', label: 'per litre' },
    perishable: true,
    needsColdChain: true,
    supportsSubscription: true,
    goldPriced: false,
    sizeChart: null,
    taxHints: { gst: 5, hsn: '0401' },
    defaults: { codEligible: false, returnDays: 0 },
    storefront: { picker: 'food', badges: ['cold-chain', 'perishable', 'subscription'] },
  },

  /* -------------------------------------------------------- grocery */
  'grocery': {
    id: 'grocery',
    label: 'Grocery & Staples',
    description: 'Dals, rice, atta, oils, spices and packaged staples — unit-priced packs.',
    variantAxes: [
      { key: 'pack', label: 'Pack', type: 'select', required: true,
        options: ['100 g', '250 g', '500 g', '1 kg', '5 kg'] },
    ],
    attributeSchema: [
      { key: 'brand', label: 'Brand', type: 'text', section: 'Details' },
      { key: 'fssai', label: 'Food licence no.', type: 'text', section: 'Compliance',
        hint: 'Food safety licence number where applicable' },
      { key: 'vegMark', label: 'Diet mark', type: 'select', section: 'Food safety',
        options: ['Veg', 'Non-Veg', 'Vegan'] },
      { key: 'expiryDate', label: 'Expiry date', type: 'date', section: 'Shelf life' },
      { key: 'mrp', label: 'MRP', type: 'number', section: 'Pricing',
        hint: 'Maximum retail price printed on the pack' },
      { key: 'unitPriceBase', label: 'Unit price base', type: 'number', section: 'Pricing',
        hint: 'Price per base unit (per kg) used for unit-price display' },
    ],
    uom: { base: 'kg', label: 'per kg' },
    perishable: false,         // configurable per product — fresh produce flips this on
    needsColdChain: false,
    supportsSubscription: true,
    goldPriced: false,
    sizeChart: null,
    taxHints: { gst: 5, hsn: '1006' },
    defaults: { codEligible: true, returnDays: 7 },
    storefront: { picker: 'food', badges: ['unit-priced'] },
  },

  /* -------------------------------------------------------- general */
  'general': {
    id: 'general',
    label: 'General',
    description: 'Catch-all for anything that does not fit a specialised vertical.',
    variantAxes: [
      { key: 'size', label: 'Size', type: 'select', required: true,
        options: ['One Size', 'S', 'M', 'L', 'XL'] },
      { key: 'color', label: 'Colour', type: 'color', required: false },
    ],
    attributeSchema: [
      { key: 'material', label: 'Material', type: 'text', section: 'Details' },
      { key: 'weightG', label: 'Weight', type: 'number', unit: 'g', section: 'Details' },
      { key: 'warranty', label: 'Warranty', type: 'text', section: 'Details',
        hint: 'e.g. "1 year manufacturer warranty" or "No warranty"' },
    ],
    uom: { base: 'pc', label: 'per piece' },
    perishable: false,
    needsColdChain: false,
    supportsSubscription: false,
    goldPriced: false,
    sizeChart: null,
    taxHints: { gst: 18, hsn: '9999' },
    defaults: { codEligible: true, returnDays: 30 },
    storefront: { picker: 'generic', badges: [] },
  },
}

/** All vertical ids, in a stable order. */
export const VERTICAL_IDS = Object.keys(VERTICALS)

/** Look up a vertical by id; unknown ids fall back to 'general'. */
export function getVertical(id) {
  return VERTICALS[id] || VERTICALS.general
}

/**
 * Legacy category → vertical mapping, for products created before the
 * `vertical` field existed (and for any product that forgot to set one).
 */
const LEGACY_CATEGORY_MAP = {
  'Ethnic Wear': 'fashion',
  'Western Wear': 'fashion',
  'Kids': 'fashion',
  'Footwear': 'footwear',
  'Jewellery': 'artificial-jewellery',
  // everything else → 'general'
}

/** Resolve the vertical id for a product: explicit field, legacy category, else 'general'. */
export function verticalFor(product = {}) {
  if (product.vertical && VERTICALS[product.vertical]) return product.vertical
  if (product.category && LEGACY_CATEGORY_MAP[product.category]) return LEGACY_CATEGORY_MAP[product.category]
  return 'general'
}

/** Variant axes for a product's vertical. */
export function variantAxesFor(product) {
  return getVertical(verticalFor(product)).variantAxes
}

/** Attribute schema for a product's vertical. */
export function attributeSchemaFor(product) {
  return getVertical(verticalFor(product)).attributeSchema
}
