import React from 'react';
import { Info } from 'lucide-react';
import { cn } from '../../utils/cn';

export default function DonutChartCard({
  title,
  subtitle,
  data = [],
  controls,
  totalLabel = 'Total',
  emptyTitle = 'No Platform Data',
  emptyDescription,
  className,
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const r = 50;
  const strokeWidth = 14;
  const circ = 2 * Math.PI * r;

  const segments = data.reduce((acc, item) => {
    const percentage = total > 0 ? (item.value / total) * 100 : 0;
    const startPct = acc.cursor;
    acc.list.push({ ...item, percentage, startPct });
    acc.cursor += percentage;
    return acc;
  }, { list: [], cursor: 0 }).list;

  return (
    <div className={cn('bg-card-bg border border-border p-6 sm:p-8 rounded-3xl shadow-card flex flex-col justify-between', className)}>
      <div className="flex flex-col gap-1 mb-6">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-black text-slate-900">{title}</h3>
          {controls}
        </div>
        {subtitle && <p className="text-[10px] font-bold text-slate-400">{subtitle}</p>}
      </div>

      <div className="w-full flex-1 flex flex-col justify-center">
        {total === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 py-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-150">
            <Info size={24} className="text-slate-300 mb-2" />
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">{emptyTitle}</span>
            {emptyDescription && <p className="text-[9px] text-slate-400 font-bold mt-1 text-center max-w-[200px]">{emptyDescription}</p>}
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-around gap-6">
            <div className="relative w-40 h-40 flex items-center justify-center shrink-0">
              <svg width="150" height="150" viewBox="0 0 130 130" className="-rotate-90">
                {segments.map((item) => {
                  if (item.value === 0) return null;
                  const strokeOffset = circ - (item.percentage / 100) * circ;
                  const strokeRotation = (item.startPct / 100) * 360;

                  return (
                    <circle
                      key={item.label}
                      cx="65"
                      cy="65"
                      r={r}
                      fill="transparent"
                      stroke={item.color}
                      strokeWidth={strokeWidth}
                      strokeDasharray={circ}
                      strokeDashoffset={strokeOffset}
                      style={{ transform: `rotate(${strokeRotation}deg)`, transformOrigin: '65px 65px' }}
                      className="transition-all duration-300 cursor-pointer hover:opacity-90"
                    />
                  );
                })}
              </svg>
              <div className="absolute inset-0 flex flex-col justify-center items-center pointer-events-none select-none">
                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest leading-none">{totalLabel}</span>
                <span className="text-xl font-black text-slate-900 mt-1.5">{total}</span>
              </div>
            </div>

            <div className="flex-1 w-full flex flex-col gap-2.5">
              {data.map((item) => {
                const pct = total > 0 ? ((item.value / total) * 100).toFixed(0) : '0';
                return (
                  <div key={item.label} className="flex items-center justify-between py-1 border-b border-slate-50 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-xs font-black text-slate-700">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-mono text-slate-400 font-bold">{item.value} items</span>
                      <span className="text-xs font-black text-slate-900 font-mono w-10 text-right">{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
