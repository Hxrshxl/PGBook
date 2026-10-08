import { formatCurrency, formatMonth, formatDate, PAYMENT_METHOD_LABELS } from './helpers.js'

export const ADMIN_ROLE_LABELS = {
  super_admin: 'Super Admin',
  billing_admin: 'Billing Admin',
  support_agent: 'Support Agent',
  compliance_officer: 'Compliance Officer',
  analyst: 'Analyst',
}

const FIELD_LABELS = {
  pgName: 'PG name', address: 'address', ownerName: 'owner name', phone: 'phone', upiId: 'UPI ID', logoText: 'receipt heading',
  totalBeds: 'total beds', rentDueDay: 'rent due day', name: 'name', email: 'email', room: 'room', rentAmount: 'rent',
  depositAmount: 'deposit', moveInDate: 'move-in date', idType: 'ID type', idNumber: 'ID number',
  emergencyContact: 'emergency contact', notes: 'notes', status: 'status', priority: 'priority', ownerNotes: 'notes', category: 'category',
}

const fieldList = fields => (fields ?? []).map(f => FIELD_LABELS[f] ?? f).join(', ')
const money = n => (n === undefined || n === null ? '' : formatCurrency(n))
const forWho = e => (e.target?.label ? ` for ${e.target.label}` : '')
const monthOf = d => (d?.month ? ` — ${formatMonth(d.month)}` : '')

/**
 * One-line, human description of an audit event. Works for both the owner's
 * full view and the admin's redacted view (missing labels/details are skipped).
 */
