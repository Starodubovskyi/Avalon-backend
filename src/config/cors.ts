import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

type Env = Record<string, string | undefined>;

/** Always allowed when NODE_ENV is development (or unset): local frontends. */
const LOCAL_DEV_ORIGINS = ['http://localhost:3000', 'http://localhost:3001'];

/** Scheme + host (+ port) of a URL, or null when it is not a valid origin. */
export function normalizeOrigin(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

/**
 * Allowlist = CORS_ORIGINS (comma-separated) + FRONTEND_DOMAIN (+ localhost
 * in development). An entry may use `*` for one DNS-label fragment, e.g.
 * https://avalon-frontend-*.vercel.app for preview deployments.
 */
export function resolveCorsOrigins(env: Env): string[] {
  const entries = [
    ...(env.CORS_ORIGINS ?? '').split(','),
    env.FRONTEND_DOMAIN ?? '',
  ];
  const development = !env.NODE_ENV || env.NODE_ENV === 'development';
  if (development) {
    entries.push(...LOCAL_DEV_ORIGINS);
  }
  const origins = entries
    .map((entry) =>
      entry.includes('*')
        ? entry.trim().replace(/\/+$/, '').toLowerCase()
        : normalizeOrigin(entry),
    )
    .filter((entry): entry is string => Boolean(entry));
  return [...new Set(origins)];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
}

export function isOriginAllowed(
  origin: string | undefined,
  allowlist: readonly string[],
): boolean {
  // Requests without Origin (curl, server-to-server, same-origin GET) carry
  // no browser credentials worth protecting: auth is a Bearer token.
  if (!origin) {
    return true;
  }
  const normalized = normalizeOrigin(origin);
  if (!normalized) {
    return false;
  }
  return allowlist.some((allowed) => {
    if (!allowed.includes('*')) {
      return allowed === normalized;
    }
    const pattern = escapeRegExp(allowed).replace(/\*/g, '[a-z0-9-]+');
    return new RegExp(`^${pattern}$`).test(normalized);
  });
}

export function buildCorsOptions(env: Env): CorsOptions {
  const allowlist = resolveCorsOrigins(env);
  return {
    origin: (origin, callback) => {
      callback(null, isOriginAllowed(origin, allowlist));
    },
    // Bearer tokens only: no cookies, so no credentialed CORS.
    credentials: false,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    // lets the SPA read the download file name
    exposedHeaders: ['Content-Disposition'],
    maxAge: 600,
  };
}
