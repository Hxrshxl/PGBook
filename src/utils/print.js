// Prints the given HTML through a hidden iframe, so popup blockers never interfere.
// The browser's print dialog also offers "Save as PDF".
export function printHtml(html, title) {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
  document.body.appendChild(frame)
  const doc = frame.contentWindow.document
  doc.open()
  doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>body{margin:0;padding:20px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}</style></head><body>${html}</body></html>`)
  doc.close()
  frame.contentWindow.focus()
  setTimeout(() => {
    frame.contentWindow.print()
    setTimeout(() => frame.remove(), 1000)
  }, 250)
}
