// PGBook admin CLI — for people with server access. Used to create the first Super Admin
// and to recover a locked-out admin. Everything it does is written to the audit log.
//
//   npm run admin -- create --email=you@pgbook.in --name="Your Name" [--role=super_admin]
//   npm run admin -- list
//   npm run admin -- reset-2fa --email=...      (next sign-in sets up a new authenticator)
//   npm run admin -- reset-password --email=... (prints a new temporary password)
//   npm run admin -- unlock --email=...         (clears a temporary lockout)
//
// After the first Super Admin exists, add teammates from the console (Admin Team),
// where every change needs a second Super Admin's approval.
import crypto from 'node:crypto'
import mongoose from 'mongoose'
import PlatformAdmin from '../src/lib/models/PlatformAdmin.js'
import AuditEvent from '../src/lib/models/AuditEvent.js'

const ROLES = ['super_admin', 'billing_admin', 'support_agent', 'compliance_officer', 'analyst']
const CLI_ACTOR = { realm: 'system', id: null, name: 'Admin CLI (server access)', role: 'system' }

const [command, ...rest] = process.argv.slice(2)
const args = Object.fromEntries(rest.filter(a => a.startsWith('--')).map(a => {
  const [key, ...value] = a.slice(2).split('=')
  return [key, value.join('=') || true]
}))

function fail(message) {
  console.error(`✗ ${message}`)
  process.exit(1)
}

function temporaryPassword() {
  return crypto.randomBytes(12).toString('base64url') // 16 chars
}

async function audit(action, admin, details) {
  await AuditEvent.create({
    actor: CLI_ACTOR,
    action,
    target: admin ? { kind: 'admin', id: admin._id.toString(), label: `${admin.name} <${admin.email}>` } : undefined,
    details,
    userAgent: `cli on ${process.platform}`,
  })
}

async function byEmail() {
  const email = String(args.email ?? '').toLowerCase().trim()
  if (!email) fail('Pass --email=...')
  const admin = await PlatformAdmin.findOne({ email }).select('+totpSecret +totpPendingSecret +lastTotpStep +password')
  if (!admin) fail(`No admin with email ${email}.`)
  return admin
}

if (!process.env.MONGODB_URI) fail('MONGODB_URI is not set. Run with --env-file=.env.local (npm run admin does this).')
if (!command || command === 'help') {
  console.log('Commands: create, list, reset-2fa, reset-password, unlock. See the top of scripts/admin.mjs.')
  process.exit(0)
}

await mongoose.connect(process.env.MONGODB_URI)
try {
  switch (command) {
    case 'create': {
      const email = String(args.email ?? '').toLowerCase().trim()
      const name = String(args.name ?? '').trim()
      const role = String(args.role ?? 'super_admin')
      if (!email || !name) fail('Pass --email=... and --name="..."')
      if (!ROLES.includes(role)) fail(`Role must be one of: ${ROLES.join(', ')}`)
      if (await PlatformAdmin.exists({ email })) fail(`An admin with email ${email} already exists.`)
      const password = temporaryPassword()
      const admin = await PlatformAdmin.create({ email, name, role, password, status: 'active' })
      await audit('admin.created_via_cli', admin, { role })
      console.log(`\n✓ Created ${role} ${name} <${email}>`)
      console.log(`  Temporary password: ${password}`)
      console.log('  Sign in at /admin/login — you will be asked to set up an authenticator app (required),')
      console.log('  then change this password under My Account.\n')
      break
    }
    case 'list': {
      const admins = await PlatformAdmin.find({}).sort({ createdAt: 1 })
      if (!admins.length) console.log('No admins yet. Create one with: npm run admin -- create --email=... --name="..."')
      for (const a of admins) {
        console.log(`${a.email.padEnd(32)} ${a.role.padEnd(20)} ${a.status.padEnd(9)} 2FA: ${a.totpEnabledAt ? 'on' : 'not set up'}`)
      }
      break
    }
    case 'reset-2fa': {
      const admin = await byEmail()
      admin.totpSecret = null
      admin.totpPendingSecret = null
      admin.totpEnabledAt = null
      admin.lastTotpStep = -1
      admin.tokenVersion += 1
      await admin.save()
      await audit('admin.2fa_reset_via_cli', admin)
      console.log(`✓ 2FA reset for ${admin.email}. Their next sign-in will set up a new authenticator.`)
      break
    }
    case 'reset-password': {
      const admin = await byEmail()
      const password = temporaryPassword()
      admin.password = password
      admin.tokenVersion += 1
      if (admin.status === 'invited') admin.status = 'active'
      await admin.save()
      await audit('admin.password_reset_via_cli', admin)
      console.log(`✓ New temporary password for ${admin.email}: ${password}`)
      break
    }
    case 'unlock': {
      const admin = await byEmail()
      await PlatformAdmin.updateOne({ _id: admin._id }, { $set: { failedLogins: 0, lockedUntil: null } })
      await audit('admin.unlocked_via_cli', admin)
      console.log(`✓ Unlocked ${admin.email}.`)
      break
    }
    default:
      fail(`Unknown command "${command}". Try: create, list, reset-2fa, reset-password, unlock.`)
  }
} finally {
  await mongoose.disconnect()
}
