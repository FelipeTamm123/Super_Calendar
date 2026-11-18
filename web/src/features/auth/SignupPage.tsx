import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Alert, Button, TextField } from '../../components/ui'
import { ApiError, errorMessage } from '../../lib/api'
import { useAuth } from './auth-context'
import { AuthLayout } from './AuthLayout'

const MIN_PASSWORD = 8

export function SignupPage() {
  const { signup } = useAuth()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<ApiError | string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmEmail, setConfirmEmail] = useState(false)

  const passwordTooShort = password.length > 0 && password.length < MIN_PASSWORD

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < MIN_PASSWORD) return
    setError(null)
    setSubmitting(true)
    try {
      const { needsConfirmation } = await signup({
        email: email.trim(),
        password,
        full_name: fullName.trim() || undefined,
      })
      if (needsConfirmation) {
        setConfirmEmail(true)
        setSubmitting(false)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err : errorMessage(err))
      setSubmitting(false)
    }
  }

  if (confirmEmail) {
    return (
      <AuthLayout title="Revisá tu email" subtitle="Ya casi está">
        <Alert tone="success">
          Te enviamos un link de confirmación a <strong>{email}</strong>. Confirmalo y después iniciá sesión.
        </Alert>
        <Link to="/login" className="mt-6 block text-center text-sm font-medium text-brand-600 hover:underline">
          Ir a iniciar sesión
        </Link>
      </AuthLayout>
    )
  }

  const apiError = error instanceof ApiError ? error : null

  return (
    <AuthLayout title="Creá tu cuenta" subtitle="Empezá a organizar tus tareas">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {error && <Alert>{typeof error === 'string' ? error : errorMessage(error)}</Alert>}
        <TextField
          label="Nombre (opcional)"
          autoComplete="name"
          maxLength={100}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          error={apiError?.fieldError('full_name')}
        />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={apiError?.fieldError('email')}
        />
        <TextField
          label="Contraseña"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD}
          maxLength={72}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint={`Mínimo ${MIN_PASSWORD} caracteres`}
          error={passwordTooShort ? `Tiene que tener al menos ${MIN_PASSWORD} caracteres` : apiError?.fieldError('password')}
        />
        <Button type="submit" loading={submitting} disabled={!email || password.length < MIN_PASSWORD}>
          Crear cuenta
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-zinc-500">
        ¿Ya tenés cuenta?{' '}
        <Link to="/login" className="font-medium text-brand-600 hover:underline">
          Iniciá sesión
        </Link>
      </p>
    </AuthLayout>
  )
}
