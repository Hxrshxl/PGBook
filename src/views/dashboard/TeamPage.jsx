'use client'
import { useCallback, useEffect, useState } from 'react'
import { UserPlus, UsersRound, Copy, Check, Link2, Pencil, UserMinus, MessageCircle } from 'lucide-react'
import { api } from '@/utils/api'
import { useAppData } from '@/context/AppContext'
import { useToast } from '@/context/ToastContext'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { formatDate, initials, timeAgo } from '@/utils/helpers'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import FormError from '@/components/ui/FormError'
import Spinner from '@/components/ui/Spinner'

const inputCls = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors'
const labelCls = 'block text-slate-700 text-sm font-medium mb-1.5'

function AccessFields({ roles, properties, value, onChange }) {
  const allProperties = value.propertyIds.length === 0
  const toggle = id => onChange({ ...value, propertyIds: value.propertyIds.includes(id) ? value.propertyIds.filter(x => x !== id) : [...value.propertyIds, id] })
  return (
    <>
      <fieldset>
        <legend className={labelCls}>Role *</legend>
        <div className="space-y-2">
          {roles.map(r => (
            <label key={r.id} className={`flex gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${value.role === r.id ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-200 hover:border-slate-300'}`}>
              <input type="radio" name="role" value={r.id} checked={value.role === r.id} onChange={() => onChange({ ...value, role: r.id })} className="mt-1 accent-indigo-600" />
              <span>
                <span className="block text-sm font-semibold text-slate-900">{r.label}</span>
                <span className="block text-xs text-slate-500 mt-0.5">{r.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {properties.length > 1 && (
        <fieldset>
          <legend className={labelCls}>Properties</legend>
          <label className="flex items-center gap-2 text-sm text-slate-700 mb-2">
            <input type="checkbox" checked={allProperties} onChange={() => onChange({ ...value, propertyIds: allProperties ? [properties[0].id] : [] })} className="accent-indigo-600" />
            All properties, including ones you add later
          </label>
          {!allProperties && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-6">
              {properties.map(p => (
                <label key={p.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={value.propertyIds.includes(p.id)} onChange={() => toggle(p.id)} className="accent-indigo-600" />
                  {p.name}
                </label>
              ))}
            </div>
          )}
        </fieldset>
      )}
    </>
  )
}

function InviteLink({ url, name }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }
  const message = `Hi ${name}, here is your invite to join our PG on PGBook: ${url}`
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input readOnly value={url} aria-label="Invite link" onFocus={e => e.target.select()} className={`${inputCls} font-mono text-xs bg-slate-50`} />
        <button type="button" onClick={copy} className="flex items-center gap-1.5 px-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:border-slate-300 shrink-0">
          {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold">
        <MessageCircle size={15} /> Share on WhatsApp
      </a>
      <p className="text-xs text-slate-400">Works once and expires in 7 days. Anyone with this link can join as this person, so send it only to them.</p>
    </div>
  )
}

function InviteForm({ roles, properties, onDone, onCancel }) {
  const [form, setForm] = useState({ name: '', email: '', role: 'caretaker', propertyIds: [] })
  const [result, setResult] = useState(null)
  const { run, busy, error } = useAsyncAction(async () => {
    const data = await api.post('/team', { ...form, name: form.name.trim(), email: form.email.trim() })
    setResult(data)
    onDone(data.member)
  })

  if (result) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-600">Send this link to <strong>{result.member.name}</strong>. They set their own password and can sign in as {result.member.roleLabel.toLowerCase()} straight away.</p>
        <InviteLink url={result.inviteUrl} name={result.member.name} />
        <div className="flex justify-end"><button onClick={onCancel} className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl">Done</button></div>
      </div>
    )
  }

  return (
    <form onSubmit={e => { e.preventDefault(); run() }} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="m-name" className={labelCls}>Name *</label>
          <input id="m-name" required maxLength={100} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Suresh Kumar" className={inputCls} />
        </div>
        <div>
          <label htmlFor="m-email" className={labelCls}>Email *</label>
          <input id="m-email" required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="suresh@example.com" className={inputCls} />
        </div>
      </div>
      <AccessFields roles={roles} properties={properties} value={form} onChange={v => setForm(f => ({ ...f, ...v }))} />
      <FormError message={error} />
      <div className="flex justify-end gap-3 pt-1">
        <button type="button" onClick={onCancel} disabled={busy} className="px-5 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:border-slate-300 disabled:opacity-50">Cancel</button>
        <button type="submit" disabled={busy} className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl disabled:opacity-60">{busy ? 'Creating…' : 'Create invite link'}</button>
      </div>
    </form>
  )
}

function EditAccessForm({ member, roles, properties, onSubmit, onCancel }) {
  const [value, setValue] = useState({ role: member.role, propertyIds: member.propertyIds })
  const { run, busy, error } = useAsyncAction(onSubmit)
  return (
    <form onSubmit={e => { e.preventDefault(); run(value) }} className="space-y-4">
      <AccessFields roles={roles} properties={properties} value={value} onChange={setValue} />
      <p className="text-xs text-slate-400">Changes apply on their next action, no sign-out needed.</p>
      <FormError message={error} />
      <div className="flex justify-end gap-3 pt-1">
        <button type="button" onClick={onCancel} disabled={busy} className="px-5 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:border-slate-300 disabled:opacity-50">Cancel</button>
        <button type="submit" disabled={busy} className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl disabled:opacity-60">{busy ? 'Saving…' : 'Save access'}</button>
      </div>
    </form>
  )
}

export default function TeamPage() {
  const { properties, propertyById } = useAppData()
  const { showToast } = useToast()
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [inviting, setInviting] = useState(false)
  const [editing, setEditing] = useState(null)
  const [removing, setRemoving] = useState(null)
  const [link, setLink] = useState(null) // { member, url }

  const load = useCallback(async () => {
    try {
      setData(await api.get('/team'))
      setLoadError('')
    } catch (e) {
      setLoadError(e.message)
    }
  }, [])
  useEffect(() => { load() }, [load])

  const replaceMember = member => setData(d => ({ ...d, members: d.members.some(m => m.id === member.id) ? d.members.map(m => (m.id === member.id ? { ...m, ...member } : m)) : [...d.members, member] }))

  async function handleEdit(value) {
    replaceMember(await api.put(`/team/${editing.id}`, value))
    setEditing(null)
    showToast('Access updated.')
  }
  async function handleRemove() {
    await api.delete(`/team/${removing.id}`)
    setData(d => ({ ...d, members: d.members.filter(m => m.id !== removing.id) }))
    showToast(`${removing.name} no longer has access.`, 'warning')
    setRemoving(null)
  }
  const { run: newLink, busy: linkBusy } = useAsyncAction(async member => {
    const { inviteUrl } = await api.post(`/team/${member.id}/invite-link`)
    setLink({ member, url: inviteUrl })
    load()
  })

  const accessLabel = m => (m.propertyIds.length ? m.propertyIds.map(id => propertyById.get(id)?.name ?? 'Archived property').join(', ') : 'All properties')

  if (!data) {
    return (
      <div className="flex justify-center py-24">
        {loadError ? <div className="max-w-sm w-full px-4"><FormError message={loadError} /></div> : <Spinner size={26} />}
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Team</h1>
          <p className="text-slate-500 text-sm mt-1">Give your manager, accountant or caretaker their own login with only the access they need</p>
        </div>
        <button onClick={() => setInviting(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors shrink-0">
          <UserPlus size={16} /> <span className="hidden sm:inline">Invite</span>
        </button>
      </div>

      {data.members.length === 0 ? (
        <EmptyState icon={UsersRound} title="It's just you for now" message="Invite staff so they can work in PGBook without your password. Everything they do is recorded in Activity." actionLabel="Invite someone" onAction={() => setInviting(true)} />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-6">
          <ul className="divide-y divide-slate-100">
            {data.members.map(m => (
              <li key={m.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0">{initials(m.name)}</div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {m.name} <span className="ml-1 text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{m.roleLabel}</span>
                    </p>
                    <p className="text-xs text-slate-500 truncate">{m.email} · {accessLabel(m)}</p>
                    <p className="text-xs text-slate-400">
                      {m.status === 'invited'
                        ? (m.inviteExpired ? 'Invite expired — send a new link' : `Invited · link valid until ${formatDate(String(m.inviteExpiresAt).slice(0, 10))}`)
                        : m.lastActiveAt ? `Active ${timeAgo(m.lastActiveAt)}` : `Joined ${m.joinedAt ? formatDate(String(m.joinedAt).slice(0, 10)) : ''}`}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0 sm:justify-end">
                  {m.status === 'invited' && (
                    <button onClick={() => newLink(m)} disabled={linkBusy} className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-indigo-600 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 disabled:opacity-50">
                      <Link2 size={13} /> New link
                    </button>
                  )}
                  <button onClick={() => setEditing(m)} className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-indigo-600 px-2.5 py-1.5 rounded-lg hover:bg-slate-50">
                    <Pencil size={13} /> Access
                  </button>
                  <button onClick={() => setRemoving(m)} className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-red-600 px-2.5 py-1.5 rounded-lg hover:bg-slate-50">
                    <UserMinus size={13} /> Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {data.roles.map(r => (
          <div key={r.id} className="bg-slate-50 rounded-2xl border border-slate-100 p-4">
            <p className="text-sm font-semibold text-slate-900">{r.label}</p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{r.description}</p>
          </div>
        ))}
      </div>

      <Modal isOpen={inviting} onClose={() => setInviting(false)} title="Invite a team member" maxWidth="max-w-xl">
        {inviting && <InviteForm roles={data.roles} properties={properties} onDone={replaceMember} onCancel={() => setInviting(false)} />}
      </Modal>
      <Modal isOpen={!!editing} onClose={() => setEditing(null)} title={`Access for ${editing?.name ?? ''}`} maxWidth="max-w-xl">
        {editing && <EditAccessForm member={editing} roles={data.roles} properties={properties} onSubmit={handleEdit} onCancel={() => setEditing(null)} />}
      </Modal>
      <Modal isOpen={!!link} onClose={() => setLink(null)} title={`New invite link for ${link?.member.name ?? ''}`}>
        {link && <><InviteLink url={link.url} name={link.member.name} /><p className="text-xs text-slate-400 mt-3">The previous link no longer works.</p></>}
      </Modal>
      <ConfirmDialog
        isOpen={!!removing}
        title={`Remove ${removing?.name ?? ''}?`}
        message={removing?.status === 'active' ? 'They are signed out everywhere immediately and can no longer see your PG. Everything they did stays in the activity log.' : 'Their invite link stops working.'}
        confirmLabel="Remove access"
        onConfirm={handleRemove}
        onCancel={() => setRemoving(null)}
      />
    </div>
  )
}
