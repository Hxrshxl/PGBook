// Which capability each dashboard page needs. Settings is open to every role
// (everyone can manage their own account there).
export const ROUTE_CAPABILITIES = [
  ['/dashboard/approvals', 'approvals.view'],
  ['/dashboard/tenants', 'tenants.view'],
  ['/dashboard/rooms', 'rooms.view'],
  ['/dashboard/rent', 'rent.view'],
  ['/dashboard/utilities', 'bills.view'],
  ['/dashboard/expenses', 'expenses.view'],
  ['/dashboard/receipts', 'rent.view'],
  ['/dashboard/reminders', 'rent.view'],
  ['/dashboard/complaints', 'complaints.view'],
  ['/dashboard/analytics', 'reports.view'],
  ['/dashboard/history', 'tenants.view'],
  ['/dashboard/team', 'team.manage'],
  ['/dashboard/billing', 'billing.manage'],
  ['/dashboard/notices', 'notices.view'],
  ['/dashboard/deposits', 'deposits.view'],
  ['/dashboard/activity', 'activity.view'],
]

export function capabilityFor(pathname) {
  return ROUTE_CAPABILITIES.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.[1] ?? null
}
