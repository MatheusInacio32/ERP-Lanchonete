import { useEffect, useRef, useState } from 'react';
import { Hash, CheckCircle2, AlertCircle } from 'lucide-react';
import type { Produto } from '../types';
import { formatMoeda } from '../utils';

interface Props {
  produtos: Produto[];
  onAdicionar: (produto: Produto, quantidade: number, obs: string) => Promise<void> | void;
  autoFocus?: boolean;
}

export function QuickCodeInput({ produtos, onAdicionar, autoFocus = true }: Props) {
  const [codigo, setCodigo] = useState('');
  const [quantidade, setQuantidade] = useState<string>('1');
  const [stage, setStage] = useState<'codigo' | 'quantidade'>('codigo');
  const [adicionados, setAdicionados] = useState<{ nome: string; qtd: number }[]>([]);

  const inputCodigoRef = useRef<HTMLInputElement>(null);
  const inputQtdRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputCodigoRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (stage === 'quantidade') {
      inputQtdRef.current?.focus();
      inputQtdRef.current?.select();
    }
    if (stage === 'codigo') {
      inputCodigoRef.current?.focus();
    }
  }, [stage]);

  const produtoEncontrado = codigo
    ? produtos.find((p) => p.codigo === codigo.trim() && p.ativo) ?? null
    : null;

  const [adicionando, setAdicionando] = useState(false);

  const confirmar = async () => {
    if (!produtoEncontrado || adicionando) return;
    setAdicionando(true);
    const qtd = Math.max(1, parseInt(quantidade) || 1);
    try {
      await onAdicionar(produtoEncontrado, qtd, '');
      setAdicionados((prev) => [{ nome: produtoEncontrado.nome, qtd }, ...prev.slice(0, 4)]);
    } finally {
      setCodigo('');
      setQuantidade('1');
      setStage('codigo');
      setAdicionando(false);
    }
  };

  const handleCodigoKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && produtoEncontrado) {
      e.preventDefault();
      setStage('quantidade');
    }
    if (e.key === 'Escape') {
      setCodigo('');
      setQuantidade('1');
      setStage('codigo');
    }
  };

  const handleQtdKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); confirmar(); }
    if (e.key === 'Escape') { setStage('codigo'); setCodigo(''); setQuantidade('1'); }
    if (e.key === 'Backspace' && !quantidade) { setStage('codigo'); }
  };

  return (
    <div className="space-y-4">
      {/* Campo de código */}
      <div>
        <label className="block text-xs font-semibold text-primary-500 uppercase tracking-wider mb-1.5">
          Código do produto
        </label>
        <div className="relative">
          <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-400" />
          <input
            ref={inputCodigoRef}
            type="text"
            inputMode="decimal"
            value={codigo}
            onChange={(e) => { setCodigo(e.target.value); setStage('codigo'); }}
            onKeyDown={handleCodigoKey}
            placeholder="Digite o código e Enter..."
            autoComplete="off"
            className="w-full pl-9 pr-4 py-3 text-xl font-bold border-2 border-primary-200 focus:border-accent-500 rounded-xl focus:outline-none bg-white transition-colors"
          />
        </div>

        {/* Feedback produto */}
        {codigo && (
          <div className={`mt-2 px-4 py-3 rounded-xl border flex items-center gap-3 transition-all
            ${produtoEncontrado
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'}`}>
            {produtoEncontrado ? (
              <>
                <CheckCircle2 size={18} className="text-green-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-green-800 truncate">{produtoEncontrado.nome}</p>
                  <p className="text-xs text-green-600">{formatMoeda(produtoEncontrado.preco)} · {produtoEncontrado.categoria}</p>
                </div>
                <span className="text-xs text-green-600 font-medium shrink-0">ENTER ↵</span>
              </>
            ) : (
              <>
                <AlertCircle size={18} className="text-red-400 shrink-0" />
                <p className="text-sm text-red-600">Código não encontrado</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Campo de quantidade (aparece após encontrar produto) */}
      {stage === 'quantidade' && produtoEncontrado && (
        <div>
          <label className="block text-xs font-semibold text-primary-500 uppercase tracking-wider mb-1.5">
            Quantidade
          </label>
          <input
            ref={inputQtdRef}
            type="number"
            min={1}
            max={99}
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            onKeyDown={handleQtdKey}
            className="w-full px-4 py-3 text-2xl font-bold border-2 border-accent-400 focus:border-accent-600 rounded-xl focus:outline-none bg-accent-50 text-center transition-colors"
          />
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-primary-500">ESC = voltar ao código</span>
            <span className="text-lg font-black text-accent-600">
              = {formatMoeda(produtoEncontrado.preco * (parseInt(quantidade) || 1))}
            </span>
          </div>
        </div>
      )}

      {/* Últimos adicionados nesta sessão */}
      {adicionados.length > 0 && (
        <div className="border-t border-primary-100 pt-3">
          <p className="text-xs text-primary-400 font-medium mb-2">Recém adicionados</p>
          <div className="space-y-1">
            {adicionados.map((a, i) => (
              <div key={i} className="flex justify-between text-xs text-primary-600 py-0.5">
                <span>{a.qtd}× {a.nome}</span>
                <span className="text-green-500 font-medium">✓</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
