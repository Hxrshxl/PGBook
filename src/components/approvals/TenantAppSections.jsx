'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Image as ImageIcon, AlertTriangle } from 'lucide-react'
import { useAppData } from '@/context/AppContext'
import { useToast } from '@/context/ToastContext'
import { api } from '@/utils/api'
import { formatCurrency, formatDate, formatMonth, timeAgo, PAYMENT_METHOD_LABELS } from '@/utils/helpers'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import ReasonDialog from '@/components/ui/ReasonDialog'
import Panel from '@/components/ui/Panel'
import { button } from '@/components/ui/styles'

const act = { neutral: button('secondary', 'sm'), primary: button('primary', 'sm') }
const FLAG_TEXT = { duplicate_utr: 'This UTR was used before', over_balance: 'More than the balance due' }

function Section({ title, count, children }) {
  return <Panel title={title} count={count} className="mb-6">{children}</Panel>
}

/** Payment reports, move-out notices and deposit settlements from the tenant app. */
export default function TenantAppSections() {
  const { approvals, decideClaim, decideMoveOut, refreshApprovals } = useAppData()
  const { showToast } = useToast()
  const [approvingClaim, setApprovingClaim] = useState(null)
  const [rejectingClaim, setRejectingClaim] = useState(null)
  const [ackMove, setAckMove] = useState(null)
  const [declineMove, setDeclineMove] = useState(null)
  const [approvingSettlement, setApprovingSettlement] = useState(null)
  const [returningSettlement, setReturningSettlement] = useState(null)

  const claims = (approvals.claims ?? []).filter(c => c.status === 'pending')
  const moveOuts = (approvals.moveOuts ?? []).filter(m => m.status === 'pending')
  const settlements = approvals.settlements ?? []

  async function settle(id, action, note) {
    await api.post(`/settlements/${id}`, { action, note })
    await refreshApprovals()
  }

  return (
    <>
      {claims.length > 0 && (
        <Section title="Payments reported by tenants" count={claims.length}>
          <ul className="divide-y divide-slate-100">
            {claims.map(c => (
              <li key={c.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">{formatCurrency(c.amount)} from {c.tenantName} <span className="font-normal text-slate-500">· Room {c.room}</span></p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    For {formatMonth(c.month)} · paid {formatDate(c.date)} by {PAYMENT_METHOD_LABELS[c.method] ?? c.method}{c.utr ? ` · UTR ${c.utr}` : ''} · {timeAgo(c.createdAt)}
                  </p>
                  {c.note && <p className="text-xs text-slate-600 mt-0.5">“{c.note}”</p>}
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {c.flags.map(f => <span key={f} className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800"><AlertTriangle size={11} /> {FLAG_TEXT[f] ?? f}</span>)}
                    {c.screenshotId && <a href={`/api/files/${c.screenshotId}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"><ImageIcon size={11} /> Screenshot</a>}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setRejectingClaim(c)} className={act.neutral}>Not received</button>
                  <button onClick={() => setApprovingClaim(c)} className={act.primary}>Received</button>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {moveOuts.length > 0 && (
        <Section title="Move-out notices" count={moveOuts.length}>
          <ul className="divide-y divide-slate-100">
            {moveOuts.map(m => {
              const short = m.earliestDate && m.moveOutDate < m.earliestDate
              return (
                <li key={m.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">{m.tenantName} <span className="font-normal text-slate-500">· Room {m.room}</span> moves out {formatDate(m.moveOutDate)}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Given {timeAgo(m.createdAt)}{m.reason ? ` · “${m.reason}”` : ''}</p>
                    {short && <p className="text-[11px] text-amber-700 mt-1 flex items-center gap-1"><AlertTriangle size={11} /> Shorter than the notice period (earliest {formatDate(m.earliestDate)})</p>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => setDeclineMove(m)} className={act.neutral}>Decline</button>
                    <button onClick={() => setAckMove(m)} className={act.primary}>Acknowledge</button>
                  </div>
                </li>
              )
            })}
          </ul>
        </Section>
      )}

      {settlements.length > 0 && (
        <Section title="Deposit settlements to approve" count={settlements.length}>
          <ul className="divide-y divide-slate-100">
            {settlements.map(s => (
              <li key={s.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">{s.tenantName} <span className="font-normal text-slate-500">· Room {s.room} · moving out {formatDate(s.moveOutDate)}</span></p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Deposit {formatCurrency(s.deposit)} − dues {formatCurrency(s.unpaidDues.reduce((t, d) => t + d.amount, 0))} − deductions {formatCurrency(s.deductions.reduce((t, d) => t + d.amount, 0))} = <strong className="text-slate-900">{s.refundAmount >= 0 ? `refund ${formatCurrency(s.refundAmount)}` : `tenant owes ${formatCurrency(-s.refundAmount)}`}</strong>
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">Prepared by {s.preparedBy?.name} · <Link href="/dashboard/deposits" className="text-indigo-600 hover:text-indigo-500">Open in Deposits</Link></p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => setReturningSettlement(s)} className={act.neutral}>Send back</button>
                  <button onClick={() => setApprovingSettlement(s)} className={act.primary}>Approve & share</button>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <ConfirmDialog
        isOpen={!!approvingClaim}
        tone="primary"
        title="Confirm you received this payment?"
        message={approvingClaim ? <>Check your bank/UPI app for <strong>{formatCurrency(approvingClaim.amount)}</strong>{approvingClaim.utr ? <> with UTR <strong>{approvingClaim.utr}</strong></> : ''}. It will be recorded for {approvingClaim.tenantName} ({formatMonth(approvingClaim.month)}) and their receipt becomes available.</> : ''}
        confirmLabel="Yes, received"
        onConfirm={async () => { await decideClaim(approvingClaim.id, 'approve'); showToast('Payment recorded.'); setApprovingClaim(null) }}
        onCancel={() => setApprovingClaim(null)}
      />
      <ReasonDialog
        isOpen={!!rejectingClaim}
        title="Payment not received"
        description={rejectingClaim ? `${formatCurrency(rejectingClaim.amount)} reported by ${rejectingClaim.tenantName}.` : ''}
        tone="danger"
        confirmLabel="Reject"
        reasonLabel="Tell the tenant why"
        reasonHint="e.g. No payment with this UTR in my account. The tenant sees this."
        onSubmit={async ({ reason }) => { await decideClaim(rejectingClaim.id, 'reject', reason); showToast('Payment report rejected.', 'warning'); setRejectingClaim(null); return true }}
        onClose={() => setRejectingClaim(null)}
      />
      <ConfirmDialog
        isOpen={!!ackMove}
        tone="primary"
        title="Acknowledge move-out?"
        message={ackMove ? `${ackMove.tenantName} will be marked as on notice, moving out ${formatDate(ackMove.moveOutDate)}. They can no longer withdraw it in the app.` : ''}
        confirmLabel="Acknowledge"
        onConfirm={async () => { await decideMoveOut(ackMove.id, 'acknowledge'); showToast('Move-out acknowledged.'); setAckMove(null) }}
        onCancel={() => setAckMove(null)}
      />
      <ReasonDialog
        isOpen={!!declineMove}
        title="Decline move-out notice"
        description={declineMove ? `${declineMove.tenantName} — ${formatDate(declineMove.moveOutDate)}` : ''}
        tone="danger"
        confirmLabel="Decline"
        reasonLabel="Tell the tenant why"
        onSubmit={async ({ reason }) => { await decideMoveOut(declineMove.id, 'decline', reason); showToast('Notice declined.', 'warning'); setDeclineMove(null); return true }}
        onClose={() => setDeclineMove(null)}
      />
      <ConfirmDialog
        isOpen={!!approvingSettlement}
        tone="primary"
        title="Approve and share with the tenant?"
        message={approvingSettlement ? `${approvingSettlement.tenantName} will see it in the app and can accept or dispute it. You record the refund once you've paid it.` : ''}
        confirmLabel="Approve & share"
        onConfirm={async () => { await settle(approvingSettlement.id, 'approve'); showToast('Settlement shared with the tenant.'); setApprovingSettlement(null) }}
        onCancel={() => setApprovingSettlement(null)}
      />
      <ReasonDialog
        isOpen={!!returningSettlement}
        title="Send back to draft"
        description={returningSettlement?.tenantName}
        confirmLabel="Send back"
        reasonLabel="What needs changing?"
        onSubmit={async ({ reason }) => { await settle(returningSettlement.id, 'return', reason); showToast('Sent back.'); setReturningSettlement(null); return true }}
        onClose={() => setReturningSettlement(null)}
      />
    </>
  )
}
