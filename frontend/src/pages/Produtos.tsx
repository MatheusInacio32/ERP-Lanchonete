import { useState, useMemo } from 'react';
import { Plus, Pencil, Search, ChevronDown, ChevronUp, EyeOff, AlertCircle, Trash2 } from 'lucide-react';
import { Card, Button, Input, Select, Modal, Badge } from '../components/ui';
import { formatMoeda } from '../utils';
import type { Produto, Categoria } from '../types';


const CATEGORIAS: Categoria[] = ['Lanches', 'Bebidas', 'Porcoes', 'Sobremesas', 'Outros'];
const CAT_BADGE: Record<Categoria, 'orange' | 'blue' | 'red' | 'green' | 'gray'> = {
  Lanches: 'orange', Bebidas: 'blue', Porcoes: 'red', Sobremesas: 'green', Outros: 'gray',
};

interface Props {
  produtos: Produto[];
  onSalvar: (dados: Omit<Produto, 'id' | 'criadoEm' | 'ativo'> & { id?: string }) => void;
  onInativar: (id: string) => Promise<void>;
  onReativar: (id: string) => Promise<void>;
  onExcluir: (id: string) => Promise<void>;
}

interface FormState { codigo: string; nome: string; categoria: Categoria; preco: string; }
const FORM_VAZIO: FormState = { codigo: '', nome: '', categoria: 'Lanches', preco: '' };

