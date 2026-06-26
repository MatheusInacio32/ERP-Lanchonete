import { query, withTransaction } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import type { Caixa, AbrirCaixaDTO, FecharCaixaDTO, ResumoCaixa, Dashboard } from '../types';

export const CaixaService = {
  async getAtual(): Promise<Caixa | null> {
    const { rows } = await query<Caixa>(`SELECT * FROM caixas WHERE status='aberto' LIMIT 1`);
    if (rows[0]) {
      logger.debug(`[Caixa] Caixa aberto: id=${rows[0].id}, por=${rows[0].aberto_por}`);
    }
    return rows[0] ?? null;
  },

  async buscarPorId(id: string): Promise<Caixa> {
    const { rows } = await query<Caixa>('SELECT * FROM caixas WHERE id=$1', [id]);
    if (!rows[0]) throw new AppError('Caixa não encontrado', 404);
    return rows[0];
  },

  async abrir(dto: AbrirCaixaDTO): Promise<Caixa> {
    const atual = await CaixaService.getAtual();
    if (atual) throw new AppError('Já existe um caixa aberto', 409, 'CAIXA_JA_ABERTO');

    const { rows } = await query<Caixa>(
      `INSERT INTO caixas (aberto_por,valor_abertura,status)
       VALUES ($1,$2,'aberto') RETURNING *`,
      [dto.aberto_por, dto.valor_abertura]
    );
    await query(
      `INSERT INTO movimentacoes_caixa (caixa_id,tipo,valor,descricao,operador)
       VALUES ($1,'abertura_caixa',$2,'Abertura de caixa',$3)`,
      [rows[0].id, dto.valor_abertura, dto.aberto_por]
    );
    logger.info(`[Caixa] 🟢 ABERTO por "${dto.aberto_por}" — Troco inicial: R$ ${Number(dto.valor_abertura).toFixed(2)}`);
    return rows[0];
  },

  async fechar(dto: FecharCaixaDTO): Promise<ResumoCaixa> {
    return withTransaction(async (client) => {
      const { rows: [atual] } = await client.query<Caixa>(
        `SELECT * FROM caixas WHERE status='aberto' FOR UPDATE LIMIT 1`
      );
      if (!atual) throw new AppError('Nenhum caixa aberto', 404);

      const { rows: [resumo] } = await client.query<ResumoCaixa>(
        'SELECT * FROM vw_resumo_caixa WHERE id=$1', [atual.id]
      );
      const diferenca = dto.valor_contado - Number(resumo.saldo_esperado);

      await client.query(
        `UPDATE caixas SET status='fechado',fechado_por=$1,fechado_em=NOW(),
           valor_contado=$2,diferenca=$3,observacoes=$4
         WHERE id=$5`,
        [dto.fechado_por, dto.valor_contado, diferenca, dto.observacoes ?? null, atual.id]
      );
      await client.query(
        `INSERT INTO movimentacoes_caixa (caixa_id,tipo,valor,descricao,operador)
         VALUES ($1,'fechamento_caixa',$2,'Fechamento de caixa',$3)`,
        [atual.id, dto.valor_contado, dto.fechado_por]
      );
      const { rows: [final] } = await client.query<ResumoCaixa>(
        'SELECT * FROM vw_resumo_caixa WHERE id=$1', [atual.id]
      );
      const difStr = diferenca >= 0 ? `+R$ ${diferenca.toFixed(2)}` : `-R$ ${Math.abs(diferenca).toFixed(2)}`;
      logger.info(
        `[Caixa] 🔒 FECHADO por "${dto.fechado_por}" — ` +
        `Total vendas: R$ ${Number(final.total_vendas).toFixed(2)} | ` +
        `${final.total_pedidos} pedidos | ` +
        `Saldo esperado: R$ ${Number(final.saldo_esperado).toFixed(2)} | ` +
        `Valor contado: R$ ${dto.valor_contado.toFixed(2)} | ` +
        `Diferença: ${difStr}`
      );
      return { ...final, diferenca };
    });
  },

  async getResumo(caixaId: string): Promise<ResumoCaixa> {
    const { rows } = await query<ResumoCaixa>('SELECT * FROM vw_resumo_caixa WHERE id=$1', [caixaId]);
    if (!rows[0]) throw new AppError('Caixa não encontrado', 404);
    return rows[0];
  },

  async listarPorData(data: string): Promise<ResumoCaixa[]> {
    // Inclui caixas cuja JANELA de atividade cobre a data — abriu antes/no dia
    // e fechou no dia/depois, ou ainda está aberto. Resolve caixas multi-dia:
    // um caixa aberto dia 23 e fechado dia 25 aparece nos dias 23, 24 e 25.
    const { rows } = await query<ResumoCaixa>(
      `SELECT * FROM vw_resumo_caixa
       WHERE DATE(aberto_em) <= $1
         AND (fechado_em IS NULL OR DATE(fechado_em) >= $1)
       ORDER BY aberto_em ASC`, [data]
    );
    logger.info(`[Caixa] ${rows.length} caixas ativos em ${data}`);
    return rows;
  },

  async getHistorico(limite = 30): Promise<ResumoCaixa[]> {
    const { rows } = await query<ResumoCaixa>(
      `SELECT * FROM vw_resumo_caixa WHERE status='fechado' ORDER BY aberto_em DESC LIMIT $1`, [limite]
    );
    return rows;
  },

  async getDashboard(): Promise<Dashboard> {
    const { rows } = await query<Dashboard>('SELECT * FROM vw_dashboard LIMIT 1');
    logger.debug(`[Dashboard] Mesas: ${rows[0]?.mesas_ocupadas}/${rows[0]?.total_mesas} ocupadas | Vendas hoje: R$ ${Number(rows[0]?.total_vendido_hoje ?? 0).toFixed(2)}`);
    return rows[0];
  },
};
