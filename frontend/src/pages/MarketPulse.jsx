import React, { useState, useEffect, useCallback } from 'react';
import { useNotification } from '../context/NotificationContext';
import { LineChart, RefreshCw, TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react';
import { marketPulseService } from '../services/api';
import Button from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { LoadingState } from '../components/ui/LoadingState';
import EmptyState from '../components/ui/EmptyState';

const TREND_META = {
  rising: { label: 'Rising', variant: 'success', icon: TrendingUp },
  declining: { label: 'Declining', variant: 'danger', icon: TrendingDown },
  stable: { label: 'Stable', variant: 'neutral', icon: Minus },
  insufficient_data: { label: 'Insufficient data', variant: 'neutral', icon: AlertCircle },
};

export default function MarketPulse() {
  const { toast } = useNotification();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trends, setTrends] = useState([]);
  const [brands, setBrands] = useState([]);

  const loadAll = useCallback(async () => {
    try {
      const [trendsRes, brandsRes] = await Promise.all([
        marketPulseService.getTrends(),
        marketPulseService.getBrands(),
      ]);
      setTrends(trendsRes.data?.trends || []);
      setBrands(brandsRes.data?.brands || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load Market Pulse data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await marketPulseService.refresh();
      toast.success(`Ingested ${res.data?.ingested?.upserted ?? 0} observations, computed ${res.data?.aggregated?.groupsComputed ?? 0} trend group(s).`);
      await loadAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to refresh market data.');
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) return <LoadingState label="Loading Market Pulse..." />;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <p className="text-xs font-semibold text-slate-500 max-w-2xl">
          Market Pulse tracks sold and asking price trends from your own synced listings -
          no fabricated prices, and a trend is only shown once there's enough evidence.
        </p>
        <Button variant="secondary" size="sm" icon={<RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />} onClick={handleRefresh} loading={refreshing}>
          Refresh Market Data
        </Button>
      </div>

      <div className="bg-white rounded-2xl border border-border p-5">
        <h3 className="text-xs font-black text-slate-700 uppercase tracking-wide mb-3">Price Trends by Category &amp; Brand</h3>
        {trends.length === 0 ? (
          <EmptyState
            icon={<LineChart size={20} />}
            title="No trend data yet"
            description="Click Refresh Market Data to pull in your sold and active listing prices."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] font-black uppercase tracking-wide text-slate-400 border-b border-border">
                  <th className="py-2 pr-4">Period</th>
                  <th className="py-2 pr-4">Category</th>
                  <th className="py-2 pr-4">Brand</th>
                  <th className="py-2 pr-4">Metric</th>
                  <th className="py-2 pr-4">Median</th>
                  <th className="py-2 pr-4">Samples</th>
                  <th className="py-2 pr-4">Trend</th>
                </tr>
              </thead>
              <tbody>
                {trends.map(t => {
                  const meta = TREND_META[t.trendClassification] || TREND_META.insufficient_data;
                  const Icon = meta.icon;
                  return (
                    <tr key={t._id} className="border-b border-border/60">
                      <td className="py-2.5 pr-4 font-semibold text-slate-500">{t.period}</td>
                      <td className="py-2.5 pr-4 font-bold text-slate-800">{t.category || 'Uncategorized'}</td>
                      <td className="py-2.5 pr-4 font-semibold text-slate-600">{t.brand || '—'}</td>
                      <td className="py-2.5 pr-4 font-semibold text-slate-500 capitalize">{String(t.metric).replace(/_/g, ' ')}</td>
                      <td className="py-2.5 pr-4 font-bold text-slate-800">{t.median != null ? `$${t.median.toFixed(2)}` : '—'}</td>
                      <td className="py-2.5 pr-4 font-semibold text-slate-500">{t.sampleCount}</td>
                      <td className="py-2.5 pr-4">
                        <Badge variant={meta.variant} className="normal-case"><Icon size={11} />{meta.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-border p-5">
        <h3 className="text-xs font-black text-slate-700 uppercase tracking-wide mb-3">Brand Summary</h3>
        {brands.length === 0 ? (
          <EmptyState icon={<LineChart size={20} />} title="No brand data yet" description="Refresh market data after you have a few sold items." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {brands.map((b, i) => {
              const meta = TREND_META[b.trend] || TREND_META.insufficient_data;
              const Icon = meta.icon;
              return (
                <div key={i} className="rounded-xl border border-border p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-slate-700">{b.brand || 'Unbranded'}</span>
                    <Badge variant={meta.variant}><Icon size={11} />{meta.label}</Badge>
                  </div>
                  <p className="text-[10px] font-semibold text-slate-400 mt-1">{b.category || 'Uncategorized'}</p>
                  <p className="text-sm font-bold text-slate-900 mt-1.5">{b.median != null ? `$${b.median.toFixed(2)}` : '—'} median</p>
                  <p className="text-[10px] font-semibold text-slate-400">{b.sampleCount} sample(s)</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
