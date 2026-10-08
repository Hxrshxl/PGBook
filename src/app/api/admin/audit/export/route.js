import AuditEvent from '@/lib/models/AuditEvent'
import { adminRoute } from '@/lib/adminApi'
import { redactForAdmin } from '@/lib/audit'
import { auditFilter } from '@/lib/auditQuery'

const MAX_ROWS = 5000

// Quotes a CSV cell and neutralises spreadsheet formulas (=, +, -, @) so an
// exported value can never execute when the file is opened in Excel/Sheets.
function cell(value) {
  let text = value === null || value === undefined ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

export const GET = adminRoute(async ({ request, audit }) => {
  const params = new URL(request.url).searchParams
  const filter = auditFilter(params)
  const docs = await AuditEvent.find(filter).sort({ createdAt: -1, _id: -1 }).limit(MAX_ROWS)
  const rows = docs.map(redactForAdmin)

  await audit('audit.exported', {
    details: { rows: rows.length, filters: Object.fromEntries(params.entries()) },
  })

  const header = ['time', 'realm', 'actor', 'role', 'action', 'org_id', 'target_kind', 'target', 'reason', 'ip']
  const lines = [header.join(',')]
  for (const e of rows) {
    lines.push([
      new Date(e.createdAt).toISOString(), e.actor?.realm, e.actor?.name, e.actor?.role, e.action,
      e.orgId, e.target?.kind, e.target?.label, e.reason, e.ip,
    ].map(cell).join(','))
  }
  return new Response(lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="pgbook-audit-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}, { permission: 'audit.export', stepUp: true })
