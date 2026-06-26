import { useState, useRef, useEffect } from 'react';
import { Save, Trash2, Download, Upload, FileText, AlertCircle, CheckCircle2, Folder, FolderX, Info, Palette } from 'lucide-react';
import { Card, Button, Input } from '../components/ui';
import { FolderStorage } from '../services/folderStorage';
import { BackupService, ConfigService } from '../services/storage';
import { TEMAS, getTema, setTema, type CorTema } from '../services/theme';
import type { Configuracoes as TConfig } from '../types';

interface Props {
  config: TConfig;
  onSalvar: (c: TConfig) => Promise<void>;
}

export function Configuracoes({ config, onSalvar }: Props) {
  const [form, setForm]         = useState<TConfig>(config);
  const [saved, setSaved]       = useState(false);
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [nomePasta, setNomePasta] = useState<string | null>(null);
  const [fsSuportado]           = useState(() => FolderStorage.isSupported());
  const [exportando, setExportando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [zerando, setZerando]       = useState(false);
  const [tema, setTemaState]        = useState<CorTema>(() => getTema());
  const fileRef = useRef<HTMLInputElement>(null);

  const escolherCor = async (cor: CorTema) => {
    setTema(cor);        // aplica na hora + cache local (UX instantânea)
    setTemaState(cor);
    try {
      await ConfigService.salvarCor(cor);  // persiste no banco → vem no backup
    } catch {
      // se falhar o salvamento, a cor ainda fica aplicada localmente
    }
  };

  useEffect(() => { setForm(config); }, [config]);
  useEffect(() => { FolderStorage.nomePasta().then(setNomePasta); }, []);

  const handle = (field: keyof TConfig) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: field === 'totalMesas' ? Number(e.target.value) : e.target.value }));

  const salvar = async () => {
    setSaving(true);
    try {
      await onSalvar(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setMsg({ tipo: 'erro', texto: e.message });
    } finally {
      setSaving(false);
    }
  };

  // ── Exportar backup nativo (.backup via pg_dump) ──────────
  const exportarBackup = async () => {
    setExportando(true);
    setMsg(null);
    try {
      const nome = await BackupService.baixarBackup();
      setMsg({ tipo: 'ok', texto: `Backup gerado: ${nome}` });
    } catch (e: any) {
      setMsg({ tipo: 'erro', texto: `Erro ao gerar backup: ${e.message}` });
    } finally {
      setExportando(false);
    }
  };

  // ── Importar/restaurar backup nativo (.backup via pg_restore) ──
  const importarBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const confirmar = window.confirm(
      `Restaurar o backup "${file.name}"?\n\n` +
      `ATENÇÃO: TODOS os dados atuais serão SUBSTITUÍDOS pelos dados do arquivo.\n` +
      `Esta ação não pode ser desfeita.`
    );
    if (!confirmar) { if (fileRef.current) fileRef.current.value = ''; return; }

    setImportando(true);
    setMsg(null);
    try {
      const r = await BackupService.restaurarBackup(file);
      setMsg({ tipo: 'ok', texto: `Backup restaurado (${(r.tamanho / 1024).toFixed(0)} KB). Recarregando...` });
      setTimeout(() => window.location.reload(), 2000);
    } catch (err: any) {
      setMsg({ tipo: 'erro', texto: `Erro ao restaurar: ${err.message}` });
    } finally {
      setImportando(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const escolherPasta = async () => {
    const nome = await FolderStorage.escolherPasta();
    if (nome) setNomePasta(nome);
  };

  const removerPasta = async () => {
    await FolderStorage.removerPasta();
    setNomePasta(null);
  };

  const limparDados = async () => {
    if (!window.confirm(
      'ATENÇÃO: Esta ação irá APAGAR TODOS os dados permanentemente.\n\n' +
      'Produtos, mesas, caixas, pedidos e movimentações serão zerados.\n' +
      'O banco voltará ao estado inicial (do zero).\n\n' +
      'Faça um backup antes de continuar! Deseja prosseguir?'
    )) return;
    const senha = window.prompt('Digite "CONFIRMAR" (em maiúsculas) para zerar o banco:');
    if (senha !== 'CONFIRMAR') { alert('Operação cancelada.'); return; }

    setZerando(true);
    setMsg(null);
    try {
      await BackupService.zerarBanco();
      setMsg({ tipo: 'ok', texto: 'Banco zerado com sucesso. Recarregando...' });
      setTimeout(() => window.location.reload(), 1500);
    } catch (e: any) {
      setMsg({ tipo: 'erro', texto: `Erro ao zerar banco: ${e.message}` });
      setZerando(false);
    }
  };

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold text-primary-900">Configurações</h1>
        <p className="text-sm text-primary-500 mt-1">Personalize e gerencie o sistema</p>
      </div>

      {/* Estabelecimento */}
      <Card className="p-5 space-y-4">
        <h2 className="font-semibold text-primary-700">Estabelecimento</h2>
        <Input label="Nome" value={form.nomeEstabelecimento} onChange={handle('nomeEstabelecimento')} />
        <Input label="Telefone (opcional)" value={form.telefone ?? ''} onChange={handle('telefone')} placeholder="(44) 99999-9999" />
        <Input label="Endereço (opcional)" value={form.endereco ?? ''} onChange={handle('endereco')} placeholder="Rua Exemplo, 123" />
        <Input label="Total de mesas" type="number" min={1} max={50} value={form.totalMesas} onChange={handle('totalMesas')} />
        <Button onClick={salvar} size="md" loading={saving}>
          <Save size={14} /> {saved ? '✓ Salvo!' : 'Salvar configurações'}
        </Button>
      </Card>

      {/* Cor principal (tema) — singelo */}
      <Card className="p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <span className="flex items-center gap-2 text-sm font-medium text-primary-700">
            <Palette size={15} className="text-primary-400" /> Cor do sistema
          </span>
          <div className="flex gap-2.5">
            {TEMAS.map((t) => (
              <button
                key={t.id}
                onClick={() => escolherCor(t.id)}
                title={t.nome}
                aria-label={t.nome}
                className={`w-7 h-7 rounded-full transition-all
                  ${tema === t.id
                    ? 'ring-2 ring-offset-2 ring-primary-400 scale-110'
                    : 'opacity-60 hover:opacity-100 hover:scale-110'}`}
                style={{ backgroundColor: t.cor }}
              />
            ))}
          </div>
        </div>
      </Card>

      {/* Pasta automática */}
      {fsSuportado && (
        <Card className="p-5 space-y-4">
          <h2 className="font-semibold text-primary-700 flex items-center gap-2">
            <Folder size={16} /> Pasta de backups automáticos
          </h2>
          <p className="text-xs text-primary-500">
            Escolha uma pasta no seu computador. Backups serão salvos automaticamente.
          </p>
          {nomePasta ? (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-3">
              <Folder size={18} className="text-green-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-green-800 truncate">📁 {nomePasta}</p>
                <p className="text-xs text-green-600">Backups salvos automaticamente aqui</p>
              </div>
              <button onClick={removerPasta} className="text-green-400 hover:text-red-500 p-1">
                <FolderX size={16} />
              </button>
            </div>
          ) : (
            <Button variant="secondary" onClick={escolherPasta} className="w-full">
              <Folder size={14} /> Escolher pasta no computador
            </Button>
          )}
        </Card>
      )}

      {/* Backup / Restauração */}
      <Card className="p-5 space-y-4">
        <h2 className="font-semibold text-primary-700 flex items-center gap-2">
          <FileText size={16} /> Backup do Banco de Dados
        </h2>
        <p className="text-sm text-primary-500">
          Gera um backup nativo do PostgreSQL no formato <strong>.backup</strong> (pg_dump),
          o mesmo padrão usado por sistemas profissionais. Restaure a qualquer momento
          importando o arquivo — schema, dados e sequências são preservados integralmente.
        </p>

        {msg && (
          <div className={`flex items-center gap-2 p-3 rounded-xl text-sm border
            ${msg.tipo === 'ok' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
            {msg.tipo === 'ok' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
            {msg.texto}
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={exportarBackup} loading={exportando}>
            <Download size={14} /> Exportar Backup
          </Button>
          <Button variant="secondary" className="flex-1" onClick={() => fileRef.current?.click()} loading={importando}>
            <Upload size={14} /> Restaurar Backup
          </Button>
          <input ref={fileRef} type="file" accept=".backup" onChange={importarBackup} className="hidden" />
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
          <strong>Fluxo recomendado:</strong> exporte o backup ao final de cada expediente
          e guarde o arquivo <code>.backup</code> em local seguro. Para restaurar, basta
          importar o arquivo — todos os dados anteriores são substituídos pelos do backup.
        </div>
      </Card>

      {/* Zona de perigo */}
      <Card className="p-5 border-red-100 space-y-3">
        <h2 className="font-semibold text-red-600 flex items-center gap-2">
          <AlertCircle size={15} /> Zona de Perigo
        </h2>
        <p className="text-sm text-primary-500">
          Zera <strong>todas</strong> as tabelas (TRUNCATE) e reinicia o banco do zero.
          Exporte um backup antes de continuar — esta ação é irreversível.
        </p>
        <Button variant="danger" onClick={limparDados} size="sm" loading={zerando}>
          <Trash2 size={13} /> Zerar banco de dados
        </Button>
      </Card>

      {/* Informações do sistema */}
      <div className="text-xs text-primary-400 flex items-center gap-2 pb-2">
        <Info size={12} />
        <span>Lanchonete ERP v1.1 · Node.js + React + PostgreSQL</span>
      </div>
    </div>
  );
}
