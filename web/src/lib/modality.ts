import type { Modality } from './types'

export const MODALITY_LABEL: Record<Modality, string> = {
  in_person: 'Presencial',
  virtual: 'Virtual',
  unknown: 'Sin especificar',
}

/** Solo se muestran como link las direcciones http(s) (nunca "javascript:" u otros esquemas). */
export function isSafeMeetingUrl(url: string | null | undefined): url is string {
  if (!url) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}
