import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  List, 
  ShoppingBag, 
  BarChart3, 
  Settings, 
  Plug, 
  HelpCircle, 
  Bell, 
  Search, 
  ChevronDown, 
  Plus, 
  User, 
  LogOut,
  Menu,
  X,
  Sparkles,
  CreditCard
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getLandingUrl } from '../utils/urls';
import { listingService } from '../services/api';

// Import creation page components directly to mount them in modal popup
import CreateEbayListing from '../pages/CreateEbayListing';
import BulkListingEbay from '../pages/BulkListingEbay';
import CreatePoshmarkListing from '../pages/CreatePoshmarkListing';
import CreateDepopListing from '../pages/CreateDepopListing';
import CreateMasterListing from '../pages/CreateMasterListing';
import CreateEtsyListing from '../pages/CreateEtsyListing';

const NewDashboardLayout = () => {
  const { logout, user, loadUser } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isCreateDropdownOpen, setIsCreateDropdownOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const profileDropdownRef = useRef(null);
  const createDropdownRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Global Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [listings, setListings] = useState([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Notification states
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationsDropdownRef = useRef(null);
  const [notifications, setNotifications] = useState([]);

  // Focus handler to fetch listings from the database once
  const handleSearchFocus = async () => {
    setIsSearchFocused(true);
    try {
      const res = await listingService.getAll();
      if (res?.data?.success) {
        setListings(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load listings for search:', err.message);
    }
  };

  const handleSearchBlur = () => {
    setTimeout(() => {
      setIsSearchFocused(false);
    }, 200);
  };

  // Static pages list for quick search
  const pages = [
    { title: 'Dashboard', subtitle: 'View performance and quotas', path: '/dashboard', type: 'page', badge: 'Overview' },
    { title: 'Listings', subtitle: 'Manage your local database', path: '/listings', type: 'page', badge: 'Inventory' },
    { title: 'New Listing', subtitle: 'Create a new AI-generated listing', path: 'new_listing_action', type: 'page', badge: 'AI Tool' },
    { title: 'Orders', subtitle: 'View customer sales & invoices', path: '/orders', type: 'page', badge: 'Orders' },
    { title: 'Analytics', subtitle: 'View platform charts and metrics', path: '/analytics', type: 'page', badge: 'Reports' },
    { title: 'Subscription', subtitle: 'Manage active plans and billing', path: '/subscription', type: 'page', badge: 'Billing' },
    { title: 'Settings', subtitle: 'Change profile info or credentials', path: '/settings', type: 'page', badge: 'Account' },
    { title: 'Integrations', subtitle: 'Connect to eBay, Poshmark, Depop', path: '/integrations', type: 'page', badge: 'Channels' }
  ];

  const handleSearchChange = (query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const lowerQuery = query.toLowerCase().trim();
    
    // Filter matching pages
    const matchedPages = pages.filter(p => 
      p.title.toLowerCase().includes(lowerQuery) || 
      p.subtitle.toLowerCase().includes(lowerQuery) ||
      p.badge.toLowerCase().includes(lowerQuery)
    );

    // Filter matching database listings
    const matchedListings = listings
      .filter(l => 
        (l.title && l.title.toLowerCase().includes(lowerQuery)) ||
        (l.sku && l.sku.toLowerCase().includes(lowerQuery)) ||
        (l.platform && l.platform.toLowerCase().includes(lowerQuery)) ||
        (l.status && l.status.toLowerCase().includes(lowerQuery))
      )
      .map(l => ({
        id: l._id,
        title: l.title,
        subtitle: `SKU: ${l.sku || '-'} | Platform: ${l.platform.toUpperCase()} | Status: ${l.status.toUpperCase()}`,
        path: `/create-${l.platform}-listing?edit=${l._id}`,
        type: 'listing',
        badge: l.status
      }));

    setSearchResults([...matchedPages, ...matchedListings]);
  };

  const handleResultClick = (res) => {
    setSearchQuery('');
    setSearchResults([]);
    setIsSearchFocused(false);
    
    if (res.path === 'new_listing_action') {
      setIsCreateModalOpen(true);
    } else {
      navigate(res.path);
    }
  };

  // Keyboard shortcut listener (Cmd/Ctrl + K or Slash key)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        ((e.metaKey || e.ctrlKey) && e.key === 'k') ||
        (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA')
      ) {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder="Search pages, listings, SKUs..."]');
        if (searchInput) searchInput.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Listen for custom 'elister-toast' events to populate the notifications dropdown list automatically
  useEffect(() => {
    const handleToastEvent = (e) => {
      const { message, type } = e.detail || {};
      if (!message) return;

      const newNotif = {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        title: type === 'success' ? 'Operation Success' : type === 'error' ? 'Operation Failed' : type === 'warning' ? 'Attention Warning' : 'System Notification',
        message: message,
        time: 'Just now',
        type: type || 'info',
        read: false
      };

      setNotifications((prev) => {
        // Keep the latest 10 items, discard older ones
        const updated = [newNotif, ...prev];
        return updated.slice(0, 10);
      });
    };

    window.addEventListener('elister-toast', handleToastEvent);
    return () => window.removeEventListener('elister-toast', handleToastEvent);
  }, []);

  useEffect(() => {
    loadUser().catch(console.error);
  }, []);

  // Listen to navigation events to automatically close the modal when creation redirects to /listings
  useEffect(() => {
    setIsCreateModalOpen(false);
    setSelectedPlatform('');
  }, [location.key]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target)) {
        setIsProfileDropdownOpen(false);
      }
      if (createDropdownRef.current && !createDropdownRef.current.contains(e.target)) {
        setIsCreateDropdownOpen(false);
      }
      if (notificationsDropdownRef.current && !notificationsDropdownRef.current.contains(e.target)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    window.location.href = getLandingUrl('/');
  };

  // Sidebar Menu Items based on screenshot:
  // Dashboard, Listings, Crosslisting, Orders, Analytics, Settings, Integrations, Help & Support
  const sidebarItems = [
    { name: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/dashboard' },
    { name: 'Listings', icon: <List size={20} />, path: '/listings' },
    { name: 'Orders', icon: <ShoppingBag size={20} />, path: '/orders' },
    { name: 'Analytics', icon: <BarChart3 size={20} />, path: '/analytics' },
    { name: 'Subscription', icon: <CreditCard size={20} />, path: '/subscription' },
    { name: 'Settings', icon: <Settings size={20} />, path: '/settings' },
    { name: 'Integrations', icon: <Plug size={20} />, path: '/integrations' },
    { name: 'Help & Support', icon: <HelpCircle size={20} />, path: '/help' },
  ];

  // Dynamic Page Title
  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes('/dashboard')) return 'Dashboard';
    if (path.includes('/listings')) return 'Listings';
    if (path.includes('/crosslisting')) return 'Crosslisting';
    if (path.includes('/sales') || path.includes('/orders')) return 'Orders';
    if (path.includes('/analytics')) return 'Analytics';
    if (path.includes('/subscription')) return 'Subscription';
    if (path.includes('/settings')) return 'Settings';
    if (path.includes('/integrations')) return 'Integrations';
    if (path.includes('/help')) return 'Help & Support';
    return 'Listings';
  };

  const getPlanLimit = (planName) => {
    const plan = String(planName || 'free').toLowerCase();
    switch (plan) {
      case 'basic': return 500;
      case 'pro': return 3000;
      case 'enterprise': return 10000;
      case 'free':
      default: return 0;
    }
  };

  const getFetchLimit = (planName) => {
    return getPlanLimit(planName);
  };

  // Dynamic user data computations
  const plan = user?.subscription?.plan || 'free';
  const listingLimit = getPlanLimit(plan);
  const aiFetchLimit = getFetchLimit(plan);
  const listingsCount = user?.usage?.listingsCount ?? 0;
  const fetchesCount = user?.usage?.fetchesCount ?? 0;
  const daysLeft = user?.usage?.daysLeft ?? 0;
  
  const progressPct = listingLimit > 0 ? Math.min(100, Math.round((listingsCount / listingLimit) * 100)) : 0;
  const aiFetchPct = aiFetchLimit > 0 ? Math.min(100, Math.round((fetchesCount / aiFetchLimit) * 100)) : 0;
  
  const firstName = user?.firstName || 'John';
  const lastName = user?.lastName || 'Doe';
  const rawPlan = user?.subscription?.plan || 'Pro';
  const planName = rawPlan.charAt(0).toUpperCase() + rawPlan.slice(1);
  const planStatus = user?.subscription?.status || 'Active';

  return (
    <div className="min-h-screen bg-[#fafbfe] flex font-sans antialiased text-[#1f2937]">
      
      {/* Mobile Menu Toggle Button */}
      <button 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="md:hidden fixed bottom-6 right-6 z-50 bg-indigo-600 text-white p-4 rounded-full shadow-2xl hover:bg-indigo-700 active:scale-95 transition-all"
      >
        {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* SIDEBAR */}
      <aside 
        onMouseEnter={() => setIsSidebarOpen(true)}
        onMouseLeave={() => setIsSidebarOpen(false)}
        className={`fixed inset-y-0 left-0 z-45 bg-white border-r border-[#f1f3f9] flex flex-col justify-between transition-all duration-300 ${
          isSidebarOpen ? 'w-64 translate-x-0 shadow-xl' : 'w-0 -translate-x-full md:w-20 md:translate-x-0 overflow-hidden'
        }`}
      >
        <div className="flex flex-col flex-1">
          {/* Logo Section */}
          <div className="h-20 px-6 flex items-center justify-center select-none border-b border-[#fbfcfe]">
            {isSidebarOpen ? (
              <img src="/logo.png" alt="Elister.ai" className="h-8 w-auto object-contain transition-all duration-300" />
            ) : (
              <img src="/icon.png" alt="Elister.ai" className="h-9 w-9 object-contain transition-all duration-300" />
            )}
          </div>

          {/* Sidebar Menu Items */}
          <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
            {sidebarItems.map((item) => {
              const isActive = location.pathname === item.path || (item.path === '/listings' && location.pathname.startsWith('/create-'));
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  onClick={() => setIsSidebarOpen(false)}
                  className={`flex items-center gap-3.5 px-4 py-3 rounded-2xl transition-all group font-bold text-sm ${
                    isActive 
                      ? 'bg-[#f4f5ff] text-indigo-600' 
                      : 'text-[#6b7280] hover:text-[#111827] hover:bg-slate-50'
                  }`}
                >
                  <span className={`transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-[#111827]'}`}>
                    {item.icon}
                  </span>
                  {isSidebarOpen && <span>{item.name}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Logout Section */}
        <div className="p-4 border-t border-[#f1f3f9] bg-white">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3.5 w-full px-4 py-3 rounded-2xl transition-all group font-bold text-sm text-[#6b7280] hover:text-rose-600 hover:bg-rose-50/50 cursor-pointer border-0 bg-transparent"
          >
            <span className="text-slate-400 group-hover:text-rose-500 transition-colors shrink-0">
              <LogOut size={18} />
            </span>
            {isSidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* MAIN VIEW CONTENT CONTAINER */}
      <div className="flex-1 flex flex-col md:ml-20 transition-all duration-300">
        
        {/* TOP HEADER */}
        <header className="h-20 bg-white border-b border-[#f1f3f9] flex items-center justify-between px-8 sticky top-0 z-40">
          
          {/* Left Side: Page Title and Search */}
          <div className="flex items-center gap-6 flex-1">
            <span className="text-2xl font-extrabold text-[#111827] select-none tracking-tight shrink-0">
              {getPageTitle()}
            </span>

            {/* Global Search Bar */}
            <div className="hidden lg:flex items-center bg-[#f3f4f6] rounded-2xl px-4 py-2 w-96 relative border border-transparent focus-within:border-indigo-150 focus-within:bg-white transition-all z-50">
              <Search size={18} className="text-slate-400" />
              <input 
                type="text" 
                placeholder="Search pages, listings, SKUs..." 
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={handleSearchFocus}
                onBlur={handleSearchBlur}
                className="bg-transparent border-none outline-none px-2.5 text-xs font-bold text-slate-650 w-full placeholder:text-slate-400"
              />
              {searchQuery && (
                <button 
                  onClick={() => handleSearchChange('')}
                  className="mr-12 hover:text-rose-600 text-slate-400 text-xs font-bold bg-transparent border-0 cursor-pointer"
                >
                  Clear
                </button>
              )}
              <span className="absolute right-3.5 px-2 py-0.5 bg-white border border-[#e5e7eb] rounded-lg text-[9px] font-black text-slate-400 select-none shadow-sm">
                ⌘ K
              </span>

              {/* Search Results Dropdown */}
              {isSearchFocused && (searchQuery.trim().length > 0 || searchResults.length > 0) && (
                <div 
                  onMouseDown={(e) => e.preventDefault()} // prevent blur when clicking dropdown items
                  className="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl max-h-80 overflow-y-auto z-55 py-2 animate-in fade-in slide-in-from-top-1 duration-100"
                >
                  {searchResults.length === 0 ? (
                    <div className="px-4 py-3 text-xs font-bold text-slate-400 text-center">
                      No results found for "{searchQuery}"
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {searchResults.map((res) => (
                        <button
                          key={res.id || res.path}
                          onClick={() => handleResultClick(res)}
                          className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center justify-between group transition-colors border-0 bg-transparent cursor-pointer"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-indigo-500 shrink-0">
                              {res.type === 'page' ? <LayoutDashboard size={14} /> : <ShoppingBag size={14} />}
                            </span>
                            <div>
                              <div className="text-xs font-black text-slate-800 group-hover:text-indigo-650 transition-colors">
                                {res.title}
                              </div>
                              <div className="text-[10px] font-semibold text-slate-400 mt-0.5">
                                {res.subtitle}
                              </div>
                            </div>
                          </div>
                          {res.badge && (
                            <span className="text-[9px] font-black text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg uppercase tracking-wider">
                              {res.badge}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Side Controls */}
          <div className="flex items-center gap-6 shrink-0">
            
            {/* New Listing Button */}
            <div className="relative">
              <button 
                onClick={() => setIsCreateModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-5 py-2.5 rounded-2xl flex items-center gap-2 text-xs transition-all active:scale-95 shadow-md shadow-indigo-150 cursor-pointer"
              >
                <Plus size={16} strokeWidth={2.5} />
                New Listing
              </button>
            </div>

            {/* Bell/Notifications */}
            <div className="relative" ref={notificationsDropdownRef}>
              <button 
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className={`p-2.5 hover:bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-2xl relative transition-all border border-[#f3f4f6] cursor-pointer ${
                  isNotificationsOpen ? 'bg-slate-50 text-indigo-600' : ''
                }`}
              >
                <Bell size={18} />
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="absolute top-2 right-2 w-4 h-4 bg-rose-500 rounded-full border-2 border-white text-[9px] font-black text-white flex items-center justify-center animate-pulse">
                    {notifications.filter(n => !n.read).length}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown Panel */}
              {isNotificationsOpen && (
                <div className="absolute right-0 mt-3.5 w-80 bg-white rounded-3xl border border-[#f1f3f9] shadow-2xl z-[999] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-5 py-4 border-b border-[#f8fafc] bg-slate-50/40 flex justify-between items-center">
                    <div>
                      <h4 className="text-xs font-extrabold text-[#111827]">Notifications</h4>
                      <p className="text-[9px] font-bold text-[#94a3b8] mt-0.5">
                        {notifications.filter(n => !n.read).length} unread messages
                      </p>
                    </div>
                    <div className="flex gap-2.5 items-center">
                      {notifications.filter(n => !n.read).length > 0 && (
                        <button 
                          onClick={() => setNotifications(notifications.map(n => ({ ...n, read: true })))}
                          className="text-[9px] font-extrabold text-indigo-650 hover:text-indigo-850 hover:underline bg-transparent border-0 cursor-pointer"
                        >
                          Mark read
                        </button>
                      )}
                      {notifications.length > 0 && (
                        <button 
                          onClick={() => setNotifications([])}
                          className="text-[9px] font-extrabold text-rose-600 hover:text-rose-800 hover:underline bg-transparent border-0 cursor-pointer"
                        >
                          Clear all
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="max-h-64 overflow-y-auto divide-y divide-[#f8fafc]">
                    {notifications.length === 0 ? (
                      <div className="p-5 text-center text-xs font-bold text-slate-400">
                        No notifications yet
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div 
                          key={n.id} 
                          onClick={() => setNotifications(notifications.map(item => item.id === n.id ? { ...item, read: true } : item))}
                          className={`p-4 text-left transition-colors cursor-pointer flex gap-3 relative group ${
                            n.read ? 'hover:bg-slate-50/50' : 'bg-indigo-50/20 hover:bg-indigo-50/40'
                          }`}
                        >
                          <div className="mt-0.5 shrink-0">
                            <span className={`w-2 h-2 rounded-full block ${
                              n.read ? 'bg-transparent' : 'bg-indigo-600'
                            }`} />
                          </div>
                          <div className="space-y-0.5 flex-1 min-w-0 pr-4">
                            <div className="flex justify-between items-start gap-2">
                              <h5 className={`text-xs text-[#111827] truncate ${n.read ? 'font-bold' : 'font-extrabold'}`}>
                                {n.title}
                              </h5>
                              <span className="text-[9px] font-semibold text-slate-400 shrink-0 mt-0.5">{n.time}</span>
                            </div>
                            <p className="text-[10px] font-bold text-slate-400 leading-normal break-words">
                              {n.message}
                            </p>
                          </div>
                          {/* Close/delete button */}
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setNotifications(prev => prev.filter(item => item.id !== n.id));
                            }}
                            className="absolute right-3.5 top-3.5 p-1 text-slate-350 hover:text-rose-500 rounded-lg hover:bg-slate-100 transition-all bg-transparent border-0 shrink-0 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Info Dropdown */}
            <div className="relative" ref={profileDropdownRef}>
              <button 
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                className="flex items-center gap-3.5 text-left p-1.5 hover:bg-slate-50 rounded-2xl transition-all cursor-pointer border border-transparent hover:border-slate-100"
              >
                <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-indigo-700 shadow-sm shrink-0 overflow-hidden">
                  <span className="text-sm">{firstName.charAt(0)}{lastName.charAt(0)}</span>
                </div>
                <div className="hidden sm:block min-w-0 pr-1.5">
                  <h4 className="font-extrabold text-xs text-[#111827] tracking-tight">{firstName} {lastName}</h4>
                  <p className="text-[10px] font-bold text-[#4f46e5] mt-0.5 capitalize">{planName} Plan</p>
                </div>
              </button>

              {/* Profile Dropdown Menu */}
              {isProfileDropdownOpen && (
                <div className="absolute right-0 mt-3.5 w-80 bg-white rounded-3xl border border-[#f1f3f9] shadow-2xl z-[999] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-5 py-4 border-b border-[#f8fafc] bg-slate-50/40">
                    <p className="text-[9px] font-bold text-[#94a3b8] uppercase tracking-widest">Logged in as</p>
                    <p className="text-xs font-extrabold text-[#111827] mt-0.5 truncate">{user?.email || 'user@elister.ai'}</p>
                  </div>
                  
                  {/* Subscription Details */}
                  <div className="p-5 border-b border-[#f8fafc] space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Active Plan</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          planName.toLowerCase() === 'pro' ? 'bg-indigo-50 text-indigo-650 border border-indigo-100' :
                          planName.toLowerCase() === 'enterprise' ? 'bg-emerald-50 text-emerald-655 border border-emerald-100' :
                          planName.toLowerCase() === 'basic' ? 'bg-blue-50 text-blue-655 border border-blue-100' :
                          'bg-slate-100 text-slate-655'
                        }`}>
                          {planName}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${
                          planStatus.toLowerCase() === 'active' ? 'bg-emerald-50 text-emerald-650' : 'bg-rose-50 text-rose-650'
                        }`}>
                          {planStatus}
                        </span>
                      </div>
                    </div>

                    {planStatus.toLowerCase() === 'active' && (
                      <div className="bg-[#fbfcfe] border border-[#f1f3f9] p-3 rounded-2xl flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500">Days Remaining:</span>
                        <span className="text-[11px] font-black text-indigo-600">
                          {daysLeft > 0 ? `${daysLeft} Days` : 'Expires Today'}
                        </span>
                      </div>
                    )}

                    {/* Quotas */}
                    <div className="space-y-3 pt-1">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-bold text-slate-500">
                          <span>AI Listings Used</span>
                          <span className="font-extrabold text-slate-800">{listingsCount.toLocaleString()} / {listingLimit.toLocaleString()}</span>
                        </div>
                        <div className="w-full h-1.5 bg-[#f1f3f9] rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-indigo-600 rounded-full transition-all duration-500" 
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-bold text-slate-500">
                          <span>AI Fetches Used</span>
                          <span className="font-extrabold text-slate-800">{fetchesCount.toLocaleString()} / {aiFetchLimit.toLocaleString()}</span>
                        </div>
                        <div className="w-full h-1.5 bg-[#f1f3f9] rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-600 rounded-full transition-all duration-500" 
                            style={{ width: `${aiFetchPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-2 bg-slate-50/30 flex flex-col gap-1">
                    <Link 
                      to="/settings"
                      onClick={() => setIsProfileDropdownOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-slate-650 hover:bg-slate-50 rounded-xl transition-all"
                    >
                      <User size={15} className="text-slate-400" />
                      Profile Settings
                    </Link>
                    <button 
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-[#e11d48] hover:bg-rose-50 rounded-xl transition-all text-left cursor-pointer"
                    >
                      <LogOut size={15} />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>

        </header>

        {/* Page Content Outlet */}
        <main className="p-8 flex-grow">
          <Outlet />
        </main>
      </div>

      {/* POPUP MODAL FOR CREATING NEW LISTING */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-[#0f172a]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          
          {selectedPlatform === '' ? (
            /* Step 1: Select Platform */
            <div className="bg-white rounded-3xl max-w-xl w-full p-8 border border-[#e2e8f0] shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="absolute top-6 right-6 p-2 hover:bg-slate-50 border border-slate-100 rounded-xl text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
              
              <div className="text-center mb-6">
                <span className="text-[10px] font-black text-indigo-650 uppercase tracking-widest block mb-1">Create Listing</span>
                <h3 className="text-xl font-black text-slate-900">Select Platform</h3>
                <p className="text-slate-400 text-xs font-semibold mt-1">Choose where you want to list your product</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {/* eBay Single */}
                <button 
                  onClick={() => setSelectedPlatform('ebay')}
                  className="flex flex-col items-center justify-center p-6 bg-slate-50 hover:bg-indigo-50/30 border border-slate-100 hover:border-indigo-100 rounded-3xl transition-all cursor-pointer group"
                >
                  <img src="/ebay.png" className="w-10 h-10 object-contain group-hover:scale-105 transition-transform" alt="" />
                  <span className="text-xs font-black text-slate-800 mt-3 block">eBay Single</span>
                </button>

                {/* eBay Bulk */}
                <button 
                  onClick={() => setSelectedPlatform('ebay-bulk')}
                  className="flex flex-col items-center justify-center p-6 bg-slate-50 hover:bg-indigo-50/30 border border-slate-100 hover:border-indigo-100 rounded-3xl transition-all cursor-pointer group"
                >
                  <img src="/ebay.png" className="w-10 h-10 object-contain group-hover:scale-105 transition-transform" alt="" />
                  <span className="text-xs font-black text-slate-800 mt-3 block">eBay Bulk</span>
                </button>

                {/* Poshmark */}
                <button 
                  onClick={() => setSelectedPlatform('poshmark')}
                  className="flex flex-col items-center justify-center p-6 bg-slate-50 hover:bg-indigo-50/30 border border-slate-100 hover:border-indigo-100 rounded-3xl transition-all cursor-pointer group"
                >
                  <img src="/poshmark.png" className="w-10 h-10 object-contain group-hover:scale-105 transition-transform" alt="" />
                  <span className="text-xs font-black text-slate-800 mt-3 block">Poshmark</span>
                </button>

                {/* Depop */}
                <button 
                  onClick={() => setSelectedPlatform('depop')}
                  className="flex flex-col items-center justify-center p-6 bg-slate-50 hover:bg-indigo-50/30 border border-slate-100 hover:border-indigo-100 rounded-3xl transition-all cursor-pointer group"
                >
                  <img src="/depop.png" className="w-10 h-10 object-contain group-hover:scale-105 transition-transform" alt="" />
                  <span className="text-xs font-black text-slate-800 mt-3 block">Depop</span>
                </button>

                {/* Etsy */}
                <button 
                  onClick={() => setSelectedPlatform('etsy')}
                  className="flex flex-col items-center justify-center p-6 bg-slate-50 hover:bg-indigo-50/30 border border-slate-100 hover:border-indigo-100 rounded-3xl transition-all cursor-pointer group"
                >
                  <img src="/etsy.png" className="w-10 h-10 object-contain group-hover:scale-105 transition-transform" alt="" />
                  <span className="text-xs font-black text-slate-800 mt-3 block">Etsy</span>
                </button>

              </div>
            </div>
          ) : (
            /* Step 2: Render selected creation page inside modal container */
            <div className="bg-white rounded-3xl w-full max-w-[94vw] max-h-[94vh] overflow-y-auto relative p-6 pt-16 border border-[#e2e8f0] shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              
              {/* Back to selection */}
              <button 
                onClick={() => setSelectedPlatform('')}
                className="absolute top-4 left-6 z-[999] px-4.5 py-2 bg-slate-50 border border-slate-100 hover:bg-slate-100 text-xs font-black text-slate-650 rounded-2xl cursor-pointer flex items-center gap-1.5 transition-all"
              >
                ← Change Platform
              </button>

              {/* Close Modal */}
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="absolute top-4 right-6 z-[999] p-2 bg-slate-50 border border-slate-100 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-2xl cursor-pointer transition-all"
              >
                <X size={18} />
              </button>

              <div className="w-full">
                {selectedPlatform === 'ebay' && <CreateEbayListing isModal={true} onClose={() => setIsCreateModalOpen(false)} />}
                {selectedPlatform === 'ebay-bulk' && <BulkListingEbay />}
                {selectedPlatform === 'poshmark' && <CreatePoshmarkListing isModal={true} onClose={() => setIsCreateModalOpen(false)} />}
                {selectedPlatform === 'depop' && <CreateDepopListing isModal={true} onClose={() => setIsCreateModalOpen(false)} />}
                {selectedPlatform === 'etsy' && <CreateEtsyListing isModal={true} onClose={() => setIsCreateModalOpen(false)} />}
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
};

export default NewDashboardLayout;
