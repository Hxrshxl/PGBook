import { route, readJson, json, pick } from '@/lib/api'

const SETTINGS_FIELDS = ['pgName', 'address', 'ownerName', 'phone', 'upiId', 'logoText', 'totalBeds', 'rentDueDay']

export const GET = route(async ({ user }) => json(user.pgSettings ?? {}), { permission: 'settings.view' })

// Partial update: only the fields sent are changed.
export const PUT = route(async ({ request, user, audit }) => {
  const body = await readJson(request)
  const before = user.pgSettings?.toObject?.() ?? {}
  for (const [key, value] of Object.entries(pick(body, SETTINGS_FIELDS))) {
    user.set(`pgSettings.${key}`, value)
  }
  await user.save()

  const after = user.pgSettings.toObject()
  const fields = SETTINGS_FIELDS.filter(k => before[k] !== after[k])
  if (fields.length) await audit('settings.update', { target: { kind: 'settings', label: 'PG settings' }, details: { fields } })
  // The UPI ID is where tenants send rent — changing it is the classic account-takeover fraud,
  // so it gets its own security event (shown to the owner and to PGBook Trust & Safety).
  if (fields.includes('upiId')) {
    await audit('settings.payout_upi_changed', { target: { kind: 'settings', label: 'Payout UPI ID' }, details: { from: before.upiId ?? '', to: after.upiId } })
  }
  return json(user.pgSettings)
}, { permission: 'settings.manage' })
