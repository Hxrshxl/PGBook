import { pick } from './api'

const TENANT_FIELDS = ['name', 'phone', 'email', 'rentAmount', 'depositAmount', 'moveInDate', 'idType', 'idNumber', 'notes']
const KYC_FIELDS = ['idType', 'idNumber']

/** Whitelists the tenant fields a client may set (never userId, status, propertyId, room…). */
export function tenantInput(body) {
  const data = pick(body, TENANT_FIELDS)
  if (body.emergencyContact && typeof body.emergencyContact === 'object') {
    data.emergencyContact = pick(body.emergencyContact, ['name', 'phone', 'relation'])
  }
  if (Array.isArray(body.recurringCharges)) {
    data.recurringCharges = body.recurringCharges
      .filter(c => c && typeof c === 'object' && String(c.label ?? '').trim())
      .map(c => ({ label: String(c.label).trim(), amount: Number(c.amount) }))
  }
  return data
}

/** Removes ID document details for roles that may not see them (accountant, caretaker). */
export function tenantView(tenant, canSeeKyc) {
  const json = typeof tenant.toJSON === 'function' ? tenant.toJSON() : { ...tenant }
  if (!canSeeKyc) for (const key of KYC_FIELDS) delete json[key]
  return json
}
