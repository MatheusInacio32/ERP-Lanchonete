import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

// ── Cores por nível ───────────────────────────────────────────
const LEVEL_COLORS: Record<string, string> = {
  error: '\x1b[31m',   // Vermelho
  warn:  '\x1b[33m',   // Amarelo
  info:  '\x1b[36m',   // Ciano
  http:  '\x1b[35m',   // Magenta
  debug: '\x1b[32m',   // Verde
};
const RESET = '\x1b[0m';
const BOLD  = '\x1b[1m';
const DIM   = '\x1b[2m';

// ── Formato para o terminal (CMD/PowerShell) ──────────────────
const consoleFormat = winston.format.printf(({ level, message, timestamp, ...meta }) => {
  const color = LEVEL_COLORS[level] ?? '';
  const ts    = `${DIM}${timestamp}${RESET}`;
  const lvl   = `${color}${BOLD}[${level.toUpperCase().padEnd(5)}]${RESET}`;
  const msg   = `${color}${message}${RESET}`;
  const extra = Object.keys(meta).length
    ? `\n  ${DIM}${JSON.stringify(meta, null, 2)}${RESET}`
    : '';
  return `${ts} ${lvl} ${msg}${extra}`;
});

// ── Formato para arquivo (JSON limpo) ────────────────────────
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// ── Transports ────────────────────────────────────────────────
const transports: winston.transport[] = [
  // Console colorido
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp({ format: 'HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      consoleFormat
    ),
  }),

  // Arquivo diário — todos os logs
  new DailyRotateFile({
    filename: path.join('logs', 'app-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxFiles: '14d',
    maxSize: '20m',
    format: fileFormat,
  }),

  // Arquivo separado só de erros
  new DailyRotateFile({
    filename: path.join('logs', 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxFiles: '30d',
    format: fileFormat,
  }),
];

// ── Instância do logger ───────────────────────────────────────
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? 'debug',
  transports,
  exceptionHandlers: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        consoleFormat
      ),
    }),
    new DailyRotateFile({
      filename: path.join('logs', 'exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      format: fileFormat,
    }),
  ],
  rejectionHandlers: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        consoleFormat
      ),
    }),
  ],
});

// ── Helpers de log estruturado ────────────────────────────────
export const logHttp = (method: string, url: string, status: number, ms: number) => {
  const color = status >= 500 ? '\x1b[31m' : status >= 400 ? '\x1b[33m' : '\x1b[32m';
  const statusStr = `${color}${status}${RESET}`;
  logger.http(`${method.padEnd(6)} ${url.padEnd(40)} ${statusStr} ${DIM}${ms}ms${RESET}`);
};
