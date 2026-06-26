import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';

import { logger } from './utils/logger';
import { pool, testConnection } from './config/database';
import { httpLogger } from './middleware/httpLogger';
import { errorHandler, notFound } from './middleware/errorHandler';
import { runMigrate } from './config/migrate';
import routes from './routes';

// ── Banner ────────────────────────────────────────────────────
function printBanner() {
  const C = '\x1b[36m'; const B = '\x1b[1m'; const R = '\x1b[0m'; const Y = '\x1b[33m';
  console.log(`
${C}${B}╔══════════════════════════════════════════╗
║    🍔  LANCHONETE — API BACKEND          ║
║    Node.js + TypeScript + PostgreSQL     ║
╚══════════════════════════════════════════╝${R}
  ${Y}Ambiente:${R}  ${process.env.NODE_ENV ?? 'development'}
  ${Y}Porta:${R}     ${process.env.PORT ?? 3001}
  ${Y}Banco:${R}     ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}
`);
}

async function bootstrap() {
  printBanner();

  // 1. Drop + recreate automático
  await runMigrate();

  // 2. Conectar pool principal
  logger.info('Conectando ao PostgreSQL...');
  await testConnection();

  // 3. Express
  const app = express();
  app.use(helmet());
  // Libera o frontend rodando em localhost OU em IPs da rede local (celular, tablet…)
  // Aceita qualquer porta para tolerar o Vite trocar de porta (5173, 5174…).
  const ORIGEM_REDE_LOCAL =
    /^http:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;
  app.use(cors({
    origin: (origin, callback) => {
      // sem origin = apps nativos/curl/health-check → permitido
      if (!origin || ORIGEM_REDE_LOCAL.test(origin) || origin === process.env.CORS_ORIGIN) {
        return callback(null, true);
      }
      callback(new Error(`Origin não permitida: ${origin}`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    // Expõe o nome do arquivo de backup (.backup) ao JavaScript do navegador
    exposedHeaders: ['Content-Disposition'],
  }));
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(httpLogger);
  app.use('/api', routes);
  app.use(notFound);
  app.use(errorHandler);

  const PORT = parseInt(process.env.PORT ?? '3001');
  const server = app.listen(PORT, () => {
    logger.info(`Servidor iniciado em http://localhost:${PORT}/api`);
    logger.info(`Health check: http://localhost:${PORT}/api/health`);
    logger.info('👉 Acesse Config → Importar Backup para restaurar seus dados');
  });

  const shutdown = (sig: string) => {
    logger.warn(`${sig} recebido — encerrando...`);
    server.close(() => { logger.info('Servidor encerrado'); process.exit(0); });
    setTimeout(() => process.exit(1), 10_000);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('\x1b[31mErro crítico:\x1b[0m', err.message);
  process.exit(1);
});
