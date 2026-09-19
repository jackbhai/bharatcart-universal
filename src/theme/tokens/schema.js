/**
 * Theme token schema. Every template is just a value-set for these tokens,
 * and every token is exposed as a CSS custom property at runtime, so a theme
 * switch repaints the whole app without a reload.
 */

export const TOKEN_GROUPS = {
  brand: {
    label: 'Brand',
    tokens: {
      storeName:      { type: 'text',   default: 'BharatCart',       label: 'Store name' },
      tagline:        { type: 'text',   default: 'Crafted in India', label: 'Tagline' },
      logoUrl:        { type: 'image',  default: '',                 label: 'Logo' },
      logoText:       { type: 'text',   default: 'B',                label: 'Logo letter (if no image)' },
      logoHeight:     { type: 'number', default: 36, min: 20, max: 80, unit: 'px', label: 'Logo height' },
      faviconUrl:     { type: 'image',  default: '',                 label: 'Favicon' },
    },
  },

  colour: {
    label: 'Colours',
    tokens: {
      primary:        { type: 'colour', default: '#F97316', label: 'Primary' },
      primaryFg:      { type: 'colour', default: '#FFFFFF', label: 'Primary text' },
      secondary:      { type: 'colour', default: '#6366F1', label: 'Secondary' },
      accent:         { type: 'colour', default: '#F59E0B', label: 'Accent' },
      bg:             { type: 'colour', default: '#F4F6FA', label: 'Page background' },
      surface:        { type: 'colour', default: '#FFFFFF', label: 'Card surface' },
      surfaceAlt:     { type: 'colour', default: '#F8FAFC', label: 'Alt surface' },
      text:           { type: 'colour', default: '#0F172A', label: 'Text' },
      textMuted:      { type: 'colour', default: '#64748B', label: 'Muted text' },
      border:         { type: 'colour', default: '#E2E8F0', label: 'Border' },
      success:        { type: 'colour', default: '#10B981', label: 'Success' },
      warning:        { type: 'colour', default: '#F59E0B', label: 'Warning' },
      danger:         { type: 'colour', default: '#EF4444', label: 'Danger' },
      info:           { type: 'colour', default: '#3B82F6', label: 'Info' },
    },
  },

  typography: {
    label: 'Typography',
    tokens: {
      fontHeading:    { type: 'font',   default: "'Inter', system-ui, sans-serif", label: 'Heading font' },
      fontBody:       { type: 'font',   default: "'Inter', system-ui, sans-serif", label: 'Body font' },
      fontMono:       { type: 'font',   default: "'JetBrains Mono', monospace",    label: 'Mono font' },
      baseSize:       { type: 'number', default: 15, min: 12, max: 20, unit: 'px', label: 'Base size' },
      scaleRatio:     { type: 'number', default: 1.25, min: 1.1, max: 1.5, step: 0.05, label: 'Type scale' },
      headingWeight:  { type: 'select', default: '700', options: ['500','600','700','800','900'], label: 'Heading weight' },
      bodyWeight:     { type: 'select', default: '400', options: ['300','400','500'], label: 'Body weight' },
      lineHeight:     { type: 'number', default: 1.55, min: 1.2, max: 2, step: 0.05, label: 'Line height' },
      letterSpacing:  { type: 'number', default: 0, min: -2, max: 4, step: 0.1, unit: 'px', label: 'Letter spacing' },
      headingCase:    { type: 'select', default: 'none', options: ['none','uppercase','capitalize'], label: 'Heading case' },
    },
  },

  shape: {
    label: 'Shape & Layout',
    tokens: {
      radius:         { type: 'number', default: 16, min: 0, max: 32, unit: 'px', label: 'Corner radius' },
      radiusSm:       { type: 'number', default: 8,  min: 0, max: 20, unit: 'px', label: 'Small radius' },
      radiusFull:     { type: 'number', default: 999, min: 0, max: 999, unit: 'px', label: 'Pill radius' },
      borderWidth:    { type: 'number', default: 1, min: 0, max: 4, unit: 'px', label: 'Border width' },
      shadowIntensity:{ type: 'select', default: 'soft', options: ['none','soft','medium','strong','brutal'], label: 'Shadow' },
      containerWidth: { type: 'number', default: 1280, min: 960, max: 1920, unit: 'px', label: 'Container width' },
      sectionGap:     { type: 'number', default: 64, min: 24, max: 140, unit: 'px', label: 'Section spacing' },
      gridGap:        { type: 'number', default: 16, min: 6, max: 40, unit: 'px', label: 'Grid gap' },
      cardStyle:      { type: 'select', default: 'raised', options: ['flat','raised','outlined','glass'], label: 'Card style' },
      buttonStyle:    { type: 'select', default: 'solid', options: ['solid','soft','outline','ghost','pill'], label: 'Button style' },
      inputStyle:     { type: 'select', default: 'outlined', options: ['outlined','filled','underline'], label: 'Input style' },
      imageRatio:     { type: 'select', default: '3/4', options: ['1/1','3/4','4/5','16/9'], label: 'Product image ratio' },
      plpColumns:     { type: 'number', default: 4, min: 2, max: 6, label: 'PLP columns (desktop)' },
    },
  },

  motion: {
    label: 'Motion & Effects',
    tokens: {
      intensity:      { type: 'select', default: 'normal', options: ['off','subtle','normal','cinematic'], label: 'Animation intensity' },
      pageTransition: { type: 'select', default: 'fade', options: ['none','fade','slide','scale','blur'], label: 'Page transition' },
      hoverLift:      { type: 'bool',   default: true,  label: 'Hover lift' },
      parallax:       { type: 'bool',   default: true,  label: 'Parallax' },
      confetti:       { type: 'bool',   default: true,  label: 'Celebration confetti' },
      backgroundFx:   { type: 'select', default: 'aurora', options: ['none','aurora','grid','noise','rangoli','mesh'], label: 'Background effect' },
      scrollReveal:   { type: 'bool',   default: true,  label: 'Scroll reveal' },
      duration:       { type: 'number', default: 1, min: 0.5, max: 2, step: 0.1, label: 'Speed multiplier' },
    },
  },
}

/** Flat default token map. */
export function defaultTokens() {
  const out = {}
  for (const group of Object.values(TOKEN_GROUPS)) {
    for (const [key, def] of Object.entries(group.tokens)) out[key] = def.default
  }
  return out
}

/** Token metadata lookup. */
export const TOKEN_META = (() => {
  const out = {}
  for (const [gid, group] of Object.entries(TOKEN_GROUPS)) {
    for (const [key, def] of Object.entries(group.tokens)) out[key] = { ...def, group: gid }
  }
  return out
})()

export const TOKEN_KEYS = Object.keys(TOKEN_META)

export default TOKEN_GROUPS
