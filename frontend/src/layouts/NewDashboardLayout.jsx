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

// Import creation page components directly to mount them in modal popup
import CreateEbayListing from '../pages/CreateEbayListing';
import BulkListingEbay from '../pages/BulkListingEbay';
import CreatePoshmarkListing from '../pages/CreatePoshmarkListing';
import CreateDepopListing from '../pages/CreateDepopListing';
import CreateVintedListing from '../pages/CreateVintedListing';

const NewDashboardLayout = () => {
  const { logout, user, loadUser } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isCreateDropdownOpen, setIsCreateDropdownOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const profileDropdownRef = useRef(null);
  const createDropdownRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

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
    if (path.includes('/orders')) return 'Orders';
    if (path.includes('/analytics')) return 'Analytics';
    if (path.includes('/subscription')) return 'Subscription';
    if (path.includes('/settings')) return 'Settings';
    if (path.includes('/integrations')) return 'Integrations';
    if (path.includes('/help')) return 'Help & Support';
    return 'Listings';
  };

  // Dynamic user data computations
  const usage = user?.usage || { listingsCount: 2456, listingLimit: 10000, aiFetchLimit: 500, daysLeft: 30 };
  const listingsCount = usage.listingsCount ?? 2456;
  const listingLimit = usage.listingLimit ?? 10000;
  const aiFetchLimit = usage.aiFetchLimit ?? 500;
  const daysLeft = usage.daysLeft ?? 30;
  
  const progressPct = listingLimit > 0 ? Math.min(100, Math.round((listingsCount / listingLimit) * 100)) : 0;
  const aiFetchPct = aiFetchLimit > 0 ? Math.min(100, Math.round((listingsCount / aiFetchLimit) * 100)) : 0;
  
  const firstName = user?.firstName || 'John';
  const lastName = user?.lastName || 'Doe';
  const planName = user?.subscription?.plan || 'Pro';
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
        className={`fixed inset-y-0 left-0 z-45 bg-white border-r border-[#f1f3f9] flex flex-col justify-between transition-all duration-300 ${
          isSidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full md:w-20 md:translate-x-0 overflow-hidden'
        }`}
      >
        <div className="flex flex-col flex-1">
          {/* Logo Section */}
          <div className="h-20 px-6 flex items-center gap-2.5 select-none border-b border-[#fbfcfe]">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-200">
              {/* Rocket icon mimicking logo */}
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4.5 16.5c-1.5 1.25-2.5 3.5-2.5 3.5s2.25-1 3.5-2.5L16.5 6.5c1.5-1.5 1.5-4 0-5.5s-4-1.5-5.5 0L4.5 16.5z" />
                <path d="M12 12l9 9" />
                <path d="M16 16l4 4" />
              </svg>
            </div>
            {isSidebarOpen && (
              <span className="text-xl font-extrabold text-[#111827] tracking-tight">
                elister<span className="text-indigo-600 font-semibold">.ai</span>
              </span>
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

        {/* Pro Plan Quota Card */}
        {isSidebarOpen && (
          <div className="p-4 border-t border-[#f1f3f9] bg-white">
            <div className="bg-[#fcfcff] border border-[#f3f4f6] rounded-2xl p-4 space-y-3.5 shadow-sm">
              <div className="flex justify-between items-center">
                <span className="text-sm font-extrabold text-[#111827]">{planName} Plan</span>
                <span className="bg-emerald-50 text-emerald-600 text-[10px] font-extrabold px-2 py-0.5 rounded-full capitalize">
                  {planStatus}
                </span>
              </div>
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-400">Listings Used</span>
                <div className="flex justify-between text-xs font-bold text-[#111827]">
                  <span>{listingsCount.toLocaleString()} / {listingLimit.toLocaleString()}</span>
                  <span className="text-indigo-600">{progressPct}%</span>
                </div>
                <div className="w-full bg-[#f1f3f9] rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500" 
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
              <button 
                onClick={() => navigate('/subscription')}
                className="w-full py-2 bg-white border border-[#e5e7eb] hover:bg-[#fafbfe] text-xs font-bold text-[#111827] rounded-xl transition-all shadow-sm cursor-pointer"
              >
                Manage Plan
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* MAIN VIEW CONTENT CONTAINER */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${isSidebarOpen ? 'md:ml-64' : 'md:ml-20'}`}>
        
        {/* TOP HEADER */}
        <header className="h-20 bg-white border-b border-[#f1f3f9] flex items-center justify-between px-8 sticky top-0 z-40">
          
          {/* Left Side: Page Title and Search */}
          <div className="flex items-center gap-6 flex-1">
            <span className="text-2xl font-extrabold text-[#111827] select-none tracking-tight shrink-0">
              {getPageTitle()}
            </span>

            {/* Global Search Bar */}
            <div className="hidden lg:flex items-center bg-[#f3f4f6] rounded-2xl px-4 py-2 w-96 relative border border-transparent focus-within:border-indigo-150 focus-within:bg-white transition-all">
              <Search size={18} className="text-slate-400" />
              <input 
                type="text" 
                placeholder="Search by title, SKU, or barcode..." 
                className="bg-transparent border-none outline-none px-2.5 text-xs font-bold text-slate-650 w-full placeholder:text-slate-400"
              />
              <span className="absolute right-3.5 px-2 py-0.5 bg-white border border-[#e5e7eb] rounded-lg text-[9px] font-black text-slate-400 select-none shadow-sm">
                ⌘ K
              </span>
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
            <button className="p-2.5 hover:bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-2xl relative transition-all border border-[#f3f4f6]">
              <Bell size={18} />
              <span className="absolute top-2 right-2 w-4 h-4 bg-rose-500 rounded-full border-2 border-white text-[9px] font-black text-white flex items-center justify-center">
                8
              </span>
            </button>

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
                          <span className="font-extrabold text-slate-800">{listingsCount.toLocaleString()} / {aiFetchLimit.toLocaleString()}</span>
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

              <div className="grid grid-cols-2 gap-4">
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

                {/* Vinted */}
                <button 
                  onClick={() => setSelectedPlatform('vinted')}
                  className="col-span-2 flex items-center justify-center gap-4 p-5 bg-slate-50 hover:bg-indigo-50/30 border border-slate-100 hover:border-indigo-100 rounded-3xl transition-all cursor-pointer group"
                >
                  <img src="/vinted.jpg" className="w-8 h-8 object-contain rounded group-hover:scale-105 transition-transform" alt="" />
                  <span className="text-xs font-black text-slate-800 block">Vinted Listing</span>
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
                {selectedPlatform === 'ebay' && <CreateEbayListing />}
                {selectedPlatform === 'ebay-bulk' && <BulkListingEbay />}
                {selectedPlatform === 'poshmark' && <CreatePoshmarkListing />}
                {selectedPlatform === 'depop' && <CreateDepopListing />}
                {selectedPlatform === 'vinted' && <CreateVintedListing />}
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
};

export default NewDashboardLayout;
