import * as jalaali from 'jalaali-js'

/**
 * Adds n days to a jalali date string (YYYY/MM/DD).
 */
export function jalaliAddDays(dateStr: string, n: number): string {
  const parts = dateStr.split('/')
  if (parts.length < 3) return dateStr

  const jy = parseInt(parts[0], 10)
  const jm = parseInt(parts[1], 10)
  const jd = parseInt(parts[2], 10)

  if (!jalaali.isValidJalaaliDate(jy, jm, jd)) return dateStr

  const serial = jalaali.j2d(jy, jm, jd)
  const result = jalaali.d2j(serial + n)

  const mm = String(result.jm).padStart(2, '0')
  const dd = String(result.jd).padStart(2, '0')
  return `${result.jy}/${mm}/${dd}`
}

/**
 * Parses a jalali date string into components.
 */
export function parseJalali(dateStr: string): { jy: number; jm: number; jd: number } | null {
  const parts = dateStr.split('/')
  if (parts.length < 3) return null

  const jy = parseInt(parts[0], 10)
  const jm = parseInt(parts[1], 10)
  const jd = parseInt(parts[2], 10)

  if (!jalaali.isValidJalaaliDate(jy, jm, jd)) return null

  return { jy, jm, jd }
}

/**
 * Formats jalali components to string.
 */
export function formatJalali(jy: number, jm: number, jd: number): string {
  const mm = String(jm).padStart(2, '0')
  const dd = String(jd).padStart(2, '0')
  return `${jy}/${mm}/${dd}`
}