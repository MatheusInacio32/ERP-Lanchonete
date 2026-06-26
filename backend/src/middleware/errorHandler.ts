import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { ApiResponse } from '../types';

// ── Erro customizado da aplicação ─────────────────────────────
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 400,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// ── Helper para resposta de sucesso ──────────────────────────
export function ok<T>(res: Response, data: T, message?: string): Response {
  const body: ApiResponse<T> = { success: true, data };
  if (message) body.message = message;
  return res.json(body);
}

// ── Helper para resposta de criação ──────────────────────────
export function created<T>(res: Response, data: T, message?: string): Response {
  const body: ApiResponse<T> = { success: true, data };
  if (message) body.message = message;
  return res.status(201).json(body);
}

// ── Middleware de erros global ────────────────────────────────
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    logger.warn(`AppError [${err.statusCode}]: ${err.message}`, {
      path: req.path,
      method: req.method,
      code: err.code,
    });
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
    });
    return;
  }

  // Erro de constraint do PostgreSQL
  const pgErr = err as any;
  if (pgErr.code === '23505') {
    const field = pgErr.detail?.match(/\((.+?)\)/)?.[1] ?? 'campo';
    logger.warn(`Conflito de unicidade: ${field}`, { detail: pgErr.detail });
    res.status(409).json({
      success: false,
      error: `Já existe um registro com este ${field}`,
      code: 'DUPLICATE_KEY',
    });
    return;
  }

  if (pgErr.code === '23503') {
    logger.warn('Violação de FK', { detail: pgErr.detail });
    res.status(400).json({
      success: false,
      error: 'Referência inválida — registro relacionado não encontrado',
      code: 'FOREIGN_KEY_VIOLATION',
    });
    return;
  }

  // Erro genérico
  logger.error(`Erro não tratado: ${err.message}`, {
    stack: err.stack,
    path: req.path,
    method: req.method,
  });
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'Erro interno do servidor'
      : err.message,
  });
}

// ── Not found ─────────────────────────────────────────────────
export function notFound(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: `Rota não encontrada: ${req.method} ${req.path}`,
  });
}
