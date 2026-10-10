'use client'
import { useState } from 'react'
import { Bell, MessageCircle, ChevronDown, ChevronUp, Check, Copy } from 'lucide-react'
import { useAppData } from '@/context/AppContext'
import { useToast } from '@/context/ToastContext'
import { getCurrentMonth, formatMonth, formatCurrency, getMonthPayments, getBalance, isBillableMonth, toWhatsAppNumber, chargesTotal } from '@/utils/helpers'
import { generateReminderMessage } from '@/utils/generateReminderMessage'
import MonthSelector from '@/components/ui/MonthSelector'
import EmptyState from '@/components/ui/EmptyState'
import Badge from '@/components/ui/Badge'
import PageHeader from '@/components/ui/PageHeader'
import { Segmented } from '@/components/ui/Tabs'
import { btn, button, page } from '@/components/ui/styles'

export default function RemindersPage() {
  const { tenants, payments, settingsFor } = useAppData()
  const { showToast } = useToast()
  const [month, setMonth] = useState(getCurrentMonth)
  const [lang, setLang] = useState('en')
  const [expanded, setExpanded] = useState({})
  const [sent, setSent] = useState({}) // tenantId+month → true, for this session

  const monthPayments = getMonthPayments(payments, month)
  const pendingRows = tenants
    .map(t => ({ tenant: t, payment: monthPayments.find(p => p.tenantId === t.id) ?? null }))
    .filter(({ tenant, payment }) => payment
      ? payment.status !== 'paid' // includes vacated tenants who still owe for this month
      : tenant.status === 'active' && isBillableMonth(tenant.moveInDate, month) && tenant.rentAmount > 0)
    .sort((a, b) => a.tenant.room.localeCompare(b.tenant.room, undefined, { numeric: true }))

  const sentKey = tenant => `${tenant.id}:${month}`
  const unsent = pendingRows.filter(r => !sent[sentKey(r.tenant)])

  function openWhatsApp(tenant, payment) {
    const msg = generateReminderMessage(tenant, payment, settingsFor(tenant), lang, month)
    const url = `https://wa.me/${toWhatsAppNumber(tenant.phone)}?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank', 'noopener,noreferrer')
    showToast(`Opening WhatsApp for ${tenant.name}…`, 'info')
    setSent(prev => ({ ...prev, [sentKey(tenant)]: true }))
  }

  async function copyMessage(tenant, payment) {
    try {
      await navigator.clipboard.writeText(generateReminderMessage(tenant, payment, settingsFor(tenant), lang, month))
      showToast('Message copied.')
    } catch {
      showToast('Could not copy — select the preview text instead.', 'error')
    }
  }

  // Browsers block multiple pop-ups from one click, so send one at a time.
  function sendNext() {
    const next = unsent[0]
    if (next) openWhatsApp(next.tenant, next.payment)
  }

  return (
    <div className={`${page} mx-auto max-w-3xl`}>
      <PageHeader
        title="Reminders"
        description="Send WhatsApp reminders to tenants who still owe rent."
        actions={<MonthSelector value={month} onChange={setMonth} />}
      />

      {pendingRows.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={`All clear for ${formatMonth(month)}`}
          message="Every tenant has paid for this month. No reminders needed."
        />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Segmented label="Message language" value={lang} onChange={setLang} options={[{ key: 'en', label: 'English' }, { key: 'hi', label: 'हिंदी' }]} />
              <p className="text-sm text-slate-500">{pendingRows.length} tenant{pendingRows.length === 1 ? '' : 's'} with dues</p>
            </div>
            {pendingRows.length > 1 && (
              <button onClick={sendNext} disabled={unsent.length === 0} className={btn.primary}>
                <MessageCircle size={15} />
                {unsent.length ? `Send next (${unsent.length} left)` : 'All reminders opened'}
              </button>
            )}
          </div>

          {pendingRows.some(r => !settingsFor(r.tenant).upiId) && (
            <p className="mb-3 text-xs text-slate-500">Tip: add your UPI ID in Settings so it is included in reminders.</p>
          )}

          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {pendingRows.map(({ tenant, payment }) => {
              const balance = payment ? getBalance(payment) : tenant.rentAmount + chargesTotal(tenant.recurringCharges)
              const isOpen = expanded[tenant.id]
              const wasSent = sent[sentKey(tenant)]
              return (
                <li key={tenant.id}>
                  <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900">{tenant.name}</p>
                      <p className="text-xs text-slate-500">Room {tenant.room} · owes {formatCurrency(balance)}{tenant.status === 'vacated' ? ' · moved out' : ''}</p>
                    </div>
                    <span className="hidden sm:inline"><Badge status={payment?.status ?? 'pending'} /></span>
                    <button
                      onClick={() => setExpanded(prev => ({ ...prev, [tenant.id]: !prev[tenant.id] }))}
                      className={btn.icon}
                      aria-label="Preview message"
                      aria-expanded={!!isOpen}
                    >
                      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <button onClick={() => openWhatsApp(tenant, payment)} className={button(wasSent ? 'ghost' : 'secondary', 'sm')}>
                      {wasSent ? <Check size={14} className="text-emerald-600" /> : <MessageCircle size={14} className="text-emerald-600" />}
                      {wasSent ? 'Opened' : 'WhatsApp'}
                    </button>
                  </div>
                  {isOpen && (
                    <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-medium text-slate-500">Message preview</p>
                        <button onClick={() => copyMessage(tenant, payment)} className={button('ghost', 'xs')}><Copy size={12} /> Copy</button>
                      </div>
                      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">{generateReminderMessage(tenant, payment, settingsFor(tenant), lang, month)}</pre>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
