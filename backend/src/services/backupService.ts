import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { pool } from '../config/database';
import { runMigrate } from '../config/migrate';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const execFileAsync = promisify(execFile);
const MAX_BUFFER = 1024 * 1024 * 64; // 64 MB de stdout/stderr

const DB = {
  host:     process.env.DB_HOST     ?? 'localhost',
  port:     process.env.DB_PORT     ?? '5432',
  name:     process.env.DB_NAME     ?? 'lanchonete',
  user:     process.env.DB_USER     ?? 'postgres',
  password: process.env.DB_PASSWORD ?? '',
};

// Resolve o caminho do binário (pg_dump/pg_restore) a partir de PG_BIN
function pgTool(tool: 'pg_dump' | 'pg_restore'): string {
  const bin = process.env.PG_BIN?.trim();
  const exe = process.platform === 'win32' ? `${tool}.exe` : tool;
  const full = bin ? path.join(bin, exe) : exe; // se PG_BIN vazio, assume que está no PATH
  if (bin && !fs.existsSync(full)) {
    throw new AppError(
      `${tool} não encontrado em "${full}". Confira a variável PG_BIN no arquivo .env`,
      500, 'PG_TOOL_NOT_FOUND'
    );
  }
  return full;
}

function pgEnv(): NodeJS.ProcessEnv {
  return { ...process.env, PGPASSWORD: DB.password };
}

// Timestamp legível para o nome do arquivo: 2026-06-22_21-45-03
function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

export const BackupService = {
  // ── DUMP NATIVO (.backup, formato custom do PostgreSQL) ──────
  // Equivale a: pg_dump -Fc -f arquivo.backup lanchonete
  async dump(): Promise<{ file: string; nome: string; tamanho: number }> {
    const tool = pgTool('pg_dump');
    const nome = `lanchonete_${stamp()}.backup`;
    const file = path.join(os.tmpdir(), nome);
    const args = [
      '-h', DB.host, '-p', DB.port, '-U', DB.user,
      '-Fc',                // formato custom (comprimido, restaurável com pg_restore)
      '--no-owner',         // portável entre instalações
      '-f', file,
      DB.name,
    ];

    logger.info('[Backup] 📦 Gerando dump nativo (.backup) via pg_dump...');
    await execFileAsync(tool, args, { env: pgEnv(), maxBuffer: MAX_BUFFER });

    if (!fs.existsSync(file)) {
      throw new AppError('pg_dump não gerou o arquivo de backup', 500);
    }
    const tamanho = fs.statSync(file).size;
    logger.info(`[Backup] ✅ Dump gerado: ${nome} (${(tamanho/1024).toFixed(1)} KB)`);
    return { file, nome, tamanho };
  },

  // ── RESTAURAÇÃO NATIVA (.backup) ─────────────────────────────
  // Equivale a: pg_restore --clean --if-exists -d lanchonete arquivo.backup
  async restore(file: string): Promise<void> {
    const tool = pgTool('pg_restore');
    const args = [
      '-h', DB.host, '-p', DB.port, '-U', DB.user,
      '-d', DB.name,
      '--clean', '--if-exists',  // dropa objetos existentes antes de recriar
      '--no-owner', '--no-privileges',
      file,
    ];

    logger.warn('[Backup] 🔄 Restaurando banco via pg_restore (--clean)...');
    try {
      await execFileAsync(tool, args, { env: pgEnv(), maxBuffer: MAX_BUFFER });
    } catch (e: any) {
      // pg_restore retorna exit code != 0 mesmo com avisos não-fatais.
      // Só tratamos como falha real se o stderr indicar erro fatal de conexão/arquivo.
      const msg = String(e.stderr ?? e.message ?? '');
      const fatal = /could not connect|no such file|input file does not appear|out of memory|FATAL/i.test(msg);
      if (fatal) {
        logger.error(`[Backup] ✗ Falha na restauração: ${msg.slice(0, 400)}`);
        throw new AppError(`Falha ao restaurar: ${msg.slice(0, 300)}`, 500, 'RESTORE_FAILED');
      }
      logger.warn(`[Backup] pg_restore concluído com avisos não-fatais (ignorados)`);
    }

    // Garante que o schema fique atualizado com as últimas colunas/enums,
    // caso o backup restaurado seja de uma versão anterior do sistema.
    await runMigrate();
    logger.info('[Backup] ✅ Restauração concluída e schema sincronizado');
  },

  // ── TRUNCATE — zera o banco começando do zero ────────────────
  async truncateAll(): Promise<void> {
    logger.warn('[Backup] ⚠️  TRUNCATE — apagando TODOS os dados do banco...');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `TRUNCATE
           movimentacoes_caixa, itens_pedido, pedidos,
           mesas, caixas, produtos, configuracoes, usuarios
         RESTART IDENTITY CASCADE`
      );
      // Reinsere a configuração padrão (o app espera sempre 1 linha)
      await client.query(
        `INSERT INTO configuracoes (nome_estabelecimento, total_mesas)
         VALUES ('Minha Lanchonete', 10)`
      );
      await client.query('COMMIT');
      logger.info('[Backup] ✅ Banco zerado — começando do zero (config padrão restaurada)');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },
};
