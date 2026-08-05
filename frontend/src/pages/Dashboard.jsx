import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  ShoppingBag, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  TrendingUp, 
  ArrowUpRight,
  FileText,
  RefreshCw,
  Layers,
  ChevronDown,
  Info,
  Link2,
  Check
} from 'lucide-react';
import { listingService, authService, ebayService } from '../services/api';

const Dashboard = () => {
  const navigate = useNavigate();
  const [statsData, setStatsData] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [user, setUser] = useState(null);
  const [ebayStatus, setEbayStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pieMode, setPieMode] = useState('fetched'); // 'fetched' or 'listed'
  const [hoveredMonthIndex, setHoveredMonthIndex] = useState(null);

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
    { name: 'Total Listings', value: statsData?.stats?.total || 0, icon: <ShoppingBag size={20} />, color: 'bg-indigo-50 text-indigo-600 border-indigo-100', trend: 'Live DB' },
    { name: 'Published', value: statsData?.stats?.published || 0, icon: <CheckCircle size={20} />, color: 'bg-emerald-50 text-emerald-600 border-emerald-100', trend: 'Listed' },
    { name: 'Drafts', value: statsData?.stats?.draft || 0, icon: <FileText size={20} />, color: 'bg-slate-50 text-slate-600 border-slate-100', trend: 'In Progress' },
    { name: 'Scheduled', value: statsData?.stats?.scheduled || 0, icon: <Clock size={20} />, color: 'bg-amber-50 text-amber-600 border-amber-100', trend: 'Queue' },
    { name: 'Failed', value: statsData?.stats?.failed || 0, icon: <AlertCircle size={20} />, color: 'bg-rose-50 text-rose-600 border-rose-100', trend: 'Errors' },
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
      color: '#e53238'
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

  // SVG Line Chart Drawer
  const drawLineChart = () => {
    const chartData = statsData?.charts?.lineChart?.[timeframe] || [];
    if (chartData.length === 0) {
      return (
        <div className="h-[200px] flex items-center justify-center text-slate-400 text-xs font-bold">
          No historical data found for this timeframe. Create listings to populate history.
        </div>
      );
    }

    // Determine max value dynamically based on visible lines
    const maxVal = Math.max(
      ...chartData.map(d => {
        let val = 0;
        if (visibleLines.total) val = Math.max(val, d.total);
        if (visibleLines.published) val = Math.max(val, d.published);
        if (visibleLines.draft) val = Math.max(val, d.draft);
        return val;
      }),
      10
    );

    const height = 180;
    const width = 500;
    const paddingLeft = 35;
    const paddingRight = 15;
    const paddingTop = 15;
    const paddingBottom = 25;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    const getX = (index) => paddingLeft + (index / (chartData.length - 1)) * chartWidth;
    const getY = (val) => paddingTop + chartHeight - (val / maxVal) * chartHeight;

    let totalPoints = '';
    let publishedPoints = '';
    let draftPoints = '';

    chartData.forEach((d, idx) => {
      const x = getX(idx);
      const yTotal = getY(d.total);
      const yPub = getY(d.published);
      const yDraft = getY(d.draft);

      if (idx === 0) {
        totalPoints = `M ${x} ${yTotal}`;
        publishedPoints = `M ${x} ${yPub}`;
        draftPoints = `M ${x} ${yDraft}`;
      } else {
        totalPoints += ` L ${x} ${yTotal}`;
        publishedPoints += ` L ${x} ${yPub}`;
        draftPoints += ` L ${x} ${yDraft}`;
      }
    });

    const gridLines = [0, 0.25, 0.5, 0.75, 1];

    return (
      <div className="relative w-full">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full select-none">
          {/* Grid lines */}
          {gridLines.map((ratio, idx) => {
            const val = Math.round(ratio * maxVal);
            const y = getY(val);
            return (
              <g key={idx}>
                <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#f1f5f9" strokeWidth="1.2" strokeDasharray="3,3" />
                <text x={paddingLeft - 8} y={y + 3} textAnchor="end" className="text-[10px] font-black fill-slate-400 font-mono">{val}</text>
              </g>
            );
          })}

          {/* Area under Total path */}
          {visibleLines.total && chartData.length > 0 && (
            <path
              d={`${totalPoints} L ${getX(chartData.length - 1)} ${paddingTop + chartHeight} L ${getX(0)} ${paddingTop + chartHeight} Z`}
              fill="url(#indigoGrad)"
              className="opacity-15"
            />
          )}

          {/* Line paths */}
          {visibleLines.total && (
            <path d={totalPoints} fill="none" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          )}
          {visibleLines.published && (
            <path d={publishedPoints} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          )}
          {visibleLines.draft && (
            <path d={draftPoints} fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="3,3" strokeLinecap="round" strokeLinejoin="round" />
          )}

          {/* Interaction circles */}
          {chartData.map((d, idx) => {
            const x = getX(idx);
            const yTotal = getY(d.total);
            const yPub = getY(d.published);
            const yDraft = getY(d.draft);

            return (
              <g key={idx}>
                {/* Total point node */}
                {visibleLines.total && (
                  <circle 
                    cx={x} 
                    cy={yTotal} 
                    r={hoveredMonthIndex === idx ? "6" : "4"} 
                    className="fill-white stroke-indigo-600 stroke-[3px] transition-all duration-150 cursor-pointer"
                  />
                )}
                
                {/* Published point node */}
                {visibleLines.published && (
                  <circle 
                    cx={x} 
                    cy={yPub} 
                    r={hoveredMonthIndex === idx ? "6" : "4"} 
                    className="fill-white stroke-emerald-500 stroke-[3px] transition-all duration-150 cursor-pointer"
                  />
                )}

                {/* Draft point node */}
                {visibleLines.draft && (
                  <circle 
                    cx={x} 
                    cy={yDraft} 
                    r={hoveredMonthIndex === idx ? "5" : "3"} 
                    className="fill-white stroke-slate-400 stroke-[2px] transition-all duration-150 cursor-pointer"
                  />
                )}

                {/* X axis labels */}
                <text x={x} y={height - 5} textAnchor="middle" className="text-[9px] font-black fill-slate-400">{d.label}</text>

                {/* Hover zones */}
                <rect 
                  x={x - 20} 
                  y={paddingTop} 
                  width="40" 
                  height={chartHeight} 
                  fill="transparent" 
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredMonthIndex(idx)}
                  onMouseLeave={() => setHoveredMonthIndex(null)}
                />
              </g>
            );
          })}

          {/* Gradients */}
          <defs>
            <linearGradient id="indigoGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#ffffff" />
            </linearGradient>
          </defs>
        </svg>

        {/* Tooltip render */}
        {hoveredMonthIndex !== null && chartData[hoveredMonthIndex] && (
          <div 
            className="absolute bg-slate-900 border border-slate-800 text-white p-3 rounded-2xl shadow-2xl flex flex-col gap-1 z-50 pointer-events-none select-none text-[11px] animate-in fade-in duration-100"
            style={{
              left: `${(getX(hoveredMonthIndex) / width) * 100}%`,
              top: `${(getY(chartData[hoveredMonthIndex].total) / height) * 100 - 32}%`,
              transform: 'translateX(-50%)'
            }}
          >
            <div className="font-extrabold text-[9px] text-slate-400 uppercase tracking-widest">{chartData[hoveredMonthIndex].label} {chartData[hoveredMonthIndex].year || ''}</div>
            {visibleLines.total && (
              <div className="flex items-center justify-between gap-6">
                <span className="flex items-center gap-1.5 font-bold"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> Total:</span>
                <span className="font-mono font-black">{chartData[hoveredMonthIndex].total}</span>
              </div>
            )}
            {visibleLines.published && (
              <div className="flex items-center justify-between gap-6">
                <span className="flex items-center gap-1.5 font-bold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Live:</span>
                <span className="font-mono font-black">{chartData[hoveredMonthIndex].published}</span>
              </div>
            )}
            {visibleLines.draft && (
              <div className="flex items-center justify-between gap-6">
                <span className="flex items-center gap-1.5 font-bold"><span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Drafts:</span>
                <span className="font-mono font-black">{chartData[hoveredMonthIndex].draft}</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Pie/Donut Chart values calculation
  const donutData = useMemo(() => {
    const timeframeData = statsData?.charts?.pieChart?.[pieTimeframe] || { fetched: {}, listed: {} };
    if (pieMode === 'fetched') {
      const counts = timeframeData.fetched || {};
      return [
        { label: 'eBay', value: counts.ebay || 0, color: '#4f46e5' },
        { label: 'Poshmark', value: counts.poshmark || 0, color: '#f43f5e' },
        { label: 'Depop', value: counts.depop || 0, color: '#111827' },
        { label: 'Etsy', value: counts.etsy || 0, color: '#f55d3e' }
      ];
    } else {
      const counts = timeframeData.listed || {};
      return [
        { label: 'eBay', value: counts.ebay || 0, color: '#4f46e5' },
        { label: 'Poshmark', value: counts.poshmark || 0, color: '#f43f5e' },
        { label: 'Depop', value: counts.depop || 0, color: '#111827' },
        { label: 'Etsy', value: counts.etsy || 0, color: '#f55d3e' }
      ];
    }
  }, [pieMode, pieTimeframe, statsData]);

  const renderDonutChart = () => {
    const total = donutData.reduce((sum, item) => sum + item.value, 0);
    const r = 50;
    const strokeWidth = 14;
    const circ = 2 * Math.PI * r; // ~314.15

    if (total === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-48 py-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-150">
          <Info size={24} className="text-slate-300 mb-2" />
          <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">No Platform Data</span>
          <p className="text-[9px] text-slate-400 font-bold mt-1 text-center max-w-[180px]">Try importing your channel inventory or switching to "Cross-listed" above!</p>
        </div>
      );
    }

    let accumulatedPct = 0;

    return (
      <div className="flex flex-col sm:flex-row items-center justify-around gap-6">
        <div className="relative w-40 h-40 flex items-center justify-center shrink-0">
          <svg width="150" height="150" viewBox="0 0 130 130" className="-rotate-90">
            {donutData.map((item) => {
              if (item.value === 0) return null;
              const percentage = (item.value / total) * 100;
              const strokeOffset = circ - (percentage / 100) * circ;
              const strokeRotation = (accumulatedPct / 100) * 360;
              accumulatedPct += percentage;

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
                  style={{
                    transform: `rotate(${strokeRotation}deg)`,
                    transformOrigin: '65px 65px'
                  }}
                  className="transition-all duration-300 cursor-pointer hover:opacity-90"
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col justify-center items-center pointer-events-none select-none">
            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest leading-none">Total</span>
            <span className="text-xl font-black text-slate-900 mt-1.5">{total}</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 w-full flex flex-col gap-2.5">
          {donutData.map((item) => {
            const pct = total > 0 ? ((item.value / total) * 100).toFixed(0) : '0';
            return (
              <div key={item.label} className="flex items-center justify-between py-1 border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }}></span>
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
    );
  };

  if (loading && !statsData) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3 text-slate-400">
        <RefreshCw className="animate-spin text-indigo-600" size={32} />
        <span className="text-xs font-extrabold tracking-widest uppercase">Loading dashboard assets...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-indigo-900 to-indigo-755 p-8 rounded-3xl text-white relative overflow-hidden shadow-xl shadow-indigo-150">
        <div className="relative z-10 max-w-xl">
          <span className="text-[9px] font-black uppercase tracking-widest text-indigo-200 bg-indigo-500/30 px-3 py-1 rounded-full border border-indigo-400/20">Client Dashboard</span>
          <h1 className="text-2xl font-black mt-4">Welcome Back, {user?.firstName || 'User'}!</h1>
          <p className="text-xs text-indigo-100/90 font-medium leading-relaxed mt-2.5">
            Optimize your crosslisting strategy across platforms. Review your active channel synchronization parameters, active subscriptions limits, and store status.
          </p>
        </div>
        {/* Abstract background graphics */}
        <div className="absolute -bottom-16 -right-16 w-60 h-60 bg-indigo-500/20 rounded-full blur-3xl" />
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-indigo-600/30 rounded-full blur-2xl" />
      </div>

      {/* Grid of Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
        {stats.map((stat, idx) => (
          <motion.div
            key={stat.name}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between h-32 hover:shadow-md transition-all select-none"
          >
            <div className="flex justify-between items-start">
              <div className={`p-3 rounded-2xl border ${stat.color} shrink-0`}>
                {stat.icon}
              </div>
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md">
                {stat.trend}
              </span>
            </div>
            <div>
              <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-wider">{stat.name}</h3>
              <p className="text-2xl font-black text-slate-900 mt-0.5">{stat.value.toLocaleString()}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Unified Graph Card & Donut Pie Chart Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Unified Line Chart */}
        <div className="lg:col-span-2 bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-base font-black text-slate-950">Unified Listings Overview</h3>
              <p className="text-[10px] font-bold text-slate-400 mt-0.5">Historical distribution of drafts, live posts, and totals</p>
            </div>

            <div className="flex flex-wrap items-center gap-4.5">
              {/* Timeframe selector tabs */}
              <div className="flex bg-[#f1f5f9] p-1 rounded-xl gap-1">
                {['weekly', 'monthly', 'yearly'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTimeframe(t)}
                    className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all cursor-pointer ${
                      timeframe === t 
                        ? 'bg-white text-indigo-600 shadow-xs' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {t === 'yearly' ? 'Yearly' : t === 'monthly' ? 'Monthly' : 'Weekly'}
                  </button>
                ))}
              </div>

              {/* Interactive Legend with click filters */}
              <div className="flex gap-3 items-center">
                <button 
                  onClick={() => setVisibleLines(prev => ({ ...prev, total: !prev.total }))}
                  className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider transition-opacity cursor-pointer ${visibleLines.total ? 'text-slate-700' : 'text-slate-300 line-through opacity-60'}`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-[#6366f1] shrink-0" /> Total
                </button>
                <button 
                  onClick={() => setVisibleLines(prev => ({ ...prev, published: !prev.published }))}
                  className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider transition-opacity cursor-pointer ${visibleLines.published ? 'text-slate-700' : 'text-slate-300 line-through opacity-60'}`}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] shrink-0" /> Live
                </button>
                <button 
                  onClick={() => setVisibleLines(prev => ({ ...prev, draft: !prev.draft }))}
                  className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider transition-opacity cursor-pointer ${visibleLines.draft ? 'text-slate-700' : 'text-slate-300 line-through opacity-60'}`}
                >
                  <span className="w-2.5 h-2.5 rounded-full border border-dashed border-slate-400 shrink-0" /> Drafts
                </button>
              </div>
            </div>
          </div>
          
          <div className="w-full">
            {drawLineChart()}
          </div>
        </div>

        {/* Right Side: Platform fetched/listed Pie/Donut Chart */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex flex-col gap-1 mb-6">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-black text-slate-950">Platform Metrics</h3>
              
              {/* Selectors and Filters */}
              <div className="flex items-center gap-2">
                {/* Timeframe Selector */}
                <div className="relative">
                  <select
                    value={pieTimeframe}
                    onChange={(e) => setPieTimeframe(e.target.value)}
                    className="appearance-none pr-7 pl-2.5 py-1.5 bg-[#f8fafc] border border-slate-200 hover:border-slate-300 rounded-xl text-[10px] font-black text-slate-700 outline-none cursor-pointer"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                    <option value="allTime">All Time</option>
                  </select>
                  <ChevronDown size={12} className="text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                {/* Mode Selector */}
                <div className="relative">
                  <select
                    value={pieMode}
                    onChange={(e) => setPieMode(e.target.value)}
                    className="appearance-none pr-7 pl-2.5 py-1.5 bg-[#f8fafc] border border-slate-200 hover:border-slate-300 rounded-xl text-[10px] font-black text-slate-700 outline-none cursor-pointer"
                  >
                    <option value="fetched">Fetched</option>
                    <option value="listed">Listed</option>
                  </select>
                  <ChevronDown size={12} className="text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>
            
            <p className="text-[10px] font-bold text-slate-400">
              {pieMode === 'fetched' 
                ? `Fetched channel items imported ${pieTimeframe === 'allTime' ? 'overall' : `in this ${pieTimeframe === 'weekly' ? 'week' : pieTimeframe === 'monthly' ? 'month' : 'year'}`}` 
                : `Listed template count on all channels ${pieTimeframe === 'allTime' ? 'overall' : `this ${pieTimeframe === 'weekly' ? 'week' : pieTimeframe === 'monthly' ? 'month' : 'year'}`}`}
            </p>
          </div>

          <div className="w-full flex-1 flex flex-col justify-center">
            {renderDonutChart()}
          </div>
        </div>

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
            {/* Background design accents */}
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-28 h-28 bg-indigo-500/20 rounded-full blur-2xl" />
          </div>

          {/* Connected Integrations Card */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Integrations</h3>
              <button 
                onClick={() => navigate('/integrations')}
                className="text-[10px] font-black text-indigo-650 hover:underline cursor-pointer uppercase tracking-wider"
              >
                Settings
              </button>
            </div>
            
            <div className="flex flex-col gap-3">
              {connections.map((conn) => (
                <div key={conn.name} className="flex items-center justify-between p-3.5 bg-[#fdfdfe] rounded-2xl border border-slate-100 hover:border-indigo-100 transition-all select-none">
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
                      {/* Image Thumbnail */}
                      <div className="w-11 h-11 bg-slate-50 border border-slate-100 rounded-xl overflow-hidden shrink-0 flex items-center justify-center shadow-inner">
                        {activity.thumbnail ? (
                          <img src={activity.thumbnail} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <ShoppingBag size={16} className="text-slate-300" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-extrabold text-slate-800 text-xs truncate max-w-[200px] sm:max-w-md group-hover:text-indigo-650 transition-colors">
                          {activity.title}
                        </p>
                        <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                          SKU: <span className="font-mono font-bold text-slate-500">{activity.sku || '-'}</span> • {new Date(activity.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {/* Platform label */}
                      <span className="text-[9px] font-black uppercase text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md leading-none">
                        {activity.platform || 'eBay'}
                      </span>
                      {/* Status badge */}
                      <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider leading-none ${
                        activity.status === 'published' ? 'bg-[#e6f4ea] text-[#137333]' : 
                        activity.status === 'failed' ? 'bg-rose-50 text-rose-600' : 'bg-[#fef7e0] text-[#b06000]'
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
