import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../features/auth/auth-context'
import { FullPageSpinner } from './ui'

/** Solo deja pasar a usuarios logueados; si no, manda al login recordando a dónde iban. */
export function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <FullPageSpinner />
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

/**
 * Login y registro: si ya hay sesión, no tiene sentido mostrarlos.
 * Al loguearse, este guard redirige a la página que el usuario quería ver.
 */
export function GuestOnly() {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <FullPageSpinner />
  if (status === 'authenticated') {
    const from = (location.state as { from?: string } | null)?.from
    const target = from && from.startsWith('/') && !from.startsWith('//') ? from : '/hoy'
    return <Navigate to={target} replace />
  }
  return <Outlet />
}
