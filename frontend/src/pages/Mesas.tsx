import { useState, useEffect, useRef, useCallback } from 'react';
import { Clock, UtensilsCrossed, Hash, Lock } from 'lucide-react';
import { formatHora, formatMoeda } from '../utils';
import type { Mesa, Pedido } from '../types';
import { Button } from '../components/ui';

interface Props {
  mesas: Mesa[];
  pedidos: Pedido[];  // mantido para compatibilidade mas não usado no card
  caixaAberto: boolean;
  onAbrirMesa: (mesaId: string) => void;
  onSelecionarMesa: (mesa: Mesa) => void;
  onCancelarMesa: (mesaId: string) => void;
  onIrParaCaixa: () => void;
  modalFechado: number;
}

export function Mesas({
  mesas, caixaAberto, onAbrirMesa, onSelecionarMesa,
  onCancelarMesa, onIrParaCaixa, modalFechado,
}: Props) {
  const [inputNum, setInputNum] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const mesasLivres = mesas.filter((m) => m.status === 'livre');
  const mesasOcupadas = mesas.filter((m) => m.status === 'ocupada');

  // Foco automático ao montar
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Devolve foco sempre que o modal fecha (modalFechado muda)
  useEffect(() => {
    if (modalFechado > 0) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [modalFechado]);

  const abrirMesa = useCallback((mesa: Mesa) => {
    if (!caixaAberto) return; // bloqueio via prop (já tratado na camada acima)
    setInputNum('');
    if (mesa.status === 'livre') {
      onAbrirMesa(mesa.id);
      setTimeout(() => onSelecionarMesa({ ...mesa, status: 'ocupada' }), 80);
    } else {
      onSelecionarMesa(mesa);
    }
  }, [caixaAberto, onAbrirMesa, onSelecionarMesa]);

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { setInputNum(''); return; }
    if (e.key === 'Enter') {
      const num = parseInt(inputNum, 10);
      if (!num) return;
      const mesa = mesas.find((m) => m.numero === num);
      if (!mesa) { setInputNum(''); return; }
      abrirMesa(mesa);
    }
  }, [inputNum, mesas, abrirMesa]);

  // Bloqueio: caixa fechado
  if (!caixaAberto) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
        <div className="w-20 h-20 rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center">
          <Lock size={36} className="text-red-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-primary-900 mb-2">Caixa fechado</h2>
          <p className="text-primary-500 text-sm max-w-xs mx-auto">
            Você precisa abrir o caixa antes de acessar as mesas e registrar pedidos.
          </p>
        </div>
        <Button variant="success" size="lg" onClick={onIrParaCaixa}>
          Ir para o Caixa
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + input */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary-900">Mesas</h1>
          <p className="text-sm text-primary-600 mt-1">
            <span className="font-semibold">{mesasOcupadas.length}</span> ocupadas ·{' '}
            <span className="font-semibold">{mesasLivres.length}</span> livres ·{' '}
            <span className="font-semibold">{mesas.length}</span> total
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-400" />
            <input
              ref={inputRef}
              type="number"
              min={1}
              value={inputNum}
              onChange={(e) => setInputNum(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Nº da mesa + Enter"
              className="pl-9 pr-4 py-2.5 w-52 border-2 border-accent-300 focus:border-accent-500 rounded-xl text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-accent-200 text-primary-900 placeholder:text-primary-400 transition-all"
            />
          </div>
          <span className="text-xs text-primary-400 hidden md:block">ESC limpa</span>
        </div>
      </div>

      {/* Livres */}
      {mesasLivres.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2.5 h-2.5 rounded-full bg-primary-300 inline-block" />
            <h2 className="text-xs font-bold text-primary-500 uppercase tracking-widest">
              Livres ({mesasLivres.length})
            </h2>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-9 gap-2.5">
            {mesasLivres.map((mesa) => (
              <MesaCard key={mesa.id} mesa={mesa} onClick={() => abrirMesa(mesa)} />
            ))}
          </div>
        </section>
      )}

      {/* Divisor */}
      {mesasLivres.length > 0 && mesasOcupadas.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-primary-200" />
          <span className="text-xs text-primary-400 font-medium">Em uso</span>
          <div className="flex-1 h-px bg-primary-200" />
        </div>
      )}

      {/* Ocupadas */}
      {mesasOcupadas.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2.5 h-2.5 rounded-full bg-accent-500 animate-pulse inline-block" />
            <h2 className="text-xs font-bold text-accent-600 uppercase tracking-widest">
              Ocupadas ({mesasOcupadas.length})
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {mesasOcupadas.map((mesa) => (
              <MesaCard
                key={mesa.id}
                mesa={mesa}
                onClick={() => abrirMesa(mesa)}
                onCancelar={() => { onCancelarMesa(mesa.id); setTimeout(() => inputRef.current?.focus(), 50); }}
              />
            ))}
          </div>
        </section>
      )}

      {mesas.length === 0 && (
        <div className="text-center py-16 text-primary-400">
          <p className="text-4xl mb-3">🍽️</p>
          <p className="text-sm">Nenhuma mesa configurada.</p>
        </div>
      )}
    </div>
  );
}

function MesaCard({ mesa, onClick, onCancelar }: {
  mesa: Mesa; onClick: () => void; onCancelar?: () => void;
}) {
  const livre = mesa.status === 'livre';
  // Usa dados enriquecidos do backend (JOIN com pedido ativo)
  const totalItens = mesa.pedido_itens ?? 0;
  const total      = Number(mesa.pedido_total ?? 0);
  const semItens   = !livre && totalItens === 0;

  return (
    <div className="relative group">
      <button
        onClick={onClick}
        className={`w-full rounded-xl p-3 text-left transition-all duration-200 hover:shadow-lg hover:scale-105
          ${livre
            ? 'bg-white border-2 border-primary-200 hover:border-primary-400'
            : 'bg-gradient-to-br from-accent-50 to-accent-100 border-2 border-accent-300 hover:border-accent-500 shadow-md'
          }`}
      >
        <span className={`absolute top-2 right-2 w-2 h-2 rounded-full
          ${livre ? 'bg-primary-300' : 'bg-accent-500 animate-pulse shadow-sm shadow-accent-400'}`} />
        <div className={`text-3xl font-black leading-none mb-2 ${livre ? 'text-primary-500' : 'text-accent-700'}`}>
          {mesa.numero}
        </div>
        {livre ? (
          <p className="text-xs text-primary-400 font-medium">Livre</p>
        ) : (
          <div className="space-y-1">
            {mesa.abertaEm && (
              <div className="flex items-center gap-1 text-xs text-primary-500">
                <Clock size={10} /><span>{formatHora(mesa.abertaEm)}</span>
              </div>
            )}
            {totalItens > 0 ? (
              <>
                <div className="flex items-center gap-1 text-xs text-primary-500">
                  <UtensilsCrossed size={10} /><span>{totalItens} it.</span>
                </div>
                <p className="text-sm font-black text-accent-600">{formatMoeda(total)}</p>
              </>
            ) : (
              <p className="text-xs text-primary-400 italic">Sem itens</p>
            )}
          </div>
        )}
      </button>
      {semItens && onCancelar && (
        <button
          onClick={(e) => { e.stopPropagation(); onCancelar(); }}
          title="Cancelar mesa (sem itens)"
          className="absolute -top-1.5 -left-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md font-bold"
        >×</button>
      )}
    </div>
  );
}
