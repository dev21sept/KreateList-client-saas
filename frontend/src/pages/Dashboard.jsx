import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  ShoppingBag, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  TrendingUp, 
  ArrowUpRight,
  FileText
} from 'lucide-react';
import { listingService, authService, ebayService } from '../services/api';

const Dashboard = () => {
  const navigate = useNavigate();
  const [statsData, setStatsData] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [user, setUser] = useState(null);
  const [ebayStatus, setEbayStatus] = useState(null);
  const [loading, setLoading] = useState(true);

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

  const getRemainingDays = (expiresAt) => {
    if (!expiresAt) return null;
    const diffTime = new Date(expiresAt) - new Date();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, userRes, ebayRes] = await Promise.all([
          listingService.getStats(),
          authService.getMe(),
          ebayService.getStatus()
        ]);
        
        setStatsData(statsRes.data.data.stats);
        setRecentActivity(statsRes.data.data.recentActivity);
        setUser(userRes.data.data);
        setEbayStatus(ebayRes.data.data);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const stats = [
    { name: 'Total Listings', value: statsData?.total || 0, icon: <ShoppingBag size={24} />, color: 'bg-indigo-500', trend: '+0%' },
    { name: 'Published', value: statsData?.published || 0, icon: <CheckCircle size={24} />, color: 'bg-emerald-500', trend: '+0%' },
    { name: 'Drafts', value: statsData?.draft || 0, icon: <FileText size={24} />, color: 'bg-slate-500', trend: '+0%' },
    { name: 'Scheduled', value: statsData?.scheduled || 0, icon: <Clock size={24} />, color: 'bg-amber-500', trend: '+0%' },
    { name: 'Failed', value: statsData?.failed || 0, icon: <AlertCircle size={24} />, color: 'bg-rose-500', trend: '+0%' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Welcome back, {user?.firstName || 'User'}!</h1>
        <p className="text-slate-500">Here's what's happening with your eBay store today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`${stat.color} p-3 rounded-2xl text-white`}>
                {stat.icon}
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                stat.trend.startsWith('+') ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
              }`}>
                {stat.trend}
              </span>
            </div>
            <h3 className="text-slate-500 text-sm font-medium">{stat.name}</h3>
            <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart/Activity Area */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-900">Recent Activity</h3>
              <button className="text-indigo-600 text-sm font-bold flex items-center hover:underline">
                View all <ArrowUpRight size={16} className="ml-1" />
              </button>
            </div>
            <div className="space-y-6">
              {recentActivity.length > 0 ? (
                recentActivity.map((activity) => (
                  <div key={activity._id} className="flex items-center justify-between py-2">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
                        <ShoppingBag size={20} className="text-slate-500" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{activity.title}</p>
                        <p className="text-xs text-slate-500">
                          Listing {activity.status} • {new Date(activity.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                      activity.status === 'published' ? 'bg-emerald-50 text-emerald-600' : 
                      activity.status === 'failed' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
                    }`}>
                      {activity.status.charAt(0).toUpperCase() + activity.status.slice(1)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-400">No recent activity found.</div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-indigo-600 p-8 rounded-3xl shadow-xl shadow-indigo-200 text-white relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="text-xl font-bold mb-1 capitalize">{user?.subscription?.plan || 'Free'} Plan</h3>
              {user?.subscription?.expiresAt && (
                <div className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-4">
                  {getRemainingDays(user.subscription.expiresAt)} Days Left
                </div>
              )}
              <p className="text-indigo-100 text-sm mb-6">
                You've used {statsData?.total || 0} of {getPlanLimit(user?.subscription?.plan)} monthly listings.
              </p>
              <div className="w-full bg-indigo-500 rounded-full h-2 mb-6">
                <div 
                  className="bg-white h-2 rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(((statsData?.total || 0) / Math.max(getPlanLimit(user?.subscription?.plan), 1)) * 100, 100)}%` }}
                ></div>
              </div>
              <button 
                onClick={() => navigate('/subscription')}
                className="w-full py-3 bg-white text-indigo-600 font-bold rounded-xl hover:bg-indigo-50 transition-colors"
              >
                Upgrade Plan
              </button>
            </div>
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl"></div>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-4">eBay Connection</h3>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center">
                  <LinkIcon size={20} className="text-indigo-600" />
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">{ebayStatus?.username || 'Not Connected'}</p>
                  <p className={`text-xs flex items-center ${ebayStatus?.connected ? 'text-emerald-600' : 'text-rose-600'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${ebayStatus?.connected ? 'bg-emerald-500' : 'bg-rose-500'}`}></span> 
                    {ebayStatus?.connected ? 'Connected' : 'Disconnected'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const LinkIcon = ({ size, className }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
  </svg>
);

export default Dashboard;
