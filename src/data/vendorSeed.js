// ---------------------------------------------------------------
// Demo data removed. This module intentionally exports EMPTY datasets —
// the app boots with zero vendors, zero purchase orders and zero
// warehouses. Merchants add their own via the admin panel.
//
// Kept (not demo data): VENDOR_STATUS, PO_STATUS and PAYMENT_TERMS are
// small enum constants used to populate dropdowns.
// ---------------------------------------------------------------

export const VENDOR_STATUS = ['Active', 'On hold', 'Onboarding']
export const PO_STATUS = ['Draft', 'Sent', 'Acknowledged', 'Partially received', 'Received', 'Cancelled']
export const PAYMENT_TERMS = ['Net 15', 'Net 30', 'Net 45', 'Advance 50%', 'On delivery']

export const VENDORS = []
export const VENDOR_BY_ID = {}
export const PRODUCT_VENDOR = {}
export const PURCHASE_ORDERS = []
export const WAREHOUSES = []
export const STOCK_BY_WAREHOUSE = {}
export const STOCK_MOVEMENTS = []
