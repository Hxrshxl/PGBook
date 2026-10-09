import { NextResponse } from 'next/server'
import User from '@/lib/models/User'
import { route, readJson, ApiError, APP_TIME_ZONE } from '@/lib/api'
import { buildOrgExport } from '@/lib/exportData'
import { rateLimit } from '@/lib/rateLimit'
import { todayISO } from '@/utils/helpers'

// Export all data (L3: the owner re-enters their password). Works in read-only mode too.
export const POST = route(async ({ request, user, org, audit }) => {
  const limit = rateLimit(`export:${org._id}`, { limit: 5, windowMs: 60 * 60 * 1000 })
  if (!limit.ok) throw new ApiError(429, 'You can export 5 times an hour. Please try again later.')

  const { password } = await readJson(request)
  const account = await User.findById(user._id).select('+password')
  if (!(await account.comparePassword(password))) throw new ApiError(403, 'Password is incorrect.')

  const { zip, counts } = await buildOrgExport(org)
  await audit('data.export', { details: counts })
  return new NextResponse(zip, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="pgbook-export-${todayISO(APP_TIME_ZONE)}.zip"`,
      'Cache-Control': 'no-store',
    },
  })
}, { permission: 'data.export', readOnlyOk: true })
