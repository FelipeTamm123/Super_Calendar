import { useEffect, useId, useRef, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { errorMessage } from '../lib/api'
import { useStatus, useSubjects } from '../lib/queries'
import { Alert, Button, Spinner } from './ui'

export function SubjectBadge({ name, color }: { name: string | null; color: string | null }) {
  if (!name) {
    return <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">Sin materia</span>
  }
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300">
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color ?? '#10b981' }} aria-hidden="true" />
      <span className="truncate">{name}</span>
    </span>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800">
      {children}
    </p>
  )
}

export function ListCard({ children }: { children: ReactNode }) {
  return (
    <ul className="divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
      {children}
    </ul>
  )
}

export function Loading({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex justify-center py-12 text-brand-600" role="status">
      <Spinner />
      <span className="sr-only">{label}</span>
    </div>
  )
}

export function QueryError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <Alert>{errorMessage(error)}</Alert>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  )
}

/** Aviso cuando el backend no tiene la clave de la IA configurada. */
export function AIDisabledNotice({ children }: { children?: ReactNode }) {
  const { data } = useStatus()
  if (!data || data.ai_enabled) return null
  return (
    <Alert tone="info">
      {children ?? 'La IA no está configurada en el servidor (falta GEMINI_API_KEY). Las funciones automáticas no van a andar.'}
    </Alert>
  )
}

type SubjectSelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange'> & {
  label: string
  value: number | ''
  onChange: (value: number | '') => void
  emptyLabel?: string
}

export function SubjectSelect({ label, value, onChange, emptyLabel = 'Elegí una materia', className = '', ...props }: SubjectSelectProps) {
  const id = useId()
  const { data: subjects } = useSubjects()
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')}
        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-xs dark:border-zinc-700 dark:bg-zinc-900"
        {...props}
      >
        <option value="">{emptyLabel}</option>
        {subjects?.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </div>
  )
}

/** Diálogo modal accesible usando <dialog> nativo (maneja foco y Escape). */
export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal?.()
    if (!open && dialog.open) dialog.close?.()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose() // click en el fondo
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-zinc-200 bg-white p-0 text-zinc-900 shadow-xl backdrop:bg-zinc-950/40 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
    >
      {open && (
        <div className="p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  )
}

export function TextArea({
  label,
  error,
  hint,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string; hint?: string }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-help` : undefined}
        className="min-h-24 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-xs placeholder:text-zinc-400 aria-invalid:border-red-500 dark:border-zinc-700 dark:bg-zinc-900"
        {...props}
      />
      {(error || hint) && (
        <p id={`${id}-help`} className={error ? 'text-sm text-red-600 dark:text-red-400' : 'text-xs text-zinc-500'}>
          {error ?? hint}
        </p>
      )}
    </div>
  )
}
