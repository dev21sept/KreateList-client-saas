import React from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  CreditCard, 
  ShoppingBag, 
  BarChart3, 
  ArrowUpRight,
  TrendingUp,
  Activity
} from 'lucide-react';

const AdminDashboard = () => {
  const stats = [
    { name: 'Total Users', value: '12,842', icon: <Users size={24} />, color: 'bg-indigo-600' },
    { name: 'Monthly Revenue', value: '$48,290', icon: <CreditCard size={24} />, color: 'bg-emerald-600' },
    { name: 'Total Listings', value: '450,210', icon: <ShoppingBag size={24} />, color: 'bg-violet-600' },
    { name: 'Active Subs', value: '1,240', icon: <Activity size={24} />, color: 'bg-amber-600' },
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
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-start space-x-4">
                <div className="w-2 h-2 bg-indigo-600 rounded-full mt-2 shrink-0"></div>
                <div>
                  <p className="text-sm font-bold text-slate-900">New Premium Subscription</p>
                  <p className="text-xs text-slate-500">User <span className="font-mono">#ID-2910</span> upgraded to Pro Plan • 5m ago</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
