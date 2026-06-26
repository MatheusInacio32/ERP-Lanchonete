import { LayoutGrid, Users, CheckCircle2, DollarSign, ShoppingBag } from 'lucide-react';
import { StatCard, Card } from '../components/ui';
import { formatMoeda } from '../utils';
import type { DashboardStats, Pedido } from '../types';

interface Props {
  stats: DashboardStats;
  pedidosHoje: Pedido[];
}

export function Dashboard({ stats, pedidosHoje }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900">Dashboard</h1>
        <p className="text-sm text-primary-500 mt-1">Visão geral do dia</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          label="Total de Mesas"
          value={stats.totalMesas}
          icon={<LayoutGrid size={28} />}
          color="text-primary-600"
        />
        <StatCard
          label="Ocupadas"
          value={stats.mesasOcupadas}
          icon={<Users size={28} />}
          color="text-accent-600"
        />
        <StatCard
          label="Livres"
          value={stats.mesasLivres}
          icon={<CheckCircle2 size={28} />}
          color="text-primary-500"
        />
        <StatCard
          label="Vendido Hoje"
          value={formatMoeda(stats.totalVendidoHoje)}
          icon={<DollarSign size={28} />}
          color="text-accent-600"
        />
        <StatCard
          label="Pedidos Hoje"
          value={stats.totalPedidosHoje}
          icon={<ShoppingBag size={28} />}
          color="text-primary-600"
        />
      </div>

      {/* Ocupação visual */}
      <Card className="p-5">
        <h2 className="text-base font-semibold text-primary-700 mb-3">Ocupação</h2>
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-primary-100 rounded-full h-4 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-accent-500 to-accent-600 rounded-full transition-all duration-500"
              style={{ width: `${stats.totalMesas ? (stats.mesasOcupadas / stats.totalMesas) * 100 : 0}%` }}
            />
          </div>
          <span className="text-sm font-medium text-primary-700 w-12 text-right">
            {stats.totalMesas ? Math.round((stats.mesasOcupadas / stats.totalMesas) * 100) : 0}%
          </span>
        </div>
        <div className="flex gap-4 mt-3 text-xs text-primary-600">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent-500 inline-block" /> Ocupadas: {stats.mesasOcupadas}</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary-400 inline-block" /> Livres: {stats.mesasLivres}</span>
        </div>
      </Card>

      {/* Últimos pedidos do dia */}
      {pedidosHoje.length > 0 && (
        <Card className="p-5">
          <h2 className="text-base font-semibold text-primary-700 mb-3">Pedidos Fechados Hoje</h2>
          <div className="space-y-2">
            {pedidosHoje.slice().reverse().map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b border-primary-100 last:border-0">
                <div>
                  <span className="text-sm font-medium text-primary-900">
                    Mesa {(p as any).mesa_numero ?? (p as any).mesa_id?.slice(-3) ?? '?'}
                  </span>
                  <span className="text-xs text-primary-500 ml-2">
                    {new Date((p as any).fechado_em ?? p.fechadoEm ?? new Date()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <span className="text-sm font-bold text-accent-600">{formatMoeda(p.total)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
