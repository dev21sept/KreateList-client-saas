import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Lock,
  Bell,
  Shield,
  Database,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  CheckCircle2,
  Loader2,
  Settings as SettingsIcon,
  ToggleLeft,
  ToggleRight,
  Download,
  Trash2,
  Puzzle,
  Sparkles,
  ExternalLink,
  Zap,
  HelpCircle,
  ArrowRight,
  Check,
  Copy
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/api';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Button from '../components/ui/Button';

const Settings = () => {
  const { user, loadUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabParam || 'profile');
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Sync tab with search params
  useEffect(() => {
    if (tabParam && ['profile', 'extensions', 'password', 'notifications', 'privacy', 'defaults'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
  };
  
  // Profile Form State
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    currency: 'USD'
  });

  // Password Form State
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Notifications State
  const [notificationData, setNotificationData] = useState({
    successAlerts: true,
    quotaWarnings: true,
    weeklyDigest: false,
    marketingEmails: false
  });

  // Privacy State
  const [privacyData, setPrivacyData] = useState({
    shareData: true,
    logRetention: '30'
  });

  // Listing Defaults State
  const [listingDefaults, setListingDefaults] = useState({
    defaultCondition: 'Pre-owned',
    defaultQuantity: 1,
    dispatchTime: '3',
    shippingType: 'Calculated'
  });

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success'|'error', text: '' }

  // Populate profile fields from context user
  useEffect(() => {
    if (user) {
      setProfileData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phone: user.phone || '',
        email: user.email || '',
        currency: user.currency || 'USD'
      });
    }
  }, [user]);

  // Clear feedback when changing tabs
  useEffect(() => {
    setFeedback(null);
  }, [activeTab]);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    try {
      const response = await authService.updateProfile({
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        phone: profileData.phone,
        currency: profileData.currency
      });
      if (response.data.success) {
        await loadUser(); // Update context so name changes everywhere
        setFeedback({ type: 'success', text: 'Profile updated successfully!' });
      }
    } catch (err) {
      setFeedback({ 
        type: 'error', 
        text: err.response?.data?.message || 'Failed to update profile.' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setFeedback(null);

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setFeedback({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setFeedback({ type: 'error', text: 'Password must be at least 6 characters long.' });
      return;
    }

    setLoading(true);
    try {
      const response = await authService.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      if (response.data.success) {
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setFeedback({ type: 'success', text: 'Password changed successfully!' });
      }
    } catch (err) {
      setFeedback({ 
        type: 'error', 
        text: err.response?.data?.message || 'Failed to change password.' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationsSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    setTimeout(() => {
      setFeedback({ type: 'success', text: 'Notification preferences updated successfully!' });
      setLoading(false);
    }, 600);
  };

  const handlePrivacySubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    setTimeout(() => {
      setFeedback({ type: 'success', text: 'Privacy & data options updated successfully!' });
      setLoading(false);
    }, 600);
  };

  const handleDefaultsSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    setTimeout(() => {
      setFeedback({ type: 'success', text: 'Listing defaults saved successfully!' });
      setLoading(false);
    }, 600);
  };

  const handleExportData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(user, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `elister_profile_data_${user?.firstName || 'user'}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const menuItems = [
    { id: 'profile', name: 'Profile Information', icon: <User size={18} /> },
    { id: 'extensions', name: 'Browser Extensions', icon: <Puzzle size={18} />, badge: 'Official' },
    { id: 'password', name: 'Password & Security', icon: <Lock size={18} /> },
    { id: 'notifications', name: 'Notifications', icon: <Bell size={18} /> },
    { id: 'privacy', name: 'Privacy & Data', icon: <Shield size={18} /> },
    { id: 'defaults', name: 'Listing Defaults', icon: <Database size={18} /> },
    { id: 'rules', name: 'Rules Engine', icon: <Database size={18} />, path: '/rules' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8 px-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500">Manage your account preferences, browser extensions, profile details, and security.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Navigation Sidebar */}
        <div className="md:col-span-4 bg-white rounded-3xl border border-slate-100 p-4 shadow-sm space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if (item.path) {
                  navigate(item.path);
                } else {
                  handleTabChange(item.id);
                }
              }}
              className={`w-full flex items-center justify-between p-4 rounded-2xl text-left transition-all ${
                activeTab === item.id
                  ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-100'
                  : 'text-slate-600 hover:bg-slate-50 font-semibold'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={activeTab === item.id ? 'text-white' : 'text-slate-400'}>
                  {item.icon}
                </span>
                <span className="text-sm">{item.name}</span>
                {item.badge && (
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                    activeTab === item.id
                      ? 'bg-white/20 text-white'
                      : 'bg-indigo-50 text-indigo-600'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </div>
              <ChevronRight size={16} className={activeTab === item.id ? 'text-white' : 'text-slate-400'} />
            </button>
          ))}
        </div>

        {/* Form Panel */}
        <div className="md:col-span-8 bg-white rounded-3xl border border-slate-100 p-8 shadow-sm min-h-[450px] flex flex-col">
          {/* Feedback Banner */}
          {feedback && (
            <div className={`p-4 mb-6 rounded-2xl border flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-200 ${
              feedback.type === 'success' 
                ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                : 'bg-rose-50 border-rose-100 text-rose-800'
            }`}>
              {feedback.type === 'success' ? (
                <CheckCircle size={18} className="shrink-0 mt-0.5 text-emerald-600" />
              ) : (
                <AlertCircle size={18} className="shrink-0 mt-0.5 text-rose-600" />
              )}
              <span className="text-xs font-bold">{feedback.text}</span>
            </div>
          )}

          <AnimatePresence mode="wait">
            {activeTab === 'profile' && (
              <motion.form
                key="profile-form"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                onSubmit={handleProfileSubmit}
                className="space-y-6 flex-1 flex flex-col"
              >
                <div>
                  <h3 className="text-base font-bold text-slate-900 mb-1">Profile Information</h3>
                  <p className="text-xs text-slate-500">Update your name and telephone number associated with your account.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">First Name</label>
                    <input
                      type="text"
                      required
                      value={profileData.firstName}
                      onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-sm font-semibold outline-none focus:border-indigo-500 transition-all bg-white"
                      placeholder="First Name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Last Name</label>
                    <input
                      type="text"
                      required
                      value={profileData.lastName}
                      onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-sm font-semibold outline-none focus:border-indigo-500 transition-all bg-white"
                      placeholder="Last Name"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                    <input
                      type="email"
                      disabled
                      value={profileData.email}
                      className="w-full px-4 py-3 border border-slate-100 bg-slate-50 text-slate-400 rounded-2xl text-sm font-semibold outline-none cursor-not-allowed"
                    />
                    <p className="text-[9px] font-bold text-slate-400 ml-1">Email address cannot be changed.</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                    <input
                      type="text"
                      value={profileData.phone}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-sm font-semibold outline-none focus:border-indigo-500 transition-all bg-white"
                      placeholder="Phone Number"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Subscription Billing Currency</label>
                    <select
                      value={profileData.currency}
                      onChange={(e) => setProfileData({ ...profileData, currency: e.target.value })}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-semibold outline-none focus:border-indigo-500 transition-all cursor-pointer"
                    >
                      <option value="USD">USD ($ - United States Dollar)</option>
                      <option value="EUR">EUR (€ - Euro)</option>
                      <option value="GBP">GBP (£ - Great British Pound)</option>
                      <option value="INR">INR (₹ - Indian Rupee)</option>
                      <option value="CAD">CAD ($ - Canadian Dollar)</option>
                      <option value="AUD">AUD ($ - Australian Dollar)</option>
                      <option value="JPY">JPY (¥ - Japanese Yen)</option>
                    </select>
                    <p className="text-[9px] font-bold text-slate-400 ml-1">Preferred currency used for your subscription plans billing.</p>
                  </div>
                </div>

                <div className="mt-auto pt-6 flex justify-end">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center justify-center gap-2 px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 min-w-[140px] cursor-pointer"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : 'Save Profile'}
                  </button>
                </div>
              </motion.form>
            )}

            {activeTab === 'extensions' && (
              <motion.div
                key="extensions-tab"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="space-y-8 flex-1 flex flex-col"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                      <Puzzle size={18} />
                    </span>
                    <h3 className="text-base font-bold text-slate-900">Official Browser Extensions</h3>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-200/60 rounded-full">
                      Manifest V3 Ready
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Download and load our high-speed automator extensions in Chrome to enable 1-click marketplace authentication, direct API listing creation, and automated closet sync.
                  </p>
                </div>

                {/* Extensions Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 1. Mercari Extension */}
                  <div className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-indigo-200 hover:shadow-md transition-all flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <img src="/mercari.png" alt="Mercari" className="w-10 h-10 object-contain rounded-xl p-1.5 bg-slate-50 border border-slate-100" />
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                              Mercari Fast Automator
                            </h4>
                            <p className="text-[11px] font-semibold text-indigo-600">v1.0.0 • Manifest V3</p>
                          </div>
                        </div>
                        {typeof document !== 'undefined' && (document.body.dataset.elisterMercariExtensionInstalled === 'true' || document.body.dataset.elisterExtensionInstalled === 'true') ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                            Download Ready
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed">
                        1-Click cookie & session authorization, direct Mercari API item publishing, live category taxonomy, and brand search engine.
                      </p>

                      <ul className="text-[11px] text-slate-500 space-y-1.5 font-medium">
                        <li className="flex items-center gap-2">
                          <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                          <span>1-Click session cookie capture (No manual paste)</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                          <span>Direct API listing creation & fast photo upload</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                          <span>Instant Mercari brand suggest lookup</span>
                        </li>
                      </ul>
                    </div>

                    <div className="pt-2">
                      <a
                        href="/extensions/mercari-extension.zip"
                        download="mercari-extension.zip"
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-all shadow-sm shadow-indigo-100"
                      >
                        <Download size={14} />
                        Download Mercari Extension (.ZIP)
                      </a>
                    </div>
                  </div>

                  {/* {/* 2. Depop Extension */}
                  {/* <div className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-indigo-200 hover:shadow-md transition-all flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <img src="/depop.png" alt="Depop" className="w-10 h-10 object-contain rounded-xl p-1.5 bg-slate-50 border border-slate-100" />
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                              Depop Fast Automator
                            </h4>
                            <p className="text-[11px] font-semibold text-indigo-600">v1.0.0 • Manifest V3</p>
                          </div>
                        </div>
                        {typeof document !== 'undefined' && document.body.dataset.elisterDepopExtensionInstalled === 'true' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                            Download Ready
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed">
                        Automated Bearer token & user ID capture from Depop, high-speed product catalog extraction, and direct photo upload to Depop CDN.
                      </p>

                      <ul className="text-[11px] text-slate-500 space-y-1.5 font-medium">
                        <li className="flex items-center gap-2">
                          <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                          <span>Automatic Bearer token & user ID capture</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                          <span>Direct API image upload & listing creator</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                          <span>1-Click complete product catalog sync</span>
                        </li>
                      </ul>
                    </div>

                    <div className="pt-2">
                      <a
                        href="/extensions/depop-extension.zip"
                        download="depop-extension.zip"
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-all shadow-sm shadow-indigo-100"
                      >
                        <Download size={14} />
                        Download Depop Extension (.ZIP)
                      </a>
                    </div>
                  </div> */}

                  {/* 3. Poshmark Extension */}
                  <div className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-indigo-200 hover:shadow-md transition-all flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <img src="/poshmark.png" alt="Poshmark" className="w-10 h-10 object-contain rounded-xl p-1.5 bg-slate-50 border border-slate-100" />
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                              Poshmark Fast Automator
                            </h4>
                            <p className="text-[11px] font-semibold text-indigo-600">v1.0.0 • Manifest V3</p>
                          </div>
                        </div>
                        {typeof document !== 'undefined' && document.body.dataset.elisterExtensionInstalled === 'true' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                            Download Ready
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed">
                        High-speed automated Poshmark tool for instant closet inventory imports, auto-sharing, multi-closet management, and direct API relisting.
                      </p>

                      <ul className="text-[11px] text-slate-500 space-y-1.5 font-medium">
                        <li className="flex items-center gap-2">
                          <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                          <span>1-Click session & CSRF token sync</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                          <span>Instant closet importer & fast relister</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                          <span>Supports US, CA, UK & AU Poshmark domains</span>
                        </li>
                      </ul>
                    </div>

                    <div className="pt-2">
                      <a
                        href="/extensions/poshmark-extension.zip"
                        download="poshmark-extension.zip"
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-all shadow-sm shadow-indigo-100"
                      >
                        <Download size={14} />
                        Download Poshmark Extension (.ZIP)
                      </a>
                    </div>
                  </div>

                  {/* 4. Vinted Extension */}
                  <div className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-indigo-200 hover:shadow-md transition-all flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <img src="/vinted.jpg" alt="Vinted" className="w-10 h-10 object-cover rounded-xl p-1 bg-slate-50 border border-slate-100" />
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                              Vinted Fast Automator
                            </h4>
                            <p className="text-[11px] font-semibold text-indigo-600">v1.0.0 • Manifest V3</p>
                          </div>
                        </div>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                          Download Ready
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed">
                        Connect and sync your Vinted closet across UK, France, Germany, Spain, Italy, and all supported European marketplaces.
                      </p>

                      <ul className="text-[11px] text-slate-500 space-y-1.5 font-medium">
                        <li className="flex items-center gap-2">
                          <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                          <span>Multi-domain European catalogue sync</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                          <span>Direct item sync & publishing pipeline</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                          <span>Automated session cookie capture</span>
                        </li>
                      </ul>
                    </div>

                    <div className="pt-2">
                      <a
                        href="/extensions/vinted-extension.zip"
                        download="vinted-extension.zip"
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-all shadow-sm shadow-indigo-100"
                      >
                        <Download size={14} />
                        Download Vinted Extension (.ZIP)
                      </a>
                    </div>
                  </div>
                </div>

                {/* Installation Guide */}
                <div className="p-6 bg-slate-50 border border-slate-200/80 rounded-3xl space-y-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                      <span className="p-2 bg-indigo-600 text-white rounded-xl shadow-sm shadow-indigo-200">
                        <HelpCircle size={18} />
                      </span>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">How to Install in Google Chrome (1-Minute Setup)</h4>
                        <p className="text-[11px] text-slate-500">Follow these 4 simple steps to load the unpacked extension in Chrome, Brave, or Edge.</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-1.5">
                      <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 text-xs font-black flex items-center justify-center">
                        1
                      </div>
                      <h5 className="text-xs font-bold text-slate-800">Download & Unzip</h5>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Download the <span className="font-semibold text-indigo-600">.ZIP</span> file above and extract / unzip it to a folder on your PC.
                      </p>
                    </div>

                    <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-1.5">
                      <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 text-xs font-black flex items-center justify-center">
                        2
                      </div>
                      <h5 className="text-xs font-bold text-slate-800">Open Extensions Page</h5>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        In Chrome, go to <code className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded font-bold text-slate-700">chrome://extensions</code>
                      </p>
                    </div>

                    <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-1.5">
                      <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 text-xs font-black flex items-center justify-center">
                        3
                      </div>
                      <h5 className="text-xs font-bold text-slate-800">Turn On Developer Mode</h5>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Toggle <span className="font-semibold text-slate-700">"Developer mode"</span> ON at the top-right corner of the Extensions page.
                      </p>
                    </div>

                    <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-1.5">
                      <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 text-xs font-black flex items-center justify-center">
                        4
                      </div>
                      <h5 className="text-xs font-bold text-slate-800">Click Load Unpacked</h5>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Click <span className="font-semibold text-slate-700">"Load unpacked"</span> (top-left) and select your unzipped folder. Done!
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl flex items-start sm:items-center justify-between gap-4 flex-col sm:flex-row">
                    <div className="flex items-center gap-2.5">
                      <Sparkles size={16} className="text-indigo-600 shrink-0" />
                      <p className="text-xs text-indigo-950 font-medium">
                        <span className="font-bold">Next Step:</span> After loading the extension, open your marketplace tab (e.g. Mercari or Depop) and login. Then go to <span className="font-bold">Channel Inventory / Accounts</span> to connect instantly!
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/ebay-accounts')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shrink-0 shadow-sm transition-all"
                    >
                      <span>Connect Accounts</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'password' && (
              <motion.form
                key="password-form"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                onSubmit={handlePasswordSubmit}
                className="space-y-6 flex-1 flex flex-col"
              >
                <div>
                  <h3 className="text-base font-bold text-slate-900 mb-1">Password & Security</h3>
                  <p className="text-xs text-slate-500">Change your account password. We recommend choosing a strong, unique password.</p>
                </div>

                <div className="space-y-1.5 max-w-md">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Current Password</label>
                  <input
                    type="password"
                    required
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-sm font-semibold outline-none focus:border-indigo-500 transition-all bg-white"
                    placeholder="••••••••"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">New Password</label>
                    <input
                      type="password"
                      required
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-sm font-semibold outline-none focus:border-indigo-500 transition-all bg-white"
                      placeholder="••••••••"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirm New Password</label>
                    <input
                      type="password"
                      required
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-sm font-semibold outline-none focus:border-indigo-500 transition-all bg-white"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div className="mt-auto pt-6 flex justify-end">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center justify-center gap-2 px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 min-w-[170px] cursor-pointer"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : 'Change Password'}
                  </button>
                </div>
              </motion.form>
            )}

            {activeTab === 'notifications' && (
              <motion.form
                key="notifications-form"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                onSubmit={handleNotificationsSubmit}
                className="space-y-6 flex-1 flex flex-col"
              >
                <div>
                  <h3 className="text-base font-bold text-slate-900 mb-1">Email Notifications</h3>
                  <p className="text-xs text-slate-500">Select which notifications you would like to receive in your inbox.</p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-100 hover:bg-slate-50 transition-colors">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">eBay Listing Alerts</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">Receive warnings when published items are close to expiration.</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setNotificationData({ ...notificationData, successAlerts: !notificationData.successAlerts })}
                      className="text-indigo-600 focus:outline-none"
                    >
                      {notificationData.successAlerts ? <ToggleRight size={38} className="text-indigo-600" /> : <ToggleLeft size={38} className="text-slate-300" />}
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-100 hover:bg-slate-50 transition-colors">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Usage Limit Warning Emails</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">Receive alert notifications when usage reaches 80% and 100% of limits.</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setNotificationData({ ...notificationData, quotaWarnings: !notificationData.quotaWarnings })}
                      className="text-indigo-600 focus:outline-none"
                    >
                      {notificationData.quotaWarnings ? <ToggleRight size={38} className="text-indigo-600" /> : <ToggleLeft size={38} className="text-slate-300" />}
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-100 hover:bg-slate-50 transition-colors">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Weekly Summary Reports</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">Get a weekly summary detailing total listings created, sales stats, and fetches used.</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setNotificationData({ ...notificationData, weeklyDigest: !notificationData.weeklyDigest })}
                      className="text-indigo-600 focus:outline-none"
                    >
                      {notificationData.weeklyDigest ? <ToggleRight size={38} className="text-indigo-600" /> : <ToggleLeft size={38} className="text-slate-300" />}
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-100 hover:bg-slate-50 transition-colors">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Product updates & news</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">Stay informed about new models, eBay policies integration, and features.</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setNotificationData({ ...notificationData, marketingEmails: !notificationData.marketingEmails })}
                      className="text-indigo-600 focus:outline-none"
                    >
                      {notificationData.marketingEmails ? <ToggleRight size={38} className="text-indigo-600" /> : <ToggleLeft size={38} className="text-slate-300" />}
                    </button>
                  </div>
                </div>

                <div className="mt-auto pt-6 flex justify-end">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center justify-center gap-2 px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 min-w-[140px] cursor-pointer"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : 'Save Settings'}
                  </button>
                </div>
              </motion.form>
            )}

            {activeTab === 'privacy' && (
              <motion.form
                key="privacy-form"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                onSubmit={handlePrivacySubmit}
                className="space-y-6 flex-1 flex flex-col"
              >
                <div>
                  <h3 className="text-base font-bold text-slate-900 mb-1">Privacy & Data Options</h3>
                  <p className="text-xs text-slate-500">Manage security settings, data retention, and account exporting options.</p>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Improve AI performance</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">Allow our background model pipeline to train on listing queries to optimize categorization.</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setPrivacyData({ ...privacyData, shareData: !privacyData.shareData })}
                      className="text-indigo-600 focus:outline-none"
                    >
                      {privacyData.shareData ? <ToggleRight size={38} className="text-indigo-600" /> : <ToggleLeft size={38} className="text-slate-300" />}
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Activity Log Retention</label>
                    <select 
                      value={privacyData.logRetention}
                      onChange={(e) => setPrivacyData({ ...privacyData, logRetention: e.target.value })}
                      className="w-full max-w-xs px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-semibold outline-none focus:border-indigo-500 transition-all"
                    >
                      <option value="7">7 Days</option>
                      <option value="30">30 Days</option>
                      <option value="90">90 Days</option>
                      <option value="365">1 Year</option>
                    </select>
                  </div>

                  <div className="p-6 bg-slate-50 border border-slate-100 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Export Listing & Account Data</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">Download a detailed archive containing your profile details, synced accounts, and draft listings in JSON format.</p>
                    </div>
                    <button 
                      type="button"
                      onClick={handleExportData}
                      className="flex items-center justify-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-650 hover:bg-slate-50 font-bold rounded-2xl text-xs transition-all shadow-sm shrink-0 cursor-pointer"
                    >
                      <Download size={14} />
                      Export Data
                    </button>
                  </div>
                </div>

                <div className="mt-auto pt-8 border-t border-slate-100">
                  <h4 className="text-xs font-bold text-rose-600 uppercase mb-3 px-1">Danger Zone</h4>
                  <div className="bg-rose-50 border border-rose-100 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h4 className="text-xs font-bold text-rose-900">Delete Account</h4>
                      <p className="text-[10px] text-rose-700/70">Permanently delete your user profile and remove all stored draft logs and listings. This is irreversible.</p>
                    </div>
                    <button 
                      type="button"
                      className="flex items-center justify-center gap-1.5 px-6 py-3 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 transition-all shadow-md shadow-rose-100 text-xs shrink-0 cursor-pointer"
                    >
                      <Trash2 size={12} />
                      Delete Account
                    </button>
                  </div>
                </div>
              </motion.form>
            )}

            {activeTab === 'defaults' && (
              <motion.form
                key="defaults-form"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                onSubmit={handleDefaultsSubmit}
                className="space-y-6 flex-1 flex flex-col"
              >
                <div>
                  <h3 className="text-base font-bold text-slate-900 mb-1">Listing Defaults</h3>
                  <p className="text-xs text-slate-500">Configure global prefilled options for quick draft saving on eBay & Poshmark.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Default Condition</label>
                    <select
                      value={listingDefaults.defaultCondition}
                      onChange={(e) => setListingDefaults({ ...listingDefaults, defaultCondition: e.target.value })}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-semibold outline-none focus:border-indigo-500 transition-all"
                    >
                      <option value="New">New with tags</option>
                      <option value="Like New">Like New</option>
                      <option value="Pre-owned">Pre-owned</option>
                      <option value="Fair">Fair / Acceptable</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Default Quantity</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={listingDefaults.defaultQuantity}
                      onChange={(e) => setListingDefaults({ ...listingDefaults, defaultQuantity: parseInt(e.target.value) || 1 })}
                      className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-sm font-semibold outline-none focus:border-indigo-500 transition-all bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">eBay Dispatch Time (Days)</label>
                    <select
                      value={listingDefaults.dispatchTime}
                      onChange={(e) => setListingDefaults({ ...listingDefaults, dispatchTime: e.target.value })}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-semibold outline-none focus:border-indigo-500 transition-all"
                    >
                      <option value="1">1 Day</option>
                      <option value="2">2 Days</option>
                      <option value="3">3 Days (Default)</option>
                      <option value="5">5 Days</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Default Shipping Policy Type</label>
                    <select
                      value={listingDefaults.shippingType}
                      onChange={(e) => setListingDefaults({ ...listingDefaults, shippingType: e.target.value })}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-semibold outline-none focus:border-indigo-500 transition-all"
                    >
                      <option value="Calculated">Calculated Weight & Size</option>
                      <option value="Flat">Flat Rate Shipping</option>
                      <option value="Free">Free Shipping</option>
                    </select>
                  </div>
                </div>

                <div className="mt-auto pt-6 flex justify-end">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center justify-center gap-2 px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 min-w-[140px] cursor-pointer"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : 'Save Defaults'}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Settings;
