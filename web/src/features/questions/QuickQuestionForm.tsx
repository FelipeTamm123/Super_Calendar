import { useState, type FormEvent } from 'react'
import { Alert, Button } from '../../components/ui'
import { errorMessage } from '../../lib/api'
import { formatRelativeDate } from '../../lib/dates'
import { useCreateQuestion } from '../../lib/queries'
import type { Question } from '../../lib/types'

/** Anotar una pregunta sin pensar dónde va: la IA detecta la materia y la agenda. */
export function QuickQuestionForm({ onCreated, autoFocus }: { onCreated?: (q: Question) => void; autoFocus?: boolean }) {
  const [text, setText] = useState('')
  const [last, setLast] = useState<Question | null>(null)
  const create = useCreateQuestion()

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const clean = text.trim()
    if (!clean) return
    create.mutate(
      { text: clean },
      {
        onSuccess: (q) => {
          setText('')
          setLast(q)
          onCreated?.(q)
        },
      },
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" aria-label="Nueva pregunta">
      <label htmlFor="quick-question" className="sr-only">
        Tu pregunta
      </label>
      <textarea
        id="quick-question"
        autoFocus={autoFocus}
        rows={2}
        maxLength={2000}
        placeholder="Ej: ¿por qué la derivada de una constante es cero?"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit(e)
        }}
        className="w-full resize-y rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm shadow-xs placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
      />
      {create.isError && <Alert>{errorMessage(create.error)}</Alert>}
      {last && !create.isPending && (
        <Alert tone="success">
          Anotada{last.subject_name ? ` en ${last.subject_name}` : ' (sin materia)'}
          {last.scheduled_for && `, agendada para ${formatRelativeDate(last.scheduled_for)}`}.
        </Alert>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-zinc-500">La IA detecta la materia y la agenda antes de tu próxima clase.</span>
        <Button type="submit" loading={create.isPending} disabled={!text.trim()}>
          Anotar
        </Button>
      </div>
    </form>
  )
}
