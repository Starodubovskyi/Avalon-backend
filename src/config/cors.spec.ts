import { isOriginAllowed, resolveCorsOrigins } from './cors';

describe('cors', () => {
  it('should build the allowlist from CORS_ORIGINS and FRONTEND_DOMAIN', () => {
    expect(
      resolveCorsOrigins({
        NODE_ENV: 'production',
        CORS_ORIGINS:
          ' https://app.avalon.example/ ,https://ops.avalon.example,not a url',
        FRONTEND_DOMAIN: 'https://app.avalon.example',
      }),
    ).toEqual(['https://app.avalon.example', 'https://ops.avalon.example']);
  });

  it('should add localhost frontends only in development', () => {
    expect(resolveCorsOrigins({ NODE_ENV: 'development' })).toEqual([
      'http://localhost:3000',
      'http://localhost:3001',
    ]);
    expect(resolveCorsOrigins({ NODE_ENV: 'production' })).toEqual([]);
  });

  it('should allow listed origins and requests without Origin only', () => {
    const allowlist = resolveCorsOrigins({ NODE_ENV: 'development' });
    expect(isOriginAllowed(undefined, allowlist)).toBe(true);
    expect(isOriginAllowed('http://localhost:3001', allowlist)).toBe(true);
    expect(isOriginAllowed('https://evil.example', allowlist)).toBe(false);
    expect(
      isOriginAllowed('http://localhost:3001.evil.example', allowlist),
    ).toBe(false);
    expect(isOriginAllowed('null', allowlist)).toBe(false);
  });

  it('should support a wildcard for one label fragment (preview deployments)', () => {
    const allowlist = resolveCorsOrigins({
      NODE_ENV: 'production',
      CORS_ORIGINS: 'https://avalon-frontend-*.vercel.app',
    });
    expect(
      isOriginAllowed(
        'https://avalon-frontend-git-main-team.vercel.app',
        allowlist,
      ),
    ).toBe(true);
    expect(
      isOriginAllowed('https://avalon-frontend-x.evil.app', allowlist),
    ).toBe(false);
    expect(
      isOriginAllowed('https://avalon-frontend-a.b.vercel.app', allowlist),
    ).toBe(false);
  });
});
