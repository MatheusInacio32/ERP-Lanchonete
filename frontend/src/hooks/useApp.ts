import { useState, useCallback, useEffect, useMemo } from 'react';
import type {
  Mesa, Produto, Pedido, Configuracoes,
  FormaPagamento, DashboardStats, Caixa, RelatorioCaixa,
} from '../types';
import {
  MesaService, ProdutoService, PedidoService,
  ConfigService, CaixaService, RelatorioApiService,
} from '../services/storage';
import { setTema, getTema, type CorTema } from '../services/theme';

// ── Estado de loading global ──────────────────────────────────
export interface AppState {
  mesas: Mesa[];
  produtos: Produto[];
  pedidos: Pedido[];       // pedidos do dia (fechados)
  config: Configuracoes;
  caixaAtual: Caixa | null;
  stats: DashboardStats;
  loading: boolean;
  erro: string | null;
}

const CONFIG_DEFAULT: Configuracoes = {
  nomeEstabelecimento: 'Minha Lanchonete',
  totalMesas: 10,
};

// Normaliza a config vinda da API (snake_case) para o formato do frontend (camelCase)
function normalizarConfig(raw: any): Configuracoes {
  return {
    nomeEstabelecimento: raw?.nome_estabelecimento ?? raw?.nomeEstabelecimento ?? 'Minha Lanchonete',
    totalMesas:          Number(raw?.total_mesas ?? raw?.totalMesas ?? 10),
    telefone:            raw?.telefone,
    endereco:            raw?.endereco,
    corTema:             raw?.cor_tema ?? raw?.corTema ?? 'azul',
  };
}

