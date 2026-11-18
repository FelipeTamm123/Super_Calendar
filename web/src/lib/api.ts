/**
 * Cliente HTTP para el backend de Super Calendar.
 *
 * - El access token vive SOLO en memoria (nunca en localStorage: un script
 *   inyectado por XSS podría robarlo).
 * - El refresh token lo maneja el navegador en una cookie HttpOnly que
 *   JavaScript no puede leer. Al recargar la página, /auth/refresh nos da un
 *   access token nuevo.
 * - Si una llamada devuelve 401, se intenta renovar la sesión una sola vez.
 * - Los errores del backend (RFC 9457) se convierten en ApiError.
 */

const BASE_URL = '/api/v1'

export type User = { id: string; email: string | null }

export type Session = {
  access_token: string
  token_type: string
  expires_in: number
  expires_at: number | null
  user: User
}

export type FieldError = { pointer: string; detail: string }

export class ApiError extends Error {
  readonly status: number
  readonly title: string
  readonly detail?: string
  readonly errors: FieldError[]

  constructor(status: number, title: string, detail?: string, errors: FieldError[] = []) {
    super(detail ?? title)
    this.name = 'ApiError'
    this.status = status
    this.title = title
    this.detail = detail
    this.errors = errors
  }

  /** Mensaje de error para un campo del formulario, si el backend lo marcó. */
  fieldError(field: string): string | undefined {
    return this.errors.find((e) => e.pointer === `/${field}`)?.detail
  }
}

/** Mensaje legible para mostrar en pantalla a partir de cualquier error. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.detail ?? error.title
  return 'Ocurrió un error inesperado'
}

let accessToken: string | null = null
let refreshPromise: Promise<Session | null> | null = null
const unauthorizedListeners = new Set<() => void>()

export function setAccessToken(token: string | null) {
  accessToken = token
}

/** Se dispara cuando la sesión venció y no se pudo renovar. */
export function onUnauthorized(listener: () => void): () => void {
  unauthorizedListeners.add(listener)
  return () => unauthorizedListeners.delete(listener)
}

type Query = Record<string, string | number | boolean | undefined | null>

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** JSON, o FormData para subir archivos */
  body?: unknown
  query?: Query
  signal?: AbortSignal
  /** Uso interno: evita loops de refresh. */
  skipRefresh?: boolean
  /** 'text' para respuestas que no son JSON (por ejemplo, un archivo .ics) */
  responseType?: 'json' | 'text'
}

function buildUrl(path: string, query?: Query): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) params.set(key, String(value))
  }
  const qs = params.toString()
  return `${BASE_URL}${path}${qs ? `?${qs}` : ''}`
}

async function send(path: string, opts: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const isForm = opts.body instanceof FormData
  // Con FormData el navegador pone el Content-Type (multipart con su boundary)
  if (opts.body !== undefined && !isForm) headers['Content-Type'] = 'application/json'
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  try {
    return await fetch(buildUrl(path, opts.query), {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body === undefined ? undefined : isForm ? (opts.body as FormData) : JSON.stringify(opts.body),
      credentials: 'same-origin',
      signal: opts.signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new ApiError(0, 'Sin conexión', 'No se pudo conectar con el servidor')
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  try {
    const body = await res.json()
    return new ApiError(res.status, body.title ?? 'Error', body.detail, body.errors ?? [])
  } catch {
    return new ApiError(res.status, res.status >= 500 ? 'Error del servidor' : 'Error')
  }
}

/** Pide un access token nuevo usando la cookie. Llamadas simultáneas comparten la misma promesa. */
export function refreshSession(): Promise<Session | null> {
  refreshPromise ??= (async () => {
    try {
      const res = await send('/auth/refresh', { method: 'POST', skipRefresh: true })
      if (!res.ok) {
        accessToken = null
        return null
      }
      const session = (await res.json()) as Session
      accessToken = session.access_token
      return session
    } catch {
      return null
    } finally {
      refreshPromise = null
    }
  })()
  return refreshPromise
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await send(path, opts)

  if (res.status === 401 && !opts.skipRefresh && accessToken) {
    const session = await refreshSession()
    if (session) return request<T>(path, { ...opts, skipRefresh: true })
    unauthorizedListeners.forEach((listener) => listener())
  }

  if (!res.ok) throw await toApiError(res)
  if (res.status === 204) return undefined as T
  if (opts.responseType === 'text') return (await res.text()) as T
  return (await res.json()) as T
}
