import { json } from '@/lib/api'
import { adminRoute, ADMIN_IDLE_TIMEOUT_MS } from '@/lib/adminApi'
import { adminProfile } from '@/lib/adminSignIn'

export const GET = adminRoute(async ({ admin }) => json({
  admin: adminProfile(admin),
  idleTimeoutMinutes: ADMIN_IDLE_TIMEOUT_MS / 60000,
  environment: process.env.NODE_ENV,
}))
