import { useEffect, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Loading } from '../../components/study'
import { Alert } from '../../components/ui'
import { errorMessage } from '../../lib/api'
import { useGoogleCallback } from '../../lib/queries'

/** Google vuelve acá después del login con ?code=...&state=... y se lo pasamos al backend. */
export function GoogleCallbackPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const callback = useGoogleCallback()
  const sent = useRef(false) // el código de Google sirve una sola vez (y React en modo estricto monta dos veces)

  const code = params.get('code')
  const state = params.get('state')
  const googleError = params.get('error')

  useEffect(() => {
    if (sent.current || !code || !state) return
    sent.current = true
    callback.mutate(
      { code, state },
      { onSuccess: (result) => navigate('/calendario', { replace: true, state: { googleConnected: result } }) },
    )
  }, [code, state, callback, navigate])

  if (googleError || !code || !state) {
    return (
      <div className="flex flex-col gap-4">
        <Alert>
          {googleError === 'access_denied'
            ? 'Google no dio acceso: cancelaste la conexión, o tu cuenta no está en "Usuarios de prueba" de la pantalla de consentimiento OAuth en Google Cloud (mientras la app no esté verificada, solo esas cuentas pueden conectarse).'
            : 'Google no devolvió una autorización válida.'}
        </Alert>
        <Link to="/calendario" className="text-sm font-medium text-brand-600 hover:underline">
          Volver al calendario
        </Link>
      </div>
    )
  }

  if (callback.isError) {
    return (
      <div className="flex flex-col gap-4">
        <Alert>{errorMessage(callback.error)}</Alert>
        <Link to="/calendario" className="text-sm font-medium text-brand-600 hover:underline">
          Volver al calendario
        </Link>
      </div>
    )
  }

  return <Loading label="Conectando con Google y sincronizando…" />
}
