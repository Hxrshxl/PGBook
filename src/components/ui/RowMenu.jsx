'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { MoreHorizontal } from 'lucide-react'

/**
 * The "…" menu at the end of a table row.
 * items: [{ label, onClick? | href?, danger?, hidden? }] — use { divider: true } for a separator.
 */
export default function RowMenu({ items, label = 'Actions' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const visible = items.filter(i => !i.hidden)

  useEffect(() => {
    if (!open) return
    const close = e => { if (!ref.current?.contains(e.target)) setOpen(false) }
    const esc = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [open])

  if (!visible.some(i => !i.divider)) return null
  const itemCls = danger => `flex w-full items-center px-3 py-1.5 text-left text-sm ${danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-50'}`

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        onClick={() => setOpen(v => !v)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-1 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {visible.map((item, i) => item.divider
            ? <div key={`d${i}`} className="my-1 h-px bg-slate-100" />
            : item.href
              ? <Link key={item.label} href={item.href} role="menuitem" onClick={() => setOpen(false)} className={itemCls(item.danger)}>{item.label}</Link>
              : <button key={item.label} role="menuitem" onClick={() => { setOpen(false); item.onClick() }} className={itemCls(item.danger)}>{item.label}</button>)}
        </div>
      )}
    </div>
  )
}
