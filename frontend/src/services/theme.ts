/**
 * theme.ts — Cor principal (accent) do sistema.
 * Persiste a escolha em localStorage e aplica via atributo data-theme no <html>.
 * 100% frontend — não envolve backend nem banco de dados.
 */

export type CorTema = 'azul' | 'laranja' | 'vermelho' | 'verde' | 'preto';

export const TEMAS: { id: CorTema; nome: string; cor: string }[] = [
  { id: 'azul',     nome: 'Azul',     cor: '#0ea5e9' },
  { id: 'laranja',  nome: 'Laranja',  cor: '#f97316' },
  { id: 'vermelho', nome: 'Vermelho', cor: '#ef4444' },
  { id: 'verde',    nome: 'Verde',    cor: '#10b981' },
  { id: 'preto',    nome: 'Preto',    cor: '#18181b' },
];

const CHAVE = 'lanchonete_tema';

export function getTema(): CorTema {
  const t = localStorage.getItem(CHAVE) as CorTema | null;
  return t && TEMAS.some((x) => x.id === t) ? t : 'azul';
}

export function aplicarTema(cor: CorTema): void {
  document.documentElement.setAttribute('data-theme', cor);
}

export function setTema(cor: CorTema): void {
  localStorage.setItem(CHAVE, cor);
  aplicarTema(cor);
}
