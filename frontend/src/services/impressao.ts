/**
 * impressao.ts — Impressão SILENCIOSA no frontend.
 *
 * A impressora escolhida fica salva no localStorage (por aparelho). O nome
 * é enviado ao backend, que imprime o PDF direto na impressora — pulando o
 * Ctrl+P do navegador. Sem fallback: se não houver impressora ou der erro,
 * lançamos um erro para a tela avisar.
 */
import jsPDF from 'jspdf';
import { ImpressaoService } from './storage';
import { log } from './log';
import { formatMoeda } from '../utils';

export type TipoImpressao = 'relatorio' | 'cupom';

const CHAVES: Record<TipoImpressao, string> = {
  relatorio: 'lanchonete_impressora_relatorio',
  cupom:     'lanchonete_impressora_cupom',
};

export function getImpressora(tipo: TipoImpressao): string {
  return localStorage.getItem(CHAVES[tipo]) ?? '';
}
export function setImpressora(tipo: TipoImpressao, nome: string): void {
  if (nome) localStorage.setItem(CHAVES[tipo], nome);
  else localStorage.removeItem(CHAVES[tipo]);
}

const ROTULO: Record<TipoImpressao, string> = {
  relatorio: 'relatórios',
  cupom:     'cupom de mesas',
};

/**
 * Imprime um documento jsPDF na impressora configurada para o tipo.
 * Lança erro (sem abrir Ctrl+P) se não houver impressora ou se falhar.
 */
export async function imprimirDocumento(doc: jsPDF, tipo: TipoImpressao): Promise<void> {
  const impressora = getImpressora(tipo);
  if (!impressora) {
    throw new Error(`Nenhuma impressora de ${ROTULO[tipo]} selecionada. Vá em Configurações → Impressão e escolha uma.`);
  }
  const ab = doc.output('arraybuffer');
  try {
    const r = await ImpressaoService.imprimir(ab, impressora);
    log.info('Impressão enviada', { tipo, impressora, bytes: r?.bytes });
  } catch (e: any) {
    log.error('Falha na impressão', { tipo, impressora, erro: e?.message });
    throw new Error(e?.message ?? 'Falha ao imprimir');
  }
}

// ── Cupom térmico (80mm) de uma conta/mesa ────────────────────
const FORMAS: Record<string, string> = {
  dinheiro: 'Dinheiro', pix: 'PIX', debito: 'Debito', credito: 'Credito', voucher: 'Voucher', cartao: 'Cartao',
};

/** Monta o PDF do cupom de uma conta no formato de bobina 80mm. */
export function montarPDFCupom(pedido: any, nomeEstabelecimento: string): jsPDF {
  const itens: any[] = pedido.itens ?? [];
  // Altura dinâmica: cabeçalho + linhas + rodapé (com folga p/ observações)
  const comObs = itens.filter((i) => i.observacao).length;
  const altura = 60 + itens.length * 6 + comObs * 4 + 30;
  const doc = new jsPDF({ unit: 'mm', format: [80, altura] });
  const W = 80;
  const M = 5;          // margem
  let y = 8;

  const center = (t: string, size = 10, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.text(t, W / 2, y, { align: 'center' });
    y += size * 0.45 + 1.5;
  };
  const linha = () => { doc.setDrawColor(150); doc.line(M, y, W - M, y); y += 3; };
  const lr = (l: string, r: string, bold = false, size = 9) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.text(l, M, y);
    doc.text(r, W - M, y, { align: 'right' });
    y += size * 0.45 + 2;
  };

  center(nomeEstabelecimento, 12, true);
  const mesa = pedido.mesa_numero ?? pedido.mesaNumero ?? '';
  center(`Mesa ${mesa}`, 9);
  const dt = pedido.criado_em ?? pedido.criadoEm;
  if (dt) center(new Date(dt).toLocaleString('pt-BR'), 8);
  y += 1; linha();

  doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
  doc.text('QTD x ITEM', M, y); doc.text('VALOR', W - M, y, { align: 'right' }); y += 4;
  doc.setFont('helvetica', 'normal');

  for (const it of itens) {
    const nome = it.nome_produto ?? it.nomeProduto ?? 'Item';
    const qtd = Number(it.quantidade);
    doc.setFontSize(9);
    // Nome pode ser longo: quebra em até a largura útil
    const txt = `${qtd}x ${nome}`;
    const linhas = doc.splitTextToSize(txt, W - M * 2 - 18);
    doc.text(linhas, M, y);
    doc.text(formatMoeda(Number(it.subtotal)), W - M, y, { align: 'right' });
    y += linhas.length * 4;
    if (it.observacao) {
      doc.setFontSize(7); doc.setTextColor(90);
      doc.text(`  -> ${it.observacao}`, M, y); doc.setTextColor(0);
      y += 3.5;
    }
  }
  y += 1; linha();

  lr('TOTAL', formatMoeda(Number(pedido.total)), true, 12);
  const forma = pedido.forma_pagamento ?? pedido.formaPagamento;
  if (forma) lr('Pagamento', FORMAS[forma] ?? forma);
  if (Number(pedido.valor_recebido ?? pedido.valorRecebido) > 0)
    lr('Recebido', formatMoeda(Number(pedido.valor_recebido ?? pedido.valorRecebido)));
  if (Number(pedido.troco) > 0) lr('Troco', formatMoeda(Number(pedido.troco)));
  y += 2; linha();

  center('Obrigado pela preferencia!', 8);
  center('* * *', 8);

  return doc;
}
