import { isSafeMeetingUrl, MODALITY_LABEL } from '../lib/modality'
import type { Modality } from '../lib/types'

export function ModalityBadge({ modality }: { modality: Modality }) {
  if (modality === 'unknown') return null
  const styles =
    modality === 'virtual'
      ? 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:ring-sky-900'
      : 'bg-zinc-100 text-zinc-700 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${styles}`}>
      {MODALITY_LABEL[modality]}
    </span>
  )
}

/** Botón para entrar a la videollamada. */
export function JoinLink({ url, subject, compact = false }: { url: string | null; subject: string; compact?: boolean }) {
  if (!isSafeMeetingUrl(url)) return null
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Unirse a la clase virtual de ${subject} (se abre en otra pestaña)`}
      className={`inline-flex items-center gap-1 rounded-lg bg-sky-600 font-medium text-white hover:bg-sky-700 ${
        compact ? 'px-2 py-0.5 text-xs' : 'px-3 py-1.5 text-sm'
      }`}
    >
      Unirse
      <span aria-hidden="true">↗</span>
    </a>
  )
}
