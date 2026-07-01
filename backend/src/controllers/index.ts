import { Request, Response, NextFunction } from 'express';
import { ok, created, AppError } from '../middleware/errorHandler';
import { ProdutoService  } from '../services/produtoService';
import { MesaService     } from '../services/mesaService';
import { PedidoService   } from '../services/pedidoService';
import { CaixaService    } from '../services/caixaService';
import { ImpressaoService } from '../services/impressaoService';
import { query           } from '../config/database';
import { Configuracao    } from '../types';

// Data local (evita bug UTC — PostgreSQL armazena timestamps sem timezone)
function localDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ── PRODUTOS ──────────────────────────────────────────────────
export const ProdutoController = {
  async listar(req: Request, res: Response, next: NextFunction) {
    try {
      const apenasAtivos = req.query.ativos === 'true';
      // Batch: foi_usado em 1 query (evita N+1)
      const enriched = await ProdutoService.listarComFoiUsado(apenasAtivos);
      ok(res, enriched);
    } catch (e) { next(e); }
  },

  async buscarPorCodigo(req: Request, res: Response, next: NextFunction) {
    try {
      const produto = await ProdutoService.buscarPorCodigo(req.params.codigo);
      if (!produto) throw new AppError('Produto não encontrado', 404);
      ok(res, produto);
    } catch (e) { next(e); }
  },

  async criar(req: Request, res: Response, next: NextFunction) {
    try {
      const produto = await ProdutoService.criar(req.body);
      created(res, produto, 'Produto criado com sucesso');
    } catch (e) { next(e); }
  },

  async atualizar(req: Request, res: Response, next: NextFunction) {
    try {
      const produto = await ProdutoService.atualizar(req.params.id, req.body);
      ok(res, produto, 'Produto atualizado');
    } catch (e) { next(e); }
  },

  async inativar(req: Request, res: Response, next: NextFunction) {
    try {
      const produto = await ProdutoService.inativar(req.params.id);
      ok(res, produto, 'Produto inativado');
    } catch (e) { next(e); }
  },

  async reativar(req: Request, res: Response, next: NextFunction) {
    try {
      const produto = await ProdutoService.reativar(req.params.id);
      ok(res, produto, 'Produto reativado');
    } catch (e) { next(e); }
  },

  async excluir(req: Request, res: Response, next: NextFunction) {
    try {
      await ProdutoService.excluir(req.params.id);
      ok(res, null, 'Produto excluído');
    } catch (e) { next(e); }
  },
};

// ── MESAS ─────────────────────────────────────────────────────
export const MesaController = {
  async listar(_req: Request, res: Response, next: NextFunction) {
    try {
      const mesas = await MesaService.listar();
      ok(res, mesas);
    } catch (e) { next(e); }
  },

  async abrir(req: Request, res: Response, next: NextFunction) {
    try {
      const caixa = await CaixaService.getAtual();
      if (!caixa) throw new AppError('Caixa fechado — abra o caixa antes de abrir mesas', 403);
      const pedido = await MesaService.abrir(req.params.id, caixa.id);
      created(res, pedido, 'Mesa aberta');
    } catch (e) { next(e); }
  },

  async cancelar(req: Request, res: Response, next: NextFunction) {
    try {
      await MesaService.cancelar(req.params.id);
      ok(res, null, 'Mesa liberada');
    } catch (e) { next(e); }
  },
};

// ── PEDIDOS ───────────────────────────────────────────────────
export const PedidoController = {
  async buscarPorMesa(req: Request, res: Response, next: NextFunction) {
    try {
      const pedido = await PedidoService.buscarPorMesa(req.params.mesaId);
      if (!pedido) throw new AppError('Nenhum pedido aberto para esta mesa', 404);
      ok(res, pedido);
    } catch (e) { next(e); }
  },

  async adicionarItem(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await PedidoService.adicionarItem(req.params.id, req.body);
      created(res, item, 'Item adicionado');
    } catch (e) { next(e); }
  },

  async atualizarItem(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await PedidoService.atualizarItem(
        req.params.id, req.params.itemId, req.body
      );
      ok(res, item, 'Item atualizado');
    } catch (e) { next(e); }
  },

  async removerItem(req: Request, res: Response, next: NextFunction) {
    try {
      await PedidoService.removerItem(req.params.id, req.params.itemId);
      ok(res, null, 'Item removido');
    } catch (e) { next(e); }
  },

  async atualizarObservacao(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await PedidoService.atualizarObservacaoItem(
        req.params.id, req.params.itemId, req.body.observacao ?? ''
      );
      ok(res, item);
    } catch (e) { next(e); }
  },

  async fecharConta(req: Request, res: Response, next: NextFunction) {
    try {
      const mesa = await MesaService.buscarPorId(req.params.mesaId);
      if (!mesa.pedido_atual_id) throw new AppError('Mesa sem pedido ativo', 404);
      const pedido = await PedidoService.fecharConta(
        mesa.pedido_atual_id, req.params.mesaId, req.body
      );
      ok(res, pedido, 'Conta fechada');
    } catch (e) { next(e); }
  },

  async buscarPorId(req: Request, res: Response, next: NextFunction) {
    try {
      const pedido = await PedidoService.buscarComItens(req.params.id);
      ok(res, pedido);
    } catch (e) { next(e); }
  },

  async listarPorData(req: Request, res: Response, next: NextFunction) {
    try {
      const data = (req.query.data as string) || localDate();
      const pedidos = await PedidoService.listarPorData(data);
      ok(res, pedidos);
    } catch (e) { next(e); }
  },
};

