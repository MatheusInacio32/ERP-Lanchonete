import { Request, Response, NextFunction } from 'express';
import { ok } from '../middleware/errorHandler';
import { RelatorioService } from '../services/relatorioService';

export const RelatorioController = {
  // GET /relatorio/caixa/:id
  async relatorioCaixa(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await RelatorioService.relatorioCaixa(req.params.id);
      ok(res, data);
    } catch (e) { next(e); }
  },

  // GET /relatorio/periodo?inicio=YYYY-MM-DD&fim=YYYY-MM-DD
  async relatorioPeriodo(req: Request, res: Response, next: NextFunction) {
    try {
      const inicio = String(req.query.inicio ?? '');
      const fim    = String(req.query.fim    ?? '');
      if (!inicio || !fim) {
        res.status(400).json({ success: false, error: 'Parâmetros inicio e fim são obrigatórios' });
        return;
      }
      const data = await RelatorioService.relatorioPeriodo(inicio, fim);
      ok(res, data);
    } catch (e) { next(e); }
  },

  // GET /relatorio/mesas?data=YYYY-MM-DD
  async relatorioPorMesa(req: Request, res: Response, next: NextFunction) {
    try {
      const data = String(req.query.data ?? new Date().toISOString().slice(0, 10));
      const rows = await RelatorioService.relatorioPorMesa(data);
      ok(res, rows);
    } catch (e) { next(e); }
  },

  // GET /relatorio/producao?inicio=YYYY-MM-DD&fim=YYYY-MM-DD
  async auditoriaProducao(req: Request, res: Response, next: NextFunction) {
    try {
      const inicio = String(req.query.inicio ?? '');
      const fim    = String(req.query.fim    ?? '');
      if (!inicio || !fim) {
        res.status(400).json({ success: false, error: 'Parâmetros inicio e fim são obrigatórios' });
        return;
      }
      const data = await RelatorioService.auditoriaProducao(inicio, fim);
      ok(res, data);
    } catch (e) { next(e); }
  },

  // GET /relatorio/historico?inicio=YYYY-MM-DD&fim=YYYY-MM-DD
  async historicoCompleto(req: Request, res: Response, next: NextFunction) {
    try {
      const inicio = String(req.query.inicio ?? '');
      const fim    = String(req.query.fim    ?? '');
      if (!inicio || !fim) {
        res.status(400).json({ success: false, error: 'Parâmetros inicio e fim são obrigatórios' });
        return;
      }
      const data = await RelatorioService.historicoCompleto(inicio, fim);
      ok(res, data);
    } catch (e) { next(e); }
  },
};
