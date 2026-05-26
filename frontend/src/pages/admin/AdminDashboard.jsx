import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  CreditCard, 
  ShoppingBag, 
  BarChart3, 
  Activity,
  UserPlus
} from 'lucide-react';
import { adminService } from '../../services/api';

const AdminDashboard = () => {
  const [statsData, setStatsData] = useState(null);
  const [recentUsers, setRecentUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
          // Keep top 5 recent users
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

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
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

  const stats = [
    { name: 'Total Users', value: statsData?.totalUsers || 0, icon: <Users size={24} />, color: 'bg-indigo-600' },
    { name: 'Monthly Revenue', value: statsData?.monthlyRevenue ? `$${statsData.monthlyRevenue.toLocaleString()}` : '$0', icon: <CreditCard size={24} />, color: 'bg-emerald-600' },
    { name: 'Total Listings', value: statsData?.totalListings || 0, icon: <ShoppingBag size={24} />, color: 'bg-violet-600' },
    { name: 'Active Subs', value: statsData?.activeSubscriptions || 0, icon: <Activity size={24} />, color: 'bg-amber-600' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Overview</h1>
          <p className="text-slate-500">System-wide performance and user analytics.</p>
        </div>
        <div className="flex space-x-2">
          <span className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-sm font-bold border border-emerald-100 flex items-center">
            <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2"></span> System Status: Online
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm"
          >
            <div className={`${stat.color} w-12 h-12 rounded-2xl flex items-center justify-center text-white mb-4`}>
              {stat.icon}
            </div>
            <h3 className="text-slate-500 text-sm font-medium">{stat.name}</h3>
            <p className="text-3xl font-black text-slate-900 mt-1">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Revenue Chart Placeholder */}
        <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm min-h-[400px] flex flex-col">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-lg font-bold text-slate-900">Revenue Growth</h3>
            <select className="bg-slate-50 border-none rounded-lg text-xs font-bold px-3 py-1.5 outline-none">
              <option>Last 30 Days</option>
              <option>Last 6 Months</option>
            </select>
          </div>
          <div className="flex-grow bg-slate-50 rounded-2xl flex items-center justify-center border border-dashed border-slate-200">
            <BarChart3 size={48} className="text-slate-300" />
            <span className="ml-4 text-slate-400 font-bold">Chart visualization goes here</span>
          </div>
        </div>

        {/* System Logs */}
        <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Recent System Activity</h3>
          <div className="space-y-6">
            {recentUsers.length > 0 ? (
              recentUsers.map((user, i) => (
                <div key={user._id || i} className="flex items-start space-x-4">
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 shrink-0">
                    <UserPlus size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">New User Registered</p>
                    <p className="text-xs text-slate-500">
                      {user.firstName} {user.lastName} ({user.email}) joined with{' '}
                      <span className="font-semibold text-indigo-600">
                        {user.subscription?.plan?.toUpperCase() || 'FREE'}
                      </span>{' '}
                      plan • {formatTimeAgo(user.createdAt)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-400 text-sm text-center py-8">No recent signups found.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;

