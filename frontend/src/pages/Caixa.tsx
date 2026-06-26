import { useState, useEffect } from 'react';
import {
  DollarSign, Lock, Unlock, Printer, FileText,
  CheckCircle2, AlertCircle, Clock, ChevronDown, ChevronUp, Eye
} from 'lucide-react';
import { Card, Button, Input, Modal } from '../components/ui';
import { formatMoeda, formatDataHora } from '../utils';
import type { Caixa, RelatorioCaixa, FormaPagamento } from '../types';
import { CaixaService } from '../services/storage';
import jsPDF from 'jspdf';

// ── Utilitários locais ────────────────────────────────────────
const FORMAS_LABEL: Record<FormaPagamento, string> = {
  dinheiro: 'Dinheiro',
  pix:      'PIX',
  debito:   'Débito',
  credito:  'Crédito',
  voucher:  'Voucher',
  cartao:   'Cartão',
};
const FORMAS_ICON: Record<FormaPagamento, string> = {
  dinheiro: '💵',
  pix:      '📱',
  debito:   '💳',
  credito:  '💎',
  voucher:  '🎫',
  cartao:   '💳',
};

// ── Props ─────────────────────────────────────────────────────
interface Props {
  caixaAtual: Caixa | undefined;
  onAbrirCaixa: (operador: string, valorAbertura: number) => Promise<Caixa>;
  onFecharCaixa: (operador: string, valorContado: number, obs?: string) => Promise<RelatorioCaixa | undefined>;
  gerarRelatorio: (caixaId?: string) => Promise<RelatorioCaixa | undefined>;
}

