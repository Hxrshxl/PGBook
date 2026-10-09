'use client'
import { useEffect, useState } from 'react'
import { Smartphone } from 'lucide-react'

export function upiLink({ pa, pn, am, tn }) {
  const params = new URLSearchParams({ pa, pn, am: Number(am).toFixed(2), cu: 'INR', tn })
  return `upi://pay?${params.toString()}`
}

// "Pay via UPI": opens GPay/PhonePe/Paytm on a phone; shows a QR code to scan on a computer.
export default function UpiPay({ upi }) {
  const [qr, setQr] = useState(null)
  const link = upiLink(upi)
  useEffect(() => {
    let cancelled = false
    import('qrcode').then(({ default: QRCode }) => QRCode.toDataURL(link, { margin: 1, width: 220 })).then(url => { if (!cancelled) setQr(url) }).catch(() => {})
    return () => { cancelled = true }
  }, [link])
  return (
    <div className="space-y-3">
      <a href={link} className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm">
        <Smartphone size={16} /> Pay ₹{Number(upi.am).toLocaleString('en-IN')} via UPI
      </a>
      <details className="text-center">
        <summary className="text-xs text-slate-500 cursor-pointer">On a computer? Scan a QR code</summary>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {qr && <img src={qr} alt="UPI QR code" className="mx-auto mt-2 w-44 h-44" />}
        <p className="text-xs text-slate-500 mt-1">UPI ID: <span className="font-medium text-slate-700">{upi.pa}</span></p>
      </details>
    </div>
  )
}
