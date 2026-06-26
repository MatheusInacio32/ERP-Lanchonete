import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Plus, Minus, Trash2, Search, MessageSquare,
  ShoppingBag, UtensilsCrossed, CreditCard, X,
} from 'lucide-react';
import { Button, EmptyState, Modal } from '../components/ui';
import { QuickCodeInput } from '../components/QuickCodeInput';
import { formatMoeda, formatHora } from '../utils';
import type { Mesa, Produto, Pedido, Categoria, FormaPagamento } from '../types';
import { FechamentoConta } from './FechamentoConta';

const CATEGORIAS: Categoria[] = ['Lanches', 'Bebidas', 'Porcoes', 'Sobremesas', 'Outros'];

interface Props {
  mesa: Mesa | null;
  pedido: Pedido | null;
  produtos: Produto[];
  onClose: () => void;
  onCancelarMesa: (mesaId: string) => void;
  onAdicionarItem: (produtoId: string, produto: Produto, obs?: string) => void;
  onAlterarQuantidade: (pedidoId: string, itemId: string, delta: number) => void;
  onRemoverItem: (pedidoId: string, itemId: string) => void;
  onEditarObservacao: (pedidoId: string, itemId: string, obs: string) => void;
  onFecharConta: (pedidoId: string, mesaId: string, forma: FormaPagamento, valorRecebido: number) => Promise<Pedido | undefined>;
  config: { nomeEstabelecimento: string };
}

type Aba = 'lancamento' | 'cardapio' | 'fechar';

