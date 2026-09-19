import glassAurora from './glassAurora.js'
import saffronBazaar from './saffronBazaar.js'
import midnightLuxe from './midnightLuxe.js'
import minimalMuji from './minimalMuji.js'
import neoBrutalist from './neoBrutalist.js'
import pastelBoutique from './pastelBoutique.js'
import electricMono from './electricMono.js'
import handloomHeritage from './handloomHeritage.js'
import corporateTrust from './corporateTrust.js'
import sunriseCommerce from './sunriseCommerce.js'
import nordicCalm from './nordicCalm.js'
import frostedMint from './frostedMint.js'
import glassNoir from './glassNoir.js'
import crystalRose from './crystalRose.js'
import aquaTide from './aquaTide.js'
import lavenderMist from './lavenderMist.js'
import onyxGold from './onyxGold.js'
import midnightEmerald from './midnightEmerald.js'
import velvetNoir from './velvetNoir.js'
import carbonLuxe from './carbonLuxe.js'
import porcelain from './porcelain.js'
import paperInk from './paperInk.js'
import bareStone from './bareStone.js'
import arcticWhite from './arcticWhite.js'
import runwayNoir from './runwayNoir.js'
import atelierCream from './atelierCream.js'
import vogueContrast from './vogueContrast.js'
import museBlush from './museBlush.js'
import marigoldFest from './marigoldFest.js'
import banarasiSilk from './banarasiSilk.js'
import terracottaCraft from './terracottaCraft.js'
import peacockPride from './peacockPride.js'
import diwaliGlow from './diwaliGlow.js'
import holiPop from './holiPop.js'
import freshMarket from './freshMarket.js'
import spiceRoute from './spiceRoute.js'
import bakeryWarm from './bakeryWarm.js'
import citrusZest from './citrusZest.js'
import royalKundan from './royalKundan.js'
import champagnePearl from './champagnePearl.js'
import roseGoldBlush from './roseGoldBlush.js'
import candyPop from './candyPop.js'
import toybox from './toybox.js'
import bubblegumPop from './bubblegumPop.js'
import forestFloor from './forestFloor.js'
import desertDune from './desertDune.js'
import matchaZen from './matchaZen.js'
import claySage from './claySage.js'
import steelTrust from './steelTrust.js'
import slateExecutive from './slateExecutive.js'
import ivoryBank from './ivoryBank.js'
import synthwave84 from './synthwave84.js'
import retroDiner from './retroDiner.js'
import artDecoGold from './artDecoGold.js'
import neonTerminal from './neonTerminal.js'
import deepSpace from './deepSpace.js'
import monsoonMist from './monsoonMist.js'
import autumnHarvest from './autumnHarvest.js'
import { defaultTokens } from '../tokens/schema.js'

export const TEMPLATES = [
  glassAurora,       // default
  saffronBazaar,
  midnightLuxe,
  minimalMuji,
  neoBrutalist,
  pastelBoutique,
  electricMono,
  handloomHeritage,
  corporateTrust,
  sunriseCommerce,
  nordicCalm,
  frostedMint,
  glassNoir,
  crystalRose,
  aquaTide,
  lavenderMist,
  onyxGold,
  midnightEmerald,
  velvetNoir,
  carbonLuxe,
  porcelain,
  paperInk,
  bareStone,
  arcticWhite,
  runwayNoir,
  atelierCream,
  vogueContrast,
  museBlush,
  marigoldFest,
  banarasiSilk,
  terracottaCraft,
  peacockPride,
  diwaliGlow,
  holiPop,
  freshMarket,
  spiceRoute,
  bakeryWarm,
  citrusZest,
  royalKundan,
  champagnePearl,
  roseGoldBlush,
  candyPop,
  toybox,
  bubblegumPop,
  forestFloor,
  desertDune,
  matchaZen,
  claySage,
  steelTrust,
  slateExecutive,
  ivoryBank,
  synthwave84,
  retroDiner,
  artDecoGold,
  neonTerminal,
  deepSpace,
  monsoonMist,
  autumnHarvest,
]

export const TEMPLATE_MAP = Object.fromEntries(TEMPLATES.map(t => [t.id, t]))

export const DEFAULT_TEMPLATE_ID = 'glass-aurora'

/** Full token set for a template (defaults + template overrides). */
export function tokensFor(templateId) {
  const tpl = TEMPLATE_MAP[templateId] || TEMPLATE_MAP[DEFAULT_TEMPLATE_ID]
  return { ...defaultTokens(), ...tpl.tokens }
}

export default TEMPLATES
