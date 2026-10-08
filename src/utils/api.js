const BASE = '/api'
export const UNAUTHORIZED_EVENT = 'pgbook:unauthorized'

// The session lives in an httpOnly cookie, which the browser sends automatically.
async function request(method, path, body) {
  let res
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('Network error — check your internet connection and try again.')
  }
  const data = await res.json().catch(() => ({}))
  if (res.status === 401 && !path.startsWith('/auth/')) {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
  }
  if (!res.ok) {
    const error = new Error(data.message ?? 'Request failed. Please try again.')
    error.status = res.status
    throw error
  }
  return data
}

export const api = {
  get:    path       => request('GET',    path),
  post:   (path, b)  => request('POST',   path, b ?? {}),
  put:    (path, b)  => request('PUT',    path, b ?? {}),
  patch:  (path, b)  => request('PATCH',  path, b ?? {}),
  delete: (path, b) => request('DELETE', path, b),
}
