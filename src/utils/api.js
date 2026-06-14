const BASE = '/api'

function getToken() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem('pgbook_auth')
    return raw ? JSON.parse(raw).token : null
  } catch { return null }
}

async function request(method, path, body) {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message ?? 'Request failed')
  return data
}

export const api = {
  get:    path        => request('GET',    path),
  post:   (path, b)  => request('POST',   path, b),
  put:    (path, b)  => request('PUT',    path, b),
  patch:  (path, b)  => request('PATCH',  path, b),
  delete: path        => request('DELETE', path),
}
