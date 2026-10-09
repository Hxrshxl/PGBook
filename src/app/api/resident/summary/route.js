import { json } from '@/lib/api'
import { residentRoute } from '@/lib/residentApi'
import { residentSummary } from '@/lib/residentData'

// Home screen: amount due and how to pay, notices, complaints, move-out and deposit status.
export const GET = residentRoute(async ctx => json(await residentSummary(ctx)))
