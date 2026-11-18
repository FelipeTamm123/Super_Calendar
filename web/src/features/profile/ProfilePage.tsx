import { useState, type FormEvent } from 'react'
import { Alert, Button, Card, Spinner, TextField } from '../../components/ui'
import { ApiError, errorMessage } from '../../lib/api'
import { useAuth } from '../auth/auth-context'
import { useProfile, useUpdateProfile, type Profile } from './api'

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,30}$/

export function ProfilePage() {
  const { data, isPending, isError, error } = useProfile()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tu perfil</h1>
        <p className="text-sm text-zinc-500">Así te ven en Super Calendar</p>
      </div>
      {isPending ? (
        <div className="flex justify-center py-12 text-brand-600" role="status">
          <Spinner />
          <span className="sr-only">Cargando perfil…</span>
        </div>
      ) : isError ? (
        <Alert>{errorMessage(error)}</Alert>
      ) : (
        <ProfileForm key={data.id} profile={data} />
      )}
    </div>
  )
}

function ProfileForm({ profile }: { profile: Profile }) {
  const { user } = useAuth()
  const update = useUpdateProfile()
  const [username, setUsername] = useState(profile.username ?? '')
  const [fullName, setFullName] = useState(profile.full_name ?? '')
  const [saved, setSaved] = useState(false)

  const usernameInvalid = username.length > 0 && !USERNAME_PATTERN.test(username)
  const apiError = update.error instanceof ApiError ? update.error : null
  const unchanged = username === (profile.username ?? '') && fullName === (profile.full_name ?? '')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (usernameInvalid) return
    setSaved(false)
    update.mutate(
      { username: username.trim() || null, full_name: fullName.trim() || null },
      { onSuccess: () => setSaved(true) },
    )
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {saved && <Alert tone="success">Perfil actualizado</Alert>}
        {update.isError && !apiError?.errors.length && <Alert>{errorMessage(update.error)}</Alert>}
        <TextField label="Email" value={user?.email ?? ''} disabled readOnly hint="El email no se puede cambiar desde acá" />
        <TextField
          label="Nombre de usuario"
          autoComplete="username"
          maxLength={30}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          hint="Entre 3 y 30 caracteres: letras, números y _"
          error={usernameInvalid ? 'Solo letras, números y _ (3 a 30 caracteres)' : apiError?.fieldError('username')}
        />
        <TextField
          label="Nombre completo"
          autoComplete="name"
          maxLength={100}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          error={apiError?.fieldError('full_name')}
        />
        <div className="flex justify-end">
          <Button type="submit" loading={update.isPending} disabled={unchanged || usernameInvalid}>
            Guardar cambios
          </Button>
        </div>
      </form>
    </Card>
  )
}
