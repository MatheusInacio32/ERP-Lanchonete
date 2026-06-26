/**
 * api.ts — Cliente HTTP para o backend
 * Loga todas as requisições no console do navegador (F12)
 * e no terminal do Vite (CMD).
 */

// Usa o mesmo host que carregou a página: no PC fica "localhost", no celular
// fica o IP da rede (ex: 192.168.3.20). Assim o app funciona em qualquer aparelho.
const BASE = `http://${window.location.hostname}:3001/api`;

// ── Cores para console ────────────────────────────────────────
const C = {
  GET:    'color:#22c55e;font-weight:bold',
  POST:   'color:#3b82f6;font-weight:bold',
  PATCH:  'color:#f59e0b;font-weight:bold',
  DELETE: 'color:#ef4444;font-weight:bold',
  OK:     'color:#6366f1',
  ERR:    'color:#ef4444;font-weight:bold',
  DIM:    'color:#94a3b8',
};

function logReq(method: string, path: string) {
  const style = C[method as keyof typeof C] ?? C.GET;
  console.log(`%c[API] %c${method} %c${path}`, C.DIM, style, 'color:#e2e8f0');
}

function logOk(method: string, path: string, ms: number, data: unknown) {
  const style = C[method as keyof typeof C] ?? C.GET;
  console.log(
    `%c[API] %c${method} %c${path} %c✓ ${ms}ms`,
    C.DIM, style, 'color:#e2e8f0', C.OK,
    data
  );
}

function logErr(method: string, path: string, ms: number, err: string) {
  console.error(
    `%c[API] %c${method} %c${path} %c✗ ${ms}ms — ${err}`,
    C.DIM, C.ERR, 'color:#e2e8f0', C.ERR
  );
}

// ── Requisição base ───────────────────────────────────────────
async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const start = Date.now();
  logReq(method, path);

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr: any) {
    const ms = Date.now() - start;
    logErr(method, path, ms, `Sem conexão — ${networkErr.message}`);
    throw new Error(`Sem conexão com o servidor. Verifique se o backend está rodando em ${BASE}`);
  }

  const json = await res.json();
  const ms = Date.now() - start;

  if (!json.success) {
    logErr(method, path, ms, json.error ?? 'Erro desconhecido');
    throw new Error(json.error ?? 'Erro desconhecido');
  }

  logOk(method, path, ms, json.data);
  return json.data as T;
}

// ── Download de arquivo binário (ex: .backup do pg_dump) ──────
async function getBlob(path: string): Promise<{ blob: Blob; filename: string }> {
  const start = Date.now();
  logReq('GET', path);
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`);
  } catch (e: any) {
    logErr('GET', path, Date.now() - start, `Sem conexão — ${e.message}`);
    throw new Error(`Sem conexão com o servidor (${BASE})`);
  }
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    logErr('GET', path, Date.now() - start, j.error ?? `HTTP ${res.status}`);
    throw new Error(j.error ?? `Falha no download (HTTP ${res.status})`);
  }
  const blob = await res.blob();
  const filename = res.headers.get('Content-Disposition')?.match(/filename="?([^"]+)"?/)?.[1] ?? 'download.bin';
  logOk('GET', path, Date.now() - start, `${(blob.size/1024).toFixed(1)} KB`);
  return { blob, filename };
}

// ── Upload de arquivo binário (ex: restaurar .backup) ─────────
async function postBinary<T>(path: string, body: Blob | ArrayBuffer | File): Promise<T> {
  const start = Date.now();
  logReq('POST', path);
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body,
    });
  } catch (e: any) {
    logErr('POST', path, Date.now() - start, `Sem conexão — ${e.message}`);
    throw new Error(`Sem conexão com o servidor (${BASE})`);
  }
  const json = await res.json();
  if (!json.success) {
    logErr('POST', path, Date.now() - start, json.error ?? 'Erro');
    throw new Error(json.error ?? 'Erro desconhecido');
  }
  logOk('POST', path, Date.now() - start, json.data);
  return json.data as T;
}

export const api = {
  get:    <T>(path: string)                 => req<T>('GET',    path),
  post:   <T>(path: string, body: unknown)  => req<T>('POST',   path, body),
  patch:  <T>(path: string, body: unknown)  => req<T>('PATCH',  path, body),
  delete: <T>(path: string, body?: unknown) => req<T>('DELETE', path, body),
  getBlob,
  postBinary,
};
