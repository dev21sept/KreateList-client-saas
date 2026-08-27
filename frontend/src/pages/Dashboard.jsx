import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingBag,
  CheckCircle,
  Clock,
  AlertCircle,
  FileText,
  ChevronDown,
  Link2,
  Check
} from 'lucide-react';
import { listingService, authService, ebayService } from '../services/api';
import StatCard from '../components/ui/StatCard';
import LineChartCard from '../components/ui/LineChartCard';
import DonutChartCard from '../components/ui/DonutChartCard';
import { LoadingState } from '../components/ui/LoadingState';
import { useReducedMotion } from '../hooks/useReducedMotion';

const Dashboard = () => {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const [statsData, setStatsData] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [user, setUser] = useState(null);
  const [ebayStatus, setEbayStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pieMode, setPieMode] = useState('fetched'); // 'fetched' or 'listed'

  // States for dynamic filtering
  const [timeframe, setTimeframe] = useState('monthly'); // 'weekly', 'monthly', 'yearly'
  const [pieTimeframe, setPieTimeframe] = useState('monthly'); // 'weekly', 'monthly', 'yearly'
  const [visibleLines, setVisibleLines] = useState({ total: true, published: true, draft: true });

  const getPlanLimit = (planName) => {
    const plan = String(planName || 'free').toLowerCase();
    switch (plan) {
      case 'basic': return 500;
      case 'pro': return 3000;
      case 'enterprise': return 10000;
      case 'free':
      default: return 0;
    }
  };

  const getFetchLimit = (planName) => {
    return getPlanLimit(planName);
  };

  const getRemainingDays = (expiresAt) => {
    if (!expiresAt) return null;
    const diffTime = new Date(expiresAt) - new Date();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  useEffect(() => {
    // Load from cache first for instant render
    const CACHE_TTL = 5 * 60 * 1000;
    const loadCached = (key) => {
      try {
        const raw = sessionStorage.getItem(key);
        if (!raw) return null;
        const { data, ts } = JSON.parse(raw);
        if (Date.now() - ts > CACHE_TTL) return null;
        return data;
      } catch { return null; }
    };
    const saveCache = (key, data) => {
      try { sessionStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); } catch {}
    };

    const cachedStats = loadCached('dash_stats_v3');
    const cachedActivity = loadCached('dash_activity_v3');
    const cachedUser = loadCached('dash_user_v3');
    const cachedEbay = loadCached('dash_ebay_v3');

    if (cachedStats) setStatsData(cachedStats);
    if (cachedActivity) setRecentActivity(cachedActivity);
    if (cachedUser) setUser(cachedUser);
    if (cachedEbay) setEbayStatus(cachedEbay);
    if (cachedStats && cachedUser) setLoading(false);

    const fetchData = async () => {
      try {
        const [statsRes, userRes, ebayRes] = await Promise.all([
          listingService.getStats(),
          authService.getMe(),
          ebayService.getStatus()
        ]);

        const stats = statsRes.data.data;
        const activity = statsRes.data.data.recentActivity;
        const userData = userRes.data.data;
        const ebayData = ebayRes.data.data;

        setStatsData(stats);
        setRecentActivity(activity);
        setUser(userData);
        setEbayStatus(ebayData);

        saveCache('dash_stats_v3', stats);
        saveCache('dash_activity_v3', activity);
        saveCache('dash_user_v3', userData);
        saveCache('dash_ebay_v3', ebayData);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
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

  // Subscription calculation
  const plan = user?.subscription?.plan || 'free';
  const listingLimit = getPlanLimit(plan);
  const aiFetchLimit = getFetchLimit(plan);

  const listingsCount = user?.usage?.listingsCount ?? 0;
  const fetchesCount = user?.usage?.fetchesCount ?? 0;

  const remainingListings = Math.max(listingLimit - listingsCount, 0);
  const remainingFetches = Math.max(aiFetchLimit - fetchesCount, 0);

  const rawPlan = user?.subscription?.plan || 'free';
  const planName = rawPlan.charAt(0).toUpperCase() + rawPlan.slice(1);

  // Connection data helper
  const connections = [
    {
      name: 'eBay',
      connected: !!ebayStatus?.connected,
      username: ebayStatus?.username || 'Not connected',
      color: '#4f46e5'
    },
    {
      name: 'Poshmark',
      connected: !!user?.poshmarkAccount?.connected,
      username: user?.poshmarkAccount?.username || 'Not connected',
      color: '#b00f1c'
    },
    {
      name: 'Depop',
      connected: !!user?.depopAccount?.connected,
      username: user?.depopAccount?.username || 'Not connected',
      userId: user?.depopAccount?.userId,
      color: '#000000'
    }
  ];

  const chartData = statsData?.charts?.lineChart?.[timeframe] || [];

  // Pie/Donut Chart values calculation
  const donutData = useMemo(() => {
    const timeframeData = statsData?.charts?.pieChart?.[pieTimeframe] || { fetched: {}, listed: {} };
    const counts = (pieMode === 'fetched' ? timeframeData.fetched : timeframeData.listed) || {};
    return [
      { label: 'eBay', value: counts.ebay || 0, color: '#4f46e5' },
      { label: 'Poshmark', value: counts.poshmark || 0, color: '#f43f5e' },
      { label: 'Depop', value: counts.depop || 0, color: '#111827' },
      { label: 'Etsy', value: counts.etsy || 0, color: '#f55d3e' }
    ];
  }, [pieMode, pieTimeframe, statsData]);

  if (loading && !statsData) {
    return <LoadingState label="Loading dashboard assets..." />;
  }

  return (
    <div className="space-y-8">

      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-indigo-900 to-indigo-700 p-8 rounded-3xl text-white relative overflow-hidden shadow-xl shadow-indigo-100">
        <div className="relative z-10 max-w-xl">
          <span className="text-[9px] font-black uppercase tracking-widest text-indigo-200 bg-indigo-500/30 px-3 py-1 rounded-full border border-indigo-400/20">Client Dashboard</span>
          <h1 className="text-2xl font-black mt-4">Welcome Back, {user?.firstName || 'User'}!</h1>
          <p className="text-xs text-indigo-100/90 font-medium leading-relaxed mt-2.5">
            Optimize your crosslisting strategy across platforms. Review your active channel synchronization parameters, active subscriptions limits, and store status.
          </p>
        </div>
        <div className="absolute -bottom-16 -right-16 w-60 h-60 bg-indigo-500/20 rounded-full blur-3xl" />
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-indigo-600/30 rounded-full blur-2xl" />
      </div>

      {/* Grid of Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
        {stats.map((stat, idx) => (
          <StatCard key={stat.name} {...stat} delay={reducedMotion ? 0 : idx * 0.05} />
        ))}
      </div>

      {/* Unified Graph Card & Donut Pie Chart Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <LineChartCard
          className="lg:col-span-2"
          title="Unified Listings Overview"
          subtitle="Historical distribution of drafts, live posts, and totals"
          chartData={chartData}
          visibleLines={visibleLines}
          onToggleLine={(key) => setVisibleLines((prev) => ({ ...prev, [key]: !prev[key] }))}
          timeframe={timeframe}
          onTimeframeChange={setTimeframe}
          emptyLabel="No historical data found for this timeframe. Create listings to populate history."
        />

        <DonutChartCard
          title="Platform Metrics"
          subtitle={
            pieMode === 'fetched'
              ? `Fetched channel items imported ${pieTimeframe === 'allTime' ? 'overall' : `in this ${pieTimeframe === 'weekly' ? 'week' : pieTimeframe === 'monthly' ? 'month' : 'year'}`}`
              : `Listed template count on all channels ${pieTimeframe === 'allTime' ? 'overall' : `this ${pieTimeframe === 'weekly' ? 'week' : pieTimeframe === 'monthly' ? 'month' : 'year'}`}`
          }
          data={donutData}
          emptyDescription={'Try importing your channel inventory or switching to "Cross-listed" above!'}
          controls={
            <div className="flex items-center gap-2">
              <div className="relative">
                <select
                  value={pieTimeframe}
                  onChange={(e) => setPieTimeframe(e.target.value)}
                  className="appearance-none pr-7 pl-2.5 py-1.5 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl text-[10px] font-black text-slate-700 outline-none cursor-pointer"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                  <option value="allTime">All Time</option>
                </select>
                <ChevronDown size={12} className="text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <div className="relative">
                <select
                  value={pieMode}
                  onChange={(e) => setPieMode(e.target.value)}
                  className="appearance-none pr-7 pl-2.5 py-1.5 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl text-[10px] font-black text-slate-700 outline-none cursor-pointer"
                >
                  <option value="fetched">Fetched</option>
                  <option value="listed">Listed</option>
                </select>
                <ChevronDown size={12} className="text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          }
        />
      </div>

      {/* Subscription limits Card, Connections Statuses, and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Side: Subscription and Connections statuses */}
        <div className="lg:col-span-1 space-y-6">

          {/* Subscription Usage Gauge */}
          <div className="bg-indigo-950 text-white p-6 sm:p-7 rounded-3xl relative overflow-hidden shadow-xl shadow-slate-100 flex flex-col justify-between">
            <div className="relative z-10 space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black text-indigo-300 bg-indigo-900/50 border border-indigo-800 px-3 py-1 rounded-full uppercase tracking-wider">Subscription Limits</span>
                {user?.subscription?.expiresAt && (
                  <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">{getRemainingDays(user.subscription.expiresAt)} days left</span>
                )}
              </div>
              <h3 className="text-lg font-black capitalize">{planName} Plan</h3>

              {/* Listings Bar */}
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <div>
                    <span className="text-[9px] text-indigo-300 font-extrabold uppercase tracking-wider block">AI Listings</span>
                    <span className="text-xs font-semibold text-indigo-200 mt-0.5 block">
                      {remainingListings.toLocaleString()} <span className="text-[10px]">available</span>
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-indigo-300 font-extrabold uppercase tracking-wider block">Usage</span>
                    <span className="text-xs font-black text-white block">{listingsCount} / {listingLimit.toLocaleString()}</span>
                  </div>
                </div>
                <div className="w-full bg-indigo-900/60 border border-indigo-900 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-indigo-400 to-indigo-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min((listingsCount / Math.max(listingLimit, 1)) * 100, 100)}%` }}
                  />
                </div>
              </div>

              {/* Fetches Bar */}
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <div>
                    <span className="text-[9px] text-indigo-300 font-extrabold uppercase tracking-wider block">AI Fetches</span>
                    <span className="text-xs font-semibold text-indigo-200 mt-0.5 block">
                      {remainingFetches.toLocaleString()} <span className="text-[10px]">available</span>
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-indigo-300 font-extrabold uppercase tracking-wider block">Usage</span>
                    <span className="text-xs font-black text-white block">{fetchesCount} / {aiFetchLimit.toLocaleString()}</span>
                  </div>
                </div>
                <div className="w-full bg-indigo-900/60 border border-indigo-900 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-400 to-teal-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min((fetchesCount / Math.max(aiFetchLimit, 1)) * 100, 100)}%` }}
                  />
                </div>
              </div>

              <button
                onClick={() => navigate('/subscription')}
                className="w-full mt-4 py-3 bg-white hover:bg-slate-50 text-indigo-950 font-black rounded-2xl text-xs shadow-md transition-all active:scale-95 cursor-pointer"
              >
                Manage Subscription
              </button>
            </div>
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-28 h-28 bg-indigo-500/20 rounded-full blur-2xl" />
          </div>

          {/* Connected Integrations Card */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Integrations</h3>
              <button
                onClick={() => navigate('/integrations')}
                className="text-[10px] font-black text-indigo-600 hover:underline cursor-pointer uppercase tracking-wider"
              >
                Settings
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {connections.map((conn) => (
                <div key={conn.name} className="flex items-center justify-between p-3.5 bg-slate-50/60 rounded-2xl border border-slate-100 hover:border-indigo-100 transition-all select-none">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-white rounded-xl shadow-xs border border-slate-100 flex items-center justify-center shrink-0">
                      <Link2 size={16} style={{ color: conn.color }} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-800">{conn.name}</p>
                      <p className="text-[10px] font-semibold text-slate-400 truncate max-w-[130px]">{conn.username}{conn.userId ? ` (ID: ${conn.userId})` : ''}</p>
                    </div>
                  </div>

                  {conn.connected ? (
                    <span className="flex items-center gap-1 text-[9px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-lg">
                      <Check size={10} className="stroke-[3px]" /> Connected
                    </span>
                  ) : (
                    <button
                      onClick={() => navigate('/integrations')}
                      className="text-[9px] font-black text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 px-2.5 py-1 rounded-lg cursor-pointer transition-all active:scale-95"
                    >
                      Connect
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Side: Recent activity / Added Products (2/3 width) */}
        <div className="lg:col-span-2 bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-base font-black text-slate-950">Recent Added Products</h3>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5">Most recently created listings and cross-listing drafts</p>
              </div>
              <button
                onClick={() => navigate('/listings')}
                className="text-[10px] font-black text-indigo-600 hover:underline uppercase tracking-wider cursor-pointer"
              >
                View Inventory
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {recentActivity.length > 0 ? (
                recentActivity.map((activity) => (
                  <div key={activity._id} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0 group">
                    <div className="flex items-center space-x-3.5 min-w-0">
                      <div className="w-11 h-11 bg-slate-50 border border-slate-100 rounded-xl overflow-hidden shrink-0 flex items-center justify-center shadow-inner">
                        {activity.thumbnail ? (
                          <img src={activity.thumbnail} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <ShoppingBag size={16} className="text-slate-300" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-extrabold text-slate-800 text-xs truncate max-w-[200px] sm:max-w-md group-hover:text-indigo-600 transition-colors">
                          {activity.title}
                        </p>
                        <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                          SKU: <span className="font-mono font-bold text-slate-500">{activity.sku || '-'}</span> • {new Date(activity.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[9px] font-black uppercase text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md leading-none">
                        {activity.platform || 'eBay'}
                      </span>
                      <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider leading-none ${
                        activity.status === 'published' ? 'bg-emerald-50 text-emerald-600' :
                        activity.status === 'failed' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
                      }`}>
                        {activity.status === 'published' ? 'Live' : activity.status}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-16 text-slate-400 font-bold text-xs">
                  No recent products found. Click &quot;Create Listing&quot; to add items.
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};

export default Dashboard;
