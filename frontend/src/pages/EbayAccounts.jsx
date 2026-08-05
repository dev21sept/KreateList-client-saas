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
  Settings,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ebayService, externalImportService, etsyService } from '../services/api';
import { useNotification } from '../context/NotificationContext';

const EbayAccounts = () => {
  const { user, loadUser } = useAuth();
  const { toast, confirm } = useNotification();
  const ebay = user?.ebayAccount;
  const poshmark = user?.poshmarkAccount;
  const depop = user?.depopAccount;
  const etsy = user?.etsyAccount;

  const handleEtsyConnect = async () => {
    try {
      setLoading(true);
      toast.success("Redirecting you to Etsy authorization page...");
      const res = await etsyService.connect();
      if (res.data?.success && res.data?.url) {
        window.location.href = res.data.url;
      } else {
        toast.error("Failed to generate Etsy connection link.");
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to initiate Etsy connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleEtsyDisconnect = async () => {
    const ok = await confirm("Are you sure you want to disconnect your Etsy account?");
    if (!ok) return;

    try {
      setLoading(true);
      const res = await etsyService.disconnect();
      if (res.data?.success) {
        toast.success("Etsy account disconnected successfully!");
        loadUser();
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to disconnect Etsy account.");
    } finally {
      setLoading(false);
    }
  };
  
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  
  // Modals state
  const [isPoshModalOpen, setIsPoshModalOpen] = useState(false);
  const [isDepopModalOpen, setIsDepopModalOpen] = useState(false);

  // Poshmark Form state
  const [poshUsername, setPoshUsername] = useState('');
  const [poshLoading, setPoshLoading] = useState(false);
  const [poshPassword, setPoshPassword] = useState('');
  const [poshDomain, setPoshDomain] = useState('poshmark.com');
  const [poshConnectMethod, setPoshConnectMethod] = useState('password'); // 'password', 'extension'
  const [showPosh2fa, setShowPosh2fa] = useState(false);
  const [posh2faCode, setPosh2faCode] = useState('');
  const [posh2faSessionId, setPosh2faSessionId] = useState('');

  // Depop Form state
  const [depopUsername, setDepopUsername] = useState('');
  const [depopLoading, setDepopLoading] = useState(false);
  const [depopConnectMethod, setDepopConnectMethod] = useState('interactive'); // 'interactive', 'extension'

  // Sync state
  const [syncingPlatform, setSyncingPlatform] = useState(null);

  const handleSyncCloset = async (platform, username) => {
    try {
      setSyncingPlatform(platform);
      toast.success(`Starting sync for your ${platform} closet...`);

      let listings = [];
      if (platform === 'depop') {
        try {
          const fetchListingsViaExtension = (userId, accessToken) => {
            return new Promise((resolve, reject) => {
              const handleResponse = (event) => {
                if (event.data && event.data.action === 'ELISTER_FETCH_DEPOP_PRODUCTS_RESPONSE') {
                  window.removeEventListener('message', handleResponse);
                  if (event.data.success) {
                    resolve(event.data.products || []);
                  } else {
                    reject(new Error(event.data.error || 'Failed to fetch products'));
                  }
                }
              };
              window.addEventListener('message', handleResponse);
              window.postMessage({
                action: 'ELISTER_FETCH_DEPOP_PRODUCTS',
                userId,
                accessToken
              }, '*');
              
              setTimeout(() => {
                window.removeEventListener('message', handleResponse);
                reject(new Error('Extension response timeout'));
              }, 15000);
            });
          };

          if (depop?.userId && depop?.accessToken) {
            toast.info("Fetching products directly from Depop via Extension...");
            listings = await fetchListingsViaExtension(depop.userId, depop.accessToken);
            console.log(`[Integrations] Fetched ${listings.length} products via Extension.`);
          }
        } catch (e) {
          console.warn('[Integrations] Extension listing fetch failed, falling back to server scraping...', e);
          toast.warning(`Extension Sync Warning: ${e.message}. Falling back to server scraper...`);
        }
      }

      const res = await externalImportService.importCloset({ 
        platform, 
        username,
        listings: listings.length > 0 ? listings : undefined
      });

      if (res.data?.success) {
        const count = res.data.data.importedCount;
        if (count > 0) {
          toast.success(`Successfully imported ${count} new products from ${platform}!`);
        } else {
          toast.success(`Synced successfully! Your ${platform} inventory is already up-to-date.`);
        }
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
                userId: data.userId,
                accessToken: data.accessToken,
                sessionCookie: data.sessionCookie
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
      const channel = searchParams.get('channel');
      toast.error(`${channel ? channel.charAt(0).toUpperCase() + channel.slice(1) : 'eBay'} Connection Error: ${error}`);
      navigate('/ebay-accounts', { replace: true });
    } else if (success && !called.current) {
      called.current = true;
      const channel = searchParams.get('channel');
      if (success === 'poshmark' || channel === 'poshmark') {
        toast.success('Poshmark Account Connected Successfully!');
      } else if (success === 'depop' || channel === 'depop') {
        toast.success('Depop Account Connected Successfully!');
      } else if (success === 'etsy' || channel === 'etsy') {
        toast.success('Etsy Account Connected Successfully!');
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

    console.log(`[Integrations] Requesting silent connection details from extension for: ${platform}`);
    window.postMessage({
      action: 'ELISTER_GET_CONNECTION_DETAILS',
      platform
    }, '*');
  };

  // Poshmark connection handlers removed (Cloud & Extension only)

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
      if (res.data?.['2faRequired']) {
        toast.info(res.data.message || 'Verification code sent to your email.');
        setShowPosh2fa(true);
        setPosh2faSessionId(res.data.sessionId);
        return;
      }
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

  const handlePoshmark2faSubmit = async (e) => {
    e.preventDefault();
    if (!posh2faCode) {
      toast.warning('Please enter the verification code.');
      return;
    }
    try {
      setPoshLoading(true);
      toast.info('Submitting verification code...');
      const res = await externalImportService.verifyPoshmark2fa({
        sessionId: posh2faSessionId,
        code: posh2faCode
      });
      if (res.data?.success) {
        toast.success('Poshmark Connected Successfully!');
        await loadUser();
        setShowPosh2fa(false);
        setPosh2faCode('');
        setPosh2faSessionId('');
        setPoshUsername('');
        setPoshPassword('');
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Verification failed. Please try again.');
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

  // Depop connection handler removed (In-App & Extension only)

  const handleDepopInteractiveConnect = async () => {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocal) {
      const isExtensionInstalled = document.body.dataset.elisterExtensionInstalled === "true" ||
                                   document.body.dataset.elisterDepopExtensionInstalled === "true";
      if (isExtensionInstalled) {
        toast.info('Redirecting to Depop login. Please log in, and eLister will capture your connection automatically.');
        triggerAutoConnect('depop');
      } else {
        toast.info('Opening Depop login page. Please log in, then ensure the Chrome Extension is enabled to connect automatically.');
        window.open('https://www.depop.com/login/', '_blank');
      }
      return;
    }

    try {
      setDepopLoading(true);
      toast.info('Starting In-App Login. Please look for the opened browser window and log in to Depop.');
      
      const res = await externalImportService.connectInteractiveDepop();
      
      if (res.data?.success) {
        toast.success('Depop Connected Successfully via In-App Login!');
        await loadUser();
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'In-App Login failed or was cancelled.');
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
      {/* Header removed due to dynamic header in NewDashboardLayout */}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* 1. eBay Integration Card */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between h-full min-h-[380px] text-center relative group">
              <div className="flex flex-col items-center flex-1">
                {/* Logo */}
                <div className="w-20 h-20 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 shadow-sm mb-4 transition-transform group-hover:scale-105 duration-300">
                  <img src="/ebay.png" className="w-12 h-12 object-contain" alt="eBay" />
                </div>
                
                <h3 className="text-lg font-black text-slate-800 mb-1">eBay</h3>
                <p className="text-slate-400 text-xs font-semibold mb-3">Online Auction & Retail</p>

                {/* Connection Badge */}
                {ebay?.connected ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-[10px] font-black uppercase tracking-wider mb-4">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    Connected
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 text-slate-500 border border-slate-100 rounded-full text-[10px] font-black uppercase tracking-wider mb-4">
                    Disconnected
                  </div>
                )}

                {/* Info Area */}
                {ebay?.connected ? (
                  <div className="space-y-1 mt-2">
                    <p className="text-sm font-bold text-slate-700 tracking-tight">{ebay.username}</p>
                    <p className="text-[10px] text-slate-400 font-medium">
                      Connected at {ebay.connectedAt ? new Date(ebay.connectedAt).toLocaleDateString() : 'Active'}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 font-medium px-4 mt-2">
                    Authorize eLister to publish listings and sync your live eBay inventory.
                  </p>
                )}
              </div>

              {/* Button Area */}
              <div className="mt-6 pt-4 border-t border-slate-50 w-full">
                {ebay?.connected ? (
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handleDisconnect}
                      disabled={loading}
                      className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1"
                    >
                      Disconnect Channel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleConnect}
                    disabled={loading}
                    className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-black text-xs hover:bg-indigo-700 transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="animate-spin" size={14} /> : <>Connect eBay <ChevronRight size={14} /></>}
                  </button>
                )}
                {statusMsg && <p className="text-indigo-600 font-bold text-[10px] mt-2 animate-pulse">{statusMsg}</p>}
              </div>
            </div>

            {/* 2. Poshmark Integration Card */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between h-full min-h-[380px] text-center relative group">
              <div className="flex flex-col items-center flex-1">
                {/* Logo */}
                <div className="w-20 h-20 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 shadow-sm mb-4 transition-transform group-hover:scale-105 duration-300">
                  <img src="/poshmark.png" className="w-12 h-12 object-contain" alt="Poshmark" />
                </div>

                <h3 className="text-lg font-black text-slate-800 mb-1">Poshmark</h3>
                <p className="text-slate-400 text-xs font-semibold mb-3">Social Commerce Closet</p>

                {/* Connection Badge */}
                {poshmark?.connected ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-[10px] font-black uppercase tracking-wider mb-4">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    Connected
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 text-slate-500 border border-slate-100 rounded-full text-[10px] font-black uppercase tracking-wider mb-4">
                    Disconnected
                  </div>
                )}

                {/* Info Area */}
                {poshmark?.connected ? (
                  <div className="space-y-1 mt-2">
                    <p className="text-sm font-bold text-slate-700 tracking-tight">{poshmark.username}</p>
                    <p className="text-[10px] text-slate-400 font-medium">
                      Connected at {poshmark.connectedAt ? new Date(poshmark.connectedAt).toLocaleDateString() : 'Active'}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 font-medium px-4 mt-2">
                    Import and crosslist products directly to your Poshmark closet.
                  </p>
                )}
              </div>

              {/* Button Area */}
              <div className="mt-6 pt-4 border-t border-slate-50 w-full">
                {poshmark?.connected ? (
                  <div className="space-y-2">
                    <button
                      onClick={() => handleSyncCloset('poshmark', poshmark.username)}
                      disabled={syncingPlatform === 'poshmark'}
                      className="w-full py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {syncingPlatform === 'poshmark' ? <Loader2 className="animate-spin" size={12} /> : <RefreshCw size={12} />}
                      Sync Closet
                    </button>
                    <button
                      onClick={handlePoshmarkDisconnect}
                      disabled={poshLoading}
                      className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl font-bold text-xs transition-all"
                    >
                      Disconnect Channel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setPoshConnectMethod('password');
                      setIsPoshModalOpen(true);
                    }}
                    className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-black text-xs hover:bg-indigo-700 transition-all flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    Connect Poshmark <ChevronRight size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* 3. Depop Integration Card */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between h-full min-h-[380px] text-center relative group">
              <div className="flex flex-col items-center flex-1">
                {/* Logo */}
                <div className="w-20 h-20 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 shadow-sm mb-4 transition-transform group-hover:scale-105 duration-300">
                  <img src="/depop.png" className="w-12 h-12 object-contain" alt="Depop" />
                </div>

                <h3 className="text-lg font-black text-slate-800 mb-1">Depop</h3>
                <p className="text-slate-400 text-xs font-semibold mb-3">Fashion Marketplace & Shop</p>

                {/* Connection Badge */}
                {depop?.connected ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-[10px] font-black uppercase tracking-wider mb-4">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    Connected
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 text-slate-500 border border-slate-100 rounded-full text-[10px] font-black uppercase tracking-wider mb-4">
                    Disconnected
                  </div>
                )}

                {/* Info Area */}
                {depop?.connected ? (
                  <div className="space-y-1 mt-2">
                    <p className="text-sm font-bold text-slate-700 tracking-tight">{depop.username}</p>
                    {depop.userId && (
                      <p className="text-[11px] font-semibold text-slate-500 tracking-tight">ID: {depop.userId}</p>
                    )}
                    <p className="text-[10px] text-slate-400 font-medium">
                      Connected at {depop.connectedAt ? new Date(depop.connectedAt).toLocaleDateString() : 'Active'}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 font-medium px-4 mt-2">
                    Connect to your Depop account to sync inventory and list items.
                  </p>
                )}
              </div>

              {/* Button Area */}
              <div className="mt-6 pt-4 border-t border-slate-50 w-full">
                {depop?.connected ? (
                  <div className="space-y-2">
                    <button
                      onClick={() => handleSyncCloset('depop', depop.username)}
                      disabled={syncingPlatform === 'depop'}
                      className="w-full py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {syncingPlatform === 'depop' ? <Loader2 className="animate-spin" size={12} /> : <RefreshCw size={12} />}
                      Sync Shop
                    </button>
                    <button
                      onClick={handleDepopDisconnect}
                      disabled={depopLoading}
                      className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl font-bold text-xs transition-all"
                    >
                      Disconnect Channel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setDepopConnectMethod('interactive');
                      setIsDepopModalOpen(true);
                    }}
                    className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-black text-xs hover:bg-indigo-700 transition-all flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    Connect Depop <ChevronRight size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* 4. Etsy Integration Card */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between h-full min-h-[380px] text-center relative group">
              <div className="flex flex-col items-center flex-1">
                {/* Logo */}
                <div className="w-20 h-20 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 shadow-sm mb-4 transition-transform group-hover:scale-105 duration-300">
                  <img src="/etsy.png" className="w-12 h-12 object-contain" alt="Etsy" />
                </div>

                <h3 className="text-lg font-black text-slate-800 mb-1">Etsy</h3>
                <p className="text-slate-400 text-xs font-semibold mb-3">Handmade & Vintage Goods</p>

                {/* Connection Badge */}
                {etsy?.connected ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-[10px] font-black uppercase tracking-wider mb-4">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    Connected
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 text-slate-500 border border-slate-100 rounded-full text-[10px] font-black uppercase tracking-wider mb-4">
                    Disconnected
                  </div>
                )}

                {/* Info Area */}
                {etsy?.connected ? (
                  <div className="space-y-1 mt-2">
                    <p className="text-sm font-bold text-slate-700 tracking-tight">{etsy.shopName || 'Etsy Shop'}</p>
                    <p className="text-[10px] text-slate-400 font-medium">Shop ID: {etsy.shopId}</p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 font-medium px-4 mt-2">
                    Connect to your Etsy account to cross-list and sync inventory.
                  </p>
                )}
              </div>

              {/* Button Area */}
              <div className="mt-6 pt-4 border-t border-slate-50 w-full">
                {etsy?.connected ? (
                  <div className="space-y-2">
                    <button
                      onClick={handleEtsyDisconnect}
                      className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl font-bold text-xs transition-all"
                    >
                      Disconnect Channel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleEtsyConnect}
                    className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-black text-xs hover:bg-indigo-700 transition-all flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    Connect Etsy <ChevronRight size={14} />
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* Enterprise-Grade Security Card */}
          <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-8 md:p-10 rounded-[2.5rem] text-white relative overflow-hidden border border-slate-800 shadow-xl shadow-indigo-950/10 mt-6">
            {/* Ambient Background Glows */}
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />

            <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Left Info Column */}
              <div className="lg:col-span-5 space-y-6">
                {/* Shield Icon */}
                <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400 border border-indigo-500/20 shadow-inner">
                  <ShieldCheck size={28} className="animate-pulse" />
                </div>
                
                <div className="space-y-2">
                  <h4 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                    Enterprise-Grade Security
                  </h4>
                  <p className="text-slate-400 text-xs md:text-sm leading-relaxed font-medium">
                    Your credentials and API keys are fully protected. Elister uses cutting-edge cryptographic protocols and secure network channels to manage your multi-channel inventory.
                  </p>
                </div>

                {/* Status footer badge */}
                <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Network Status</span>
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-black uppercase tracking-wide">
                    <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                    Fully Secure (SSL/TLS 1.3)
                  </span>
                </div>
              </div>

              {/* Right Features Column - 2x2 Grid */}
              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* AES-256 */}
                <div className="p-5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all duration-300 space-y-3">
                  <div className="w-9 h-9 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center">
                    <Lock size={16} />
                  </div>
                  <div className="space-y-1">
                    <h5 className="text-xs font-black text-slate-200">AES-256 Encryption</h5>
                    <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                      All active sessions, local credentials, and cookies are encrypted at rest using military-grade AES-256 protocols.
                    </p>
                  </div>
                </div>

                {/* Direct API */}
                <div className="p-5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all duration-300 space-y-3">
                  <div className="w-9 h-9 bg-indigo-500/10 text-indigo-400 rounded-xl flex items-center justify-center">
                    <Server size={16} />
                  </div>
                  <div className="space-y-1">
                    <h5 className="text-xs font-black text-slate-200">Direct API Integration</h5>
                    <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                      Listing publishing, inventory retrieval, and updates use direct authorized API gateways to communicate with the marketplaces.
                    </p>
                  </div>
                </div>

                {/* Sync */}
                <div className="p-5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all duration-300 space-y-3">
                  <div className="w-9 h-9 bg-violet-500/10 text-violet-400 rounded-xl flex items-center justify-center">
                    <Globe size={16} />
                  </div>
                  <div className="space-y-1">
                    <h5 className="text-xs font-black text-slate-200">Multi-Channel Sync</h5>
                    <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                      Event-driven webhooks automatically sync listings and quantity counts across eBay, Poshmark, and Depop.
                    </p>
                  </div>
                </div>

                {/* Session Protection */}
                <div className="p-5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all duration-300 space-y-3">
                  <div className="w-9 h-9 bg-amber-500/10 text-amber-400 rounded-xl flex items-center justify-center">
                    <ShieldCheck size={16} />
                  </div>
                  <div className="space-y-1">
                    <h5 className="text-xs font-black text-slate-200">Session Guard</h5>
                    <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                      Session tokens automatically expire when inactive. Local cookies are periodically purged to safeguard against session hijacking.
                    </p>
                  </div>
                </div>

              </div>
            </div>
          </div>

      {/* Connection Modals */}
      {isPoshModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-xl max-w-md w-full border border-slate-100 overflow-hidden relative flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-6 pb-4 flex items-center justify-between border-b border-slate-50">
              <div className="flex items-center gap-3">
                <img src="/poshmark.png" className="w-8 h-8 object-contain" alt="" />
                <div>
                  <h3 className="text-lg font-black text-slate-800">Connect Poshmark</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Configure Channel</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsPoshModalOpen(false);
                  setShowPosh2fa(false);
                }}
                className="p-2 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-xl transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              {showPosh2fa ? (
                <form onSubmit={handlePoshmark2faSubmit} className="space-y-4">
                  <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl text-center">
                    <h4 className="text-xs font-bold text-indigo-900 mb-1">Email Verification Required</h4>
                    <p className="text-[11px] text-indigo-700">Please enter the security verification code sent by Poshmark to your email.</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Verification Code</label>
                    <input 
                      type="text" 
                      placeholder="Enter OTP / verification code" 
                      value={posh2faCode}
                      onChange={(e) => setPosh2faCode(e.target.value)}
                      className="w-full h-11 px-3 bg-slate-50 border border-slate-100 focus:border-indigo-500 rounded-xl text-xs outline-none font-bold tracking-widest text-center focus:ring-2 focus:ring-indigo-500/10 transition-all text-slate-700"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button 
                      type="button"
                      onClick={() => {
                        setShowPosh2fa(false);
                        setPosh2faCode('');
                      }}
                      className="flex-1 py-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-xs transition-all border border-slate-100"
                    >
                      Back to Login
                    </button>
                    <button 
                      type="submit"
                      disabled={poshLoading}
                      className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-md"
                    >
                      {poshLoading ? <Loader2 className="animate-spin" size={14} /> : 'Verify Code'}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  {/* Method selector tabs */}
                  <div className="flex bg-slate-100 p-1 rounded-2xl gap-1">
                    <button
                      type="button"
                      onClick={() => setPoshConnectMethod('password')}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${
                        poshConnectMethod === 'password' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      Cloud Login
                    </button>
                    <button
                      type="button"
                      onClick={() => setPoshConnectMethod('extension')}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${
                        poshConnectMethod === 'extension' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      Chrome Extension
                    </button>
                  </div>

                  {poshConnectMethod === 'password' && (
                    <form onSubmit={handlePoshmarkPasswordConnect} className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Poshmark Region</label>
                        <select
                          value={poshDomain}
                          onChange={(e) => setPoshDomain(e.target.value)}
                          className="w-full h-11 px-3 bg-slate-50 border border-slate-100 rounded-xl text-xs outline-none focus:border-indigo-500 font-bold text-slate-700"
                        >
                          <option value="poshmark.com">United States (poshmark.com)</option>
                          <option value="poshmark.ca">Canada (poshmark.ca)</option>
                          <option value="poshmark.co.uk">United Kingdom (poshmark.co.uk)</option>
                          <option value="poshmark.com.au">Australia (poshmark.com.au)</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Username or Email</label>
                        <input 
                          type="text" 
                          placeholder="e.g. posh_seller or email@example.com" 
                          value={poshUsername}
                          onChange={(e) => setPoshUsername(e.target.value)}
                          className="w-full h-11 px-3 bg-slate-50 border border-slate-100 rounded-xl text-xs outline-none focus:border-indigo-500 font-semibold text-slate-700"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Password</label>
                        <input 
                          type="password" 
                          placeholder="Your Poshmark password" 
                          value={poshPassword}
                          onChange={(e) => setPoshPassword(e.target.value)}
                          className="w-full h-11 px-3 bg-slate-50 border border-slate-100 rounded-xl text-xs outline-none focus:border-indigo-500 font-semibold"
                        />
                      </div>
                      <div className="pt-2 flex gap-3">
                        <button 
                          type="button"
                          onClick={() => setIsPoshModalOpen(false)}
                          className="flex-1 py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-bold text-xs transition-all border border-slate-100"
                        >
                          Cancel
                        </button>
                        <button 
                          type="submit"
                          disabled={poshLoading}
                          className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-md"
                        >
                          {poshLoading ? <Loader2 className="animate-spin" size={14} /> : 'Connect Closet'}
                        </button>
                      </div>
                    </form>
                  )}

                  {poshConnectMethod === 'extension' && (
                    <div className="space-y-4 py-2">
                      <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl space-y-2">
                        <h4 className="text-xs font-bold text-slate-800">Extension Requirements</h4>
                        <ul className="text-[11px] text-slate-500 space-y-1 list-disc list-inside">
                          <li>Requires eLister Chrome Extension.</li>
                          <li>Make sure you are logged in to Poshmark on your Chrome browser.</li>
                          <li>The extension will automatically pull your session.</li>
                        </ul>
                      </div>
                      
                      <div className="flex gap-3 pt-2">
                        <button 
                          type="button"
                          onClick={() => setIsPoshModalOpen(false)}
                          className="flex-1 py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-bold text-xs transition-all border border-slate-100"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={() => {
                            triggerAutoConnect('poshmark');
                            setIsPoshModalOpen(false);
                          }}
                          disabled={poshLoading}
                          className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs hover:bg-indigo-700 transition-all flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
                        >
                          {poshLoading ? <Loader2 className="animate-spin" size={14} /> : <>Connect Automatically <Zap size={12} className="text-yellow-400 fill-yellow-400" /></>}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {isDepopModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-xl max-w-md w-full border border-slate-100 overflow-hidden relative flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-6 pb-4 flex items-center justify-between border-b border-slate-50">
              <div className="flex items-center gap-3">
                <img src="/depop.png" className="w-8 h-8 object-contain" alt="" />
                <div>
                  <h3 className="text-lg font-black text-slate-800">Connect Depop</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Configure Channel</p>
                </div>
              </div>
              <button 
                onClick={() => setIsDepopModalOpen(false)}
                className="p-2 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-xl transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              {/* Method selector tabs */}
              <div className="flex bg-slate-100 p-1 rounded-2xl gap-1">
                <button
                  type="button"
                  onClick={() => setDepopConnectMethod('interactive')}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${
                    depopConnectMethod === 'interactive' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  In-App Login
                </button>
                <button
                  type="button"
                  onClick={() => setDepopConnectMethod('extension')}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${
                    depopConnectMethod === 'extension' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Chrome Extension
                </button>
              </div>

              {depopConnectMethod === 'interactive' && (
                <div className="space-y-4 py-2">
                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl space-y-2 text-center">
                    <h4 className="text-xs font-bold text-slate-800">Secure In-App Login</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      We'll open a secure connection tab where you can log in to your Depop account. eLister will securely authorize and establish the connection.
                    </p>
                  </div>
                  
                  <div className="flex gap-3 pt-2">
                    <button 
                      type="button"
                      onClick={() => setIsDepopModalOpen(false)}
                      className="flex-1 py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-bold text-xs transition-all border border-slate-100"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={() => {
                        handleDepopInteractiveConnect();
                        setIsDepopModalOpen(false);
                      }}
                      disabled={depopLoading}
                      className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs hover:bg-indigo-700 transition-all flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
                    >
                      {depopLoading ? <Loader2 className="animate-spin" size={14} /> : <>Start Login Flow <Zap size={12} className="text-yellow-400 fill-yellow-400" /></>}
                    </button>
                  </div>
                </div>
              )}

              {depopConnectMethod === 'extension' && (
                <div className="space-y-4 py-2">
                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl space-y-2">
                    <h4 className="text-xs font-bold text-slate-800">Extension Requirements</h4>
                    <ul className="text-[11px] text-slate-500 space-y-1 list-disc list-inside">
                      <li>Requires eLister Chrome Extension.</li>
                      <li>Make sure you are logged in to Depop on your Chrome browser.</li>
                      <li>The extension will automatically pull your session.</li>
                    </ul>
                  </div>
                  
                  <div className="flex gap-3 pt-2">
                    <button 
                      type="button"
                      onClick={() => setIsDepopModalOpen(false)}
                      className="flex-1 py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-bold text-xs transition-all border border-slate-100"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={() => {
                        triggerAutoConnect('depop');
                        setIsDepopModalOpen(false);
                      }}
                      disabled={depopLoading}
                      className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs hover:bg-indigo-700 transition-all flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
                    >
                      {depopLoading ? <Loader2 className="animate-spin" size={14} /> : <>Connect Automatically <Zap size={12} className="text-yellow-400 fill-yellow-400" /></>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EbayAccounts;
