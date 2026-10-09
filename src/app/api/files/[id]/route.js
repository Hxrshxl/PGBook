import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import { authenticate } from '@/lib/api'
import { authenticateResident } from '@/lib/residentApi'
import { makeScope, resolveOrgContext } from '@/lib/orgContext'
import { readUpload } from '@/lib/files'
import { can } from '@/lib/policy'
import { orgActor } from '@/lib/audit'

const notFound = () => NextResponse.json({ message: 'Not found.' }, { status: 404 })

// A photo from the tenant app. Visible to the resident who uploaded it, and to the PG's
// team members who may see that kind of record in that property. Everyone else gets 404.
export async function GET(request, context) {
  await dbConnect()
  const { id } = await context.params
  const file = await readUpload(id)
  if (!file) return notFound()
  const meta = file.info.metadata ?? {}

  let allowed = false
  const resident = await authenticateResident(request)
  if (resident && String(meta.residentId) === String(resident._id)) allowed = true
  if (!allowed) {
    const user = await authenticate(request)
    const ctx = user ? await resolveOrgContext(user) : null
    if (ctx && String(ctx.org._id) === String(meta.orgId) && makeScope(ctx).canAccessProperty(meta.propertyId)) {
      const actor = { ...orgActor(user), role: ctx.role }
      const kind = meta.attachedTo?.kind
      allowed = kind === 'complaint' ? can(actor, 'complaints.view') : kind === 'claim' ? can(actor, 'claims.review') || can(actor, 'rent.view') : false
    }
  }
  if (!allowed) return notFound()

  return new NextResponse(file.buffer, {
    headers: {
      'Content-Type': meta.contentType ?? 'application/octet-stream',
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; img-src 'self'; sandbox",
    },
  })
}
