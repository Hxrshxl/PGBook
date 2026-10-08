import { pick } from './api'

const TENANT_FIELDS = ['name', 'phone', 'email', 'room', 'rentAmount', 'depositAmount', 'moveInDate', 'idType', 'idNumber', 'notes']

/** Whitelists the tenant fields a client may set (never userId, status, _id…). */
export function tenantInput(body) {
  const data = pick(body, TENANT_FIELDS)
  if (body.emergencyContact && typeof body.emergencyContact === 'object') {
    data.emergencyContact = pick(body.emergencyContact, ['name', 'phone', 'relation'])
  }
  return data
}
