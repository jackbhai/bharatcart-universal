import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Tabs } from '../../ui/primitives/Display.jsx'
import ProductsTab from './ProductsTab.jsx'
import CategoriesTab from './CategoriesTab.jsx'
import CollectionsTab from './CollectionsTab.jsx'
import InventoryTab from './InventoryTab.jsx'
import PricingTab from './PricingTab.jsx'

const TABS = [
  { id: 'products', label: 'Products', icon: '◫' },
  { id: 'categories', label: 'Categories', icon: '⊞' },
  { id: 'collections', label: 'Collections', icon: '✦' },
  { id: 'inventory', label: 'Inventory', icon: '▤' },
  { id: 'pricing', label: 'Price lists', icon: '₹' },
]

export default function Catalogue() {
  const [tab, setTab] = useState('products')
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--c-text)' }}>Catalogue</h1>
        <p className="text-[12.5px]" style={{ color: 'var(--c-text-muted)' }}>
          Products, variants, stock, categories and pricing — everything that powers the storefront.
        </p>
      </div>
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          transition={{ duration: .18 }}>
          {tab === 'products' && <ProductsTab />}
          {tab === 'categories' && <CategoriesTab />}
          {tab === 'collections' && <CollectionsTab />}
          {tab === 'inventory' && <InventoryTab />}
          {tab === 'pricing' && <PricingTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
