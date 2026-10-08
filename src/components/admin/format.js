import { timeAgo } from '@/utils/helpers'

export function dateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function relative(value) {
  return value ? timeAgo(value) : 'never'
}

export function daysUntil(value) {
  if (!value) return null
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86400000)
}

/** Plan / trial pill data for an owner row. */
export function planState(owner) {
  if (owner.plan !== 'trial') return { tone: 'paid', label: owner.planLabel }
  const days = daysUntil(owner.trialEndsAt)
  if (days === null) return { tone: 'trial', label: 'Trial' }
  if (days < 0) return { tone: 'expired', label: `Trial ended ${Math.abs(days)}d ago` }
  return { tone: 'trial', label: days === 0 ? 'Trial ends today' : `Trial · ${days}d left` }
}
