/**
 * Shared input rules for every form in the app.
 */

export const NAME_MAX = 30;
export const EMAIL_MAX = 254;
export const PHONE_MIN_DIGITS = 7;
export const PHONE_MAX_DIGITS = 15;
export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 64;
export const OTP_LENGTH = 6;
export const CARD_NUMBER_DIGITS = 16;
export const CVV_MIN = 3;
export const CVV_MAX = 4;
export const PURPOSE_MIN = 3;
export const PURPOSE_MAX = 200;
export const SUBJECT_MAX = 100;
export const DESCRIPTION_MAX = 1000;
export const ADDRESS_MAX = 200;

export const EMAIL_PATTERN = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i;

export const GENDER_OPTIONS = ['Male', 'Female', 'Other'] as const;
export type GenderOption = (typeof GENDER_OPTIONS)[number];

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/* ------------------------------------------------------------------ name */

/** Length is the only limit on a name - any character is allowed through. */
export function sanitizeName(value: string): string {
  return value.slice(0, NAME_MAX);
}

export function validateName(value: string): string | undefined {
  const name = value.trim();
  if (!name) return 'Name is required.';
  if (name.length > NAME_MAX) return 'Name is too long.';
  return undefined;
}

/* ----------------------------------------------------------------- email */

export function sanitizeEmail(value: string): string {
  return value.replace(/\s/g, '').slice(0, EMAIL_MAX);
}

export function validateEmail(value: string, requiredKey = 'Email is required.'): string | undefined {
  const email = value.trim();
  if (!email) return requiredKey;
  if (email.length > EMAIL_MAX) return 'Email is too long.';
  if (!EMAIL_PATTERN.test(email)) return 'Enter a valid email address (e.g. name@example.com).';
  return undefined;
}

/* ----------------------------------------------------------------- phone */

export function sanitizePhone(value: string): string {
  const plus = value.trimStart().startsWith('+') ? '+' : '';
  return plus + digitsOnly(value).slice(0, PHONE_MAX_DIGITS);
}

export function validatePhone(value: string, requiredKey = 'Phone is required.'): string | undefined {
  const phone = value.trim();
  if (!phone) return requiredKey;
  const digits = digitsOnly(phone);
  if (digits.length < PHONE_MIN_DIGITS || digits.length > PHONE_MAX_DIGITS) {
    return 'Enter a valid phone number (7 to 15 digits).';
  }
  return undefined;
}

/* -------------------------------------------------------------- password */

export function sanitizePassword(value: string): string {
  return value.replace(/\s/g, '').slice(0, PASSWORD_MAX);
}

export function validatePassword(value: string): string | undefined {
  if (!value) return 'Password is required.';
  if (value.length < PASSWORD_MIN) return 'Password must be at least 6 characters.';
  if (value.length > PASSWORD_MAX) return 'Password is too long.';
  return undefined;
}

/* ------------------------------------------------------------------- otp */

export function sanitizeOtp(value: string): string {
  return digitsOnly(value).slice(0, OTP_LENGTH);
}

export function validateOtp(value: string): string | undefined {
  if (!value) return 'OTP is required.';
  if (value.length < 4) return 'Enter the complete OTP code.';
  return undefined;
}

/* ------------------------------------------------------------ card number */

export function sanitizeCardNumber(value: string): string {
  const digits = digitsOnly(value).slice(0, CARD_NUMBER_DIGITS);
  return digits.replace(/(.{4})(?=.)/g, '$1 ');
}

/** Standard Luhn checksum - rejects mistyped card numbers. */
function passesLuhn(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let digit = Number(digits[i]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

export function validateCardNumber(value: string): string | undefined {
  const digits = digitsOnly(value);
  if (!digits) return 'Card number is required.';
  if (digits.length !== CARD_NUMBER_DIGITS) return 'Card number must be 16 digits.';
  if (!passesLuhn(digits)) return 'Enter a valid card number.';
  return undefined;
}

/* ----------------------------------------------------------- card expiry */

/** Keeps the field as `MM/YY`, padding a lone month digit and clamping 01-12. */
export function sanitizeExpiry(value: string): string {
  const digits = digitsOnly(value);
  if (!digits) return '';
  if (digits.length === 1) {
    if (Number(digits) > 1) return `0${digits}/`;
    return value.includes('/') ? `0${digits}/` : digits;
  }
  const capped = digits.slice(0, 4);
  const month = Number(capped.slice(0, 2));
  const mm = month === 0 ? '01' : month > 12 ? '12' : capped.slice(0, 2);
  const yy = capped.slice(2);
  return yy ? `${mm}/${yy}` : mm;
}

export function validateExpiry(value: string): string | undefined {
  const expiry = value.trim();
  if (!expiry) return 'Expiry date is required.';
  const match = /^(\d{2})\/(\d{2})$/.exec(expiry);
  if (!match) return 'Enter expiry as MM/YY.';

  const month = Number(match[1]);
  if (month < 1 || month > 12) return 'Enter expiry as MM/YY.';

  const now = new Date();
  const currentYear = now.getFullYear();
  const year = Math.floor(currentYear / 100) * 100 + Number(match[2]);

  // Compare against the first day of the month after the card expires.
  const expiresAfter = new Date(year, month, 1);
  if (expiresAfter <= new Date(currentYear, now.getMonth(), 1)) return 'Card has expired.';
  if (year > currentYear + 20) return 'Enter a valid expiry date.';
  return undefined;
}

/* ------------------------------------------------------------------- cvv */

export function sanitizeCvv(value: string): string {
  return digitsOnly(value).slice(0, CVV_MAX);
}

export function validateCvv(value: string): string | undefined {
  if (!value) return 'CVV is required.';
  if (value.length < CVV_MIN || value.length > CVV_MAX) return 'CVV must be 3 or 4 digits.';
  return undefined;
}

/* ---------------------------------------------------------------- gender */

/** Maps a stored gender onto one of the three chips, or `undefined`. */
export function matchGenderOption(value?: string | null): GenderOption | undefined {
  if (!value) return undefined;
  return GENDER_OPTIONS.find(option => option.toLowerCase() === String(value).trim().toLowerCase());
}

export function validateGender(value: string): string | undefined {
  if (!value) return 'Gender is required.';
  if (!GENDER_OPTIONS.some(option => option.toLowerCase() === value.toLowerCase())) {
    return 'Select a valid gender.';
  }
  return undefined;
}

/* -------------------------------------------------------------- free text */

export function sanitizeText(value: string, max: number): string {
  return value.replace(/\s{3,}/g, '  ').slice(0, max);
}

export function validateRequiredText(
  value: string,
  requiredKey: string,
  min: number,
  max: number,
  tooShortKey: string,
): string | undefined {
  const text = value.trim();
  if (!text) return requiredKey;
  if (text.length < min) return tooShortKey;
  if (text.length > max) return 'This value is too long.';
  return undefined;
}
