import { readJson, json, ApiError } from '@/lib/api'
import { adminRoute } from '@/lib/adminApi'
import { can } from '@/lib/policy'
import { extendTrial, findOrg, forceLogoutOrg, reactivateOrg, setOrgPlan, suspendOrg } from '@/lib/orgAdmin'
import { approvalView, createApproval } from '@/lib/approvals'
import { PLANS } from '@/lib/plans'

function ownerSummary(user) {
  return {
    id: user._id.toString(),
    status: user.status,
    suspension: user.suspension ?? null,
    plan: user.plan,
    planLabel: PLANS[user.plan]?.label ?? user.plan,
    trialEndsAt: user.plan === 'trial' ? user.effectiveTrialEnd() : null,
  }
}

// Account actions. Each needs a reason (stored in the audit log and shown to the owner).
// Roles that can only *request* a suspension get an approval request instead.
export const POST = adminRoute(async ({ request, params, actor }) => {
  const user = await findOrg(params.id)
  const { action, reason, days, plan, until } = await readJson(request)
  const ctx = { reason, actor, request }

  switch (action) {
    case 'extendTrial':
      if (!can(actor, 'orgs.extendTrial')) throw new ApiError(403, 'Your role cannot extend trials.')
      await extendTrial(user, { ...ctx, days })
      return json({ owner: ownerSummary(user), message: `Trial extended by ${days} day(s).` })

    case 'setPlan':
      if (!can(actor, 'orgs.setPlan')) throw new ApiError(403, 'Your role cannot change plans.')
      await setOrgPlan(user, { ...ctx, plan, until })
      return json({ owner: ownerSummary(user), message: `Plan set to ${PLANS[plan].label}.` })

    case 'forceLogout':
      if (!can(actor, 'orgs.forceLogout')) throw new ApiError(403, 'Your role cannot sign owners out.')
      await forceLogoutOrg(user, ctx)
      return json({ owner: ownerSummary(user), message: 'All of this owner\'s sessions were signed out.' })

    case 'suspend':
    case 'reactivate': {
      const direct = action === 'suspend' ? 'orgs.suspend' : 'orgs.reactivate'
      const requestOnly = action === 'suspend' ? 'orgs.requestSuspend' : 'orgs.requestReactivate'
      if (can(actor, direct)) {
        await (action === 'suspend' ? suspendOrg : reactivateOrg)(user, ctx)
        return json({ owner: ownerSummary(user), message: action === 'suspend' ? 'Account suspended.' : 'Account reactivated.' })
      }
      if (can(actor, requestOnly)) {
        const approval = await createApproval({ type: `org.${action}`, payload: { orgId: params.id }, reason, actor, request })
        return json({ owner: ownerSummary(user), approval: approvalView(approval, actor), message: 'Sent for approval.' }, 202)
      }
      throw new ApiError(403, 'Your role cannot do this.')
    }

    default:
      throw new ApiError(400, 'Unknown action.')
  }
}, { permission: 'orgs.view' })
