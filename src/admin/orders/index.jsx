import React from 'react'
import OrdersList from './OrdersList.jsx'

export default function Orders() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--c-text)' }}>Orders</h1>
        <p className="text-[12.5px]" style={{ color: 'var(--c-text-muted)' }}>
          Every order with its true profit, risk score and the only status moves that are actually legal.
        </p>
      </div>
      <OrdersList />
    </div>
  )
}
