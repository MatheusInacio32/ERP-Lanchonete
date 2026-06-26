import { query, withTransaction } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import type { Produto, CriarProdutoDTO, AtualizarProdutoDTO } from '../types';

export const ProdutoService = {
  async buscarPorId(id: string): Promise<Produto> {
    const { rows } = await query<Produto>('SELECT * FROM produtos WHERE id = $1', [id]);
    if (!rows[0]) throw new AppError('Produto não encontrado', 404);
    return rows[0];
  },

  async buscarPorCodigo(codigo: string): Promise<Produto | null> {
    const { rows } = await query<Produto>(
      'SELECT * FROM produtos WHERE codigo = $1 AND ativo = true', [codigo]
    );
    if (rows[0]) {
      logger.info(`[Produto] Encontrado por código "${codigo}": ${rows[0].nome}`);
    } else {
      logger.warn(`[Produto] Código "${codigo}" não encontrado`);
    }
    return rows[0] ?? null;
  },

  async criar(dto: CriarProdutoDTO): Promise<Produto> {
    const { rows } = await query<Produto>(
      `INSERT INTO produtos (codigo, nome, categoria, preco)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [dto.codigo, dto.nome, dto.categoria, dto.preco]
    );
    logger.info(`[Produto] ✅ Criado: "${rows[0].nome}" (cod: ${rows[0].codigo}, R$ ${rows[0].preco})`);
    return rows[0];
  },

  async atualizar(id: string, dto: AtualizarProdutoDTO): Promise<Produto> {
    const campos: string[] = [];
    const valores: any[]   = [];
    let i = 1;
    if (dto.codigo    !== undefined) { campos.push(`codigo=$${i++}`);    valores.push(dto.codigo); }
    if (dto.nome      !== undefined) { campos.push(`nome=$${i++}`);      valores.push(dto.nome); }
    if (dto.categoria !== undefined) { campos.push(`categoria=$${i++}`); valores.push(dto.categoria); }
    if (dto.preco     !== undefined) { campos.push(`preco=$${i++}`);     valores.push(dto.preco); }
    if (dto.ativo     !== undefined) { campos.push(`ativo=$${i++}`);     valores.push(dto.ativo); }
    if (campos.length === 0) throw new AppError('Nenhum campo para atualizar');
    campos.push(`atualizado_em=NOW()`);
    valores.push(id);
    const { rows } = await query<Produto>(
      `UPDATE produtos SET ${campos.join(', ')} WHERE id=$${i} RETURNING *`, valores
    );
    if (!rows[0]) throw new AppError('Produto não encontrado', 404);
    logger.info(`[Produto] ✏️  Atualizado: "${rows[0].nome}" (id: ${id})`);
    return rows[0];
  },

  async inativar(id: string): Promise<Produto> {
    const p = await ProdutoService.atualizar(id, { ativo: false });
    logger.info(`[Produto] 🚫 Inativado: "${p.nome}"`);
    return p;
  },

  async reativar(id: string): Promise<Produto> {
    const p = await ProdutoService.atualizar(id, { ativo: true });
    logger.info(`[Produto] ✅ Reativado: "${p.nome}"`);
    return p;
  },

  async excluir(id: string): Promise<void> {
    const { rows: usados } = await query(
      'SELECT 1 FROM itens_pedido WHERE produto_id=$1 LIMIT 1', [id]
    );
    if (usados.length > 0) {
      throw new AppError('Produto já usado em pedidos — use inativar', 409, 'PRODUTO_EM_USO');
    }
    const { rows: [p] } = await query<Produto>('SELECT nome FROM produtos WHERE id=$1', [id]);
    await query('DELETE FROM produtos WHERE id=$1', [id]);
    logger.info(`[Produto] 🗑️  Excluído: "${p?.nome}" (id: ${id})`);
  },

  // Retorna todos os produtos enriquecidos com foi_usado em UMA query (evita N+1)
  async listarComFoiUsado(apenasAtivos = false): Promise<(Produto & { foi_usado: boolean })[]> {
    const sql = apenasAtivos
      ? 'SELECT * FROM produtos WHERE ativo = true ORDER BY categoria, nome'
      : 'SELECT * FROM produtos ORDER BY ativo DESC, categoria, nome';
    const { rows: produtos } = await query<Produto>(sql);
    if (!produtos.length) return [];
    const ids = produtos.map((p) => p.id);
    const { rows: usados } = await query<{ produto_id: string }>(
      'SELECT DISTINCT produto_id FROM itens_pedido WHERE produto_id = ANY($1::uuid[])', [ids]
    );
    const usadosSet = new Set(usados.map((u) => u.produto_id));
    logger.info(`[Produto] Listados ${produtos.length} produtos (${usadosSet.size} já usados em pedidos)`);
    return produtos.map((p) => ({ ...p, foi_usado: usadosSet.has(p.id) }));
  },
};
