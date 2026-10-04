import PlatformLogo from '../components/PlatformLogo';
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
  Check,
  Package,
  Layers,
  Sparkles
} from 'lucide-react';
import { listingService, authService, ebayService, subscriptionService } from '../services/api';
import StatCard from '../components/ui/StatCard';
import DonutChartCard from '../components/ui/DonutChartCard';
import { LoadingState } from '../components/ui/LoadingState';
import { useReducedMotion } from '../hooks/useReducedMotion';

const loadCached = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.data !== undefined ? parsed.data : parsed;
  } catch { return null; }
};

const saveCache = (key, data) => {
  try { localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); } catch {}
};

const Dashboard = () => {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const [statsData, setStatsData] = useState(() => loadCached('dash_stats_v5'));
  const [recentActivity, setRecentActivity] = useState(() => loadCached('dash_activity_v5') || []);
  const [user, setUser] = useState(() => loadCached('elister_user') || null);
  const [ebayStatus, setEbayStatus] = useState(() => loadCached('dash_ebay_v5') || null);
  const [tokenInfo, setTokenInfo] = useState(() => loadCached('dash_token_v5') || null);
  const [loading, setLoading] = useState(() => !loadCached('dash_stats_v5'));
  const [pieMode, setPieMode] = useState('fetched'); // 'fetched' or 'listed'
  const [pieTimeframe, setPieTimeframe] = useState('allTime'); // 'weekly', 'monthly', 'yearly', 'allTime'

  const getPlanLimit = (planName) => {
    const plan = String(planName || 'free').toLowerCase();
    switch (plan) {
      case 'basic': return 500;
      case 'pro': return 3000;
      case 'enterprise': return 10000;
      case 'free':
      default: return 25;
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
    const fetchData = async () => {
      try {
        const [statsRes, userRes, ebayRes, tokenRes] = await Promise.all([
          listingService.getStats(),
          authService.getMe(),
          ebayService.getStatus(),
          subscriptionService.getTokenUsage().catch(() => null)
        ]);

        const stats = statsRes.data?.data;
        const activity = statsRes.data?.data?.recentActivity || [];
        const userData = userRes.data?.data;
        const ebayData = ebayRes.data?.data;
        const tokenData = tokenRes?.data?.data || null;

        if (stats) setStatsData(stats);
        if (activity) setRecentActivity(activity);
        if (userData) setUser(userData);
        if (ebayData) setEbayStatus(ebayData);
        if (tokenData) setTokenInfo(tokenData);

        if (stats) saveCache('dash_stats_v5', stats);
        if (activity) saveCache('dash_activity_v5', activity);
        if (userData) {
          saveCache('dash_user_v5', userData);
          saveCache('elister_user', userData);
        }
        if (ebayData) saveCache('dash_ebay_v5', ebayData);
        if (tokenData) saveCache('dash_token_v5', tokenData);
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

  // Subscription & Monthly Token calculation
  const rawPlan = tokenInfo?.plan || user?.subscription?.plan || 'basic';
  const planName = rawPlan.charAt(0).toUpperCase() + rawPlan.slice(1);
  const tokenTotal = tokenInfo?.tokensTotal ?? getPlanLimit(rawPlan);
  const tokenUsed = tokenInfo?.tokensUsed ?? 0;
  const tokenRemaining = tokenInfo?.tokensRemaining ?? Math.max(tokenTotal - tokenUsed, 0);
  const totalStoreInventory = statsData?.stats?.total || 0;

  // Connection data helper (All 6 Platforms)
  const connections = [
    {
      id: 'ebay',
      name: 'eBay',
      connected: !!(ebayStatus?.connected || user?.ebayAccount?.connected),
      username: ebayStatus?.username || user?.ebayAccount?.username || 'Not connected',
      color: '#4f46e5',
      logo: '/ebay.png'
    },
    {
      id: 'poshmark',
      name: 'Poshmark',
      connected: !!user?.poshmarkAccount?.connected,
      username: user?.poshmarkAccount?.username || 'Not connected',
      color: '#b00f1c',
      logo: '/poshmark.png'
    },
    {
      id: 'mercari',
      name: 'Mercari',
      connected: !!user?.mercariAccount?.connected,
      username: user?.mercariAccount?.username || 'Not connected',
      color: '#f43f5e',
      logo: '/mercari.png'
    },
    {
      id: 'etsy',
      name: 'Etsy',
      connected: !!user?.etsyAccount?.connected,
      username: user?.etsyAccount?.shopName || user?.etsyAccount?.username || 'Not connected',
      color: '#f55d3e',
      logo: '/etsy.png'
    },
    {
      id: 'amazon',
      name: 'Amazon',
      connected: false,
      isComingSoon: true,
      username: 'Coming Soon',
      color: '#ff9900',
      logo: '/amazon.png'
    },
    {
      id: 'depop',
      name: 'Depop',
      connected: false,
      isComingSoon: true,
      username: 'Coming Soon',
      color: '#000000',
      logo: '/depop.png'
    }
  ];

  // Pie/Donut Chart values calculation across all platforms
  const donutData = useMemo(() => {
    const timeframeData = statsData?.charts?.pieChart?.[pieTimeframe] || { fetched: {}, listed: {} };
    const counts = (pieMode === 'fetched' ? timeframeData.fetched : timeframeData.listed) || {};
    const cs = statsData?.channelStats || {};

    const ebayVal = counts.ebay ?? cs.ebay?.active ?? 0;
    const poshVal = counts.poshmark ?? cs.poshmark?.active ?? 0;
    const mercVal = counts.mercari ?? cs.mercari?.active ?? 0;
    const etsyVal = counts.etsy ?? cs.etsy?.active ?? 0;

    return [
      { label: 'eBay', value: ebayVal, color: '#4f46e5' },
      { label: 'Poshmark', value: poshVal, color: '#b00f1c' },
      { label: 'Mercari', value: mercVal, color: '#00d2ff' },
      { label: 'Etsy', value: etsyVal, color: '#f55d3e' },
      { label: 'Amazon', value: 0, color: '#ff9900' },
      { label: 'Depop', value: 0, color: '#111827' }
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
            Optimize your crosslisting strategy across platforms. Review your active channel synchronization parameters, active subscription limits, and store status.
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

      {/* REPLACED SECTION: Platform Active Inventory Overview Grid + Donut Pie Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Platform Active Inventory Overview Cards (Replaces old Line Graph) */}
        <div className="lg:col-span-2 bg-white p-6 sm:p-7 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100 mb-6">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                    <Sparkles size={11} className="text-indigo-600" />
                    Marketplace Inventory
                  </span>
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                </div>
                <h3 className="text-base font-black text-slate-900 mt-1.5">Active Items Per Platform</h3>
                <p className="text-[11px] font-bold text-slate-400">Live active inventory count across connected and upcoming sales channels</p>
              </div>
              <button
                onClick={() => navigate('/listings')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200/80 rounded-xl text-xs font-black transition-all cursor-pointer shadow-2xs active:scale-95 self-start sm:self-auto"
              >
                <Layers size={13} />
                <span>View Inventory</span>
              </button>
            </div>

            {/* 6 Platform Active Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {[
                {
                  id: 'ebay',
                  name: 'eBay',
                  activeCount: statsData?.channelStats?.ebay?.active ?? (statsData?.stats?.published || 0),
                  logo: '/ebay.png',
                  connected: !!(ebayStatus?.connected || user?.ebayAccount?.connected),
                  status: 'Active & Synced',
                  username: ebayStatus?.username || user?.ebayAccount?.username
                },
                {
                  id: 'poshmark',
                  name: 'Poshmark',
                  activeCount: statsData?.channelStats?.poshmark?.active ?? 0,
                  logo: '/poshmark.png',
                  connected: !!user?.poshmarkAccount?.connected,
                  status: 'Active & Synced',
                  username: user?.poshmarkAccount?.username
                },
                {
                  id: 'mercari',
                  name: 'Mercari',
                  activeCount: statsData?.channelStats?.mercari?.active ?? 0,
                  logo: '/mercari.png',
                  connected: !!user?.mercariAccount?.connected,
                  status: 'Active & Synced',
                  username: user?.mercariAccount?.username
                },
                {
                  id: 'etsy',
                  name: 'Etsy',
                  activeCount: statsData?.channelStats?.etsy?.active ?? 0,
                  logo: '/etsy.png',
                  connected: !!user?.etsyAccount?.connected,
                  status: 'Active & Synced',
                  username: user?.etsyAccount?.shopName || user?.etsyAccount?.username
                },
                {
                  id: 'amazon',
                  name: 'Amazon',
                  activeCount: null,
                  isComingSoon: true,
                  logo: '/amazon.png',
                  connected: false,
                  status: 'Coming Soon'
                },
                {
                  id: 'depop',
                  name: 'Depop',
                  activeCount: null,
                  isComingSoon: true,
                  logo: '/depop.png',
                  connected: false,
                  status: 'Coming Soon'
                }
              ].map((plat) => (
                <div
                  key={plat.id}
                  onClick={() => !plat.isComingSoon && navigate('/listings')}
                  className={`p-4 rounded-2xl border transition-all select-none relative overflow-hidden flex flex-col justify-between ${
                    plat.isComingSoon
                      ? 'bg-slate-50/70 border-dashed border-slate-200 opacity-80'
                      : 'bg-white hover:bg-slate-50/60 border-slate-150 hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-500/5 cursor-pointer group'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 p-1.5 flex items-center justify-center shrink-0 shadow-2xs">
                        <PlatformLogo src={plat.logo} alt={plat.name} />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-800">{plat.name}</h4>
                        <span className="text-[10px] font-bold text-slate-400 truncate max-w-[90px] block">
                          {plat.username ? `@${plat.username}` : 'Marketplace'}
                        </span>
                      </div>
                    </div>
                    {plat.isComingSoon ? (
                      <span className="text-[9px] font-black uppercase text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg tracking-wider">
                        Coming Soon
                      </span>
                    ) : plat.connected ? (
                      <span className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-lg">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Live
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg">
                        Not Linked
                      </span>
                    )}
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-100/80 flex items-baseline justify-between">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Active Items</span>
                      {plat.isComingSoon ? (
                        <span className="text-xs font-black text-slate-400 mt-1 block italic">In Development</span>
                      ) : (
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                          <span className="text-xl font-black text-slate-900 font-mono">
                            {(plat.activeCount || 0).toLocaleString()}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500">items active</span>
                        </div>
                      )}
                    </div>
                    {!plat.isComingSoon && plat.connected && (
                      <span className="text-[10px] font-bold text-indigo-600 group-hover:translate-x-0.5 transition-transform">
                        View →
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Platform Share Donut Chart */}
        <DonutChartCard
          title="Platform Metrics"
          subtitle={
            pieMode === 'fetched'
              ? `Channel inventory breakdown ${pieTimeframe === 'allTime' ? 'overall' : `this ${pieTimeframe === 'weekly' ? 'week' : pieTimeframe === 'monthly' ? 'month' : 'year'}`}`
              : `Active cross-listings ${pieTimeframe === 'allTime' ? 'overall' : `this ${pieTimeframe === 'weekly' ? 'week' : pieTimeframe === 'monthly' ? 'month' : 'year'}`}`
          }
          data={donutData}
          emptyDescription={'Try importing your channel inventory or switching mode above!'}
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
                  <option value="fetched">Active Store</option>
                  <option value="listed">Master Listed</option>
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
                <span className="inline-flex items-center gap-1.5 text-[9px] font-black text-indigo-200 bg-indigo-900/60 border border-indigo-800/80 px-3 py-1 rounded-full uppercase tracking-wider">
                  <Sparkles size={11} className="text-amber-400" />
                  Monthly AI Credits
                </span>
                {user?.subscription?.expiresAt ? (
                  <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">{getRemainingDays(user.subscription.expiresAt)} days left</span>
                ) : (
                  <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Active Plan</span>
                )}
              </div>
              <div>
                <h3 className="text-lg font-black capitalize">{planName} Plan</h3>
                <p className="text-[11px] font-bold text-indigo-300 mt-0.5">
                  {tokenTotal.toLocaleString()} Monthly AI Credits • Renews Monthly
                </p>
              </div>

              {/* Monthly AI Tokens Bar */}
              <div className="space-y-2 bg-indigo-900/40 border border-indigo-800/60 p-3.5 rounded-2xl">
                <div className="flex justify-between items-end">
                  <div>
                    <span className="text-[10px] text-indigo-200 font-extrabold uppercase tracking-wider block">AI Token Balance</span>
                    <span className="text-sm font-black text-emerald-300 mt-0.5 block">
                      {tokenRemaining.toLocaleString()} Available
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-indigo-300 font-extrabold uppercase tracking-wider block">Used This Month</span>
                    <span className="text-xs font-black text-white block">
                      {tokenUsed.toLocaleString()} / {tokenTotal.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-indigo-950/80 border border-indigo-800/80 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-400 via-teal-400 to-indigo-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${tokenTotal > 0 ? Math.min((tokenUsed / tokenTotal) * 100, 100) : 0}%` }}
                  />
                </div>
              </div>

              {/* Channel Store Inventory - 100% Free */}
              <div className="p-3 bg-indigo-900/30 border border-indigo-800/40 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold text-indigo-200 uppercase tracking-wider block">Store Inventory Sync</span>
                  <span className="text-xs font-bold text-white mt-0.5 block">
                    {totalStoreInventory.toLocaleString()} Listings Synced
                  </span>
                </div>
                <span className="text-[9px] font-black text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-lg">
                  100% Free
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => navigate('/settings?tab=tokens')}
                  className="py-2.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Sparkles size={13} className="text-amber-300" />
                  <span>Token Ledger</span>
                </button>
                <button
                  onClick={() => navigate('/subscription')}
                  className="py-2.5 px-3 bg-white hover:bg-slate-100 text-indigo-950 font-black rounded-xl text-xs transition-all active:scale-95 cursor-pointer text-center shadow-sm"
                >
                  Manage Plan
                </button>
              </div>
            </div>
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-28 h-28 bg-indigo-500/20 rounded-full blur-2xl" />
          </div>

          {/* Connected Integrations Card (All 6 Platforms with Coming Soon) */}
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

            <div className="flex flex-col gap-2.5">
              {connections.map((conn) => (
                <div key={conn.name} className="flex items-center justify-between p-3 bg-slate-50/60 rounded-2xl border border-slate-100 hover:border-indigo-100 transition-all select-none">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white rounded-xl shadow-2xs border border-slate-150 p-1 flex items-center justify-center shrink-0">
                      <PlatformLogo src={conn.logo} alt={conn.name} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-800">{conn.name}</p>
                      <p className="text-[10px] font-semibold text-slate-400 truncate max-w-[130px]">{conn.username}</p>
                    </div>
                  </div>

                  {conn.isComingSoon ? (
                    <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg uppercase tracking-wider">
                      Coming Soon
                    </span>
                  ) : conn.connected ? (
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
