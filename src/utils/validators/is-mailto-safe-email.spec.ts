import { isMailtoSafeEmail } from './is-mailto-safe-email';

describe('isMailtoSafeEmail', () => {
  it('should accept ordinary addresses', () => {
    for (const email of [
      'ops@example.com',
      'first.last+tag@sub.example.co.uk',
      "o'brien@example.com",
    ]) {
      expect(isMailtoSafeEmail(email)).toBe(true);
    }
  });

  it('should reject ? & % # / \\ and whitespace, even where RFC 5322 allows them', () => {
    for (const email of [
      'ops?cc=x%40evil.com@example.com',
      'ops?subject=hi@example.com',
      'ops&bcc=x@example.com',
      'ops%0Abcc@example.com',
      'ops#x@example.com',
      'ops/x@example.com',
      'ops\\x@example.com',
      '"ops x"@example.com',
      'ops\tx@example.com',
      'ops@example.com\n',
    ]) {
      expect(isMailtoSafeEmail(email)).toBe(false);
    }
  });

  it('should reject non-emails and non-strings', () => {
    for (const value of ['', 'not-an-email', 'ops@', null, undefined, 42]) {
      expect(isMailtoSafeEmail(value)).toBe(false);
    }
  });
});