export function describeEvent(e) {
  const d = e.details ?? {}
  switch (e.action) {
    // Account & security
    case 'org.signup': return 'Created the PGBook account'
    case 'auth.login': return 'Signed in'
    case 'auth.login_failed': return 'Failed sign-in attempt (wrong password)'
    case 'auth.login_blocked': return 'Sign-in blocked — account suspended'
    case 'auth.password_changed': return 'Changed password (other devices signed out)'
    case 'account.profile_updated': return `Updated profile${d.fields ? ` (${fieldList(d.fields)})` : ''}`
    case 'settings.update': return `Updated settings${d.fields ? `: ${fieldList(d.fields)}` : ''}`
    case 'settings.payout_upi_changed': return d.to !== undefined ? `Changed payout UPI ID from "${d.from || 'none'}" to "${d.to || 'none'}"` : 'Changed payout UPI ID'

    // Tenants
    case 'tenant.create': return `Added tenant${e.target?.label ? ` ${e.target.label}` : ''}${d.rent !== undefined ? ` at ${money(d.rent)}/month` : ''}`
    case 'tenant.update':
      return d.rentFrom !== undefined
        ? `Changed rent${forWho(e)}: ${money(d.rentFrom)} → ${money(d.rentTo)}`
        : `Edited tenant details${forWho(e)}${d.fields ? ` (${fieldList(d.fields)})` : ''}`
    case 'tenant.vacate': return `Marked${e.target?.label ? ` ${e.target.label}` : ' a tenant'} as vacated${d.moveOutDate ? ` on ${formatDate(d.moveOutDate)}` : ''}`
    case 'tenant.restore': return `Restored${e.target?.label ? ` ${e.target.label}` : ' a tenant'} to active`
    case 'tenant.delete': return `Permanently deleted tenant${e.target?.label ? ` ${e.target.label}` : ''}${d.duesDeleted !== undefined ? ` (and ${d.duesDeleted} dues records)` : ''}`

    // Money
    case 'dues.create': return `Created dues${forWho(e)}${monthOf(d)}`
    case 'dues.generate': return `Generated dues${d.count ? ` for ${d.count} tenant(s)` : ''}${monthOf(d)}`
    case 'dues.adjust':
      return d.rentFrom !== undefined && d.rentFrom !== d.rentTo
        ? `Adjusted rent due${forWho(e)}${monthOf(d)}: ${money(d.rentFrom)} → ${money(d.rentTo)}`
        : `Updated dues notes${forWho(e)}${monthOf(d)}`
    case 'dues.delete': return `Deleted dues${forWho(e)}${monthOf(d)}`
    case 'payment.record':
      return d.amount !== undefined
        ? `Recorded ${money(d.amount)}${d.method ? ` (${PAYMENT_METHOD_LABELS[d.method] ?? d.method})` : ''}${e.target?.label ? ` from ${e.target.label}` : ''}${monthOf(d)}`
        : 'Recorded a payment'
    case 'payment.remove': return d.amount !== undefined ? `Removed a ${money(d.amount)} payment entry${forWho(e)}${monthOf(d)}` : 'Removed a payment entry'
    case 'bill.create': return d.amount !== undefined ? `Added ${d.type} bill of ${money(d.amount)}${monthOf(d)}, split ${d.tenantCount} ways` : 'Added a utility bill'
    case 'bill.delete': return d.amount !== undefined ? `Deleted ${d.type} bill of ${money(d.amount)}${monthOf(d)}` : 'Deleted a utility bill'

    // Complaints
    case 'complaint.create': return `Logged a complaint${forWho(e)}${d.category ? ` (${d.category})` : ''}`
    case 'complaint.update': return d.statusTo ? `Moved complaint${forWho(e)} to ${d.statusTo.replace('-', ' ')}` : `Updated complaint${forWho(e)}`
    case 'complaint.delete': return `Deleted a complaint${forWho(e)}`

    // PGBook staff actions on an owner account
    case 'org.suspended': return 'Suspended the account'
    case 'org.reactivated': return 'Reactivated the account'
    case 'org.force_logout': return 'Signed out all sessions on the account'
    case 'org.trial_extended': return `Extended the free trial by ${d.days} day(s)${d.to ? ` (now ends ${formatDate(d.to)})` : ''}`

    // Admin console
    case 'admin.login': return 'Signed in to the admin console'
    case 'admin.logout': return 'Signed out of the admin console'
    case 'admin.login_failed': return `Failed admin sign-in (${d.stage ?? 'password'})`
    case 'admin.locked': return 'Admin account locked after repeated failed attempts'
    case 'admin.login_blocked': return 'Admin sign-in blocked — account disabled'
    case 'admin.2fa_enrolled': return 'Set up two-factor authentication'
    case 'admin.step_up': return 'Re-verified with 2FA'
    case 'admin.step_up_failed': return 'Failed 2FA re-verification'
    case 'admin.password_changed': return 'Changed admin password'
    case 'admin.invited': return `Invited ${e.target?.label ?? 'an admin'} as ${ADMIN_ROLE_LABELS[d.role] ?? d.role}`
    case 'admin.invite_accepted': return 'Accepted admin invite'
    case 'admin.invite_link_issued': return `Issued a new invite link for ${e.target?.label ?? 'an admin'}`
    case 'admin.role_changed': return `Changed ${e.target?.label ?? 'an admin'}'s role: ${ADMIN_ROLE_LABELS[d.from] ?? d.from} → ${ADMIN_ROLE_LABELS[d.to] ?? d.to}`
    case 'admin.disabled': return `Disabled ${e.target?.label ?? 'an admin'}`
    case 'admin.enabled': return `Re-enabled ${e.target?.label ?? 'an admin'}`
    case 'admin.2fa_reset': return `Reset 2FA for ${e.target?.label ?? 'an admin'}`
    case 'admin.created_via_cli': return `Created ${e.target?.label ?? 'an admin'} via server CLI`
    case 'admin.2fa_reset_via_cli': return `Reset 2FA for ${e.target?.label ?? 'an admin'} via server CLI`
    case 'admin.password_reset_via_cli': return `Reset password for ${e.target?.label ?? 'an admin'} via server CLI`
    case 'admin.unlocked_via_cli': return `Unlocked ${e.target?.label ?? 'an admin'} via server CLI`
    case 'audit.exported': return `Exported ${d.rows ?? ''} audit events`
    case 'approval.requested': return `Requested approval: ${e.target?.label ?? ''}`
    case 'approval.approved': return `Approved: ${e.target?.label ?? ''}`
    case 'approval.rejected': return `Rejected: ${e.target?.label ?? ''}`
    case 'approval.cancelled': return `Withdrew request: ${e.target?.label ?? ''}`
    case 'approval.failed': return `Approved but could not apply: ${e.target?.label ?? ''}`
    default: return e.action
  }
}

export function eventCategory(action) {
  if (/^(payment|dues|bill)\./.test(action)) return 'money'
  if (/^(tenant|complaint)\./.test(action)) return 'tenants'
  if (/^org\.(suspended|reactivated|force_logout|trial_extended)/.test(action)) return 'pgbook'
  if (/^(admin|approval|audit)\./.test(action)) return 'admin'
  return 'security'
}

/** Short device description from a user-agent string. */
export function deviceLabel(userAgent) {
  if (!userAgent) return ''
  if (userAgent.startsWith('cli')) return 'Server CLI'
  const browser = /Edg\//.test(userAgent) ? 'Edge' : /Chrome\//.test(userAgent) ? 'Chrome' : /Firefox\//.test(userAgent) ? 'Firefox' : /Safari\//.test(userAgent) ? 'Safari' : /node|undici/i.test(userAgent) ? 'API client' : 'Browser'
  const os = /Windows/.test(userAgent) ? 'Windows' : /Android/.test(userAgent) ? 'Android' : /iPhone|iPad/.test(userAgent) ? 'iOS' : /Mac OS/.test(userAgent) ? 'macOS' : /Linux/.test(userAgent) ? 'Linux' : ''
  return os ? `${browser} on ${os}` : browser
}
