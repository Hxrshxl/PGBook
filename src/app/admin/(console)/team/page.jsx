'use client'
import { useCallback, useEffect, useState } from 'react'
import { UserPlus, Link2, Copy, Check } from 'lucide-react'
import { adminApi } from '@/utils/adminApi'
import { useAdmin } from '@/context/AdminContext'
import { useToast } from '@/context/ToastContext'
import Spinner from '@/components/ui/Spinner'
import Modal from '@/components/ui/Modal'
import Pill from '@/components/admin/Pill'
import ReasonDialog from '@/components/ui/ReasonDialog'
import { relative } from '@/components/admin/format'

const inputCls = 'w-full border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 bg-white'

export default function TeamPage() {
  const { admin: me } = useAdmin()
  const { showToast } = useToast()
  const [data, setData] = useState(null)
  const [dialog, setDialog] = useState(null) // { type, admin? }
  const [invite, setInvite] = useState({ name: '', email: '', role: 'support_agent' })
  const [newRole, setNewRole] = useState('')
  const [link, setLink] = useState(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => setData(await adminApi.get('/team')), [])
  useEffect(() => { load().catch(err => showToast(err.message, 'error')) }, [load, showToast])

  async function request(type, extra, reason) {
    await adminApi.post('/team', { type, reason, ...extra })
    showToast('Request sent. Another Super Admin must approve it.', 'info')
    setDialog(null)
    await load()
  }

  async function issueLink(target) {
    try {
      const { inviteUrl } = await adminApi.post(`/team/${target.id}/invite-link`)
      setCopied(false)
      setLink(inviteUrl)
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  if (!data) return <div className="flex justify-center py-24"><Spinner size={26} /></div>

  const roleLabel = id => data.roles.find(r => r.id === id)?.label ?? id
  const pendingFor = id => data.pending.filter(p => p.payload?.adminId === id)

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Admin team</h1>
          <p className="text-slate-500 text-sm mt-1">Every change here — invites, roles, disabling, 2FA resets — needs approval from a second Super Admin.</p>
        </div>
        {data.canRequest && (
          <button onClick={() => setDialog({ type: 'invite' })} className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap h-9 px-3.5 text-sm rounded-md bg-indigo-600 font-medium text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:opacity-50 shrink-0">
            <UserPlus size={16} /> Invite admin
          </button>
        )}
      </div>

      {data.pending.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-5 py-4 text-sm text-amber-900">
          <p className="font-semibold mb-1">Waiting for approval</p>
          <ul className="list-disc ml-5 space-y-0.5">{data.pending.map(p => <li key={p.id}>{p.summary} — requested by {p.requestedBy.name}</li>)}</ul>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th scope="col" className="px-4 py-3 font-medium">Admin</th>
                <th scope="col" className="px-4 py-3 font-medium">Role</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 font-medium">2FA</th>
                <th scope="col" className="px-4 py-3 font-medium">Last sign-in</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.admins.map(a => {
                const self = a.id === me.id
                return (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{a.name}{self && <span className="text-xs text-slate-400 font-normal"> (you)</span>}</p>
                      <p className="text-xs text-slate-400">{a.email}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{a.roleLabel}</td>
                    <td className="px-4 py-3">
                      <Pill tone={a.status}>{a.status}</Pill>
                      {a.status === 'invited' && a.inviteExpired && <span className="text-xs text-rose-600 ml-2">link expired</span>}
                    </td>
                    <td className="px-4 py-3">{a.twoFactorEnabled ? <Pill tone="active">on</Pill> : <Pill tone="neutral">not set up</Pill>}</td>
                    <td className="px-4 py-3 text-slate-600">{relative(a.lastLoginAt)}</td>
                    <td className="px-4 py-3">
                      {data.canRequest && pendingFor(a.id).length === 0 && (
                        <div className="flex justify-end flex-wrap gap-x-3 gap-y-1 text-xs font-medium">
                          {a.status === 'invited' && data.isSuperAdmin && <button onClick={() => issueLink(a)} className="text-indigo-600 hover:text-indigo-700 flex items-center gap-1"><Link2 size={12} /> New invite link</button>}
                          <button onClick={() => { setNewRole(a.role === 'support_agent' ? 'billing_admin' : 'support_agent'); setDialog({ type: 'changeRole', admin: a }) }} className="text-slate-600 hover:text-slate-900">Change role</button>
                          {a.twoFactorEnabled && <button onClick={() => setDialog({ type: 'reset2fa', admin: a })} className="text-slate-600 hover:text-slate-900">Reset 2FA</button>}
                          {a.status === 'disabled'
                            ? <button onClick={() => setDialog({ type: 'enable', admin: a })} className="text-emerald-700 hover:text-emerald-800">Re-enable</button>
                            : <button onClick={() => setDialog({ type: 'disable', admin: a })} className="text-rose-600 hover:text-rose-700">Disable</button>}
                        </div>
                      )}
                      {pendingFor(a.id).length > 0 && <p className="text-right text-xs text-amber-700">change pending</p>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <section className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="font-semibold text-slate-900 text-sm mb-3">Roles</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          {data.roles.map(r => (
            <div key={r.id} className="bg-slate-50 rounded-xl p-3">
              <dt className="font-medium text-slate-900">{r.label}</dt>
              <dd className="text-slate-500 mt-0.5">{r.description}</dd>
            </div>
          ))}
        </dl>
      </section>

      <ReasonDialog
        isOpen={dialog?.type === 'invite'}
        title="Invite an admin"
        description="Creates a request. After a second Super Admin approves it, they get a single-use invite link to share privately."
        confirmLabel="Request invite"
        onSubmit={({ reason }) => request('invite', invite, reason)}
        onClose={() => setDialog(null)}
        reasonLabel="Why do they need access?"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input aria-label="Name" placeholder="Full name" required value={invite.name} onChange={e => setInvite(v => ({ ...v, name: e.target.value }))} className={inputCls} />
          <input aria-label="Email" placeholder="work email" type="email" required value={invite.email} onChange={e => setInvite(v => ({ ...v, email: e.target.value }))} className={inputCls} />
        </div>
        <select aria-label="Role" value={invite.role} onChange={e => setInvite(v => ({ ...v, role: e.target.value }))} className={inputCls}>
          {data.roles.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
        <p className="text-xs text-slate-500 -mt-2">{data.roles.find(r => r.id === invite.role)?.description}</p>
      </ReasonDialog>

      <ReasonDialog
        isOpen={dialog?.type === 'changeRole'}
        title={`Change role — ${dialog?.admin?.name ?? ''}`}
        description={`Currently ${roleLabel(dialog?.admin?.role)}. The change signs them out so new permissions apply from their next sign-in.`}
        confirmLabel="Request change"
        onSubmit={({ reason }) => request('changeRole', { adminId: dialog.admin.id, role: newRole }, reason)}
        onClose={() => setDialog(null)}
      >
        <select aria-label="New role" value={newRole} onChange={e => setNewRole(e.target.value)} className={inputCls}>
          {data.roles.filter(r => r.id !== dialog?.admin?.role).map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
      </ReasonDialog>

      <ReasonDialog
        isOpen={dialog?.type === 'disable'}
        tone="danger"
        title={`Disable ${dialog?.admin?.name ?? ''}`}
        description="They are signed out immediately and cannot sign in. Their audit history is kept."
        confirmLabel="Request disable"
        onSubmit={({ reason }) => request('disable', { adminId: dialog.admin.id }, reason)}
        onClose={() => setDialog(null)}
      />

      <ReasonDialog
        isOpen={dialog?.type === 'enable'}
        title={`Re-enable ${dialog?.admin?.name ?? ''}`}
        confirmLabel="Request re-enable"
        onSubmit={({ reason }) => request('enable', { adminId: dialog.admin.id }, reason)}
        onClose={() => setDialog(null)}
      />

      <ReasonDialog
        isOpen={dialog?.type === 'reset2fa'}
        tone="danger"
        title={`Reset 2FA — ${dialog?.admin?.name ?? ''}`}
        description="Use this when someone loses their phone. They're signed out and must set up a new authenticator on their next sign-in. Verify their identity out-of-band first."
        confirmLabel="Request reset"
        onSubmit={({ reason }) => request('reset2fa', { adminId: dialog.admin.id }, reason)}
        onClose={() => setDialog(null)}
      />

      <Modal isOpen={!!link} onClose={() => setLink(null)} title="New invite link" maxWidth="max-w-lg">
        <p className="text-sm text-slate-600 mb-3">Single-use, valid for 72 hours. Any earlier link for this person no longer works.</p>
        <div className="flex gap-2">
          <input readOnly value={link ?? ''} aria-label="Invite link" onFocus={e => e.target.select()} className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 bg-slate-50" />
          <button onClick={async () => { await navigator.clipboard.writeText(link); setCopied(true) }} className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap h-9 px-3.5 text-sm rounded-md bg-indigo-600 font-medium text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:opacity-50">
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
