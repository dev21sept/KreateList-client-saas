import React from 'react';
import { BarChart3, TrendingUp, DollarSign, Layers, ShoppingBag } from 'lucide-react';

const Analytics = () => {
  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      
      {/* STATS TILES */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-[#f1f3f9] shadow-sm space-y-3">
          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block">Gross Sales Value</span>
          <p className="text-2xl font-black text-[#111827]">$1,245.50</p>
          <span className="text-[10px] text-emerald-600 font-extrabold flex items-center gap-1">↑ 22% vs last month</span>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-[#f1f3f9] shadow-sm space-y-3">
          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block">Items Crosslisted</span>
          <p className="text-2xl font-black text-[#111827]">542</p>
          <span className="text-[10px] text-emerald-600 font-extrabold flex items-center gap-1">↑ 18% vs last month</span>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-[#f1f3f9] shadow-sm space-y-3">
          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block">Avg Selling Price</span>
          <p className="text-2xl font-black text-[#111827]">$45.10</p>
          <span className="text-[10px] text-emerald-600 font-extrabold flex items-center gap-1">↑ 5% vs last month</span>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-[#f1f3f9] shadow-sm space-y-3">
          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block">Sell-Through Rate</span>
          <p className="text-2xl font-black text-[#111827]">42.5%</p>
          <span className="text-[10px] text-indigo-600 font-extrabold flex items-center gap-1">Healthy rating</span>
        </div>
      </div>

      {/* GRAPH CARD */}
      <div className="bg-white p-8 rounded-3xl border border-[#f1f3f9] shadow-sm space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Sales Over Time</h3>
            <p className="text-xs text-slate-400 font-semibold mt-0.5">Performance tracking across integrated channels</p>
          </div>
          <span className="text-xs font-bold px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full">
            Monthly
          </span>
        </div>

        {/* Visual Graph with Styled Bars */}
        <div className="h-64 flex items-end justify-between gap-4 pt-6 border-b border-[#f3f4f6]">
          {[
            { month: 'Jan', val: 40 },
            { month: 'Feb', val: 55 },
            { month: 'Mar', val: 45 },
            { month: 'Apr', val: 75 },
            { month: 'May', val: 90 },
            { month: 'Jun', val: 80 },
            { month: 'Jul', val: 110 }
          ].map((bar, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
              <div 
                className="w-full bg-indigo-100 hover:bg-indigo-600 rounded-t-xl transition-all duration-500 relative cursor-pointer"
                style={{ height: `${bar.val * 1.5}px` }}
              >
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-[#1e293b] text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                  ${(bar.val * 10).toLocaleString()}
                </div>
              </div>
              <span className="text-[10px] font-extrabold text-slate-400 group-hover:text-slate-900 transition-colors">
                {bar.month}
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default Analytics;
