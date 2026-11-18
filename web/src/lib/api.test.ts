import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, onUnauthorized, request, setAccessToken } from './api'

const json = (status: number, body: unknown, type = 'application/json') =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': type } })

const session = (token: string) => ({
  access_token: token,
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: null,
  user: { id: 'u1', email: 'a@b.com' },
})

describe('request', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    setAccessToken(null)
  })
  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
  })

  it('manda el access token y arma la query string', async () => {
    setAccessToken('tok')
    fetchMock.mockResolvedValueOnce(json(200, { ok: true }))
    await request('/items', { query: { limit: 10, done: undefined } })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/v1/items?limit=10')
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer tok')
  })

  it('convierte errores RFC 9457 en ApiError con errores por campo', async () => {
    fetchMock.mockResolvedValueOnce(
      json(422, { title: 'Datos inválidos', status: 422, detail: 'mal', errors: [{ pointer: '/title', detail: 'vacío' }] }, 'application/problem+json'),
    )
    const err = (await request('/items', { method: 'POST', body: {} }).catch((e: unknown) => e)) as ApiError
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(422)
    expect(err.fieldError('title')).toBe('vacío')
  })

  it('ante un 401 renueva la sesión y reintenta una vez', async () => {
    setAccessToken('viejo')
    fetchMock
      .mockResolvedValueOnce(json(401, { title: 'No autenticado' }))
      .mockResolvedValueOnce(json(200, session('nuevo')))
      .mockResolvedValueOnce(json(200, { items: [] }))
    const res = await request<{ items: unknown[] }>('/items')
    expect(res.items).toEqual([])
    expect(fetchMock.mock.calls[1][0]).toBe('/api/v1/auth/refresh')
    expect((fetchMock.mock.calls[2][1]!.headers as Record<string, string>).Authorization).toBe('Bearer nuevo')
  })

  it('si no se puede renovar, avisa que la sesión terminó', async () => {
    setAccessToken('viejo')
    const listener = vi.fn()
    const off = onUnauthorized(listener)
    fetchMock.mockResolvedValueOnce(json(401, { title: 'x' })).mockResolvedValueOnce(json(401, { title: 'x' }))
    await expect(request('/items')).rejects.toMatchObject({ status: 401 })
    expect(listener).toHaveBeenCalledOnce()
    off()
  })

  it('un error de red se convierte en ApiError status 0', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(request('/items')).rejects.toMatchObject({ status: 0, title: 'Sin conexión' })
  })
})