export function PedidoModal({
  mesa, pedido, produtos, onClose, onCancelarMesa,
  onAdicionarItem, onAlterarQuantidade, onRemoverItem, onEditarObservacao,
  onFecharConta, config,
}: Props) {
  const [aba, setAba] = useState<Aba>('lancamento');
  const [busca, setBusca] = useState('');
  const [catFiltro, setCatFiltro] = useState<string>('Todos');
  const [obsItemId, setObsItemId] = useState<string | null>(null);
  const [obsTexto, setObsTexto] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [pendingProduto, setPendingProduto] = useState<Produto | null>(null);
  const [obsTemp, setObsTemp] = useState('');

  // ESC fecha modal (cancela mesa vazia) ou limpa seleção
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (obsItemId) { setObsItemId(null); return; }
      if (pendingProduto) { setPendingProduto(null); return; }
      if (selectedItemIds.size > 0) { setSelectedItemIds(new Set()); return; }
      // Se mesa sem itens: cancela e libera
      if (pedido && pedido.itens.length === 0 && mesa) {
        onCancelarMesa(mesa.id);
        onClose();
        return;
      }
      onClose();
    }
    if ((e.key === 'Delete') && selectedItemIds.size > 0 && aba === 'lancamento') {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      e.preventDefault();
      if (!pedido) return;
      selectedItemIds.forEach((id) => onRemoverItem(pedido.id, id));
      setSelectedItemIds(new Set());
    }
  }, [obsItemId, pendingProduto, selectedItemIds, pedido, mesa, aba, onCancelarMesa, onClose, onRemoverItem]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => { setSelectedItemIds(new Set()); }, [aba]);

  if (!mesa || !pedido) return null;

  const produtosFiltrados = useMemo(() => {
    return produtos.filter((p) => {
      const matchBusca =
        p.nome.toLowerCase().includes(busca.toLowerCase()) ||
        p.codigo.includes(busca);
      const matchCat = catFiltro === 'Todos' || p.categoria === catFiltro;
      return p.ativo && matchBusca && matchCat;
    });
  }, [produtos, busca, catFiltro]);

  const handleQuickAdd = (produto: Produto, quantidade: number, obs: string) => {
    for (let i = 0; i < quantidade; i++) onAdicionarItem(pedido.id, produto, obs);
  };

  const salvarObs = () => {
    if (!obsItemId) return;
    onEditarObservacao(pedido.id, obsItemId, obsTexto);
    setObsItemId(null);
  };

  const confirmarAddCardapio = () => {
    if (!pendingProduto) return;
    onAdicionarItem(pedido.id, pendingProduto, obsTemp);
    setPendingProduto(null);
    setObsTemp('');
  };

  const toggleSelect = (itemId: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      next.has(itemId) ? next.delete(itemId) : next.add(itemId);
      return next;
    });
  };

  const totalItens = pedido.itens.reduce((s, i) => s + i.quantidade, 0);
  const hasSelection = selectedItemIds.size > 0;
  const mesaVazia = pedido.itens.length === 0;

  const TABS: { id: Aba; label: string; icon: React.ElementType }[] = [
    { id: 'lancamento', label: 'Lançamento', icon: ShoppingBag },
    { id: 'cardapio',   label: 'Cardápio',   icon: Search },
    { id: 'fechar',     label: 'Fechar Conta', icon: CreditCard },
  ];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-6">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => {
          if (mesaVazia) { onCancelarMesa(mesa.id); }
          onClose();
        }} />

        {/* Modal — extra-wide */}
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden">

          {/* ── Header ─────────────────────────────────────── */}
          <div className="bg-gradient-to-r from-primary-700 to-primary-800 px-6 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
              <div className="bg-white/10 rounded-xl px-4 py-2">
                <span className="text-4xl font-black text-white">{mesa.numero}</span>
              </div>
              <div>
                <p className="text-white font-bold text-lg">Mesa {mesa.numero}</p>
                <div className="flex items-center gap-3 text-primary-300 text-sm">
                  <span className="flex items-center gap-1">
                    <UtensilsCrossed size={13} />
                    {formatHora(mesa.abertaEm)}
                  </span>
                  <span>·</span>
                  <span>{totalItens} itens</span>
                  <span>·</span>
                  <span className="text-white font-bold text-base">{formatMoeda(pedido.total)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {mesaVazia && (
                <button
                  onClick={() => { onCancelarMesa(mesa.id); onClose(); }}
                  className="text-xs bg-white/10 hover:bg-white/20 text-primary-200 hover:text-white px-3 py-1.5 rounded-lg transition-colors font-medium"
                >
                  Cancelar mesa
                </button>
              )}
              <button
                onClick={onClose}
                className="text-primary-300 hover:text-white transition-colors p-1.5 hover:bg-white/10 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* ── Tabs ───────────────────────────────────────── */}
          <div className="flex border-b border-primary-100 bg-primary-50 shrink-0">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setAba(id)}
                className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-all
                  ${aba === id
                    ? 'text-accent-600 border-b-2 border-accent-500 bg-white'
                    : 'text-primary-500 hover:text-primary-700 hover:bg-primary-100'}`}
              >
                <Icon size={15} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {/* ── Corpo (2 colunas no desktop) ─────────────── */}
          <div className="flex flex-col md:flex-row flex-1 overflow-hidden">

            {/* ── COLUNA ESQUERDA: Itens do pedido (sempre visível) */}
            <div className="w-full md:w-72 lg:w-80 border-r border-primary-100 flex flex-col bg-white shrink-0">
              <div className="px-4 py-3 border-b border-primary-100 flex items-center justify-between">
                <span className="text-xs font-bold text-primary-500 uppercase tracking-wider">Pedido atual</span>
                {hasSelection && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-accent-600">{selectedItemIds.size} sel.</span>
                    <button
                      onClick={() => {
                        selectedItemIds.forEach((id) => onRemoverItem(pedido.id, id));
                        setSelectedItemIds(new Set());
                      }}
                      className="flex items-center gap-1 text-xs bg-red-500 text-white px-2 py-0.5 rounded-lg font-medium hover:bg-red-600"
                    >
                      <Trash2 size={10} /> Del
                    </button>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto">
                {pedido.itens.length === 0 ? (
                  <div className="flex items-center justify-center h-full py-8 text-primary-300">
                    <div className="text-center">
                      <ShoppingBag size={32} className="mx-auto mb-2 opacity-30" />
                      <p className="text-xs">Nenhum item</p>
                      <p className="text-xs mt-1 text-primary-200">ESC = cancelar mesa</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-2 space-y-1.5">
                    {!hasSelection && (
                      <p className="text-xs text-primary-300 px-1 pb-1 italic">Clique p/ selecionar · Delete p/ remover</p>
                    )}
                    {pedido.itens.map((item) => {
                      const sel = selectedItemIds.has(item.id);
                      return (
                        <div
                          key={item.id}
                          onClick={() => toggleSelect(item.id)}
                          className={`flex items-start gap-2 p-2.5 rounded-xl border-2 cursor-pointer transition-all select-none
                            ${sel
                              ? 'border-accent-400 bg-accent-50'
                              : 'border-transparent bg-primary-50 hover:border-primary-200'}`}
                        >
                          {/* Checkbox */}
                          <div className={`mt-0.5 w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 transition-all
                            ${sel ? 'border-accent-500 bg-accent-500' : 'border-primary-300 bg-white'}`}>
                            {sel && <svg width="7" height="7" viewBox="0 0 8 8"><path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          </div>

                          {/* Qty */}
                          <div
                            className="flex items-center gap-0.5 bg-white rounded-lg border border-primary-200 p-0.5 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button onClick={() => onAlterarQuantidade(pedido.id, item.id, -1)}
                              className="w-5 h-5 rounded hover:bg-primary-100 flex items-center justify-center text-primary-600">
                              <Minus size={9} />
                            </button>
                            <span className="text-xs font-bold w-3.5 text-center">{item.quantidade}</span>
                            <button onClick={() => onAlterarQuantidade(pedido.id, item.id, 1)}
                              className="w-5 h-5 rounded hover:bg-accent-100 flex items-center justify-center text-accent-600">
                              <Plus size={9} />
                            </button>
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-primary-900 truncate">{item.nomeProduto}</p>
                            {item.observacao && (
                              <p className="text-xs text-accent-500 truncate">↳ {item.observacao}</p>
                            )}
                          </div>

                          {/* Valor + obs */}
                          <div className="text-right shrink-0" onClick={(e) => e.stopPropagation()}>
                            <p className="text-xs font-bold text-accent-600">{formatMoeda(item.subtotal)}</p>
                            <button
                              onClick={() => { setObsItemId(item.id); setObsTexto(item.observacao); }}
                              className="text-primary-300 hover:text-accent-500 mt-0.5"
                              title="Observação"
                            >
                              <MessageSquare size={11} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Rodapé com total */}
              {pedido.itens.length > 0 && (
                <div className="px-4 py-3 border-t border-primary-100 bg-primary-50 flex justify-between items-center shrink-0">
                  <span className="text-xs font-bold text-primary-600 uppercase tracking-wider">Total</span>
                  <span className="text-xl font-black text-accent-600">{formatMoeda(pedido.total)}</span>
                </div>
              )}
            </div>

            {/* ── COLUNA DIREITA: Conteúdo das abas ────────── */}
            <div className="flex-1 overflow-y-auto">

              {/* LANÇAMENTO (código + foco automático) */}
              {aba === 'lancamento' && (
                <div className="p-5">
                  <QuickCodeInput
                    produtos={produtos}
                    onAdicionar={handleQuickAdd}
                    autoFocus={true}
                  />
                </div>
              )}

              {/* CARDÁPIO */}
              {aba === 'cardapio' && (
                <div className="p-5 space-y-3">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-400" />
                    <input
                      autoFocus
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Buscar por nome ou código..."
                      className="w-full pl-9 pr-3 py-2 border border-primary-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-400 bg-primary-50"
                    />
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {['Todos', ...CATEGORIAS].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setCatFiltro(cat)}
                        className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors whitespace-nowrap
                          ${catFiltro === cat
                            ? 'bg-accent-500 text-white'
                            : 'bg-primary-100 text-primary-600 hover:bg-primary-200'}`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {produtosFiltrados.length === 0 && (
                      <EmptyState message="Nenhum produto encontrado" />
                    )}
                    {produtosFiltrados.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => { setPendingProduto(p); setObsTemp(''); }}
                        className="w-full flex items-center justify-between py-3 px-4 rounded-xl bg-primary-50 hover:bg-accent-50 border border-primary-100 hover:border-accent-200 transition-all group text-left"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs bg-primary-200 text-primary-600 px-1.5 py-0.5 rounded font-mono font-bold">{p.codigo}</span>
                            <p className="text-sm font-semibold text-primary-900 group-hover:text-accent-700">{p.nome}</p>
                          </div>
                          <p className="text-xs text-primary-500 mt-0.5">{p.categoria}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-bold text-accent-600">{formatMoeda(p.preco)}</span>
                          <Plus size={16} className="text-accent-500" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* FECHAR CONTA */}
              {aba === 'fechar' && (
                <FechamentoConta
                  pedido={pedido}
                  mesa={mesa}
                  config={config}
                  onFechar={async (forma, valor) => {
                    // App.tsx já chama fecharModal() internamente ao fechar com sucesso
                    await onFecharConta(pedido.id, mesa.id, forma, valor);
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de observação */}
      <Modal open={obsItemId !== null} onClose={() => setObsItemId(null)} title="Observação do item" size="sm">
        <div className="space-y-4">
          <textarea
            autoFocus
            value={obsTexto}
            onChange={(e) => setObsTexto(e.target.value)}
            placeholder="Ex: Sem cebola, bem passado..."
            rows={3}
            className="w-full border border-primary-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-400 resize-none"
            onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) salvarObs(); }}
          />
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setObsItemId(null)}>Cancelar</Button>
            <Button className="flex-1" onClick={salvarObs}>Salvar</Button>
          </div>
        </div>
      </Modal>

      {/* Modal add cardápio com obs */}
      {pendingProduto && (
        <Modal open onClose={() => setPendingProduto(null)} title={pendingProduto.nome} size="sm">
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-accent-50 rounded-xl p-3 border border-accent-200">
              <span className="text-xs text-primary-500">{pendingProduto.categoria}</span>
              <span className="text-xl font-black text-accent-600">{formatMoeda(pendingProduto.preco)}</span>
            </div>
            <div>
              <label className="text-sm font-medium text-primary-700 block mb-1.5">Observação (opcional)</label>
              <textarea
                autoFocus
                value={obsTemp}
                onChange={(e) => setObsTemp(e.target.value)}
                placeholder="Ex: Sem cebola, bacon extra..."
                rows={2}
                className="w-full border border-primary-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-400 resize-none"
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); confirmarAddCardapio(); } }}
              />
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setPendingProduto(null)}>Cancelar</Button>
              <Button className="flex-1" onClick={confirmarAddCardapio}>
                <Plus size={14} /> Adicionar
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
