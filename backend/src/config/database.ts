import { Pool, PoolClient, QueryResult } from 'pg';
import { logger } from '../utils/logger';

// ── Pool de conexões ──────────────────────────────────────────
export const pool = new Pool({
  host:     process.env.DB_HOST     ?? 'localhost',
  port:     parseInt(process.env.DB_PORT ?? '5432'),
  database: process.env.DB_NAME     ?? 'lanchonete',
  user:     process.env.DB_USER     ?? 'postgres',
  password: process.env.DB_PASSWORD ?? '',
  ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max:             20,   // máximo de conexões no pool
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

// ── Log de eventos do pool ────────────────────────────────────
pool.on('connect', () => {
  logger.debug('PostgreSQL: nova conexão adicionada ao pool');
});

pool.on('error', (err) => {
  logger.error('Erro inesperado no pool do PostgreSQL', { error: err.message });
});

// ── Testar conexão na inicialização ──────────────────────────
export async function testConnection(): Promise<void> {
  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    const res = await client.query<{ now: string }>('SELECT NOW() AS now');
    logger.info(`PostgreSQL conectado — servidor: ${res.rows[0].now}`);
  } catch (err: any) {
    logger.error('Falha ao conectar ao PostgreSQL', { error: err.message });
    throw err;
  } finally {
    client?.release();
  }
}

// ── Wrapper com log automático ────────────────────────────────
export async function query<T extends Record<string, any> = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    const result = await pool.query<T>(text, params);
    const ms = Date.now() - start;
    logger.debug(`Query executada`, {
      sql: text.replace(/\s+/g, ' ').trim().slice(0, 120),
      rows: result.rowCount,
      ms,
    });
    return result;
  } catch (err: any) {
    logger.error('Erro na query', {
      sql: text.replace(/\s+/g, ' ').trim().slice(0, 120),
      params,
      error: err.message,
    });
    throw err;
  }
}

// ── Transação helper ──────────────────────────────────────────
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
