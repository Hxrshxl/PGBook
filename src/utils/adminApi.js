// Client for /api/admin. Two behaviours on top of fetch:
//  • 401 → the admin session ended: go to the admin sign-in page.
//  • 403 STEP_UP_REQUIRED → ask for a fresh 2FA code (via the registered handler) and retry once.
const BASE = '/api/admin'
let stepUpHandler = null

export function registerStepUpHandler(handler) {
  stepUpHandler = handler
  return () => { if (stepUpHandler === handler) stepUpHandler = null }
}

async function send(method, path, body) {
  try {
    return await fetch(`${BASE}${path}`, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('Network error — check your connection and try again.')
  }
}

async function request(method, path, body, { raw = false, retried = false } = {}) {
  const res = await send(method, path, body)
  if (res.ok) return raw ? res : res.json().catch(() => ({}))

  const data = await res.json().catch(() => ({}))
  if (res.status === 401 && !path.startsWith('/auth/')) {
    const next = encodeURIComponent(window.location.pathname + window.location.search)
    window.location.assign(`/admin/login?expired=1&next=${next}`)
    throw new Error(data.message ?? 'Your admin session has ended.')
  }
  if (res.status === 403 && data.code === 'STEP_UP_REQUIRED' && !retried && stepUpHandler) {
    if (await stepUpHandler()) return request(method, path, body, { raw, retried: true })
    throw new Error('Cancelled — the action needs a 2FA code.')
  }
  const error = new Error(data.message ?? 'Request failed. Please try again.')
  error.status = res.status
  error.code = data.code
  throw error
}

async function download(path) {
  const res = await request('GET', path, undefined, { raw: true })
  const blob = await res.blob()
  const match = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = match?.[1] ?? 'export.csv'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const adminApi = {
  get:    path      => request('GET', path),
  post:   (path, b) => request('POST', path, b ?? {}),
  put:    (path, b) => request('PUT', path, b ?? {}),
  delete: path      => request('DELETE', path),
  download,
}
