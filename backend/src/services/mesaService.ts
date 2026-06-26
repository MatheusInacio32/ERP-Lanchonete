import { query, withTransaction } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import type { Mesa, Pedido } from '../types';

export const MesaService = {
  async listar(): Promise<(Mesa & { pedido_total?: number; pedido_itens?: number })[]> {
    // JOIN com pedidos ativos para mostrar total e qtd de itens nos cards de mesa
    const { rows } = await query<Mesa & { pedido_total?: number; pedido_itens?: number }>(
      `SELECT m.*,
              p.total                  AS pedido_total,
              COUNT(i.id)::int         AS pedido_itens
       FROM mesas m
       LEFT JOIN pedidos p  ON p.id = m.pedido_atual_id AND p.status = 'aberto'
       LEFT JOIN itens_pedido i ON i.pedido_id = p.id
       GROUP BY m.id, m.numero, m.status, m.aberta_em, m.pedido_atual_id, p.total
       ORDER BY m.numero`
    );
    const livres   = rows.filter((m) => m.status === 'livre').length;
    const ocupadas = rows.filter((m) => m.status === 'ocupada').length;
    logger.info(`[Mesa] Listadas ${rows.length} mesas — ${livres} livres, ${ocupadas} ocupadas`);
    return rows;
  },

  async buscarPorId(id: string): Promise<Mesa> {
    const { rows } = await query<Mesa>('SELECT * FROM mesas WHERE id=$1', [id]);
    if (!rows[0]) throw new AppError('Mesa não encontrada', 404);
    return rows[0];
  },

  async abrir(mesaId: string, caixaId: string): Promise<Pedido> {
    return withTransaction(async (client) => {
      const { rows: [mesa] } = await client.query<Mesa>(
        'SELECT * FROM mesas WHERE id=$1 FOR UPDATE', [mesaId]
      );
      if (!mesa) throw new AppError('Mesa não encontrada', 404);
      if (mesa.status === 'ocupada') throw new AppError('Mesa já está ocupada', 409);

      const { rows: [pedido] } = await client.query<Pedido>(
        `INSERT INTO pedidos (mesa_id, mesa_numero, caixa_id, status, total)
         VALUES ($1,$2,$3,'aberto',0) RETURNING *`,
        [mesaId, mesa.numero, caixaId]
      );
      await client.query(
        `UPDATE mesas SET status='ocupada', aberta_em=NOW(), pedido_atual_id=$1 WHERE id=$2`,
        [pedido.id, mesaId]
      );
      logger.info(`[Mesa] 🔓 Mesa ${mesa.numero} ABERTA — pedido ${pedido.id}`);
      return { ...pedido, itens: [] };
    });
  },

  async cancelar(mesaId: string): Promise<void> {
    return withTransaction(async (client) => {
      const { rows: [mesa] } = await client.query<Mesa>(
        'SELECT * FROM mesas WHERE id=$1 FOR UPDATE', [mesaId]
      );
      if (!mesa) throw new AppError('Mesa não encontrada', 404);
      if (mesa.status !== 'ocupada') throw new AppError('Mesa não está ocupada');
      if (!mesa.pedido_atual_id) throw new AppError('Mesa sem pedido ativo');

      const { rows: itens } = await client.query(
        'SELECT 1 FROM itens_pedido WHERE pedido_id=$1 LIMIT 1', [mesa.pedido_atual_id]
      );
      if (itens.length > 0) {
        throw new AppError('Mesa tem itens — feche a conta antes de cancelar', 409);
      }
      // ORDEM IMPORTA: a FK mesas.pedido_atual_id → pedidos.id é circular.
      // Primeiro desvincula a mesa do pedido, só então deleta o pedido.
      await client.query(
        `UPDATE mesas SET status='livre', aberta_em=NULL, pedido_atual_id=NULL WHERE id=$1`,
        [mesaId]
      );
      await client.query('DELETE FROM pedidos WHERE id=$1', [mesa.pedido_atual_id]);
      logger.info(`[Mesa] ❌ Mesa ${mesa.numero} CANCELADA (sem itens)`);
    });
  },

  async sincronizarQuantidade(totalMesas: number): Promise<void> {
    const { rows } = await query<{ max_numero: number }>(
      'SELECT COALESCE(MAX(numero),0) AS max_numero FROM mesas'
    );
    const atual = rows[0].max_numero;
    if (totalMesas > atual) {
      for (let n = atual + 1; n <= totalMesas; n++) {
        await query(`INSERT INTO mesas (numero) VALUES ($1) ON CONFLICT (numero) DO NOTHING`, [n]);
      }
      logger.info(`[Mesa] ➕ Criadas mesas ${atual + 1} até ${totalMesas}`);
    }
  },
};