// ── CAIXA ─────────────────────────────────────────────────────
export const CaixaController = {
  async getAtual(_req: Request, res: Response, next: NextFunction) {
    try {
      const caixa = await CaixaService.getAtual();
      ok(res, caixa);
    } catch (e) { next(e); }
  },

  async getResumo(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id === 'atual'
        ? (await CaixaService.getAtual())?.id
        : req.params.id;
      if (!id) throw new AppError('Nenhum caixa aberto', 404);
      const resumo = await CaixaService.getResumo(id);
      ok(res, resumo);
    } catch (e) { next(e); }
  },

  async abrir(req: Request, res: Response, next: NextFunction) {
    try {
      const caixa = await CaixaService.abrir(req.body);
      created(res, caixa, 'Caixa aberto');
    } catch (e) { next(e); }
  },

  async fechar(req: Request, res: Response, next: NextFunction) {
    try {
      const resumo = await CaixaService.fechar(req.body);
      ok(res, resumo, 'Caixa fechado');
    } catch (e) { next(e); }
  },

  // Sangria / Suprimento
  async registrarMovimentacao(req: Request, res: Response, next: NextFunction) {
    try {
      const { tipo, valor, descricao, operador } = req.body;
      const mov = await CaixaService.registrarMovimentacao(tipo, Number(valor), descricao, operador);
      created(res, mov, tipo === 'sangria' ? 'Sangria registrada' : 'Suprimento registrado');
    } catch (e) { next(e); }
  },

  // Extrato do caixa (movimentações em ordem cronológica)
  async getExtrato(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id === 'atual'
        ? (await CaixaService.getAtual())?.id
        : req.params.id;
      if (!id) throw new AppError('Nenhum caixa aberto', 404);
      const extrato = await CaixaService.getExtrato(id);
      ok(res, extrato);
    } catch (e) { next(e); }
  },

  async listarPorData(req: Request, res: Response, next: NextFunction) {
    try {
      const data = (req.query.data as string) || localDate();
      const caixas = await CaixaService.listarPorData(data);
      ok(res, caixas);
    } catch (e) { next(e); }
  },

  async getHistorico(req: Request, res: Response, next: NextFunction) {
    try {
      const limite = parseInt(req.query.limite as string) || 30;
      const historico = await CaixaService.getHistorico(limite);
      ok(res, historico);
    } catch (e) { next(e); }
  },

  async getDashboard(_req: Request, res: Response, next: NextFunction) {
    try {
      const dash = await CaixaService.getDashboard();
      ok(res, dash);
    } catch (e) { next(e); }
  },
};

// ── CONFIGURAÇÕES ─────────────────────────────────────────────
export const ConfiguracaoController = {
  async get(_req: Request, res: Response, next: NextFunction) {
    try {
      const { rows } = await query<Configuracao>('SELECT * FROM configuracoes LIMIT 1');
      ok(res, rows[0]);
    } catch (e) { next(e); }
  },

  async atualizar(req: Request, res: Response, next: NextFunction) {
    try {
      const campos: string[] = [];
      const valores: any[] = [];
      let i = 1;
      const { nome_estabelecimento, total_mesas, telefone, endereco, cor_tema } = req.body;

      if (nome_estabelecimento !== undefined) { campos.push(`nome_estabelecimento=$${i++}`); valores.push(nome_estabelecimento); }
      if (total_mesas          !== undefined) { campos.push(`total_mesas=$${i++}`);          valores.push(total_mesas); }
      if (telefone             !== undefined) { campos.push(`telefone=$${i++}`);             valores.push(telefone); }
      if (endereco             !== undefined) { campos.push(`endereco=$${i++}`);             valores.push(endereco); }
      if (cor_tema             !== undefined) { campos.push(`cor_tema=$${i++}`);             valores.push(cor_tema); }

      if (campos.length === 0) throw new AppError('Nenhum campo para atualizar');

      campos.push(`atualizado_em=NOW()`);
      const { rows } = await query<Configuracao>(
        `UPDATE configuracoes SET ${campos.join(', ')} WHERE id=1 RETURNING *`,
        valores
      );

      // Sincroniza mesas se necessário
      if (total_mesas) {
        await MesaService.sincronizarQuantidade(total_mesas);
      }

      ok(res, rows[0], 'Configurações atualizadas');
    } catch (e) { next(e); }
  },
};

// ── IMPRESSÃO (silenciosa, sem Ctrl+P) ────────────────────────
export const ImpressaoController = {
  // GET /impressao/impressoras — lista as impressoras desta máquina
  async listar(_req: Request, res: Response, next: NextFunction) {
    try {
      ok(res, await ImpressaoService.listar());
    } catch (e) { next(e); }
  },

  // POST /impressao/imprimir?impressora=NOME — corpo = PDF binário cru
  async imprimir(req: Request, res: Response, next: NextFunction) {
    try {
      const impressora = String(req.query.impressora ?? '').trim();
      if (!impressora) throw new AppError('Informe a impressora (?impressora=)', 400);
      const buffer = req.body as Buffer;
      if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        throw new AppError('PDF vazio ou inválido', 400);
      }
      await ImpressaoService.imprimirPdf(buffer, impressora);
      ok(res, { impresso: true, impressora, bytes: buffer.length }, 'Enviado para impressão');
    } catch (e) { next(e); }
  },
};
