import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { EmptyState, ListCard, Loading, QueryError, Section } from '../../components/study'
import { Alert, Button } from '../../components/ui'
import { errorMessage } from '../../lib/api'
import { formatLongDate, formatRelativeDate, todayISO } from '../../lib/dates'
import {
  useCreateTopic,
  useDeleteSubject,
  useSubjectSheet,
  useUpdateQuestion,
  useUpdateSubject,
  useUpdateTask,
  useUpdateTopic,
} from '../../lib/queries'
import type { SubjectSheet } from '../../lib/types'

/** Hoja en Markdown para descargar. */
function sheetToMarkdown(sheet: SubjectSheet): string {
  const lines = [`# ${sheet.subject.name} — Hoja de dudas`, '']
  lines.push(sheet.next_class ? `Próxima clase: ${formatLongDate(sheet.next_class)}` : 'Próxima clase: sin horario cargado', '')
  lines.push('## Preguntas sin resolver', '')
  lines.push(...(sheet.questions.length ? sheet.questions.map((q) => `- [ ] ${q.text}`) : ['_Ninguna_']), '')
  lines.push('## Temas que me faltan aprender', '')
  lines.push(...(sheet.topics.length ? sheet.topics.map((t) => `- [ ] ${t.topic}`) : ['_Ninguno_']), '')
  lines.push('## Repasos pendientes', '')
  lines.push(
    ...(sheet.tasks.length
      ? sheet.tasks.map((t) => `- [ ] ${t.title} (para el ${formatLongDate(t.due_date)})${t.detail ? ` — ${t.detail}` : ''}`)
      : ['_Ninguno_']),
    '',
  )
  lines.push(`_Generado por Super Calendar el ${formatLongDate(todayISO())}_`, '')
  return lines.join('\n')
}

function download(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function SubjectSheetPage() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const { data: sheet, isPending, isError, error, refetch } = useSubjectSheet(id)
  const updateQuestion = useUpdateQuestion()
  const updateTopic = useUpdateTopic()
  const updateTask = useUpdateTask()
  const createTopic = useCreateTopic()
  const updateSubject = useUpdateSubject()
  const deleteSubject = useDeleteSubject()
  const [topic, setTopic] = useState('')

  if (!Number.isInteger(id) || id < 1) return <EmptyState>Materia inválida.</EmptyState>
  if (isPending) return <Loading />
  if (isError) return <QueryError error={error} onRetry={() => refetch()} />

  const mutationError = updateQuestion.error ?? updateTopic.error ?? updateTask.error ?? createTopic.error ?? updateSubject.error ?? deleteSubject.error

  const addTopic = (e: FormEvent) => {
    e.preventDefault()
    if (!topic.trim()) return
    createTopic.mutate({ subject_id: id, topic: topic.trim() }, { onSuccess: () => setTopic('') })
  }

  const rename = () => {
    const name = window.prompt('Nuevo nombre de la materia', sheet.subject.name)?.trim()
    if (name && name !== sheet.subject.name) updateSubject.mutate({ id, name })
  }

  const remove = () => {
    if (window.confirm(`¿Borrar «${sheet.subject.name}»? Se borran también sus apuntes, clases, repasos y temas.`)) {
      deleteSubject.mutate(id, { onSuccess: () => navigate('/materias', { replace: true }) })
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <Link to="/materias" className="text-sm text-brand-600 hover:underline print:hidden">
        ← Materias
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <span className="size-3 rounded-full" style={{ backgroundColor: sheet.subject.color }} aria-hidden="true" />
            {sheet.subject.name}
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Hoja de dudas ·{' '}
            {sheet.next_class ? `próxima clase ${formatRelativeDate(sheet.next_class)} (${formatLongDate(sheet.next_class)})` : 'sin clases en el horario'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button variant="secondary" onClick={() => download(`hoja-de-dudas-${sheet.subject.name}.md`, sheetToMarkdown(sheet))}>
            Descargar
          </Button>
          <Button variant="secondary" onClick={() => window.print()}>
            Imprimir
          </Button>
          <Button variant="ghost" onClick={rename}>
            Renombrar
          </Button>
          <Button variant="danger" onClick={remove} loading={deleteSubject.isPending}>
            Borrar
          </Button>
        </div>
      </div>

      {mutationError && <Alert>{errorMessage(mutationError)}</Alert>}

      <Section title={`Preguntas sin resolver (${sheet.questions.length})`}>
        {sheet.questions.length === 0 ? (
          <EmptyState>No hay preguntas pendientes en esta materia.</EmptyState>
        ) : (
          <ListCard>
            {sheet.questions.map((q) => (
              <li key={q.id} className="flex items-start gap-3 px-4 py-3">
                <input
                  type="checkbox"
                  onChange={() => updateQuestion.mutate({ id: q.id, resolved: true })}
                  className="mt-1 size-4 shrink-0 cursor-pointer accent-brand-600"
                  aria-label="Marcar como resuelta"
                />
                <p className="text-sm">{q.text}</p>
              </li>
            ))}
          </ListCard>
        )}
      </Section>

      <Section title={`Temas que me faltan aprender (${sheet.topics.length})`}>
        {sheet.topics.length > 0 && (
          <ListCard>
            {sheet.topics.map((t) => (
              <li key={t.id} className="flex items-start gap-3 px-4 py-3">
                <input
                  type="checkbox"
                  onChange={() => updateTopic.mutate({ id: t.id, resolved: true })}
                  className="mt-1 size-4 shrink-0 cursor-pointer accent-brand-600"
                  aria-label={`Marcar "${t.topic}" como aprendido`}
                />
                <p className="min-w-0 flex-1 text-sm">{t.topic}</p>
                {t.note_id && (
                  <Link to={`/apuntes/${t.note_id}`} className="shrink-0 text-xs text-brand-600 hover:underline print:hidden">
                    Ver apunte
                  </Link>
                )}
              </li>
            ))}
          </ListCard>
        )}
        <form onSubmit={addTopic} className="flex gap-2 print:hidden" aria-label="Agregar tema pendiente">
          <label htmlFor="new-topic" className="sr-only">
            Tema pendiente
          </label>
          <input
            id="new-topic"
            value={topic}
            maxLength={300}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Agregar un tema que te falta aprender"
            className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <Button type="submit" variant="secondary" loading={createTopic.isPending} disabled={!topic.trim()}>
            Agregar
          </Button>
        </form>
      </Section>

      <Section title={`Repasos pendientes (${sheet.tasks.length})`}>
        {sheet.tasks.length === 0 ? (
          <EmptyState>No hay repasos pendientes.</EmptyState>
        ) : (
          <ListCard>
            {sheet.tasks.map((t) => (
              <li key={t.id} className="flex items-start gap-3 px-4 py-3">
                <input
                  type="checkbox"
                  onChange={() => updateTask.mutate({ id: t.id, done: true })}
                  className="mt-1 size-4 shrink-0 cursor-pointer accent-brand-600"
                  aria-label={`Marcar "${t.title}" como hecho`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{t.title}</p>
                  {t.detail && <p className="mt-0.5 text-sm text-zinc-500">{t.detail}</p>}
                </div>
                <span className="shrink-0 text-xs text-zinc-500">{formatRelativeDate(t.due_date)}</span>
              </li>
            ))}
          </ListCard>
        )}
      </Section>
    </div>
  )
}
