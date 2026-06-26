import { useState, useEffect, useCallback } from 'react';
import { LayoutGrid, ShoppingBag, UtensilsCrossed, Settings, Wallet, BarChart2, AlertCircle, Loader2 } from 'lucide-react';
import { useApp } from './hooks/useApp';
import { Dashboard } from './pages/Dashboard';
import { Mesas } from './pages/Mesas';
import { Produtos } from './pages/Produtos';
import { PedidoModal } from './pages/PedidoModal';
import { Configuracoes } from './pages/Configuracoes';
import { Caixa } from './pages/Caixa';
import { Relatorios } from './pages/Relatorios';
import { PedidoService } from './services/storage';
import type { Mesa, Pedido } from './types';

type Page = 'dashboard' | 'caixa' | 'mesas' | 'produtos' | 'relatorios' | 'config';

const NAV: { id: Page; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard',  label: 'Dashboard',  icon: LayoutGrid },
  { id: 'caixa',      label: 'Caixa',      icon: Wallet },
  { id: 'mesas',      label: 'Mesas',      icon: UtensilsCrossed },
  { id: 'produtos',   label: 'Produtos',   icon: ShoppingBag },
  { id: 'relatorios', label: 'Relatórios', icon: BarChart2 },
  { id: 'config',     label: 'Config',     icon: Settings },
];

// Notificação toast simples para erros de operação
function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 5000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50
      bg-red-600 text-white text-sm font-medium px-4 py-3 rounded-xl shadow-2xl
      flex items-center gap-2 max-w-sm w-full mx-4 animate-in fade-in slide-in-from-bottom-4">
      <AlertCircle size={16} className="shrink-0" />
      <span>{msg}</span>
      <button onClick={onClose} className="ml-auto text-white/70 hover:text-white text-lg leading-none">×</button>
    </div>
  );
}

