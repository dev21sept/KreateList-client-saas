import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Link as LinkIcon, 
  Unlink, 
  RefreshCw, 
  ExternalLink, 
  CheckCircle2, 
  XCircle,
  AlertTriangle,
  Mail,
  Phone,
  User,
  ShieldCheck,
  Zap,
  Loader2,
  Globe,
  BarChart3,
  Activity,
  Server,
  Lock,
  ChevronRight,
  Settings
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ebayService } from '../services/api';

const EbayAccounts = () => {
  const { user, loadUser } = useAuth();
  const ebay = user?.ebayAccount;
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const called = useRef(false);

  useEffect(() => {
    const error = searchParams.get('error');
    const success = searchParams.get('success');
    const code = searchParams.get('code');
    
    if (code && !called.current) {
      called.current = true;
      handleCallback(code);
    } else if (error && !called.current) {
      called.current = true;
      alert(`eBay Connection Error: ${error}`);
      navigate('/ebay-accounts', { replace: true });
    } else if (success && !called.current) {
      called.current = true;
      loadUser();
      navigate('/ebay-accounts', { replace: true });
    }
  }, [searchParams, navigate, loadUser]);

  const handleCallback = async (code) => {
    try {
      setLoading(true);
      setStatusMsg('Connecting your eBay account...');
      console.log('Sending eBay code to backend for token exchange...');
      
      const response = await ebayService.callback(code);
      console.log('eBay Callback Success:', response.data);
      
      await loadUser();
      alert('eBay Account Connected Successfully!');
      
      // Clean up the URL
      navigate('/ebay-accounts', { replace: true });
    } catch (error) {
      console.error('================ EBAY CALLBACK ERROR ================');
      console.error('Error Object:', error);
      if (error.response) {
        console.error('Error Status:', error.response.status);
        console.error('Error Response Data:', JSON.stringify(error.response.data, null, 2));
      } else if (error.request) {
        console.error('No Response Received. Request:', error.request);
      } else {
        console.error('Error Message:', error.message);
      }
      console.error('=====================================================');
      alert('eBay Connection Failed! Check the console for detailed error logs.');
    } finally {
      setLoading(false);
      setStatusMsg('');
    }
  };

  const handleConnect = async () => {
    try {
      setLoading(true);
      console.log('Fetching eBay Auth URL from backend...');
      const response = await ebayService.connect();
      console.log('Auth URL Response:', response.data);
      if (response.data.url) {
        console.log('Redirecting to:', response.data.url);
        window.location.href = response.data.url;
      } else {
        alert('Error: Backend did not return a valid URL.');
      }
    } catch (error) {
      console.error('Error connecting eBay (Fetching Auth URL):', error);
      alert('Failed to connect to backend to get eBay URL! Check console for details. Error: ' + error.message);
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (window.confirm('Are you sure you want to disconnect your eBay account?')) {
      try {
        setLoading(true);
        await ebayService.disconnect();
        await loadUser();
      } catch (error) {
        console.error('Error disconnecting eBay:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto py-2">
      {/* Page Header - Compact */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/30 rounded-full -mr-32 -mt-32 blur-2xl transition-all duration-700" />
        
        <div className="relative">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Integrations</h1>
            <div className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[8px] font-black uppercase tracking-widest border border-emerald-200">
              Production Live
            </div>
          </div>
          <p className="text-slate-500 font-medium text-sm">Enterprise-grade multi-channel connectivity and real-time sync.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Profile & Main Stats Card */}
        <div className="lg:col-span-8 space-y-6">
          {ebay?.connected ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative overflow-hidden"
            >
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-50/40 rounded-full -ml-32 -mb-32 blur-3xl pointer-events-none" />

              <div className="relative flex flex-col md:flex-row gap-8">
                <div className="w-24 h-24 bg-slate-900 rounded-3xl flex items-center justify-center shrink-0 shadow-xl shadow-slate-100 border-4 border-white overflow-hidden">
                  {ebay.username ? (
                    <div className="text-white text-3xl font-black">{ebay.username.charAt(0).toUpperCase()}</div>
                  ) : (
                    <User size={40} className="text-white" />
                  )}
                </div>
                
                <div className="flex-1 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-3xl font-black text-slate-900 tracking-tight">{ebay.username}</h2>
                      <div className="flex items-center gap-2 mt-1">
                        <Globe size={12} className="text-slate-400" />
                        <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">{ebay.name || 'Merchant Account'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-xl border border-emerald-100">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                      <span className="text-[10px] font-black text-emerald-700 uppercase">Sync Healthy</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 p-4 bg-slate-50/80 rounded-2xl border border-slate-100">
                      <Mail size={18} className="text-slate-400" />
                      <div>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Business Email</p>
                        <p className="text-xs font-bold text-slate-900">{ebay.email || 'Not available'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-slate-50/80 rounded-2xl border border-slate-100">
                      <Phone size={18} className="text-slate-400" />
                      <div>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Support Line</p>
                        <p className="text-xs font-bold text-slate-900">{ebay.phone || 'Private'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Advanced Stats Grid */}
              <div className="grid grid-cols-3 gap-4 mt-8 pt-8 border-t border-slate-100">
                <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 text-center">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Health</p>
                  <p className="text-lg font-black text-emerald-600">100%</p>
                </div>
                <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 text-center">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Capacity</p>
                  <p className="text-lg font-black text-slate-900">MAX</p>
                </div>
                <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 text-center">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">API Status</p>
                  <p className="text-lg font-black text-indigo-600">LIVE</p>
                </div>
              </div>

              <div className="flex justify-between items-center mt-8">
                <button className="flex items-center gap-2 text-xs font-black text-slate-900 hover:text-indigo-600 transition-all">
                  <RefreshCw size={14} /> Resync Metadata
                </button>
                <button 
                  onClick={handleDisconnect}
                  disabled={loading}
                  className="text-rose-500 hover:text-rose-600 font-bold text-xs"
                >
                  Disconnect Account
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="bg-white p-12 rounded-[2.5rem] border border-dashed border-slate-200 text-center space-y-6 shadow-sm">
              <div className="w-24 h-24 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto border border-slate-100">
                <LinkIcon size={40} className="text-slate-300" />
              </div>
              <div className="max-w-sm mx-auto space-y-2">
                <h3 className="text-2xl font-black text-slate-900">Connect eBay Production</h3>
                <p className="text-slate-500 font-medium text-xs">Unlock automated listing generation and real-time merchant sync.</p>
              </div>
              <button 
                onClick={handleConnect}
                disabled={loading}
                className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center gap-2 mx-auto disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <>Connect eBay <ChevronRight size={18} /></>}
              </button>
              {statusMsg && (
                <p className="text-indigo-600 font-bold text-sm animate-pulse mt-4">{statusMsg}</p>
              )}
            </div>
          )}

          {/* Business Tools - More Compact */}
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-3">
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
                <BarChart3 size={20} />
              </div>
              <h4 className="text-xs font-black text-slate-900 uppercase">Insights</h4>
              <p className="text-slate-500 text-[10px] font-medium leading-relaxed line-clamp-2">AI-powered suggestions for pricing and listing optimizations.</p>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-3">
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                <Activity size={20} />
              </div>
              <h4 className="text-xs font-black text-slate-900 uppercase">Inventory</h4>
              <p className="text-slate-500 text-[10px] font-medium leading-relaxed line-clamp-2">Real-time monitoring and out-of-stock protection.</p>
            </div>
          </div>
        </div>

        {/* Sidebar Info Column - Compact */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white space-y-6 relative overflow-hidden">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-indigo-400 border border-white/10">
              <ShieldCheck size={24} />
            </div>
            <div className="space-y-2">
              <h4 className="text-lg font-black tracking-tight">Secure Protocol</h4>
              <p className="text-slate-400 text-[10px] leading-relaxed font-medium">
                Official <span className="text-white font-black">OAuth 2.0 Auth Code Grant</span>. Secure and encrypted.
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-[10px] font-bold text-slate-300">
                <Lock size={14} className="text-emerald-400" /> AES-256 Encryption
              </div>
              <div className="flex items-center gap-3 text-[10px] font-bold text-slate-300">
                <Lock size={14} className="text-emerald-400" /> SOC2 Compliant
              </div>
            </div>
          </div>

          <div className="p-8 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <h5 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Config</h5>
              <Settings size={14} className="text-slate-400" />
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-900">Production</span>
                <div className="w-8 h-4 bg-emerald-500 rounded-full relative">
                  <div className="absolute right-0.5 top-0.5 w-3 h-3 bg-white rounded-full shadow-sm" />
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-100 opacity-50">
                <span className="text-[10px] font-bold text-slate-400">Inventory Sync</span>
                <span className="text-[8px] font-black bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded">PRO</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EbayAccounts;


