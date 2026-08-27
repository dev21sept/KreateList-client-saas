import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  CreditCard,
  ShoppingBag,
  BarChart3,
  Activity,
  UserPlus,
  ArrowUpRight,
  ShieldAlert,
  AlertCircle
} from 'lucide-react';
import { adminService } from '../../services/api';
import StatCard from '../../components/ui/StatCard';
import { LoadingState } from '../../components/ui/LoadingState';
import { useReducedMotion } from '../../hooks/useReducedMotion';

const NewAdminDashboard = () => {
  const reducedMotion = useReducedMotion();
  const [statsData, setStatsData] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [recentUsers, setRecentUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Chart Interaction states
  const [timeframe, setTimeframe] = useState('monthly'); // 'monthly', 'weekly'
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [planPieMode, setPlanPieMode] = useState('active'); // 'active' or 'all'

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [statsRes, usersRes] = await Promise.all([
          adminService.getStats(),
          adminService.getUsers()
        ]);

        if (statsRes.data?.success) {
          setStatsData(statsRes.data.data);
        }
        if (usersRes.data?.success) {
          setAllUsers(usersRes.data.data);
          setRecentUsers(usersRes.data.data.slice(0, 5));
        }
      } catch (err) {
        console.error('Error fetching admin dashboard data:', err);
        setError('Failed to load dashboard data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatTimeAgo = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  // Compile Dynamic Line Chart Data (Registrations by Month)
  const chartData = useMemo(() => {
    if (allUsers.length === 0) return [];

    // Group users by month
    const monthsMap = {};
    const monthsList = [];

    // Generate last 6 months list
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString('default', { month: 'short' });
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthsMap[key] = { label, key, total: 0, premium: 0 };
      monthsList.push(key);
    }

    // Allocate users
    allUsers.forEach(u => {
      if (!u.createdAt) return;
      const d = new Date(u.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (monthsMap[key]) {
        monthsMap[key].total += 1;
        if (u.subscription?.status === 'active' && u.subscription?.plan !== 'free') {
          monthsMap[key].premium += 1;
        }
      }
    });

    // Make cumulative or incremental
    let runningTotal = 0;
    let runningPremium = 0;
    return monthsList.map(key => {
      const data = monthsMap[key];
      runningTotal += data.total;
      runningPremium += data.premium;
      return {
        label: data.label,
        registrations: data.total,
        cumulativeUsers: runningTotal,
        premiumUsers: runningPremium
      };
    });
  }, [allUsers]);

  // Donut Chart Plan Distribution Data
  const donutData = useMemo(() => {
    const plansCount = { free: 0, basic: 0, pro: 0, enterprise: 0 };

    allUsers.forEach(u => {
      const plan = String(u.subscription?.plan || 'free').toLowerCase();
      const status = u.subscription?.status || 'inactive';

      if (planPieMode === 'active') {
        if (status === 'active' && plan !== 'free') {
          plansCount[plan] = (plansCount[plan] || 0) + 1;
        }
      } else {
        plansCount[plan] = (plansCount[plan] || 0) + 1;
      }
    });

    return [
      { label: 'Enterprise', value: plansCount.enterprise || 0, color: '#8b5cf6' },
      { label: 'Pro Plan', value: plansCount.pro || 0, color: '#3b82f6' },
      { label: 'Basic Plan', value: plansCount.basic || 0, color: '#10b981' },
      { label: 'Free Plan', value: plansCount.free || 0, color: '#94a3b8' }
    ];
  }, [allUsers, planPieMode]);

  // Aggregate stats data dynamically
  const stats = useMemo(() => {
    const totalUsers = allUsers.length;
    const premiumUsers = allUsers.filter(u => u.subscription?.status === 'active' && u.subscription?.plan !== 'free').length;
    const monthlyRev = premiumUsers * 29; // $29 average tier

    let totalListingsCount = 0;
    let publishedListingsCount = 0;

    allUsers.forEach(u => {
      totalListingsCount += u.stats?.total || 0;
      publishedListingsCount += u.stats?.published || 0;
    });

    return [
      { name: 'Total Users', value: totalUsers, icon: <Users size={20} />, color: 'indigo', subtitle: 'Registered Accounts' },
      { name: 'Active Premium', value: premiumUsers, icon: <Activity size={20} />, color: 'emerald', subtitle: 'Premium Tiers' },
      { name: 'Monthly Revenue', value: `$${monthlyRev.toLocaleString()}`, icon: <CreditCard size={20} />, color: 'amber', subtitle: 'Average estimate' },
      { name: 'Total Listings', value: totalListingsCount, icon: <ShoppingBag size={20} />, color: 'sky', subtitle: `${publishedListingsCount} Published` }
    ];
  }, [allUsers]);

  // SVG Line Chart Drawing logic
  const drawLineChart = () => {
    if (chartData.length === 0) {
      return (
        <div className="h-[200px] flex items-center justify-center text-slate-400 text-xs font-bold text-center px-6">
          Processing historical signup data...
        </div>
      );
    }

    const maxVal = Math.max(...chartData.map(d => d.cumulativeUsers), 10);
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

    let userPoints = '';
    let premiumPoints = '';

    chartData.forEach((d, idx) => {
      const x = getX(idx);
      const yUser = getY(d.cumulativeUsers);
      const yPremium = getY(d.premiumUsers);

      if (idx === 0) {
        userPoints = `M ${x} ${yUser}`;
        premiumPoints = `M ${x} ${yPremium}`;
      } else {
        userPoints += ` L ${x} ${yUser}`;
        premiumPoints += ` L ${x} ${yPremium}`;
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

          {/* Area under Total registrations */}
          {chartData.length > 0 && (
            <path
              d={`${userPoints} L ${getX(chartData.length - 1)} ${paddingTop + chartHeight} L ${getX(0)} ${paddingTop + chartHeight} Z`}
              fill="url(#indigoGrad)"
              className="opacity-15"
            />
          )}

          {/* Line paths */}
          <path d={userPoints} fill="none" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d={premiumPoints} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

          {/* Interaction circles */}
          {chartData.map((d, idx) => {
            const x = getX(idx);
            const yUser = getY(d.cumulativeUsers);
            const yPremium = getY(d.premiumUsers);

            return (
              <g key={idx}>
                <circle
                  cx={x}
                  cy={yUser}
                  r={hoveredIndex === idx ? "6" : "4"}
                  className="fill-white stroke-indigo-600 stroke-[3px] transition-all duration-150 cursor-pointer"
                />
                <circle
                  cx={x}
                  cy={yPremium}
                  r={hoveredIndex === idx ? "6" : "4"}
                  className="fill-white stroke-emerald-500 stroke-[3px] transition-all duration-150 cursor-pointer"
                />

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
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
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
        {hoveredIndex !== null && chartData[hoveredIndex] && (
          <div
            className="absolute bg-slate-900 border border-slate-800 text-white p-3 rounded-2xl shadow-2xl flex flex-col gap-1.5 z-50 pointer-events-none select-none text-[11px]"
            style={{
              left: `${(getX(hoveredIndex) / width) * 100}%`,
              top: `${(getY(chartData[hoveredIndex].cumulativeUsers) / height) * 100 - 32}%`,
              transform: 'translateX(-50%)'
            }}
          >
            <div className="font-extrabold text-[9px] text-slate-400 uppercase tracking-widest">{chartData[hoveredIndex].label} Timeline</div>
            <div className="flex items-center justify-between gap-6">
              <span className="flex items-center gap-1.5 font-bold"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> Total Users:</span>
              <span className="font-mono font-black">{chartData[hoveredIndex].cumulativeUsers}</span>
            </div>
            <div className="flex items-center justify-between gap-6">
              <span className="flex items-center gap-1.5 font-bold"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Premium:</span>
              <span className="font-mono font-black">{chartData[hoveredIndex].premiumUsers}</span>
            </div>
            <div className="flex items-center justify-between gap-6">
              <span className="flex items-center gap-1.5 font-bold"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Monthly Signups:</span>
              <span className="font-mono font-black">+{chartData[hoveredIndex].registrations}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  // SVG Donut Chart Drawing Logic
  const drawDonutChart = () => {
    const totalPlanUsers = donutData.reduce((sum, item) => sum + item.value, 0);
    const r = 50;
    const strokeWidth = 14;
    const circ = 2 * Math.PI * r;

    if (totalPlanUsers === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-48 py-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-150">
          <ShieldAlert size={24} className="text-slate-300 mb-2" />
          <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">No Subscriber Data</span>
          <p className="text-[9px] text-slate-400 font-bold mt-1 text-center max-w-[180px]">Active tiers count is currently 0. Switch to "All accounts" above!</p>
        </div>
      );
    }

    let accumulatedPct = 0;

    return (
      <div className="flex flex-col sm:flex-row items-center justify-around gap-6">
        <div className="relative w-40 h-40 flex items-center justify-center shrink-0">
          <svg width="150" height="150" viewBox="0 0 130 130" className="-rotate-90">
            {donutData.map((item, idx) => {
              if (item.value === 0) return null;
              const pct = item.value / totalPlanUsers;
              const strokeOffset = circ - (pct * circ);
              const rotation = accumulatedPct * 360;
              accumulatedPct += pct;

              return (
                <circle
                  key={idx}
                  cx="65"
                  cy="65"
                  r={r}
                  fill="transparent"
                  stroke={item.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={circ}
                  strokeDashoffset={strokeOffset}
                  transform={`rotate(${rotation} 65 65)`}
                  className="transition-all duration-300 hover:opacity-90 cursor-pointer"
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col justify-center items-center pointer-events-none select-none">
            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest leading-none">Total</span>
            <span className="text-xl font-black text-slate-900 mt-1.5">{totalPlanUsers}</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 w-full flex flex-col gap-2.5">
          {donutData.map((item, idx) => {
            const pct = totalPlanUsers > 0 ? Math.round((item.value / totalPlanUsers) * 100) : 0;
            return (
              <div key={idx} className="flex items-center justify-between py-1 border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-xs font-black text-slate-700">{item.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-slate-400 font-bold">{item.value} users</span>
                  <span className="text-xs font-black text-slate-900 font-mono w-10 text-right">{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return <LoadingState label="Loading admin dashboard..." />;
  }

  if (error) {
    return (
      <div className="bg-rose-50 border border-rose-100 text-rose-600 p-6 rounded-3xl text-center font-bold text-sm flex items-center justify-center gap-2.5">
        <AlertCircle size={18} />
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Admin Welcome Banner */}
      <div className="bg-gradient-to-r from-indigo-900 to-indigo-700 p-8 rounded-3xl text-white relative overflow-hidden shadow-xl shadow-indigo-100">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="max-w-xl">
            <span className="text-[9px] font-black uppercase tracking-widest text-indigo-200 bg-indigo-500/30 px-3 py-1 rounded-full border border-indigo-400/20">System Admin</span>
            <h1 className="text-2xl font-black mt-4">Admin Overview</h1>
            <p className="text-xs text-indigo-100/90 font-medium leading-relaxed mt-2.5">
              System-wide performance monitoring and user signup analytics.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 bg-white/10 backdrop-blur border border-white/20 text-white px-4 py-2.5 rounded-2xl text-xs font-black shrink-0 self-start">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span> Live Dashboard
          </span>
        </div>
        <div className="absolute -bottom-16 -right-16 w-60 h-60 bg-indigo-500/20 rounded-full blur-3xl" />
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-indigo-600/30 rounded-full blur-2xl" />
      </div>

      {/* Aggregate Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat, idx) => (
          <StatCard
            key={stat.name}
            name={stat.name}
            value={stat.value}
            icon={stat.icon}
            color={stat.color}
            trend={stat.subtitle}
            delay={reducedMotion ? 0 : idx * 0.05}
          />
        ))}
      </div>

      {/* Main Charts & logs section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Column: Users growth line chart */}
        <div className="lg:col-span-7 bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between min-h-[400px]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-base font-black text-slate-900">Registration Trend</h3>
              <p className="text-[10px] font-bold text-slate-400 mt-0.5">Historical user signups and subscription counts</p>
            </div>

            {/* Chart Legends */}
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-500 uppercase tracking-wider">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Total Users
              </div>
              <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-500 uppercase tracking-wider">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Premium
              </div>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center">
            {drawLineChart()}
          </div>
        </div>

        {/* Right Column: Plans distribution pie/donut chart */}
        <div className="lg:col-span-5 bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between min-h-[400px]">
          <div className="flex items-center justify-between gap-2 mb-6">
            <div>
              <h3 className="text-base font-black text-slate-900">Subscription Plans</h3>
              <p className="text-[10px] font-bold text-slate-400 mt-0.5">Distribution of user accounts</p>
            </div>

            {/* Pie Toggles */}
            <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
              <button
                onClick={() => setPlanPieMode('active')}
                className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all cursor-pointer ${
                  planPieMode === 'active' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setPlanPieMode('all')}
                className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all cursor-pointer ${
                  planPieMode === 'all' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                All
              </button>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center">
            {drawDonutChart()}
          </div>
        </div>

      </div>

      {/* Bottom Row: Recent System activity & users listings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left list: Recent Signups */}
        <div className="lg:col-span-8 bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-base font-black text-slate-900">Recent System Signups</h3>
              <p className="text-[10px] font-bold text-slate-400 mt-0.5">Latest registrations and user listings activity</p>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {recentUsers.length > 0 ? (
              recentUsers.map((user, i) => (
                <div key={user._id || i} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0 group">
                  <div className="flex items-center space-x-3.5 min-w-0">
                    <div className="w-11 h-11 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0 border border-indigo-100 shadow-inner">
                      <UserPlus size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-slate-800 truncate group-hover:text-indigo-600 transition-colors">{user.firstName} {user.lastName}</span>
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase border shrink-0 ${
                          user.subscription?.status === 'active' && user.subscription?.plan !== 'free'
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                            : 'bg-slate-50 text-slate-500 border-slate-100'
                        }`}>
                          {user.subscription?.plan || 'Free'}
                        </span>
                      </div>
                      <p className="text-[10px] font-semibold text-slate-400 mt-0.5 truncate">{user.email}</p>
                    </div>
                  </div>
                  <div className="text-right space-y-1 shrink-0 pl-3">
                    <div className="text-[11px] font-black text-slate-800 font-mono">
                      {user.stats?.total || 0} listings
                    </div>
                    <div className="text-[10px] font-bold text-slate-400">
                      Joined {formatTimeAgo(user.createdAt)}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-16 text-slate-400 font-bold text-xs">
                No recent signups found in system database.
              </div>
            )}
          </div>
        </div>

        {/* Right Info: Server Health & Analytics */}
        <div className="lg:col-span-4 bg-indigo-950 p-7 rounded-3xl text-white relative overflow-hidden shadow-xl shadow-slate-100 flex flex-col justify-between">
          <div className="relative z-10 space-y-6">
            <div className="flex items-center justify-between">
              <div className="w-11 h-11 bg-indigo-900/50 border border-indigo-800 rounded-2xl flex items-center justify-center text-indigo-300">
                <BarChart3 size={20} />
              </div>
              <span className="text-[9px] font-black text-indigo-300 bg-indigo-900/50 border border-indigo-800 px-3 py-1 rounded-full uppercase tracking-wider">Metrics</span>
            </div>
            <div className="space-y-2">
              <h4 className="text-lg font-black">System Health & Services</h4>
              <p className="text-indigo-200/80 text-xs leading-relaxed font-medium">
                Continuous performance indexing and load balancing for active cross-listing microservices.
              </p>
            </div>

            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between text-xs font-bold border-b border-indigo-900/60 pb-2.5">
                <span className="text-indigo-300">Database Server</span>
                <span className="text-emerald-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                  Online
                </span>
              </div>
              <div className="flex items-center justify-between text-xs font-bold border-b border-indigo-900/60 pb-2.5">
                <span className="text-indigo-300">Queue Worker</span>
                <span className="text-emerald-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                  Online (0 lag)
                </span>
              </div>
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-indigo-300">API Gateway latency</span>
                <span className="text-white font-mono font-black">42 ms</span>
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-6 mt-6 border-t border-indigo-900/60 flex items-center justify-between">
            <span className="text-[9px] text-indigo-300 font-black uppercase tracking-wider">Build</span>
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/25 text-indigo-200 border border-indigo-500/40 text-[9px] font-black uppercase tracking-wide">
              v1.2.0 Stable
            </span>
          </div>
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-28 h-28 bg-indigo-500/20 rounded-full blur-2xl" />
        </div>

      </div>

    </div>
  );
};

export default NewAdminDashboard;