export function useApp() {
  const [mesas,      setMesas]      = useState<Mesa[]>([]);
  const [produtos,   setProdutos]   = useState<Produto[]>([]);
  const [pedidosHoje, setPedidosHoje] = useState<Pedido[]>([]);
  const [config,     setConfig]     = useState<Configuracoes>(CONFIG_DEFAULT);
  const [caixaAtual, setCaixaAtual] = useState<Caixa | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [erro,       setErro]       = useState<string | null>(null);

  // ── Stats derivadas ──────────────────────────────────────────
  const stats = useMemo((): DashboardStats => ({
    totalMesas:       mesas.length,
    mesasOcupadas:    mesas.filter((m) => m.status === 'ocupada').length,
    mesasLivres:      mesas.filter((m) => m.status === 'livre').length,
    totalVendidoHoje: pedidosHoje.reduce((s, p) => s + Number(p.total), 0),
    totalPedidosHoje: pedidosHoje.length,
  }), [mesas, pedidosHoje]);

  // ── Carregar tudo na inicialização ───────────────────────────
  const carregarTudo = useCallback(async () => {
    try {
      setLoading(true);
      setErro(null);
      const [mesasData, produtosData, configRaw, caixaData, pedidosData] = await Promise.all([
        MesaService.getAll(),
        ProdutoService.getAll(),
        ConfigService.get(),
        CaixaService.getAtual(),
        PedidoService.getHoje(),
      ]);
      // Normaliza config e aplica a cor (fonte de verdade = banco)
      const configData = normalizarConfig(configRaw);
      setTema((configData.corTema ?? 'azul') as CorTema);
      setMesas(mesasData);
      setProdutos(produtosData);
      setConfig(configData);
      setCaixaAtual(caixaData);
      setPedidosHoje(pedidosData);
    } catch (e: any) {
      setErro(e.message ?? 'Erro ao conectar com o servidor');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregarTudo(); }, [carregarTudo]);

  // ── Sincronização em tempo real (polling) ────────────────────
  // Mantém TODAS as telas atualizadas entre dispositivos (PC ↔ celular na
  // rede local): mesas, caixa, pedidos, produtos e configurações (incl. cor).
  // Re-busca a cada 4s; pausa quando a aba está em segundo plano e
  // sincroniza na hora ao voltar para a aba.
  useEffect(() => {
    if (loading) return;
    let ativo = true;

    const sincronizar = async () => {
      if (!ativo || document.hidden) return;
      try {
        const [m, c, p, pr, cfgRaw] = await Promise.all([
          MesaService.getAll(),
          CaixaService.getAtual(),
          PedidoService.getHoje(),
          ProdutoService.getAll(),
          ConfigService.get(),
        ]);
        if (!ativo) return;
        setMesas(m);
        setCaixaAtual(c);
        setPedidosHoje(p);
        setProdutos(pr);

        // Config + cor em tempo real
        const cfg = normalizarConfig(cfgRaw);
        // Aplica a cor só se mudou (evita escrita desnecessária no localStorage)
        if (cfg.corTema && cfg.corTema !== getTema()) {
          setTema(cfg.corTema as CorTema);
        }
        // Atualiza o estado da config só se realmente mudou — assim não
        // sobrescreve o formulário de Configurações enquanto o usuário edita.
        setConfig((prev) => (JSON.stringify(prev) === JSON.stringify(cfg) ? prev : cfg));

        setErro(null);
      } catch { /* falha transitória de rede — tenta de novo no próximo ciclo */ }
    };

    const intervalo = setInterval(sincronizar, 4000);
    const aoVoltar = () => { if (!document.hidden) sincronizar(); };
    document.addEventListener('visibilitychange', aoVoltar);

    return () => {
      ativo = false;
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [loading]);

  const refreshMesas    = useCallback(async () => setMesas(await MesaService.getAll()), []);
  const refreshProdutos = useCallback(async () => setProdutos(await ProdutoService.getAll()), []);
  const refreshPedidos  = useCallback(async () => setPedidosHoje(await PedidoService.getHoje()), []);

  // ── Mesas ─────────────────────────────────────────────────────
  const abrirMesa = useCallback(async (mesaId: string): Promise<Pedido> => {
    const pedido = await MesaService.abrir(mesaId);
    await refreshMesas();
    return pedido;
  }, [refreshMesas]);

  const cancelarMesa = useCallback(async (mesaId: string) => {
    await MesaService.cancelar(mesaId);
    await refreshMesas();
  }, [refreshMesas]);

  // ── Itens do pedido ───────────────────────────────────────────
  const adicionarItem = useCallback(async (
    pedidoId: string, produto: Produto, obs = ''
  ): Promise<void> => {
    await PedidoService.adicionarItem(pedidoId, produto.id, 1, obs);
  }, []);

  const alterarQuantidade = useCallback(async (
    pedidoId: string, itemId: string, delta: number, qtdAtual: number
  ): Promise<void> => {
    const nova = qtdAtual + delta;
    if (nova <= 0) {
      await PedidoService.removerItem(pedidoId, itemId);
    } else {
      await PedidoService.atualizarItem(pedidoId, itemId, nova);
    }
  }, []);

  const removerItem = useCallback(async (pedidoId: string, itemId: string) => {
    await PedidoService.removerItem(pedidoId, itemId);
  }, []);

  const editarObservacao = useCallback(async (
    pedidoId: string, itemId: string, obs: string
  ) => {
    await PedidoService.editarObservacao(pedidoId, itemId, obs);
  }, []);

  // ── Fechar conta ──────────────────────────────────────────────
  const fecharConta = useCallback(async (
    _pedidoId: string,
    mesaId: string,
    formaPagamento: FormaPagamento,
    valorRecebido: number
  ): Promise<Pedido> => {
    const pedido = await PedidoService.fecharConta(mesaId, formaPagamento, valorRecebido);
    await Promise.all([refreshMesas(), refreshPedidos()]);
    return pedido;
  }, [refreshMesas, refreshPedidos]);

  // ── Produtos ──────────────────────────────────────────────────
  const salvarProduto = useCallback(async (
    dados: Omit<Produto, 'id' | 'criadoEm' | 'ativo'> & { id?: string }
  ) => {
    if (dados.id) {
      await ProdutoService.atualizar(dados.id, dados);
    } else {
      await ProdutoService.criar(dados);
    }
    await refreshProdutos();
  }, [refreshProdutos]);

  const inativarProduto = useCallback(async (id: string) => {
    await ProdutoService.inativar(id);
    await refreshProdutos();
  }, [refreshProdutos]);

  const reativarProduto = useCallback(async (id: string) => {
    await ProdutoService.reativar(id);
    await refreshProdutos();
  }, [refreshProdutos]);

  const excluirProduto = useCallback(async (id: string) => {
    await ProdutoService.excluir(id);
    await refreshProdutos();
  }, [refreshProdutos]);

  // ── Configurações ─────────────────────────────────────────────
  const salvarConfig = useCallback(async (novaConfig: Configuracoes) => {
    const salvo: any = await ConfigService.salvar(novaConfig);
    // Normaliza snake_case → camelCase (a API retorna nome_estabelecimento)
    setConfig({
      nomeEstabelecimento: salvo.nome_estabelecimento ?? salvo.nomeEstabelecimento ?? novaConfig.nomeEstabelecimento,
      totalMesas:          Number(salvo.total_mesas ?? salvo.totalMesas ?? novaConfig.totalMesas),
      telefone:            salvo.telefone,
      endereco:            salvo.endereco,
    });
    await refreshMesas();
  }, [refreshMesas]);

  // ── Caixa ──────────────────────────────────────────────────────
  const abrirCaixa = useCallback(async (operador: string, valorAbertura: number): Promise<Caixa> => {
    const caixa = await CaixaService.abrir(operador, valorAbertura);
    setCaixaAtual(caixa);
    return caixa;
  }, []);

  const fecharCaixa = useCallback(async (
    operador: string, valorContado: number, observacoes?: string
  ): Promise<RelatorioCaixa | undefined> => {
    const rel = await CaixaService.fechar(operador, valorContado, observacoes);
    setCaixaAtual(null);
    await refreshPedidos();
    return rel;
  }, [refreshPedidos]);

  const gerarRelatorioCaixa = useCallback(async (
    caixaId?: string
  ): Promise<RelatorioCaixa | undefined> => {
    try {
      const id = caixaId ?? (caixaAtual as any)?.id;
      if (!id) return undefined;
      const raw: any = await CaixaService.getResumo(id);
      if (!raw) return undefined;

      // Normaliza snake_case → camelCase (vindo da view do banco)
      const caixa: Caixa = {
        id:             raw.id,
        status:         raw.status,
        abertoPor:      raw.aberto_por  ?? raw.abertoPor,
        abertoEm:       raw.aberto_em   ?? raw.abertoEm,
        fechadoPor:     raw.fechado_por ?? raw.fechadoPor,
        fechadoEm:      raw.fechado_em  ?? raw.fechadoEm,
        valorAbertura:  Number(raw.valor_abertura  ?? raw.valorAbertura  ?? 0),
        valorContado:   raw.valor_contado != null ? Number(raw.valor_contado) : undefined,
        observacoes:    raw.observacoes,
        // mantém snake também para compatibilidade
        aberto_por:     raw.aberto_por,
        aberto_em:      raw.aberto_em,
        fechado_por:    raw.fechado_por,
        fechado_em:     raw.fechado_em,
        valor_abertura: Number(raw.valor_abertura ?? 0),
        valor_contado:  raw.valor_contado != null ? Number(raw.valor_contado) : undefined,
      } as any;

      const porFormaPagamento = {
        dinheiro: Number(raw.total_dinheiro ?? 0),
        pix:      Number(raw.total_pix      ?? 0),
        debito:   Number(raw.total_debito   ?? 0),
        credito:  Number(raw.total_credito  ?? 0),
        voucher:  Number(raw.total_voucher  ?? 0),
        cartao:   Number(raw.total_cartao   ?? 0),
      } as Record<FormaPagamento, number>;

      const totalVendas   = Number(raw.total_vendas   ?? 0);
      const totalPedidos  = Number(raw.total_pedidos  ?? 0);
      const saldoEsperado = Number(raw.saldo_esperado ?? 0);
      const diferenca     = raw.diferenca != null ? Number(raw.diferenca) : undefined;

      // Busca pedidos do caixa via endpoint dedicado (evita bug de timezone)
      let pedidosDoCaixa: Pedido[] = [];
      try {
        const relatorio = await RelatorioApiService.caixa(id);
        pedidosDoCaixa = relatorio?.pedidos ?? [];
      } catch {}

      return { caixa, pedidos: pedidosDoCaixa, totalVendas, totalPedidos, porFormaPagamento, saldoEsperado, diferenca };
    } catch (e) {
      console.error('[useApp] gerarRelatorioCaixa erro:', e);
      return undefined;
    }
  }, [caixaAtual]);

  return {
    // Estado
    mesas, produtos, pedidos: pedidosHoje, config, caixaAtual, stats, loading, erro,
    // Refresh
    carregarTudo,
    // Mesa
    abrirMesa, cancelarMesa,
    // Itens
    adicionarItem, alterarQuantidade, removerItem, editarObservacao,
    // Fechamento
    fecharConta,
    // Produtos
    salvarProduto, inativarProduto, reativarProduto, excluirProduto,
    // Config
    salvarConfig,
    // Caixa
    abrirCaixa, fecharCaixa, gerarRelatorioCaixa,
  };
}
