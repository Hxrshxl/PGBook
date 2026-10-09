'use client'
import { numberToWords } from '@/utils/numberToWords'
import { GST_STATE_NAMES } from '@/utils/gst'

const rupees = n => '₹' + Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const date = d => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '—')
const cell = { padding: '8px 12px', borderBottom: '1px solid #e2e8f0' }
const muted = { color: '#64748b' }

function Party({ label, party }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ ...muted, fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontWeight: 700 }}>{party.name}</div>
      {party.address && <div style={{ ...muted, fontSize: '12px', marginTop: '2px' }}>{party.address}</div>}
      {party.stateCode && <div style={{ ...muted, fontSize: '12px' }}>State: {GST_STATE_NAMES[party.stateCode] ?? party.stateCode} ({party.stateCode})</div>}
      {party.gstin && <div style={{ fontSize: '12px', marginTop: '2px' }}>GSTIN: <strong>{party.gstin}</strong></div>}
      {party.email && <div style={{ ...muted, fontSize: '12px' }}>{party.email}</div>}
    </div>
  )
}

// Inline styles only, so it prints the same outside the app.
export default function InvoiceTemplate({ invoice }) {
  const taxInvoice = invoice.gstRate > 0
  const sameState = invoice.cgst > 0 || invoice.sgst > 0
  return (
    <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '13px', color: '#111', maxWidth: '720px', margin: '0 auto', padding: '32px', border: '1px solid #e2e8f0', background: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', paddingBottom: '16px', borderBottom: '2px solid #4f46e5', marginBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#4f46e5' }}>{invoice.seller.name}</div>
          <div style={{ ...muted, fontSize: '12px' }}>PG management software</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '18px', fontWeight: 700 }}>{taxInvoice ? 'TAX INVOICE' : 'INVOICE'}</div>
          <div style={{ ...muted, fontSize: '12px', lineHeight: 1.6 }}>
            No: <strong style={{ color: '#111' }}>{invoice.number}</strong><br />
            Date: {date(invoice.issuedAt)}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '24px', marginBottom: '20px' }}>
        <Party label="From" party={invoice.seller} />
        <Party label="Billed to" party={invoice.buyer} />
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px' }}>
        <thead>
          <tr style={{ background: '#f1f5f9' }}>
            {['Description', 'SAC', 'Period', 'Amount'].map(h => (
              <th key={h} style={{ ...cell, textAlign: h === 'Amount' ? 'right' : 'left', fontSize: '11px', ...muted, textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={cell}>{invoice.description}</td>
            <td style={{ ...cell, ...muted }}>{invoice.sacCode}</td>
            <td style={{ ...cell, ...muted }}>{invoice.periodStart ? `${date(invoice.periodStart)} – ${date(invoice.periodEnd)}` : '—'}</td>
            <td style={{ ...cell, textAlign: 'right' }}>{rupees(invoice.taxable)}</td>
          </tr>
          {taxInvoice && sameState && (
            <>
              <tr><td colSpan={3} style={{ ...cell, ...muted }}>CGST @ {invoice.gstRate / 2}%</td><td style={{ ...cell, textAlign: 'right' }}>{rupees(invoice.cgst)}</td></tr>
              <tr><td colSpan={3} style={{ ...cell, ...muted }}>SGST @ {invoice.gstRate / 2}%</td><td style={{ ...cell, textAlign: 'right' }}>{rupees(invoice.sgst)}</td></tr>
            </>
          )}
          {taxInvoice && !sameState && (
            <tr><td colSpan={3} style={{ ...cell, ...muted }}>IGST @ {invoice.gstRate}%</td><td style={{ ...cell, textAlign: 'right' }}>{rupees(invoice.igst)}</td></tr>
          )}
        </tbody>
        <tfoot>
          <tr style={{ background: '#f8fafc' }}>
            <td colSpan={3} style={{ ...cell, fontWeight: 700 }}>Total paid</td>
            <td style={{ ...cell, textAlign: 'right', fontWeight: 700, fontSize: '15px', color: '#4f46e5' }}>{rupees(invoice.total)}</td>
          </tr>
        </tfoot>
      </table>
      <div style={{ background: '#eff6ff', borderRadius: '6px', padding: '8px 12px', fontSize: '12px', color: '#1e40af', marginBottom: '16px' }}>
        <strong>In words:</strong> {numberToWords(invoice.total)}
      </div>
      <div style={{ ...muted, fontSize: '11px', lineHeight: 1.6 }}>
        {taxInvoice ? `Place of supply: ${GST_STATE_NAMES[invoice.buyer.stateCode || invoice.seller.stateCode] ?? '—'}. Tax is not payable on reverse charge basis.` : 'The supplier is not registered under GST, so no GST is charged.'}<br />
        Paid online{invoice.provider === 'razorpay' ? ' via Razorpay' : ''}. This is a computer-generated invoice and needs no signature.
      </div>
    </div>
  )
}
