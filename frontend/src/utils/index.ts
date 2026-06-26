import jsPDF from 'jspdf';
import type { Pedido, Mesa, Configuracoes } from '../types';

// ── Data local (evita bug de timezone UTC vs horário local) ──
export const localDate = (offsetDays = 0): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

// ── Formatação ───────────────────────────────────────────────
export const formatMoeda = (valor: number): string =>
  Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const formatHora = (iso?: string): string => {
  if (!iso) return '--:--';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

export const formatData = (iso?: string): string => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR');
};

export const formatDataHora = (iso?: string): string => {
  if (!iso) return '';
  return new Date(iso).toLocaleString('pt-BR');
};

export const gerarId = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// ── Helpers para campos snake_case ou camelCase da API ───────
const f = {
  nome:        (c: any): string => c?.nome_estabelecimento ?? c?.nomeEstabelecimento ?? 'Lanchonete',
  tel:         (c: any): string => c?.telefone ?? '',
  criadoEm:    (p: any): string => p?.criado_em  ?? p?.criadoEm  ?? '',
  fechadoEm:   (p: any): string => p?.fechado_em ?? p?.fechadoEm ?? '',
  formaPag:    (p: any): string => p?.forma_pagamento ?? p?.formaPagamento ?? '',
  valRecebido: (p: any): number => Number(p?.valor_recebido ?? p?.valorRecebido ?? 0),
  troco:       (p: any): number => Number(p?.troco ?? 0),
  nomeProd:    (i: any): string => i?.nome_produto ?? i?.nomeProduto ?? '',
  obsItem:     (i: any): string => i?.observacao ?? '',
};

// ── Troco ────────────────────────────────────────────────────
export function calcularTroco(total: number, recebido: number): number {
  return Math.max(0, recebido - total);
}

// ── Texto de recibo para impressão ───────────────────────────
export function gerarTextoRecibo(
  pedido: Pedido,
  mesa: Mesa,
  config: Configuracoes
): string {
  const linhas: string[] = [];
  const sep = '─'.repeat(40);
  const nomeEstab = f.nome(config);

  linhas.push(nomeEstab.toUpperCase().padStart(32));
  linhas.push(sep);
  linhas.push(`Mesa ${mesa.numero}  |  ${formatDataHora(f.criadoEm(pedido))}`);
  linhas.push(sep);
  linhas.push('ITEM                     QTD    VALOR');
  linhas.push(sep);

  for (const item of (pedido.itens ?? [])) {
    const nome = f.nomeProd(item).substring(0, 22).padEnd(22);
    const qtd  = String(item.quantidade).padStart(4);
    const val  = formatMoeda(item.subtotal).padStart(10);
    linhas.push(`${nome} ${qtd}  ${val}`);
    const obs = f.obsItem(item);
    if (obs) linhas.push(`  ↳ ${obs}`);
  }

  linhas.push(sep);
  linhas.push(`TOTAL:${formatMoeda(pedido.total).padStart(34)}`);

  const forma = f.formaPag(pedido);
  if (forma) {
    const LABELS_PAGAMENTO: Record<string, string> = {
      dinheiro: 'DINHEIRO', pix: 'PIX', debito: 'DÉBITO', credito: 'CRÉDITO', voucher: 'VOUCHER', cartao: 'CARTÃO',
    };
    const fp = LABELS_PAGAMENTO[forma] ?? forma.toUpperCase();
    linhas.push(`PAGAMENTO: ${fp}`);
    const vr = f.valRecebido(pedido);
    if (vr > 0) linhas.push(`RECEBIDO:${formatMoeda(vr).padStart(31)}`);
    const tr = f.troco(pedido);
    if (tr > 0) linhas.push(`TROCO:${formatMoeda(tr).padStart(34)}`);
  }

  linhas.push(sep);
  linhas.push('Obrigado pela preferência!'.padStart(36));
  linhas.push('');
  return linhas.join('\n');
}

// ── Gerar PDF do recibo ──────────────────────────────────────
export function gerarPDF(pedido: Pedido, mesa: Mesa, config: Configuracoes): void {
  const doc = new jsPDF({ unit: 'mm', format: [80, 200], orientation: 'portrait' });
  const W = 80;
  let y = 8;

  const center = (text: string, size = 10) => {
    if (!text) return;
    doc.setFontSize(size);
    doc.text(String(text), W / 2, y, { align: 'center' });
    y += size * 0.5 + 2;
  };

  const left = (text: string, size = 8) => {
    if (!text) return;
    doc.setFontSize(size);
    doc.text(String(text), 5, y);
    y += size * 0.4 + 1.5;
  };

  const row = (label: string, value: string, size = 8) => {
    doc.setFontSize(size);
    doc.text(String(label), 5, y);
    doc.text(String(value), W - 5, y, { align: 'right' });
    y += size * 0.4 + 1.5;
  };

  const line = () => {
    doc.setDrawColor(180);
    doc.line(5, y, W - 5, y);
    y += 3;
  };

  // Cabeçalho
  doc.setFont('helvetica', 'bold');
  center(f.nome(config), 12);
  const tel = f.tel(config);
  if (tel) { doc.setFont('helvetica', 'normal'); center(tel, 8); }
  line();

  doc.setFont('helvetica', 'normal');
  row(`Mesa ${mesa.numero}`, formatDataHora(f.criadoEm(pedido)));
  line();

  doc.setFont('helvetica', 'bold');
  left('PRODUTO', 8);
  doc.setFont('helvetica', 'normal');

  for (const item of (pedido.itens ?? [])) {
    row(`${item.quantidade}x ${f.nomeProd(item)}`, formatMoeda(item.subtotal));
    const obs = f.obsItem(item);
    if (obs) left(`  ↳ ${obs}`, 7);
  }

  line();
  doc.setFont('helvetica', 'bold');
  row('TOTAL', formatMoeda(pedido.total), 10);

  const forma = f.formaPag(pedido);
  if (forma) {
    doc.setFont('helvetica', 'normal');
    const LABELS_PAG: Record<string, string> = {
      dinheiro: 'DINHEIRO', pix: 'PIX', debito: 'DÉBITO', credito: 'CRÉDITO', voucher: 'VOUCHER', cartao: 'CARTÃO',
    };
    const fp = LABELS_PAG[forma] ?? forma.toUpperCase();
    left(`Pagamento: ${fp}`);
    const vr = f.valRecebido(pedido);
    if (vr > 0) row('Recebido', formatMoeda(vr));
    const tr = f.troco(pedido);
    if (tr > 0) row('Troco', formatMoeda(tr));
  }

  line();
  doc.setFont('helvetica', 'italic');
  center('Obrigado pela preferência!', 8);

  doc.save(`conta-mesa-${mesa.numero}-${Date.now()}.pdf`);
}

// ── Impressão via window.print() ─────────────────────────────
export function imprimirConta(pedido: Pedido, mesa: Mesa, config: Configuracoes): void {
  const recibo = gerarTextoRecibo(pedido, mesa, config);
  const printArea = document.getElementById('print-area');
  if (!printArea) return;
  printArea.innerHTML = `
    <div style="font-family:monospace;font-size:12px;white-space:pre;padding:8px;max-width:300px;margin:0 auto;">
${recibo}
    </div>
  `;
  window.print();
}
