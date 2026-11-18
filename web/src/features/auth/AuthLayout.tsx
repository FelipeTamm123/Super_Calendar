import type { ReactNode } from 'react'
import { Logo } from '../../components/Logo'
import { ThemeToggle } from '../../components/ThemeToggle'

const FEATURES = [
  ['Apuntes ordenados solos', 'Subí texto, fotos o PDF: la IA detecta la materia y resume la clase.'],
  ['Qué estudiar cada día', 'Los repasos se agendan antes de tu próxima clase.'],
  ['Tu calendario, sincronizado', 'Exámenes y clases en Google, Apple u Outlook.'],
]

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Panel de marca */}
      <aside className="relative hidden overflow-hidden bg-navy-900 p-12 text-white lg:flex lg:flex-col">
        <div aria-hidden="true" className="pointer-events-none absolute -top-32 -right-32 size-96 rounded-full bg-accent-violet/25 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -left-24 size-96 rounded-full bg-accent-cyan/15 blur-3xl" />
        <Logo onDark size="lg" tagline className="relative" />
        <div className="relative mt-auto max-w-md">
          <p className="text-3xl leading-tight font-bold">Estudiá con un plan, no con apuro.</p>
          <ul className="mt-8 flex flex-col gap-5">
            {FEATURES.map(([t, d]) => (
              <li key={t} className="border-l-2 border-accent-cyan/70 pl-4">
                <p className="font-semibold">{t}</p>
                <p className="text-sm text-white/65">{d}</p>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Formulario */}
      <main className="flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center justify-between">
          <Logo className="lg:invisible" />
          <div className="w-32 sm:w-64">
            <ThemeToggle onDark={false} labels />
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="mt-1.5 text-zinc-500">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  )
}
