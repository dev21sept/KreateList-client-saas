import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Settings as SettingsIcon, 
  Database, 
  Globe, 
  Lock, 
  Bell, 
  Server,
  ChevronRight,
  Save,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';

const AdminSettings = () => {
  const { toast } = useNotification();
  const [activeTab, setActiveTab] = useState('general');
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(null); // 'aws', 'db', or null

  // Form State
  const [settings, setSettings] = useState({
    platformName: 'Elister.ai',
    supportEmail: 'support@elister.ai',
    maintenanceMode: false,
    
    dbAutoBackup: true,
    dbBackupSchedule: 'daily', // 'hourly', 'daily', 'weekly'
    dbLogRetention: 30,
    
    ebayDailyLimit: 5000,
    ebayRetryAttempts: 3,
    ebaySyncInterval: 15,
    
    securityEnforce2FA: false,
    securitySessionTimeout: 60,
    securityPasswordExpiry: 90,
    
    emailSenderName: 'Elister Support',
    emailSenderAddress: 'noreply@elister.ai',
    emailTemplateWelcome: true,
    
    awsS3Region: 'us-east-1',
    awsS3Bucket: 'elister-listings-prod',
    awsWorkerNodeCount: 2
  });

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    setSaving(true);
    // Simulate API Saving latency
    setTimeout(() => {
      setSaving(false);
      toast.success('System configuration saved successfully!');
    }, 1000);
  };

  const handleTestConnection = (service) => {
    setTestingConnection(service);
    setTimeout(() => {
      setTestingConnection(null);
      if (service === 'aws') {
        toast.success('AWS S3 Bucket connection verified! Status: Connected.');
      } else if (service === 'db') {
        toast.success('Database cluster checks passed! Connection latency: 12ms.');
      }
    }, 1200);
  };

  const tabs = [
    { id: 'general', name: 'General Configuration', icon: <SettingsIcon size={18} />, desc: 'System title, support channels, and modes' },
    { id: 'database', name: 'Database Maintenance', icon: <Database size={18} />, desc: 'Automatic backups, data pruning, and logs' },
    { id: 'ebay', name: 'eBay API Sync Options', icon: <Globe size={18} />, desc: 'Request throttling, retries, and intervals' },
    { id: 'security', name: 'Security & Session Auth', icon: <Lock size={18} />, desc: 'Admin multi-factor settings and timeout bounds' },
    { id: 'email', name: 'Email Notifications', icon: <Bell size={18} />, desc: 'Sender details and auto-mailer toggles' },
    { id: 'cloud', name: 'Cloud Infrastructure', icon: <Server size={18} />, desc: 'AWS S3 buckets and worker instance pools' },
  ];

  return (
    <div className="space-y-6">
      
      {/* Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/20 rounded-full -mr-32 -mt-32 blur-2xl" />
        <div className="relative">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">System Settings</h1>
          <p className="text-slate-500 font-medium text-sm mt-0.5">Control system variables, configure remote endpoints, and manage databases.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Navigation Sidebar Panel */}
        <div className="lg:col-span-4 bg-white rounded-[2rem] border border-slate-100 shadow-sm p-4.5 space-y-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3.5 p-3 rounded-2xl text-left transition-all duration-300 cursor-pointer border ${
                  isActive 
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/10' 
                    : 'bg-white text-slate-500 hover:bg-slate-50 border-transparent hover:text-slate-900'
                }`}
              >
                <div className={`p-2 rounded-xl shrink-0 ${isActive ? 'bg-white/10 text-white' : 'bg-slate-50 text-slate-400'}`}>
                  {tab.icon}
                </div>
                <div className="min-w-0">
                  <h4 className={`text-xs font-black leading-tight ${isActive ? 'text-white' : 'text-slate-800'}`}>
                    {tab.name}
                  </h4>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5 truncate">{tab.desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Dynamic Interactive Settings Form */}
        <div className="lg:col-span-8 bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[440px]">
          <form onSubmit={handleSave} className="flex-1 flex flex-col justify-between">
            
            {/* Form Fields Area */}
            <div className="p-8 space-y-6">
              
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-5"
                >
                  
                  {/* Category description */}
                  <div>
                    <h3 className="text-lg font-black text-slate-950">
                      {tabs.find(t => t.id === activeTab)?.name}
                    </h3>
                    <p className="text-slate-400 text-xs font-semibold mt-0.5">
                      Adjust parameters below to modify system behaviors.
                    </p>
                  </div>

                  {/* Fields based on activeTab */}
                  {activeTab === 'general' && (
                    <div className="space-y-4 pt-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-450 uppercase tracking-widest">Platform Brand Name</label>
                          <input 
                            type="text" 
                            name="platformName"
                            value={settings.platformName}
                            onChange={handleInputChange}
                            required
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-450 uppercase tracking-widest">Contact Support Email</label>
                          <input 
                            type="email" 
                            name="supportEmail"
                            value={settings.supportEmail}
                            onChange={handleInputChange}
                            required
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                          />
                        </div>
                      </div>

                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between mt-6">
                        <div>
                          <h5 className="text-xs font-extrabold text-slate-800">System Maintenance Mode</h5>
                          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Forces client views offline, displaying a maintenance alert page.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer select-none">
                          <input 
                            type="checkbox" 
                            name="maintenanceMode"
                            checked={settings.maintenanceMode}
                            onChange={handleInputChange}
                            className="sr-only peer" 
                          />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                      </div>
                    </div>
                  )}

                  {activeTab === 'database' && (
                    <div className="space-y-4 pt-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-450 uppercase tracking-widest">Backup Frequency</label>
                          <select 
                            name="dbBackupSchedule"
                            value={settings.dbBackupSchedule}
                            onChange={handleInputChange}
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 cursor-pointer"
                          >
                            <option value="hourly">Every Hour</option>
                            <option value="daily">Every 24 Hours (Daily)</option>
                            <option value="weekly">Every 7 Days (Weekly)</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-450 uppercase tracking-widest">Prune Activity Logs (Days)</label>
                          <input 
                            type="number" 
                            name="dbLogRetention"
                            value={settings.dbLogRetention}
                            onChange={handleInputChange}
                            required
                            min="1"
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                          />
                        </div>
                      </div>

                      <div className="p-4.5 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-6">
                        <div>
                          <h5 className="text-xs font-extrabold text-slate-800">Database Connection Status</h5>
                          <p className="text-[10px] text-slate-450 font-semibold mt-0.5">Primary MongoDB cluster replication sets.</p>
                        </div>
                        <button 
                          type="button"
                          onClick={() => handleTestConnection('db')}
                          disabled={testingConnection !== null}
                          className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100/80 disabled:opacity-50 text-indigo-650 rounded-xl text-xs font-bold border border-indigo-100 transition-all cursor-pointer shadow-xs shrink-0 self-start sm:self-center"
                        >
                          {testingConnection === 'db' ? <Loader2 className="animate-spin" size={12} /> : <RefreshCw size={12} />}
                          Run Cluster Check
                        </button>
                      </div>
                    </div>
                  )}

                  {activeTab === 'ebay' && (
                    <div className="space-y-4 pt-2">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-450 uppercase tracking-widest">Daily API Request Limit</label>
                          <input 
                            type="number" 
                            name="ebayDailyLimit"
                            value={settings.ebayDailyLimit}
                            onChange={handleInputChange}
                            required
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-450 uppercase tracking-widest">Error Retry Attempts</label>
                          <input 
                            type="number" 
                            name="ebayRetryAttempts"
                            value={settings.ebayRetryAttempts}
                            onChange={handleInputChange}
                            required
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-455 uppercase tracking-widest">Sync Frequency (Mins)</label>
                          <input 
                            type="number" 
                            name="ebaySyncInterval"
                            value={settings.ebaySyncInterval}
                            onChange={handleInputChange}
                            required
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'security' && (
                    <div className="space-y-4 pt-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-450 uppercase tracking-widest">Session Timeout (Mins)</label>
                          <input 
                            type="number" 
                            name="securitySessionTimeout"
                            value={settings.securitySessionTimeout}
                            onChange={handleInputChange}
                            required
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-450 uppercase tracking-widest">Password Expiry (Days)</label>
                          <input 
                            type="number" 
                            name="securityPasswordExpiry"
                            value={settings.securityPasswordExpiry}
                            onChange={handleInputChange}
                            required
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10"
                          />
                        </div>
                      </div>

                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between mt-6">
                        <div>
                          <h5 className="text-xs font-extrabold text-slate-800">Enforce Multi-Factor (2FA)</h5>
                          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Require all administrative roles to authenticate via Google/Email OTP.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer select-none">
                          <input 
                            type="checkbox" 
                            name="securityEnforce2FA"
                            checked={settings.securityEnforce2FA}
                            onChange={handleInputChange}
                            className="sr-only peer" 
                          />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-650"></div>
                        </label>
                      </div>
                    </div>
                  )}

                  {activeTab === 'email' && (
                    <div className="space-y-4 pt-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-455 uppercase tracking-widest">Sender Display Name</label>
                          <input 
                            type="text" 
                            name="emailSenderName"
                            value={settings.emailSenderName}
                            onChange={handleInputChange}
                            required
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-450 uppercase tracking-widest">Sender Email Address</label>
                          <input 
                            type="email" 
                            name="emailSenderAddress"
                            value={settings.emailSenderAddress}
                            onChange={handleInputChange}
                            required
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'cloud' && (
                    <div className="space-y-4 pt-2">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-450 uppercase tracking-widest">AWS Storage Region</label>
                          <input 
                            type="text" 
                            name="awsS3Region"
                            value={settings.awsS3Region}
                            onChange={handleInputChange}
                            required
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-450 uppercase tracking-widest">AWS S3 Assets Bucket</label>
                          <input 
                            type="text" 
                            name="awsS3Bucket"
                            value={settings.awsS3Bucket}
                            onChange={handleInputChange}
                            required
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-455 uppercase tracking-widest">Worker Node Instance count</label>
                          <input 
                            type="number" 
                            name="awsWorkerNodeCount"
                            value={settings.awsWorkerNodeCount}
                            onChange={handleInputChange}
                            required
                            min="1"
                            max="20"
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10"
                          />
                        </div>
                      </div>

                      <div className="p-4.5 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-6">
                        <div>
                          <h5 className="text-xs font-extrabold text-slate-800">Verify AWS Node Sync</h5>
                          <p className="text-[10px] text-slate-450 font-semibold mt-0.5">Test S3 assets access and ECS nodes replication check.</p>
                        </div>
                        <button 
                          type="button"
                          onClick={() => handleTestConnection('aws')}
                          disabled={testingConnection !== null}
                          className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100/80 disabled:opacity-50 text-indigo-600 rounded-xl text-xs font-bold border border-indigo-100 transition-all cursor-pointer shadow-xs shrink-0 self-start sm:self-center"
                        >
                          {testingConnection === 'aws' ? <Loader2 className="animate-spin" size={12} /> : <RefreshCw size={12} />}
                          Test AWS Sync
                        </button>
                      </div>
                    </div>
                  )}

                </motion.div>
              </AnimatePresence>

            </div>

            {/* Bottom Actions footer */}
            <div className="p-6 bg-slate-50/50 border-t border-slate-50 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-2xl text-xs font-black shadow-md shadow-indigo-100 active:scale-95 transition-all cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 className="animate-spin" size={14} />
                    Saving System Configuration...
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    Save Configuration
                  </>
                )}
              </button>
            </div>

          </form>
        </div>

      </div>

    </div>
  );
};

export default AdminSettings;
