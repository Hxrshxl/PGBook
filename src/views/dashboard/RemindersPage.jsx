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
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payment Reminders</h1>
          <p className="text-slate-500 text-sm mt-1">WhatsApp reminders for tenants with pending dues</p>
        </div>
        <MonthSelector value={month} onChange={setMonth} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
          {[{ k: 'en', l: 'English' }, { k: 'hi', l: 'हिंदी' }].map(({ k, l }) => (
            <button
              key={k}
              onClick={() => setLang(k)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${lang === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {l}
            </button>
          ))}
        </div>

        {pendingRows.length > 1 && (
          <button
            onClick={sendNext}
            disabled={unsent.length === 0}
            className="flex items-center gap-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-500 px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50"
          >
            <MessageCircle size={15} />
            {unsent.length ? `Send next (${unsent.length} left)` : 'All reminders opened'}
          </button>
        )}
      </div>

      {pendingRows.some(r => !settingsFor(r.tenant).upiId) && (
        <p className="text-amber-700 text-xs bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-4">
          Add your UPI ID in Settings so it is included in reminders.
        </p>
      )}

      {pendingRows.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={`All clear for ${formatMonth(month)}`}
          message="Every tenant has paid for this month. No reminders needed."
        />
      ) : (
        <div className="space-y-3">
          <p className="text-slate-500 text-sm">{pendingRows.length} tenant(s) have pending dues for {formatMonth(month)}</p>
          {pendingRows.map(({ tenant, payment }) => {
            const balance = payment ? getBalance(payment) : tenant.rentAmount + chargesTotal(tenant.recurringCharges)
            const isOpen = expanded[tenant.id]
            const wasSent = sent[sentKey(tenant)]

            return (
              <div key={tenant.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between gap-3 p-4 sm:p-5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold shrink-0">
                      {tenant.name[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 truncate">{tenant.name}</p>
                      <p className="text-slate-400 text-xs">Room {tenant.room} · Due {formatCurrency(balance)}{tenant.status === 'vacated' ? ' · Vacated' : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    <span className="hidden sm:inline"><Badge status={payment?.status ?? 'pending'} /></span>
                    <button
                      onClick={() => setExpanded(prev => ({ ...prev, [tenant.id]: !prev[tenant.id] }))}
                      className="text-slate-400 hover:text-slate-600 p-1 transition-colors"
                      aria-label="Preview message"
                      aria-expanded={!!isOpen}
                    >
                      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <button
                      onClick={() => openWhatsApp(tenant, payment)}
                      className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${wasSent ? 'text-green-700 bg-green-50 border border-green-200' : 'text-white bg-green-600 hover:bg-green-500'}`}
                    >
                      {wasSent ? <Check size={14} /> : <MessageCircle size={14} />}
                      {wasSent ? 'Opened' : 'WhatsApp'}
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Message preview</p>
                      <button onClick={() => copyMessage(tenant, payment)} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700">
                        <Copy size={12} /> Copy
                      </button>
                    </div>
                    <pre className="text-slate-700 text-sm whitespace-pre-wrap font-sans leading-relaxed">{generateReminderMessage(tenant, payment, settingsFor(tenant), lang, month)}</pre>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
