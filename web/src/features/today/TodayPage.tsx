import { Link } from 'react-router'
import { JoinLink, ModalityBadge } from '../../components/modality'
import { EmptyState, ListCard, Loading, PageHeader, QueryError, Section, SubjectBadge } from '../../components/study'
import { errorMessage } from '../../lib/api'
import { DATE_KIND_LABEL, formatLongDate, formatRelativeDate, formatTime, isOverdue } from '../../lib/dates'
import { useAgenda, useUpdateQuestion, useUpdateTask } from '../../lib/queries'
import type { Question, StudyTask } from '../../lib/types'

export function TodayPage() {
  const { data, isPending, isError, error, refetch } = useAgenda()

  if (isPending) return <Loading label="Cargando tu día…" />
  if (isError) return <QueryError error={error} onRetry={() => refetch()} />

  const pending = data.tasks.length + data.questions.length

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Qué estudiar hoy"
        subtitle={
          <>
            <span>{formatLongDate(data.date)}</span>
            {' · '}
            {pending === 0 ? 'nada pendiente' : `${pending} ${pending === 1 ? 'cosa pendiente' : 'cosas pendientes'}`}
          </>
        }
      />

      <Section title="Clases de hoy">
        {data.classes.length === 0 ? (
          <EmptyState>
            Hoy no tenés clases. <Link to="/horario" className="font-medium text-brand-600 hover:underline">Ver horario</Link>
          </EmptyState>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.classes.map((c) => (
              <div
                key={`${c.subject_id}-${c.start_time}`}
                className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900"
                style={{ borderLeftColor: c.subject_color, borderLeftWidth: 4 }}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-sm font-medium">{c.subject_name}</p>
                    <ModalityBadge modality={c.modality ?? 'unknown'} />
                  </div>
                  <p className="text-xs text-zinc-500">
                    {formatTime(c.start_time)}–{formatTime(c.end_time)}
                    {c.modality !== 'virtual' && c.location && ` · ${c.location}`}
                  </p>
                </div>
                <JoinLink url={c.meeting_url} subject={c.subject_name} />
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Para repasar">
        {data.tasks.length === 0 ? (
          <EmptyState>
            No tenés repasos para hoy. Cuando{' '}
            <Link to="/apuntes" className="font-medium text-brand-600 hover:underline">subas un apunte</Link>, la IA arma qué repasar antes
            de la próxima clase.
          </EmptyState>
        ) : (
          <ListCard>
            {data.tasks.map((t) => (
              <TaskRow key={t.id} task={t} today={data.date} />
            ))}
          </ListCard>
        )}
      </Section>

      <Section title="Preguntas para resolver">
        {data.questions.length === 0 ? (
          <EmptyState>No hay preguntas agendadas para hoy.</EmptyState>
        ) : (
          <ListCard>
            {data.questions.map((q) => (
              <QuestionRow key={q.id} question={q} today={data.date} />
            ))}
          </ListCard>
        )}
      </Section>

      {data.upcoming.length > 0 && (
        <Section title="Próximas fechas importantes">
          <ListCard>
            {data.upcoming.map((u, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{u.title}</p>
                  <p className="text-xs text-zinc-500">
                    {DATE_KIND_LABEL[u.kind]}
                    {u.subject_name && ` · ${u.subject_name}`}
                  </p>
                </div>
                <span className={`shrink-0 text-xs font-medium ${u.kind === 'exam' ? 'text-red-600 dark:text-red-400' : 'text-zinc-500'}`}>
                  {formatRelativeDate(u.date, data.date)}
                </span>
              </li>
            ))}
          </ListCard>
        </Section>
      )}
    </div>
  )
}

export function TaskRow({ task, today }: { task: StudyTask; today: string }) {
  const update = useUpdateTask()
  const overdue = !task.done && isOverdue(task.due_date, today)
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <input
        type="checkbox"
        checked={task.done}
        disabled={update.isPending}
        onChange={() => update.mutate({ id: task.id, done: !task.done })}
        className="mt-1 size-4 shrink-0 cursor-pointer accent-brand-600"
        aria-label={`Marcar "${task.title}" como ${task.done ? 'pendiente' : 'hecho'}`}
      />
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${task.done ? 'text-zinc-400 line-through' : ''}`}>{task.title}</p>
        {task.detail && <p className="mt-0.5 text-sm text-zinc-500">{task.detail}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <SubjectBadge name={task.subject_name} color={task.subject_color} />
          {overdue && <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Atrasado ({formatRelativeDate(task.due_date, today)})</span>}
          {task.note_id && (
            <Link to={`/apuntes/${task.note_id}`} className="text-xs text-brand-600 hover:underline">
              Ver apunte
            </Link>
          )}
        </div>
        {update.isError && (
          <p role="alert" className="mt-1 text-sm text-red-600">
            {errorMessage(update.error)}
          </p>
        )}
      </div>
    </li>
  )
}

export function QuestionRow({ question, today }: { question: Question; today: string }) {
  const update = useUpdateQuestion()
  const overdue = !question.resolved && question.scheduled_for && isOverdue(question.scheduled_for, today)
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <input
        type="checkbox"
        checked={question.resolved}
        disabled={update.isPending}
        onChange={() => update.mutate({ id: question.id, resolved: !question.resolved })}
        className="mt-1 size-4 shrink-0 cursor-pointer accent-brand-600"
        aria-label={`Marcar la pregunta como ${question.resolved ? 'sin resolver' : 'resuelta'}`}
      />
      <div className="min-w-0 flex-1">
        <p className={`text-sm ${question.resolved ? 'text-zinc-400 line-through' : ''}`}>{question.text}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <SubjectBadge name={question.subject_name} color={question.subject_color} />
          {overdue && question.scheduled_for && (
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
              Agendada {formatRelativeDate(question.scheduled_for, today)}
            </span>
          )}
        </div>
      </div>
    </li>
  )
}
