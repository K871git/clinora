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
  if (value.length !== 10)       return 'Mobile number must be exactly 10 digits.'
  if (!/^[6-9]/.test(value))     return 'Mobile number must start with 6, 7, 8 or 9.'
  return null
}

/** Returns error string if DOB is in the future, or null if valid. */
export function validateDob(value) {
  if (!value) return null
  const dob = new Date(value)
  if (dob > new Date()) return 'Date of birth cannot be in the future.'
  return null
}

/** Returns error string if fee is negative, or null if valid. */
export function validateFee(value) {
  if (value === '' || value == null) return null
  const n = parseFloat(value)
  if (isNaN(n) || n < 0) return 'Fee cannot be negative.'
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
