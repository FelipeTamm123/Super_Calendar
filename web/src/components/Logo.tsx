import logoMark from '../assets/logo-mark.png'

type LogoProps = {
  className?: string
  /** compact: en pantallas chicas muestra solo el ícono (el nombre queda para lectores de pantalla) */
  compact?: boolean
  /** onDark: texto claro, para fondos azul marino */
  onDark?: boolean
  size?: 'sm' | 'lg'
  tagline?: boolean
}

export function Logo({ className = '', compact = false, onDark = false, size = 'sm', tagline = false }: LogoProps) {
  const mark = size === 'lg' ? 'size-14' : 'size-8'
  const word = size === 'lg' ? 'text-2xl' : 'text-[15px]'
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <img src={logoMark} alt="" width={64} height={64} className={`${mark} shrink-0`} />
      <span className={`flex flex-col leading-none ${compact ? 'sr-only sm:not-sr-only' : ''}`}>
        <span className={`${word} font-extrabold tracking-wide uppercase`}>
          <span className={onDark ? 'text-white' : 'text-navy-900 dark:text-white'}>Super </span>
          <span className="text-accent-cyan">Calendar</span>
        </span>
        {tagline && (
          <span className={`mt-1 text-[10px] font-semibold tracking-[0.22em] uppercase ${onDark ? 'text-white/60' : 'text-zinc-500'}`}>
            AI study planner
          </span>
        )}
      </span>
    </span>
  )
}
