// Development stand-ins for paid providers: test-mode billing without Razorpay,
// and phone codes shown on screen without an SMS provider.
//
// They only switch on when BOTH are true:
//   • `npm run dev`, or PGBOOK_DEV_FALLBACKS=true is set explicitly, and
//   • the request was made to localhost.
// A deployed site never matches the second condition, so a forgotten setting
// can't hand out free plans or reveal login codes.

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

export function isLocalRequest(request) {
  const host = request?.headers?.get('host') ?? ''
  const name = host.startsWith('[') ? host.slice(0, host.indexOf(']') + 1) : host.split(':')[0]
  return LOCAL_HOSTS.has(name) || name.endsWith('.localhost')
}

export function devFallbacksEnabled() {
  return process.env.NODE_ENV === 'development' || process.env.PGBOOK_DEV_FALLBACKS === 'true'
}

export function devFallbacksAllowed(request) {
  return devFallbacksEnabled() && isLocalRequest(request)
}
