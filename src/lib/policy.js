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

// Organization capabilities. Only the owner exists today; staff roles
// (manager, accountant, caretaker) slot in here in Phase 3.
const ORG_CAPABILITIES = {
  owner: ['*'],
}

export const LIMITS = {
  supportTrialExtensionDays: 14,
  maxTrialExtensionDays: 90,
}

/** actor: { realm: 'admin' | 'org' | 'resident', role } */
export function can(actor, capability) {
  if (!actor) return false
  const table = actor.realm === 'admin' ? ADMIN_CAPABILITIES : actor.realm === 'org' ? ORG_CAPABILITIES : {}
  const granted = table[actor.role] ?? []
  return granted.includes('*') || granted.includes(capability)
}

export function capabilitiesFor(actor) {
  const table = actor.realm === 'admin' ? ADMIN_CAPABILITIES : ORG_CAPABILITIES
  return [...(table[actor.role] ?? [])]
}

export function maxTrialExtension(actor) {
  if (!can(actor, 'orgs.extendTrial')) return 0
  return actor.role === 'support_agent' ? LIMITS.supportTrialExtensionDays : LIMITS.maxTrialExtensionDays
}