// ─────────────────────────────────────────────────────────────
export function Caixa({ caixaAtual, onAbrirCaixa, onFecharCaixa, gerarRelatorio }: Props) {
  // ── Modais ──────────────────────────────────────────────────
  const [modalAbrir, setModalAbrir] = useState(false);
  const [modalFechar, setModalFechar] = useState(false);
  const [modalHistorico, setModalHistorico] = useState(false);

  const abrirHistorico = () => {
    setModalHistorico(true);
    carregarHistorico();
  };
  const [modalRelatorio, setModalRelatorio] = useState<RelatorioCaixa | null>(null);

  // ── Forms ───────────────────────────────────────────────────
  const [operadorAbrir, setOperadorAbrir] = useState('');
  const [valorAberturaStr, setValorAberturaStr] = useState('');
  const [operadorFechar, setOperadorFechar] = useState('');
  const [valorContadoStr, setValorContadoStr] = useState('');
  const [obsFechar, setObsFechar] = useState('');
  const [erroAbrir, setErroAbrir] = useState('');
  const [erroFechar, setErroFechar] = useState('');

  // ── Relatório parcial (sem fechar) ──────────────────────────
  const [relatorioAtual, setRelatorioAtual] = useState<RelatorioCaixa | null>(null);
  const [loadingCaixa, setLoadingCaixa] = useState(false);

  const caixaId = (caixaAtual as any)?.id;

  useEffect(() => {
    if (!caixaId) { setRelatorioAtual(null); return; }
    setLoadingCaixa(true);
    gerarRelatorio(caixaId)
      .then((r) => setRelatorioAtual(r ?? null))
      .catch(() => setRelatorioAtual(null))
      .finally(() => setLoadingCaixa(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caixaId]); // só dispara quando o ID do caixa muda

  // ── Histórico ────────────────────────────────────────────────
  const [historico, setHistorico] = useState<any[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);

  const carregarHistorico = async () => {
    setLoadingHistorico(true);
    try {
      const data = await CaixaService.getHistorico();
      setHistorico(data);
    } catch {} finally { setLoadingHistorico(false); }
  };

  // ── Ações ────────────────────────────────────────────────────
  const handleAbrirCaixa = async () => {
    if (!operadorAbrir.trim()) { setErroAbrir('Informe o nome do operador'); return; }
    const val = parseFloat(valorAberturaStr.replace(',', '.'));
    if (isNaN(val) || val < 0) { setErroAbrir('Valor de abertura inválido'); return; }
    setLoadingCaixa(true);
    setErroAbrir('');
    try {
      await onAbrirCaixa(operadorAbrir.trim(), val);
      setModalAbrir(false);
      setOperadorAbrir('');
      setValorAberturaStr('');
    } catch (e: any) {
      setErroAbrir(e.message ?? 'Erro ao abrir caixa');
    } finally {
      setLoadingCaixa(false);
    }
  };

  const handleFecharCaixa = async () => {
    if (!operadorFechar.trim()) { setErroFechar('Informe o nome do operador'); return; }
    const val = parseFloat(valorContadoStr.replace(',', '.'));
    if (isNaN(val) || val < 0) { setErroFechar('Informe o valor contado no caixa'); return; }
    const fechado = await onFecharCaixa(operadorFechar.trim(), val, obsFechar.trim() || undefined);
    if (fechado) {
      const rel = await gerarRelatorio(fechado.caixa?.id ?? (fechado as any).id);
      setModalFechar(false);
      setOperadorFechar('');
      setValorContadoStr('');
      setObsFechar('');
      setErroFechar('');
      if (rel) setModalRelatorio(rel);
    }
  };

  // ── Valores derivados para o modal de fechamento ─────────────
  const valorContado = parseFloat(valorContadoStr.replace(',', '.')) || 0;
  const saldoEsperado = relatorioAtual?.saldoEsperado ?? 0;
  const diferenca = valorContadoStr ? valorContado - saldoEsperado : undefined;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary-900">Controle de Caixa</h1>
          <p className="text-sm text-primary-500 mt-1">
            {caixaAtual
              ? `Caixa aberto desde ${formatDataHora((caixaAtual as any).aberto_em ?? (caixaAtual as any).abertoEm)}`
              : 'Nenhum caixa aberto no momento'}
          </p>
        </div>
        <div className="flex gap-2">
          {!caixaAtual ? (
            <Button onClick={() => setModalAbrir(true)} variant="success" size="md">
              <Unlock size={15} /> Abrir Caixa
            </Button>
          ) : (
            <>
              <Button onClick={() => setModalFechar(true)} variant="danger" size="md">
                <Lock size={15} /> Fechar Caixa
              </Button>
            </>
          )}
          <Button onClick={abrirHistorico} variant="secondary" size="md">
            <Eye size={15} /> Histórico
          </Button>
        </div>
      </div>

      {/* Status do caixa */}
      {!caixaAtual ? (
        <Card className="p-10 text-center space-y-3">
          <div className="text-5xl">🔒</div>
          <h2 className="text-lg font-semibold text-primary-700">Caixa Fechado</h2>
          <p className="text-sm text-primary-500 max-w-xs mx-auto">
            Abra o caixa para iniciar o expediente e registrar as vendas do dia.
          </p>
          <Button onClick={() => setModalAbrir(true)} variant="success" size="lg" className="mx-auto">
            <Unlock size={16} /> Abrir Caixa Agora
          </Button>
        </Card>
      ) : (
        <>
          {loadingCaixa ? (
            <div className="flex items-center justify-center py-16 gap-3 text-primary-500">
              <div className="w-6 h-6 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Carregando resumo do caixa...</span>
            </div>
          ) : (
            <>
              {relatorioAtual && <ResumoCards relatorio={relatorioAtual} />}
              {relatorioAtual && <PorFormaPagamento relatorio={relatorioAtual} />}
              {relatorioAtual && <ListaPedidos relatorio={relatorioAtual} />}
            </>
          )}
        </>
      )}

      {/* ── MODAL: Abrir Caixa ─────────────────────────────── */}
      <Modal open={modalAbrir} onClose={() => setModalAbrir(false)} title="Abrir Caixa" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-primary-600">
            Informe o operador responsável e o valor de troco inicial disponível no caixa.
          </p>
          <Input
            label="Nome do operador"
            value={operadorAbrir}
            onChange={(e) => { setOperadorAbrir(e.target.value); setErroAbrir(''); }}
            placeholder="Ex: João Silva"
            autoFocus
          />
          <Input
            label="Valor de abertura (troco inicial) R$"
            value={valorAberturaStr}
            onChange={(e) => { setValorAberturaStr(e.target.value); setErroAbrir(''); }}
            placeholder="0,00"
            inputMode="decimal"
          />
          {erroAbrir && (
            <p className="text-sm text-red-500 flex items-center gap-1">
              <AlertCircle size={13} /> {erroAbrir}
            </p>
          )}
          <div className="flex gap-3 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => setModalAbrir(false)}>Cancelar</Button>
            <Button variant="success" className="flex-1" onClick={handleAbrirCaixa} loading={loadingCaixa}>
              <Unlock size={14} /> Abrir Caixa
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL: Fechar Caixa ────────────────────────────── */}
      <Modal open={modalFechar} onClose={() => setModalFechar(false)} title="Fechamento de Caixa" size="md">
        <div className="space-y-5">
          {relatorioAtual && (
            <div className="bg-primary-50 rounded-xl p-4 space-y-2 border border-primary-100">
              <h3 className="text-sm font-semibold text-primary-700">Resumo do Sistema</h3>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-primary-600">Total de vendas</span>
                  <span className="font-bold text-primary-900">{formatMoeda(relatorioAtual.totalVendas)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-primary-600">Pedidos realizados</span>
                  <span className="font-medium text-primary-900">{relatorioAtual.totalPedidos}</span>
                </div>
                {(Object.keys(relatorioAtual.porFormaPagamento) as FormaPagamento[]).map((f) => (
                  relatorioAtual.porFormaPagamento[f] > 0 && (
                    <div key={f} className="flex justify-between">
                      <span className="text-primary-500">{FORMAS_ICON[f]} {FORMAS_LABEL[f]}</span>
                      <span className="text-primary-700">{formatMoeda(relatorioAtual.porFormaPagamento[f])}</span>
                    </div>
                  )
                ))}
                <div className="flex justify-between pt-1 border-t border-primary-200">
                  <span className="text-primary-600 font-semibold">Saldo esperado em caixa</span>
                  <span className="font-bold text-accent-600">{formatMoeda(relatorioAtual.saldoEsperado)}</span>
                </div>
              </div>
            </div>
          )}

          <Input
            label="Nome do operador responsável"
            value={operadorFechar}
            onChange={(e) => { setOperadorFechar(e.target.value); setErroFechar(''); }}
            placeholder="Ex: João Silva"
            autoFocus
          />

          <div className="space-y-1">
            <label className="text-sm font-medium text-primary-700 block">Valor contado no caixa (R$)</label>
            <input
              value={valorContadoStr}
              onChange={(e) => { setValorContadoStr(e.target.value); setErroFechar(''); }}
              placeholder="0,00"
              inputMode="decimal"
              className="w-full border border-primary-200 rounded-xl px-4 py-3 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-accent-500 text-center"
            />
          </div>

          {/* Resultado da conferência */}
          {valorContadoStr && diferenca !== undefined && (
            <div className={`rounded-xl p-4 flex items-center gap-3 border
              ${Math.abs(diferenca) < 0.01
                ? 'bg-green-50 border-green-200'
                : diferenca > 0
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-red-50 border-red-200'
              }`}>
              <div className="text-2xl">
                {Math.abs(diferenca) < 0.01 ? '✅' : diferenca > 0 ? '📈' : '⚠️'}
              </div>
              <div>
                <p className={`text-xs font-semibold uppercase tracking-wide
                  ${Math.abs(diferenca) < 0.01 ? 'text-green-600' : diferenca > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                  {Math.abs(diferenca) < 0.01 ? 'Caixa conferido — sem diferença' : diferenca > 0 ? 'Sobra no caixa' : 'Falta no caixa'}
                </p>
                <p className={`text-2xl font-black
                  ${Math.abs(diferenca) < 0.01 ? 'text-green-700' : diferenca > 0 ? 'text-blue-700' : 'text-red-700'}`}>
                  {diferenca >= 0 ? '+' : ''}{formatMoeda(diferenca)}
                </p>
              </div>
            </div>
          )}

          <Input
            label="Observações (opcional)"
            value={obsFechar}
            onChange={(e) => setObsFechar(e.target.value)}
            placeholder="Ex: Divergência justificada por troco de cliente..."
          />

          {erroFechar && (
            <p className="text-sm text-red-500 flex items-center gap-1">
              <AlertCircle size={13} /> {erroFechar}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => setModalFechar(false)}>Cancelar</Button>
            <Button variant="danger" className="flex-1" onClick={handleFecharCaixa}>
              <Lock size={14} /> Confirmar Fechamento
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL: Histórico ───────────────────────────────── */}
      <Modal open={modalHistorico} onClose={() => setModalHistorico(false)} title="Histórico de Caixas" size="lg">
        {loadingHistorico ? (
          <div className="text-center py-8 text-primary-400 text-sm">Carregando...</div>
        ) : historico.length === 0 ? (
          <p className="text-center text-primary-400 py-8 text-sm">Nenhum caixa fechado ainda.</p>
        ) : (
          <div className="space-y-3">
            {historico.map((c) => {
              // historico já vem com resumo da API (vw_resumo_caixa)
              const rel = c;
              return (
                <div key={c.id} className="border border-primary-100 rounded-xl p-4 hover:bg-primary-50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-primary-800">
                        {new Date(c.aberto_em ?? c.abertoEm).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </p>
                      <p className="text-xs text-primary-500 mt-0.5">
                        {formatDataHora(c.aberto_em ?? c.abertoEm)} → {formatDataHora(c.fechado_em ?? c.fechadoEm)}
                      </p>
                      <p className="text-xs text-primary-500">
                        Aberto por: <strong>{c.aberto_por ?? c.abertoPor}</strong> · Fechado por: <strong>{c.fechado_por ?? c.fechadoPor}</strong>
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-black text-accent-600">{rel ? formatMoeda(Number(rel.total_vendas ?? rel.totalVendas ?? 0)) : '—'}</p>
                      <p className="text-xs text-primary-500">{rel?.total_pedidos ?? rel?.totalPedidos ?? 0} pedidos</p>
                    </div>
                  </div>
                  {c.valorContado !== undefined && rel && (
                    <div className={`mt-3 text-xs rounded-lg px-3 py-1.5 inline-flex items-center gap-1.5 font-medium
                      ${Math.abs(rel.diferenca ?? 0) < 0.01 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {Math.abs(rel.diferenca ?? 0) < 0.01 ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                      Diferença: {(rel.diferenca ?? 0) >= 0 ? '+' : ''}{formatMoeda(rel.diferenca ?? 0)}
                    </div>
                  )}
                  <div className="mt-3 flex gap-2">
                    <Button variant="secondary" size="sm"
                      onClick={async () => {
                        const relatorioCompleto = await gerarRelatorio(c.id);
                        if (relatorioCompleto) {
                          setModalRelatorio(relatorioCompleto);
                          setModalHistorico(false);
                        }
                      }}>
                      <Eye size={12} /> Ver Relatório
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      {/* ── MODAL: Relatório Completo ──────────────────────── */}
      {modalRelatorio && (
        <ModalRelatorio
          relatorio={modalRelatorio}
          onClose={() => setModalRelatorio(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-componentes
// ─────────────────────────────────────────────────────────────

function ResumoCards({ relatorio }: { relatorio: RelatorioCaixa }) {
  const { caixa, totalVendas, totalPedidos, saldoEsperado } = relatorio;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="p-4 flex items-center gap-3">
        <div className="text-2xl text-accent-600"><DollarSign size={28} /></div>
        <div>
          <p className="text-xl font-black text-primary-900">{formatMoeda(totalVendas)}</p>
          <p className="text-xs text-primary-500">Total de vendas</p>
        </div>
      </Card>
      <Card className="p-4 flex items-center gap-3">
        <div className="text-2xl">🧾</div>
        <div>
          <p className="text-xl font-black text-primary-900">{totalPedidos}</p>
          <p className="text-xs text-primary-500">Pedidos fechados</p>
        </div>
      </Card>
      <Card className="p-4 flex items-center gap-3">
        <div className="text-2xl">💵</div>
        <div>
          <p className="text-xl font-black text-primary-900">{formatMoeda(Number(caixa.valor_abertura ?? caixa.valorAbertura ?? 0))}</p>
          <p className="text-xs text-primary-500">Abertura do caixa</p>
        </div>
      </Card>
      <Card className="p-4 flex items-center gap-3">
        <div className="text-2xl text-green-600"><CheckCircle2 size={28} /></div>
        <div>
          <p className="text-xl font-black text-green-700">{formatMoeda(saldoEsperado)}</p>
          <p className="text-xs text-primary-500">Saldo esperado</p>
        </div>
      </Card>
    </div>
  );
}

function PorFormaPagamento({ relatorio }: { relatorio: RelatorioCaixa }) {
  const { porFormaPagamento, totalVendas } = relatorio;
  const formas = (Object.keys(porFormaPagamento) as FormaPagamento[]).filter(
    (f) => porFormaPagamento[f] > 0
  );
  if (formas.length === 0) return null;
  return (
    <Card className="p-5">
      <h2 className="text-base font-semibold text-primary-700 mb-4">Por Forma de Pagamento</h2>
      <div className="space-y-3">
        {formas.map((f) => {
          const pct = totalVendas > 0 ? (porFormaPagamento[f] / totalVendas) * 100 : 0;
          return (
            <div key={f}>
              <div className="flex justify-between text-sm mb-1">
                <span className="flex items-center gap-1.5 font-medium text-primary-700">
                  {FORMAS_ICON[f]} {FORMAS_LABEL[f]}
                </span>
                <span className="font-bold text-primary-900">{formatMoeda(porFormaPagamento[f])} <span className="text-primary-400 font-normal">({pct.toFixed(0)}%)</span></span>
              </div>
              <div className="w-full bg-primary-100 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-accent-500 transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function ListaPedidos({ relatorio }: { relatorio: RelatorioCaixa }) {
  const [expandido, setExpandido] = useState(false);
  const { pedidos } = relatorio;
  if (pedidos.length === 0) return null;

  const visiveis = expandido ? pedidos : pedidos.slice(0, 5);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-primary-700">
          Contas Fechadas ({pedidos.length})
        </h2>
      </div>
      <div className="space-y-2">
        {visiveis.slice().reverse().map((p, i) => (
          <div key={p.id} className="flex items-center justify-between py-2 border-b border-primary-50 last:border-0">
            <div className="flex items-center gap-3">
              <span className="text-xs text-primary-400 w-5 text-right">{pedidos.length - i}</span>
              <div>
                <span className="text-sm font-medium text-primary-800">
                  Mesa {String(p.mesa_numero ?? (p.mesa_id ?? p.mesaId ?? '').replace('mesa-', '').replace('mesa_', ''))}
                </span>
                <div className="flex items-center gap-1.5 text-xs text-primary-400 mt-0.5">
                  <Clock size={10} />
                  {new Date((p as any).fechado_em ?? (p as any).fechadoEm ?? new Date()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  {((p as any).forma_pagamento ?? (p as any).formaPagamento) && (
                    <span className="ml-1">{FORMAS_ICON[((p as any).forma_pagamento ?? (p as any).formaPagamento) as FormaPagamento]} {FORMAS_LABEL[((p as any).forma_pagamento ?? (p as any).formaPagamento) as FormaPagamento]}</span>
                  )}
                </div>
              </div>
            </div>
            <span className="text-sm font-bold text-accent-600">{formatMoeda(p.total)}</span>
          </div>
        ))}
      </div>
      {pedidos.length > 5 && (
        <button
          onClick={() => setExpandido(!expandido)}
          className="mt-3 w-full text-xs text-primary-400 hover:text-accent-600 flex items-center justify-center gap-1 transition-colors"
        >
          {expandido ? <><ChevronUp size={13} /> Mostrar menos</> : <><ChevronDown size={13} /> Ver todos ({pedidos.length})</>}
        </button>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// Modal Relatório Completo (com impressão e PDF)
// ─────────────────────────────────────────────────────────────
function ModalRelatorio({ relatorio, onClose }: { relatorio: RelatorioCaixa; onClose: () => void }) {
  const { totalVendas, totalPedidos, porFormaPagamento, saldoEsperado, diferenca } = relatorio;
  const pedidos = relatorio.pedidos ?? [];
  // Guard contra caixa undefined (acontecia ao abrir relatório do histórico)
  const caixa = relatorio.caixa ?? ({} as any);
  const isFechado = caixa.status === 'fechado';

  const handleImprimir = () => {
    const printArea = document.getElementById('print-area');
    if (!printArea) return;
    printArea.innerHTML = buildHtmlRelatorio(relatorio);
    window.print();
  };

  const handlePDF = () => {
    gerarPDFCaixa(relatorio);
  };

  return (
    <Modal open onClose={onClose} title={isFechado ? 'Relatório de Fechamento de Caixa' : 'Relatório Parcial do Caixa'} size="xl">
      <div className="space-y-5">
        {/* Banner parcial */}
        {!isFechado && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2 text-amber-700 text-sm">
            <AlertCircle size={15} />
            <span>Este é um relatório <strong>parcial</strong>. A impressão oficial só é liberada no fechamento do caixa.</span>
          </div>
        )}

        {/* Cabeçalho do caixa */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-primary-50 rounded-xl p-3 space-y-1">
            <p className="text-xs text-primary-500 font-semibold uppercase tracking-wide">Abertura</p>
            <p className="font-medium text-primary-800">{formatDataHora((caixa as any).aberto_em ?? (caixa as any).abertoEm)}</p>
            <p className="text-primary-600">Operador: <strong>{(caixa as any).aberto_por ?? (caixa as any).abertoPor}</strong></p>
            <p className="text-primary-600">Troco inicial: <strong>{formatMoeda(Number(caixa.valor_abertura ?? caixa.valorAbertura ?? 0))}</strong></p>
          </div>
          {isFechado && (
            <div className="bg-primary-50 rounded-xl p-3 space-y-1">
              <p className="text-xs text-primary-500 font-semibold uppercase tracking-wide">Fechamento</p>
              <p className="font-medium text-primary-800">{formatDataHora((caixa as any).fechado_em ?? (caixa as any).fechadoEm)}</p>
              <p className="text-primary-600">Operador: <strong>{(caixa as any).fechado_por ?? (caixa as any).fechadoPor}</strong></p>
              <p className="text-primary-600">Valor contado: <strong>{formatMoeda(caixa.valorContado ?? 0)}</strong></p>
            </div>
          )}
        </div>

        {/* Totais */}
        <div className="border border-primary-100 rounded-xl overflow-hidden">
          <div className="bg-primary-50 px-4 py-2 text-xs font-semibold text-primary-500 uppercase tracking-wide">
            Resumo Financeiro
          </div>
          <div className="divide-y divide-primary-50">
            <Row label="Total de vendas" value={formatMoeda(totalVendas)} bold />
            <Row label="Pedidos realizados" value={String(totalPedidos)} />
            {(Object.keys(porFormaPagamento) as FormaPagamento[]).map((f) =>
              porFormaPagamento[f] > 0 ? (
                <Row key={f} label={`${FORMAS_ICON[f]} ${FORMAS_LABEL[f]}`} value={formatMoeda(porFormaPagamento[f])} indent />
              ) : null
            )}
            <Row label="Troco inicial (abertura)" value={formatMoeda(Number(caixa.valor_abertura ?? caixa.valorAbertura ?? 0))} />
            <Row label="Saldo esperado em caixa" value={formatMoeda(saldoEsperado)} bold accent />
            {isFechado && (caixa.valor_contado ?? caixa.valorContado) !== undefined && (
              <>
                <Row label="Valor contado" value={formatMoeda(Number(caixa.valor_contado ?? caixa.valorContado ?? 0))} bold />
                <Row
                  label="Diferença"
                  value={`${(diferenca ?? 0) >= 0 ? '+' : ''}${formatMoeda(diferenca ?? 0)}`}
                  bold
                  diferenca={diferenca}
                />
              </>
            )}
          </div>
        </div>

        {/* Observações */}
        {caixa.observacoes && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
            <p className="font-semibold mb-0.5">Observações</p>
            <p>{caixa.observacoes}</p>
          </div>
        )}

        {/* Lista de pedidos */}
        {pedidos.length > 0 && (
          <div className="border border-primary-100 rounded-xl overflow-hidden">
            <div className="bg-primary-50 px-4 py-2 text-xs font-semibold text-primary-500 uppercase tracking-wide">
              Contas Fechadas ({totalPedidos})
            </div>
            <div className="max-h-48 overflow-y-auto divide-y divide-primary-50">
              {pedidos.slice().reverse().map((p) => (
                <div key={p.id} className="flex items-center justify-between px-4 py-2 text-sm">
                  <div>
                    <span className="font-medium text-primary-800">Mesa {String(p.mesa_numero ?? (p.mesa_id ?? p.mesaId ?? '').replace('mesa-', '').replace('mesa_', ''))}</span>
                    <span className="text-primary-400 ml-2 text-xs">
                      {new Date((p as any).fechado_em ?? (p as any).fechadoEm ?? new Date()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {((p as any).forma_pagamento ?? (p as any).formaPagamento) && (
                      <span className="ml-2 text-xs text-primary-500">{FORMAS_ICON[((p as any).forma_pagamento ?? (p as any).formaPagamento) as FormaPagamento]}</span>
                    )}
                  </div>
                  <span className="font-bold text-accent-600">{formatMoeda(p.total)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ações de impressão */}
        <div className="flex gap-3 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Fechar</Button>
          {isFechado ? (
            <>
              <Button variant="secondary" className="flex-1" onClick={handleImprimir}>
                <Printer size={14} /> Imprimir
              </Button>
              <Button className="flex-1" onClick={handlePDF}>
                <FileText size={14} /> Gerar PDF
              </Button>
            </>
          ) : (
            <Button variant="secondary" className="flex-1" onClick={handleImprimir}>
              <Eye size={14} /> Pré-visualizar
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Row({
  label, value, bold, accent, indent, diferenca,
}: {
  label: string; value: string; bold?: boolean; accent?: boolean; indent?: boolean; diferenca?: number;
}) {
  const diferencaColor =
    diferenca === undefined
      ? ''
      : Math.abs(diferenca) < 0.01
        ? 'text-green-600'
        : diferenca > 0
          ? 'text-blue-600'
          : 'text-red-600';

  return (
    <div className={`flex justify-between items-center px-4 py-2.5 ${indent ? 'pl-8 bg-primary-50/40' : ''}`}>
      <span className={`text-sm ${bold ? 'font-semibold text-primary-800' : 'text-primary-600'}`}>{label}</span>
      <span className={`text-sm font-bold ${accent ? 'text-accent-600' : diferencaColor || 'text-primary-900'}`}>{value}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Geração de PDF do caixa
// ─────────────────────────────────────────────────────────────
function gerarPDFCaixa(relatorio: RelatorioCaixa) {
  const { totalVendas, totalPedidos, porFormaPagamento, saldoEsperado, diferenca } = relatorio;
  const pedidos = relatorio.pedidos ?? [];
  const caixa: any = relatorio.caixa ?? {};
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const W = 210;
  let y = 15;

  const subtitle = (text: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(text, 15, y);
    y += 6;
    doc.setTextColor(0, 0, 0);
  };

  const row = (label: string, value: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(9);
    doc.text(label, 15, y);
    doc.text(value, W - 15, y, { align: 'right' });
    y += 5.5;
  };

  const line = () => {
    doc.setDrawColor(200, 200, 200);
    doc.line(15, y, W - 15, y);
    y += 4;
  };

  // Cabeçalho
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('RELATÓRIO DE FECHAMENTO DE CAIXA', W / 2, y, { align: 'center' });
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`Emitido em: ${new Date().toLocaleString('pt-BR')}`, W / 2, y, { align: 'center' });
  y += 8;
  doc.setTextColor(0, 0, 0);
  line();

  // Info do caixa
  subtitle('INFORMAÇÕES DO CAIXA');
  row('Abertura:', formatDataHora(caixa.aberto_em ?? caixa.abertoEm));
  row('Operador de abertura:', caixa.aberto_por ?? caixa.abertoPor ?? '');
  row('Troco inicial:', formatMoeda(Number(caixa.valor_abertura ?? caixa.valorAbertura ?? 0)));
  if (caixa.status === 'fechado') {
    row('Fechamento:', formatDataHora(caixa.fechado_em ?? caixa.fechadoEm));
    row('Operador de fechamento:', caixa.fechadoPor ?? '—');
  }
  line();

  // Resumo financeiro
  subtitle('RESUMO FINANCEIRO');
  row('Total de vendas:', formatMoeda(totalVendas), true);
  row('Pedidos realizados:', String(totalPedidos));
  y += 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Por forma de pagamento:', 15, y);
  y += 5;

  for (const f of Object.keys(porFormaPagamento) as FormaPagamento[]) {
    if (porFormaPagamento[f] > 0) {
      row(`  ${FORMAS_LABEL[f]}:`, formatMoeda(porFormaPagamento[f]));
    }
  }
  y += 1;
  row('Saldo esperado em caixa:', formatMoeda(saldoEsperado), true);

  if ((caixa.valor_contado ?? caixa.valorContado) !== undefined) {
    row('Valor contado:', formatMoeda(Number(caixa.valor_contado ?? caixa.valorContado ?? 0)), true);
    row('Diferença:', `${(diferenca ?? 0) >= 0 ? '+' : ''}${formatMoeda(diferenca ?? 0)}`, true);
  }
  line();

  // Observações
  if (caixa.observacoes) {
    subtitle('OBSERVAÇÕES');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(caixa.observacoes, W - 30);
    doc.text(lines, 15, y);
    y += lines.length * 5 + 2;
    line();
  }

  // Contas fechadas
  subtitle(`CONTAS FECHADAS (${totalPedidos})`);
  doc.setFontSize(8);

  // Cabeçalho tabela
  doc.setFont('helvetica', 'bold');
  doc.text('Mesa', 15, y);
  doc.text('Horário', 45, y);
  doc.text('Pagamento', 90, y);
  doc.text('Itens', 140, y);
  doc.text('Total', W - 15, y, { align: 'right' });
  y += 4;
  doc.setDrawColor(180);
  doc.line(15, y, W - 15, y);
  y += 3;
  doc.setFont('helvetica', 'normal');

  for (const p of pedidos.slice().reverse()) {
    if (y > 270) {
      doc.addPage();
      y = 15;
    }
    const hora = new Date((p as any).fechado_em ?? (p as any).fechadoEm ?? new Date()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const mesa = `Mesa ${String(p.mesa_numero ?? (p.mesa_id ?? p.mesaId ?? '').replace('mesa-', '').replace('mesa_', ''))}`;
    const forma = p.formaPagamento ? FORMAS_LABEL[p.formaPagamento] : '—';
    const itensCt = (p.itens ?? []).reduce((s: number, i: any) => s + i.quantidade, 0);
    doc.text(mesa, 15, y);
    doc.text(hora, 45, y);
    doc.text(forma, 90, y);
    doc.text(String(itensCt), 140, y);
    doc.text(formatMoeda(p.total), W - 15, y, { align: 'right' });
    y += 5;
  }

  line();

  // Assinatura
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text('Conferido e assinado por:', 15, y);
  y += 12;
  doc.line(15, y, 90, y);
  doc.line(110, y, W - 15, y);
  y += 4;
  doc.setFontSize(8);
  doc.text('Operador', 15, y);
  doc.text('Responsável', 110, y);

  doc.save(`fechamento-caixa-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ─────────────────────────────────────────────────────────────
// HTML para window.print()
// ─────────────────────────────────────────────────────────────
function buildHtmlRelatorio(relatorio: RelatorioCaixa): string {
  const { totalVendas, totalPedidos, porFormaPagamento, saldoEsperado, diferenca } = relatorio;
  const pedidos = relatorio.pedidos ?? [];
  const caixa: any = relatorio.caixa ?? {};

  const formasHtml = (Object.keys(porFormaPagamento) as FormaPagamento[])
    .filter((f) => porFormaPagamento[f] > 0)
    .map((f) => `<tr><td style="padding-left:16px">  ${FORMAS_LABEL[f]}</td><td style="text-align:right">${formatMoeda(porFormaPagamento[f])}</td></tr>`)
    .join('');

  const pedidosHtml = pedidos.slice().reverse().map((p) => {
    const hora = new Date((p as any).fechado_em ?? (p as any).fechadoEm ?? new Date()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const forma = p.formaPagamento ? FORMAS_LABEL[p.formaPagamento] : '—';
    return `<tr>
      <td>Mesa ${String(p.mesa_numero ?? (p.mesa_id ?? p.mesaId ?? '').replace('mesa-', '').replace('mesa_', ''))}</td>
      <td>${hora}</td>
      <td>${forma}</td>
      <td style="text-align:right"><strong>${formatMoeda(p.total)}</strong></td>
    </tr>`;
  }).join('');

  const diferencaStr = diferenca !== undefined
    ? `<tr><td><strong>Diferença</strong></td><td style="text-align:right"><strong style="color:${Math.abs(diferenca) < 0.01 ? 'green' : diferenca > 0 ? 'blue' : 'red'}">${diferenca >= 0 ? '+' : ''}${formatMoeda(diferenca)}</strong></td></tr>`
    : '';

  return `
    <div style="font-family:Arial,sans-serif;max-width:720px;margin:0 auto;padding:20px;font-size:13px">
      <h1 style="text-align:center;font-size:18px;margin-bottom:4px">RELATÓRIO DE FECHAMENTO DE CAIXA</h1>
      <p style="text-align:center;color:#666;font-size:11px">Emitido em: ${new Date().toLocaleString('pt-BR')}</p>
      <hr style="margin:12px 0">

      <h3 style="font-size:12px;text-transform:uppercase;color:#555;margin-bottom:8px">Informações do Caixa</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
        <tr><td>Abertura</td><td style="text-align:right">${formatDataHora((caixa as any).aberto_em ?? (caixa as any).abertoEm)}</td></tr>
        <tr><td>Operador de abertura</td><td style="text-align:right">${(caixa as any).aberto_por ?? (caixa as any).abertoPor}</td></tr>
        <tr><td>Troco inicial</td><td style="text-align:right">${formatMoeda(Number(caixa.valor_abertura ?? caixa.valorAbertura ?? 0))}</td></tr>
        ${caixa.fechadoEm ? `<tr><td>Fechamento</td><td style="text-align:right">${formatDataHora((caixa as any).fechado_em ?? (caixa as any).fechadoEm)}</td></tr>` : ''}
        ${caixa.fechadoPor ? `<tr><td>Operador de fechamento</td><td style="text-align:right">${(caixa as any).fechado_por ?? (caixa as any).fechadoPor}</td></tr>` : ''}
      </table>
      <hr style="margin:12px 0">

      <h3 style="font-size:12px;text-transform:uppercase;color:#555;margin-bottom:8px">Resumo Financeiro</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
        <tr><td><strong>Total de vendas</strong></td><td style="text-align:right"><strong>${formatMoeda(totalVendas)}</strong></td></tr>
        <tr><td>Pedidos realizados</td><td style="text-align:right">${totalPedidos}</td></tr>
        ${formasHtml}
        <tr><td>Troco inicial</td><td style="text-align:right">${formatMoeda(Number(caixa.valor_abertura ?? caixa.valorAbertura ?? 0))}</td></tr>
        <tr><td><strong>Saldo esperado em caixa</strong></td><td style="text-align:right"><strong>${formatMoeda(saldoEsperado)}</strong></td></tr>
        ${(caixa.valor_contado ?? caixa.valorContado) !== undefined ? `<tr><td><strong>Valor contado</strong></td><td style="text-align:right"><strong>${formatMoeda(Number(caixa.valor_contado ?? caixa.valorContado ?? 0))}</strong></td></tr>` : ''}
        ${diferencaStr}
      </table>
      ${caixa.observacoes ? `<hr style="margin:12px 0"><p><strong>Observações:</strong> ${caixa.observacoes}</p>` : ''}
      <hr style="margin:12px 0">

      <h3 style="font-size:12px;text-transform:uppercase;color:#555;margin-bottom:8px">Contas Fechadas (${totalPedidos})</h3>
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead>
          <tr style="background:#f3f4f6">
            <th style="text-align:left;padding:6px 4px">Mesa</th>
            <th style="text-align:left;padding:6px 4px">Horário</th>
            <th style="text-align:left;padding:6px 4px">Pagamento</th>
            <th style="text-align:right;padding:6px 4px">Total</th>
          </tr>
        </thead>
        <tbody>${pedidosHtml}</tbody>
      </table>
      <hr style="margin:20px 0">

      <table style="width:100%;margin-top:30px">
        <tr>
          <td style="width:45%;text-align:center">
            <div style="border-top:1px solid #000;padding-top:4px;font-size:11px">Operador</div>
          </td>
          <td style="width:10%"></td>
          <td style="width:45%;text-align:center">
            <div style="border-top:1px solid #000;padding-top:4px;font-size:11px">Responsável</div>
          </td>
        </tr>
      </table>
    </div>
  `;
}
