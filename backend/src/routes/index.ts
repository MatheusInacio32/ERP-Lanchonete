// v1.2 — backup nativo (.backup via pg_dump/pg_restore) + truncate
import { Router, raw } from 'express';
import {
  ProdutoController, MesaController, PedidoController,
  CaixaController, ConfiguracaoController,
} from '../controllers';
import { BackupController }    from '../controllers/backupController';
import { RelatorioController } from '../controllers/relatorioController';

const router = Router();

// ── Health ────────────────────────────────────────────────────
router.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'online', timestamp: new Date().toISOString(), version: '1.0.0' } });
});

// ── Dashboard ─────────────────────────────────────────────────
router.get('/dashboard', CaixaController.getDashboard);

// ── Configurações ─────────────────────────────────────────────
router.get  ('/configuracoes', ConfiguracaoController.get);
router.patch('/configuracoes', ConfiguracaoController.atualizar);

// ── Produtos ──────────────────────────────────────────────────
router.get   ('/produtos',                ProdutoController.listar);
router.get   ('/produtos/codigo/:codigo', ProdutoController.buscarPorCodigo);
router.post  ('/produtos',                ProdutoController.criar);
router.patch ('/produtos/:id',            ProdutoController.atualizar);
router.patch ('/produtos/:id/inativar',   ProdutoController.inativar);
router.patch ('/produtos/:id/reativar',   ProdutoController.reativar);
router.delete('/produtos/:id',            ProdutoController.excluir);

// ── Mesas ─────────────────────────────────────────────────────
router.get   ('/mesas',           MesaController.listar);
router.post  ('/mesas/:id/abrir', MesaController.abrir);
router.delete('/mesas/:id/abrir', MesaController.cancelar);

// ── Pedidos ───────────────────────────────────────────────────
router.get   ('/mesas/:mesaId/pedido',          PedidoController.buscarPorMesa);
router.post  ('/mesas/:mesaId/fechar',          PedidoController.fecharConta);
router.post  ('/pedidos/:id/itens',             PedidoController.adicionarItem);
router.patch ('/pedidos/:id/itens/:itemId',     PedidoController.atualizarItem);
router.delete('/pedidos/:id/itens/:itemId',     PedidoController.removerItem);
router.patch ('/pedidos/:id/itens/:itemId/obs', PedidoController.atualizarObservacao);
router.get   ('/pedidos',                       PedidoController.listarPorData);
router.get   ('/pedidos/:id',                   PedidoController.buscarPorId);

// ── Caixa ─────────────────────────────────────────────────────
router.get ('/caixa',            CaixaController.getAtual);
router.post('/caixa/abrir',      CaixaController.abrir);
router.post('/caixa/fechar',     CaixaController.fechar);
router.get ('/caixa/resumo/:id', CaixaController.getResumo);
router.get ('/caixa/historico',  CaixaController.getHistorico);
router.get ('/caixa/data',       CaixaController.listarPorData);

// ── Backup NATIVO (.backup via pg_dump / pg_restore) ──────────
router.get ('/backup/dump',      BackupController.dumpBackup);
router.post('/backup/restore',
  raw({ type: () => true, limit: '256mb' }),  // corpo binário cru
  BackupController.restoreBackup);

// ── Admin: zerar banco (Zona de Perigo) ───────────────────────
router.post('/admin/truncate',   BackupController.truncateDatabase);

// ── Relatórios ────────────────────────────────────────────────
router.get('/relatorio/caixa/:id',  RelatorioController.relatorioCaixa);
router.get('/relatorio/periodo',    RelatorioController.relatorioPeriodo);
router.get('/relatorio/mesas',      RelatorioController.relatorioPorMesa);
router.get('/relatorio/historico',  RelatorioController.historicoCompleto);
router.get('/relatorio/producao',   RelatorioController.auditoriaProducao);

export default router;
