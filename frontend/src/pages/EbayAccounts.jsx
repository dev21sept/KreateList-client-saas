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
import { ebayService, externalImportService } from '../services/api';
import { useNotification } from '../context/NotificationContext';

const EbayAccounts = () => {
  const { user, loadUser } = useAuth();
  const { toast, confirm } = useNotification();
  const ebay = user?.ebayAccount;
  const poshmark = user?.poshmarkAccount;
  const depop = user?.depopAccount;
  
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  
  // Poshmark Form state
  const [poshUsername, setPoshUsername] = useState('');
  const [poshCookie, setPoshCookie] = useState('');
  const [poshCsrf, setPoshCsrf] = useState('');
  const [poshLoading, setPoshLoading] = useState(false);
  const [poshPassword, setPoshPassword] = useState('');
  const [poshDomain, setPoshDomain] = useState('poshmark.com');
  const [poshConnectMethod, setPoshConnectMethod] = useState('password'); // 'password', 'extension', 'manual'

  // Depop Form state
  const [depopUsername, setDepopUsername] = useState('');
  const [depopToken, setDepopToken] = useState('');
  const [depopLoading, setDepopLoading] = useState(false);

  // Sync state
  const [syncingPlatform, setSyncingPlatform] = useState(null);

  const handleSyncCloset = async (platform, username) => {
    try {
      setSyncingPlatform(platform);
      toast.success(`Starting sync for your ${platform} closet...`);
      const res = await externalImportService.importCloset({ platform, username });
      if (res.data?.success) {
        toast.success(`Successfully imported ${res.data.data.importedCount} new products from ${platform}!`);
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || `Failed to sync ${platform} closet.`);
    } finally {
      setSyncingPlatform(null);
    }
  };

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const called = useRef(false);

  // Window event listener to receive captured tokens/cookies from the Chrome Extension
  useEffect(() => {
    const handleExtensionResponse = async (event) => {
      const isAllowedOrigin = event.origin.includes('elister.ai') || event.origin.includes('localhost') || event.origin.includes('127.0.0.1');
      if (!isAllowedOrigin) return;

      if (event.data && event.data.action === 'ELISTER_CONNECTION_DETAILS_RESPONSE') {
        const { platform, success, data, error } = event.data;
        console.log(`[Integrations] Received extension details for ${platform}:`, { success, error });

        if (success && data) {
          toast.success(`Successfully captured ${platform} credentials from Extension! Connecting...`);
          try {
            if (platform === 'poshmark') {
              setPoshLoading(true);
              const res = await externalImportService.connect({
                platform: 'poshmark',
                username: data.username,
                sessionCookie: data.sessionCookie,
                csrfToken: data.csrfToken
              });
              if (res.data?.success) {
                toast.success('Poshmark Connected Successfully via Extension!');
                await loadUser();
              }
            } else if (platform === 'depop') {
              setDepopLoading(true);
              const res = await externalImportService.connect({
                platform: 'depop',
                username: data.username,
                accessToken: data.accessToken
              });
              if (res.data?.success) {
                toast.success('Depop Connected Successfully via Extension!');
                await loadUser();
              }
            }
          } catch (err) {
            toast.error(err.response?.data?.message || `Failed to connect ${platform} automatically.`);
          } finally {
            setPoshLoading(false);
            setDepopLoading(false);
          }
        } else {
          // Credentials not cached in extension
          toast.warning(`${platform} session details not cached. Opening login tab...`);
          if (platform === 'poshmark') {
            window.open('https://poshmark.com/login', '_blank');
          } else if (platform === 'depop') {
            window.open('https://www.depop.com/login/', '_blank');
          }
        }
      }
    };

    window.addEventListener('message', handleExtensionResponse);
    return () => window.removeEventListener('message', handleExtensionResponse);
  }, [loadUser, toast]);

  useEffect(() => {
    const error = searchParams.get('error');
    const success = searchParams.get('success');
    const code = searchParams.get('code');
    
    if (code && !called.current) {
      called.current = true;
      handleCallback(code);
    } else if (error && !called.current) {
      called.current = true;
      toast.error(`eBay Connection Error: ${error}`);
      navigate('/ebay-accounts', { replace: true });
    } else if (success && !called.current) {
      called.current = true;
      if (success === 'poshmark') {
        toast.success('Poshmark Account Connected Successfully!');
      } else if (success === 'depop') {
        toast.success('Depop Account Connected Successfully!');
      } else {
        toast.success('Account Connected Successfully!');
      }
      loadUser();
      navigate('/ebay-accounts', { replace: true });
    }
  }, [searchParams, navigate, loadUser, toast]);

  const handleCallback = async (code) => {
    try {
      setLoading(true);
      setStatusMsg('Connecting your eBay account...');
      console.log('Sending eBay code to backend for token exchange...');
      
      const response = await ebayService.callback(code);
      console.log('eBay Callback Success:', response.data);
      
      await loadUser();
      toast.success('eBay Account Connected Successfully!');
      navigate('/ebay-accounts', { replace: true });
    } catch (error) {
      console.error('================ EBAY CALLBACK ERROR ================');
      toast.error('eBay Connection Failed!');
    } finally {
      setLoading(false);
      setStatusMsg('');
    }
  };

  const handleConnect = async () => {
    try {
      setLoading(true);
      const response = await ebayService.connect();
      if (response.data.url) {
        window.location.href = response.data.url;
      } else {
        toast.error('Error: Backend did not return a valid URL.');
      }
    } catch (error) {
      console.error('Error connecting eBay:', error);
      toast.error('Failed to connect to backend to get eBay URL!');
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (await confirm('Are you sure you want to disconnect your eBay account?', { title: 'Disconnect eBay Account', destructive: true })) {
      try {
        setLoading(true);
        await ebayService.disconnect();
        await loadUser();
        toast.success('eBay account disconnected successfully.');
      } catch (error) {
        console.error('Error disconnecting eBay:', error);
        toast.error('Failed to disconnect eBay account.');
      } finally {
        setLoading(false);
      }
    }
  };

  // Trigger Automatic Connection via Extension
  const triggerAutoConnect = (platform) => {
    const isExtensionInstalled = document.body.dataset.elisterExtensionInstalled === "true" ||
                                 document.body.dataset.elisterDepopExtensionInstalled === "true";
    if (!isExtensionInstalled) {
      toast.warning('Please install and enable the eLister Chrome Extension to connect automatically!');
      return;
    }
    const backendUrl = import.meta.env.MODE === 'production'
      ? (import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : 'https://api.elister.ai/api')
      : 'http://localhost:5000/api';
    const token = localStorage.getItem('token');
    const frontendUrl = window.location.origin;

    console.log(`[Integrations] Starting redirect connection flow for: ${platform}`);
    window.postMessage({
      action: 'ELISTER_START_CONNECT_FLOW',
      platform,
      backendUrl,
      token,
      frontendUrl
    }, '*');
  };

  // Poshmark Connect/Disconnect
  const handlePoshmarkConnect = async (e) => {
    e.preventDefault();
    if (!poshUsername || !poshCookie || !poshCsrf) {
      toast.warning('Please fill in all Poshmark fields.');
      return;
    }
    try {
      setPoshLoading(true);
      const res = await externalImportService.connect({
        platform: 'poshmark',
        username: poshUsername,
        sessionCookie: poshCookie,
        csrfToken: poshCsrf
      });
      if (res.data?.success) {
        toast.success('Poshmark Connected Successfully!');
        await loadUser();
        setPoshUsername('');
        setPoshCookie('');
        setPoshCsrf('');
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to connect Poshmark.');
    } finally {
      setPoshLoading(false);
    }
  };

  const handlePoshmarkPasswordConnect = async (e) => {
    e.preventDefault();
    if (!poshUsername || !poshPassword) {
      toast.warning('Please enter your Poshmark username/email and password.');
      return;
    }
    try {
      setPoshLoading(true);
      toast.info('Connecting to Poshmark via Cloud Login...');
      const res = await externalImportService.connectPassword({
        platform: 'poshmark',
        username: poshUsername,
        password: poshPassword,
        domain: poshDomain
      });
      if (res.data?.success) {
        toast.success('Poshmark Connected Successfully via Cloud Login!');
        await loadUser();
        setPoshUsername('');
        setPoshPassword('');
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to connect Poshmark. Please verify credentials or use Chrome Extension.');
    } finally {
      setPoshLoading(false);
    }
  };

  const handlePoshmarkDisconnect = async () => {
    if (await confirm('Disconnect Poshmark Account?', { title: 'Disconnect Poshmark', destructive: true })) {
      try {
        setPoshLoading(true);
        const res = await externalImportService.connect({
          platform: 'poshmark',
          disconnect: true
        });
        if (res.data?.success) {
          toast.success('Poshmark disconnected successfully.');
          await loadUser();
        }
      } catch (err) {
        toast.error('Failed to disconnect Poshmark.');
      } finally {
        setPoshLoading(false);
      }
    }
  };

  // Depop Connect/Disconnect
  const handleDepopConnect = async (e) => {
    e.preventDefault();
    if (!depopUsername || !depopToken) {
      toast.warning('Please fill in all Depop fields.');
      return;
    }
    try {
      setDepopLoading(true);
      const res = await externalImportService.connect({
        platform: 'depop',
        username: depopUsername,
        accessToken: depopToken
      });
      if (res.data?.success) {
        toast.success('Depop Connected Successfully!');
        await loadUser();
        setDepopUsername('');
        setDepopToken('');
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to connect Depop.');
    } finally {
      setDepopLoading(false);
    }
  };

  const handleDepopDisconnect = async () => {
    if (await confirm('Disconnect Depop Account?', { title: 'Disconnect Depop', destructive: true })) {
      try {
        setDepopLoading(true);
        const res = await externalImportService.connect({
          platform: 'depop',
          disconnect: true
        });
        if (res.data?.success) {
          toast.success('Depop disconnected successfully.');
          await loadUser();
        }
      } catch (err) {
        toast.error('Failed to disconnect Depop.');
      } finally {
        setDepopLoading(false);
      }
    }
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto py-2">
      {/* Page Header */}
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
        {/* Main Integrations Column */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* 1. eBay Integration Card */}
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">eBay Channel</h3>
            {ebay?.connected ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative overflow-hidden"
              >
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center shrink-0 shadow-lg border-2 border-white">
                    <span className="text-white text-xl font-black">{ebay.username?.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">{ebay.username}</h2>
                        <p className="text-slate-400 font-bold text-[9px] uppercase tracking-widest">{ebay.name || 'Merchant Account'}</p>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 rounded-lg border border-emerald-100">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-[9px] font-black text-emerald-700 uppercase">Sync Active</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-[10px] text-slate-400">Connected at {ebay.connectedAt ? new Date(ebay.connectedAt).toLocaleDateString() : 'Active'}</span>
                      <button 
                        onClick={handleDisconnect}
                        disabled={loading}
                        className="text-rose-500 hover:text-rose-600 font-bold text-xs"
                      >
                        Disconnect eBay
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto border border-slate-100">
                  <LinkIcon size={24} className="text-slate-300" />
                </div>
                <div>
                  <h4 className="text-md font-bold text-slate-900">Connect eBay Channel</h4>
                  <p className="text-slate-500 text-xs">Authorize eLister to publish directly and manage your eBay stock.</p>
                </div>
                <button 
                  onClick={handleConnect}
                  disabled={loading}
                  className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-black text-xs hover:bg-indigo-700 transition-all flex items-center gap-2 mx-auto disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin" size={14} /> : <>Connect eBay <ChevronRight size={14} /></>}
                </button>
                {statusMsg && <p className="text-indigo-600 font-bold text-xs animate-pulse">{statusMsg}</p>}
              </div>
            )}
          </div>

          {/* 2. Poshmark Integration Card */}
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Poshmark Channel</h3>
            {poshmark?.connected ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative overflow-hidden"
              >
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="w-16 h-16 bg-rose-500 rounded-2xl flex items-center justify-center shrink-0 shadow-lg border-2 border-white">
                    <span className="text-white text-xl font-black">{poshmark.username?.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">{poshmark.username}</h2>
                        <p className="text-slate-400 font-bold text-[9px] uppercase tracking-widest">Poshmark Closet</p>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 rounded-lg border border-emerald-100">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-[9px] font-black text-emerald-700 uppercase">Sync Active</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-[10px] text-slate-400">Connected at {poshmark.connectedAt ? new Date(poshmark.connectedAt).toLocaleDateString() : 'Active'}</span>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-2">
                      <button
                        onClick={() => handleSyncCloset('poshmark', poshmark.username)}
                        disabled={syncingPlatform === 'poshmark'}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {syncingPlatform === 'poshmark' ? <Loader2 className="animate-spin" size={12} /> : <RefreshCw size={12} />}
                        Sync Poshmark Closet
                      </button>
                      <button 
                        onClick={handlePoshmarkDisconnect}
                        disabled={poshLoading}
                        className="text-rose-500 hover:text-rose-600 font-bold text-xs"
                      >
                        Disconnect Poshmark
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="space-y-4">
                {/* Method selector tabs */}
                <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1.5 max-w-md mx-auto">
                  <button
                    onClick={() => setPoshConnectMethod('password')}
                    className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${
                      poshConnectMethod === 'password' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Cloud Login
                  </button>
                  <button
                    onClick={() => setPoshConnectMethod('extension')}
                    className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${
                      poshConnectMethod === 'extension' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Chrome Extension
                  </button>
                  <button
                    onClick={() => setPoshConnectMethod('manual')}
                    className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${
                      poshConnectMethod === 'manual' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Manual Mode
                  </button>
                </div>

                {poshConnectMethod === 'password' && (
                  <form onSubmit={handlePoshmarkPasswordConnect} className="space-y-3 max-w-md mx-auto">
                    <div className="text-center py-1">
                      <h4 className="text-sm font-bold text-slate-800">Cloud Password Login</h4>
                      <p className="text-slate-500 text-[11px] mt-0.5">Logs in to Poshmark directly using your credentials.</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Poshmark Region</label>
                      <select
                        value={poshDomain}
                        onChange={(e) => setPoshDomain(e.target.value)}
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-100 rounded-xl text-xs outline-none focus:border-indigo-500 font-bold text-slate-700"
                      >
                        <option value="poshmark.com">United States (poshmark.com)</option>
                        <option value="poshmark.ca">Canada (poshmark.ca)</option>
                        <option value="poshmark.co.uk">United Kingdom (poshmark.co.uk)</option>
                        <option value="poshmark.com.au">Australia (poshmark.com.au)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Username or Email</label>
                      <input 
                        type="text" 
                        placeholder="e.g. posh_seller or email@example.com" 
                        value={poshUsername}
                        onChange={(e) => setPoshUsername(e.target.value)}
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-100 rounded-xl text-xs outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Password</label>
                      <input 
                        type="password" 
                        placeholder="Your Poshmark password" 
                        value={poshPassword}
                        onChange={(e) => setPoshPassword(e.target.value)}
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-100 rounded-xl text-xs outline-none focus:border-indigo-500"
                      />
                    </div>
                    <button 
                      type="submit"
                      disabled={poshLoading}
                      className="w-full py-2.5 mt-2 bg-indigo-600 text-white rounded-xl font-black text-xs hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {poshLoading ? <Loader2 className="animate-spin" size={14} /> : 'Connect Poshmark'}
                    </button>
                  </form>
                )}

                {poshConnectMethod === 'extension' && (
                  <div className="text-center py-4 flex flex-col items-center gap-2 max-w-md mx-auto">
                    <h4 className="text-sm font-bold text-slate-800">1-Click Chrome Extension</h4>
                    <p className="text-slate-500 text-xs">Grabs your active browser session automatically. Solves CAPTCHA issues instantly.</p>
                    
                    <button 
                      onClick={() => triggerAutoConnect('poshmark')}
                      disabled={poshLoading}
                      className="mt-2 px-8 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-md disabled:opacity-50"
                    >
                      {poshLoading ? <Loader2 className="animate-spin" size={14} /> : <>Connect Automatically <Zap size={14} className="text-yellow-400 fill-yellow-400" /></>}
                    </button>
                  </div>
                )}

                {poshConnectMethod === 'manual' && (
                  <form onSubmit={handlePoshmarkConnect} className="space-y-3 max-w-md mx-auto">
                    <div className="text-center py-1">
                      <h4 className="text-sm font-bold text-slate-800">Manual Cookie Setup</h4>
                      <p className="text-slate-500 text-[11px] mt-0.5">Directly input captured cookies and tokens from Developer Tools.</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Poshmark Username</label>
                      <input 
                        type="text" 
                        placeholder="e.g. posh_seller" 
                        value={poshUsername}
                        onChange={(e) => setPoshUsername(e.target.value)}
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-100 rounded-xl text-xs outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Session Cookie (_poshmark_session)</label>
                      <input 
                        type="text" 
                        placeholder="Paste complete _poshmark_session cookie value" 
                        value={poshCookie}
                        onChange={(e) => setPoshCookie(e.target.value)}
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-100 rounded-xl text-xs outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">CSRF Token (x-xsrf-token / x-csrf-token)</label>
                      <input 
                        type="text" 
                        placeholder="Paste csrf token value" 
                        value={poshCsrf}
                        onChange={(e) => setPoshCsrf(e.target.value)}
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-100 rounded-xl text-xs outline-none focus:border-indigo-500"
                      />
                    </div>
                    <button 
                      type="submit"
                      disabled={poshLoading}
                      className="w-full py-2.5 bg-rose-500 text-white rounded-xl font-black text-xs hover:bg-rose-600 transition-all flex items-center justify-center gap-2"
                    >
                      {poshLoading ? <Loader2 className="animate-spin" size={14} /> : 'Connect Poshmark Manually'}
                    </button>
                  </form>
                )}
              </div>
            )}

          </div>

          {/* 3. Depop Integration Card */}
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Depop Channel</h3>
            {depop?.connected ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative overflow-hidden"
              >
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="w-16 h-16 bg-red-650 rounded-2xl flex items-center justify-center shrink-0 shadow-lg border-2 border-white">
                    <span className="text-white text-xl font-black">{depop.username?.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">{depop.username}</h2>
                        <p className="text-slate-400 font-bold text-[9px] uppercase tracking-widest">Depop Closet</p>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 rounded-lg border border-emerald-100">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-[9px] font-black text-emerald-700 uppercase">Sync Active</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-[10px] text-slate-400">Connected at {depop.connectedAt ? new Date(depop.connectedAt).toLocaleDateString() : 'Active'}</span>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-2">
                      <button
                        onClick={() => handleSyncCloset('depop', depop.username)}
                        disabled={syncingPlatform === 'depop'}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {syncingPlatform === 'depop' ? <Loader2 className="animate-spin" size={12} /> : <RefreshCw size={12} />}
                        Sync Depop Shop
                      </button>
                      <button 
                        onClick={handleDepopDisconnect}
                        disabled={depopLoading}
                        className="text-rose-500 hover:text-rose-600 font-bold text-xs"
                      >
                        Disconnect Depop
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="space-y-4">
                <div className="text-center py-2 flex flex-col items-center gap-2">
                  <h4 className="text-md font-bold text-slate-900">Connect Depop Channel</h4>
                  <p className="text-slate-500 text-xs">Sync Depop instantly with 1-click using the Chrome Extension.</p>
                  
                  {/* One-Click Automatic Connect Button */}
                  <button 
                    onClick={() => triggerAutoConnect('depop')}
                    disabled={depopLoading}
                    className="mt-2 px-8 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-md disabled:opacity-50"
                  >
                    {depopLoading ? <Loader2 className="animate-spin" size={14} /> : <>Connect Automatically (Recommended) <Zap size={14} className="text-yellow-400 fill-yellow-400" /></>}
                  </button>
                </div>
                
                <div className="relative my-4 flex items-center justify-center">
                  <div className="border-t border-slate-100 w-full absolute" />
                  <span className="bg-white px-3 text-[10px] font-bold text-slate-400 relative">OR CONNECT MANUALLY</span>
                </div>

                <form onSubmit={handleDepopConnect} className="space-y-3 max-w-md mx-auto">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Depop Username</label>
                    <input 
                      type="text" 
                      placeholder="e.g. depop_seller" 
                      value={depopUsername}
                      onChange={(e) => setDepopUsername(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Access Token (Bearer token)</label>
                    <input 
                      type="text" 
                      placeholder="Paste complete authorization Bearer token" 
                      value={depopToken}
                      onChange={(e) => setDepopToken(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs outline-none focus:border-indigo-500"
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={depopLoading}
                    className="w-full py-2.5 bg-red-650 text-white rounded-xl font-black text-xs hover:bg-red-750 transition-all flex items-center justify-center gap-2"
                  >
                    {depopLoading ? <Loader2 className="animate-spin" size={14} /> : 'Connect Depop Manually'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Info Column */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white space-y-6 relative overflow-hidden">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-indigo-400 border border-white/10">
              <ShieldCheck size={24} />
            </div>
            <div className="space-y-2">
              <h4 className="text-lg font-black tracking-tight">Secure Connection</h4>
              <p className="text-slate-400 text-[10px] leading-relaxed font-medium">
                Authorization tokens and cookies are encrypted using AES-256 standard and used solely to route direct api queries.
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-[10px] font-bold text-slate-300">
                <Lock size={14} className="text-emerald-400" /> Secure Storage
              </div>
              <div className="flex items-center gap-3 text-[10px] font-bold text-slate-300">
                <Lock size={14} className="text-emerald-400" /> Direct API listing
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EbayAccounts;
