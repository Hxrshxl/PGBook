'use client'
import { useCallback, useEffect, useState } from 'react'
import { UserPlus, UsersRound, Copy, Check, MessageCircle } from 'lucide-react'
import { api } from '@/utils/api'
import { useAppData } from '@/context/AppContext'
import { useToast } from '@/context/ToastContext'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { formatDate, timeAgo } from '@/utils/helpers'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import FormError from '@/components/ui/FormError'
import Spinner from '@/components/ui/Spinner'
import Badge from '@/components/ui/Badge'
import PageHeader from '@/components/ui/PageHeader'
import RowMenu from '@/components/ui/RowMenu'
import { btn, page } from '@/components/ui/styles'

const inputCls = 'w-full border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 transition-colors bg-white'
const labelCls = 'block text-[13px] font-medium text-slate-700 mb-1.5'

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
        <div className="flex justify-end"><button onClick={onCancel} className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap h-9 px-3.5 text-sm rounded-md bg-indigo-600 font-medium text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:opacity-50">Done</button></div>
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
        <button type="button" onClick={onCancel} disabled={busy} className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap h-9 px-3.5 text-sm rounded-md border border-slate-200 bg-white font-medium text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50">Cancel</button>
        <button type="submit" disabled={busy} className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap h-9 px-3.5 text-sm rounded-md bg-indigo-600 font-medium text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:opacity-50">{busy ? 'Creating…' : 'Create invite link'}</button>
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
        <button type="button" onClick={onCancel} disabled={busy} className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap h-9 px-3.5 text-sm rounded-md border border-slate-200 bg-white font-medium text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50">Cancel</button>
        <button type="submit" disabled={busy} className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap h-9 px-3.5 text-sm rounded-md bg-indigo-600 font-medium text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:opacity-50">{busy ? 'Saving…' : 'Save access'}</button>
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

  const statusLine = m => m.status === 'invited'
    ? (m.inviteExpired ? 'Invite expired' : `Invite valid until ${formatDate(String(m.inviteExpiresAt).slice(0, 10))}`)
    : m.lastActiveAt ? `Active ${timeAgo(m.lastActiveAt)}` : `Joined ${m.joinedAt ? formatDate(String(m.joinedAt).slice(0, 10)) : ''}`
  const menuFor = m => [
    { label: 'Change access', onClick: () => setEditing(m) },
    { label: 'Send a new invite link', onClick: () => newLink(m), hidden: m.status !== 'invited' || linkBusy },
    { divider: true },
    { label: 'Remove from team', onClick: () => setRemoving(m), danger: true },
  ]

  return (
    <div className={`${page} mx-auto max-w-4xl`}>
      <PageHeader
        title="Team"
        description="Give your manager, accountant or caretaker their own login with only the access they need."
        actions={<button onClick={() => setInviting(true)} className={btn.primary}><UserPlus size={15} /> Invite</button>}
      />

      {data.members.length === 0 ? (
        <EmptyState icon={UsersRound} title="It's just you for now" message="Invite staff so they can work in PGBook without your password. Everything they do is recorded in Activity." actionLabel="Invite someone" onAction={() => setInviting(true)} />
      ) : (
        <div className="mb-8 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th scope="col" className="py-2.5 pl-5 pr-3 font-medium">Member</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Role</th>
                <th scope="col" className="hidden px-3 py-2.5 font-medium md:table-cell">Properties</th>
                <th scope="col" className="hidden px-3 py-2.5 font-medium sm:table-cell">Status</th>
                <th scope="col" className="w-10 py-2.5 pl-3 pr-5"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.members.map(m => (
                <tr key={m.id} className="hover:bg-slate-50/70">
                  <td className="py-2.5 pl-5 pr-3">
                    <p className="font-medium text-slate-900">{m.name}</p>
                    <p className="max-w-[220px] truncate text-xs text-slate-500">{m.email}</p>
                  </td>
                  <td className="px-3 py-2.5 text-slate-700">{m.roleLabel}</td>
                  <td className="hidden max-w-[220px] truncate px-3 py-2.5 text-slate-600 md:table-cell">{accessLabel(m)}</td>
                  <td className="hidden px-3 py-2.5 sm:table-cell">
                    {m.status === 'invited' ? <Badge tone={m.inviteExpired ? 'red' : 'amber'}>{m.inviteExpired ? 'Invite expired' : 'Invited'}</Badge> : <Badge status="active" />}
                    <p className="mt-0.5 text-xs text-slate-500">{statusLine(m)}</p>
                  </td>
                  <td className="py-2.5 pl-3 pr-5 text-right"><RowMenu items={menuFor(m)} label={`Actions for ${m.name}`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mb-3 text-sm font-semibold text-slate-900">What each role can do</h2>
      <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {data.roles.map(r => (
          <div key={r.id} className="grid gap-1 px-5 py-3 sm:grid-cols-[160px_1fr] sm:gap-4">
            <dt className="text-sm font-medium text-slate-900">{r.label}</dt>
            <dd className="text-sm leading-relaxed text-slate-600">{r.description}</dd>
          </div>
        ))}
      </dl>

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
