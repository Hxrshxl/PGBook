// Who may do what. Every permission check in the API goes through can().
// See docs/ROLES_AND_DASHBOARDS.md for the reasoning behind each role.

export const ADMIN_ROLES = {
  super_admin:        'Super Admin',
  billing_admin:      'Billing Admin',
  support_agent:      'Support Agent',
  compliance_officer: 'Compliance Officer',
  analyst:            'Analyst',
}

export const ADMIN_ROLE_DESCRIPTIONS = {
  super_admin:        'Everything, but dangerous changes still need a second Super Admin.',
  billing_admin:      'Plans, trials, suspensions for non-payment.',
  support_agent:      'Helps owners: view accounts, extend trials up to 14 days, sign out sessions. Suspensions need approval.',
  compliance_officer: 'Privacy and legal: audit log, exports, suspensions.',
  analyst:            'Platform-wide numbers only. No account details.',
}

// Platform capabilities
const ADMIN_CAPABILITIES = {
  super_admin: [
    'platform.view', 'orgs.view', 'orgs.extendTrial', 'orgs.forceLogout', 'orgs.suspend', 'orgs.reactivate',
    'audit.view', 'audit.export', 'admins.view', 'admins.request', 'approvals.view',
  ],
  billing_admin: [
    'platform.view', 'orgs.view', 'orgs.extendTrial', 'orgs.suspend', 'orgs.reactivate', 'audit.view', 'approvals.view',
  ],
  support_agent: [
    'platform.view', 'orgs.view', 'orgs.extendTrial', 'orgs.forceLogout',
    'orgs.requestSuspend', 'orgs.requestReactivate', 'audit.view', 'approvals.view',
  ],
  compliance_officer: [
    'platform.view', 'orgs.view', 'orgs.forceLogout', 'orgs.suspend', 'orgs.reactivate',
    'audit.view', 'audit.export', 'admins.view', 'approvals.view',
  ],
  analyst: ['platform.view'],
}

export const ORG_ROLES = {
  owner:      'Owner',
  manager:    'Manager',
  accountant: 'Accountant',
  caretaker:  'Caretaker',
}

export const ORG_ROLE_DESCRIPTIONS = {
  manager:    'Runs day-to-day operations: tenants, rooms, rent, bills, expenses, complaints. Removing payments and large dues changes need your approval.',
  accountant: 'Money only: rent, payments, bills, expenses and reports. Cannot see ID documents or manage tenants. Corrections need your approval.',
  caretaker:  'On-site warden: tenant list, rooms, complaints. Collects cash, which you or an accountant confirm before it counts.',
}

// Organization capabilities (owner and staff). Deliberately no '*' wildcard:
// a wildcard would also match platform capabilities like 'orgs.suspend'.
const ORG_STAFF_CAPABILITIES = {
  manager: [
    'dashboard.view', 'tenants.view', 'tenants.manage', 'tenants.kyc', 'rooms.view', 'rooms.manage',
    'rent.view', 'rent.manage', 'rent.record', 'rent.adjust', 'rent.requestRemoveEntry', 'rent.lateFees',
    'cash.confirm', 'bills.view', 'bills.manage', 'expenses.view', 'expenses.manage',
    'complaints.view', 'complaints.manage', 'reports.view', 'settings.view', 'activity.view', 'approvals.view',
  ],
  accountant: [
    'dashboard.view', 'tenants.view', 'rooms.view', 'rent.view', 'rent.manage', 'rent.record',
    'rent.requestAdjust', 'rent.requestRemoveEntry', 'rent.lateFees', 'cash.confirm',
    'bills.view', 'bills.manage', 'expenses.view', 'expenses.manage', 'reports.view', 'settings.view', 'approvals.view',
  ],
  caretaker: [
    'dashboard.view', 'tenants.view', 'rooms.view', 'rent.view', 'cash.collect',
    'complaints.view', 'complaints.manage', 'settings.view', 'approvals.view',
  ],
}

// Only the owner can do these.
const OWNER_ONLY_CAPABILITIES = [
  'tenants.delete', 'rent.removeEntry', 'rent.adjustAny', 'team.manage', 'properties.manage',
  'settings.manage', 'approvals.decide', 'data.export',
]

const ORG_CAPABILITIES = {
  owner: [...new Set([...Object.values(ORG_STAFF_CAPABILITIES).flat(), ...OWNER_ONLY_CAPABILITIES])],
  ...ORG_STAFF_CAPABILITIES,
}

export const LIMITS = {
  supportTrialExtensionDays: 14,
  maxTrialExtensionDays: 90,
  managerAdjustLimit: 1000, // ₹ a manager may change a month's dues by without owner approval
}

/** actor: { realm: 'admin' | 'org' | 'resident', role } */
export function can(actor, capability) {
  if (!actor) return false
  const table = actor.realm === 'admin' ? ADMIN_CAPABILITIES : actor.realm === 'org' ? ORG_CAPABILITIES : {}
  const granted = table[actor.role] ?? []
  return granted.includes(capability)
}

export function capabilitiesFor(actor) {
  const table = actor.realm === 'admin' ? ADMIN_CAPABILITIES : ORG_CAPABILITIES
  return [...(table[actor.role] ?? [])]
}

export function maxTrialExtension(actor) {
  if (!can(actor, 'orgs.extendTrial')) return 0
  return actor.role === 'support_agent' ? LIMITS.supportTrialExtensionDays : LIMITS.maxTrialExtensionDays
}
