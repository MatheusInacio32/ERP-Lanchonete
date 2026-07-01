import { query, withTransaction } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import type { Pedido, ItemPedido, AdicionarItemDTO, AtualizarItemDTO, FecharContaDTO } from '../types';
import { ProdutoService } from './produtoService';

export const PedidoService = {
  async buscarComItens(pedidoId: string): Promise<Pedido & { itens: ItemPedido[] }> {
    const { rows: [pedido] } = await query<Pedido>(
      `SELECT p.*, COALESCE(p.mesa_numero, m.numero) AS mesa_numero
       FROM pedidos p LEFT JOIN mesas m ON m.id = p.mesa_id
       WHERE p.id = $1`, [pedidoId]
    );
    if (!pedido) throw new AppError('Pedido não encontrado', 404);
    const { rows: itens } = await query<ItemPedido>(
      'SELECT * FROM itens_pedido WHERE pedido_id=$1 ORDER BY criado_em', [pedidoId]
    );
    return { ...pedido, itens };
  },

  async buscarPorMesa(mesaId: string): Promise<Pedido & { itens: ItemPedido[] }> {
    const { rows: [pedido] } = await query<Pedido>(
      `SELECT * FROM pedidos WHERE mesa_id=$1 AND status='aberto' LIMIT 1`, [mesaId]
    );
    if (!pedido) throw new AppError('Nenhum pedido aberto para esta mesa', 404);
    const { rows: itens } = await query<ItemPedido>(
      'SELECT * FROM itens_pedido WHERE pedido_id=$1 ORDER BY criado_em', [pedido.id]
    );
    logger.debug(`[Pedido] Carregado pedido ${pedido.id} com ${itens.length} itens`);
    return { ...pedido, itens };
  },

  async listarPorData(data: string): Promise<(Pedido & { itens: ItemPedido[] })[]> {
    const { rows: pedidos } = await query<Pedido>(
      `SELECT p.*,
              COALESCE(p.mesa_numero, m.numero) AS mesa_numero
       FROM pedidos p
       LEFT JOIN mesas m ON m.id = p.mesa_id
       WHERE DATE(p.criado_em) = $1
         AND p.status IN ('fechado','cancelado')
       ORDER BY p.criado_em ASC`,
      [data]
    );
    if (!pedidos.length) return [];

    const ids = pedidos.map((p) => p.id);
    const { rows: itens } = await query<ItemPedido>(
      `SELECT * FROM itens_pedido WHERE pedido_id = ANY($1::uuid[]) ORDER BY criado_em`,
      [ids]
    );
    logger.info(`[Pedido] ${pedidos.length} pedidos em ${data}`);
    return pedidos.map((p) => ({ ...p, itens: itens.filter((i) => i.pedido_id === p.id) }));
  },

  async listarPorCaixa(caixaId: string): Promise<(Pedido & { itens: ItemPedido[] })[]> {
    const { rows: pedidos } = await query<Pedido>(
      `SELECT p.*,
              COALESCE(p.mesa_numero, m.numero) AS mesa_numero
       FROM pedidos p
       LEFT JOIN mesas m ON m.id = p.mesa_id
       WHERE p.caixa_id = $1
       ORDER BY p.criado_em ASC`,
      [caixaId]
    );
    if (!pedidos.length) return [];

    const ids = pedidos.map((p) => p.id);
    const { rows: itens } = await query<ItemPedido>(
      `SELECT * FROM itens_pedido WHERE pedido_id = ANY($1::uuid[]) ORDER BY criado_em`,
      [ids]
    );
    return pedidos.map((p) => ({
      ...p,
      itens: itens.filter((i) => i.pedido_id === p.id),
    }));
  },

  async adicionarItem(pedidoId: string, dto: AdicionarItemDTO): Promise<ItemPedido> {
    return withTransaction(async (client) => {
      const { rows: [pedido] } = await client.query<Pedido>(
        `SELECT * FROM pedidos WHERE id=$1 AND status='aberto' FOR UPDATE`, [pedidoId]
      );
      if (!pedido) throw new AppError('Pedido não encontrado ou já fechado', 404);

      const produto = await ProdutoService.buscarPorId(dto.produto_id);
      if (!produto.ativo) throw new AppError('Produto inativo', 400);

      const subtotal = produto.preco * dto.quantidade;
      const { rows: [item] } = await client.query<ItemPedido>(
        `INSERT INTO itens_pedido
           (pedido_id,produto_id,nome_produto,preco_produto,quantidade,subtotal,observacao)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [pedidoId, dto.produto_id, produto.nome, produto.preco, dto.quantidade, subtotal, dto.observacao ?? null]
      );
      logger.info(`[Pedido] ➕ Item adicionado: ${dto.quantidade}x "${produto.nome}" = R$ ${subtotal.toFixed(2)} (pedido ${pedidoId})`);
      return item;
    });
  },

  async atualizarItem(pedidoId: string, itemId: string, dto: AtualizarItemDTO): Promise<ItemPedido> {
    const { rows: [item] } = await query<ItemPedido>(
      'SELECT * FROM itens_pedido WHERE id=$1 AND pedido_id=$2', [itemId, pedidoId]
    );
    if (!item) throw new AppError('Item não encontrado', 404);

    if (dto.quantidade <= 0) {
      await query('DELETE FROM itens_pedido WHERE id=$1', [itemId]);
      logger.info(`[Pedido] 🗑️  Item removido (qty=0): "${item.nome_produto}"`);
      return { ...item, quantidade: 0, subtotal: 0 };
    }
    const novoSubtotal = item.preco_produto * dto.quantidade;
    const { rows: [updated] } = await query<ItemPedido>(
      `UPDATE itens_pedido SET quantidade=$1, subtotal=$2 WHERE id=$3 RETURNING *`,
      [dto.quantidade, novoSubtotal, itemId]
    );
    logger.info(`[Pedido] ✏️  Quantidade atualizada: "${item.nome_produto}" → ${dto.quantidade}x = R$ ${novoSubtotal.toFixed(2)}`);
    return updated;
  },

  async removerItem(pedidoId: string, itemId: string): Promise<void> {
    const { rows: [item] } = await query<ItemPedido>(
      'SELECT nome_produto FROM itens_pedido WHERE id=$1', [itemId]
    );
    const { rowCount } = await query(
      'DELETE FROM itens_pedido WHERE id=$1 AND pedido_id=$2', [itemId, pedidoId]
    );
    if (!rowCount) throw new AppError('Item não encontrado', 404);
    logger.info(`[Pedido] 🗑️  Item removido: "${item?.nome_produto}"`);
  },

  async atualizarObservacaoItem(pedidoId: string, itemId: string, observacao: string): Promise<ItemPedido> {
    const { rows: [item] } = await query<ItemPedido>(
      `UPDATE itens_pedido SET observacao=$1 WHERE id=$2 AND pedido_id=$3 RETURNING *`,
      [observacao, itemId, pedidoId]
    );
    if (!item) throw new AppError('Item não encontrado', 404);
    logger.info(`[Pedido] 💬 Observação: "${item.nome_produto}" → "${observacao}"`);
    return item;
  },

  async fecharConta(pedidoId: string, mesaId: string, dto: FecharContaDTO): Promise<Pedido & { itens: ItemPedido[] }> {
    return withTransaction(async (client) => {
      const { rows: [pedido] } = await client.query<Pedido>(
        `SELECT * FROM pedidos WHERE id=$1 AND status='aberto' FOR UPDATE`, [pedidoId]
      );
      if (!pedido) throw new AppError('Pedido não encontrado ou já fechado', 404);

      // pedido.total ainda é a soma bruta dos itens (desconto/acréscimo = 0 até aqui)
      const subtotal  = Number(pedido.total);
      if (subtotal === 0) throw new AppError('Pedido sem itens', 400);

      const desconto  = Math.max(0, Number(dto.desconto  ?? 0));
      const acrescimo = Math.max(0, Number(dto.acrescimo ?? 0));
      if (desconto > subtotal) {
        throw new AppError('O desconto não pode ser maior que o valor da conta', 400);
      }
      const totalFinal = Math.max(0, subtotal - desconto + acrescimo);

      if (dto.forma_pagamento === 'dinheiro' && dto.valor_recebido < totalFinal) {
        throw new AppError(`Valor insuficiente — faltam R$ ${(totalFinal - dto.valor_recebido).toFixed(2)}`, 400);
      }
      const troco = dto.forma_pagamento === 'dinheiro'
        ? Math.max(0, dto.valor_recebido - totalFinal)
        : 0;

      const { rows: [fechado] } = await client.query<Pedido>(
        `UPDATE pedidos SET status='fechado', fechado_em=NOW(),
           desconto=$1, acrescimo=$2, total=$3,
           forma_pagamento=$4, valor_recebido=$5, troco=$6
         WHERE id=$7 RETURNING *`,
        [desconto, acrescimo, totalFinal, dto.forma_pagamento, dto.valor_recebido, troco, pedidoId]
      );
      await client.query(
        `UPDATE mesas SET status='livre', aberta_em=NULL, pedido_atual_id=NULL WHERE id=$1`,
        [mesaId]
      );
      if (fechado.caixa_id) {
        await client.query(
          `INSERT INTO movimentacoes_caixa (caixa_id,pedido_id,tipo,valor,descricao)
           VALUES ($1,$2,'venda',$3,$4)`,
          [fechado.caixa_id, pedidoId, fechado.total, `Conta fechada — ${dto.forma_pagamento}`]
        );
      }
      const { rows: itens } = await client.query<ItemPedido>(
        'SELECT * FROM itens_pedido WHERE pedido_id=$1 ORDER BY criado_em', [pedidoId]
      );
      logger.info(
        `[Pedido] 💰 CONTA FECHADA — Mesa ${mesaId} | Total: R$ ${Number(fechado.total).toFixed(2)} | ` +
        `Pagamento: ${dto.forma_pagamento.toUpperCase()}` +
        (troco > 0 ? ` | Troco: R$ ${troco.toFixed(2)}` : '')
      );
      return { ...fechado, itens };
    });
  },
};
