import { route, json } from '@/lib/api'
import { fetchSubscriptionEvent } from '@/lib/billingProvider'
import { applyBillingEvent } from '@/lib/billingEvents'
import { billingOverview } from '@/lib/billingView'
import User from '@/lib/models/User'

// "I've paid — refresh": asks the provider for the latest status, in case a webhook is slow.
export const POST = route(async ({ request, org }) => {
  const b = org.billing ?? {}
  for (const [provider, id] of [[b.pending?.provider, b.pending?.subscriptionId], [b.provider, b.subscriptionId]]) {
    const event = await fetchSubscriptionEvent(provider, id).catch(() => null)
    if (event) await applyBillingEvent(event, { provider })
  }
  const fresh = await User.findById(org._id)
  return json(await billingOverview(fresh, request))
}, { permission: 'billing.manage', readOnlyOk: true })
