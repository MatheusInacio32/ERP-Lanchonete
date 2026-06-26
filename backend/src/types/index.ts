// ── Enums ─────────────────────────────────────────────────────
export type StatusMesa       = 'livre' | 'ocupada';
export type FormaPagamento   = 'dinheiro' | 'pix' | 'debito' | 'credito' | 'voucher' | 'cartao';
export type StatusPedido     = 'aberto' | 'fechado' | 'cancelado';
export type StatusCaixa      = 'aberto' | 'fechado';
export type CategoriaProduto = 'Lanches' | 'Bebidas' | 'Porcoes' | 'Sobremesas' | 'Outros';
export type TipoMovimentacao = 'venda' | 'abertura_caixa' | 'fechamento_caixa' | 'sangria' | 'suprimento';

// ── Entidades (espelham o banco) ──────────────────────────────
export interface Usuario {
  id:            string;
  nome:          string;
  login:         string;
  senha_hash:    string;
  ativo:         boolean;
  criado_em:     Date;
  atualizado_em: Date;
}

export interface Configuracao {
  id:                   number;
  nome_estabelecimento: string;
  total_mesas:          number;
  telefone?:            string;
  endereco?:            string;
  cor_tema:             string;
  atualizado_em:        Date;
}

export interface Produto {
  id:            string;
  codigo:        string;
  nome:          string;
  categoria:     CategoriaProduto;
  preco:         number;
  ativo:         boolean;
  criado_em:     Date;
  atualizado_em: Date;
}

export interface Mesa {
  id:               string;
  numero:           number;
  status:           StatusMesa;
  aberta_em?:       Date;
  pedido_atual_id?: string;
}

export interface Caixa {
  id:             string;
  status:         StatusCaixa;
  aberto_por:     string;
  aberto_em:      Date;
  fechado_por?:   string;
  fechado_em?:    Date;
  valor_abertura: number;
  valor_contado?: number;
  diferenca?:     number;
  observacoes?:   string;
  criado_em:      Date;
}

export interface Pedido {
  id:               string;
  mesa_id:          string;
  mesa_numero?:     number;
  caixa_id?:        string;
  status:           StatusPedido;
  total:            number;
  forma_pagamento?: FormaPagamento;
  valor_recebido?:  number;
  troco?:           number;
  criado_em:        Date;
  fechado_em?:      Date;
  cancelado_em?:    Date;
  cancelado_por?:   string;
  observacoes?:     string;
}

export interface ItemPedido {
  id:            string;
  pedido_id:     string;
  produto_id:    string;
  nome_produto:  string;
  preco_produto: number;
  quantidade:    number;
  subtotal:      number;
  observacao?:   string;
  criado_em:     Date;
}

export interface MovimentacaoCaixa {
  id:          string;
  caixa_id:    string;
  pedido_id?:  string;
  tipo:        TipoMovimentacao;
  valor:       number;
  descricao?:  string;
  operador?:   string;
  criado_em:   Date;
}

// ── DTOs de request ───────────────────────────────────────────
export interface CriarProdutoDTO {
  codigo:    string;
  nome:      string;
  categoria: CategoriaProduto;
  preco:     number;
}

export interface AtualizarProdutoDTO {
  codigo?:    string;
  nome?:      string;
  categoria?: CategoriaProduto;
  preco?:     number;
  ativo?:     boolean;
}

export interface AbrirMesaDTO {
  mesa_id: string;
}

export interface AdicionarItemDTO {
  produto_id: string;
  quantidade: number;
  observacao?: string;
}

export interface AtualizarItemDTO {
  quantidade: number;
}

export interface FecharContaDTO {
  forma_pagamento: FormaPagamento;
  valor_recebido:  number;
}

export interface AbrirCaixaDTO {
  aberto_por:     string;
  valor_abertura: number;
}

export interface FecharCaixaDTO {
  fechado_por:  string;
  valor_contado: number;
  observacoes?:  string;
}

export interface AtualizarConfiguracaoDTO {
  nome_estabelecimento?: string;
  total_mesas?:          number;
  telefone?:             string;
  endereco?:             string;
  cor_tema?:             string;
}

// ── Respostas da API ──────────────────────────────────────────
export interface ApiResponse<T = any> {
  success: boolean;
  data?:   T;
  error?:  string;
  message?: string;
}

export interface ResumoCaixa {
  id:                string;
  aberto_por:        string;
  aberto_em:         Date;
  fechado_por?:      string;
  fechado_em?:       Date;
  status:            StatusCaixa;
  valor_abertura:    number;
  valor_contado?:    number;
  diferenca?:        number;
  observacoes?:      string;
  total_pedidos:     number;
  total_cancelados:  number;
  total_vendas:      number;
  total_dinheiro:    number;
  total_pix:         number;
  total_cartao:      number;
  saldo_esperado:    number;
}

export interface RelatorioDia {
  data:            string;
  total_pedidos:   number;
  total_vendas:    number;
  total_dinheiro:  number;
  total_pix:       number;
  total_cartao:    number;
}

export interface RelatorioProduto {
  nome_produto:    string;
  total_quantidade: number;
  total_valor:     number;
}

export interface RelatorioPeriodo {
  periodo:      { inicio: string; fim: string };
  resumo:       Omit<RelatorioDia, 'data'>;
  porDia:       RelatorioDia[];
  topProdutos:  RelatorioProduto[];
}

export interface RelatorioCaixa extends ResumoCaixa {
  pedidos: (Pedido & { itens: ItemPedido[] })[];
}

export interface RelatorioMesa {
  mesa_numero:        number;
  mesa_id:            string;
  pedidos_fechados:   number;
  pedidos_cancelados: number;
  total_vendas:       number;
  primeiro_pedido?:   Date;
  ultimo_fechamento?: Date;
}

export interface Dashboard {
  total_mesas:        number;
  mesas_ocupadas:     number;
  mesas_livres:       number;
  total_vendido_hoje: number;
  pedidos_hoje:       number;
  caixa_aberto_id?:   string;
}

export interface PedidoCompleto extends Pedido {
  itens: ItemPedido[];
  mesa?: Mesa;
}
