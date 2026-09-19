import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Asset base follows the deploy sub-path. The Pages deploy builds with
  // VITE_APP_BASENAME=/bharatcart-universal, which needs absolute asset URLs
  // so clean storefront routes (/shop, /product/…) resolve them from any
  // path. Without the variable the old relative behaviour is kept.
  const env = loadEnv(mode, process.cwd(), '')
  const appBasename = (env.VITE_APP_BASENAME || '').replace(/^\/+|\/+$/g, '')
  return {
  base: appBasename ? `/${appBasename}/` : './',
  plugins: [react()],
  server: { port: 5180, host: '0.0.0.0', allowedHosts: true },
  build: {
    // The single 674 kB entry chunk was the worst thing on the site for a
    // budget Android phone: nothing rendered until all of it had parsed. These
    // groups split along "changes rarely" vs "changes every deploy" lines, so a
    // returning visitor re-downloads only what actually changed.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            // The seed dataset is large, static, and pulled in by nearly every
            // admin screen — worth its own long-lived chunk.
            if (id.includes('/src/data/')) return 'data'
            // Generated currency and country tables: ~200 KB of pure lookup.
            if (id.includes('/src/currency/') || id.includes('/src/geo/')) return 'locale-data'
            if (id.includes('/src/i18n/')) return 'i18n'
            return undefined
          }
          if (id.includes('framer-motion') || id.includes('popmotion') || id.includes('style-value-types')) return 'motion'
          if (id.includes('react-router')) return 'router'
          if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('scheduler')) return 'react'
          return 'vendor'
        },
      },
    },
    chunkSizeWarningLimit: 600,
    // Terser squeezes noticeably more out of this bundle than esbuild does, and
    // build time is not the constraint here — first paint on a slow phone is.
    minify: 'terser',
    terserOptions: {
      compress: { drop_console: true, drop_debugger: true, passes: 2 },
    },
    cssCodeSplit: true,
    reportCompressedSize: false,
  },
  }
})
