import { readJson, json, ApiError } from '@/lib/api'
import { residentRoute } from '@/lib/residentApi'
import { tenanciesFor } from '@/lib/residentData'

// The signed-in resident and all their stays (current and past).
export const GET = residentRoute(async ({ resident }) => json({ resident: resident.toJSON(), tenancies: await tenanciesFor(resident) }), { stay: false })

// Accept the privacy notice, choose a language.
export const PUT = residentRoute(async ({ request, resident }) => {
  const { consent, language } = await readJson(request)
  if (consent === true && !resident.consentAt) resident.consentAt = new Date()
  if (language !== undefined) {
    if (!['en', 'hi'].includes(language)) throw new ApiError(400, 'Unknown language.')
    resident.language = language
  }
  await resident.save()
  return json({ resident: resident.toJSON() })
}, { stay: false })
