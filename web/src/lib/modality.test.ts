import { describe, expect, it } from 'vitest'
import { isSafeMeetingUrl } from './modality'

describe('links de videollamada', () => {
  it('acepta solo http(s)', () => {
    expect(isSafeMeetingUrl('https://meet.google.com/abc-defg-hij')).toBe(true)
    expect(isSafeMeetingUrl('https://zoom.us/j/123?pwd=x')).toBe(true)
    expect(isSafeMeetingUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeMeetingUrl('data:text/html,hola')).toBe(false)
    expect(isSafeMeetingUrl('meet.google.com/abc')).toBe(false)
    expect(isSafeMeetingUrl(null)).toBe(false)
  })
})
