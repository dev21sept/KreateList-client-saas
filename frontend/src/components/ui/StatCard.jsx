import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';
import { useReducedMotion } from '../../hooks/useReducedMotion';

const COLOR_MAP = {
  indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  slate: 'bg-slate-50 text-slate-600 border-slate-100',
  amber: 'bg-amber-50 text-amber-600 border-amber-100',
  rose: 'bg-rose-50 text-rose-600 border-rose-100',
  sky: 'bg-sky-50 text-sky-600 border-sky-100',
};

export default function StatCard({ name, value, icon, color = 'indigo', trend, delay = 0, className }) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: reducedMotion ? 0 : delay }}
      className={cn(
        'bg-card-bg border border-border p-5 rounded-3xl shadow-card flex flex-col justify-between h-32 hover:shadow-card-hover transition-all select-none',
        className
      )}
    >
      <div className="flex justify-between items-start">
        <div className={cn('p-3 rounded-2xl border shrink-0', COLOR_MAP[color] || COLOR_MAP.indigo)}>
          {icon}
        </div>
        {trend && (
          <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 bg-slate-50 border border-border px-2 py-0.5 rounded-md">
            {trend}
          </span>
        )}
      </div>
      <div>
        <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-wider">{name}</h3>
        <p className="text-2xl font-black text-slate-900 mt-0.5">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
      </div>
    </motion.div>
  );
}
