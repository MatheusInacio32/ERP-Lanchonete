import { useState, useEffect, useCallback } from 'react';
import {
  Search, Printer, FileText, ChevronDown, ChevronUp,
  AlertCircle, CheckCircle2, Clock, UtensilsCrossed, BarChart2,
  Loader2, ShoppingCart, TrendingUp, Package, XCircle,
} from 'lucide-react';
import { Card, Button, Modal } from '../components/ui';
import { formatMoeda, formatDataHora, formatHora, localDate } from '../utils';
import type { RelatorioCaixa, FormaPagamento } from '../types';
import { CaixaService, PedidoService, RelatorioApiService } from '../services/storage';
import jsPDF from 'jspdf';

const FORMAS_LABEL: Record<FormaPagamento, string> = {
  dinheiro: 'Dinheiro', pix: 'PIX', debito: 'Débito', credito: 'Crédito', voucher: 'Voucher', cartao: 'Cartão',
};
const FORMAS_ICON: Record<FormaPagamento, string> = {
  dinheiro: '💵', pix: '📱', debito: '💳', credito: '💎', voucher: '🎫', cartao: '💳',
};

const g = {
  abertoEm:    (c: any): string => c.aberto_em    ?? c.abertoEm    ?? '',
  fechadoEm:   (c: any): string => c.fechado_em   ?? c.fechadoEm   ?? '',
  abertoPor:   (c: any): string => c.aberto_por   ?? c.abertoPor   ?? '',
  fechadoPor:  (c: any): string => c.fechado_por  ?? c.fechadoPor  ?? '',
  valorAb:     (c: any): number => Number(c.valor_abertura  ?? c.valorAbertura  ?? 0),
  valorCon:    (c: any): number => Number(c.valor_contado   ?? c.valorContado   ?? 0),
  totalVendas: (c: any): number => Number(c.total_vendas    ?? c.totalVendas    ?? 0),
  totalPed:    (c: any): number => Number(c.total_pedidos   ?? c.totalPedidos   ?? 0),
  mesaId:      (p: any): string => String(p.mesa_numero ?? (p.mesa_id ?? p.mesaId ?? '')),
  pedFechado:  (p: any): string => p.fechado_em ?? p.fechadoEm ?? '',
  pedCriado:   (p: any): string => p.criado_em  ?? p.criadoEm  ?? '',
  pedForma:    (p: any): FormaPagamento | undefined => p.forma_pagamento ?? p.formaPagamento,
};

interface Props {
  gerarRelatorio: (caixaId?: string) => Promise<RelatorioCaixa | undefined>;
  nomeEstabelecimento: string;
}

type Aba = 'caixa' | 'mesas' | 'producao';

