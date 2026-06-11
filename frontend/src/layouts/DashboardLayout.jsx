import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  List, 
  PlusCircle, 
  Settings, 
  Database, 
  CreditCard, 
  Link as LinkIcon,
  LogOut,
  Menu,
  X,
  Bell,
  Search,
  Users,
  ChevronDown,
  User,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { useAuth } from '../context/AuthContext';
import { getLandingUrl } from '../utils/urls';

const DashboardLayout = ({ isAdmin = false }) => {
  const { logout, user, loadUser } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const [isCreateDropdownOpen, setIsCreateDropdownOpen] = useState(
    location.pathname.startsWith('/create-')
  );
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef(null);
  
  const [openNestedMenus, setOpenNestedMenus] = useState({
    'eBay Listing': location.pathname.startsWith('/create-ebay')
  });

  const toggleNestedMenu = (name) => {
    setOpenNestedMenus(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  const handleLogout = () => {
    logout();
    window.location.href = getLandingUrl('/');
  };

  const toggleProfileDropdown = () => {
    if (!isProfileDropdownOpen) {
      loadUser().catch(console.error);
    }
    setIsProfileDropdownOpen(!isProfileDropdownOpen);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target)) {
        setIsProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const userMenuItems = [
    { name: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/dashboard' },
    { name: 'Listings', icon: <List size={20} />, path: '/listings' },
    { 
      name: 'Create Listing', 
      icon: <PlusCircle size={20} />, 
      subItems: [
        { 
          name: 'eBay Listing', 
          logo: '/ebay.png',
          nestedItems: [
            { name: 'Single Listing', path: '/create-ebay-listing' },
            { name: 'Bulk Listing', path: '/create-ebay-bulk-listing' }
          ]
        },
        { name: 'Poshmark Listing', path: '/create-poshmark-listing', logo: '/poshmark.png' },
        { name: 'Vinted Listing', path: '/create-vinted-listing', logo: '/vinted.jpg' },
        { name: 'Depop Listing', path: '/create-depop-listing', logo: '/depop.png' }
      ]
    },
    { name: 'Rules Engine', icon: <Database size={20} />, path: '/rules' },
    { name: 'Accounts', icon: <LinkIcon size={20} />, path: '/ebay-accounts' },
    { name: 'Subscription', icon: <CreditCard size={20} />, path: '/subscription' },
    { name: 'Settings', icon: <Settings size={20} />, path: '/settings' },
  ];

  const adminMenuItems = [
    { name: 'Admin Overview', icon: <LayoutDashboard size={20} />, path: '/admin' },
    { name: 'Manage Users', icon: <Users size={20} />, path: '/admin/users' },
    { name: 'System Settings', icon: <Settings size={20} />, path: '/admin/settings' },
  ];

  const menuItems = isAdmin ? adminMenuItems : userMenuItems;

  // Quota Calculations
  const usage = user?.usage || { listingsCount: 0, listingLimit: 0, aiFetchLimit: 10, daysLeft: 0 };
  const listingsCount = usage.listingsCount || 0;
  const listingLimit = usage.listingLimit || 0;
  const aiFetchLimit = usage.aiFetchLimit || 10;
  const daysLeft = usage.daysLeft || 0;

  const planName = user?.subscription?.plan || 'Free';
  const planStatus = user?.subscription?.status || 'Inactive';

  const listingPct = listingLimit > 0 ? Math.min(100, (listingsCount / listingLimit) * 100) : 0;
  const aiFetchPct = aiFetchLimit > 0 ? Math.min(100, (listingsCount / aiFetchLimit) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-slate-200 transition-all duration-300 ${
          isSidebarOpen ? 'w-64' : 'w-20'
        } hidden md:block`}
      >
        <div className="h-full flex flex-col">
          {/* Sidebar Header */}
          <div className={`p-6 flex items-center ${isSidebarOpen ? 'space-x-3' : 'justify-center'}`}>
            {isSidebarOpen ? (
              <a href={getLandingUrl('/')} className="flex items-center">
                <img src="/logo.png" alt="Elister.ai" className="h-8 w-auto object-contain" />
              </a>
            ) : (
              <a href={getLandingUrl('/')} className="flex items-center justify-center shrink-0">
                <img src="/icon.png" alt="Elister.ai" className="h-8 w-8 object-contain" />
              </a>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-grow px-3 space-y-1">
            {menuItems.map((item) => {
              if (item.subItems) {
                const isSubActive = item.subItems.some(sub => {
                  if (sub.nestedItems) {
                    return sub.nestedItems.some(n => location.pathname === n.path.split('?')[0]);
                  }
                  return location.pathname === sub.path.split('?')[0];
                });
                return (
                  <div key={item.name} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (!isSidebarOpen) {
                          setIsSidebarOpen(true);
                          setIsCreateDropdownOpen(true);
                        } else {
                          setIsCreateDropdownOpen(!isCreateDropdownOpen);
                        }
                      }}
                      className={`w-full flex items-center justify-between px-3 py-3 rounded-xl transition-all ${
                        isSubActive 
                          ? 'bg-indigo-50/50 text-indigo-600 font-semibold' 
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <span className={`${isSubActive ? 'text-indigo-600' : 'text-slate-400'}`}>
                          {item.icon}
                        </span>
                        {isSidebarOpen && <span className="truncate">{item.name}</span>}
                      </div>
                      {isSidebarOpen && (
                        <ChevronDown 
                          size={16} 
                          className={`text-slate-400 transition-transform duration-200 ${isCreateDropdownOpen ? 'rotate-180' : ''}`} 
                        />
                      )}
                    </button>
                    {isCreateDropdownOpen && isSidebarOpen && (
                      <div className="pl-9 space-y-1">
                        {item.subItems.map((sub) => {
                          if (sub.nestedItems) {
                            const isNestedActive = sub.nestedItems.some(n => location.pathname === n.path);
                            const isNestedOpen = !!openNestedMenus[sub.name];
                            return (
                              <div key={sub.name} className="space-y-1">
                                <button
                                  type="button"
                                  onClick={() => toggleNestedMenu(sub.name)}
                                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all ${
                                    isNestedActive
                                      ? 'bg-indigo-50/30 text-indigo-600 font-bold'
                                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                                  }`}
                                >
                                  <div className="flex items-center space-x-3">
                                    {sub.logo && (
                                      <img 
                                        src={sub.logo} 
                                        alt={sub.name} 
                                        className="w-4 h-4 object-contain rounded" 
                                      />
                                    )}
                                    <span>{sub.name}</span>
                                  </div>
                                  <ChevronDown 
                                    size={12} 
                                    className={`text-slate-400 transition-transform duration-200 ${isNestedOpen ? 'rotate-180' : ''}`} 
                                  />
                                </button>
                                {isNestedOpen && (
                                  <div className="pl-6 space-y-1 border-l border-slate-100 ml-4">
                                    {sub.nestedItems.map((nested) => {
                                      const isCurrentNestedActive = location.pathname === nested.path;
                                      return (
                                        <Link
                                          key={nested.name}
                                          to={nested.path}
                                          className={`flex items-center space-x-2.5 px-3 py-1.5 rounded-lg text-[10px] transition-all ${
                                            isCurrentNestedActive
                                              ? 'bg-indigo-50 text-indigo-600 font-bold'
                                              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                                          }`}
                                        >
                                          <span>{nested.name}</span>
                                        </Link>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          }

                          const isCurrentSubActive = location.pathname === sub.path;
                          return (
                            <Link
                              key={sub.name}
                              to={sub.path}
                              className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-xs transition-all ${
                                isCurrentSubActive
                                  ? 'bg-indigo-50 text-indigo-600 font-bold'
                                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                              }`}
                            >
                              {sub.logo && (
                                <img 
                                  src={sub.logo} 
                                  alt={sub.name} 
                                  className="w-4 h-4 object-contain rounded" 
                                />
                              )}
                              <span>{sub.name}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`flex items-center space-x-3 px-3 py-3 rounded-xl transition-all ${
                    isActive 
                      ? 'bg-indigo-50 text-indigo-600 font-semibold' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className={`${isActive ? 'text-indigo-600' : 'text-slate-400'}`}>
                    {item.icon}
                  </span>
                  {isSidebarOpen && <span className="truncate">{item.name}</span>}
                </Link>
              );
            })}
          </nav>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-slate-100">
            <button 
              onClick={handleLogout}
              className="w-full flex items-center space-x-3 px-3 py-3 rounded-xl text-slate-600 hover:bg-red-50 hover:text-red-600 transition-all"
            >
              <LogOut size={20} />
              {isSidebarOpen && <span>Logout</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`flex-grow flex flex-col transition-all duration-300 ${isSidebarOpen ? 'md:ml-64' : 'md:ml-20'}`}>
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-40">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 text-slate-500 hover:bg-slate-50 rounded-lg hidden md:block"
          >
            <Menu size={20} />
          </button>

          {/* Search Bar */}
          <div className="hidden sm:flex items-center bg-slate-100 rounded-xl px-3 py-1.5 w-64 md:w-96">
            <Search size={18} className="text-slate-400" />
            <input 
              type="text" 
              placeholder="Search listings..." 
              className="bg-transparent border-none outline-none px-2 text-sm w-full"
            />
          </div>

          {/* Right Header Icons */}
          <div className="flex items-center space-x-6">
            {/* eBay Connection Status Box */}
            <div className={`hidden lg:flex items-center gap-3 px-4 py-2 rounded-2xl border transition-all duration-500 ${
              user?.ebayAccount?.connected 
                ? 'bg-emerald-50 border-emerald-100 shadow-sm shadow-emerald-100/50' 
                : 'bg-rose-50 border-rose-100'
            }`}>
              <div className="relative">
                <div className={`w-2.5 h-2.5 rounded-full ${user?.ebayAccount?.connected ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                {user?.ebayAccount?.connected && (
                  <div className="absolute inset-0 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping opacity-75" />
                )}
              </div>
              <div className="flex flex-col">
                <span className={`text-[10px] font-bold truncate max-w-[120px] ${user?.ebayAccount?.connected ? 'text-slate-900' : 'text-slate-400'}`}>
                  {user?.ebayAccount?.connected 
                    ? user?.ebayAccount?.username || 'Connected'
                    : 'eBay Disconnected'}
                </span>
                <span className={`text-[8px] font-black uppercase tracking-[0.15em] ${user?.ebayAccount?.connected ? 'text-emerald-500' : 'text-rose-400'}`}>
                  {user?.ebayAccount?.connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>

            <button className="p-2 text-slate-500 hover:bg-slate-50 rounded-lg relative">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            
            {/* Profile Dropdown */}
            <div className="relative" ref={profileDropdownRef}>
              <button 
                onClick={toggleProfileDropdown}
                className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center border border-indigo-200 hover:border-indigo-400 focus:outline-none transition-all cursor-pointer overflow-hidden"
              >
                <span className="text-indigo-700 text-xs font-bold">
                  {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                </span>
              </button>

              <AnimatePresence>
                {isProfileDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-80 bg-white rounded-[2rem] border border-slate-150 shadow-2xl z-[999] overflow-hidden"
                  >
                    <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                          {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-slate-800 text-sm truncate">
                            {user?.firstName} {user?.lastName}
                          </h4>
                          <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-5 space-y-4">
                      {/* Plan & Days Left */}
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Active Plan</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                            planName.toLowerCase() === 'pro' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' :
                            planName.toLowerCase() === 'enterprise' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                            planName.toLowerCase() === 'basic' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                            'bg-slate-100 text-slate-650'
                          }`}>
                            {planName}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold ${
                            planStatus.toLowerCase() === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                          }`}>
                            {planStatus}
                          </span>
                        </div>
                      </div>

                      {planStatus.toLowerCase() === 'active' && (
                        <div className="bg-indigo-50/30 border border-indigo-50 p-3 rounded-2xl flex items-center justify-between">
                          <span className="text-[10px] font-bold text-indigo-900">Days Remaining:</span>
                          <span className="text-[11px] font-black text-indigo-600">
                            {daysLeft > 0 ? `${daysLeft} Days` : 'Expires Today'}
                          </span>
                        </div>
                      )}

                      {/* Quotas */}
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-bold text-slate-500">
                            <span>AI Listings Used</span>
                            <span>{listingsCount} / {listingLimit}</span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-indigo-500 rounded-full transition-all duration-500" 
                              style={{ width: `${listingPct}%` }}
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-bold text-slate-500">
                            <span>AI Fetches Used</span>
                            <span>{listingsCount} / {aiFetchLimit}</span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                              style={{ width: `${aiFetchPct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 p-2 bg-slate-50/50">
                      <Link 
                        to="/settings"
                        onClick={() => setIsProfileDropdownOpen(false)}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-650 hover:bg-white hover:text-indigo-600 transition-all cursor-pointer"
                      >
                        <User size={16} className="text-slate-400" />
                        Profile Settings
                      </Link>
                      <button 
                        onClick={() => {
                          setIsProfileDropdownOpen(false);
                          handleLogout();
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-all cursor-pointer text-left"
                      >
                        <LogOut size={16} />
                        Logout
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6 flex-grow">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
