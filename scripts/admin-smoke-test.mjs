// End-to-end test of the SuperAdmin console API against a running server.
// Use a THROWAWAY database — the test creates admins directly in it and drops it at the end.
//
//   MONGODB_URI=mongodb://127.0.0.1:27017/pgbook_admin_test  (same DB the server uses)
//   BASE_URL=http://localhost:3000 node scripts/admin-smoke-test.mjs
import mongoose from 'mongoose'
import PlatformAdmin from '../src/lib/models/PlatformAdmin.js'
import AuditEvent from '../src/lib/models/AuditEvent.js'
import { totpAt, currentStep } from '../src/lib/totp.js'

const BASE = (process.env.BASE_URL ?? 'http://localhost:3000') + '/api'
const DB = process.env.MONGODB_URI
if (!DB || !/test|smoke|tmp|throwaway/i.test(DB)) {
  console.error('Set MONGODB_URI to a throwaway database (its name must contain "test", "smoke" or "tmp").')
  process.exit(1)
}
const run = Date.now().toString(36)
let passes = 0
let failures = 0
function check(name, ok, detail = '') {
  if (ok) { passes++; console.log(`  ✓ ${name}`) } else { failures++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`) }
}
const sleep = ms => new Promise(r => setTimeout(r, ms))

// Minimal cookie-jar HTTP client
function client() {
  const jar = new Map()
  async function call(method, path, body, headers = {}) {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(jar.size ? { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';')
      const [name, ...value] = pair.split('=')
      const v = value.join('=')
      if (!v || /max-age=0/i.test(c)) jar.delete(name)
      else jar.set(name, v)
    }
    const text = await res.text()
    let data = null
    try { data = JSON.parse(text) } catch { data = text }
    return { status: res.status, data, headers: res.headers }
  }
  call.jar = jar
  return call
}

// TOTP codes: each step can be used once per admin, and ±1 step is accepted.
const lastStep = new Map()
const secrets = new Map()
async function code(email) {
  for (;;) {
    const now = currentStep()
    const step = Math.max(now - 1, (lastStep.get(email) ?? -Infinity) + 1)
    if (step <= now + 1) {
      lastStep.set(email, step)
      return totpAt(secrets.get(email), step)
    }
    await sleep(2000)
  }
}

async function signIn(call, email, password) {
  const r = await call('POST', '/admin/auth/login', { email, password })
  if (r.status !== 200) return r
  if (r.data.next === 'enroll') {
    const e = await call('GET', '/admin/auth/enroll')
    secrets.set(email, e.data.secret.replace(/\s/g, ''))
    return call('POST', '/admin/auth/enroll', { code: await code(email) })
  }
  return call('POST', '/admin/auth/verify', { code: await code(email) })
}

await mongoose.connect(DB)
const PASSWORD = 'correct-horse-battery-staple'
const make = (email, name, role) => PlatformAdmin.create({ email, name, role, password: PASSWORD, status: 'active' })
const emails = { sa1: `sa1-${run}@pgbook.test`, sa2: `sa2-${run}@pgbook.test`, sup: `sup-${run}@pgbook.test`, ana: `ana-${run}@pgbook.test`, lock: `lock-${run}@pgbook.test` }
await make(emails.sa1, 'Asha Super', 'super_admin')
await make(emails.sa2, 'Bala Super', 'super_admin')
await make(emails.sup, 'Chitra Support', 'support_agent')
await make(emails.ana, 'Dev Analyst', 'analyst')
await make(emails.lock, 'Esha Locked', 'billing_admin')

try {
  // ── Owner fixture ─────────────────────────────────────────
  const owner = client()
  const ownerEmail = `owner-${run}@pgbook.test`
  let r = await owner('POST', '/auth/signup', { name: '=HYPERLINK("http://evil")', pgName: 'Test PG', email: ownerEmail, password: 'owner-pass-123' })
  const ownerId = r.data.user.id
  const t = await owner('POST', '/tenants', { name: 'Secret Tenant Name', phone: '9000000001', room: '101', rentAmount: 7777.77 })
  await owner('POST', `/payments/${t.data.payment.id}/transactions`, { amount: 4321.55, method: 'cash' })
  await owner('PUT', '/settings', { upiId: `owner-${run}@upi` })

  console.log('\nAdmin sign-in & realm separation')
  const sa1 = client()
  r = await sa1('GET', '/admin/overview')
  check('admin API without a session → 401', r.status === 401)
  r = await sa1('POST', '/admin/auth/login', { email: emails.sa1, password: 'wrong' })
  check('wrong password → 401', r.status === 401)
  r = await sa1('POST', '/admin/auth/login', { email: emails.sa1, password: PASSWORD })
  check('password step asks for 2FA enrolment first', r.status === 200 && r.data.next === 'enroll')
  r = await sa1('GET', '/admin/overview')
  check('password alone does not grant a session', r.status === 401)
  const enroll = await sa1('GET', '/admin/auth/enroll')
  check('enrolment returns a QR code and secret', enroll.status === 200 && enroll.data.qr?.startsWith('data:image/png') && !!enroll.data.secret)
  secrets.set(emails.sa1, enroll.data.secret.replace(/\s/g, ''))
  r = await sa1('POST', '/admin/auth/enroll', { code: '000000' })
  check('wrong enrolment code rejected', r.status === 401)
  r = await sa1('POST', '/admin/auth/enroll', { code: await code(emails.sa1) })
  check('valid code enrols 2FA and signs in', r.status === 200 && r.data.admin.twoFactorEnabled)
  r = await sa1('GET', '/admin/auth/me')
  check('/auth/me returns role & capabilities', r.data.admin.role === 'super_admin' && r.data.admin.capabilities.includes('orgs.suspend'))
  check('no secrets in the admin profile', !['password', 'totpSecret', 'totpPendingSecret', 'lastTotpStep', 'tokenVersion', 'inviteTokenHash'].some(k => k in r.data.admin))

  const replay = client()
  await replay('POST', '/admin/auth/login', { email: emails.sa1, password: PASSWORD })
  r = await replay('POST', '/admin/auth/verify', { code: totpAt(secrets.get(emails.sa1), lastStep.get(emails.sa1)) })
  check('a used 2FA code cannot be replayed', r.status === 401)

  const forged = client()
  forged.jar.set('pgbook_admin', owner.jar.get('pgbook_session'))
  r = await forged('GET', '/admin/overview')
  check('owner session token rejected by admin API', r.status === 401)
  const forged2 = client()
  forged2.jar.set('pgbook_session', sa1.jar.get('pgbook_admin'))
  r = await forged2('GET', '/tenants')
  check('admin session token rejected by owner API', r.status === 401)
  r = await sa1('POST', '/admin/auth/logout', {}, { Origin: 'https://evil.example' })
  check('cross-site POST to admin API blocked', r.status === 403)

  console.log('\nOverview, owners & privacy')
  r = await sa1('GET', '/admin/overview')
  check('overview loads', r.status === 200 && r.data.owners.total >= 1 && r.data.health.dbLatencyMs >= 0)
  check('₹ totals hidden below 10 contributing owners', r.data.usage.paymentsVolume === null)
  r = await sa1('GET', `/admin/owners?q=${encodeURIComponent(ownerEmail)}`)
  check('owner search', r.status === 200 && r.data.owners.length === 1 && r.data.owners[0].activeTenants === 1)
  r = await sa1('GET', `/admin/owners/${ownerId}`)
  const detail = JSON.stringify(r.data)
  check('owner detail shows usage counts', r.status === 200 && r.data.usage.activeTenants === 1 && r.data.usage.paymentsRecorded30 === 1)
  check('owner detail has no tenant names or amounts', !detail.includes('Secret Tenant Name') && !detail.includes('4321.55') && !detail.includes('7777.77'))
  r = await sa1('GET', `/admin/owners/${ownerId}/activity`)
  const activity = JSON.stringify(r.data)
  check('admin view of owner activity is redacted', r.status === 200 && activity.includes('payment.record') && !activity.includes('Secret Tenant Name') && !activity.includes('4321.55'))
  check('admin view does not reveal the payout UPI ID', !activity.includes(`owner-${run}@upi`))

  const ana = client()
  await signIn(ana, emails.ana, PASSWORD)
  r = await ana('GET', '/admin/overview')
  check('analyst sees aggregates without account lists', r.status === 200 && r.data.attention.trialsEnding.length === 0 && r.data.activity.length === 0)
  r = await ana('GET', '/admin/owners')
  check('analyst cannot list owners', r.status === 403)

  console.log('\nAccount actions & approvals')
  r = await sa1('POST', `/admin/owners/${ownerId}/actions`, { action: 'extendTrial', days: 10 })
  check('actions require a reason', r.status === 400)
  r = await sa1('POST', `/admin/owners/${ownerId}/actions`, { action: 'extendTrial', days: 10, reason: 'Onboarding call ran late' })
  check('super admin extends trial', r.status === 200 && new Date(r.data.owner.trialEndsAt) > new Date(Date.now() + 20 * 86400000))

  const sup = client()
  await signIn(sup, emails.sup, PASSWORD)
  r = await sup('POST', `/admin/owners/${ownerId}/actions`, { action: 'extendTrial', days: 30, reason: 'Asked nicely' })
  check('support agent capped at 14 days', r.status === 403)
  r = await sup('POST', `/admin/owners/${ownerId}/actions`, { action: 'suspend', reason: 'Reported for fake listings' })
  check('support agent suspension becomes an approval request', r.status === 202 && r.data.approval.status === 'pending')
  const approvalId = r.data.approval.id
  r = await sup('POST', `/admin/owners/${ownerId}/actions`, { action: 'suspend', reason: 'again' })
  check('duplicate pending request rejected', r.status === 409)
  r = await sup('POST', `/admin/approvals/${approvalId}`, { decision: 'approve' })
  check('requester cannot approve own request', r.status === 403)

  await PlatformAdmin.updateOne({ email: emails.sa1 }, { $set: { stepUpAt: new Date(Date.now() - 10 * 60000) } })
  r = await sa1('POST', `/admin/approvals/${approvalId}`, { decision: 'approve' })
  check('approving needs a fresh 2FA code', r.status === 403 && r.data.code === 'STEP_UP_REQUIRED')
  r = await sa1('POST', '/admin/auth/step-up', { code: '123456' })
  check('wrong step-up code rejected', r.status === 401)
  r = await sa1('POST', '/admin/auth/step-up', { code: await code(emails.sa1) })
  check('step-up with a valid code', r.status === 200)
  r = await sa1('POST', `/admin/approvals/${approvalId}`, { decision: 'approve', note: 'Verified the reports' })
  check('second admin approves → suspension applied', r.status === 200 && r.data.approval.status === 'approved')

  r = await owner('GET', '/auth/me')
  check('suspension ends the owner\'s session immediately', r.status === 401)
  r = await owner('POST', '/auth/login', { email: ownerEmail, password: 'owner-pass-123' })
  check('suspended owner sees a clear message', r.status === 403 && /suspended/i.test(r.data.message))
  r = await owner('POST', '/auth/login', { email: ownerEmail, password: 'wrong' })
  check('suspension not revealed without the right password', r.status === 401)

  r = await sa1('POST', `/admin/owners/${ownerId}/actions`, { action: 'reactivate', reason: 'Owner provided documents' })
  check('super admin reactivates directly', r.status === 200 && r.data.owner.status === 'active')
  r = await owner('POST', '/auth/login', { email: ownerEmail, password: 'owner-pass-123' })
  check('owner can sign in again', r.status === 200)
  r = await owner('GET', '/activity?category=pgbook')
  const ownerView = r.data.events ?? []
  const suspended = ownerView.find(e => e.action === 'org.suspended')
  check('owner sees the suspension with its reason', !!suspended && /fake listings/.test(suspended.reason))
  check('owner sees admins by first name and role only, no IP', suspended?.actor.name === 'Asha' && suspended?.actor.role === 'super_admin' && !('ip' in suspended))
  r = await owner('GET', '/activity')
  check('internal approval steps hidden from owner', !(r.data.events ?? []).some(e => e.action.startsWith('approval.')))
  check('owner sees their own full detail (amounts, names)', JSON.stringify(r.data).includes('Secret Tenant Name') && JSON.stringify(r.data).includes('4321.55'))
  check('owner sees the UPI change as a security event', (r.data.events ?? []).some(e => e.action === 'settings.payout_upi_changed'))

  r = await sa1('POST', `/admin/owners/${ownerId}/actions`, { action: 'forceLogout', reason: 'Owner reported a lost phone' })
  r = await owner('GET', '/auth/me')
  check('force sign-out ends the owner session', r.status === 401)

  console.log('\nAudit log')
  r = await sa1('GET', '/admin/audit?action=org.')
  check('audit explorer filters by action', r.status === 200 && r.data.events.length >= 3 && r.data.events.every(e => e.action.startsWith('org.')))
  await PlatformAdmin.updateOne({ email: emails.sa1 }, { $set: { stepUpAt: new Date(Date.now() - 10 * 60000) } })
  r = await sa1('GET', '/admin/audit/export')
  check('CSV export needs step-up', r.status === 403 && r.data.code === 'STEP_UP_REQUIRED')
  await sa1('POST', '/admin/auth/step-up', { code: await code(emails.sa1) })
  r = await sa1('GET', '/admin/audit/export')
  check('CSV export works after step-up', r.status === 200 && String(r.data).startsWith('time,realm,actor'))
  check('CSV neutralises spreadsheet formulas', String(r.data).includes(`"'=HYPERLINK`) && !String(r.data).includes(',"=HYPERLINK'))
  r = await sa1('GET', '/admin/audit?action=audit.exported')
  check('the export itself is audited', r.data.events.length >= 1)
  let immutable = false
  try { await AuditEvent.updateOne({}, { $set: { action: 'tampered' } }) } catch { immutable = true }
  check('audit events cannot be modified', immutable)

  console.log('\nAdmin team (maker-checker)')
  r = await sa1('POST', '/admin/team', { type: 'invite', email: `new-${run}@pgbook.test`, name: 'Farah New', role: 'support_agent', reason: 'New support hire' })
  check('invite request created', r.status === 201)
  const inviteApproval = r.data.approval.id
  r = await sup('POST', '/admin/team', { type: 'invite', email: `x-${run}@pgbook.test`, name: 'X', role: 'super_admin', reason: 'sneaky' })
  check('support agent cannot request admin changes', r.status === 403)
  r = await sa1('POST', `/admin/approvals/${inviteApproval}`, { decision: 'approve' })
  check('super admin cannot approve own invite', r.status === 403)

  const sa2 = client()
  r = await signIn(sa2, emails.sa2, PASSWORD)
  check('second super admin signs in', r.status === 200)
  r = await sa2('POST', `/admin/approvals/${inviteApproval}`, { decision: 'approve' })
  check('second super admin approves invite → single-use link', r.status === 200 && /accept-invite\?token=/.test(r.data.result?.inviteUrl ?? ''))
  const token = new URL(r.data.result.inviteUrl).searchParams.get('token')
  const invitee = client()
  r = await invitee('GET', `/admin/auth/invite?token=${token}`)
  check('invite link shows who is invited', r.status === 200 && r.data.name === 'Farah New')
  r = await invitee('POST', '/admin/auth/invite', { token, password: 'short' })
  check('admin passwords need 12+ characters', r.status === 400)
  r = await invitee('POST', '/admin/auth/invite', { token, password: 'a-long-enough-password' })
  check('invite accepted', r.status === 200)
  r = await invitee('POST', '/admin/auth/invite', { token, password: 'a-long-enough-password' })
  check('invite link is single-use', r.status === 410)
  r = await signIn(invitee, `new-${run}@pgbook.test`, 'a-long-enough-password')
  check('new admin must set up 2FA, then gets support permissions', r.status === 200 && r.data.admin.role === 'support_agent')

  // Two super admins try to disable each other: the second must fail, or nobody could administer the platform.
  r = await sa1('POST', '/admin/team', { type: 'disable', adminId: (await PlatformAdmin.findOne({ email: emails.sa2 }))._id.toString(), reason: 'Leaving the company' })
  const disableSa2 = r.data.approval.id
  r = await sa2('POST', '/admin/team', { type: 'disable', adminId: (await PlatformAdmin.findOne({ email: emails.sa1 }))._id.toString(), reason: 'Retaliation' })
  const disableSa1 = r.data.approval.id
  r = await sa2('POST', `/admin/approvals/${disableSa2}`, { decision: 'approve' })
  check('first disable goes through', r.status === 200)
  r = await sa2('GET', '/admin/auth/me')
  check('disabled admin is signed out immediately', r.status === 401)
  await sa1('POST', '/admin/auth/step-up', { code: await code(emails.sa1) })
  r = await sa1('POST', `/admin/approvals/${disableSa1}`, { decision: 'approve' })
  check('cannot disable the last active super admin', r.status === 409)

  console.log('\nLockout, idle timeout, logout')
  const lock = client()
  for (let i = 0; i < 5; i++) await lock('POST', '/admin/auth/login', { email: emails.lock, password: 'wrong' })
  r = await lock('POST', '/admin/auth/login', { email: emails.lock, password: PASSWORD })
  check('5 failures lock the account (even with the right password)', r.status === 429)

  await PlatformAdmin.updateOne({ email: emails.sup }, { $set: { lastActivityAt: new Date(Date.now() - 31 * 60000) } })
  r = await sup('GET', '/admin/auth/me')
  check('30 minutes idle ends the admin session', r.status === 401)

  const cookieBefore = sa1.jar.get('pgbook_admin')
  await sa1('POST', '/admin/auth/logout')
  const stolen = client()
  stolen.jar.set('pgbook_admin', cookieBefore)
  r = await stolen('GET', '/admin/auth/me')
  check('logout invalidates the token server-side (copied cookie stops working)', r.status === 401)
} finally {
  await mongoose.connection.db.dropDatabase()
  await mongoose.disconnect()
}

console.log(`\n${passes} passed, ${failures} failed\n`)
process.exit(failures ? 1 : 0)
