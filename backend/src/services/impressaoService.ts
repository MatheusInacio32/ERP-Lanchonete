/**
 * impressaoService.ts — Impressão SILENCIOSA (sem diálogo do Windows).
 *
 * Usa o pacote `pdf-to-printer`, que embute o SumatraPDF e envia um PDF
 * direto para uma impressora nomeada do sistema operacional — pulando o
 * Ctrl+P do navegador. A impressão acontece SEMPRE nesta máquina (a que
 * roda o backend), pois é onde as impressoras estão fisicamente instaladas.
 */
import { print, getPrinters } from 'pdf-to-printer';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';

export interface ImpressoraInfo {
  nome: string;
  id: string;
  tamanhos?: string[];
}

export const ImpressaoService = {
  /** Lista as impressoras instaladas nesta máquina. */
  async listar(): Promise<ImpressoraInfo[]> {
    const printers = await getPrinters();
    const lista = printers.map((p: any) => ({
      nome: p.name,
      id: p.deviceId ?? p.name,
      tamanhos: p.paperSizes,
    }));
    logger.info(`Impressoras disponíveis: ${lista.length}`, { impressoras: lista.map((x) => x.nome) });
    return lista;
  },

  /**
   * Imprime um PDF (em buffer) silenciosamente na impressora indicada.
   * Grava em arquivo temporário, manda imprimir e remove o arquivo.
   */
  async imprimirPdf(buffer: Buffer, impressora: string): Promise<void> {
    if (!impressora || !impressora.trim()) {
      throw new Error('Nenhuma impressora selecionada');
    }
    if (!buffer || buffer.length === 0) {
      throw new Error('Conteúdo do PDF está vazio');
    }

    // Confere se a impressora informada realmente existe no sistema
    const disponiveis = await getPrinters().catch(() => [] as any[]);
    const existe = disponiveis.some((p: any) => p.name === impressora || p.deviceId === impressora);
    if (!existe) {
      throw new Error(`Impressora "${impressora}" não encontrada nesta máquina`);
    }

    const tmp = path.join(os.tmpdir(), `lanchonete-print-${randomUUID()}.pdf`);
    await fs.writeFile(tmp, buffer);
    try {
      await print(tmp, { printer: impressora });
      logger.info(`Impressão enviada → "${impressora}" (${(buffer.length / 1024).toFixed(1)} KB)`);
    } catch (e: any) {
      logger.error(`Falha ao imprimir em "${impressora}": ${e?.message ?? e}`);
      throw new Error(`Falha ao imprimir em "${impressora}": ${e?.message ?? 'erro do driver'}`);
    } finally {
      fs.unlink(tmp).catch(() => { /* arquivo já removido — ok */ });
    }
  },
};
