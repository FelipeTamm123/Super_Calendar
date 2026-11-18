/** Tema claro / oscuro / según el sistema. La preferencia se guarda en este navegador. */
export type ThemePreference = 'system' | 'light' | 'dark'

const KEY = 'sc-theme'

export function getThemePreference(): ThemePreference {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

function prefersDark(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function applyTheme(pref: ThemePreference = getThemePreference()) {
  const dark = pref === 'dark' || (pref === 'system' && prefersDark())
  document.documentElement.classList.toggle('dark', dark)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0a1222' : '#f4f6fb')
}

export function setThemePreference(pref: ThemePreference) {
  try {
    if (pref === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, pref)
  } catch {
    // sin almacenamiento (modo privado): se aplica igual para esta sesión
  }
  applyTheme(pref)
}

/** Si el usuario eligió "sistema", seguir los cambios del sistema operativo en vivo. */
export function watchSystemTheme(): () => void {
  if (typeof window.matchMedia !== 'function') return () => {}
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const onChange = () => {
    if (getThemePreference() === 'system') applyTheme('system')
  }
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}
