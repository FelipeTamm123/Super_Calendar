import { useState } from 'react'
import { Section } from '../../components/study'
import { Alert, Button, Card } from '../../components/ui'
import { errorMessage } from '../../lib/api'
import {
  downloadIcs,
  fetchGoogleAuthUrl,
  useCalendarSettings,
  useCreateFeed,
  useDeleteFeed,
  useGoogleDisconnect,
  useGoogleSync,
  useUpdateCalendarSettings,
} from '../../lib/queries'
import type { CalendarSettings } from '../../lib/types'

const dateTime = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' })

export function SyncPanel() {
  const settings = useCalendarSettings()

  return (
    <Section title="Sincronizar con otros calendarios">
      {settings.isPending ? null : settings.isError ? (
        <Alert>{errorMessage(settings.error)}</Alert>
      ) : (
        <div className="flex flex-col gap-4">
          <Preferences settings={settings.data} />
          <div className="grid gap-4 lg:grid-cols-2">
            <FeedCard settings={settings.data} />
            <GoogleCard settings={settings.data} />
          </div>
        </div>
      )}
    </Section>
  )
}

function Preferences({ settings }: { settings: CalendarSettings }) {
  const update = useUpdateCalendarSettings()
  const options = [
    { key: 'include_classes', label: 'Clases (se repiten cada semana, con el link si son virtuales)' },
    { key: 'include_tasks', label: 'Horas de estudio (repasos pendientes)' },
    { key: 'include_questions', label: 'Preguntas agendadas' },
  ] as const
  return (
    <Card className="p-4">
      <p className="text-sm font-medium">Qué se manda a tu calendario</p>
      <p className="mt-0.5 text-xs text-zinc-500">Los exámenes, feriados y entregas van siempre, con recordatorio el día anterior y 3 días antes.</p>
      <div className="mt-3 flex flex-col gap-2">
        {options.map((o) => (
          <label key={o.key} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings[o.key]}
              disabled={update.isPending}
              onChange={(e) => update.mutate({ [o.key]: e.target.checked })}
              className="size-4 accent-brand-600"
            />
            {o.label}
          </label>
        ))}
      </div>
      {update.isError && <p className="mt-2 text-sm text-red-600">{errorMessage(update.error)}</p>}
    </Card>
  )
}

