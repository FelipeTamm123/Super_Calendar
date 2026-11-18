import { useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { Alert, Button, TextField } from '../../components/ui'
import { errorMessage } from '../../lib/api'
import { useAuth } from './auth-context'
import { AuthLayout } from './AuthLayout'

export function LoginPage() {
  const { login } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email.trim(), password)
      // GuestOnly redirige automáticamente al detectar la sesión
    } catch (err) {
      setError(errorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Iniciá sesión" subtitle="Bienvenido de nuevo a Super Calendar">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {error && <Alert>{error}</Alert>}
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" loading={submitting} disabled={!email || !password}>
          Entrar
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-zinc-500">
        ¿No tenés cuenta?{' '}
        <Link to="/signup" state={location.state} className="font-medium text-brand-600 hover:underline">
          Registrate
        </Link>
      </p>
    </AuthLayout>
  )
}
