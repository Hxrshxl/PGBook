'use client'
import { numberToWords } from '@/utils/numberToWords'
import { formatDate, formatMonth, getBalance, getPaymentEntries, getTotalDue, PAYMENT_METHOD_LABELS } from '@/utils/helpers'

const rupees = n => '₹' + Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })
const cell = { padding: '10px 14px' }
const muted = { color: '#64748b' }

// Uses inline styles only, so the markup prints identically outside the app.
export default function ReceiptTemplate({ tenant, payment, pgSettings, receiptNumber }) {
  const total = getTotalDue(payment)
  const amountPaid = payment.amountPaid ?? 0
  const balance = getBalance(payment)
  const entries = getPaymentEntries(payment)
  const brand = pgSettings.logoText || pgSettings.pgName || 'PG Name'

  return (
    <div style={{
      fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '13px', color: '#111',
      maxWidth: '680px', margin: '0 auto', padding: '36px', border: '1px solid #e2e8f0', background: '#fff',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '24px', paddingBottom: '18px', borderBottom: '2px solid #6366f1' }}>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#4f46e5' }}>{brand}</div>
          <div style={{ ...muted, fontSize: '12px', marginTop: '4px', lineHeight: 1.6 }}>
            {pgSettings.address && <>{pgSettings.address}<br /></>}
            {pgSettings.phone && <>Phone: {pgSettings.phone}</>}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '18px', fontWeight: 700 }}>RENT RECEIPT</div>
          <div style={{ ...muted, fontSize: '12px', marginTop: '4px', lineHeight: 1.6 }}>
            Receipt No: <strong style={{ color: '#111' }}>{receiptNumber}</strong><br />
            Date: {formatDate(payment.paidDate)}
          </div>
        </div>
      </div>

      <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '14px 18px', marginBottom: '20px' }}>
        <div style={{ ...muted, fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Received from</div>
        <div style={{ fontSize: '16px', fontWeight: 700 }}>{tenant.name}</div>
        <div style={{ ...muted, fontSize: '12px', marginTop: '2px' }}>Room {tenant.room}{pgSettings.pgName ? ` · ${pgSettings.pgName}` : ''}</div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
        <thead>
          <tr style={{ background: '#f1f5f9' }}>
            {['Description', 'Period', 'Amount'].map(h => (
              <th key={h} style={{ ...cell, textAlign: h === 'Amount' ? 'right' : 'left', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
            <td style={cell}>Room rent</td>
            <td style={{ ...cell, ...muted }}>{formatMonth(payment.month)}</td>
            <td style={{ ...cell, textAlign: 'right', fontWeight: 600 }}>{rupees(payment.rentAmount)}</td>
          </tr>
          {(payment.utilityShare ?? 0) > 0 && (
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={cell}>Utility share</td>
              <td style={{ ...cell, ...muted }}>{formatMonth(payment.month)}</td>
              <td style={{ ...cell, textAlign: 'right', fontWeight: 600 }}>{rupees(payment.utilityShare)}</td>
            </tr>
          )}
          <tr>
            <td colSpan={2} style={{ ...cell, fontWeight: 600 }}>Total due</td>
            <td style={{ ...cell, textAlign: 'right', fontWeight: 600 }}>{rupees(total)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr style={{ background: '#f8fafc', borderTop: '2px solid #6366f1' }}>
            <td colSpan={2} style={{ ...cell, fontWeight: 700, fontSize: '14px' }}>Amount received</td>
            <td style={{ ...cell, textAlign: 'right', fontWeight: 700, fontSize: '16px', color: '#4f46e5' }}>{rupees(amountPaid)}</td>
          </tr>
          {balance > 0 && (
            <tr>
              <td colSpan={2} style={{ ...cell, fontWeight: 600, color: '#b45309' }}>Balance pending</td>
              <td style={{ ...cell, textAlign: 'right', fontWeight: 600, color: '#b45309' }}>{rupees(balance)}</td>
            </tr>
          )}
        </tfoot>
      </table>

      <div style={{ background: '#eff6ff', borderRadius: '6px', padding: '10px 14px', marginBottom: '16px', fontSize: '12px', color: '#1e40af' }}>
        <strong>In words:</strong> {numberToWords(amountPaid)}
      </div>

      {entries.length > 0 && (
        <div style={{ fontSize: '12px', ...muted, marginBottom: '24px', lineHeight: 1.7 }}>
          <strong style={{ color: '#334155' }}>Payment details:</strong><br />
          {entries.map(e => (
            <span key={e.id}>
              {formatDate(e.date)} — {rupees(e.amount)} via {PAYMENT_METHOD_LABELS[e.method] ?? e.method}{e.note ? ` (${e.note})` : ''}<br />
            </span>
          ))}
        </div>
      )}

      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px' }}>
        <div style={{ color: '#94a3b8', fontSize: '11px' }}>
          This is a computer-generated receipt.<br />
          No physical signature required.
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #111', paddingTop: '6px', width: '170px', fontSize: '12px', color: '#64748b' }}>
            {pgSettings.ownerName ? `${pgSettings.ownerName}, ` : ''}Owner<br />
            {pgSettings.pgName}
          </div>
        </div>
      </div>
    </div>
  )
}
