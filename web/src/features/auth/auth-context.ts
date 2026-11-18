import { createContext, useContext } from 'react'
import type { User } from '../../lib/api'
import type { SignUpInput } from './api'

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

export type AuthContextValue = {
  status: AuthStatus
  user: User | null
  login: (email: string, password: string) => Promise<void>
  /** Devuelve true si el usuario tiene que confirmar su email antes de entrar. */
  signup: (input: SignUpInput) => Promise<{ needsConfirmation: boolean }>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
