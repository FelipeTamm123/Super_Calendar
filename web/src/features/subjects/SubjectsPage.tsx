import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { EmptyState, Loading, PageHeader, QueryError } from '../../components/study'
import { Alert, Button, Card } from '../../components/ui'
import { errorMessage } from '../../lib/api'
import { formatRelativeDate } from '../../lib/dates'
import { useCreateSubject, useSubjects } from '../../lib/queries'

export function SubjectsPage() {
  const { data, isPending, isError, error, refetch } = useSubjects()
  const create = useCreateSubject()
  const [name, setName] = useState('')
  const [color, setColor] = useState('#10b981')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    create.mutate({ name: name.trim(), color }, { onSuccess: () => setName('') })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Materias" subtitle="Cada materia tiene su hoja de dudas y temas pendientes." />

      <Card className="p-4">
        <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2" aria-label="Nueva materia">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="size-9 cursor-pointer rounded-md border border-zinc-300 bg-transparent p-0.5 dark:border-zinc-700"
            aria-label="Color de la materia"
          />
          <label htmlFor="new-subject" className="sr-only">
            Nombre de la materia
          </label>
          <input
            id="new-subject"
            value={name}
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nueva materia (ej: Análisis Matemático I)"
            className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <Button type="submit" loading={create.isPending} disabled={!name.trim()}>
            Agregar
          </Button>
        </form>
        {create.isError && (
          <div className="mt-3">
            <Alert>{errorMessage(create.error)}</Alert>
          </div>
        )}
      </Card>

      {isPending ? (
        <Loading />
      ) : isError ? (
        <QueryError error={error} onRetry={() => refetch()} />
      ) : data.length === 0 ? (
        <EmptyState>Todavía no tenés materias. Agregalas acá, cargando tu horario o subiendo un apunte.</EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.map((s) => (
            <Link
              key={s.id}
              to={`/materias/${s.id}`}
              className="group rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
              style={{ borderTopColor: s.color, borderTopWidth: 4 }}
            >
              <p className="font-medium group-hover:text-brand-600">{s.name}</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                {s.next_class ? `Próxima clase: ${formatRelativeDate(s.next_class)}` : 'Sin clases en el horario'}
              </p>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                {[
                  ['Dudas', s.open_questions],
                  ['Temas', s.pending_topics],
                  ['Repasos', s.pending_tasks],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-zinc-50 py-1.5 dark:bg-zinc-800/60">
                    <dt className="text-[11px] text-zinc-500">{label}</dt>
                    <dd className="text-sm font-semibold">{value}</dd>
                  </div>
                ))}
              </dl>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
