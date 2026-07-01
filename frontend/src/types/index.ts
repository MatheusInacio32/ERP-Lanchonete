// ============================================================
// TYPES — Lanchonete System (API-connected)
// ============================================================

export type MesaStatus     = 'livre' | 'ocupada';
export type FormaPagamento = 'dinheiro' | 'pix' | 'debito' | 'credito' | 'voucher' | 'cartao';
export type Categoria      = 'Lanches' | 'Bebidas' | 'Porcoes' | 'Sobremesas' | 'Outros';
export type CaixaStatus    = 'aberto' | 'fechado';

export interface Produto {
  id:         string;
  codigo:     string;
  nome:       string;
  categoria:  Categoria;
  preco:      number;
  ativo:      boolean;
  criadoEm:   string;
  foi_usado?: boolean; // flag vinda do backend
}

export interface ItemPedido {
  id:            string;
  produtoId:     string;    // camelCase (frontend)
  produto_id?:   string;    // snake_case (API)
  nomeProduto:   string;
  nome_produto?: string;
  precoProduto:  number;
  preco_produto?: number;
  quantidade:    number;
  observacao:    string;
  subtotal:      number;
}

export interface Pedido {
  id:               string;
  mesaId?:          string;   // camelCase
  mesa_id?:         string;   // snake_case (API)
  mesa_numero?:     number;   // vem do JOIN em listarPorData
  itens:            ItemPedido[];
  total:            number;
  desconto?:        number;
  acrescimo?:       number;
  status:           'aberto' | 'fechado' | 'cancelado';
  criadoEm?:        string;
  criado_em?:       string;
  fechadoEm?:       string;
  fechado_em?:      string;
  formaPagamento?:  FormaPagamento;
  forma_pagamento?: FormaPagamento;
  valorRecebido?:   number;
  valor_recebido?:  number;
  troco?:           number;
  pedidoAtualId?:   string;   // usado em Mesa
}

export interface Mesa {
  id:               string;
  numero:           number;
  status:           MesaStatus;
  abertaEm?:        string;
  aberta_em?:       string;
  pedidoAtualId?:   string;
  pedido_atual_id?: string;
  // Campos calculados pelo JOIN no backend (evita busca no estado de pedidos)
  pedido_total?:    number;
  pedido_itens?:    number;
}

export interface Configuracoes {
  nomeEstabelecimento: string;
  totalMesas:          number;
  telefone?:           string;
  endereco?:           string;
  corTema?:            string;
}

export interface Caixa {
  id:             string;
  status:         CaixaStatus;
  abertoPor?:     string;
  aberto_por?:    string;
  abertoEm?:      string;
  aberto_em?:     string;
  fechadoPor?:    string;
  fechado_por?:   string;
  fechadoEm?:     string;
  fechado_em?:    string;
  valorAbertura?: number;
  valor_abertura?: number;
  valorContado?:  number;
  valor_contado?: number;
  observacoes?:   string;
}

export interface RelatorioCaixa {
  caixa:              Caixa & { id: string };
  pedidos:            Pedido[];
  totalVendas:        number;
  total_vendas?:      number;
  totalPedidos:       number;
  total_pedidos?:     number;
  porFormaPagamento:  Record<FormaPagamento, number>;
  saldoEsperado:      number;
  saldo_esperado?:    number;
  diferenca?:         number;
  sangria?:           number;
  suprimento?:        number;
  totalDesconto?:     number;
  totalAcrescimo?:    number;
}

export interface MovimentacaoCaixa {
  id:           string;
  caixa_id:     string;
  pedido_id?:   string;
  mesa_numero?: number;
  tipo:         'venda' | 'abertura_caixa' | 'fechamento_caixa' | 'sangria' | 'suprimento';
  valor:        number;
  descricao?:   string;
  operador?:    string;
  criado_em:    string;
}

export interface DashboardStats {
  totalMesas:        number;
  mesasOcupadas:     number;
  mesasLivres:       number;
  totalVendidoHoje:  number;
  totalPedidosHoje:  number;
}
