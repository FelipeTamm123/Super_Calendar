import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { EmptyState, ListCard, Loading, QueryError, Section, SubjectBadge } from '../../components/study'
import { Alert, Button, Card } from '../../components/ui'
import { errorMessage } from '../../lib/api'
import { formatLongDate, formatRelativeDate } from '../../lib/dates'
import { fetchNoteFileUrl, useDeleteNote, useNote, useUpdateTask, useUpdateTopic } from '../../lib/queries'

export function NoteDetailPage() {
  const id = Number(useParams().id)
  const location = useLocation()
  const navigate = useNavigate()
  const { data: note, isPending, isError, error, refetch } = useNote(id)
  const remove = useDeleteNote()
  const updateTask = useUpdateTask()
  const updateTopic = useUpdateTopic()
  const [fileError, setFileError] = useState<string | null>(null)
  const [openingFile, setOpeningFile] = useState(false)
  const justCreated = (location.state as { justCreated?: boolean } | null)?.justCreated

  if (!Number.isInteger(id) || id < 1) return <EmptyState>Apunte inválido.</EmptyState>
  if (isPending) return <Loading />
  if (isError) return <QueryError error={error} onRetry={() => refetch()} />

  const openFile = async () => {
    setFileError(null)
    setOpeningFile(true)
    // Abrimos la pestaña antes del await para que el navegador no la bloquee como pop-up
    // (con 'noopener' window.open devuelve null, así que cortamos el vínculo a mano)
    const win = window.open('', '_blank')
    if (win) win.opener = null
    try {
      const { url } = await fetchNoteFileUrl(note.id)
      if (win) win.location.href = url
      else window.location.href = url
    } catch (err) {
      win?.close()
      setFileError(errorMessage(err))
    } finally {
      setOpeningFile(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Link to="/apuntes" className="text-sm text-brand-600 hover:underline">
        ← Apuntes
      </Link>

      {justCreated && (
        <Alert tone="success">
          Apunte guardado.
          {note.ai_used && note.tasks.length > 0 && ` La IA armó ${note.tasks.length} repasos para antes de la próxima clase.`}
        </Alert>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{note.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-zinc-500">
            <SubjectBadge name={note.subject_name} color={note.subject_color} />
            <span>{formatLongDate(note.class_date)}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {note.file_type && (
            <Button variant="secondary" onClick={openFile} loading={openingFile}>
              Ver archivo original
            </Button>
          )}
          <Button
            variant="danger"
            loading={remove.isPending}
            onClick={() => {
              if (window.confirm('¿Borrar este apunte? También se borran los repasos y temas que generó.')) {
                remove.mutate(note.id, { onSuccess: () => navigate('/apuntes', { replace: true }) })
              }
            }}
          >
            Borrar
          </Button>
        </div>
      </div>
      {(fileError || remove.isError) && <Alert>{fileError ?? errorMessage(remove.error)}</Alert>}

      {note.summary && (
        <Section title="Resumen">
          <Card className="p-4">
            <p className="whitespace-pre-line text-sm leading-relaxed">{note.summary}</p>
          </Card>
        </Section>
      )}

      <Section title="Para repasar antes de la próxima clase">
        {note.tasks.length === 0 ? (
          <EmptyState>{note.ai_used ? 'La IA no encontró nada puntual para repasar.' : 'Sin repasos (la IA no estaba disponible).'}</EmptyState>
        ) : (
          <ListCard>
            {note.tasks.map((t) => (
              <li key={t.id} className="flex items-start gap-3 px-4 py-3">
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={() => updateTask.mutate({ id: t.id, done: !t.done })}
                  className="mt-1 size-4 shrink-0 cursor-pointer accent-brand-600"
                  aria-label={`Marcar "${t.title}" como ${t.done ? 'pendiente' : 'hecho'}`}
                />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${t.done ? 'text-zinc-400 line-through' : ''}`}>{t.title}</p>
                  {t.detail && <p className="mt-0.5 text-sm text-zinc-500">{t.detail}</p>}
                </div>
                <span className="shrink-0 text-xs text-zinc-500">{formatRelativeDate(t.due_date)}</span>
              </li>
            ))}
          </ListCard>
        )}
      </Section>

      {note.topics.length > 0 && (
        <Section title="Temas pendientes">
          <ListCard>
            {note.topics.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                <input
                  type="checkbox"
                  checked={t.resolved}
                  onChange={() => updateTopic.mutate({ id: t.id, resolved: !t.resolved })}
                  className="size-4 shrink-0 cursor-pointer accent-brand-600"
                  aria-label={`Marcar "${t.topic}" como ${t.resolved ? 'pendiente' : 'aprendido'}`}
                />
                <p className={`text-sm ${t.resolved ? 'text-zinc-400 line-through' : ''}`}>{t.topic}</p>
              </li>
            ))}
          </ListCard>
        </Section>
      )}

      {note.content && (
        <Section title={note.file_type && note.file_type !== 'text/plain' ? 'Transcripción' : 'Apunte'}>
          <Card className="p-4">
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{note.content}</p>
          </Card>
        </Section>
      )}

      {(updateTask.isError || updateTopic.isError) && <Alert>{errorMessage(updateTask.error ?? updateTopic.error)}</Alert>}
    </div>
  )
}