// ── Componente principal ──────────────────────────────────────
export function Relatorios({ gerarRelatorio, nomeEstabelecimento }: Props) {
  const [aba, setAba]       = useState<Aba>('caixa');
  const [data, setData]     = useState(() => localDate());
  const [caixas, setCaixas] = useState<any[]>([]);
  const [grupos, setGrupos] = useState<{ caixa: any; pedidos: any[] }[]>([]);
  const [totalMesas, setTotalMesas] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [relSelecionado, setRelSelecionado] = useState<RelatorioCaixa | null>(null);
  const [pedExpandido, setPedExpandido]     = useState(false);
  const [pedDetalhe, setPedDetalhe]         = useState<any | null>(null);

  const carregar = useCallback(async () => {
    if (!data) return;
    setCarregando(true);
    setRelSelecionado(null);
    try {
      const caixasData = await CaixaService.getPorData(data);
      const caixasOrdenados = [...caixasData].sort(
        (a, b) => new Date(g.abertoEm(a)).getTime() - new Date(g.abertoEm(b)).getTime()
      );
      setCaixas(caixasOrdenados);

      if (caixasOrdenados.length === 0) {
        // Sem caixa nessa data: cai no fallback por data (pedidos avulsos)
        const pedidosData = await PedidoService.getPorData(data);
        const pedFechados = pedidosData.filter((p: any) => p.status === 'fechado');
        setGrupos(pedFechados.length ? [{ caixa: null, pedidos: pedFechados }] : []);
        setTotalMesas(pedFechados.length);
        return;
      }

      // Para cada caixa, busca TODOS os seus pedidos pelo caixa_id (não pela data).
      // Assim um caixa multi-dia mostra todas as mesas juntas, em qualquer dia da janela.
      const grupos = await Promise.all(
        caixasOrdenados.map(async (caixa) => {
          const rel = await RelatorioApiService.caixa(caixa.id).catch(() => null);
          const pedidos = (rel?.pedidos ?? [])
            .filter((p: any) => p.status === 'fechado')
            .sort((a: any, b: any) =>
              new Date(g.pedFechado(a)).getTime() - new Date(g.pedFechado(b)).getTime()
            );
          return { caixa, pedidos };
        })
      );
      const comMovimento = grupos.filter((gr) => gr.pedidos.length > 0);
      setGrupos(comMovimento);
      setTotalMesas(comMovimento.reduce((s, gr) => s + gr.pedidos.length, 0));
    } catch (e) {
      console.error(e);
    } finally {
      setCarregando(false);
    }
  }, [data]);

  useEffect(() => { carregar(); }, [carregar]);

  const handleSelecionar = async (caixaId: string) => {
    const rel = await gerarRelatorio(caixaId);
    setRelSelecionado(rel ?? null);
    setPedExpandido(false);
  };

  const handleImprimir = () => {
    if (!relSelecionado) return;
    const area = document.getElementById('print-area');
    if (area) { area.innerHTML = buildHtmlRelatorio(relSelecionado); window.print(); }
  };
  const handlePDF = () => { if (relSelecionado) gerarPDFCaixa(relSelecionado); };
  const handleJSON = async () => {
    if (!relSelecionado) return;
    const blob = new Blob([JSON.stringify(relSelecionado, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `relatorio-caixa-${g.abertoEm(relSelecionado.caixa).slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };
  const imprimirPedido = (pedido: any) => {
    const area = document.getElementById('print-area');
    if (area) { area.innerHTML = buildHtmlPedido(pedido, nomeEstabelecimento); window.print(); }
  };

  const dataLabel = data
    ? new Date(data + 'T12:00:00').toLocaleDateString('pt-BR', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
      })
    : '';

  const rel = relSelecionado;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900">Relatórios</h1>
        <p className="text-sm text-primary-500 mt-1">Consulte caixas, histórico e auditoria de vendas</p>
      </div>

      {/* Filtro de data */}
      <Card className="p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-primary-500 font-medium block mb-1">Data</label>
            <input
              type="date" value={data}
              onChange={(e) => setData(e.target.value)}
              className="border border-primary-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-400 bg-white"
            />
          </div>
          {['Hoje', 'Ontem'].map((label, i) => (
            <button key={label}
              onClick={() => setData(localDate(-i))}
              className="px-3 py-2.5 text-xs bg-primary-100 hover:bg-accent-100 hover:text-accent-700 rounded-xl font-medium transition-colors border border-primary-200">
              {label}
            </button>
          ))}
          {data && <p className="text-sm text-primary-500 capitalize pb-0.5">{dataLabel}</p>}
          {carregando && <Loader2 size={16} className="animate-spin text-accent-500" />}
        </div>
      </Card>

      {/* Tabs — rolam horizontalmente no celular sem quebrar o layout */}
      <div className="flex border-b border-primary-200 overflow-x-auto scrollbar-hide">
        {[
          { id: 'caixa'    as Aba, label: 'Relatório de Caixa',  curto: 'Caixa',    icon: BarChart2,       count: caixas.length },
          { id: 'mesas'    as Aba, label: 'Histórico de Mesas',  curto: 'Mesas',    icon: UtensilsCrossed, count: totalMesas },
          { id: 'producao' as Aba, label: 'Auditoria de Vendas', curto: 'Vendas',   icon: ShoppingCart,    count: null },
        ].map(({ id, label, curto, icon: Icon, count }) => (
          <button key={id} onClick={() => setAba(id)}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 text-sm font-semibold transition-colors border-b-2 shrink-0 whitespace-nowrap
              ${aba === id
                ? 'border-accent-500 text-accent-600 bg-white'
                : 'border-transparent text-primary-500 hover:text-primary-700'}`}>
            <Icon size={15} className="shrink-0" />
            {/* nome completo no desktop, curto no celular */}
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{curto}</span>
            {count !== null && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold
                ${aba === id ? 'bg-accent-100 text-accent-600' : 'bg-primary-100 text-primary-500'}`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── ABA: CAIXA */}
      {aba === 'caixa' && (
        <>
          <Card className="p-5">
            {carregando ? (
              <div className="text-center py-8 text-primary-400">
                <Loader2 size={24} className="animate-spin mx-auto mb-2" /><p className="text-sm">Carregando...</p>
              </div>
            ) : caixas.length === 0 ? (
              <div className="text-center py-8 text-primary-400">
                <Search size={28} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">Nenhum caixa encontrado nesta data</p>
              </div>
            ) : (
              <div className="space-y-2">
                {caixas.map((c) => {
                  const isSelected = rel?.caixa?.id === c.id;
                  return (
                    <button key={c.id} onClick={() => handleSelecionar(c.id)}
                      className={`w-full text-left rounded-xl p-4 border-2 transition-all
                        ${isSelected
                          ? 'border-accent-400 bg-accent-50 shadow-md'
                          : 'border-primary-100 bg-white hover:border-primary-300 hover:bg-primary-50'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full
                            ${c.status === 'aberto' ? 'bg-green-100 text-green-700' : 'bg-primary-100 text-primary-600'}`}>
                            {c.status === 'aberto' ? '🟢 Aberto' : '🔒 Fechado'}
                          </span>
                          <p className="text-xs text-primary-500 mt-1.5 flex items-center gap-1">
                            <Clock size={10} />
                            {formatDataHora(g.abertoEm(c))}
                            {g.fechadoEm(c) && <><span>→</span>{formatDataHora(g.fechadoEm(c))}</>}
                          </p>
                          <p className="text-xs text-primary-400 mt-0.5">
                            {g.abertoPor(c)}{g.fechadoPor(c) && ` → ${g.fechadoPor(c)}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-black text-accent-600">{formatMoeda(g.totalVendas(c))}</p>
                          <p className="text-xs text-primary-400">{g.totalPed(c)} pedidos</p>
                        </div>
                      </div>
                      {c.status === 'fechado' && c.valor_contado != null && (
                        <div className={`mt-2 inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium
                          ${Math.abs(Number(c.diferenca ?? 0)) < 0.01
                            ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {Math.abs(Number(c.diferenca ?? 0)) < 0.01
                            ? <><CheckCircle2 size={11} /> Conferido</>
                            : <><AlertCircle size={11} /> Dif: {Number(c.diferenca ?? 0) >= 0 ? '+' : ''}{formatMoeda(Number(c.diferenca ?? 0))}</>}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          {rel && (
            <Card className="p-0 overflow-hidden">
              <div className="px-5 py-4 bg-gradient-to-r from-primary-50 to-primary-100 border-b border-primary-200 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="font-bold text-primary-900">
                    {rel.caixa.status === 'fechado' ? 'Relatório de Fechamento' : 'Relatório Parcial'}
                  </h2>
                  <p className="text-xs text-primary-400 mt-0.5">{formatDataHora(g.abertoEm(rel.caixa))}</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button variant="secondary" size="sm" onClick={handleImprimir}><Printer size={13} /> Imprimir</Button>
                  {rel.caixa.status === 'fechado' && (
                    <>
                      <Button size="sm" onClick={handlePDF}><FileText size={13} /> PDF</Button>
                      <Button variant="secondary" size="sm" onClick={handleJSON}><FileText size={13} /> JSON</Button>
                    </>
                  )}
                </div>
              </div>
              <div className="p-5 space-y-4">
                {rel.caixa.status === 'aberto' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2 text-amber-700 text-sm">
                    <AlertCircle size={14} />
                    <span>Relatório <strong>parcial</strong> — caixa ainda em aberto.</span>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-primary-50 rounded-xl p-3 text-sm space-y-1">
                    <p className="text-xs text-primary-400 font-semibold uppercase tracking-wide">Abertura</p>
                    <p className="text-primary-700">{formatDataHora(g.abertoEm(rel.caixa))}</p>
                    <p className="text-primary-600">Operador: <strong>{g.abertoPor(rel.caixa)}</strong></p>
                    <p className="text-primary-600">Troco inicial: <strong>{formatMoeda(g.valorAb(rel.caixa))}</strong></p>
                  </div>
                  {rel.caixa.status === 'fechado' && (
                    <div className="bg-primary-50 rounded-xl p-3 text-sm space-y-1">
                      <p className="text-xs text-primary-400 font-semibold uppercase tracking-wide">Fechamento</p>
                      <p className="text-primary-700">{formatDataHora(g.fechadoEm(rel.caixa))}</p>
                      <p className="text-primary-600">Operador: <strong>{g.fechadoPor(rel.caixa)}</strong></p>
                      <p className="text-primary-600">Valor contado: <strong>{formatMoeda(g.valorCon(rel.caixa))}</strong></p>
                    </div>
                  )}
                </div>
                <div className="border border-primary-100 rounded-xl overflow-hidden">
                  <div className="bg-primary-50 px-4 py-2 text-xs font-semibold text-primary-500 uppercase tracking-wide">Resumo Financeiro</div>
                  <div className="divide-y divide-primary-50">
                    <RowR label="Total de vendas" value={formatMoeda(rel.totalVendas)} bold accent />
                    <RowR label="Pedidos" value={String(rel.totalPedidos)} />
                    {(Object.keys(rel.porFormaPagamento) as FormaPagamento[]).map((f) =>
                      rel.porFormaPagamento[f] > 0
                        ? <RowR key={f} label={`${FORMAS_ICON[f]} ${FORMAS_LABEL[f]}`} value={formatMoeda(rel.porFormaPagamento[f])} indent />
                        : null
                    )}
                    <RowR label="Troco inicial" value={formatMoeda(g.valorAb(rel.caixa))} />
                    <RowR label="Saldo esperado" value={formatMoeda(rel.saldoEsperado)} bold />
                    {rel.caixa.status === 'fechado' && (
                      <>
                        <RowR label="Valor contado" value={formatMoeda(g.valorCon(rel.caixa))} bold />
                        <DifRow diferenca={rel.diferenca} />
                      </>
                    )}
                  </div>
                </div>
                {rel.totalVendas > 0 && (
                  <div className="space-y-2">
                    {(Object.keys(rel.porFormaPagamento) as FormaPagamento[])
                      .filter((f) => rel.porFormaPagamento[f] > 0)
                      .map((f) => {
                        const pct = (rel.porFormaPagamento[f] / rel.totalVendas) * 100;
                        return (
                          <div key={f}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-primary-600">{FORMAS_ICON[f]} {FORMAS_LABEL[f]}</span>
                              <span className="font-bold text-primary-900">
                                {formatMoeda(rel.porFormaPagamento[f])}{' '}
                                <span className="font-normal text-primary-400">({pct.toFixed(0)}%)</span>
                              </span>
                            </div>
                            <div className="h-1.5 bg-primary-100 rounded-full">
                              <div className="h-1.5 bg-accent-500 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
                {rel.pedidos.length > 0 && (
                  <div className="border border-primary-100 rounded-xl overflow-hidden">
                    <button onClick={() => setPedExpandido((v) => !v)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-primary-50 hover:bg-primary-100 transition-colors">
                      <span className="text-xs font-semibold text-primary-600 uppercase tracking-wide">
                        Contas Fechadas ({rel.totalPedidos})
                      </span>
                      {pedExpandido ? <ChevronUp size={14} className="text-primary-400" /> : <ChevronDown size={14} className="text-primary-400" />}
                    </button>
                    {pedExpandido && (
                      <div className="max-h-56 overflow-y-auto divide-y divide-primary-50">
                        {rel.pedidos.slice().reverse().map((p: any) => (
                          <div key={p.id} className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-primary-50">
                            <div>
                              <span className="font-medium text-primary-800">Mesa {g.mesaId(p)}</span>
                              <span className="text-xs text-primary-400 ml-2">
                                {new Date(g.pedFechado(p)).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {g.pedForma(p) && <span className="ml-1 text-xs">{FORMAS_ICON[g.pedForma(p)!]}</span>}
                            </div>
                            <span className="font-bold text-accent-600">{formatMoeda(p.total)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          )}
        </>
      )}

      {/* ── ABA: MESAS */}
      {aba === 'mesas' && (
        <div className="space-y-4">
          {carregando ? (
            <Card className="p-10 text-center text-primary-400">
              <Loader2 size={24} className="animate-spin mx-auto mb-2" /><p className="text-sm">Carregando...</p>
            </Card>
          ) : grupos.length === 0 || (grupos.length === 1 && grupos[0].pedidos.length === 0) ? (
            <Card className="p-10 text-center text-primary-400">
              <UtensilsCrossed size={28} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nenhuma conta fechada nesta data</p>
            </Card>
          ) : (
            grupos.map((grupo, idx) => {
              const totalGrupo = grupo.pedidos.reduce((s: number, p: any) => s + Number(p.total), 0);
              return (
                <Card key={grupo.caixa?.id ?? idx} className="overflow-hidden">
                  <div className="px-5 py-3 bg-primary-50 border-b border-primary-100 flex items-center justify-between flex-wrap gap-2">
                    <div>
                      {grupo.caixa ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full
                            ${grupo.caixa.status === 'aberto' ? 'bg-green-100 text-green-700' : 'bg-primary-200 text-primary-600'}`}>
                            {grupo.caixa.status === 'aberto' ? '🟢 Aberto' : '🔒 Fechado'}
                          </span>
                          <span className="text-xs text-primary-600 font-semibold">Caixa {idx + 1} — {g.abertoPor(grupo.caixa)}</span>
                          <span className="text-xs text-primary-400">
                            {formatHora(g.abertoEm(grupo.caixa))}{g.fechadoEm(grupo.caixa) && ` → ${formatHora(g.fechadoEm(grupo.caixa))}`}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-primary-500 font-semibold">Pedidos do dia</span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black text-accent-600">{formatMoeda(totalGrupo)}</span>
                      <span className="text-xs text-primary-400 ml-2">{grupo.pedidos.length} contas</span>
                    </div>
                  </div>
                  <div className="divide-y divide-primary-50">
                    {grupo.pedidos.map((p: any, pidx: number) => (
                      <div key={p.id} className="flex items-center justify-between px-5 py-3 hover:bg-primary-50 transition-colors">
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-primary-300 w-5 text-right font-medium">{pidx + 1}</span>
                          <div className="w-9 h-9 rounded-xl bg-primary-100 flex items-center justify-center shrink-0">
                            <span className="font-black text-primary-700 text-sm">{g.mesaId(p)}</span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-primary-900">Mesa {g.mesaId(p)}</p>
                            <div className="flex items-center gap-2 text-xs text-primary-400 mt-0.5">
                              <Clock size={10} />
                              <span>{formatHora(g.pedCriado(p))} → {formatHora(g.pedFechado(p))}</span>
                              {g.pedForma(p) && <span>{FORMAS_ICON[g.pedForma(p)!]} {FORMAS_LABEL[g.pedForma(p)!]}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-black text-accent-600">{formatMoeda(Number(p.total))}</span>
                          <button onClick={async () => {
                            try {
                              const full = await PedidoService.buscarPorId(p.id);
                              setPedDetalhe(full ?? p);
                            } catch { setPedDetalhe(p); }
                          }}
                            className="text-xs text-primary-400 hover:text-accent-600 px-2 py-1 hover:bg-accent-50 rounded-lg transition-colors font-medium">
                            Ver / Reimprimir
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* ── ABA: AUDITORIA DE PRODUÇÃO */}
      {aba === 'producao' && <AbaAuditoriaProducao data={data} />}

      {/* Modal detalhe pedido */}
      {pedDetalhe && (
        <Modal open onClose={() => setPedDetalhe(null)} title={`Mesa ${g.mesaId(pedDetalhe)} — Detalhe`} size="md">
          <div className="space-y-4">
            <div className="text-xs text-primary-400 flex gap-3">
              <span>Aberto: {formatDataHora(g.pedCriado(pedDetalhe))}</span>
              <span>·</span>
              <span>Fechado: {formatDataHora(g.pedFechado(pedDetalhe))}</span>
            </div>
            <div className="divide-y divide-primary-50 border border-primary-100 rounded-xl overflow-hidden">
              {(pedDetalhe.itens ?? []).map((item: any) => (
                <div key={item.id} className="flex justify-between items-start px-4 py-2.5 text-sm">
                  <div>
                    <span className="font-medium text-primary-900">
                      {item.quantidade}× {item.nome_produto ?? item.nomeProduto}
                    </span>
                    {item.observacao && <p className="text-xs text-accent-500">→ {item.observacao}</p>}
                    <p className="text-xs text-primary-400">{formatMoeda(Number(item.preco_produto ?? item.precoProduto))} un.</p>
                  </div>
                  <span className="font-bold text-accent-600">{formatMoeda(Number(item.subtotal))}</span>
                </div>
              ))}
              <div className="flex justify-between items-center px-4 py-3 bg-primary-50">
                <span className="font-bold text-primary-700">Total</span>
                <span className="text-xl font-black text-accent-600">{formatMoeda(Number(pedDetalhe.total))}</span>
              </div>
            </div>
            {g.pedForma(pedDetalhe) && (
              <div className="text-sm text-primary-600 flex items-center gap-2">
                {FORMAS_ICON[g.pedForma(pedDetalhe)!]} {FORMAS_LABEL[g.pedForma(pedDetalhe)!]}
                {Number(pedDetalhe.troco) > 0 && <span>· Troco: <strong>{formatMoeda(Number(pedDetalhe.troco))}</strong></span>}
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" className="flex-1" onClick={() => setPedDetalhe(null)}>Fechar</Button>
              <Button className="flex-1" onClick={() => imprimirPedido(pedDetalhe)}>
                <Printer size={14} /> Reimprimir Conta
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Aba Auditoria de Vendas ───────────────────────────────────
function AbaAuditoriaProducao({ data }: { data: string }) {
  const [inicio, setInicio] = useState(data);
  const [fim, setFim]       = useState(data);
  const [resultado, setResultado] = useState<any>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!inicio || !fim) return;
    setCarregando(true);
    setErro(null);
    try {
      const res = await RelatorioApiService.producao(inicio, fim);
      setResultado(res);
    } catch (e: any) {
      setErro(e.message ?? 'Erro ao carregar auditoria de vendas');
    } finally {
      setCarregando(false);
    }
  }, [inicio, fim]);

  const handleImprimir = () => {
    if (!resultado) return;
    const area = document.getElementById('print-area');
    if (!area) return;
    area.innerHTML = buildHtmlAuditoria(resultado, inicio, fim);
    window.print();
  };

  const handlePDF = () => {
    if (!resultado) return;
    gerarPDFAuditoria(resultado, inicio, fim);
  };

  useEffect(() => { carregar(); }, [carregar]);

  // Sincroniza quando a data global muda
  useEffect(() => { setInicio(data); setFim(data); }, [data]);

  const maxItens = resultado?.porHora?.length
    ? Math.max(...resultado.porHora.map((h: any) => Number(h.total_itens)))
    : 1;

  const maxQtd = resultado?.porProduto?.length
    ? Math.max(...resultado.porProduto.map((p: any) => Number(p.total_quantidade)))
    : 1;

  return (
    <div className="space-y-5">
      {/* Filtro de período */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-primary-500 font-medium block mb-1">De</label>
            <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)}
              className="border border-primary-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-400 bg-white" />
          </div>
          <div>
            <label className="text-xs text-primary-500 font-medium block mb-1">Até</label>
            <input type="date" value={fim} onChange={(e) => setFim(e.target.value)}
              className="border border-primary-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-400 bg-white" />
          </div>
          <Button size="sm" onClick={carregar} disabled={carregando}>
            {carregando ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
            Consultar
          </Button>
          {resultado && !carregando && (
            <>
              <Button variant="secondary" size="sm" onClick={handleImprimir}><Printer size={13} /> Imprimir</Button>
              <Button size="sm" onClick={handlePDF}><FileText size={13} /> PDF</Button>
            </>
          )}
          {/* Atalhos de período */}
          {['7 dias', '30 dias'].map((label, i) => (
            <button key={label}
              onClick={() => {
                const d = new Date(); d.setDate(d.getDate() - (i === 0 ? 6 : 29));
                setInicio(localDate(i === 0 ? -6 : -29));
                setFim(localDate());
              }}
              className="px-3 py-2 text-xs bg-primary-100 hover:bg-accent-100 hover:text-accent-700 rounded-xl font-medium transition-colors border border-primary-200">
              Últimos {label}
            </button>
          ))}
        </div>
      </Card>

      {carregando && (
        <div className="text-center py-10 text-primary-400">
          <Loader2 size={28} className="animate-spin mx-auto mb-2" />
          <p className="text-sm">Analisando vendas...</p>
        </div>
      )}

      {erro && (
        <Card className="p-5 border-red-200 bg-red-50">
          <p className="text-red-600 text-sm flex items-center gap-2"><AlertCircle size={15} />{erro}</p>
        </Card>
      )}

      {resultado && !carregando && (
        <>
          {/* Cards de resumo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              icon={<Package size={18} className="text-accent-600" />}
              label="Itens vendidos"
              value={String(Number(resultado.totais?.total_itens_produzidos ?? 0))}
              sub="unidades no período"
            />
            <StatCard
              icon={<TrendingUp size={18} className="text-green-600" />}
              label="Faturamento"
              value={formatMoeda(Number(resultado.totais?.faturamento_total ?? 0))}
              sub={`${resultado.totais?.total_pedidos_fechados ?? 0} pedidos`}
            />
            <StatCard
              icon={<ShoppingCart size={18} className="text-blue-600" />}
              label="Produtos diferentes"
              value={String(Number(resultado.totais?.total_produtos_diferentes ?? 0))}
              sub="itens do cardápio"
            />
            <StatCard
              icon={<XCircle size={18} className="text-red-500" />}
              label="Cancelamentos"
              value={String(Number(resultado.cancelados?.total_cancelados ?? 0))}
              sub={`${formatMoeda(Number(resultado.cancelados?.valor_perdido ?? 0))} perdidos`}
              alert={Number(resultado.cancelados?.total_cancelados ?? 0) > 0}
            />
          </div>

          {/* Ranking de produtos */}
          {resultado.porProduto?.length > 0 ? (
            <Card className="overflow-hidden">
              <div className="px-5 py-3 bg-primary-50 border-b border-primary-100">
                <h3 className="text-sm font-bold text-primary-800">Ranking de Vendas</h3>
                <p className="text-xs text-primary-400 mt-0.5">Ordenado por quantidade vendida</p>
              </div>
              <div className="divide-y divide-primary-50">
                {resultado.porProduto.map((p: any, idx: number) => {
                  const pct = (Number(p.total_quantidade) / maxQtd) * 100;
                  const faturamentoPct = resultado.totais?.faturamento_total > 0
                    ? (Number(p.total_valor) / Number(resultado.totais.faturamento_total)) * 100
                    : 0;
                  return (
                    <div key={p.produto_id ?? p.nome_produto} className="px-5 py-3">
                      <div className="flex items-center justify-between gap-3 mb-1.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs font-black text-primary-300 w-5 shrink-0">#{idx + 1}</span>
                          <span className="text-sm font-semibold text-primary-900 truncate">{p.nome_produto}</span>
                          <span className="text-xs text-primary-400 shrink-0">{p.total_pedidos} pedidos</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-sm font-black text-accent-600">{p.total_quantidade} un</span>
                          <span className="text-xs text-primary-400 ml-2">{formatMoeda(Number(p.total_valor))}</span>
                          <span className="text-xs text-primary-300 ml-1">({faturamentoPct.toFixed(0)}%)</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-primary-100 rounded-full">
                        <div className="h-1.5 bg-accent-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ) : (
            <Card className="p-10 text-center text-primary-400">
              <ShoppingCart size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum item vendido neste período</p>
            </Card>
          )}

          {/* Produção por hora */}
          {resultado.porHora?.length > 0 && (
            <Card className="overflow-hidden">
              <div className="px-5 py-3 bg-primary-50 border-b border-primary-100">
                <h3 className="text-sm font-bold text-primary-800">Pico de Vendas por Hora</h3>
                <p className="text-xs text-primary-400 mt-0.5">Quantidade de itens vendidos em cada hora do dia</p>
              </div>
              <div className="p-5">
                <div className="flex items-end gap-0.5 sm:gap-1.5 h-32">
                  {Array.from({ length: 24 }, (_, h) => {
                    const hora = resultado.porHora.find((x: any) => Number(x.hora) === h);
                    const itens = hora ? Number(hora.total_itens) : 0;
                    const pct = maxItens > 0 ? (itens / maxItens) * 100 : 0;
                    return (
                      <div key={h} className="flex-1 min-w-0 flex flex-col items-center gap-1 group relative">
                        <div className="w-full bg-primary-100 rounded-t flex flex-col justify-end" style={{ height: '100%' }}>
                          {pct > 0 && (
                            <div
                              className={`w-full rounded-t transition-all ${pct === 100 ? 'bg-accent-500' : 'bg-accent-300 group-hover:bg-accent-400'}`}
                              style={{ height: `${pct}%` }}
                            />
                          )}
                        </div>
                        {/* Tooltip */}
                        {itens > 0 && (
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-primary-900 text-white text-xs px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                            {itens} itens
                          </div>
                        )}
                        {/* label a cada 3h pra não amontoar no celular */}
                        <span className="text-[9px] text-primary-400 tabular-nums leading-none h-2">{h % 3 === 0 ? `${h}h` : ''}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex flex-wrap gap-3">
                  {resultado.porHora
                    .slice()
                    .sort((a: any, b: any) => Number(b.total_itens) - Number(a.total_itens))
                    .slice(0, 3)
                    .map((h: any, i: number) => (
                      <span key={h.hora} className="text-xs bg-accent-50 text-accent-700 px-2.5 py-1 rounded-full font-medium">
                        {i === 0 ? '🏆' : i === 1 ? '🥈' : '🥉'} {h.hora}h — {h.total_itens} itens ({h.total_pedidos} pedidos)
                      </span>
                    ))}
                </div>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ── Sub-componentes ───────────────────────────────────────────
function StatCard({ icon, label, value, sub, alert }: {
  icon: React.ReactNode; label: string; value: string; sub: string; alert?: boolean;
}) {
  return (
    <Card className={`p-4 ${alert ? 'border-red-200 bg-red-50' : ''}`}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs text-primary-500 font-medium leading-tight">{label}</span>
        {icon}
      </div>
      <p className={`text-xl font-black ${alert ? 'text-red-600' : 'text-primary-900'}`}>{value}</p>
      <p className="text-xs text-primary-400 mt-0.5">{sub}</p>
    </Card>
  );
}

function RowR({ label, value, bold, accent, indent }: {
  label: string; value: string; bold?: boolean; accent?: boolean; indent?: boolean;
}) {
  return (
    <div className={`flex justify-between px-4 py-2.5 ${indent ? 'pl-8 bg-primary-50/30' : ''}`}>
      <span className={`text-sm ${bold ? 'font-semibold text-primary-800' : 'text-primary-600'}`}>{label}</span>
      <span className={`text-sm font-bold ${accent ? 'text-accent-600' : 'text-primary-900'}`}>{value}</span>
    </div>
  );
}

function DifRow({ diferenca }: { diferenca?: number }) {
  if (diferenca === undefined) return null;
  const ok = Math.abs(diferenca) < 0.01;
  const color = ok ? 'text-green-600' : diferenca > 0 ? 'text-blue-600' : 'text-red-600';
  return (
    <div className="flex justify-between px-4 py-2.5">
      <span className="text-sm font-semibold text-primary-800">Diferença</span>
      <span className={`text-sm font-bold ${color}`}>
        {diferenca >= 0 ? '+' : ''}{formatMoeda(diferenca)} {ok && '✓'}
      </span>
    </div>
  );
}

// Impressão de pedido individual
function buildHtmlPedido(pedido: any, nome: string): string {
  const itensHtml = (pedido.itens ?? []).map((i: any) => `
    <tr>
      <td>${i.quantidade}x ${i.nome_produto ?? i.nomeProduto}${i.observacao ? `<br><small style="color:#888">-> ${i.observacao}</small>` : ''}</td>
      <td style="text-align:right">${formatMoeda(Number(i.subtotal))}</td>
    </tr>`).join('');
  const forma = (() => {
    const f = pedido.forma_pagamento ?? pedido.formaPagamento;
    return f ? (FORMAS_LABEL as Record<string, string>)[f] ?? f : '';
  })();
  return `
    <div style="font-family:Arial,sans-serif;max-width:380px;margin:0 auto;padding:16px;font-size:13px">
      <h2 style="text-align:center;margin-bottom:4px">${nome}</h2>
      <p style="text-align:center;color:#666;font-size:11px">Mesa ${pedido.mesa_numero ?? ''} - ${new Date(pedido.criado_em ?? '').toLocaleString('pt-BR')}</p>
      <hr style="margin:8px 0">
      <table style="width:100%;border-collapse:collapse">
        ${itensHtml}
        <tr><td colspan="2"><hr style="margin:6px 0"></td></tr>
        <tr><td><strong>Total</strong></td><td style="text-align:right"><strong style="font-size:16px">${formatMoeda(Number(pedido.total))}</strong></td></tr>
        ${forma ? `<tr><td>Pagamento</td><td style="text-align:right">${forma}</td></tr>` : ''}
        ${Number(pedido.troco) > 0 ? `<tr><td>Troco</td><td style="text-align:right">${formatMoeda(Number(pedido.troco))}</td></tr>` : ''}
      </table>
      <hr style="margin:8px 0">
      <p style="text-align:center;font-size:11px;color:#888">Obrigado pela preferencia!</p>
    </div>`;
}

// PDF relatório de caixa
function gerarPDFCaixa(relatorio: RelatorioCaixa) {
  const { caixa, pedidos, totalVendas, totalPedidos, porFormaPagamento, saldoEsperado, diferenca } = relatorio;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const W = 210; let y = 15;
  const sub = (t: string) => { doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(80,80,80); doc.text(t,15,y); y+=6; doc.setTextColor(0,0,0); };
  const row = (l: string, v: string, b=false) => { doc.setFont('helvetica',b?'bold':'normal'); doc.setFontSize(9); doc.text(l,15,y); doc.text(v,W-15,y,{align:'right'}); y+=5.5; };
  const ln  = () => { doc.setDrawColor(200,200,200); doc.line(15,y,W-15,y); y+=4; };
  doc.setFont('helvetica','bold'); doc.setFontSize(16);
  doc.text('RELATORIO DE FECHAMENTO DE CAIXA',W/2,y,{align:'center'}); y+=7;
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(100,100,100);
  doc.text(`Emitido em: ${new Date().toLocaleString('pt-BR')}`,W/2,y,{align:'center'}); y+=8;
  doc.setTextColor(0,0,0); ln();
  sub('INFORMACOES DO CAIXA');
  row('Abertura:', formatDataHora(g.abertoEm(caixa)));
  row('Operador:', g.abertoPor(caixa));
  row('Troco inicial:', formatMoeda(g.valorAb(caixa)));
  if (g.fechadoEm(caixa)) row('Fechamento:', formatDataHora(g.fechadoEm(caixa)));
  if (g.fechadoPor(caixa)) row('Fechado por:', g.fechadoPor(caixa));
  ln();
  sub('RESUMO FINANCEIRO');
  row('Total de vendas:', formatMoeda(totalVendas), true);
  row('Pedidos:', String(totalPedidos));
  for (const f of Object.keys(porFormaPagamento) as FormaPagamento[]) {
    if (porFormaPagamento[f] > 0) row(`  ${FORMAS_LABEL[f]}:`, formatMoeda(porFormaPagamento[f]));
  }
  row('Saldo esperado:', formatMoeda(saldoEsperado), true);
  if (g.valorCon(caixa) > 0) {
    row('Valor contado:', formatMoeda(g.valorCon(caixa)), true);
    row('Diferenca:', `${(diferenca??0)>=0?'+':''}${formatMoeda(diferenca??0)}`, true);
  }
  ln();
  sub(`CONTAS FECHADAS (${totalPedidos})`);
  doc.setFontSize(8); doc.setFont('helvetica','bold');
  doc.text('Mesa',15,y); doc.text('Horario',45,y); doc.text('Pagamento',90,y); doc.text('Total',W-15,y,{align:'right'}); y+=4;
  doc.setDrawColor(180); doc.line(15,y,W-15,y); y+=3; doc.setFont('helvetica','normal');
  for (const p of pedidos.slice().reverse()) {
    if (y>270) { doc.addPage(); y=15; }
    const pf = g.pedForma(p as any);
    doc.text(`Mesa ${g.mesaId(p as any)}`,15,y);
    doc.text(new Date(g.pedFechado(p as any)).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}),45,y);
    doc.text(pf?FORMAS_LABEL[pf]:'-',90,y);
    doc.text(formatMoeda(Number(p.total)),W-15,y,{align:'right'}); y+=5;
  }
  ln(); y+=5;
  doc.setFontSize(9); doc.setTextColor(120,120,120);
  doc.text('Assinaturas:',15,y); y+=12;
  doc.line(15,y,90,y); doc.line(110,y,W-15,y); y+=4; doc.setFontSize(8);
  doc.text('Operador',15,y); doc.text('Responsavel',110,y);
  doc.save(`relatorio-caixa-${g.abertoEm(caixa).slice(0,10)}.pdf`);
}

// HTML para window.print()
function buildHtmlRelatorio(relatorio: RelatorioCaixa): string {
  const { caixa, pedidos, totalVendas, totalPedidos, porFormaPagamento, saldoEsperado, diferenca } = relatorio;
  const formasH = (Object.keys(porFormaPagamento) as FormaPagamento[])
    .filter((f) => porFormaPagamento[f] > 0)
    .map((f) => `<tr><td style="padding-left:12px">${FORMAS_LABEL[f]}</td><td style="text-align:right">${formatMoeda(porFormaPagamento[f])}</td></tr>`)
    .join('');
  const pedidosH = pedidos.slice().reverse().map((p: any) => {
    const pf = g.pedForma(p);
    return `<tr>
      <td>Mesa ${g.mesaId(p)}</td>
      <td>${new Date(g.pedFechado(p)).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</td>
      <td>${pf?FORMAS_LABEL[pf]:'-'}</td>
      <td style="text-align:right"><strong>${formatMoeda(Number(p.total))}</strong></td></tr>`;
  }).join('');
  const difC = diferenca===undefined?'':`color:${Math.abs(diferenca)<0.01?'green':diferenca>0?'blue':'red'}`;
  const difH = diferenca!==undefined
    ? `<tr><td><strong>Diferenca</strong></td><td style="text-align:right;${difC}"><strong>${diferenca>=0?'+':''}${formatMoeda(diferenca)}</strong></td></tr>`
    : '';
  return `<div style="font-family:Arial,sans-serif;max-width:720px;margin:0 auto;padding:20px;font-size:13px">
    <h1 style="text-align:center;font-size:18px">RELATORIO DE FECHAMENTO DE CAIXA</h1>
    <p style="text-align:center;color:#666;font-size:11px">Emitido: ${new Date().toLocaleString('pt-BR')}</p><hr>
    <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
      <tr><td>Abertura</td><td style="text-align:right">${formatDataHora(g.abertoEm(caixa))}</td></tr>
      <tr><td>Operador</td><td style="text-align:right">${g.abertoPor(caixa)}</td></tr>
      <tr><td>Troco inicial</td><td style="text-align:right">${formatMoeda(g.valorAb(caixa))}</td></tr>
      ${g.fechadoEm(caixa)?`<tr><td>Fechamento</td><td style="text-align:right">${formatDataHora(g.fechadoEm(caixa))}</td></tr>`:''}
      ${g.fechadoPor(caixa)?`<tr><td>Fechado por</td><td style="text-align:right">${g.fechadoPor(caixa)}</td></tr>`:''}
    </table><hr>
    <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
      <tr><td><strong>Total vendas</strong></td><td style="text-align:right"><strong>${formatMoeda(totalVendas)}</strong></td></tr>
      <tr><td>Pedidos</td><td style="text-align:right">${totalPedidos}</td></tr>
      ${formasH}
      <tr><td><strong>Saldo esperado</strong></td><td style="text-align:right"><strong>${formatMoeda(saldoEsperado)}</strong></td></tr>
      ${g.valorCon(caixa)>0?`<tr><td><strong>Valor contado</strong></td><td style="text-align:right"><strong>${formatMoeda(g.valorCon(caixa))}</strong></td></tr>`:''}
      ${difH}
    </table><hr>
    <table style="width:100%;border-collapse:collapse;font-size:11px">
      <thead><tr style="background:#f3f4f6">
        <th style="text-align:left;padding:5px">Mesa</th><th style="text-align:left;padding:5px">Hora</th>
        <th style="text-align:left;padding:5px">Pagamento</th><th style="text-align:right;padding:5px">Total</th>
      </tr></thead>
      <tbody>${pedidosH}</tbody>
    </table></div>`;
}

// ── Impressão e PDF — Auditoria de Vendas ────────────────────
function buildHtmlAuditoria(r: any, inicio: string, fim: string): string {
  const linhasProdutos = (r.porProduto ?? []).map((p: any, i: number) => `
    <tr style="background:${i % 2 === 0 ? '#f9fafb' : 'white'}">
      <td style="padding:5px 4px">#${i + 1}</td>
      <td style="padding:5px 4px">${p.nome_produto}</td>
      <td style="padding:5px 4px;text-align:center">${p.total_quantidade}</td>
      <td style="padding:5px 4px;text-align:right">${formatMoeda(Number(p.total_valor))}</td>
      <td style="padding:5px 4px;text-align:center">${p.total_pedidos}</td>
    </tr>`).join('');

  const horasLinhas = (r.porHora ?? [])
    .map((h: any) => `<tr><td>${h.hora}h</td><td style="text-align:center">${h.total_pedidos}</td><td style="text-align:right">${h.total_itens}</td></tr>`)
    .join('');

  const periodo = inicio === fim ? inicio : `${inicio} a ${fim}`;
  return `<div style="font-family:Arial,sans-serif;max-width:760px;margin:0 auto;padding:20px;font-size:12px">
    <h1 style="text-align:center;font-size:17px;margin-bottom:4px">AUDITORIA DE VENDAS</h1>
    <p style="text-align:center;color:#666;font-size:11px">Período: ${periodo} — Emitido: ${new Date().toLocaleString('pt-BR')}</p>
    <hr style="margin:10px 0">
    <table style="width:100%;border-collapse:collapse;margin-bottom:10px">
      <tr><td>Itens vendidos</td><td style="text-align:right"><strong>${r.totais?.total_itens_produzidos ?? 0} unidades</strong></td>
          <td style="padding-left:20px">Pedidos</td><td style="text-align:right"><strong>${r.totais?.total_pedidos_fechados ?? 0}</strong></td></tr>
      <tr><td>Faturamento total</td><td style="text-align:right"><strong>${formatMoeda(Number(r.totais?.faturamento_total ?? 0))}</strong></td>
          <td style="padding-left:20px">Cancelamentos</td><td style="text-align:right">${r.cancelados?.total_cancelados ?? 0} (${formatMoeda(Number(r.cancelados?.valor_perdido ?? 0))})</td></tr>
    </table>
    <hr style="margin:10px 0">
    <h3 style="font-size:12px;text-transform:uppercase;color:#555;margin-bottom:6px">Ranking de Vendas por Produto</h3>
    <table style="width:100%;border-collapse:collapse;font-size:11px">
      <thead><tr style="background:#e5e7eb">
        <th style="padding:5px 4px;text-align:left">#</th>
        <th style="padding:5px 4px;text-align:left">Produto</th>
        <th style="padding:5px 4px;text-align:center">Qtd</th>
        <th style="padding:5px 4px;text-align:right">Faturamento</th>
        <th style="padding:5px 4px;text-align:center">Pedidos</th>
      </tr></thead>
      <tbody>${linhasProdutos}</tbody>
    </table>
    ${horasLinhas ? `
    <hr style="margin:10px 0">
    <h3 style="font-size:12px;text-transform:uppercase;color:#555;margin-bottom:6px">Vendas por Hora</h3>
    <table style="width:50%;border-collapse:collapse;font-size:11px">
      <thead><tr style="background:#e5e7eb">
        <th style="padding:4px;text-align:left">Hora</th>
        <th style="padding:4px;text-align:center">Pedidos</th>
        <th style="padding:4px;text-align:right">Itens</th>
      </tr></thead>
      <tbody>${horasLinhas}</tbody>
    </table>` : ''}
    <hr style="margin:14px 0">
    <p style="text-align:center;font-size:10px;color:#aaa">Documento gerado automaticamente pelo sistema de caixa.</p>
  </div>`;
}

function gerarPDFAuditoria(r: any, inicio: string, fim: string) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const W = 210; let y = 15;
  const sub = (t: string) => { doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(70,70,70); doc.text(t,15,y); y+=6; doc.setTextColor(0,0,0); };
  const row = (l: string, v: string, b = false) => { doc.setFont('helvetica',b?'bold':'normal'); doc.setFontSize(9); doc.text(l,15,y); doc.text(v,W-15,y,{align:'right'}); y+=5; };
  const ln  = () => { doc.setDrawColor(200,200,200); doc.line(15,y,W-15,y); y+=4; };
  const periodo = inicio === fim ? inicio : `${inicio} a ${fim}`;

  doc.setFont('helvetica','bold'); doc.setFontSize(16);
  doc.text('AUDITORIA DE VENDAS', W/2, y, {align:'center'}); y+=7;
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(100,100,100);
  doc.text(`Período: ${periodo}  —  Emitido: ${new Date().toLocaleString('pt-BR')}`, W/2, y, {align:'center'}); y+=8;
  doc.setTextColor(0,0,0); ln();

  sub('RESUMO GERAL');
  row('Itens vendidos:', `${r.totais?.total_itens_produzidos ?? 0} unidades`);
  row('Pedidos fechados:', String(r.totais?.total_pedidos_fechados ?? 0));
  row('Faturamento total:', formatMoeda(Number(r.totais?.faturamento_total ?? 0)), true);
  row('Cancelamentos:', `${r.cancelados?.total_cancelados ?? 0} pedido(s) — ${formatMoeda(Number(r.cancelados?.valor_perdido ?? 0))}`);
  ln();

  sub('RANKING DE VENDAS POR PRODUTO');
  doc.setFontSize(8); doc.setFont('helvetica','bold');
  doc.text('#', 15, y); doc.text('Produto', 22, y); doc.text('Qtd', 130, y, {align:'right'});
  doc.text('Faturamento', 160, y, {align:'right'}); doc.text('Pedidos', W-15, y, {align:'right'}); y+=4;
  doc.setDrawColor(180); doc.line(15, y, W-15, y); y+=3; doc.setFont('helvetica','normal');

  for (const [i, p] of (r.porProduto ?? []).entries()) {
    if (y > 270) { doc.addPage(); y = 15; }
    doc.text(String(i+1), 15, y);
    doc.text(String(p.nome_produto).substring(0, 45), 22, y);
    doc.text(String(p.total_quantidade), 130, y, {align:'right'});
    doc.text(formatMoeda(Number(p.total_valor)), 160, y, {align:'right'});
    doc.text(String(p.total_pedidos), W-15, y, {align:'right'});
    y += 5;
  }
  ln();

  if ((r.porHora ?? []).length > 0) {
    sub('VENDAS POR HORA DO DIA');
    doc.setFontSize(8); doc.setFont('helvetica','bold');
    doc.text('Hora', 15, y); doc.text('Pedidos', 60, y); doc.text('Itens vendidos', 100, y); y+=4;
    doc.setDrawColor(180); doc.line(15, y, 140, y); y+=3; doc.setFont('helvetica','normal');
    for (const h of r.porHora) {
      doc.text(`${h.hora}h`, 15, y); doc.text(String(h.total_pedidos), 60, y); doc.text(String(h.total_itens), 100, y); y+=5;
    }
    ln();
  }

  y += 5; doc.setFontSize(8); doc.setTextColor(150,150,150);
  doc.text('Documento gerado automaticamente pelo sistema de caixa.', W/2, y, {align:'center'});
  doc.save(`auditoria-vendas-${inicio}.pdf`);
}
