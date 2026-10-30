/** Form validation shared by auth, onboarding and profile screens. */

export interface FieldError {
  field: string;
  message: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Minimum length recommended by NIST SP 800-63B for user-chosen secrets. */
export const MIN_PASSWORD_LENGTH = 10;
/** At this length a passphrase no longer needs character-class rules. */
export const PASSPHRASE_LENGTH = 16;
export const MAX_PASSWORD_LENGTH = 128;
export const MAX_DISPLAY_NAME_LENGTH = 40;
export const MAX_HEADLINE_LENGTH = 80;
export const MAX_BIO_LENGTH = 400;
export const MAX_REQUEST_REASON_LENGTH = 240;
export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_REPORT_DETAIL_LENGTH = 600;
export const MAX_COMMUNITY_DESCRIPTION_LENGTH = 600;

export function validateEmail(email: string): string | null {
  const value = email.trim();
  if (!value) return 'Enter your email address.';
  if (!EMAIL_PATTERN.test(value)) return 'That does not look like a valid email address.';
  if (value.length > 254) return 'That email address is too long.';
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Enter a password.';
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) return 'That password is too long.';
  // Length is the property that actually resists guessing, so a long passphrase
  // is accepted on its own (NIST SP 800-63B, section 5.1.1.2).
  if (password.length >= PASSPHRASE_LENGTH) return null;
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/].filter((pattern) => pattern.test(password)).length;
  if (classes < 2) {
    return `Include at least two of: lowercase letters, uppercase letters, numbers — or use ${PASSPHRASE_LENGTH} characters or more.`;
  }
  return null;
}

export function validateDisplayName(name: string): string | null {
  const value = name.trim();
  if (!value) return 'Enter a display name.';
  if (value.length < 2) return 'Use at least 2 characters.';
  if (value.length > MAX_DISPLAY_NAME_LENGTH) {
    return `Keep it under ${MAX_DISPLAY_NAME_LENGTH} characters.`;
  }
  // Reject control characters and angle brackets used in injection attempts.
  if (/[<>\u0000-\u001F]/.test(value)) return 'Remove unsupported characters.';
  return null;
}

export function validatePasswordConfirmation(password: string, confirmation: string): string | null {
  if (!confirmation) return 'Repeat your password.';
  if (password !== confirmation) return 'The passwords do not match.';
  return null;
}

export function validateJoinCode(code: string): string | null {
  const value = code.trim();
  if (!value) return 'Enter the join code.';
  if (!/^[A-Za-z0-9-]{4,24}$/.test(value)) {
    return 'Join codes use letters, numbers and hyphens only.';
  }
  return null;
}

export interface ValidationResult {
  valid: boolean;
  errors: FieldError[];
}

export function validateFields(
  checks: Array<[field: string, error: string | null]>,
): ValidationResult {
  const errors = checks
    .filter((entry): entry is [string, string] => entry[1] !== null)
    .map(([field, message]) => ({ field, message }));
  return { valid: errors.length === 0, errors };
}

export function firstErrorFor(errors: FieldError[], field: string): string | null {
  return errors.find((error) => error.field === field)?.message ?? null;
}

/**
 * Validates an outgoing message body.
 *
 * Whitespace-only messages are rejected rather than trimmed into emptiness, so
 * the send button never appears to do nothing.
 */
export function validateOutgoingMessage(body: string): string | null {
  const value = body.trim();
  if (!value) return 'Write something before sending.';
  if (value.length > MAX_MESSAGE_LENGTH) {
    return `Messages are limited to ${MAX_MESSAGE_LENGTH} characters.`;
  }
  if (/^[\s\u200B-\u200D]+$/.test(value)) return 'That message contains no visible characters.';
  return null;
}

/** Community creation rules, shared by the create and edit paths. */
export function validateCommunityName(name: string): string | null {
  const value = name.trim();
  if (!value) return 'Enter a community name.';
  if (value.length < 3) return 'Use at least 3 characters.';
  if (value.length > 60) return 'Keep the name under 60 characters.';
  if (/[<>\u0000-\u001F]/.test(value)) return 'Remove unsupported characters.';
  return null;
}

export function validateCommunitySlugInput(slug: string): string | null {
  const value = slug.trim();
  if (!value) return 'Enter a short identifier.';
  if (!/^[a-z0-9-]{3,60}$/.test(value)) {
    return 'Use lowercase letters, numbers and hyphens only.';
  }
  return null;
}

export function validateEventTitle(title: string): string | null {
  const value = title.trim();
  if (!value) return 'Enter an event title.';
  if (value.length < 4) return 'Use at least 4 characters.';
  if (value.length > 90) return 'Keep the title under 90 characters.';
  return null;
}

/** Attachment rules applied before upload, mirroring the storage policy. */
export const ATTACHMENT_RULES = {
  maxBytes: 8 * 1024 * 1024,
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
  allowedAudioTypes: ['audio/m4a', 'audio/mp4', 'audio/aac', 'audio/mpeg', 'audio/wav'],
  maxVoiceNoteSeconds: 120,
} as const;

export function validateAttachment(
  mimeType: string,
  byteSize: number,
): { ok: true } | { ok: false; message: string } {
  const isImage = ATTACHMENT_RULES.allowedImageTypes.includes(
    mimeType as (typeof ATTACHMENT_RULES.allowedImageTypes)[number],
  );
  const isAudio = ATTACHMENT_RULES.allowedAudioTypes.includes(
    mimeType as (typeof ATTACHMENT_RULES.allowedAudioTypes)[number],
  );
  if (!isImage && !isAudio) {
    return { ok: false, message: 'Only JPEG, PNG, WebP and common audio files can be shared.' };
  }
  if (byteSize > ATTACHMENT_RULES.maxBytes) {
    return { ok: false, message: 'That file is larger than 8 MB.' };
  }
  if (byteSize <= 0) {
    return { ok: false, message: 'That file appears to be empty.' };
  }
  return { ok: true };
}

/** Rejects private-residence style venue text for in-person events. */
export function validateEventVenue(venue: string): string | null {
  const value = venue.trim();
  if (!value) return 'Enter the venue name.';
  if (value.length < 3) return 'Enter a fuller venue name.';
  if (/\b(flat|apartment|my house|home address|door\s*\d+)\b/i.test(value)) {
    return 'Events must be held in a public venue. Do not use a private address.';
  }
  return null;
}