export default function App() {
  const [page, setPage]                   = useState<Page>('caixa');
  const [mesaSelecionada, setMesaSelecionada] = useState<Mesa | null>(null);
  const [pedidoAberto, setPedidoAberto]   = useState<Pedido | null>(null);
  const [modalFechado, setModalFechado]   = useState(0);
  const [toastMsg, setToastMsg]           = useState<string | null>(null);

  const showError = useCallback((msg: string) => setToastMsg(msg), []);

  const {
    mesas, produtos, pedidos, config, stats, loading, erro, carregarTudo,
    abrirMesa, cancelarMesa,
    adicionarItem, alterarQuantidade, removerItem, editarObservacao,
    fecharConta, salvarProduto, excluirProduto, inativarProduto, reativarProduto,
    salvarConfig, caixaAtual, abrirCaixa, fecharCaixa, gerarRelatorioCaixa,
  } = useApp();

  const fecharModal = useCallback(() => {
    setPedidoAberto(null);
    setMesaSelecionada(null);
    setModalFechado((n) => n + 1);
  }, []);

  // Recarrega pedido atual da API após qualquer operação
  const recarregarPedido = useCallback(async (mesaId: string) => {
    try {
      const atualizado = await PedidoService.getPorMesa(mesaId);
      setPedidoAberto(atualizado);
    } catch {
      // silencioso — pedido pode ter sido fechado
    }
  }, []);

  const handleAbrirMesa = useCallback(async (mesaId: string) => {
    try {
      const pedido = await abrirMesa(mesaId);
      const mesa = mesas.find((m) => m.id === mesaId);
      if (mesa) {
        setMesaSelecionada({ ...mesa, status: 'ocupada', pedidoAtualId: pedido.id });
        setPedidoAberto(pedido);
      }
    } catch (e: any) {
      showError(`Erro ao abrir mesa: ${e.message}`);
    }
  }, [abrirMesa, mesas, showError]);

  const handleSelecionarMesa = useCallback(async (mesa: Mesa) => {
    try {
      const pedido = await PedidoService.getPorMesa(mesa.id);
      setMesaSelecionada(mesa);
      setPedidoAberto(pedido);
    } catch (e: any) {
      showError(`Erro ao carregar pedido: ${e.message}`);
    }
  }, [showError]);

  const handleCancelarMesa = useCallback(async (mesaId: string) => {
    try {
      await cancelarMesa(mesaId);
      fecharModal();
    } catch (e: any) {
      showError(`Erro ao cancelar mesa: ${e.message}`);
    }
  }, [cancelarMesa, fecharModal, showError]);

  const handleAdicionarItem = useCallback(async (_: string, produto: any, obs = '') => {
    if (!pedidoAberto || !mesaSelecionada) return;
    try {
      await adicionarItem(pedidoAberto.id, produto, obs);
      await recarregarPedido(mesaSelecionada.id);
    } catch (e: any) {
      showError(`Erro ao adicionar item: ${e.message}`);
    }
  }, [pedidoAberto, mesaSelecionada, adicionarItem, recarregarPedido, showError]);

  const handleAlterarQuantidade = useCallback(async (pedidoId: string, itemId: string, delta: number) => {
    if (!mesaSelecionada) return;
    const item = pedidoAberto?.itens?.find((i) => i.id === itemId);
    if (!item) return;
    try {
      await alterarQuantidade(pedidoId, itemId, delta, item.quantidade);
      await recarregarPedido(mesaSelecionada.id);
    } catch (e: any) {
      showError(`Erro ao alterar quantidade: ${e.message}`);
    }
  }, [pedidoAberto, mesaSelecionada, alterarQuantidade, recarregarPedido, showError]);

  const handleRemoverItem = useCallback(async (pedidoId: string, itemId: string) => {
    if (!mesaSelecionada) return;
    try {
      await removerItem(pedidoId, itemId);
      await recarregarPedido(mesaSelecionada.id);
    } catch (e: any) {
      showError(`Erro ao remover item: ${e.message}`);
    }
  }, [mesaSelecionada, removerItem, recarregarPedido, showError]);

  const handleEditarObservacao = useCallback(async (pedidoId: string, itemId: string, obs: string) => {
    if (!mesaSelecionada) return;
    try {
      await editarObservacao(pedidoId, itemId, obs);
      await recarregarPedido(mesaSelecionada.id);
    } catch (e: any) {
      showError(`Erro ao salvar observação: ${e.message}`);
    }
  }, [mesaSelecionada, editarObservacao, recarregarPedido, showError]);

  const handleFecharConta = useCallback(async (pedidoId: string, mesaId: string, forma: any, valorRecebido: number) => {
    try {
      const fechado = await fecharConta(pedidoId, mesaId, forma, valorRecebido);
      fecharModal();
      return fechado;
    } catch (e: any) {
      showError(`Erro ao fechar conta: ${e.message}`);
      return undefined as any;
    }
  }, [fecharConta, fecharModal, showError]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
      <div className="text-center space-y-4">
        <Loader2 size={40} className="animate-spin text-accent-500 mx-auto" />
        <p className="text-primary-600 font-medium">Conectando ao servidor...</p>
      </div>
    </div>
  );

  if (erro) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 p-6">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center space-y-4">
        <AlertCircle size={48} className="text-red-400 mx-auto" />
        <h2 className="text-xl font-bold text-primary-900">Sem conexão com o servidor</h2>
        <p className="text-primary-500 text-sm">{erro}</p>
        <p className="text-xs text-primary-400 bg-primary-50 rounded-xl p-3">
          Verifique se o backend está rodando:<br />
          <code className="font-mono text-accent-600">cd backend && npm run dev</code>
        </p>
        <button onClick={carregarTudo}
          className="w-full bg-accent-500 hover:bg-accent-600 text-white font-semibold py-2.5 rounded-xl transition-colors">
          Tentar novamente
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex flex-col w-56 bg-white border-r border-primary-200 shadow-lg fixed h-full z-10">
        <div className="p-5 border-b border-primary-200 bg-gradient-to-r from-primary-50 to-primary-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-accent-500 to-accent-600 rounded-lg flex items-center justify-center shadow-md">
              <UtensilsCrossed size={20} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-primary-900 text-sm leading-tight">{config.nomeEstabelecimento}</p>
              <p className="text-xs text-primary-500">Gerenciamento de Mesas</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setPage(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all
                ${page === id ? 'bg-gradient-to-r from-accent-500 to-accent-600 text-white shadow-md' : 'text-primary-700 hover:bg-primary-100'}`}>
              <Icon size={17} />{label}
              {id === 'caixa' && (
                <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-full font-medium
                  ${page === id ? 'bg-white/25 text-white' : caixaAtual ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                  {caixaAtual ? 'Aberto' : 'Fechado'}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-primary-200 bg-primary-50/50">
          <div className="flex justify-between text-xs text-primary-700 mb-2 font-semibold">
            <span>Ocupação</span><span>{stats.mesasOcupadas}/{stats.totalMesas}</span>
          </div>
          <div className="w-full bg-primary-300 rounded-full h-2.5">
            <div className="h-2.5 bg-gradient-to-r from-accent-500 to-accent-600 rounded-full transition-all shadow-md"
              style={{ width: `${stats.totalMesas ? (stats.mesasOcupadas / stats.totalMesas) * 100 : 0}%` }} />
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col md:ml-56">
        <header className="md:hidden bg-white border-b border-primary-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
          <div className="w-8 h-8 shrink-0 bg-gradient-to-br from-accent-500 to-accent-600 rounded-lg flex items-center justify-center">
            <UtensilsCrossed size={17} className="text-white" />
          </div>
          <span className="font-bold text-primary-900 text-sm truncate min-w-0 flex-1">{config.nomeEstabelecimento}</span>
          <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium
            ${caixaAtual ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
            {caixaAtual ? '🟢' : '🔒'} Caixa
          </span>
          {/* Config não está no menu inferior do celular — atalho aqui no topo */}
          <button
            onClick={() => setPage('config')}
            aria-label="Configurações"
            className={`shrink-0 p-1.5 rounded-lg transition-colors
              ${page === 'config' ? 'bg-accent-100 text-accent-600' : 'text-primary-400 hover:bg-primary-100'}`}
          >
            <Settings size={18} />
          </button>
        </header>

        <main className="flex-1 p-4 md:p-6 max-w-6xl w-full mx-auto pb-24 md:pb-6">
          {page === 'dashboard' && <Dashboard stats={stats} pedidosHoje={pedidos} />}
          {page === 'caixa' && (
            <Caixa caixaAtual={caixaAtual ?? undefined} onAbrirCaixa={abrirCaixa}
              onFecharCaixa={fecharCaixa} gerarRelatorio={gerarRelatorioCaixa} />
          )}
          {page === 'mesas' && (
            <Mesas mesas={mesas} pedidos={pedidos}
              caixaAberto={!!caixaAtual}
              onAbrirMesa={handleAbrirMesa}
              onSelecionarMesa={handleSelecionarMesa}
              onCancelarMesa={handleCancelarMesa}
              onIrParaCaixa={() => setPage('caixa')}
              modalFechado={modalFechado} />
          )}
          {page === 'produtos' && (
            <Produtos produtos={produtos} onSalvar={salvarProduto}
              onInativar={inativarProduto} onReativar={reativarProduto}
              onExcluir={excluirProduto} />
          )}
          {page === 'relatorios' && (
            <Relatorios gerarRelatorio={gerarRelatorioCaixa}
              nomeEstabelecimento={config.nomeEstabelecimento} />
          )}
          {page === 'config' && <Configuracoes config={config} onSalvar={salvarConfig} />}
        </main>

        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-primary-200 flex z-10 shadow-2xl">
          {NAV.filter((n) => n.id !== 'config').map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setPage(id)}
              className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 text-xs font-semibold transition-colors relative
                ${page === id ? 'text-accent-600' : 'text-primary-400'}`}>
              <Icon size={18} />
              <span className="text-[10px]">{label}</span>
              {id === 'caixa' && !caixaAtual && (
                <span className="absolute top-1 right-2 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {mesaSelecionada && pedidoAberto && (
        <PedidoModal
          mesa={mesas.find((m) => m.id === mesaSelecionada.id) ?? mesaSelecionada}
          pedido={pedidoAberto}
          produtos={produtos}
          onClose={fecharModal}
          onCancelarMesa={handleCancelarMesa}
          onAdicionarItem={handleAdicionarItem}
          onAlterarQuantidade={handleAlterarQuantidade}
          onRemoverItem={handleRemoverItem}
          onEditarObservacao={handleEditarObservacao}
          onFecharConta={handleFecharConta}
          config={config}
        />
      )}

      {toastMsg && <Toast msg={toastMsg} onClose={() => setToastMsg(null)} />}
      <div id="print-area" />
    </div>
  );
}
