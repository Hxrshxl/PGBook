import Tenant from './models/Tenant.js'

// How records are labelled in the owner's activity log.
export const tenantTarget = t => ({ kind: 'tenant', id: String(t._id), label: `${t.name} (Room ${t.room})` })

export async function paymentTarget(payment) {
  const tenant = await Tenant.findById(payment.tenantId).select('name room')
  return { kind: 'payment', id: String(payment._id), label: tenant ? `${tenant.name} (Room ${tenant.room})` : 'Deleted tenant' }
}

export const billTarget = b => ({ kind: 'bill', id: String(b._id), label: `${b.type} bill` })

export const complaintTarget = c => ({ kind: 'complaint', id: String(c._id), label: `${c.tenantName} (Room ${c.room})` })
