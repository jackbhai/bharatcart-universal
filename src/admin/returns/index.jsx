import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Tabs } from '../../ui/primitives/Display.jsx'
import ReturnsList from './ReturnsList.jsx'
import ReturnsAnalytics from './ReturnsAnalytics.jsx'
import ReturnPolicy from './ReturnPolicy.jsx'

const TABS = [
  { id: 'queue', label: 'RMA queue', icon: '↩' },
  { id: 'analytics', label: 'Analytics', icon: '◲' },
  { id: 'policy', label: 'Policy', icon: '⚙' },
]

export default function Returns() {
  const [tab, setTab] = useState('queue')
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--c-text)' }}>Returns &amp; refunds</h1>
        <p className="text-[12.5px]" style={{ color: 'var(--c-text-muted)' }}>
          Every RMA from request to refund, plus the analytics that tell you which products to fix.
        </p>
      </div>
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          transition={{ duration: .18 }}>
          {tab === 'queue' && <ReturnsList />}
          {tab === 'analytics' && <ReturnsAnalytics />}
          {tab === 'policy' && <ReturnPolicy />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
