/**
 * postbuild: copy dist/index.html -> dist/404.html (byte-for-byte).
 *
 * The storefront uses clean history-API URLs (/shop, /product/…). GitHub
 * Pages cannot do server rewrites, so a deep link like
 * /bharatcart-universal/shop would 404. Pages serves dist/404.html for
 * unknown paths, which boots the same SPA — the router then renders the
 * right page. Run automatically after every `npm run build`.
 */
import { copyFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const from = join(dist, 'index.html')
const to = join(dist, '404.html')

if (!existsSync(from)) {
  console.error(`[spa-fallback] ${from} not found — run vite build first`)
  process.exit(1)
}
copyFileSync(from, to)
console.log('[spa-fallback] dist/index.html -> dist/404.html')
