import { useState } from 'react'
import { Link } from 'react-router'
import { AIDisabledNotice, EmptyState, ListCard, Loading, PageHeader, QueryError, SubjectBadge, SubjectSelect } from '../../components/study'
import { Button, Card } from '../../components/ui'
import { formatRelativeDate } from '../../lib/dates'
import { useNotes } from '../../lib/queries'
import { UploadNoteForm } from './UploadNoteForm'

const PAGE_SIZE = 15

export function NotesPage() {
  const [subjectId, setSubjectId] = useState<number | ''>('')
  const [page, setPage] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const { data, isPending, isError, error, refetch } = useNotes({
    subject_id: subjectId || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  })
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1
  if (data && page > 0 && page >= totalPages) setPage(totalPages - 1)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Apuntes"
        subtitle="Subí tus apuntes de clase: la IA los ordena por materia y arma qué repasar."
        actions={
          <Button onClick={() => setShowForm((s) => !s)} aria-expanded={showForm}>
            {showForm ? 'Cerrar' : 'Subir apunte'}
          </Button>
        }
      />

      <AIDisabledNotice>
        La IA no está configurada: podés guardar apuntes eligiendo la materia, pero no se van a resumir ni generar repasos.
      </AIDisabledNotice>

      {showForm && (
        <Card>
          <UploadNoteForm />
        </Card>
      )}

      <SubjectSelect
        label="Filtrar por materia"
        value={subjectId}
        onChange={(v) => {
          setSubjectId(v)
          setPage(0)
        }}
        emptyLabel="Todas las materias"
        className="max-w-xs"
      />

      {isPending ? (
        <Loading />
      ) : isError ? (
        <QueryError error={error} onRetry={() => refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState>Todavía no hay apuntes{subjectId ? ' de esta materia' : ''}.</EmptyState>
      ) : (
        <ListCard>
          {data.items.map((n) => (
            <li key={n.id}>
              <Link to={`/apuntes/${n.id}`} className="block px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 text-sm font-medium">{n.title}</p>
                  <span className="shrink-0 text-xs text-zinc-500">{formatRelativeDate(n.class_date)}</span>
                </div>
                {n.summary && <p className="mt-1 line-clamp-2 text-sm text-zinc-500">{n.summary}</p>}
                <div className="mt-1.5 flex items-center gap-3">
                  <SubjectBadge name={n.subject_name} color={n.subject_color} />
                  {n.file_type && (
                    <span className="text-xs text-zinc-400">{n.file_type === 'application/pdf' ? 'PDF' : n.file_type.startsWith('image/') ? 'Foto' : 'Texto'}</span>
                  )}
                </div>
              </Link>
            </li>
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
