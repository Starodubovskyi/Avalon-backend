import { escapeLikePattern } from './escape-like';

describe('escapeLikePattern', () => {
  it('should escape LIKE wildcards and the escape character', () => {
    expect(escapeLikePattern('50%_off')).toBe('50\\%\\_off');
    expect(escapeLikePattern('a\\b')).toBe('a\\\\b');
    expect(escapeLikePattern('MV STAR')).toBe('MV STAR');
  });
});
