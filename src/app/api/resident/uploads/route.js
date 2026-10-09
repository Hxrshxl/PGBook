import { json, ApiError } from '@/lib/api'
import { residentRoute } from '@/lib/residentApi'
import { saveUpload } from '@/lib/files'
import { rateLimit } from '@/lib/rateLimit'

// Upload one photo (complaint photo or payment screenshot). It is private to this
// stay and becomes visible to the PG once attached to a complaint or payment report.
export const POST = residentRoute(async ({ request, resident, tenant }) => {
  const limit = rateLimit(`upload:${resident._id}`, { limit: 30, windowMs: 60 * 60 * 1000 })
  if (!limit.ok) throw new ApiError(429, 'Too many uploads. Please try again later.')
  let form
  try {
    form = await request.formData()
  } catch {
    throw new ApiError(400, 'Upload a photo.')
  }
  const id = await saveUpload(form.get('file'), {
    orgId: tenant.userId, propertyId: tenant.propertyId, tenantId: tenant._id, residentId: resident._id,
  })
  return json({ id: id.toString() }, 201)
}, { write: true })
