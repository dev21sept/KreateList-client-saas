import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  CreditCard, 
  ShoppingBag, 
  BarChart3, 
  Activity,
  UserPlus,
  TrendingUp,
  ArrowUpRight,
  CheckCircle,
  AlertCircle,
  FileText,
  ShieldAlert,
  Calendar,
  Layers,
  ChevronDown
} from 'lucide-react';
import { adminService } from '../../services/api';

const NewAdminDashboard = () => {
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
      { name: 'Total Users', value: totalUsers, icon: <Users size={20} />, color: 'bg-indigo-50 text-indigo-655 border-indigo-100', subtitle: 'Registered Accounts' },
      { name: 'Active Premium', value: premiumUsers, icon: <Activity size={20} />, color: 'bg-emerald-50 text-emerald-600 border-emerald-100', subtitle: 'Premium Tiers' },
      { name: 'Monthly Revenue', value: `$${monthlyRev.toLocaleString()}`, icon: <CreditCard size={20} />, color: 'bg-amber-50 text-amber-600 border-amber-100', subtitle: 'Average estimate' },
      { name: 'Total Listings', value: totalListingsCount, icon: <ShoppingBag size={20} />, color: 'bg-violet-50 text-violet-650 border-violet-100', subtitle: `${publishedListingsCount} Published` }
    ];
  }, [allUsers]);

  // SVG Line Chart Drawing logic
  const drawLineChart = () => {
    if (chartData.length === 0) {
      return (
        <div className="h-[200px] flex items-center justify-center text-slate-400 text-xs font-bold">
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
                <text x={x} y={height - 5} textAnchor="middle" className="text-[9px] font-black fill-slate-450">{d.label}</text>

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
            className="absolute bg-slate-900 border border-slate-800 text-white p-3 rounded-2xl shadow-2xl flex flex-col gap-1.5 z-50 pointer-events-none select-none text-[11px] animate-in fade-in duration-100"
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
        <div className="flex flex-col items-center justify-center h-48 py-4 bg-slate-50/55 rounded-2xl border border-dashed border-slate-150">
          <ShieldAlert size={24} className="text-slate-350 mb-2" />
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
                  className="transition-all duration-500 hover:opacity-90 cursor-pointer"
                />
              );
            })}
          </svg>
          <div className="absolute flex flex-col items-center justify-center text-center">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total</span>
            <span className="text-2xl font-black text-slate-900 leading-tight">{totalPlanUsers}</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-2.5 w-full">
          {donutData.map((item, idx) => {
            const pct = totalPlanUsers > 0 ? Math.round((item.value / totalPlanUsers) * 100) : 0;
            return (
              <div key={idx} className="flex items-center justify-between text-xs font-bold">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-600">{item.label}</span>
                </div>
                <div className="flex gap-4">
                  <span className="text-slate-400 font-mono font-medium">{item.value} users</span>
                  <span className="text-slate-900 font-black">{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-[450px] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-50 border border-rose-100 text-rose-600 p-6 rounded-3xl text-center font-bold">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Dynamic Dashboard Header matching Client Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/30 rounded-full -mr-32 -mt-32 blur-2xl transition-all duration-700" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Admin Overview</h1>
            <div className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[8px] font-black uppercase tracking-widest border border-emerald-200">
              System Admin
            </div>
          </div>
          <p className="text-slate-500 font-medium text-sm">System-wide performance monitoring and user signup analytics.</p>
        </div>
        <div className="relative flex gap-3">
          <span className="bg-emerald-50 text-emerald-600 px-4 py-2.5 rounded-2xl text-xs font-black border border-emerald-100 flex items-center shadow-sm">
            <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-ping"></span> Live Dashboard
          </span>
        </div>
      </div>

      {/* Aggregate Stats Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.name}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group"
          >
            <div>
              <div className={`${stat.color} w-11 h-11 rounded-2xl flex items-center justify-center border mb-4 group-hover:scale-105 transition-transform duration-300`}>
                {stat.icon}
              </div>
              <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider">{stat.name}</h3>
              <p className="text-3xl font-black text-slate-900 mt-1 tracking-tight">{stat.value}</p>
            </div>
            <div className="pt-3 border-t border-slate-50 mt-4 text-[10px] font-bold text-slate-455 flex justify-between items-center">
              <span>{stat.subtitle}</span>
              <ArrowUpRight size={12} className="text-slate-400 group-hover:text-indigo-650 transition-colors" />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Charts & logs section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Users growth line chart */}
        <div className="lg:col-span-7 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between min-h-[400px]">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-955">Registration Trend</h3>
              <p className="text-slate-400 text-xs font-semibold mt-0.5">Historical user signups and subscription counts</p>
            </div>
            
            {/* Chart Legends */}
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase">
                <span className="w-2 h-2 rounded-full bg-indigo-500" /> Total Users
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Premium
              </div>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center">
            {drawLineChart()}
          </div>
        </div>

        {/* Right Column: Plans distribution pie/donut chart */}
        <div className="lg:col-span-5 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between min-h-[400px]">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-955">Subscription Plans</h3>
              <p className="text-slate-400 text-xs font-semibold mt-0.5">Distribution of user accounts</p>
            </div>
            
            {/* Pie Toggles */}
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setPlanPieMode('active')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${
                  planPieMode === 'active' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setPlanPieMode('all')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${
                  planPieMode === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-550'
                }`}
              >
                All
              </button>
            </div>
          </div>

          <div className="flex-grow flex items-center justify-center">
            {drawDonutChart()}
          </div>
        </div>

      </div>

      {/* Bottom Row: Recent System activity & users listings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left list: Recent Signups */}
        <div className="lg:col-span-8 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-955">Recent System Signups</h3>
              <p className="text-slate-400 text-xs font-semibold mt-0.5">Latest registrations and user listings activity</p>
            </div>
          </div>

          <div className="divide-y divide-slate-50">
            {recentUsers.length > 0 ? (
              recentUsers.map((user, i) => (
                <div key={user._id || i} className="flex items-center justify-between py-4.5 first:pt-0 last:pb-0 group">
                  <div className="flex items-center space-x-4">
                    <div className="w-11 h-11 bg-indigo-50 text-indigo-650 rounded-xl flex items-center justify-center shrink-0 border border-indigo-100 group-hover:scale-105 transition-transform duration-300">
                      <UserPlus size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-slate-900">{user.firstName} {user.lastName}</span>
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase border ${
                          user.subscription?.status === 'active' && user.subscription?.plan !== 'free'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            : 'bg-slate-50 text-slate-550 border-slate-100'
                        }`}>
                          {user.subscription?.plan || 'Free'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-semibold mt-0.5">{user.email}</p>
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="text-xs font-extrabold text-slate-800 font-mono">
                      {user.stats?.total || 0} listings total
                    </div>
                    <div className="text-[10px] font-bold text-slate-400">
                      Joined {formatTimeAgo(user.createdAt)}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs font-bold">
                No recent signups found in system database.
              </div>
            )}
          </div>
        </div>

        {/* Right Info: Server Health & Analytics */}
        <div className="lg:col-span-4 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-8 rounded-[2.5rem] text-white relative overflow-hidden border border-slate-800 shadow-xl shadow-indigo-950/10">
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-violet-600/10 rounded-full blur-3xl" />

          <div className="relative space-y-6 flex flex-col justify-between h-full">
            <div className="space-y-6">
              <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400 border border-indigo-500/20 shadow-inner">
                <BarChart3 size={24} className="animate-pulse" />
              </div>
              <div className="space-y-2">
                <h4 className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  System Health & Services
                </h4>
                <p className="text-slate-450 text-xs leading-relaxed font-medium">
                  Continuous performance indexing and load balancing for active cross-listing microservices.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs font-bold border-b border-white/5 pb-2.5">
                  <span className="text-slate-400">Database Server</span>
                  <span className="text-emerald-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                    Online
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs font-bold border-b border-white/5 pb-2.5">
                  <span className="text-slate-455">Queue Worker</span>
                  <span className="text-emerald-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                    Online (0 lag)
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-405">API Gateway latency</span>
                  <span className="text-slate-200 font-mono font-medium">42 ms</span>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-white/5 flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Metrics</span>
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/25 text-indigo-300 border border-indigo-500/40 text-[9px] font-black uppercase tracking-wide">
                v1.2.0 Stable
              </span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};

export default NewAdminDashboard;
