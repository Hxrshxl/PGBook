'use client'
import { useState } from 'react'
import { Bell, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { useAppData } from '../../context/AppContext'
import { useToast } from '../../context/ToastContext'
import { getCurrentMonth, formatMonth, getActiveTenants, getMonthPayments, getBalance } from '../../utils/helpers'
import { generateReminderMessage } from '../../utils/generateReminderMessage'
import MonthSelector from '../../components/ui/MonthSelector'
import EmptyState from '../../components/ui/EmptyState'
import Badge from '../../components/ui/Badge'

export default function RemindersPage() {
  const { tenants, payments, pgSettings } = useAppData()
  const { showToast } = useToast()
  const [month, setMonth] = useState(getCurrentMonth)
  const [lang, setLang] = useState('en')
  const [expanded, setExpanded] = useState({})

  const activeTenants = getActiveTenants(tenants)
  const monthPayments = getMonthPayments(payments, month)

  const pendingRows = activeTenants
    .map(t => ({
      tenant: t,
      payment: monthPayments.find(p => p.tenantId === t.id) ?? null,
    }))
    .filter(({ payment }) => !payment || payment.status !== 'paid')

  function openWhatsApp(tenant, payment) {
    const msg = generateReminderMessage(tenant, payment, pgSettings, lang)
    const phone = tenant.phone.replace(/\D/g, '')
    const url = `https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank', 'noopener')
    showToast(`Opening WhatsApp for ${tenant.name}.`)
  }

  function sendAll() {
    pendingRows.forEach(({ tenant, payment }, i) => {
      setTimeout(() => openWhatsApp(tenant, payment), i * 500)
    })
  }

  function toggle(id) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Space Grotesk' }}>Payment Reminders</h1>
          <p className="text-slate-500 text-sm mt-1">WhatsApp reminders for tenants with pending dues</p>
        </div>
        <MonthSelector value={month} onChange={setMonth} />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mb-5">
        {/* Language toggle */}
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
            onClick={sendAll}
            className="flex items-center gap-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-500 px-4 py-2.5 rounded-xl transition-colors"
          >
            <MessageCircle size={15} />
            Send All ({pendingRows.length})
          </button>
        )}
      </div>

      {/* List */}
      {pendingRows.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={`All clear for ${formatMonth(month)}`}
          message="All active tenants have paid their rent this month. No reminders needed."
        />
      ) : (
        <div className="space-y-3">
          <p className="text-slate-500 text-sm">{pendingRows.length} tenant(s) have pending dues for {formatMonth(month)}</p>
          {pendingRows.map(({ tenant, payment }) => {
            const balance = payment ? getBalance(payment) : tenant.rentAmount
            const status = payment?.status ?? 'pending'
            const isOpen = expanded[tenant.id]
            const msg = generateReminderMessage(tenant, payment, pgSettings, lang)

            return (
              <div key={tenant.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between p-5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold shrink-0">
                      {tenant.name[0]}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{tenant.name}</p>
                      <p className="text-slate-400 text-xs">Room {tenant.room} · Due: ₹{balance.toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge status={status} />
                    <button
                      onClick={() => toggle(tenant.id)}
                      className="text-slate-400 hover:text-slate-600 p-1 transition-colors"
                      title="Preview message"
                    >
                      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <button
                      onClick={() => openWhatsApp(tenant, payment)}
                      className="flex items-center gap-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-500 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <MessageCircle size={14} />
                      WhatsApp
                    </button>
                  </div>
                </div>

                {/* Message preview */}
                {isOpen && (
                  <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Message Preview</p>
                    <pre className="text-slate-700 text-sm whitespace-pre-wrap font-sans leading-relaxed">{msg}</pre>
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
