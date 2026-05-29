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
  Loader2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/api';

const Settings = () => {
  const { user, loadUser } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  
  // Profile Form State
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: ''
  });

  // Password Form State
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
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
        email: user.email || ''
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
        phone: profileData.phone
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

  const menuItems = [
    { id: 'profile', name: 'Profile Information', icon: <User size={18} /> },
    { id: 'password', name: 'Password & Security', icon: <Lock size={18} /> },
    { id: 'notifications', name: 'Notifications', icon: <Bell size={18} />, disabled: true },
    { id: 'defaults', name: 'Listing Defaults', icon: <Database size={18} />, disabled: true },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8 px-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500">Manage your account preferences, profile details, and security.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Navigation Sidebar */}
        <div className="md:col-span-4 bg-white rounded-3xl border border-slate-100 p-4 shadow-sm space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              disabled={item.disabled}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between p-4 rounded-2xl text-left transition-all ${
                item.disabled 
                  ? 'opacity-40 cursor-not-allowed text-slate-400'
                  : activeTab === item.id
                    ? 'bg-indigo-650 text-white font-bold shadow-md shadow-indigo-100'
                    : 'text-slate-650 hover:bg-slate-50 font-semibold'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={activeTab === item.id ? 'text-white' : 'text-slate-450'}>
                  {item.icon}
                </span>
                <span className="text-sm">{item.name}</span>
              </div>
              {!item.disabled && (
                <ChevronRight size={16} className={activeTab === item.id ? 'text-white' : 'text-slate-355'} />
              )}
            </button>
          ))}
        </div>

        {/* Form Panel */}
        <div className="md:col-span-8 bg-white rounded-3xl border border-slate-100 p-8 shadow-sm min-h-[400px] flex flex-col">
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
                      className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-sm font-semibold outline-none focus:border-indigo-500 transition-all"
                      placeholder="John"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Last Name</label>
                    <input
                      type="text"
                      required
                      value={profileData.lastName}
                      onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-sm font-semibold outline-none focus:border-indigo-500 transition-all"
                      placeholder="Doe"
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
                      className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-sm font-semibold outline-none focus:border-indigo-500 transition-all"
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                </div>

                <div className="mt-auto pt-6 flex justify-end">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center justify-center gap-2 px-8 py-3 bg-indigo-650 hover:bg-indigo-700 text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 min-w-[140px]"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : 'Save Profile'}
                  </button>
                </div>
              </motion.form>
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
                    className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-sm font-semibold outline-none focus:border-indigo-500 transition-all"
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
                      className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-sm font-semibold outline-none focus:border-indigo-500 transition-all"
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
                      className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-sm font-semibold outline-none focus:border-indigo-500 transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div className="mt-auto pt-6 flex justify-end">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center justify-center gap-2 px-8 py-3 bg-indigo-650 hover:bg-indigo-700 text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 min-w-[170px]"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : 'Change Password'}
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
