import { useState, type FormEvent } from 'react'
import { Dialog, SubjectSelect, TextArea } from '../../components/study'
import { Alert, Button, TextField } from '../../components/ui'
import { errorMessage } from '../../lib/api'
import { formatLongDate } from '../../lib/dates'
import { useCreateQuestion, useCreateTask } from '../../lib/queries'

type Kind = 'task' | 'question'

export function NewEntryDialog({ open, date, onClose }: { open: boolean; date: string; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Nueva entrada">
      {/* key: el formulario se reinicia cada vez que se abre */}
      {open && <EntryForm key={date} date={date} onDone={onClose} />}
    </Dialog>
  )
}

function EntryForm({ date, onDone }: { date: string; onDone: () => void }) {
  const [kind, setKind] = useState<Kind>('task')
  const [subjectId, setSubjectId] = useState<number | ''>('')
  const [title, setTitle] = useState('')
  const [detail, setDetail] = useState('')
  const createTask = useCreateTask()
  const createQuestion = useCreateQuestion()
  const pending = createTask.isPending || createQuestion.isPending
  const error = createTask.error ?? createQuestion.error

  const canSubmit = title.trim() && (kind === 'question' || subjectId !== '')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    if (kind === 'task') {
      createTask.mutate(
        { subject_id: subjectId as number, due_date: date, title: title.trim(), detail: detail.trim() || null },
        { onSuccess: onDone },
      )
    } else {
      createQuestion.mutate(
        { text: title.trim(), scheduled_for: date, ...(subjectId ? { subject_id: subjectId } : {}) },
        { onSuccess: onDone },
      )
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <p className="text-sm text-zinc-500 first-letter:uppercase">{formatLongDate(date)}</p>
      <div role="radiogroup" aria-label="Tipo de entrada" className="grid grid-cols-2 gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
        {(
          [
            ['task', 'Repaso'],
            ['question', 'Pregunta'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={kind === value}
            onClick={() => setKind(value)}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 aria-checked:bg-white aria-checked:text-zinc-900 aria-checked:shadow-sm dark:text-zinc-400 dark:aria-checked:bg-zinc-900 dark:aria-checked:text-zinc-100"
          >
            {label}
          </button>
        ))}
      </div>

      <SubjectSelect
        label={kind === 'task' ? 'Materia' : 'Materia (opcional)'}
        value={subjectId}
        onChange={setSubjectId}
        emptyLabel={kind === 'task' ? 'Elegí una materia' : 'Que la detecte la IA'}
      />
      {kind === 'task' ? (
        <>
          <TextField label="Qué repasar" autoFocus maxLength={300} value={title} onChange={(e) => setTitle(e.target.value)} />
          <TextArea label="Detalle (opcional)" rows={2} maxLength={2000} value={detail} onChange={(e) => setDetail(e.target.value)} />
        </>
      ) : (
        <TextArea label="Pregunta" autoFocus rows={3} maxLength={2000} value={title} onChange={(e) => setTitle(e.target.value)} />
      )}

      {error && <Alert>{errorMessage(error)}</Alert>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" loading={pending} disabled={!canSubmit}>
          Guardar
        </Button>
      </div>
    </form>
  )
}
