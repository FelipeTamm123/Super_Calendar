import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { onUnauthorized, refreshSession, setAccessToken, type User } from '../../lib/api'
import { authApi, type SignUpInput } from './api'
import { AuthContext, type AuthContextValue, type AuthStatus } from './auth-context'

type State = { status: AuthStatus; user: User | null }

const ANONYMOUS: State = { status: 'anonymous', user: null }

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<State>({ status: 'loading', user: null })

  // Al abrir la app, intentamos recuperar la sesión con la cookie HttpOnly
  useEffect(() => {
    let active = true
    refreshSession().then((session) => {
      if (active) setState(session ? { status: 'authenticated', user: session.user } : ANONYMOUS)
    })
    return () => {
      active = false
    }
  }, [])

  const endSession = useCallback(() => {
    setAccessToken(null)
    queryClient.clear() // no dejar datos del usuario anterior en caché
    setState(ANONYMOUS)
  }, [queryClient])

  // Si la sesión vence y no se puede renovar, volvemos al login
  useEffect(() => onUnauthorized(endSession), [endSession])

  const login = useCallback(async (email: string, password: string) => {
    const session = await authApi.login(email, password)
    setAccessToken(session.access_token)
    setState({ status: 'authenticated', user: session.user })
  }, [])

  const signup = useCallback(async (input: SignUpInput) => {
    const result = await authApi.signup(input)
    if (!result.session) return { needsConfirmation: true }
    setAccessToken(result.session.access_token)
    setState({ status: 'authenticated', user: result.session.user })
    return { needsConfirmation: false }
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // aunque falle en el servidor, cerramos la sesión local
    } finally {
      endSession()
    }
  }, [endSession])

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, signup, logout }),
    [state, login, signup, logout],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
