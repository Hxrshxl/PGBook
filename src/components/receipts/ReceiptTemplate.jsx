'use client'
import { numberToWords } from '../../utils/numberToWords'
import { formatMonth, getTotalDue } from '../../utils/helpers'

export default function ReceiptTemplate({ tenant, payment, pgSettings, receiptNumber }) {
  const total = getTotalDue(payment)
  const amountPaid = payment.amountPaid ?? 0
  const paidDate = payment.paidDate
    ? new Date(payment.paidDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div style={{
      fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#111',
      maxWidth: '680px', margin: '0 auto', padding: '40px', border: '1px solid #e2e8f0',
      background: '#fff',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', paddingBottom: '20px', borderBottom: '2px solid #6366f1' }}>
        <div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: '#6366f1', letterSpacing: '-0.5px' }}>
            {pgSettings.pgName || 'PG Name'}
          </div>
          <div style={{ color: '#64748b', fontSize: '12px', marginTop: '4px', lineHeight: '1.6' }}>
            {pgSettings.address || 'PG Address'}<br />
            {pgSettings.phone && <>Phone: {pgSettings.phone}</>}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#111' }}>RENT RECEIPT</div>
          <div style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>
            Receipt No: <strong>{receiptNumber}</strong><br />
            Date: {paidDate}
          </div>
        </div>
      </div>

      {/* Received from */}
      <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '16px 20px', marginBottom: '20px' }}>
        <div style={{ color: '#64748b', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Received From</div>
        <div style={{ fontSize: '16px', fontWeight: '700' }}>{tenant.name}</div>
        <div style={{ color: '#64748b', fontSize: '12px', marginTop: '2px' }}>Room {tenant.room} · {pgSettings.pgName}</div>
      </div>

      {/* Breakdown table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
        <thead>
          <tr style={{ background: '#f1f5f9' }}>
            {['Description', 'Period', 'Amount'].map(h => (
              <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Amount' ? 'right' : 'left', fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
            <td style={{ padding: '12px 14px' }}>Room Rent</td>
            <td style={{ padding: '12px 14px', color: '#64748b' }}>{formatMonth(payment.month)}</td>
            <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '600' }}>₹{(payment.rentAmount ?? 0).toLocaleString('en-IN')}</td>
          </tr>
          {(payment.utilityShare ?? 0) > 0 && (
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '12px 14px' }}>Utility Share</td>
              <td style={{ padding: '12px 14px', color: '#64748b' }}>{formatMonth(payment.month)}</td>
              <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '600' }}>₹{(payment.utilityShare).toLocaleString('en-IN')}</td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr style={{ background: '#f8fafc', borderTop: '2px solid #6366f1' }}>
            <td colSpan={2} style={{ padding: '12px 14px', fontWeight: '700', fontSize: '14px' }}>Amount Paid</td>
            <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '700', fontSize: '16px', color: '#6366f1' }}>₹{amountPaid.toLocaleString('en-IN')}</td>
          </tr>
        </tfoot>
      </table>

      {/* Amount in words */}
      <div style={{ background: '#eff6ff', borderRadius: '6px', padding: '10px 14px', marginBottom: '20px', fontSize: '12px', color: '#1e40af' }}>
        <strong>In words:</strong> {numberToWords(amountPaid)}
      </div>

      {/* Payment mode + UPI */}
      {pgSettings.upiId && (
        <div style={{ marginBottom: '28px', fontSize: '12px', color: '#64748b' }}>
          UPI ID: <strong>{pgSettings.upiId}</strong>
        </div>
      )}

      {/* Footer */}
      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ color: '#94a3b8', fontSize: '11px' }}>
          This is a computer-generated receipt.<br />
          No physical signature required.
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #111', paddingTop: '6px', width: '160px', fontSize: '12px', color: '#64748b' }}>
            {pgSettings.ownerName ? `${pgSettings.ownerName}, ` : ''}Owner<br />
            {pgSettings.pgName}
          </div>
        </div>
      </div>
    </div>
  )
}
