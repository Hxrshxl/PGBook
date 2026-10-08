import { formatMonth, getBalance, getTotalDue } from './helpers.js'

function dueDateText(month, rentDueDay, lang) {
  if (!rentDueDay || !month) return ''
  const [y, m] = month.split('-').map(Number)
  const date = new Date(y, m - 1, rentDueDay).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'long' })
  return lang === 'hi' ? `\n🗓️ अंतिम तिथि: *${date}*` : `\n🗓️ Due date: *${date}*`
}

/**
 * Builds the WhatsApp reminder text. `payment` may be null when no dues have
 * been created for the month yet — `month` is then used directly.
 */
export function generateReminderMessage(tenant, payment, pgSettings, lang = 'en', month = payment?.month) {
  const monthLabel = formatMonth(payment?.month ?? month)
  const due = payment ? getBalance(payment) : tenant.rentAmount
  const total = payment ? getTotalDue(payment) : tenant.rentAmount
  const partial = payment && payment.amountPaid > 0
  const pg = pgSettings.pgName || pgSettings.logoText || 'Your PG'
  const rupees = n => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })
  const dueLine = dueDateText(payment?.month ?? month, pgSettings.rentDueDay, lang)

  if (lang === 'hi') {
    const upiLine = pgSettings.upiId ? `\n💳 UPI ID: *${pgSettings.upiId}* पर भेज दीजिए।` : ''
    return `नमस्ते ${tenant.name} जी 🙏

आपके कमरे *${tenant.room}* का *${monthLabel}* महीने का किराया${partial ? ` (${rupees(total)} में से ${rupees(due)} बाकी है)` : ` ${rupees(due)} अभी बाकी है`}।
${dueLine}${upiLine}

कोई दिक्कत हो तो बताइए।

धन्यवाद 🙏
— ${pg}`
  }

  const upiLine = pgSettings.upiId ? `\n💳 Please pay via UPI: *${pgSettings.upiId}*` : ''
  return `Hi ${tenant.name} 👋

This is a gentle reminder that your rent for *Room ${tenant.room}* — *${monthLabel}* is${partial ? ` partially pending. Amount due: *${rupees(due)}* (of ${rupees(total)} total)` : ` due: *${rupees(due)}*`}.
${dueLine}${upiLine}

Let us know if you have any questions.

Thanks,
${pg}`
}
