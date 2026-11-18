import { useState } from 'react'
import { Card } from '../../components/ui'
import { EmptyState, ListCard, Loading, PageHeader, QueryError, SubjectBadge } from '../../components/study'
import { Button } from '../../components/ui'
import { errorMessage } from '../../lib/api'
import { formatRelativeDate, isOverdue, todayISO } from '../../lib/dates'
import { useDeleteQuestion, useQuestions, useSubjects, useUpdateQuestion } from '../../lib/queries'
import type { Question } from '../../lib/types'
import { QuickQuestionForm } from './QuickQuestionForm'

const PAGE_SIZE = 20

type Filter = 'pending' | 'resolved' | 'all'
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'pending', label: 'Sin resolver' },
  { value: 'resolved', label: 'Resueltas' },
  { value: 'all', label: 'Todas' },
]

export function QuestionsPage() {
  const [filter, setFilter] = useState<Filter>('pending')
  const [page, setPage] = useState(0)
  const resolved = filter === 'all' ? undefined : filter === 'resolved'
  const { data, isPending, isError, error, refetch } = useQuestions({ resolved, limit: PAGE_SIZE, offset: page * PAGE_SIZE })
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1
  if (data && page > 0 && page >= totalPages) setPage(totalPages - 1)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Preguntas al aire" subtitle="Anotá lo que te surja; la IA la ubica en su materia y la agenda." />

      <Card className="p-4">
        <QuickQuestionForm />
      </Card>

      <div role="group" aria-label="Filtrar preguntas" className="flex gap-1 self-start rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={filter === f.value}
            onClick={() => {
              setFilter(f.value)
              setPage(0)
            }}
            className="rounded-md px-3 py-1 text-sm font-medium text-zinc-600 transition-colors aria-pressed:bg-white aria-pressed:text-zinc-900 aria-pressed:shadow-sm dark:text-zinc-400 dark:aria-pressed:bg-zinc-800 dark:aria-pressed:text-zinc-100"
          >
            {f.label}
          </button>
        ))}
      </div>

      {isPending ? (
        <Loading />
      ) : isError ? (
        <QueryError error={error} onRetry={() => refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState>{filter === 'pending' ? '¡No tenés preguntas sin resolver!' : 'No hay preguntas acá todavía.'}</EmptyState>
      ) : (
        <ListCard>
          {data.items.map((q) => (
            <QuestionItem key={q.id} question={q} />
          ))}
        </ListCard>
      )}

      {data && totalPages > 1 && (
        <nav aria-label="Paginación" className="flex items-center justify-between">
          <Button variant="secondary" onClick={() => setPage((p) => p - 1)} disabled={page === 0}>
            Anterior
          </Button>
          <span className="text-sm text-zinc-500">
            Página {page + 1} de {totalPages}
          </span>
          <Button variant="secondary" onClick={() => setPage((p) => p + 1)} disabled={page + 1 >= totalPages}>
            Siguiente
          </Button>
        </nav>
      )}
    </div>
  )
}

function QuestionItem({ question }: { question: Question }) {
  const [open, setOpen] = useState(false)
  const [answer, setAnswer] = useState(question.answer ?? '')
  const update = useUpdateQuestion()
  const remove = useDeleteQuestion()
  const { data: subjects } = useSubjects()
  const today = todayISO()
  const error = update.error ?? remove.error

  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={question.resolved}
          disabled={update.isPending}
          onChange={() => update.mutate({ id: question.id, resolved: !question.resolved })}
          className="mt-1 size-4 shrink-0 cursor-pointer accent-brand-600"
          aria-label={`Marcar como ${question.resolved ? 'sin resolver' : 'resuelta'}`}
        />
        <div className="min-w-0 flex-1">
          <p className={`break-words text-sm ${question.resolved ? 'text-zinc-400 line-through' : ''}`}>{question.text}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <SubjectBadge name={question.subject_name} color={question.subject_color} />
            {question.scheduled_for && !question.resolved && (
              <span
                className={`text-xs ${isOverdue(question.scheduled_for, today) ? 'font-medium text-amber-600 dark:text-amber-400' : 'text-zinc-500'}`}
              >
                Para {formatRelativeDate(question.scheduled_for, today)}
              </span>
            )}
            {question.answer && !open && <span className="text-xs text-brand-600">Con respuesta</span>}
          </div>
        </div>
        <Button variant="ghost" className="shrink-0 px-2 py-1" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? 'Cerrar' : 'Editar'}
        </Button>
      </div>

      {open && (
        <div className="mt-3 flex flex-col gap-3 pl-7">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">Materia</span>
              <select
                value={question.subject_id ?? ''}
                onChange={(e) => update.mutate({ id: question.id, subject_id: e.target.value ? Number(e.target.value) : null })}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="">Sin materia</option>
                {subjects?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">Agendada para</span>
              <input
                type="date"
                value={question.scheduled_for ?? ''}
                onChange={(e) => update.mutate({ id: question.id, scheduled_for: e.target.value || null })}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Respuesta / lo que averigüé</span>
            <textarea
              rows={3}
              maxLength={5000}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <div className="flex justify-between gap-2">
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() => {
                if (window.confirm('¿Borrar esta pregunta?')) remove.mutate(question.id)
              }}
            >
              Borrar
            </Button>
            <Button
              loading={update.isPending}
              disabled={answer === (question.answer ?? '')}
              onClick={() => update.mutate({ id: question.id, answer: answer.trim() || null })}
            >
              Guardar respuesta
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 pl-7 text-sm text-red-600 dark:text-red-400">
          {errorMessage(error)}
        </p>
      )}
    </li>
  )
}
