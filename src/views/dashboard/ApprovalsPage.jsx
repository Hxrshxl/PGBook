'use client'
import { useState } from 'react'
import { Inbox, Clock } from 'lucide-react'
import { useAppData } from '@/context/AppContext'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { formatCurrency, formatCurrencyRounded, formatDate, formatMonth, timeAgo } from '@/utils/helpers'
import EmptyState from '@/components/ui/EmptyState'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import ReasonDialog from '@/components/ui/ReasonDialog'
import TenantAppSections from '@/components/approvals/TenantAppSections'
import Badge from '@/components/ui/Badge'
import PageHeader from '@/components/ui/PageHeader'
import Panel from '@/components/ui/Panel'
import Tabs from '@/components/ui/Tabs'
import { button, page } from '@/components/ui/styles'

const KIND_LABEL = { cash: 'Cash handover', claim: 'Payment report', moveout: 'Move-out notice', request: 'Staff request' }

function Section({ title, count, children }) {
  return <Panel title={title} count={count} className="mb-6">{children}</Panel>
}

const act = { neutral: button('secondary', 'sm'), primary: button('primary', 'sm') }

export default function ApprovalsPage() {
  const { approvals, cash, decideApproval, cancelApproval, decideCash } = useAppData()
  const { user, can, access } = useAuth()
  const { showToast } = useToast()
  const [tab, setTab] = useState('waiting')
  const [approving, setApproving] = useState(null)
  const [rejecting, setRejecting] = useState(null)
  const [cancelling, setCancelling] = useState(null)
  const [confirmingCash, setConfirmingCash] = useState(null)
  const [rejectingCash, setRejectingCash] = useState(null)

  const isOwner = can('approvals.decide')
  const canConfirmCash = can('cash.confirm')
  const requests = approvals.requests ?? []
  const pendingRequests = requests.filter(r => r.status === 'pending')
  const pendingCash = cash.filter(c => c.status === 'pending')
  const pendingCashTotal = pendingCash.reduce((s, c) => s + c.amount, 0)
  const tenantAppWaiting = (approvals.counts?.claims ?? 0) + (approvals.counts?.moveOuts ?? 0) + (approvals.counts?.settlements ?? 0)
  const waitingTotal = pendingRequests.length + pendingCash.length + tenantAppWaiting

  const history = [
    ...requests.filter(r => r.status !== 'pending').map(r => ({ kind: 'request', at: r.decidedAt ?? r.updatedAt, item: r })),
    ...cash.filter(c => c.status !== 'pending').map(c => ({ kind: 'cash', at: c.decidedAt ?? c.updatedAt, item: c })),
    ...(approvals.claims ?? []).filter(c => c.status !== 'pending').map(c => ({ kind: 'claim', at: c.decidedAt ?? c.updatedAt, item: c })),
    ...(approvals.moveOuts ?? []).filter(m => m.status !== 'pending').map(m => ({ kind: 'moveout', at: m.decidedAt ?? m.updatedAt, item: m })),
  ].sort((a, b) => String(b.at).localeCompare(String(a.at)))

  async function handleApprove() {
    await decideApproval(approving.id, 'approve')
    showToast('Approved and applied.')
    setApproving(null)
  }
  async function handleReject({ reason }) {
    await decideApproval(rejecting.id, 'reject', reason)
    showToast('Request rejected.', 'warning')
    setRejecting(null)
    return true
  }
  async function handleCancel() {
    await cancelApproval(cancelling.id)
    showToast('Request withdrawn.')
    setCancelling(null)
  }
  async function handleConfirmCash() {
    await decideCash(confirmingCash.id, 'confirm')
    showToast(`${formatCurrency(confirmingCash.amount)} added to ${confirmingCash.tenantName}'s payments.`)
    setConfirmingCash(null)
  }
  async function handleRejectCash({ reason }) {
    await decideCash(rejectingCash.id, 'reject', reason)
    showToast('Cash handover rejected.', 'warning')
    setRejectingCash(null)
    return true
  }

  const subtitle = isOwner
    ? 'Staff requests, cash handovers and tenant reports that need you'
    : canConfirmCash
      ? 'Cash handovers to confirm, and the requests you sent to the owner'
      : 'Cash you collected and requests you sent to the owner'

  return (
    <div className={`${page} mx-auto max-w-4xl`}>
      <PageHeader title="Approvals" description={subtitle} />

      <Tabs className="mb-6" value={tab} onChange={setTab} tabs={[
        { key: 'waiting', label: 'Waiting', count: waitingTotal },
        { key: 'history', label: 'History' },
      ]} />

      {tab === 'waiting' && (
        <>
          <TenantAppSections />
          {waitingTotal === 0 && (
            <EmptyState icon={Inbox} title="Nothing waiting" message={isOwner ? 'When staff ask to change dues or remove a payment, or hand over cash, it shows up here.' : 'Requests you send and cash you log will show here until they are decided.'} />
          )}

          {pendingCash.length > 0 && (
            <Section title={`Cash handovers · ${formatCurrencyRounded(pendingCashTotal)} waiting`} count={pendingCash.length}>
              <ul className="divide-y divide-slate-100">
                {pendingCash.map(c => {
                  const mine = c.collectedBy?.id === user?.id
                  return (
                    <li key={c.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900">{formatCurrency(c.amount)} from {c.tenantName} <span className="font-normal text-slate-500">· Room {c.room}</span></p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          For {formatMonth(c.month)} · collected {formatDate(c.date)} by {mine ? 'you' : c.collectedBy?.name}{c.note ? ` · “${c.note}”` : ''}
                        </p>
                      </div>
                      {canConfirmCash && !mine ? (
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => setRejectingCash(c)} className={act.neutral}>Reject</button>
                          <button onClick={() => setConfirmingCash(c)} className={act.primary}>Confirm received</button>
                        </div>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs text-amber-700 shrink-0"><Clock size={13} /> Waiting for {mine ? 'someone else to confirm' : 'confirmation'}</span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </Section>
          )}

          {pendingRequests.length > 0 && (
            <Section title={isOwner ? 'Requests from your team' : 'Your requests'} count={pendingRequests.length}>
              <ul className="divide-y divide-slate-100">
                {pendingRequests.map(r => (
                  <li key={r.id} className="px-5 py-4">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-500">{r.typeLabel}</p>
                        <p className="text-sm font-medium text-slate-900 mt-0.5">{r.summary}</p>
                        <p className="text-sm text-slate-600 mt-1">“{r.reason}”</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {r.canCancel ? 'You asked' : `${r.requestedBy?.name} (${r.requestedBy?.role})`} · {timeAgo(r.createdAt)} · expires {formatDate(String(r.expiresAt).slice(0, 10))}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {r.canDecide && (
                          <>
                            <button onClick={() => setRejecting(r)} className={act.neutral}>Reject</button>
                            <button onClick={() => setApproving(r)} className={act.primary}>Approve</button>
                          </>
                        )}
                        {r.canCancel && (
                          <button onClick={() => setCancelling(r)} className={act.neutral}>Withdraw</button>
                        )}
                        {!r.canDecide && !r.canCancel && <span className="flex items-center gap-1.5 text-xs text-amber-700"><Clock size={13} /> Waiting for the owner</span>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </>
      )}

      {tab === 'history' && (
        history.length === 0 ? (
          <EmptyState icon={Inbox} title="No history yet" message="Decided requests and confirmed cash appear here." />
        ) : (
          <Panel>
            <ul className="divide-y divide-slate-100">
              {history.map(({ kind, item }) => (
                <li key={`${kind}-${item.id}`} className="flex items-start gap-4 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-500">{KIND_LABEL[kind]}</p>
                    <p className="text-sm text-slate-900">
                      {kind === 'cash'
                        ? <>{formatCurrency(item.amount)} cash from {item.tenantName} <span className="text-slate-500">({formatMonth(item.month)})</span></>
                        : kind === 'claim'
                          ? <>{formatCurrency(item.amount)} reported in the app by {item.tenantName} <span className="text-slate-500">({formatMonth(item.month)})</span></>
                          : kind === 'moveout'
                            ? <>Move-out notice from {item.tenantName} for {formatDate(item.moveOutDate)}</>
                            : item.summary}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {kind === 'cash' ? `Collected by ${item.collectedBy?.name}` : kind === 'claim' || kind === 'moveout' ? 'From the tenant app' : `Asked by ${item.requestedBy?.name}`}
                      {item.decidedBy?.name && ` · ${item.status === 'cancelled' ? 'withdrawn' : 'decided'} by ${item.decidedBy.name}`}
                      {(item.decidedAt || item.updatedAt) && ` · ${timeAgo(item.decidedAt ?? item.updatedAt)}`}
                    </p>
                    {item.decisionNote && <p className="text-xs text-slate-600 mt-1">“{item.decisionNote}”</p>}
                    {item.error && <p className="text-xs text-red-600 mt-1">{item.error}</p>}
                  </div>
                  <Badge status={item.status} />
                </li>
              ))}
            </ul>
          </Panel>
        )
      )}

      <ConfirmDialog
        isOpen={!!approving}
        tone="primary"
        title="Approve this change?"
        message={approving ? <><strong>{approving.summary}</strong><br /><span className="text-xs">It is applied immediately and recorded in the activity log.</span></> : ''}
        confirmLabel="Approve"
        onConfirm={handleApprove}
        onCancel={() => setApproving(null)}
      />
      <ReasonDialog
        isOpen={!!rejecting}
        title="Reject request"
        description={rejecting?.summary}
        tone="danger"
        confirmLabel="Reject"
        reasonLabel="Why are you rejecting it?"
        reasonHint={`${rejecting?.requestedBy?.name ?? 'They'} will see this.`}
        onSubmit={handleReject}
        onClose={() => setRejecting(null)}
      />
      <ConfirmDialog
        isOpen={!!cancelling}
        tone="primary"
        title="Withdraw this request?"
        message={cancelling?.summary}
        confirmLabel="Withdraw"
        onConfirm={handleCancel}
        onCancel={() => setCancelling(null)}
      />
      <ConfirmDialog
        isOpen={!!confirmingCash}
        tone="primary"
        title="Confirm cash received?"
        message={confirmingCash ? <>You have received <strong>{formatCurrency(confirmingCash.amount)}</strong> from {confirmingCash.collectedBy?.name}. It will be recorded as a cash payment by {confirmingCash.tenantName} for {formatMonth(confirmingCash.month)}.</> : ''}
        confirmLabel="Confirm received"
        onConfirm={handleConfirmCash}
        onCancel={() => setConfirmingCash(null)}
      />
      <ReasonDialog
        isOpen={!!rejectingCash}
        title="Reject cash handover"
        description={rejectingCash ? `${formatCurrency(rejectingCash.amount)} from ${rejectingCash.tenantName}, collected by ${rejectingCash.collectedBy?.name}.` : ''}
        tone="danger"
        confirmLabel="Reject"
        reasonLabel="What went wrong?"
        reasonHint="e.g. amount short at handover. The collector will see this."
        onSubmit={handleRejectCash}
        onClose={() => setRejectingCash(null)}
      />
      {access?.role === 'caretaker' && tab === 'waiting' && (
        <p className="text-xs text-slate-400 text-center mt-2">Cash you log counts on the tenant&apos;s dues once the owner or accountant confirms the handover.</p>
      )}
    </div>
  )
}
