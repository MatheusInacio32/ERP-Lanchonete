/**
 * log.ts — Logger semântico de AÇÕES DE NEGÓCIO no frontend.
 *
 * Diferente do api.ts (que loga requisições HTTP cruas), aqui registramos
 * eventos de alto nível — abrir mesa, fechar conta, sangria, troca de cor —
 * para facilitar a auditoria pelo console do navegador (F12).
 *
 * Cada evento também é guardado num buffer em memória (últimos 200),
 * acessível em window.__APP_LOGS__ para inspeção rápida em qualquer aparelho.
 */

type Nivel = 'info' | 'warn' | 'error';

interface Evento {
  ts: string;
  nivel: Nivel;
  acao: string;
  dados?: unknown;
}

const BUFFER: Evento[] = [];
const MAX = 200;

const ESTILO: Record<Nivel, string> = {
  info:  'color:#6366f1;font-weight:bold',
  warn:  'color:#f59e0b;font-weight:bold',
  error: 'color:#ef4444;font-weight:bold',
};

function registrar(nivel: Nivel, acao: string, dados?: unknown) {
  const ts = new Date().toLocaleTimeString('pt-BR');
  BUFFER.push({ ts, nivel, acao, dados });
  if (BUFFER.length > MAX) BUFFER.shift();

  const metodo = nivel === 'error' ? console.error : nivel === 'warn' ? console.warn : console.log;
  metodo(`%c[AÇÃO] %c${acao}`, 'color:#94a3b8', ESTILO[nivel], dados ?? '');

  // Expõe o histórico para inspeção manual no console (window.__APP_LOGS__)
  (window as any).__APP_LOGS__ = BUFFER;
}

export const log = {
  info:  (acao: string, dados?: unknown) => registrar('info', acao, dados),
  warn:  (acao: string, dados?: unknown) => registrar('warn', acao, dados),
  error: (acao: string, dados?: unknown) => registrar('error', acao, dados),
  /** Retorna uma cópia do buffer de eventos em memória. */
  historico: (): Evento[] => [...BUFFER],
};