export function Produtos({ produtos, onSalvar, onInativar, onReativar, onExcluir }: Props) {
  const [busca, setBusca] = useState('');
  const [catFiltro, setCatFiltro] = useState<string>('Todas');
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Produto | null>(null);
  const [form, setForm] = useState<FormState>(FORM_VAZIO);
  const [erros, setErros] = useState<Partial<Record<keyof FormState, string>>>({});
  const [confirmarInativar, setConfirmarInativar] = useState<Produto | null>(null);
  const [confirmarExcluir, setConfirmarExcluir] = useState<Produto | null>(null);
  const [mostrarInativos, setMostrarInativos] = useState(false);

  // IDs de produtos que já foram usados (vem do backend com flag foi_usado)
  const produtosUsados = useMemo(() => {
    const ids = new Set<string>();
    produtos.forEach((p: any) => {
      if (p.foi_usado) ids.add(p.id);
    });
    return ids;
  }, [produtos]);

  const ativos = useMemo(() => produtos.filter((p) => p.ativo), [produtos]);
  const inativos = useMemo(() => produtos.filter((p) => !p.ativo), [produtos]);

  const filtrados = useMemo(() => {
    return ativos.filter((p) => {
      const matchBusca =
        p.nome.toLowerCase().includes(busca.toLowerCase()) ||
        p.codigo.includes(busca);
      const matchCat = catFiltro === 'Todas' || p.categoria === catFiltro;
      return matchBusca && matchCat;
    });
  }, [ativos, busca, catFiltro]);

  const abrirNovo = () => {
    setEditando(null);
    setForm(FORM_VAZIO);
    setErros({});
    setModal(true);
  };

  const abrirEditar = (p: Produto) => {
    setEditando(p);
    // preco vem como string da API (NUMERIC do PostgreSQL) — Number() garante o toFixed
    setForm({ codigo: p.codigo, nome: p.nome, categoria: p.categoria, preco: Number(p.preco).toFixed(2) });
    setErros({});
    setModal(true);
  };

  const validar = (): boolean => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.codigo.trim()) e.codigo = 'Código obrigatório';
    else {
      // Verificar duplicidade de código
      const duplicado = ativos.find(
        (p) => p.codigo === form.codigo.trim() && p.id !== editando?.id
      );
      if (duplicado) e.codigo = `Código já usado por "${duplicado.nome}"`;
    }
    if (!form.nome.trim()) e.nome = 'Nome obrigatório';
    const preco = parseFloat(form.preco.replace(',', '.'));
    if (isNaN(preco) || preco <= 0) e.preco = 'Preço inválido';
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const salvar = () => {
    if (!validar()) return;
    onSalvar({
      id: editando?.id,
      codigo: form.codigo.trim(),
      nome: form.nome.trim(),
      categoria: form.categoria,
      preco: parseFloat(form.preco.replace(',', '.')),
    });
    setModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary-900">Produtos</h1>
          <p className="text-sm text-primary-500 mt-1">
            {ativos.length} ativos · {inativos.length} inativos
          </p>
        </div>
        <Button onClick={abrirNovo} size="md">
          <Plus size={15} /> Novo Produto
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou código..."
            className="w-full pl-9 pr-3 py-2 border border-primary-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-400 bg-white"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide sm:flex-wrap">
          {['Todas', ...CATEGORIAS].map((cat) => (
            <button
              key={cat}
              onClick={() => setCatFiltro(cat)}
              className={`px-3 py-1.5 text-xs rounded-xl font-medium transition-colors shrink-0 whitespace-nowrap
                ${catFiltro === cat
                  ? 'bg-accent-500 text-white shadow-md'
                  : 'bg-primary-100 text-primary-600 hover:bg-primary-200'}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela de produtos */}
      {filtrados.length === 0 ? (
        <Card className="p-10 text-center text-primary-400">
          <p className="text-3xl mb-2">🍔</p>
          <p className="text-sm">Nenhum produto encontrado</p>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primary-50 border-b border-primary-100 text-left">
                <th className="px-3 sm:px-4 py-3 text-xs font-bold text-primary-500 uppercase tracking-wider w-20">Código</th>
                <th className="px-3 sm:px-4 py-3 text-xs font-bold text-primary-500 uppercase tracking-wider">Nome</th>
                <th className="px-3 sm:px-4 py-3 text-xs font-bold text-primary-500 uppercase tracking-wider hidden sm:table-cell">Categoria</th>
                <th className="px-3 sm:px-4 py-3 text-xs font-bold text-primary-500 uppercase tracking-wider text-right">Preço</th>
                <th className="px-3 sm:px-4 py-3 text-xs font-bold text-primary-500 uppercase tracking-wider text-right w-20">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary-50">
              {filtrados.map((p) => (
                <tr key={p.id} className="hover:bg-primary-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono font-bold text-primary-700 bg-primary-100 px-2 py-0.5 rounded text-xs">
                      {p.codigo}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-primary-900">{p.nome}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <Badge label={p.categoria} color={CAT_BADGE[p.categoria]} />
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-accent-600">{formatMoeda(p.preco)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => abrirEditar(p)}
                        className="p-1.5 rounded-lg hover:bg-primary-100 text-primary-400 hover:text-primary-700 transition-colors"
                        title="Editar"
                      >
                        <Pencil size={13} />
                      </button>
                      {produtosUsados.has(p.id) ? (
                        // Já foi usado: inativar apenas
                        <button
                          onClick={() => setConfirmarInativar(p)}
                          className="p-1.5 rounded-lg hover:bg-amber-50 text-primary-300 hover:text-amber-500 transition-colors"
                          title="Inativar produto"
                        >
                          <EyeOff size={13} />
                        </button>
                      ) : (
                        // Nunca usado: pode excluir definitivamente
                        <button
                          onClick={() => setConfirmarExcluir(p)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-primary-300 hover:text-red-500 transition-colors"
                          title="Excluir produto"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Seção de inativos (colapsável) */}
      {inativos.length > 0 && (
        <div>
          <button
            onClick={() => setMostrarInativos((v) => !v)}
            className="flex items-center gap-2 text-sm text-primary-400 hover:text-primary-600 transition-colors mb-3"
          >
            {mostrarInativos ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            <EyeOff size={13} />
            Produtos inativados ({inativos.length})
          </button>

          {mostrarInativos && (
            <Card className="overflow-hidden opacity-70">
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                <p className="text-xs text-gray-500 font-medium">Estes produtos não aparecem no lançamento de pedidos</p>
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-50">
                  {inativos.map((p) => (
                    <tr key={p.id} className="bg-gray-50/50">
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{p.codigo}</span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 line-through">{p.nome}</td>
                      <td className="px-4 py-2.5 text-gray-400 text-xs hidden sm:table-cell">{p.categoria}</td>
                      <td className="px-4 py-2.5 text-right text-gray-400">{formatMoeda(p.preco)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={async () => { try { await onReativar(p.id); } catch(e:any){alert(e.message);} }}
                          className="text-xs text-green-600 hover:text-green-700 font-medium px-2 py-1 hover:bg-green-50 rounded-lg transition-colors"
                        >
                          Reativar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}

      {/* Modal salvar produto */}
      <Modal open={modal} onClose={() => setModal(false)} title={editando ? 'Editar Produto' : 'Novo Produto'} size="sm">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-primary-700 block mb-1">Código do produto</label>
            <input
              autoFocus
              value={form.codigo}
              onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
              placeholder="Ex: 100, 2, 50..."
              className={`w-full border rounded-xl px-3 py-2 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-accent-400
                ${erros.codigo ? 'border-red-400 bg-red-50' : 'border-primary-200'}`}
            />
            {erros.codigo && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle size={11} /> {erros.codigo}
              </p>
            )}
          </div>

          <Input
            label="Nome do produto"
            value={form.nome}
            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            error={erros.nome}
            placeholder="Ex: X-Burguer"
          />
          <Select
            label="Categoria"
            value={form.categoria}
            onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value as Categoria }))}
            options={CATEGORIAS.map((c) => ({ value: c, label: c }))}
          />
          <Input
            label="Preço (R$)"
            value={form.preco}
            onChange={(e) => setForm((f) => ({ ...f, preco: e.target.value }))}
            error={erros.preco}
            placeholder="0,00"
            inputMode="decimal"
          />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setModal(false)}>Cancelar</Button>
            <Button className="flex-1" onClick={salvar}>
              {editando ? 'Salvar' : 'Adicionar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal confirmar inativar */}
      {confirmarInativar && (
        <Modal open onClose={() => setConfirmarInativar(null)} title="Inativar Produto" size="sm">
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 flex items-start gap-2">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <p>
                <strong>{confirmarInativar.nome}</strong> será inativado e não aparecerá mais
                nos pedidos. O histórico de vendas é preservado. Você pode reativar depois.
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirmarInativar(null)}>Cancelar</Button>
              <Button variant="danger" className="flex-1"
                onClick={async () => { try { await onInativar(confirmarInativar.id); } catch(e:any){alert(e.message);} setConfirmarInativar(null); }}>
                <EyeOff size={13} /> Inativar
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal confirmar excluir (só para nunca usados) */}
      {confirmarExcluir && (
        <Modal open onClose={() => setConfirmarExcluir(null)} title="Excluir Produto" size="sm">
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-800 flex items-start gap-2">
              <Trash2 size={15} className="shrink-0 mt-0.5" />
              <p>
                <strong>{confirmarExcluir.nome}</strong> será removido permanentemente.
                Como nunca foi usado em nenhum pedido, a exclusão é segura.
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirmarExcluir(null)}>Cancelar</Button>
              <Button variant="danger" className="flex-1"
                onClick={async () => { try { await onExcluir(confirmarExcluir.id); } catch(e:any){alert(e.message);} setConfirmarExcluir(null); }}>
                <Trash2 size={13} /> Excluir
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
