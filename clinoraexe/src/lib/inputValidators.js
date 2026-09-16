/**
 * Strips non-digits, leading zeros, and clamps to 10 characters.
 * Safe to call on every keystroke — returns the sanitized value.
 */
export function sanitizeMobile(value) {
  return value
    .replace(/\D/g, '')       // digits only
    .replace(/^0+/, '')       // no leading zeros
    .slice(0, 10)             // max 10 digits
}

/**
 * Returns an error string if the mobile is invalid, or null if valid.
 * Empty string is allowed (field is optional in most forms).
 */
export function validateMobile(value) {
  if (!value) return null
  if (!/^[1-9]/.test(value))  return 'Mobile number cannot start with 0.'
  if (value.length !== 10)    return 'Mobile number must be exactly 10 digits.'
  return null
}

/**
 * Strips non-digit characters from age input (allows empty).
 */
export function sanitizeAge(value) {
  return value.replace(/\D/g, '').slice(0, 3)
}

/**
 * Returns an error string if the age is invalid, or null if valid.
 */
export function validateAge(value) {
  if (value === '' || value == null) return null
  const n = Number(value)
  if (isNaN(n) || n < 0 || n > 150) return 'Age must be between 0 and 150.'
  return null
}
