import { useState, type ReactNode } from 'react'
import { getThemePreference, setThemePreference, type ThemePreference } from '../lib/theme'

const OPTIONS: { value: ThemePreference; label: string; icon: ReactNode }[] = [
  {
    value: 'light',
    label: 'Claro',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="size-4 shrink-0" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    ),
  },
  {
    value: 'system',
    label: 'Sistema',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="size-4 shrink-0" aria-hidden="true">
        <rect x="3" y="4" width="18" height="12" rx="1.5" />
        <path d="M8 20h8M12 16v4" />
      </svg>
    ),
  },
  {
    value: 'dark',
    label: 'Oscuro',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-4 shrink-0" aria-hidden="true">
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    ),
  },
]

/** Selector de tema (claro / sistema / oscuro). Pensado para fondo azul marino. */
export function ThemeToggle({ onDark = true, labels = false }: { onDark?: boolean; labels?: boolean }) {
  const [pref, setPref] = useState<ThemePreference>(getThemePreference)
  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      className={`grid grid-cols-3 gap-0.5 rounded-lg p-0.5 ${onDark ? 'bg-white/8' : 'bg-zinc-100 dark:bg-zinc-800'}`}
    >
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={pref === o.value}
          title={o.label}
          aria-label={o.label}
          onClick={() => {
            setPref(o.value)
            setThemePreference(o.value)
          }}
          className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
            onDark
              ? 'text-white/60 hover:text-white aria-checked:bg-white/15 aria-checked:text-white'
              : 'text-zinc-500 hover:text-zinc-900 aria-checked:bg-white aria-checked:text-zinc-900 aria-checked:shadow-sm dark:hover:text-zinc-100 dark:aria-checked:bg-zinc-700 dark:aria-checked:text-white'
          }`}
        >
          {o.icon}
          <span className={labels ? 'sr-only sm:not-sr-only' : 'sr-only'}>{o.label}</span>
        </button>
      ))}
    </div>
  )
}
