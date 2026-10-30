import databaseConfig, {
  resolveDatabaseType,
  resolveMaxConnections,
} from './database.config';
import { DatabaseConfig } from './database-config.type';

describe('database config', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should accept DATABASE_URL alone and default the type to postgres', () => {
    process.env = {
      DATABASE_URL: 'postgresql://user:pass@db.example/neondb?sslmode=require',
    };
    const config = databaseConfig() as DatabaseConfig;
    expect(config.type).toBe('postgres');
    expect(config.url).toBe(process.env.DATABASE_URL);
    expect(config.isDocumentDatabase).toBe(false);
  });

  it('should still require host settings without DATABASE_URL', () => {
    process.env = {};
    expect(() => databaseConfig()).toThrow();
  });

  it('should keep an explicit DATABASE_TYPE', () => {
    expect(resolveDatabaseType({ DATABASE_TYPE: 'postgres' })).toBe('postgres');
    expect(resolveDatabaseType({})).toBeUndefined();
  });

  it('should use a small pool on Vercel unless configured', () => {
    expect(resolveMaxConnections({})).toBe(100);
    expect(resolveMaxConnections({ VERCEL: '1' })).toBe(5);
    expect(
      resolveMaxConnections({ VERCEL: '1', DATABASE_MAX_CONNECTIONS: '10' }),
    ).toBe(10);
    expect(resolveMaxConnections({ DATABASE_MAX_CONNECTIONS: 'abc' })).toBe(
      100,
    );
  });
});
