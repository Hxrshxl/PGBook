import { route, readJson, json, ApiError } from '@/lib/api'

export const GET = route(async ({ user }) => json({ user: user.toJSON() }))

// Update profile details (name). Email changes need verification and are not supported yet.
export const PUT = route(async ({ request, user, audit }) => {
  const { name } = await readJson(request)
  if (typeof name !== 'string' || !name.trim()) throw new ApiError(400, 'Name is required.')
  const previous = user.name
  user.name = name.trim()
  await user.save()
  if (previous !== user.name) await audit('account.profile_updated', { details: { fields: ['name'] } })
  return json({ user: user.toJSON() })
})
