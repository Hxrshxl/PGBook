import PlatformAdmin from '@/lib/models/PlatformAdmin'
import { json } from '@/lib/api'
import { adminRoute, authenticateAdmin } from '@/lib/adminApi'
import { clearAdminSessionCookie } from '@/lib/auth'
import { adminActor, recordAudit } from '@/lib/audit'

// Signing out also invalidates the token server-side (bumps tokenVersion),
// so a copied cookie stops working too.
export const POST = adminRoute(async ({ request }) => {
  const admin = await authenticateAdmin(request)
  if (admin) {
    await PlatformAdmin.updateOne({ _id: admin._id }, { $inc: { tokenVersion: 1 }, $set: { stepUpAt: null } })
    await recordAudit({ actor: adminActor(admin), action: 'admin.logout', request })
  }
  return clearAdminSessionCookie(json({ ok: true }))
}, { auth: false })
