import React from 'react';

// ── Button ────────────────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-accent-600 hover:bg-accent-700 text-white shadow-md',
  secondary: 'bg-primary-100 hover:bg-primary-200 text-primary-700',
  danger: 'bg-accent-500 hover:bg-accent-600 text-white',
  ghost: 'hover:bg-primary-100 text-primary-600',
  success: 'bg-accent-600 hover:bg-accent-700 text-white',
};
const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'px-2.5 py-1.5 text-xs rounded-lg',
  md: 'px-4 py-2 text-sm rounded-lg',
  lg: 'px-6 py-3 text-base rounded-lg',
};

export function Button({
  variant = 'primary', size = 'md', loading, children, className = '', disabled, ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`font-semibold transition-all duration-150 inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed
        ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...rest}
    >
      {loading && <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />}
      {children}
    </button>
  );
}

// ── Card ──────────────────────────────────────────────────────
export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-lg shadow-md border border-primary-200 ${className}`}>
      {children}
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────
interface BadgeProps { label: string; color?: 'green' | 'red' | 'orange' | 'gray' | 'blue'; }
const badgeColors = {
  green: 'bg-primary-100 text-primary-700',
  red: 'bg-accent-100 text-accent-700',
  orange: 'bg-accent-100 text-accent-700',
  gray: 'bg-primary-200 text-primary-700',
  blue: 'bg-accent-100 text-accent-700',
};
export function Badge({ label, color = 'gray' }: BadgeProps) {
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${badgeColors[color]}`}>{label}</span>
  );
}

// ── Input ─────────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}
export function Input({ label, error, className = '', id, ...rest }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s/g, '-');
  return (
    <div className="flex flex-col gap-1">
      {label && <label htmlFor={inputId} className="text-sm font-semibold text-primary-900">{label}</label>}
      <input
        id={inputId}
        className={`border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white
          ${error ? 'border-accent-400' : 'border-primary-200'} ${className}`}
        {...rest}
      />
      {error && <p className="text-xs text-accent-600">{error}</p>}
    </div>
  );
}

// ── Select ────────────────────────────────────────────────────
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}
export function Select({ label, options, className = '', id, ...rest }: SelectProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s/g, '-');
  return (
    <div className="flex flex-col gap-1">
      {label && <label htmlFor={inputId} className="text-sm font-semibold text-primary-900">{label}</label>}
      <select
        id={inputId}
        className={`border border-primary-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent-500 ${className}`}
        {...rest}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}
const modalSizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' };

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-white rounded-lg shadow-2xl w-full ${modalSizes[size]} max-h-[90vh] flex flex-col border border-primary-200`}>
        <div className="flex items-center justify-between p-5 border-b border-primary-200 bg-gradient-to-r from-primary-50 to-primary-100">
          <h2 className="text-lg font-bold text-primary-900">{title}</h2>
          <button onClick={onClose} className="text-primary-400 hover:text-primary-600 text-2xl leading-none font-bold">×</button>
        </div>
        <div className="overflow-y-auto flex-1 p-5">{children}</div>
      </div>
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────
interface StatCardProps { label: string; value: string | number; icon: React.ReactNode; color?: string; }
export function StatCard({ label, value, icon, color = 'text-accent-600' }: StatCardProps) {
  return (
    <Card className="p-5 flex items-center gap-4 bg-gradient-to-br from-white to-primary-50">
      <div className={`text-3xl ${color}`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold text-primary-900">{value}</p>
        <p className="text-sm text-primary-600 mt-0.5">{label}</p>
      </div>
    </Card>
  );
}

// ── Empty State ───────────────────────────────────────────────
export function EmptyState({ message, icon }: { message: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-primary-400 gap-3">
      {icon && <div className="text-5xl opacity-50">{icon}</div>}
      <p className="text-sm text-primary-600">{message}</p>
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────
export function Spinner() {
  return <div className="w-5 h-5 border-2 border-accent-400 border-t-transparent rounded-full animate-spin" />;
}
