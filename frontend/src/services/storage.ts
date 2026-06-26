/**
 * storage.ts — Camada de acesso à API REST (PostgreSQL via backend)
 * Nenhum dado é armazenado no localStorage.
 */
import { api } from './api';
import { localDate } from '../utils';
import type {
  Mesa, Produto, Pedido, Configuracoes, Caixa, RelatorioCaixa, FormaPagamento,
} from '../types';

// ── Mesas ─────────────────────────────────────────────────────
export const MesaService = {
  getAll:  () => api.get<Mesa[]>('/mesas'),
  abrir:   (mesaId: string) => api.post<Pedido>(`/mesas/${mesaId}/abrir`, {}),
  cancelar:(mesaId: string) => api.delete<null>(`/mesas/${mesaId}/abrir`),
};

// ── Produtos ──────────────────────────────────────────────────
export const ProdutoService = {
  getAll:   () => api.get<Produto[]>('/produtos'),
  porCodigo:(codigo: string) => api.get<Produto>(`/produtos/codigo/${codigo}`),
  criar:    (d: Omit<Produto,'id'|'criadoEm'|'ativo'|'foi_usado'>) => api.post<Produto>('/produtos', d),
  atualizar:(id: string, d: Partial<Produto>) => api.patch<Produto>(`/produtos/${id}`, d),
  inativar: (id: string) => api.patch<Produto>(`/produtos/${id}/inativar`, {}),
  reativar: (id: string) => api.patch<Produto>(`/produtos/${id}/reativar`, {}),
  excluir:  (id: string) => api.delete<null>(`/produtos/${id}`),
};

// ── Pedidos ───────────────────────────────────────────────────
export const PedidoService = {
  getPorMesa: (mesaId: string) => api.get<Pedido>(`/mesas/${mesaId}/pedido`),

  adicionarItem: (pedidoId: string, produtoId: string, quantidade: number, observacao: string) =>
    api.post(`/pedidos/${pedidoId}/itens`, { produto_id: produtoId, quantidade, observacao }),

  atualizarItem: (pedidoId: string, itemId: string, quantidade: number) =>
    api.patch(`/pedidos/${pedidoId}/itens/${itemId}`, { quantidade }),

  removerItem: (pedidoId: string, itemId: string) =>
    api.delete(`/pedidos/${pedidoId}/itens/${itemId}`),

  editarObservacao: (pedidoId: string, itemId: string, observacao: string) =>
    api.patch(`/pedidos/${pedidoId}/itens/${itemId}/obs`, { observacao }),

  fecharConta: (mesaId: string, forma: FormaPagamento, valorRecebido: number) =>
    api.post<Pedido>(`/mesas/${mesaId}/fechar`, {
      forma_pagamento: forma,
      valor_recebido:  valorRecebido,
    }),

  getHoje: () => {
    const hoje = localDate();
    return api.get<Pedido[]>(`/pedidos?data=${hoje}`);
  },

  getPorData:   (data: string)   => api.get<Pedido[]>(`/pedidos?data=${data}`),
  buscarPorId:  (id: string)     => api.get<Pedido>(`/pedidos/${id}`),
};

// ── Caixa ──────────────────────────────────────────────────────
export const CaixaService = {
  getAtual:   () => api.get<Caixa | null>('/caixa'),
  abrir:      (abertoPor: string, valorAbertura: number) =>
    api.post<Caixa>('/caixa/abrir', { aberto_por: abertoPor, valor_abertura: valorAbertura }),
  fechar:     (fechadoPor: string, valorContado: number, observacoes?: string) =>
    api.post<RelatorioCaixa>('/caixa/fechar', { fechado_por: fechadoPor, valor_contado: valorContado, observacoes }),
  getResumo:  (caixaId: string) => api.get<RelatorioCaixa>(`/caixa/resumo/${caixaId}`),
  getHistorico: () => api.get<RelatorioCaixa[]>('/caixa/historico'),
  getPorData: (data: string) => api.get<Caixa[]>(`/caixa/data?data=${data}`),
};

// ── Configurações ─────────────────────────────────────────────
export const ConfigService = {
  get:    () => api.get<Configuracoes>('/configuracoes'),
  salvar: (d: Partial<Configuracoes>) =>
    api.patch<Configuracoes>('/configuracoes', {
      nome_estabelecimento: d.nomeEstabelecimento,
      total_mesas:          d.totalMesas,
      telefone:             d.telefone,
      endereco:             d.endereco,
    }),
  // Salva só a cor (não mexe nos outros campos)
  salvarCor: (cor: string) =>
    api.patch<Configuracoes>('/configuracoes', { cor_tema: cor }),
};

// ── Backup ────────────────────────────────────────────────────
export const BackupService = {
  // Backup nativo (.backup via pg_dump) — baixa o arquivo no navegador
  async baixarBackup(): Promise<string> {
    const { blob, filename } = await api.getBlob('/backup/dump');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return filename;
  },

  // Restauração nativa (.backup via pg_restore)
  restaurarBackup: (file: File) =>
    api.postBinary<{ restaurado: boolean; tamanho: number }>('/backup/restore', file),

  // Zerar banco (Zona de Perigo)
  zerarBanco: () =>
    api.post<{ zerado: boolean }>('/admin/truncate', { confirmacao: 'CONFIRMAR' }),
};

// ── Relatórios (endpoints novos) ──────────────────────────────
export const RelatorioApiService = {
  producao: (inicio: string, fim: string) =>
    api.get<any>(`/relatorio/producao?inicio=${inicio}&fim=${fim}`),
  periodo: (inicio: string, fim: string) =>
    api.get<any>(`/relatorio/periodo?inicio=${inicio}&fim=${fim}`),
  mesas: (data: string) =>
    api.get<any[]>(`/relatorio/mesas?data=${data}`),
  caixa: (caixaId: string) =>
    api.get<any>(`/relatorio/caixa/${caixaId}`),
};

// ── Stub mantido para compatibilidade ─────────────────────────
export function initializeData(): void {}
