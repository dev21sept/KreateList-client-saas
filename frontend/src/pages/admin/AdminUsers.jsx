import React from 'react';
import { motion } from 'framer-motion';
import { 
  Search, 
  MoreVertical, 
  Check, 
  X, 
  Shield, 
  Mail,
  Calendar,
  Filter
} from 'lucide-react';

const AdminUsers = () => {
  const users = [
    { id: 1, name: 'John Doe', email: 'john@example.com', plan: 'Pro', status: 'Active', joined: '2024-01-12' },
    { id: 2, name: 'Sarah Smith', email: 'sarah@design.io', plan: 'Basic', status: 'Active', joined: '2024-02-05' },
    { id: 3, name: 'Mike Johnson', email: 'mike@tech.com', plan: 'Enterprise', status: 'Suspended', joined: '2023-11-20' },
    { id: 4, name: 'Emily Brown', email: 'emily@store.net', plan: 'Free', status: 'Active', joined: '2024-03-15' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
          <p className="text-slate-500">Monitor and manage all KreateList customers.</p>
        </div>
        <div className="flex space-x-2">
          <button className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center">
            Download Report
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search by name, email or ID..." 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/10"
          />
        </div>
        <button className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-all flex items-center">
          <Filter size={16} className="mr-2" /> All Plans
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">User</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Plan</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Joined</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/50 transition-all">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xs">
                        {user.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{user.name}</p>
                        <p className="text-xs text-slate-400 flex items-center"><Mail size={12} className="mr-1" /> {user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                      user.plan === 'Enterprise' ? 'bg-indigo-100 text-indigo-600' : 
                      user.plan === 'Pro' ? 'bg-violet-100 text-violet-600' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {user.plan}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      {user.status === 'Active' ? (
                        <Check size={16} className="text-emerald-500 mr-2" />
                      ) : (
                        <X size={16} className="text-rose-500 mr-2" />
                      )}
                      <span className="text-sm font-medium text-slate-700">{user.status}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 flex items-center h-full pt-6">
                    <Calendar size={14} className="mr-2" /> {user.joined}
                  </td>
                  <td className="px-6 py-4">
                    <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-all">
                      <MoreVertical size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminUsers;