function FeedCard({ settings }: { settings: CalendarSettings }) {
  const create = useCreateFeed()
  const remove = useDeleteFeed()
  const [url, setUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const isLocal = url ? /\/\/(localhost|127\.0\.0\.1)/.test(url) : false

  const generate = () => {
    if (settings.feed_active && !window.confirm('Se crea un link nuevo y el anterior deja de funcionar. ¿Seguir?')) return
    create.mutate(undefined, { onSuccess: (r) => setUrl(r.url) })
  }

  const copy = async () => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const download = async () => {
    setDownloadError(null)
    try {
      const ics = await downloadIcs()
      const href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
      const a = document.createElement('a')
      a.href = href
      a.download = 'super-calendar.ics'
      a.click()
      URL.revokeObjectURL(href)
    } catch (err) {
      setDownloadError(errorMessage(err))
    }
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div>
        <h3 className="font-semibold">Opción 1 · Link de calendario (.ics)</h3>
        <p className="text-sm text-zinc-500">Funciona con Google, Apple y Outlook. El calendario se actualiza solo (Google tarda unas horas).</p>
      </div>

      {url ? (
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-zinc-500" htmlFor="feed-url">
            Tu link secreto (copialo ahora: por seguridad no se vuelve a mostrar)
          </label>
          <div className="flex gap-2">
            <input id="feed-url" readOnly value={url} onFocus={(e) => e.target.select()} className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-zinc-50 px-2.5 py-1.5 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950" />
            <Button variant="secondary" onClick={copy}>
              {copied ? '¡Copiado!' : 'Copiar'}
            </Button>
          </div>
          {isLocal && (
            <Alert tone="info">
              Este link apunta a tu compu (localhost): Google y Outlook no pueden leerlo desde internet. Para suscribirte desde ellos la
              app tiene que estar publicada (configurá <code>PUBLIC_API_URL</code>). Apple Calendar en esta misma compu sí puede, y
              mientras tanto podés <strong>descargar el .ics</strong> e importarlo.
            </Alert>
          )}
        </div>
      ) : settings.feed_active ? (
        <p className="text-sm">
          Tenés un link activo desde el {settings.feed_created_at ? dateTime.format(new Date(settings.feed_created_at)) : '—'}. Si lo perdiste,
          generá uno nuevo.
        </p>
      ) : (
        <p className="text-sm text-zinc-500">Todavía no generaste un link.</p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={generate} loading={create.isPending}>
          {settings.feed_active ? 'Generar link nuevo' : 'Generar link'}
        </Button>
        <Button variant="secondary" onClick={download}>
          Descargar .ics
        </Button>
        {settings.feed_active && (
          <Button
            variant="danger"
            loading={remove.isPending}
            onClick={() => {
              if (window.confirm('¿Desactivar el link? Los calendarios suscritos dejan de actualizarse.')) {
                remove.mutate(undefined, { onSuccess: () => setUrl(null) })
              }
            }}
          >
            Desactivar
          </Button>
        )}
      </div>
      {(create.isError || remove.isError || downloadError) && (
        <Alert>{downloadError ?? errorMessage(create.error ?? remove.error)}</Alert>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer font-medium text-brand-600">Cómo suscribirse</summary>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-zinc-600 dark:text-zinc-400">
          <li>
            <strong>Google Calendar</strong> (en la web, desde la compu): Otros calendarios → <strong>+</strong> → Desde URL → pegar el link →
            Añadir calendario.
          </li>
          <li>
            <strong>Apple Calendar</strong>: Archivo → Nueva suscripción a calendario → pegar el link.
          </li>
          <li>
            <strong>Outlook</strong>: Agregar calendario → Suscribirse desde la web → pegar el link.
          </li>
          <li>Una vez hecho en la compu, aparece también en el celular. Quien tenga el link puede ver tus exámenes: no lo compartas.</li>
        </ul>
      </details>
    </Card>
  )
}

function GoogleCard({ settings }: { settings: CalendarSettings }) {
  const g = settings.google
  const syncNow = useGoogleSync()
  const disconnect = useGoogleDisconnect()
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)

  const connect = async () => {
    setConnectError(null)
    setConnecting(true)
    try {
      const { url } = await fetchGoogleAuthUrl()
      window.location.assign(url) // vuelve a /calendario/google/callback
    } catch (err) {
      setConnectError(errorMessage(err))
      setConnecting(false)
    }
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div>
        <h3 className="font-semibold">Opción 2 · Cuenta de Google</h3>
        <p className="text-sm text-zinc-500">
          Sincroniza al instante en un calendario aparte llamado «Super Calendar», y muestra tus eventos de Google en este calendario.
        </p>
      </div>

      {!g.available ? (
        <Alert tone="info">
          Falta configurar Google en el servidor: creá las credenciales OAuth en Google Cloud y poné <code>GOOGLE_CLIENT_ID</code> y{' '}
          <code>GOOGLE_CLIENT_SECRET</code> en el <code>.env</code> (pasos en el README).
        </Alert>
      ) : g.connected ? (
        <>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-zinc-500">Cuenta</dt>
            <dd className="truncate">{g.email ?? '—'}</dd>
            <dt className="text-zinc-500">Última sincronización</dt>
            <dd>{g.last_sync_at ? dateTime.format(new Date(g.last_sync_at)) : 'todavía no'}</dd>
          </dl>
          {g.last_error && <Alert>{g.last_error}</Alert>}
          {syncNow.isSuccess && (
            <Alert tone="success">
              Listo: {syncNow.data.created} creados, {syncNow.data.updated} actualizados, {syncNow.data.deleted} borrados.
            </Alert>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => syncNow.mutate()} loading={syncNow.isPending}>
              Sincronizar ahora
            </Button>
            <Button
              variant="danger"
              loading={disconnect.isPending}
              onClick={() => {
                if (window.confirm('¿Desconectar Google? Se borra el calendario «Super Calendar» de tu cuenta (tus otros calendarios no se tocan).')) {
                  disconnect.mutate()
                }
              }}
            >
              Desconectar
            </Button>
          </div>
        </>
      ) : (
        <>
          {g.last_error && <Alert>{g.last_error}</Alert>}
          <Button onClick={connect} loading={connecting} className="self-start">
            Conectar con Google
          </Button>
          <p className="text-xs text-zinc-500">
            Permisos que se piden: crear y manejar solo el calendario «Super Calendar», y leer tus eventos para mostrarlos acá. La app no
            puede modificar ni borrar tus otros eventos.
          </p>
        </>
      )}
      {(connectError || syncNow.isError || disconnect.isError) && (
        <Alert>{connectError ?? errorMessage(syncNow.error ?? disconnect.error)}</Alert>
      )}
    </Card>
  )
}
