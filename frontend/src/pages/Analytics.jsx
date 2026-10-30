import React, { useState, useEffect, useMemo } from 'react';
import PlatformLogo from '../components/PlatformLogo';
import { BarChart3, DollarSign, AlertTriangle } from 'lucide-react';
import { orderService } from '../services/api';
import { LoadingState } from '../components/ui/LoadingState';
import EmptyState from '../components/ui/EmptyState';
import { useNotification } from '../context/NotificationContext';

const PLATFORM_META = {
  ebay: { label: 'eBay', logo: '/ebay.png' },
  poshmark: { label: 'Poshmark', logo: '/poshmark.png' },
  mercari: { label: 'Mercari', logo: '/mercari.png' },
  etsy: { label: 'Etsy', logo: '/etsy.png' },
  amazon: { label: 'Amazon', logo: '/amazon.png' },
  depop: { label: 'Depop', logo: '/depop.png' }
};

const money = (v) => `$${(Number(v) || 0).toFixed(2)}`;

const Analytics = () => {
  const { toast } = useNotification();

  const [profitRows, setProfitRows] = useState([]);
  const [profitLoading, setProfitLoading] = useState(true);
  const [savingRowId, setSavingRowId] = useState(null);

  useEffect(() => {
    const fetchProfit = async () => {
      try {
        const res = await orderService.getProfit();
        setProfitRows(res.data?.data || []);
      } catch (error) {
        console.error('Error fetching profit data:', error);
      } finally {
        setProfitLoading(false);
      }
    };

    fetchProfit();
  }, []);

  const totalProfit = useMemo(
    () => profitRows.reduce((sum, r) => sum + (r.profit || 0), 0),
    [profitRows]
  );

  const handleFieldEdit = (rowId, field, value) => {
    setProfitRows(prev => prev.map(r => (r._id === rowId ? { ...r, [field]: value } : r)));
  };

  const handleFieldSave = async (row, field) => {
    setSavingRowId(row._id);
    try {
      const res = await orderService.updateProfit(row._id, { [field]: row[field] });
      const updated = res.data?.data;
      if (updated) {
        setProfitRows(prev => prev.map(r => (r._id === row._id ? updated : r)));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to save ${field}.`);
    } finally {
      setSavingRowId(null);
    }
  };

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <BarChart3 size={22} className="text-indigo-600" />
            Analytics
          </h1>
          <p className="text-slate-400 text-xs font-bold mt-1">Live performance metrics pulled from your listing database.</p>
        </div>
      </div>

      {/* PROFIT TABLE */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <DollarSign size={16} className="text-emerald-600" /> Order Profit
            </h2>
            <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
              Real sale price and platform fee for each sold order, straight from eBay/Poshmark's own order data. Shipping cost and item cost aren't visible to any platform - enter them below to see true profit.
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Total Profit</p>
            <p className={`text-lg font-black ${totalProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{money(totalProfit)}</p>
          </div>
        </div>

        {profitLoading ? (
          <div className="p-10"><LoadingState label="Loading orders..." /></div>
        ) : profitRows.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No sold orders yet" description="Once items sell on a connected marketplace, their profit breakdown shows up here." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-500 font-bold uppercase text-[10px]">
                  <th className="px-4 py-3 whitespace-nowrap">Item</th>
                  <th className="px-3 py-3 whitespace-nowrap">Date</th>
                  <th className="px-3 py-3 whitespace-nowrap text-right">Sale Price</th>
                  <th className="px-3 py-3 whitespace-nowrap text-right">Platform Fee</th>
                  <th className="px-3 py-3 whitespace-nowrap text-right">Sales Tax</th>
                  <th className="px-3 py-3 whitespace-nowrap text-right">Shipping Cost</th>
                  <th className="px-3 py-3 whitespace-nowrap text-right">Item COGS</th>
                  <th className="px-4 py-3 whitespace-nowrap text-right">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {profitRows.map((row) => {
                  const plat = PLATFORM_META[row.platform] || { label: row.platform, logo: null };
                  const item = row.lineItems?.[0] || {};
                  const isPoshmark = row.platform === 'poshmark';
                  const savingThis = savingRowId === row._id;
                  return (
                    <tr key={row._id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 max-w-[260px]">
                        <div className="flex items-center gap-2.5">
                          {plat.logo && <PlatformLogo src={plat.logo} className="w-5 h-5 shrink-0 rounded" />}
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 truncate" title={item.title}>{item.title || row.orderId}</p>
                            <p className="text-[10px] text-slate-400 truncate">{plat.label}{item.sku ? ` · SKU ${item.sku}` : ''}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-500 whitespace-nowrap">
                        {row.createdDate ? new Date(row.createdDate).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-3 py-3 text-right font-bold text-slate-700 whitespace-nowrap">{money(row.grossAmount)}</td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        {row.feeAvailable ? (
                          <span className="font-bold text-rose-500">-{money(row.platformFeeAmount)}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-500" title="This platform doesn't expose its fee through the connected sync yet.">
                            <AlertTriangle size={11} /> unknown
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        {isPoshmark
                          ? (row.salesTaxAmount != null ? <span className="font-bold text-rose-500">-{money(row.salesTaxAmount)}</span> : <span className="text-slate-300">$0.00</span>)
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <div className="relative inline-flex items-center">
                          <span className="absolute left-2 text-slate-400 text-[10px]">$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.shippingLabelCost ?? 0}
                            disabled={savingThis}
                            onChange={(e) => handleFieldEdit(row._id, 'shippingLabelCost', e.target.value)}
                            onBlur={() => handleFieldSave(row, 'shippingLabelCost')}
                            className="w-20 h-7 pl-4 pr-2 text-right bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 outline-none focus:border-indigo-400 disabled:opacity-50"
                          />
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <div className="relative inline-flex items-center">
                          <span className="absolute left-2 text-slate-400 text-[10px]">$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.cogsAmount ?? 0}
                            disabled={savingThis}
                            onChange={(e) => handleFieldEdit(row._id, 'cogsAmount', e.target.value)}
                            onBlur={() => handleFieldSave(row, 'cogsAmount')}
                            className="w-20 h-7 pl-4 pr-2 text-right bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 outline-none focus:border-indigo-400 disabled:opacity-50"
                          />
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-right font-black whitespace-nowrap ${row.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {money(row.profit)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

export default Analytics;
