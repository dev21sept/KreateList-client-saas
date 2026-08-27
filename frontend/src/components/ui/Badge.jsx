import React from 'react';
import { cn } from '../../utils/cn';

const VARIANTS = {
  brand: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  success: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  warning: 'bg-amber-50 text-amber-600 border-amber-100',
  danger: 'bg-rose-50 text-rose-600 border-rose-100',
  info: 'bg-sky-50 text-sky-600 border-sky-100',
  neutral: 'bg-slate-100 text-slate-500 border-slate-200',
};

export function Badge({ variant = 'neutral', className, children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border leading-none',
        VARIANTS[variant] || VARIANTS.neutral,
        className
      )}
    >
      {children}
    </span>
  );
}

const STATUS_MAP = {
  published: { label: 'Live', variant: 'success' },
  live: { label: 'Live', variant: 'success' },
  active: { label: 'Active', variant: 'success' },
  connected: { label: 'Connected', variant: 'success' },
  draft: { label: 'Draft', variant: 'neutral' },
  scheduled: { label: 'Scheduled', variant: 'warning' },
  pending: { label: 'Pending', variant: 'warning' },
  failed: { label: 'Failed', variant: 'danger' },
  error: { label: 'Error', variant: 'danger' },
  disconnected: { label: 'Disconnected', variant: 'neutral' },
  expired: { label: 'Expired', variant: 'danger' },
  inactive: { label: 'Inactive', variant: 'neutral' },
};

export function StatusBadge({ status, className }) {
  const key = String(status || '').toLowerCase();
  const entry = STATUS_MAP[key] || { label: status || 'Unknown', variant: 'neutral' };
  return (
    <Badge variant={entry.variant} className={className}>
      {entry.label}
    </Badge>
  );
}

export default Badge;
