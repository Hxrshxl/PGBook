const BASE = '/api'
export const UNAUTHORIZED_EVENT = 'pgbook:unauthorized'

export const RESIDENT_UNAUTHORIZED_EVENT = 'pgbook:resident-unauthorized'

async function send(method, path, { body, form, headers = {} } = {}) {
  try {
    return await fetch(`${BASE}${path}`, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json', ...headers } : headers,
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
    })
  } catch {
    throw new Error('Network error — check your internet connection and try again.')
  }
}

async function failure(res, path) {
  const data = await res.json().catch(() => ({}))
  if (res.status === 401) {
    if (path.startsWith('/resident/')) window.dispatchEvent(new Event(RESIDENT_UNAUTHORIZED_EVENT))
    else if (!path.startsWith('/auth/')) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
  }
  const error = new Error(data.message ?? 'Request failed. Please try again.')
  error.status = res.status
  error.code = data.code
  return error
}

// The session lives in an httpOnly cookie, which the browser sends automatically.
async function request(method, path, body, headers) {
  const res = await send(method, path, { body, headers })
  if (!res.ok) throw await failure(res, path)
  return res.json().catch(() => ({}))
}

/** POSTs JSON and returns the response as a file: { blob, filename }. */
async function download(path, body) {
  const res = await send('POST', path, { body })
  if (!res.ok) throw await failure(res, path)
  const match = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')
  return { blob: await res.blob(), filename: match?.[1] ?? 'download' }
}

/** Uploads a FormData body (files). */
async function upload(path, form, headers) {
  const res = await send('POST', path, { form, headers })
  if (!res.ok) throw await failure(res, path)
  return res.json()
}

export const api = {
  get:    path       => request('GET',    path),
  post:   (path, b)  => request('POST',   path, b ?? {}),
  put:    (path, b)  => request('PUT',    path, b ?? {}),
  patch:  (path, b)  => request('PATCH',  path, b ?? {}),
  delete: (path, b) => request('DELETE', path, b),
  download,
  upload,
  /** Same calls with extra headers (the resident app sends which stay it is looking at). */
  with: headers => ({
    get:    path      => request('GET',    path, undefined, headers),
    post:   (path, b) => request('POST',   path, b ?? {}, headers),
    put:    (path, b) => request('PUT',    path, b ?? {}, headers),
    delete: (path, b) => request('DELETE', path, b, headers),
    upload: (path, form) => upload(path, form, headers),
  }),
}

/** Saves a Blob as a file in the browser. */
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
