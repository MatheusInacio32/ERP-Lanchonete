import { query } from '../config/database';
import { logger } from '../utils/logger';
import type {
  RelatorioCaixa, RelatorioPeriodo, RelatorioMesa, ItemPedido, Pedido,
} from '../types';
import { CaixaService } from './caixaService';

export const RelatorioService = {
  async relatorioCaixa(caixaId: string): Promise<RelatorioCaixa> {
    const resumo = await CaixaService.getResumo(caixaId);

    const { rows: pedidos } = await query<Pedido>(
      `SELECT p.*,
              COALESCE(p.mesa_numero, m.numero) AS mesa_numero
       FROM pedidos p
       LEFT JOIN mesas m ON m.id = p.mesa_id
       WHERE p.caixa_id = $1
       ORDER BY p.criado_em ASC`,
      [caixaId]
    );

    let itens: ItemPedido[] = [];
    if (pedidos.length) {
      const ids = pedidos.map((p) => p.id);
      const { rows } = await query<ItemPedido>(
        `SELECT * FROM itens_pedido WHERE pedido_id = ANY($1::uuid[]) ORDER BY criado_em`,
        [ids]
      );
      itens = rows;
    }

    const pedidosComItens = pedidos.map((p) => ({
      ...p,
      itens: itens.filter((i) => i.pedido_id === p.id),
    }));

    logger.info(`[Relatorio] Caixa ${caixaId} — ${pedidos.length} pedidos, ${itens.length} itens`);
    return { ...resumo, pedidos: pedidosComItens };
  },

  async relatorioPeriodo(inicio: string, fim: string): Promise<RelatorioPeriodo> {
    const { rows: resumoRows } = await query(
      `SELECT
         COUNT(*)                                                                        AS total_pedidos,
         COALESCE(SUM(total), 0)                                                        AS total_vendas,
         COALESCE(SUM(total) FILTER (WHERE forma_pagamento='dinheiro'), 0)             AS total_dinheiro,
         COALESCE(SUM(total) FILTER (WHERE forma_pagamento='pix'),      0)             AS total_pix,
         COALESCE(SUM(total) FILTER (WHERE forma_pagamento='debito'),   0)             AS total_debito,
         COALESCE(SUM(total) FILTER (WHERE forma_pagamento='credito'),  0)             AS total_credito,
         COALESCE(SUM(total) FILTER (WHERE forma_pagamento='voucher'),  0)             AS total_voucher,
         COALESCE(SUM(total) FILTER (WHERE forma_pagamento='cartao'),   0)             AS total_cartao
       FROM pedidos
       WHERE status = 'fechado'
         AND DATE(fechado_em) BETWEEN $1 AND $2`,
      [inicio, fim]
    );

    const { rows: porDia } = await query(
      `SELECT
         TO_CHAR(DATE(fechado_em), 'YYYY-MM-DD')                                       AS data,
         COUNT(*)                                                                       AS total_pedidos,
         COALESCE(SUM(total), 0)                                                       AS total_vendas,
         COALESCE(SUM(total) FILTER (WHERE forma_pagamento='dinheiro'), 0)            AS total_dinheiro,
         COALESCE(SUM(total) FILTER (WHERE forma_pagamento='pix'),      0)            AS total_pix,
         COALESCE(SUM(total) FILTER (WHERE forma_pagamento='debito'),   0)            AS total_debito,
         COALESCE(SUM(total) FILTER (WHERE forma_pagamento='credito'),  0)            AS total_credito,
         COALESCE(SUM(total) FILTER (WHERE forma_pagamento='voucher'),  0)            AS total_voucher,
         COALESCE(SUM(total) FILTER (WHERE forma_pagamento='cartao'),   0)            AS total_cartao
       FROM pedidos
       WHERE status = 'fechado'
         AND DATE(fechado_em) BETWEEN $1 AND $2
       GROUP BY DATE(fechado_em)
       ORDER BY DATE(fechado_em) ASC`,
      [inicio, fim]
    );

    const { rows: topProdutos } = await query(
      `SELECT
         i.nome_produto,
         SUM(i.quantidade)  AS total_quantidade,
         SUM(i.subtotal)    AS total_valor
       FROM itens_pedido i
       JOIN pedidos p ON p.id = i.pedido_id
       WHERE p.status = 'fechado'
         AND DATE(p.fechado_em) BETWEEN $1 AND $2
       GROUP BY i.nome_produto
       ORDER BY total_valor DESC
       LIMIT 30`,
      [inicio, fim]
    );

    logger.info(`[Relatorio] Período ${inicio} → ${fim} — ${porDia.length} dias`);
    return { periodo: { inicio, fim }, resumo: resumoRows[0], porDia, topProdutos };
  },

  async relatorioPorMesa(data: string): Promise<RelatorioMesa[]> {
    const { rows } = await query<RelatorioMesa>(
      `SELECT
         COALESCE(p.mesa_numero, m.numero)                              AS mesa_numero,
         p.mesa_id,
         COUNT(*) FILTER (WHERE p.status = 'fechado')                  AS pedidos_fechados,
         COUNT(*) FILTER (WHERE p.status = 'cancelado')                AS pedidos_cancelados,
         COALESCE(SUM(p.total) FILTER (WHERE p.status = 'fechado'), 0) AS total_vendas,
         MIN(p.criado_em)                                              AS primeiro_pedido,
         MAX(p.fechado_em)                                             AS ultimo_fechamento
       FROM pedidos p
       LEFT JOIN mesas m ON m.id = p.mesa_id
       WHERE DATE(p.criado_em) = $1
       GROUP BY p.mesa_id, p.mesa_numero, m.numero
       ORDER BY mesa_numero ASC`,
      [data]
    );
    logger.info(`[Relatorio] Mesas em ${data} — ${rows.length} mesas com movimento`);
    return rows;
  },

  async historicoCompleto(inicio: string, fim: string) {
    const { rows } = await query(
      `SELECT * FROM vw_resumo_caixa
       WHERE DATE(aberto_em) BETWEEN $1 AND $2
       ORDER BY aberto_em ASC`,
      [inicio, fim]
    );
    return rows;
  },

  // Auditoria de produção: o que foi produzido, quando e quanto
  async auditoriaProducao(inicio: string, fim: string) {
    // Ranking de produtos produzidos
    const { rows: porProduto } = await query(
      `SELECT
         i.nome_produto,
         i.produto_id,
         SUM(i.quantidade)::int        AS total_quantidade,
         SUM(i.subtotal)               AS total_valor,
         COUNT(DISTINCT p.id)::int     AS total_pedidos,
         COUNT(DISTINCT COALESCE(p.mesa_numero, m.numero))::int AS total_mesas
       FROM itens_pedido i
       JOIN pedidos p ON p.id = i.pedido_id
       LEFT JOIN mesas m ON m.id = p.mesa_id
       WHERE p.status = 'fechado'
         AND DATE(p.fechado_em) BETWEEN $1 AND $2
       GROUP BY i.nome_produto, i.produto_id
       ORDER BY total_quantidade DESC`,
      [inicio, fim]
    );

    // Produção por hora do dia (pico de produção)
    const { rows: porHora } = await query(
      `SELECT
         EXTRACT(HOUR FROM p.fechado_em)::int AS hora,
         COUNT(DISTINCT p.id)::int            AS total_pedidos,
         SUM(i.quantidade)::int               AS total_itens
       FROM pedidos p
       JOIN itens_pedido i ON i.pedido_id = p.id
       WHERE p.status = 'fechado'
         AND DATE(p.fechado_em) BETWEEN $1 AND $2
       GROUP BY EXTRACT(HOUR FROM p.fechado_em)
       ORDER BY hora`,
      [inicio, fim]
    );

    // Totais gerais
    const { rows: [totais] } = await query(
      `SELECT
         SUM(i.quantidade)::int         AS total_itens_produzidos,
         COUNT(DISTINCT i.nome_produto) AS total_produtos_diferentes,
         COUNT(DISTINCT p.id)::int      AS total_pedidos_fechados,
         COALESCE(SUM(i.subtotal), 0)   AS faturamento_total
       FROM itens_pedido i
       JOIN pedidos p ON p.id = i.pedido_id
       WHERE p.status = 'fechado'
         AND DATE(p.fechado_em) BETWEEN $1 AND $2`,
      [inicio, fim]
    );

    // Cancelamentos no período
    const { rows: [cancelados] } = await query(
      `SELECT
         COUNT(*)::int                AS total_cancelados,
         COALESCE(SUM(total), 0)      AS valor_perdido
       FROM pedidos
       WHERE status = 'cancelado'
         AND DATE(criado_em) BETWEEN $1 AND $2`,
      [inicio, fim]
    );

    logger.info(
      `[Relatorio] Auditoria produção ${inicio}→${fim}: ` +
      `${totais?.total_itens_produzidos ?? 0} itens, ` +
      `${porProduto.length} produtos`
    );

    return {
      periodo: { inicio, fim },
      totais,
      cancelados,
      porProduto,
      porHora,
    };
  },
};
