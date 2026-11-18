import { request, type Session, type User } from '../../lib/api'

export type SignUpInput = { email: string; password: string; full_name?: string }
export type SignUpResult = { user: User; session: Session | null }

export const authApi = {
  login: (email: string, password: string) =>
    request<Session>('/auth/login', { method: 'POST', body: { email, password }, skipRefresh: true }),

  signup: (input: SignUpInput) =>
    request<SignUpResult>('/auth/signup', { method: 'POST', body: input, skipRefresh: true }),

  logout: () => request<void>('/auth/logout', { method: 'POST' }),
}
