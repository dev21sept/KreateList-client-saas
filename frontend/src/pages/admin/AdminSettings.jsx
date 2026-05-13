import React from 'react';
import { motion } from 'framer-motion';
import { 
  Settings as SettingsIcon, 
  Database, 
  Globe, 
  Lock, 
  Bell, 
  Server,
  CloudCog,
  ChevronRight
} from 'lucide-react';

const AdminSettings = () => {
  const sections = [
    { name: 'General Configuration', icon: <SettingsIcon size={20} />, description: 'System-wide settings and branding.' },
    { name: 'Database Maintenance', icon: <Database size={20} />, description: 'Cleanup logs and optimize collections.' },
    { name: 'eBay API Sync Settings', icon: <Globe size={20} />, description: 'Global API limits and retry policies.' },
    { name: 'Security & Auth', icon: <Lock size={20} />, description: '2FA requirements and session timeouts.' },
    { name: 'Email Notifications', icon: <Bell size={20} />, description: 'Configure transactional email templates.' },
    { name: 'Cloud Infrastructure', icon: <Server size={20} />, description: 'AWS EC2 and S3 bucket connection status.' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">System Settings</h1>
        <p className="text-slate-500">Configure global platform parameters and infrastructure.</p>
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
    </div>
  );
};

export default AdminSettings;
