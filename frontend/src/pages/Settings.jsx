import React from 'react';
import { motion } from 'framer-motion';
import { 
  User, 
  Lock, 
  Bell, 
  Shield, 
  Globe, 
  Database, 
  LogOut,
  ChevronRight
} from 'lucide-react';

const Settings = () => {
  const sections = [
    { name: 'Profile Information', icon: <User size={20} />, description: 'Update your name, email, and personal details.' },
    { name: 'Password & Security', icon: <Lock size={20} />, description: 'Change your password and enable two-factor auth.' },
    { name: 'Notifications', icon: <Bell size={20} />, description: 'Configure how you receive alerts and updates.' },
    { name: 'Privacy & Data', icon: <Shield size={20} />, description: 'Manage your data and connected third-party apps.' },
    { name: 'Listing Defaults', icon: <Database size={20} />, description: 'Set global defaults for new eBay listings.' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500">Manage your account preferences and security.</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {sections.map((section, index) => (
          <motion.div
            key={section.name}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer group flex items-center justify-between"
          >
            <div className="flex items-center space-x-5">
              <div className="w-12 h-12 bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 rounded-2xl flex items-center justify-center transition-colors">
                {section.icon}
              </div>
              <div>
                <h3 className="font-bold text-slate-900">{section.name}</h3>
                <p className="text-sm text-slate-500">{section.description}</p>
              </div>
            </div>
            <ChevronRight className="text-slate-300 group-hover:text-indigo-600 transition-colors" />
          </motion.div>
        ))}
      </div>

      <div className="pt-8 border-t border-slate-100">
        <h3 className="text-sm font-bold text-rose-600 uppercase mb-4 px-1">Danger Zone</h3>
        <div className="bg-rose-50 border border-rose-100 p-6 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h4 className="font-bold text-rose-900">Delete Account</h4>
            <p className="text-sm text-rose-700/70">Permanently remove your account and all listing data. This action is irreversible.</p>
          </div>
          <button className="px-6 py-3 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 transition-all shadow-lg shadow-rose-200">
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
