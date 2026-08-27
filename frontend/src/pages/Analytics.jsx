import React, { useState, useEffect } from 'react';
import { BarChart3, ShoppingBag, CheckCircle, Clock, AlertCircle, FileText } from 'lucide-react';
import { listingService } from '../services/api';
import StatCard from '../components/ui/StatCard';
import LineChartCard from '../components/ui/LineChartCard';
import { LoadingState } from '../components/ui/LoadingState';
import { useReducedMotion } from '../hooks/useReducedMotion';

const Analytics = () => {
  const reducedMotion = useReducedMotion();
  const [statsData, setStatsData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [timeframe, setTimeframe] = useState('monthly'); // 'weekly', 'monthly', 'yearly'
  const [visibleLines, setVisibleLines] = useState({ total: true, published: true, draft: true });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const statsRes = await listingService.getStats();
        setStatsData(statsRes.data.data);
      } catch (error) {
        console.error('Error fetching analytics data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const stats = [
    { name: 'Total Listings', value: statsData?.stats?.total || 0, icon: <ShoppingBag size={20} />, color: 'indigo', trend: 'Live DB' },
    { name: 'Published', value: statsData?.stats?.published || 0, icon: <CheckCircle size={20} />, color: 'emerald', trend: 'Listed' },
    { name: 'Drafts', value: statsData?.stats?.draft || 0, icon: <FileText size={20} />, color: 'slate', trend: 'In Progress' },
    { name: 'Scheduled', value: statsData?.stats?.scheduled || 0, icon: <Clock size={20} />, color: 'amber', trend: 'Queue' },
    { name: 'Failed', value: statsData?.stats?.failed || 0, icon: <AlertCircle size={20} />, color: 'rose', trend: 'Errors' },
  ];

  const chartData = statsData?.charts?.lineChart?.[timeframe] || [];

  if (loading && !statsData) {
    return <LoadingState label="Loading analytics..." />;
  }

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

      {/* STATS TILES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
        {stats.map((stat, idx) => (
          <StatCard key={stat.name} {...stat} delay={reducedMotion ? 0 : idx * 0.05} />
        ))}
      </div>

      {/* GRAPH CARD */}
      <LineChartCard
        title="Listings Over Time"
        subtitle="Historical distribution of drafts, live posts, and totals"
        chartData={chartData}
        visibleLines={visibleLines}
        onToggleLine={(key) => setVisibleLines((prev) => ({ ...prev, [key]: !prev[key] }))}
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
        emptyLabel="No historical data found for this timeframe. Create listings to populate history."
      />

    </div>
  );
};

export default Analytics;
