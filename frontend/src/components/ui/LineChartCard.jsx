import React, { useState } from 'react';
import { cn } from '../../utils/cn';

const SERIES_COLOR = {
  total: '#6366f1',
  published: '#10b981',
  draft: '#94a3b8',
};

export default function LineChartCard({
  title,
  subtitle,
  chartData = [],
  visibleLines,
  onToggleLine,
  timeframe,
  onTimeframeChange,
  timeframes = ['weekly', 'monthly', 'yearly'],
  emptyLabel = 'No historical data found for this timeframe.',
  className,
}) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const height = 200;
  const width = 560;
  const paddingLeft = 38;
  const paddingRight = 16;
  const paddingTop = 16;
  const paddingBottom = 26;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const maxVal = chartData.length
    ? Math.max(
        ...chartData.map((d) => {
          let val = 0;
          if (visibleLines.total) val = Math.max(val, d.total);
          if (visibleLines.published) val = Math.max(val, d.published);
          if (visibleLines.draft) val = Math.max(val, d.draft);
          return val;
        }),
        10
      )
    : 10;

  const getX = (idx) => paddingLeft + (idx / Math.max(chartData.length - 1, 1)) * chartWidth;
  const getY = (val) => paddingTop + chartHeight - (val / maxVal) * chartHeight;

  const buildPath = (key) =>
    chartData
      .map((d, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx)} ${getY(d[key])}`)
      .join(' ');

  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className={cn('bg-card-bg border border-border p-6 sm:p-8 rounded-3xl shadow-card flex flex-col justify-between', className)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-base font-black text-slate-900">{title}</h3>
          {subtitle && <p className="text-[10px] font-bold text-slate-400 mt-0.5">{subtitle}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-4.5">
          {onTimeframeChange && (
            <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
              {timeframes.map((t) => (
                <button
                  key={t}
                  onClick={() => onTimeframeChange(t)}
                  className={cn(
                    'px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all cursor-pointer',
                    timeframe === t ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          )}

          {onToggleLine && (
            <div className="flex gap-3 items-center">
              {['total', 'published', 'draft'].map((key) => (
                <button
                  key={key}
                  onClick={() => onToggleLine(key)}
                  className={cn(
                    'flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider transition-opacity cursor-pointer',
                    visibleLines[key] ? 'text-slate-700' : 'text-slate-300 line-through opacity-60'
                  )}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: SERIES_COLOR[key] }} />
                  {key === 'total' ? 'Total' : key === 'published' ? 'Live' : 'Drafts'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="h-[200px] flex items-center justify-center text-slate-400 text-xs font-bold text-center px-6">
          {emptyLabel}
        </div>
      ) : (
        <div className="relative w-full">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full select-none">
            {gridLines.map((ratio, idx) => {
              const val = Math.round(ratio * maxVal);
              const y = getY(val);
              return (
                <g key={idx}>
                  <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#f1f5f9" strokeWidth="1.2" strokeDasharray="3,3" />
                  <text x={paddingLeft - 8} y={y + 3} textAnchor="end" className="text-[10px] font-black fill-slate-400 font-mono">
                    {val}
                  </text>
                </g>
              );
            })}

            {visibleLines.total && (
              <path
                d={`${buildPath('total')} L ${getX(chartData.length - 1)} ${paddingTop + chartHeight} L ${getX(0)} ${paddingTop + chartHeight} Z`}
                fill="url(#indigoGradLight)"
                opacity="0.15"
              />
            )}

            {visibleLines.total && <path d={buildPath('total')} fill="none" stroke={SERIES_COLOR.total} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
            {visibleLines.published && <path d={buildPath('published')} fill="none" stroke={SERIES_COLOR.published} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
            {visibleLines.draft && <path d={buildPath('draft')} fill="none" stroke={SERIES_COLOR.draft} strokeWidth="2" strokeDasharray="3,3" strokeLinecap="round" strokeLinejoin="round" />}

            {chartData.map((d, idx) => (
              <g key={idx}>
                {visibleLines.total && (
                  <circle cx={getX(idx)} cy={getY(d.total)} r={hoveredIndex === idx ? 6 : 4} className="transition-all duration-150 cursor-pointer" fill="#ffffff" stroke={SERIES_COLOR.total} strokeWidth={3} />
                )}
                {visibleLines.published && (
                  <circle cx={getX(idx)} cy={getY(d.published)} r={hoveredIndex === idx ? 6 : 4} className="transition-all duration-150 cursor-pointer" fill="#ffffff" stroke={SERIES_COLOR.published} strokeWidth={3} />
                )}
                {visibleLines.draft && (
                  <circle cx={getX(idx)} cy={getY(d.draft)} r={hoveredIndex === idx ? 5 : 3} className="transition-all duration-150 cursor-pointer" fill="#ffffff" stroke={SERIES_COLOR.draft} strokeWidth={2} />
                )}
                <text x={getX(idx)} y={height - 5} textAnchor="middle" className="text-[9px] font-black fill-slate-400">
                  {d.label}
                </text>
                <rect x={getX(idx) - 20} y={paddingTop} width="40" height={chartHeight} fill="transparent" className="cursor-pointer" onMouseEnter={() => setHoveredIndex(idx)} onMouseLeave={() => setHoveredIndex(null)} />
              </g>
            ))}

            <defs>
              <linearGradient id="indigoGradLight" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#ffffff" />
              </linearGradient>
            </defs>
          </svg>

          {hoveredIndex !== null && chartData[hoveredIndex] && (
            <div
              className="absolute bg-slate-900 border border-slate-800 text-white p-3 rounded-2xl shadow-2xl flex flex-col gap-1 z-50 pointer-events-none select-none text-[11px]"
              style={{
                left: `${(getX(hoveredIndex) / width) * 100}%`,
                top: `${(getY(chartData[hoveredIndex].total) / height) * 100 - 32}%`,
                transform: 'translateX(-50%)',
              }}
            >
              <div className="font-extrabold text-[9px] text-slate-400 uppercase tracking-widest">
                {chartData[hoveredIndex].label} {chartData[hoveredIndex].year || ''}
              </div>
              {visibleLines.total && (
                <div className="flex items-center justify-between gap-6">
                  <span className="flex items-center gap-1.5 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: SERIES_COLOR.total }} /> Total:
                  </span>
                  <span className="font-mono font-black">{chartData[hoveredIndex].total}</span>
                </div>
              )}
              {visibleLines.published && (
                <div className="flex items-center justify-between gap-6">
                  <span className="flex items-center gap-1.5 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: SERIES_COLOR.published }} /> Live:
                  </span>
                  <span className="font-mono font-black">{chartData[hoveredIndex].published}</span>
                </div>
              )}
              {visibleLines.draft && (
                <div className="flex items-center justify-between gap-6">
                  <span className="flex items-center gap-1.5 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: SERIES_COLOR.draft }} /> Drafts:
                  </span>
                  <span className="font-mono font-black">{chartData[hoveredIndex].draft}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
