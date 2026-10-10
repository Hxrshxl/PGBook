'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Inbox, Copy, Check, X } from 'lucide-react'
import { adminApi } from '@/utils/adminApi'
import { useToast } from '@/context/ToastContext'
import Spinner from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'
import Modal from '@/components/ui/Modal'
import FormError from '@/components/ui/FormError'
import Pill from '@/components/admin/Pill'
import { ADMIN_ROLE_LABELS } from '@/utils/auditText'
import { dateTime, relative } from '@/components/admin/format'

const VIEWS = [
  { key: 'waiting', label: 'Waiting for me' },
  { key: 'raised', label: 'Raised by me' },
  { key: 'history', label: 'All requests' },
]

function InviteLink({ url, onClose }) {
  const [copied, setCopied] = useState(false)
  return (
    <Modal isOpen onClose={onClose} title="Invite link" maxWidth="max-w-lg">
      <p className="text-sm text-slate-600 mb-3">Send this single-use link to the new admin through a private channel. It expires in 72 hours and won&apos;t be shown again (a Super Admin can issue a new one from Admin Team).</p>
      <div className="flex gap-2">
        <input readOnly value={url} aria-label="Invite link" className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 bg-slate-50" onFocus={e => e.target.select()} />
        <button onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true) }} className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap h-9 px-3.5 text-sm rounded-md bg-indigo-600 font-medium text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:opacity-50">
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </Modal>
  )
}

export default function ApprovalsPage() {
  const { showToast } = useToast()
  const [view, setView] = useState('waiting')
  const [data, setData] = useState(null)
  const [deciding, setDeciding] = useState(null) // { approval, decision }
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [inviteUrl, setInviteUrl] = useState(null)

  const load = useCallback(async () => {
    setData(await adminApi.get(`/approvals?view=${view}`))
  }, [view])

  useEffect(() => { setData(null); load().catch(err => setError(err.message)) }, [load])

  async function decide(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const result = await adminApi.post(`/approvals/${deciding.approval.id}`, { decision: deciding.decision, note })
      showToast(deciding.decision === 'approve' ? 'Approved and applied.' : 'Request rejected.')
      if (result.result?.inviteUrl) setInviteUrl(result.result.inviteUrl)
      setDeciding(null)
      setNote('')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function cancel(approval) {
    try {
      await adminApi.delete(`/approvals/${approval.id}`)
      showToast('Request withdrawn.', 'warning')
      await load()
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Approvals</h1>
        <p className="text-slate-500 text-sm mt-1">Changes that need a second person. You can never approve your own request, and approving needs a fresh 2FA code.</p>
      </div>

      <div className="flex gap-1 bg-slate-200/60 p-1 rounded-xl w-fit mb-6">
        {VIEWS.map(v => (
          <button key={v.key} onClick={() => setView(v.key)} className={`px-4 py-1.5 rounded-lg text-sm font-medium ${view === v.key ? 'bg-white text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
            {v.label}{v.key === 'waiting' && data?.counts.waiting ? ` (${data.counts.waiting})` : ''}
          </button>
        ))}
      </div>

      {!data ? <div className="flex justify-center py-16">{error ? <p className="text-rose-600 text-sm">{error}</p> : <Spinner />}</div> : data.items.length === 0 ? (
        <EmptyState icon={Inbox} title={view === 'waiting' ? 'Nothing waiting for you' : 'No requests'} message={view === 'waiting' ? 'Requests you can approve will appear here.' : undefined} />
      ) : (
        <ul className="space-y-3">
          {data.items.map(a => (
            <li key={a.id} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Pill tone={a.status}>{a.status}</Pill>
                    <span className="text-xs font-medium text-slate-500">{a.typeLabel}</span>
                  </div>
                  <p className="font-semibold text-slate-900">{a.summary}</p>
                  <p className="text-sm text-slate-600 mt-1">Reason: “{a.reason}”</p>
                  <p className="text-xs text-slate-400 mt-2">
                    Requested by {a.requestedBy.name} ({ADMIN_ROLE_LABELS[a.requestedBy.role] ?? a.requestedBy.role}) · {relative(a.createdAt)}
                    {a.status === 'pending' && ` · expires ${dateTime(a.expiresAt)}`}
                    {a.orgId && <> · <Link href={`/admin/owners/${a.orgId}`} className="hover:text-indigo-600">view owner</Link></>}
                  </p>
                  {a.decidedBy && (
                    <p className="text-xs text-slate-500 mt-1">
                      {a.status === 'rejected' ? 'Rejected' : 'Decided'} by {a.decidedBy.name} · {dateTime(a.decidedAt)}{a.decisionNote ? ` — “${a.decisionNote}”` : ''}
                    </p>
                  )}
                  {a.error && <p className="text-xs text-rose-600 mt-1">Could not apply: {a.error}</p>}
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  {a.canDecide && (
                    <>
                      <button onClick={() => { setDeciding({ approval: a, decision: 'approve' }); setError('') }} className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500"><Check size={14} /> Approve</button>
                      <button onClick={() => { setDeciding({ approval: a, decision: 'reject' }); setError('') }} className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50"><X size={14} /> Reject</button>
                    </>
                  )}
                  {a.canCancel && <button onClick={() => cancel(a)} className="text-xs text-slate-500 hover:text-slate-700">Withdraw</button>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal isOpen={!!deciding} onClose={() => !busy && setDeciding(null)} title={deciding?.decision === 'approve' ? 'Approve request' : 'Reject request'} maxWidth="max-w-md">
        {deciding && (
          <form onSubmit={decide} className="space-y-4">
            <div className="bg-slate-50 rounded-xl p-3 text-sm">
              <p className="font-medium text-slate-900">{deciding.approval.summary}</p>
              <p className="text-slate-500 mt-1">“{deciding.approval.reason}” — {deciding.approval.requestedBy.name}</p>
            </div>
            {deciding.decision === 'approve' && <p className="text-sm text-slate-600">It is applied immediately, re-checked against current data. You&apos;ll be asked for a 2FA code.</p>}
            <div>
              <label htmlFor="note" className="block text-[13px] font-medium text-slate-700 mb-1.5">{deciding.decision === 'reject' ? 'Why are you rejecting it? *' : 'Note (optional)'}</label>
              <textarea id="note" rows={3} maxLength={1000} required={deciding.decision === 'reject'} minLength={deciding.decision === 'reject' ? 3 : undefined}
                value={note} onChange={e => setNote(e.target.value)} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 resize-none bg-white" />
            </div>
            <FormError message={error} />
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setDeciding(null)} disabled={busy} className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap h-9 px-3.5 text-sm rounded-md border border-slate-200 bg-white font-medium text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50">Cancel</button>
              <button type="submit" disabled={busy} className={`px-5 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50 ${deciding.decision === 'approve' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'}`}>
                {busy ? 'Working…' : deciding.decision === 'approve' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {inviteUrl && <InviteLink url={inviteUrl} onClose={() => setInviteUrl(null)} />}
    </div>
  )
}
