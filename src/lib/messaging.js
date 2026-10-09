// Outgoing email and SMS through whichever provider is configured.
//
//   Email: RESEND_API_KEY + EMAIL_FROM (Resend). Without them, emails are written to the server log.
//   SMS login codes: SMS_PROVIDER=msg91 (MSG91_AUTH_KEY, MSG91_OTP_TEMPLATE_ID)
//                 or SMS_PROVIDER=twilio (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM).
//   Without an SMS provider, codes can only be used in local development (see devMode.js).
//
// Sending never throws for email: a notification that can't be delivered must not
// break the action that triggered it. OTP sending does throw, so the user knows.

export function emailConfigured() {
  return !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
}

export async function sendEmail({ to, subject, text }) {
  if (!to) return { sent: false }
  if (!emailConfigured()) {
    console.info(`[email:log] to=${to} subject="${subject}"\n${text}`)
    return { sent: false, logged: true }
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text }),
    })
    if (!res.ok) console.error('[email] provider error', res.status, await res.text().catch(() => ''))
    return { sent: res.ok }
  } catch (err) {
    console.error('[email] failed', err)
    return { sent: false }
  }
}

export function smsProvider() {
  const p = process.env.SMS_PROVIDER
  if (p === 'msg91' && process.env.MSG91_AUTH_KEY && process.env.MSG91_OTP_TEMPLATE_ID) return 'msg91'
  if (p === 'twilio' && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM) return 'twilio'
  return null
}

/** Sends a login code. phone is digits with country code, e.g. 919876543210. */
export async function sendOtp(phone, code) {
  const provider = smsProvider()
  if (provider === 'msg91') {
    const url = new URL('https://control.msg91.com/api/v5/otp')
    url.searchParams.set('template_id', process.env.MSG91_OTP_TEMPLATE_ID)
    url.searchParams.set('mobile', phone)
    url.searchParams.set('otp', code)
    const res = await fetch(url, { method: 'POST', headers: { authkey: process.env.MSG91_AUTH_KEY, 'Content-Type': 'application/json' } })
    if (!res.ok) throw new Error(`MSG91 error ${res.status}`)
    return
  }
  if (provider === 'twilio') {
    const sid = process.env.TWILIO_ACCOUNT_SID
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: `+${phone}`, From: process.env.TWILIO_FROM, Body: `${code} is your PGBook login code. It expires in 10 minutes. Don't share it with anyone.` }),
    })
    if (!res.ok) throw new Error(`Twilio error ${res.status}`)
    return
  }
  // Development only (callers check devFallbacksAllowed first).
  console.info(`[sms:log] login code for +${phone}: ${code}`)
}
