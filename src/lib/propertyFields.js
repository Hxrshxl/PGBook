import { pick } from './api.js'
import { recordAudit } from './audit.js'

const PROPERTY_FIELDS = ['name', 'address', 'city', 'phone', 'ownerName', 'upiId', 'logoText', 'gstin', 'totalBeds', 'rentDueDay', 'noticePeriodDays']
const LATE_FEE_FIELDS = ['enabled', 'graceDays', 'type', 'amount', 'maxAmount']

/** Whitelists the property fields a client may set. */
export function propertyInput(body) {
  const data = pick(body ?? {}, PROPERTY_FIELDS)
  if (body?.lateFee && typeof body.lateFee === 'object') data.lateFee = pick(body.lateFee, LATE_FEE_FIELDS)
  return data
}

/**
 * Applies changes to a property and records them. A payout UPI ID change also
 * gets its own security event — it's where tenants send rent.
 */
export async function updateProperty(property, input, { actor, orgId, request }) {
  const before = property.toObject()
  const { lateFee, ...rest } = input
  property.set(rest)
  if (lateFee) for (const [k, v] of Object.entries(lateFee)) property.set(`lateFee.${k}`, v)
  await property.save()

  const after = property.toObject()
  const fields = PROPERTY_FIELDS.filter(k => String(before[k] ?? '') !== String(after[k] ?? ''))
  if (lateFee && LATE_FEE_FIELDS.some(k => before.lateFee?.[k] !== after.lateFee?.[k])) fields.push('lateFee')
  const target = { kind: 'property', id: property._id.toString(), label: property.name }
  if (fields.length) await recordAudit({ actor, action: 'settings.update', orgId, request, target, details: { fields } })
  if (fields.includes('upiId')) {
    await recordAudit({ actor, action: 'settings.payout_upi_changed', orgId, request, target, details: { from: before.upiId ?? '', to: after.upiId, property: property.name } })
  }
  return property
}

/** The old single-PG settings shape, kept for /api/settings compatibility. */
export function legacySettings(property) {
  return {
    pgName: property.name, address: property.address, ownerName: property.ownerName, phone: property.phone,
    upiId: property.upiId, logoText: property.logoText, totalBeds: property.totalBeds, rentDueDay: property.rentDueDay,
  }
}
