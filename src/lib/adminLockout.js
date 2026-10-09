import PlatformAdmin from './models/PlatformAdmin.js'
import { adminActor, recordAudit } from './audit'

const MAX_FAILURES = 5
const LOCK_MS = 15 * 60 * 1000

/** Counts a failed password or 2FA attempt; locks the account for 15 minutes after 5. */
export async function registerFailure(admin, stage, request) {
  const failures = (admin.failedLogins ?? 0) + 1
  const update = failures >= MAX_FAILURES
    ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MS) }
    : { failedLogins: failures }
  await PlatformAdmin.updateOne({ _id: admin._id }, { $set: update })
  await recordAudit({
    actor: adminActor(admin),
    action: failures >= MAX_FAILURES ? 'admin.locked' : 'admin.login_failed',
    details: { stage },
    request,
  })
}

export async function clearFailures(admin) {
  if (admin.failedLogins || admin.lockedUntil) {
    await PlatformAdmin.updateOne({ _id: admin._id }, { $set: { failedLogins: 0, lockedUntil: null } })
  }
}
