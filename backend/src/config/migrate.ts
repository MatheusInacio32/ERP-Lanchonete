import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

function criarPool() {
  return new Pool({
    host:     process.env.DB_HOST     ?? 'localhost',
    port:     parseInt(process.env.DB_PORT ?? '5432'),
    database: process.env.DB_NAME     ?? 'lanchonete',
    user:     process.env.DB_USER     ?? 'postgres',
    password: process.env.DB_PASSWORD ?? '',
    ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
}

// Executadas em chamadas separadas antes de migration.sql
// ALTER TYPE ADD VALUE não pode estar dentro de transação em PG < 12
const ENUM_ADDITIONS = [
  `ALTER TYPE forma_pagamento ADD VALUE IF NOT EXISTS 'debito'`,
  `ALTER TYPE forma_pagamento ADD VALUE IF NOT EXISTS 'credito'`,
  `ALTER TYPE forma_pagamento ADD VALUE IF NOT EXISTS 'voucher'`,
];

// Colunas novas em tabelas existentes — aplicadas após migration.sql
const COLUMN_MIGRATIONS = `
  ALTER TABLE pedidos       ADD COLUMN IF NOT EXISTS mesa_numero   INTEGER;
  ALTER TABLE pedidos       ADD COLUMN IF NOT EXISTS cancelado_por VARCHAR(100);
  ALTER TABLE pedidos       ADD COLUMN IF NOT EXISTS desconto      NUMERIC(10,2) NOT NULL DEFAULT 0;
  ALTER TABLE pedidos       ADD COLUMN IF NOT EXISTS acrescimo     NUMERIC(10,2) NOT NULL DEFAULT 0;
  ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS cor_tema      VARCHAR(20) NOT NULL DEFAULT 'azul';
`;

export async function runMigrate(): Promise<void> {
  const migPool = criarPool();
  const client  = await migPool.connect();
  try {
    // 1. Novos valores de enum (separados — ALTER TYPE ADD VALUE não pode estar em transação)
    for (const sql of ENUM_ADDITIONS) {
      try { await client.query(sql); } catch { /* já existe */ }
    }

    // 2. Schema principal (IF NOT EXISTS — seguro para dados existentes)
    const sqlPath = path.resolve(__dirname, 'migration.sql');
    const sql     = fs.readFileSync(sqlPath, 'utf-8');
    console.log('\x1b[33m[MIGRATE]\x1b[0m Aplicando schema...');
    await client.query(sql);

    // 3. Colunas adicionadas após versão inicial
    console.log('\x1b[33m[MIGRATE]\x1b[0m Aplicando migrações de colunas...');
    await client.query(COLUMN_MIGRATIONS);

    console.log('\x1b[32m[MIGRATE] ✅ Schema pronto — dados preservados!\x1b[0m\n');
  } finally {
    client.release();
    await migPool.end();
  }
}

// Execução direta: npm run db:migrate
if (require.main === module) {
  runMigrate().catch((err) => {
    console.error('\x1b[31m[MIGRATE] ✗ Erro:\x1b[0m', err.message);
    process.exit(1);
  });
}
