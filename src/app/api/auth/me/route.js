import { route, readJson, json, ApiError } from '@/lib/api'
import { capabilitiesFor, ORG_ROLES } from '@/lib/policy'
import { PLANS } from '@/lib/plans'
import { billingNotice, limitsFor } from '@/lib/subscription'

// The signed-in person plus what they can do: role, permissions, which properties, and the subscription state.
export const GET = route(async ({ user, org, role, membership, actor, billing }) => {
  const limits = limitsFor(billing)
  return json({
    user: user.toJSON(),
    access: {
      role,
      roleLabel: ORG_ROLES[role],
      permissions: capabilitiesFor(actor),
      propertyIds: membership?.propertyIds?.length ? membership.propertyIds.map(String) : null,
      org: {
        id: org._id.toString(),
        ownerName: org.name,
        plan: org.plan,
        planLabel: PLANS[org.plan]?.label ?? org.plan,
        trialEndsAt: billing.trialEndsAt ?? null,
      },
      billing: {
        status: billing.status,
        readOnly: billing.readOnly,
        plan: billing.plan,
        planLabel: billing.planLabel,
        daysLeft: billing.daysLeft ?? null,
        currentPeriodEnd: billing.currentPeriodEnd,
        retentionUntil: billing.retentionUntil ?? null,
        limits: Object.fromEntries(Object.entries(limits).map(([k, v]) => [k, Number.isFinite(v) ? v : null])),
        notice: billingNotice(billing, { isOwner: role === 'owner' }),
      },
    },
  })
})

// Update profile details (name). Email changes need verification and are not supported yet.
export const PUT = route(async ({ request, user, audit }) => {
  const { name } = await readJson(request)
  if (typeof name !== 'string' || !name.trim()) throw new ApiError(400, 'Name is required.')
  const previous = user.name
  user.name = name.trim()
  await user.save()
  if (previous !== user.name) await audit('account.profile_updated', { details: { fields: ['name'] } })
  return json({ user: user.toJSON() })
}, { readOnlyOk: true })
