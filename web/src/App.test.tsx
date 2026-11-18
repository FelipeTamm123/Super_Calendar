import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const session = {
  access_token: 'tok',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: null,
  user: { id: 'u1', email: 'ana@supercalendar.dev' },
}

describe('App', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    window.history.pushState({}, '', '/hoy')
  })
  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
  })

  it('sin sesión manda al login, y al entrar muestra qué estudiar hoy', async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input)
      if (url.endsWith('/auth/refresh')) return json(401, { title: 'No autenticado' })
      if (url.endsWith('/auth/login')) {
        expect(JSON.parse(String(init?.body))).toEqual({ email: 'ana@supercalendar.dev', password: 'secreta123' })
        return json(200, session)
      }
      if (url.startsWith('/api/v1/agenda')) {
        return json(200, {
          date: '2026-11-17',
          classes: [],
          tasks: [
            { id: 1, subject_id: 2, subject_name: 'Física', subject_color: '#3b82f6', note_id: 5, due_date: '2026-11-17', title: 'Repasar leyes de Newton', detail: null, done: false },
          ],
          questions: [],
          upcoming: [{ date: '2026-11-20', kind: 'exam', title: 'Parcial de Física', subject_name: 'Física' }],
        })
      }
      return json(404, { title: 'No encontrado' })
    })

    render(<App />)
    const user = userEvent.setup()

    expect(await screen.findByRole('heading', { name: 'Iniciá sesión' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('Email'), 'ana@supercalendar.dev')
    await user.type(screen.getByLabelText('Contraseña'), 'secreta123')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText('Repasar leyes de Newton')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Qué estudiar hoy' })).toBeInTheDocument()
    expect(screen.getByText('Parcial de Física')).toBeInTheDocument()
  })

  it('muestra el error del backend si el login falla', async () => {
    window.history.pushState({}, '', '/login')
    fetchMock.mockImplementation(async (input) => {
      const url = String(input)
      if (url.endsWith('/auth/login')) return json(401, { title: 'No autenticado', detail: 'Email o contraseña incorrectos' })
      return json(401, { title: 'No autenticado' })
    })

    render(<App />)
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('Email'), 'x@y.com')
    await user.type(screen.getByLabelText('Contraseña'), 'mal')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Email o contraseña incorrectos')
  })
})
