/**
 * folderStorage.ts — Persistência automática em pasta do sistema via File System Access API
 *
 * Suporte: Chrome 86+, Edge 86+. Firefox e Safari não suportam showDirectoryPicker.
 * O FileSystemDirectoryHandle é armazenado no IndexedDB (único lugar que permite
 * persistir handles entre sessões após o usuário conceder permissão permanente).
 *
 * Fluxo:
 *  1. Usuário escolhe pasta nas Configurações → handle salvo no IndexedDB
 *  2. Em toda operação de escrita (fechar caixa, fechar conta), salva XML na pasta
 *  3. Ao abrir Relatórios, lê os XMLs da pasta para listar histórico
 */

const DB_NAME = 'lanchonete_fs';
const DB_STORE = 'handles';
const HANDLE_KEY = 'pastaBackup';

// ── IndexedDB para guardar o handle ──────────────────────────
function openDB(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

async function getHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openDB();
    return new Promise((res) => {
      const tx = db.transaction(DB_STORE, 'readonly');
      const req = tx.objectStore(DB_STORE).get(HANDLE_KEY);
      req.onsuccess = () => res(req.result ?? null);
      req.onerror = () => res(null);
    });
  } catch { return null; }
}

async function saveHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(handle, HANDLE_KEY);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

async function removeHandle(): Promise<void> {
  const db = await openDB();
  return new Promise((res) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).delete(HANDLE_KEY);
    tx.oncomplete = () => res();
    tx.onerror = () => res();
  });
}

// ── API pública ───────────────────────────────────────────────
export const FolderStorage = {
  /** Verifica se a API está disponível no navegador */
  isSupported(): boolean {
    return 'showDirectoryPicker' in window;
  },

  /** Pede ao usuário para escolher uma pasta e salva o handle */
  async escolherPasta(): Promise<string | null> {
    if (!FolderStorage.isSupported()) return null;
    try {
      const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
      await saveHandle(handle);
      return handle.name;
    } catch {
      return null; // usuário cancelou
    }
  },

  /** Retorna o nome da pasta configurada, ou null se não houver */
  async nomePasta(): Promise<string | null> {
    const handle = await getHandle();
    return handle?.name ?? null;
  },

  /** Remove a pasta configurada */
  async removerPasta(): Promise<void> {
    await removeHandle();
  },

  /**
   * Verifica se ainda temos permissão para a pasta.
   * Se não, tenta pedir novamente (pode exigir gesto do usuário).
   */
  async verificarPermissao(): Promise<boolean> {
    const handle = await getHandle();
    if (!handle) return false;
    try {
      const perm = await (handle as any).queryPermission({ mode: 'readwrite' });
      if (perm === 'granted') return true;
      const req = await (handle as any).requestPermission({ mode: 'readwrite' });
      return req === 'granted';
    } catch { return false; }
  },

  /**
   * Grava um arquivo XML na pasta configurada.
   * Retorna true se bem-sucedido.
   */
  async gravarXML(nomeArquivo: string, conteudo: string): Promise<boolean> {
    try {
      const handle = await getHandle();
      if (!handle) return false;
      const perm = await (handle as any).queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted') return false;
      const fileHandle = await handle.getFileHandle(nomeArquivo, { create: true });
      const writable = await (fileHandle as any).createWritable();
      await writable.write(conteudo);
      await writable.close();
      return true;
    } catch { return false; }
  },

  /**
   * Lista todos os arquivos .xml na pasta.
   * Retorna array de { nome, conteudo } ordenado por nome (decrescente = mais recente primeiro).
   */
  async listarXMLs(): Promise<{ nome: string; conteudo: string }[]> {
    try {
      const handle = await getHandle();
      if (!handle) return [];
      const perm = await (handle as any).queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted') return [];

      const arquivos: { nome: string; conteudo: string }[] = [];
      for await (const [nome, fh] of (handle as any).entries()) {
        if (typeof nome === 'string' && nome.endsWith('.xml')) {
          const file = await (fh as any).getFile();
          const conteudo = await file.text();
          arquivos.push({ nome, conteudo });
        }
      }
      return arquivos.sort((a, b) => b.nome.localeCompare(a.nome));
    } catch { return []; }
  },

  /**
   * Lê um arquivo específico da pasta.
   */
  async lerXML(nomeArquivo: string): Promise<string | null> {
    try {
      const handle = await getHandle();
      if (!handle) return null;
      const fh = await handle.getFileHandle(nomeArquivo);
      const file = await (fh as any).getFile();
      return await file.text();
    } catch { return null; }
  },
};
