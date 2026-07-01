import { useState } from 'react';
import { Printer, FileText, CheckCircle2, AlertCircle, Tag } from 'lucide-react';
import { Button } from '../components/ui';
import { formatMoeda, gerarPDF, imprimirConta } from '../utils';
import type { Pedido, Mesa, FormaPagamento } from '../types';

interface Props {
  pedido: Pedido;
  mesa: Mesa;
  config: { nomeEstabelecimento: string; telefone?: string };
  onFechar: (forma: FormaPagamento, valorRecebido: number, desconto: number, acrescimo: number) => void;
}

const FORMAS: { id: FormaPagamento; label: string; icon: string; desc?: string }[] = [
  { id: 'dinheiro', label: 'Dinheiro',  icon: '💵' },
  { id: 'pix',      label: 'PIX',       icon: '📱' },
  { id: 'debito',   label: 'Débito',    icon: '💳', desc: 'Cartão' },
  { id: 'credito',  label: 'Crédito',   icon: '💎', desc: 'Cartão' },
  { id: 'voucher',  label: 'Voucher',   icon: '🎫', desc: 'Vale-refeição' },
];

type Tipo = 'rs' | 'pct';

export function FechamentoConta({ pedido, mesa, config, onFechar }: Props) {
  const [forma, setForma]       = useState<FormaPagamento>('dinheiro');
  const [valorStr, setValorStr] = useState('');
  const [erro, setErro]         = useState('');
  const [ajustes, setAjustes]   = useState(false);
  const [descStr, setDescStr]   = useState('');
  const [descTipo, setDescTipo] = useState<Tipo>('rs');
  const [acrStr, setAcrStr]     = useState('');
  const [acrTipo, setAcrTipo]   = useState<Tipo>('rs');

  const subtotal = Number(pedido.total);

  // converte campo (R$ ou %) para valor em R$ sobre o subtotal
  const emReais = (str: string, tipo: Tipo) => {
    const n = parseFloat(str.replace(',', '.')) || 0;
    return tipo === 'pct' ? (subtotal * n) / 100 : n;
  };
  const descontoRS  = Math.min(subtotal, Math.max(0, emReais(descStr, descTipo)));
  const acrescimoRS = Math.max(0, emReais(acrStr, acrTipo));
  const totalFinal  = Math.max(0, subtotal - descontoRS + acrescimoRS);
  const temAjuste   = descontoRS > 0 || acrescimoRS > 0;

  const isDinheiro = forma === 'dinheiro';
  const valorRecebido = parseFloat(valorStr.replace(',', '.')) || 0;
  const troco = Math.max(0, valorRecebido - totalFinal);
  const valorInsuficiente = isDinheiro && valorStr !== '' && valorRecebido < totalFinal;

  const handleFechar = () => {
    if (isDinheiro) {
      const v = parseFloat(valorStr.replace(',', '.'));
      if (isNaN(v) || v <= 0) { setErro('Informe o valor recebido'); return; }
      if (v < totalFinal)     { setErro('Valor insuficiente para cobrir o total'); return; }
    }
    setErro('');
    onFechar(forma, isDinheiro ? valorRecebido : totalFinal, descontoRS, acrescimoRS);
  };

  return (
    <div className="px-5 py-4 space-y-5">
      {/* Resumo dos itens */}
      <div>
        <h3 className="text-sm font-semibold text-primary-600 mb-2">Resumo do Consumo</h3>
        <div className="bg-primary-50 rounded-xl p-3 space-y-1.5 max-h-40 overflow-y-auto">
          {pedido.itens.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span className="text-primary-700">
                {item.quantidade}x {item.nomeProduto ?? (item as any).nome_produto}
                {item.observacao && <span className="text-xs text-primary-400 ml-1">({item.observacao})</span>}
              </span>
              <span className="font-medium text-primary-900">{formatMoeda(item.subtotal)}</span>
            </div>
          ))}
        </div>

        {/* Totais */}
        <div className="mt-3 pt-3 border-t border-primary-200 space-y-1">
          {temAjuste && (
            <>
              <div className="flex justify-between text-sm text-primary-500">
                <span>Subtotal</span><span>{formatMoeda(subtotal)}</span>
              </div>
              {descontoRS > 0 && (
                <div className="flex justify-between text-sm text-red-500">
                  <span>Desconto</span><span>−{formatMoeda(descontoRS)}</span>
                </div>
              )}
              {acrescimoRS > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Acréscimo</span><span>+{formatMoeda(acrescimoRS)}</span>
                </div>
              )}
            </>
          )}
          <div className="flex justify-between items-center">
            <span className="font-bold text-primary-700 text-base">Total</span>
            <span className="text-2xl font-black text-accent-600">{formatMoeda(totalFinal)}</span>
          </div>
        </div>
      </div>

      {/* Desconto / Acréscimo */}
      {!ajustes ? (
        <button
          onClick={() => setAjustes(true)}
          className="text-sm text-accent-600 hover:text-accent-700 font-medium flex items-center gap-1.5"
        >
          <Tag size={14} /> Aplicar desconto ou acréscimo
        </button>
      ) : (
        <div className="space-y-3 bg-primary-50 rounded-xl p-3">
          <CampoAjuste label="Desconto"  valor={descStr} setValor={(v) => { setDescStr(v); setErro(''); }} tipo={descTipo} setTipo={setDescTipo} />
          <CampoAjuste label="Acréscimo / taxa de serviço" valor={acrStr} setValor={(v) => { setAcrStr(v); setErro(''); }} tipo={acrTipo} setTipo={setAcrTipo} />
          <div className="flex gap-2 flex-wrap pt-0.5">
            <button onClick={() => { setAcrStr('10'); setAcrTipo('pct'); }}
              className="px-2.5 py-1 text-xs bg-white border border-primary-200 hover:border-accent-300 rounded-lg font-medium text-primary-600">
              + 10% serviço
            </button>
            <button onClick={() => { setDescStr(''); setAcrStr(''); setDescTipo('rs'); setAcrTipo('rs'); setAjustes(false); }}
              className="px-2.5 py-1 text-xs bg-white border border-primary-200 hover:border-red-300 rounded-lg font-medium text-primary-500">
              Remover
            </button>
          </div>
        </div>
      )}

      {/* Formas de pagamento */}
      <div>
        <h3 className="text-sm font-semibold text-primary-600 mb-2">Forma de Pagamento</h3>
        <div className="grid grid-cols-3 gap-2">
          {FORMAS.map((f) => (
            <button key={f.id}
              onClick={() => { setForma(f.id); setValorStr(''); setErro(''); }}
              className={`py-3 px-2 rounded-xl text-sm font-medium flex flex-col items-center gap-0.5 transition-all
                ${forma === f.id
                  ? 'bg-accent-600 text-white shadow-md shadow-accent-200'
                  : 'bg-primary-100 text-primary-600 hover:bg-primary-200'}`}>
              <span className="text-xl">{f.icon}</span>
              <span>{f.label}</span>
              {f.desc && <span className={`text-[10px] ${forma === f.id ? 'text-white/70' : 'text-primary-400'}`}>{f.desc}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Troco (apenas dinheiro) */}
      {isDinheiro && (
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-primary-700 block mb-1">Valor Recebido (R$)</label>
            <input
              autoFocus value={valorStr}
              onChange={(e) => { setValorStr(e.target.value); setErro(''); }}
              placeholder="0,00" inputMode="decimal"
              className={`w-full border rounded-xl px-4 py-3 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-accent-500 text-center
                ${valorInsuficiente ? 'border-accent-400 bg-accent-50' : 'border-primary-200'}`}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {[50, 60, 70, 80, 100].map((v) => (
              <button key={v}
                onClick={() => { setValorStr(v.toString()); setErro(''); }}
                className="px-3 py-1.5 text-xs bg-primary-100 hover:bg-accent-100 hover:text-accent-700 rounded-lg font-medium transition-colors">
                R$ {v}
              </button>
            ))}
          </div>
          {valorStr && !valorInsuficiente && valorRecebido > 0 && (
            <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 flex items-center gap-3">
              <CheckCircle2 className="text-accent-600 shrink-0" size={22} />
              <div>
                <p className="text-xs text-primary-600 font-medium">Troco a devolver</p>
                <p className="text-2xl font-black text-accent-600">{formatMoeda(troco)}</p>
              </div>
            </div>
          )}
          {valorInsuficiente && (
            <div className="bg-accent-50 border border-accent-200 rounded-xl p-3 flex items-center gap-2 text-accent-600">
              <AlertCircle size={16} />
              <p className="text-sm font-medium">Faltam {formatMoeda(totalFinal - valorRecebido)}</p>
            </div>
          )}
        </div>
      )}

      {erro && (
        <p className="text-sm text-accent-600 flex items-center gap-1"><AlertCircle size={14} /> {erro}</p>
      )}

      {/* Ações de impressão */}
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={() => imprimirConta(pedido, mesa, config as any)} className="flex-1">
          <Printer size={13} /> Imprimir
        </Button>
        <Button variant="secondary" size="sm" onClick={() => gerarPDF(pedido, mesa, config as any)} className="flex-1">
          <FileText size={13} /> PDF
        </Button>
      </div>

      {/* Fechar conta */}
      <Button className="w-full" size="lg" variant="success" onClick={handleFechar} disabled={pedido.itens.length === 0}>
        <CheckCircle2 size={18} />
        Fechar Conta · {formatMoeda(totalFinal)}
      </Button>
    </div>
  );
}

// Campo numérico com alternância R$ / %
function CampoAjuste({ label, valor, setValor, tipo, setTipo }: {
  label: string; valor: string; setValor: (v: string) => void; tipo: Tipo; setTipo: (t: Tipo) => void;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-primary-600 block mb-1">{label}</label>
      <div className="flex gap-2">
        <input
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="0" inputMode="decimal"
          className="flex-1 min-w-0 border border-primary-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent-400"
        />
        <div className="flex rounded-lg overflow-hidden border border-primary-200 shrink-0">
          {(['rs', 'pct'] as Tipo[]).map((t) => (
            <button key={t} onClick={() => setTipo(t)}
              className={`px-3 py-2 text-sm font-bold transition-colors
                ${tipo === t ? 'bg-accent-500 text-white' : 'bg-white text-primary-400 hover:text-primary-600'}`}>
              {t === 'rs' ? 'R$' : '%'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
