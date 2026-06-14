import { formatMonth, getBalance, getTotalDue } from './helpers'

export function generateReminderMessage(tenant, payment, pgSettings, lang = 'en') {
  const month = formatMonth(payment?.month ?? '')
  const due = payment ? getBalance(payment) : tenant.rentAmount
  const total = payment ? getTotalDue(payment) : tenant.rentAmount
  const partial = payment && payment.amountPaid > 0
  const upi = pgSettings.upiId || 'N/A'
  const pg = pgSettings.pgName || 'Your PG'

  if (lang === 'hi') {
    return `नमस्ते ${tenant.name} जी 🙏

आपके कमरे *${tenant.room}* का *${month}* महीने का किराया${partial ? ` (₹${total.toLocaleString('en-IN')} में से ₹${due.toLocaleString('en-IN')} बाकी है)` : ` ₹${due.toLocaleString('en-IN')} अभी बाकी है`}।

💳 UPI ID: *${upi}* पर भेज दीजिए।

कोई दिक्कत हो तो बताइए।

धन्यवाद 🙏
— ${pg}`
  }

  return `Hi ${tenant.name} 👋

This is a gentle reminder that your rent for *Room ${tenant.room}* — *${month}* is${partial ? ` partially pending. Amount due: *₹${due.toLocaleString('en-IN')}* (of ₹${total.toLocaleString('en-IN')} total)` : ` due: *₹${due.toLocaleString('en-IN')}*`}.

💳 Please transfer to UPI: *${upi}*

Let us know if you have any questions.

Thanks,
${pg}`
}
