import { useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet } from 'react-router'
import { useAuth } from '../features/auth/auth-context'
import { QuickQuestionForm } from '../features/questions/QuickQuestionForm'
import { Logo } from './Logo'
import { Dialog } from './study'
import { ThemeToggle } from './ThemeToggle'

const icon = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="size-[18px] shrink-0" aria-hidden="true">
    {d}
  </svg>
)

const NAV = [
  { to: '/hoy', label: 'Hoy', icon: icon(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>) },
  { to: '/calendario', label: 'Calendario', icon: icon(<><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M16 2.5v4M8 2.5v4M3 10h18" /></>) },
  { to: '/apuntes', label: 'Apuntes', icon: icon(<><path d="M5 3.5h10l4 4v13H5z" /><path d="M14.5 3.5v4.5h4.5M8.5 12.5h7M8.5 16h5" /></>) },
  { to: '/preguntas', label: 'Preguntas', icon: icon(<><circle cx="12" cy="12" r="9" /><path d="M9.5 9.3a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.3-2.5 3.8M12 17.2h.01" /></>) },
  { to: '/horario', label: 'Horario', icon: icon(<><path d="M4 5h16M4 10h16M4 15h10M4 20h7" /></>) },
  { to: '/materias', label: 'Materias', icon: icon(<><path d="M4 19.5V5a1.5 1.5 0 0 1 1.5-1.5H20v15H5.5A1.5 1.5 0 0 0 4 20a1.5 1.5 0 0 0 1.5 1.5H20" /></>) },
]

const navClass = ({ isActive }: { isActive: boolean }) =>
  `relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-white/10 text-white before:absolute before:inset-y-1.5 before:-left-3 before:w-[3px] before:rounded-r before:bg-accent-cyan'
      : 'text-white/65 hover:bg-white/5 hover:text-white'
  }`

export function Layout() {
  const { user, logout } = useAuth()
  const [asking, setAsking] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)

  // En celular, el menú se cierra al elegir una opción
  const closeMenu = () => setMenuOpen(false)

  const handleLogout = async () => {
    setLeaving(true)
    await logout()
  }

  const sidebar = (
    <div className="flex h-full flex-col gap-6 px-4 py-5">
      <Link to="/hoy" aria-label="Super Calendar, inicio" className="hidden px-1 lg:block">
        <Logo onDark tagline />
      </Link>

      <button
        type="button"
        onClick={() => {
          closeMenu()
          setAsking(true)
        }}
        className="flex items-center justify-center gap-2 rounded-md bg-accent-cyan px-3 py-2 text-sm font-semibold text-navy-950 transition-colors hover:bg-[#4fd6ee]"
      >
        <span aria-hidden="true" className="text-base leading-none">+</span>
        Anotar pregunta
      </button>

      <nav aria-label="Principal" className="flex flex-col gap-0.5">
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} className={navClass} onClick={closeMenu}>
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-3 border-t border-white/10 pt-4">
        <ThemeToggle />
        <NavLink to="/perfil" className={navClass} onClick={closeMenu}>
          {icon(<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>)}
          <span className="min-w-0">
            <span className="block">Perfil</span>
            <span className="block truncate text-xs font-normal text-white/45">{user?.email}</span>
          </span>
        </NavLink>
        <button
          type="button"
          onClick={handleLogout}
          disabled={leaving}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-white/65 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50"
        >
          {icon(<><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3" /></>)}
          {leaving ? 'Saliendo…' : 'Salir'}
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-white focus:p-2 focus:text-zinc-900">
        Saltar al contenido
      </a>

      {/* Barra superior (celular / tablet) */}
      <header className="sticky top-0 z-20 flex items-center justify-between bg-navy-900 px-4 py-3 print:hidden lg:hidden">
        <Link to="/hoy" aria-label="Super Calendar, inicio">
          <Logo onDark />
        </Link>
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          className="rounded-md p-2 text-white/80 hover:bg-white/10 hover:text-white"
        >
          <span className="sr-only">{menuOpen ? 'Cerrar menú' : 'Abrir menú'}</span>
          {icon(menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />)}
        </button>
      </header>
      {menuOpen && (
        <div id="mobile-menu" className="sticky top-[56px] z-20 bg-navy-900 shadow-lg print:hidden lg:hidden">
          {sidebar}
        </div>
      )}

      {/* Barra lateral (escritorio) */}
      <aside className="sticky top-0 hidden h-dvh bg-navy-900 print:hidden lg:block dark:bg-navy-950 dark:border-r dark:border-white/5">
        {sidebar}
      </aside>

      <main id="main" className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 lg:py-10">
        <Outlet />
      </main>

      <Dialog open={asking} onClose={() => setAsking(false)} title="Pregunta al aire">
        <QuickQuestionForm autoFocus />
      </Dialog>
    </div>
  )
}
