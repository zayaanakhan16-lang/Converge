import {
  MAX_BIO_LENGTH,
  MAX_MESSAGE_LENGTH,
  MIN_PASSWORD_LENGTH,
  validateAttachment,
  validateCommunityName,
  validateDisplayName,
  validateEmail,
  validateEventTitle,
  validateEventVenue,
  validateFields,
  validateJoinCode,
  validateOutgoingMessage,
  validatePassword,
  validatePasswordConfirmation,
} from '../validation';

describe('credential validation', () => {
  it('accepts a normal email and rejects malformed ones', () => {
    expect(validateEmail('member@example.com')).toBeNull();
    expect(validateEmail('member@example')).toMatch(/valid email/i);
    expect(validateEmail('')).toMatch(/enter your email/i);
  });

  it('enforces the minimum password length', () => {
    expect(validatePassword('short')).toMatch(new RegExp(String(MIN_PASSWORD_LENGTH)));
    expect(validatePassword('correct-horse-battery')).toBeNull();
  });

  it('requires a mix of character classes below the passphrase length', () => {
    expect(validatePassword('aaaaaaaaaa')).toMatch(/two of/i);
    expect(validatePassword('aaaaaaaaaA')).toBeNull();
  });

  it('accepts a long passphrase without character-class rules', () => {
    expect(validatePassword('correct horse battery staple')).toBeNull();
  });

  it('catches a mismatched confirmation', () => {
    expect(validatePasswordConfirmation('a-long-password-1', 'a-long-password-2')).toMatch(
      /do not match/i,
    );
  });

  it('rejects control characters and angle brackets in display names', () => {
    expect(validateDisplayName('<script>')).toMatch(/unsupported/i);
    expect(validateDisplayName('Amara Okonkwo')).toBeNull();
    expect(validateDisplayName('A')).toMatch(/2 characters/i);
  });

  it('normalises join code expectations', () => {
    expect(validateJoinCode('DATA-2026')).toBeNull();
    expect(validateJoinCode('nope!')).toMatch(/letters, numbers and hyphens/i);
  });
});

describe('message validation', () => {
  it('rejects empty and whitespace-only messages', () => {
    expect(validateOutgoingMessage('')).toMatch(/write something/i);
    expect(validateOutgoingMessage('    ')).toMatch(/write something/i);
  });

  it('rejects a message made only of zero-width characters', () => {
    expect(validateOutgoingMessage('\u200B\u200C')).toMatch(/no visible characters/i);
  });

  it('accepts an ordinary message', () => {
    expect(validateOutgoingMessage('Are you free on Saturday?')).toBeNull();
  });

  it('rejects a message beyond the length limit', () => {
    expect(validateOutgoingMessage('a'.repeat(MAX_MESSAGE_LENGTH + 1))).toMatch(/limited to/i);
  });
});

describe('attachment validation', () => {
  it('accepts a modest JPEG', () => {
    expect(validateAttachment('image/jpeg', 1024 * 512).ok).toBe(true);
  });

  it('rejects an unsupported type', () => {
    const result = validateAttachment('application/x-msdownload', 1024);
    expect(result.ok).toBe(false);
  });

  it('rejects an oversized file', () => {
    const result = validateAttachment('image/png', 9 * 1024 * 1024);
    expect(result.ok).toBe(false);
  });

  it('rejects an empty file', () => {
    const result = validateAttachment('image/png', 0);
    expect(result.ok).toBe(false);
  });
});

describe('community and event validation', () => {
  it('requires a meaningful community name', () => {
    expect(validateCommunityName('ab')).toMatch(/3 characters/i);
    expect(validateCommunityName('Northside Data Collective')).toBeNull();
  });

  it('refuses private addresses as event venues', () => {
    expect(validateEventVenue('My house, flat 3')).toMatch(/public venue/i);
    expect(validateEventVenue('Central Library, Meeting Room 2')).toBeNull();
  });

  it('requires a descriptive event title', () => {
    expect(validateEventTitle('Hi')).toMatch(/4 characters/i);
    expect(validateEventTitle('Beginner data workshop')).toBeNull();
  });
});

describe('field error collection', () => {
  it('reports only the fields that failed', () => {
    const result = validateFields([
      ['email', validateEmail('bad')],
      ['password', null],
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.field).toBe('email');
  });

  it('reports a valid result when nothing failed', () => {
    const result = validateFields([['email', validateEmail('member@example.com')]]);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

describe('bio limits', () => {
  it('keeps the documented bio ceiling', () => {
    expect(MAX_BIO_LENGTH).toBeGreaterThan(200);
  });
});
