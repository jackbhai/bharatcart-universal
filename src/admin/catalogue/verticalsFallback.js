/**
 * Minimal bundled vertical registry — FALLBACK ONLY.
 *
 * The canonical registry lives in src/engines/catalogue/verticals.js (chunk A).
 * This file is used only if that engine file is momentarily absent, so the
 * admin catalogue keeps rendering. It mirrors the engine contract:
 *   { id, label, description, variantAxes, attributeSchema, perishable }
 * Axis:  { key, label, type: 'select'|'color'|'number', options?, unit?, required }
 * Field: { key, label, type: 'text'|'number'|'select'|'date'|'switch'|'multiselect'|'textarea',
 *          options?, required?, unit?, hint?, section? }
 */

const V = (id, label, description, variantAxes, attributeSchema, extra = {}) => ({
  id, label, description, variantAxes, attributeSchema, perishable: false, ...extra,
})

export const VERTICALS = {
  'fashion': V(
    'fashion', 'Fashion & Apparel',
    'Clothing and apparel for all ages — size × colour variants.',
    [
      { key: 'size', label: 'Size', type: 'select', options: ['XS', 'S', 'M', 'L', 'XL', 'XXL'], required: true },
      { key: 'color', label: 'Colour', type: 'color', required: true },
    ],
    [
      { key: 'fabric', label: 'Fabric', type: 'text', section: 'Details' },
      { key: 'fit', label: 'Fit', type: 'select', section: 'Details', options: ['Slim', 'Regular', 'Relaxed', 'Oversized'] },
      { key: 'occasion', label: 'Occasion', type: 'multiselect', section: 'Details',
        options: ['Casual', 'Formal', 'Party', 'Wedding', 'Festive'] },
      { key: 'care', label: 'Care instructions', type: 'textarea', section: 'Care' },
    ],
  ),

  'innerwear': V(
    'innerwear', 'Innerwear & Lingerie',
    'Undergarments and nightwear — band/alpha sizing with comfort attributes.',
    [
      { key: 'size', label: 'Size', type: 'select', required: true,
        options: ['28', '30', '32', '34', '36', '38', '40', '42', 'XS', 'S', 'M', 'L', 'XL', 'XXL'] },
      { key: 'color', label: 'Colour', type: 'color', required: true },
    ],
    [
      { key: 'fabric', label: 'Fabric', type: 'text', required: true, section: 'Details' },
      { key: 'padding', label: 'Padding', type: 'select', section: 'Details',
        options: ['None', 'Light', 'Medium', 'Heavy', 'Removable'] },
      { key: 'wired', label: 'Underwired', type: 'switch', section: 'Details' },
      { key: 'care', label: 'Care instructions', type: 'textarea', section: 'Care' },
    ],
  ),

  'footwear': V(
    'footwear', 'Footwear',
    'Shoes, sneakers, sandals and boots — sized by foot measurement.',
    [
      { key: 'size', label: 'Size', type: 'select', required: true,
        options: ['UK 5', 'UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11'] },
      { key: 'color', label: 'Colour', type: 'color', required: true },
    ],
    [
      { key: 'upperMaterial', label: 'Upper material', type: 'text', required: true, section: 'Details' },
      { key: 'soleType', label: 'Sole type', type: 'text', section: 'Details' },
      { key: 'closure', label: 'Closure', type: 'select', section: 'Details',
        options: ['Lace-up', 'Slip-on', 'Velcro', 'Buckle', 'Zip'] },
      { key: 'care', label: 'Care instructions', type: 'textarea', section: 'Care' },
    ],
  ),

  'artificial-jewellery': V(
    'artificial-jewellery', 'Artificial Jewellery',
    'Fashion and imitation jewellery — plated pieces, festive and everyday wear.',
    [
      { key: 'design', label: 'Design', type: 'select', required: true,
        options: ['Classic', 'Oxidised', 'Antique', 'Meenakari', 'Temple', 'Polished'] },
      { key: 'color', label: 'Colour / tone', type: 'select', required: true,
        options: ['Gold', 'Silver', 'Rose Gold', 'Multicolour', 'Black'] },
    ],
    [
      { key: 'baseMaterial', label: 'Base material', type: 'text', required: true, section: 'Details' },
      { key: 'plating', label: 'Plating', type: 'select', section: 'Details',
        options: ['Gold Plated', 'Silver Plated', 'Rhodium Plated', 'Oxidised Silver', 'None'] },
      { key: 'stoneType', label: 'Stone type', type: 'text', section: 'Details' },
      { key: 'nickelFree', label: 'Nickel free', type: 'switch', section: 'Details',
        hint: 'Important for sensitive skin — shown as a trust badge' },
      { key: 'weightG', label: 'Weight', type: 'number', unit: 'g', section: 'Details' },
      { key: 'care', label: 'Care instructions', type: 'textarea', section: 'Care' },
    ],
  ),

  'fine-jewellery': V(
    'fine-jewellery', 'Fine Jewellery',
    'Gold, platinum and diamond jewellery — hallmarking and certification.',
    [
      { key: 'purity', label: 'Purity', type: 'select', required: true, options: ['14K', '18K', '22K'] },
      { key: 'weightG', label: 'Weight', type: 'number', unit: 'g', required: true, min: 1, max: 100, step: 0.5 },
    ],
    [
      { key: 'metal', label: 'Metal', type: 'select', required: true, section: 'Metal',
        options: ['Yellow Gold', 'White Gold', 'Rose Gold', 'Platinum', 'Silver'] },
      { key: 'purity', label: 'Purity', type: 'select', required: true, section: 'Metal',
        options: ['14K', '18K', '22K', '950 Platinum', '925 Silver'] },
      { key: 'weightG', label: 'Gross weight', type: 'number', unit: 'g', required: true, section: 'Metal' },
      { key: 'makingPct', label: 'Making charges', type: 'number', unit: '%', section: 'Pricing' },
      { key: 'certification', label: 'Certification', type: 'select', section: 'Certification',
        options: ['BIS Hallmark', 'IGI', 'GIA', 'SGL', 'None'] },
      { key: 'bisHallmark', label: 'Hallmarked', type: 'switch', section: 'Certification' },
      { key: 'care', label: 'Care instructions', type: 'textarea', section: 'Care' },
    ],
  ),

  'confectionery': V(
    'confectionery', 'Confectionery & Bakery',
    'Cakes, chocolates and bakes — flavour and pack-size variants, allergen aware.',
    [
      { key: 'packWeight', label: 'Pack size', type: 'select', required: true, options: ['250 g', '500 g', '1 kg'] },
      { key: 'flavour', label: 'Flavour', type: 'select', required: true,
        options: ['Chocolate', 'Vanilla', 'Red Velvet', 'Butterscotch', 'Mango', 'Pistachio'] },
    ],
    [
      { key: 'flavour', label: 'Flavour', type: 'text', required: true, section: 'Details' },
      { key: 'allergens', label: 'Allergens', type: 'multiselect', required: true, section: 'Food safety',
        options: ['Gluten', 'Dairy', 'Eggs', 'Nuts', 'Soy', 'Sesame'] },
      { key: 'vegMark', label: 'Diet mark', type: 'select', section: 'Food safety',
        options: ['Veg', 'Contains Egg', 'Vegan'] },
      { key: 'bestBeforeDays', label: 'Best before', type: 'number', unit: 'days', section: 'Shelf life' },
      { key: 'storageNote', label: 'Storage note', type: 'textarea', section: 'Shelf life' },
    ],
    { perishable: true },
  ),

  'dairy': V(
    'dairy', 'Dairy',
    'Milk, curd, paneer, butter and cheese — cold-chain fulfilment.',
    [
      { key: 'pack', label: 'Pack', type: 'select', required: true, options: ['200 ml', '500 ml', '1 L'] },
    ],
    [
      { key: 'fatPct', label: 'Fat content', type: 'number', unit: '%', section: 'Details' },
      { key: 'pasteurized', label: 'Pasteurized', type: 'switch', section: 'Food safety' },
      { key: 'shelfLifeDays', label: 'Shelf life', type: 'number', unit: 'days', section: 'Shelf life' },
      { key: 'storageTemp', label: 'Storage temperature', type: 'text', section: 'Shelf life', hint: 'e.g. 2–4 °C' },
      { key: 'fssai', label: 'Food licence no.', type: 'text', section: 'Compliance' },
    ],
    { perishable: true },
  ),

  'grocery': V(
    'grocery', 'Grocery & Staples',
    'Dals, rice, atta, oils, spices and packaged staples — unit-priced packs.',
    [
      { key: 'pack', label: 'Pack', type: 'select', required: true,
        options: ['100 g', '250 g', '500 g', '1 kg', '5 kg'] },
    ],
    [
      { key: 'brand', label: 'Brand', type: 'text', section: 'Details' },
      { key: 'fssai', label: 'Food licence no.', type: 'text', section: 'Compliance' },
      { key: 'vegMark', label: 'Diet mark', type: 'select', section: 'Food safety',
        options: ['Veg', 'Non-Veg', 'Vegan'] },
      { key: 'expiryDate', label: 'Expiry date', type: 'date', section: 'Shelf life' },
      { key: 'shelfLifeDays', label: 'Shelf life', type: 'number', unit: 'days', section: 'Shelf life' },
    ],
  ),

  'general': V(
    'general', 'General',
    'Catch-all for anything that does not fit a specialised vertical.',
    [
      { key: 'size', label: 'Size', type: 'select', required: true, options: ['One Size', 'S', 'M', 'L', 'XL'] },
      { key: 'color', label: 'Colour', type: 'color', required: false },
    ],
    [
      { key: 'material', label: 'Material', type: 'text', section: 'Details' },
      { key: 'weightG', label: 'Weight', type: 'number', unit: 'g', section: 'Details' },
      { key: 'warranty', label: 'Warranty', type: 'text', section: 'Details' },
    ],
  ),
}
