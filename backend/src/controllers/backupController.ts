import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ok, AppError } from '../middleware/errorHandler';
import { BackupService } from '../services/backupService';

export const BackupController = {
  // ── Dump nativo (.backup) — download binário ────────────────
  async dumpBackup(_req: Request, res: Response, next: NextFunction) {
    try {
      const { file, nome, tamanho } = await BackupService.dump();
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${nome}"`);
      res.setHeader('Content-Length', String(tamanho));
      const stream = fs.createReadStream(file);
      stream.pipe(res);
      stream.on('end',   () => fs.unlink(file, () => {}));   // limpa temp após enviar
      stream.on('error', (err) => { fs.unlink(file, () => {}); next(err); });
    } catch (e) { next(e); }
  },

  // ── Restauração nativa (.backup) — upload binário ───────────
  async restoreBackup(req: Request, res: Response, next: NextFunction) {
    let tmp: string | null = null;
    try {
      const buf = req.body as Buffer;
      if (!Buffer.isBuffer(buf) || buf.length === 0) {
        throw new AppError('Arquivo de backup vazio ou inválido', 400);
      }
      // Validação básica: dumps custom do pg começam com a assinatura "PGDMP"
      if (buf.subarray(0, 5).toString('utf8') !== 'PGDMP') {
        throw new AppError('Arquivo não é um backup válido do PostgreSQL (.backup)', 400);
      }
      tmp = path.join(os.tmpdir(), `restore-${Date.now()}.backup`);
      fs.writeFileSync(tmp, buf);
      await BackupService.restore(tmp);
      ok(res, { restaurado: true, tamanho: buf.length }, 'Banco restaurado com sucesso');
    } catch (e) {
      next(e);
    } finally {
      if (tmp) fs.unlink(tmp, () => {});
    }
  },

  // ── TRUNCATE — zera o banco (Zona de Perigo) ────────────────
  async truncateDatabase(req: Request, res: Response, next: NextFunction) {
    try {
      if (req.body?.confirmacao !== 'CONFIRMAR') {
        throw new AppError('Confirmação inválida — envie { confirmacao: "CONFIRMAR" }', 400);
      }
      await BackupService.truncateAll();
      ok(res, { zerado: true }, 'Banco de dados zerado com sucesso');
    } catch (e) { next(e); }
  },
};
