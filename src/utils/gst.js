// GST basics shared by the server (invoices) and the browser (billing form).

export const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

// State / union-territory codes used in GSTINs and for the place of supply.
export const GST_STATES = [
  ['01', 'Jammu & Kashmir'], ['02', 'Himachal Pradesh'], ['03', 'Punjab'], ['04', 'Chandigarh'], ['05', 'Uttarakhand'],
  ['06', 'Haryana'], ['07', 'Delhi'], ['08', 'Rajasthan'], ['09', 'Uttar Pradesh'], ['10', 'Bihar'], ['11', 'Sikkim'],
  ['12', 'Arunachal Pradesh'], ['13', 'Nagaland'], ['14', 'Manipur'], ['15', 'Mizoram'], ['16', 'Tripura'], ['17', 'Meghalaya'],
  ['18', 'Assam'], ['19', 'West Bengal'], ['20', 'Jharkhand'], ['21', 'Odisha'], ['22', 'Chhattisgarh'], ['23', 'Madhya Pradesh'],
  ['24', 'Gujarat'], ['26', 'Dadra & Nagar Haveli and Daman & Diu'], ['27', 'Maharashtra'], ['29', 'Karnataka'], ['30', 'Goa'],
  ['31', 'Lakshadweep'], ['32', 'Kerala'], ['33', 'Tamil Nadu'], ['34', 'Puducherry'], ['35', 'Andaman & Nicobar Islands'],
  ['36', 'Telangana'], ['37', 'Andhra Pradesh'], ['38', 'Ladakh'],
]
export const GST_STATE_NAMES = Object.fromEntries(GST_STATES)

const round2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100

/**
 * Splits a GST-inclusive amount. Same state → CGST + SGST, otherwise IGST.
 * A seller without a GSTIN can't charge GST, so everything is the taxable value.
 */
export function gstBreakup(total, { sellerGstin, sellerState, buyerState, rate = 18 }) {
  const amount = round2(total)
  if (!sellerGstin || !(rate > 0)) return { taxable: amount, cgst: 0, sgst: 0, igst: 0, rate: 0, total: amount }
  const taxable = round2((amount * 100) / (100 + rate))
  const tax = round2(amount - taxable)
  if (buyerState && buyerState === sellerState) {
    const cgst = round2(tax / 2)
    return { taxable, cgst, sgst: round2(tax - cgst), igst: 0, rate, total: amount }
  }
  return { taxable, cgst: 0, sgst: 0, igst: tax, rate, total: amount }
}

/** Indian financial year of a date, e.g. 2026-10-09 → "2026-27". */
export function financialYear(date) {
  const d = new Date(date)
  const ist = new Date(d.getTime() + 330 * 60000) // IST, so 31 March 23:00 IST is still the old year
  const y = ist.getUTCFullYear()
  const start = ist.getUTCMonth() >= 3 ? y : y - 1
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`
}
