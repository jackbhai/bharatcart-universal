// ---------------------------------------------------------------
// Demo data removed. This module intentionally exports EMPTY datasets
// so the app boots with zero products, zero orders, zero customers,
// zero tickets, zero carts and zero coupons.
//
// Kept (not demo data):
//   NOW     — current timestamp, used by engines for new records.
//   STATES  — static India geography reference used by address forms.
// ---------------------------------------------------------------

export const NOW = Date.now()

export const STATES = [
  { state: 'Maharashtra', code: 'MH', zone: 'West', cities: ['Mumbai', 'Pune', 'Nagpur', 'Nashik'], tier: [1, 1, 2, 2], gst: '27' },
  { state: 'Delhi', code: 'DL', zone: 'North', cities: ['New Delhi', 'Dwarka', 'Rohini'], tier: [1, 1, 1], gst: '07' },
  { state: 'Karnataka', code: 'KA', zone: 'South', cities: ['Bengaluru', 'Mysuru', 'Hubballi'], tier: [1, 2, 3], gst: '29' },
  { state: 'Tamil Nadu', code: 'TN', zone: 'South', cities: ['Chennai', 'Coimbatore', 'Madurai'], tier: [1, 2, 2], gst: '33' },
  { state: 'Telangana', code: 'TG', zone: 'South', cities: ['Hyderabad', 'Warangal'], tier: [1, 3], gst: '36' },
  { state: 'Gujarat', code: 'GJ', zone: 'West', cities: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot'], tier: [1, 2, 2, 3], gst: '24' },
  { state: 'West Bengal', code: 'WB', zone: 'East', cities: ['Kolkata', 'Siliguri', 'Durgapur'], tier: [1, 3, 3], gst: '19' },
  { state: 'Uttar Pradesh', code: 'UP', zone: 'North', cities: ['Lucknow', 'Noida', 'Kanpur', 'Varanasi'], tier: [2, 1, 2, 3], gst: '09' },
  { state: 'Rajasthan', code: 'RJ', zone: 'North', cities: ['Jaipur', 'Jodhpur', 'Udaipur'], tier: [2, 3, 3], gst: '08' },
  { state: 'Punjab', code: 'PB', zone: 'North', cities: ['Ludhiana', 'Amritsar', 'Chandigarh'], tier: [2, 2, 2], gst: '03' },
  { state: 'Kerala', code: 'KL', zone: 'South', cities: ['Kochi', 'Thiruvananthapuram', 'Kozhikode'], tier: [2, 2, 3], gst: '32' },
  { state: 'Madhya Pradesh', code: 'MP', zone: 'Central', cities: ['Indore', 'Bhopal', 'Jabalpur'], tier: [2, 2, 3], gst: '23' },
]

// --- Demo datasets: all empty. The store starts clean. ---
export const PRODUCTS = []
export const CUSTOMERS = []
export const ORDERS = []
export const ORDERS_BY_CUSTOMER = {}
export const eventsFor = () => []
export const CARTS = []
export const TICKETS = []
export const COUPONS = []
export const CATEGORIES = []
