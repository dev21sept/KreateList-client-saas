import React, { useState } from 'react';
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
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { useAuth } from '../context/AuthContext';

const DashboardLayout = ({ isAdmin = false }) => {
  const { logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userMenuItems = [
    { name: 'Dashboard', icon: <LayoutDashboard size={20} />, path: '/dashboard' },
    { name: 'Listings', icon: <List size={20} />, path: '/listings' },
    { name: 'Create Listing', icon: <PlusCircle size={20} />, path: '/create-listing' },
    { name: 'Rules Engine', icon: <Database size={20} />, path: '/rules' },
    { name: 'eBay Accounts', icon: <LinkIcon size={20} />, path: '/ebay-accounts' },
    { name: 'Subscription', icon: <CreditCard size={20} />, path: '/subscription' },
    { name: 'Settings', icon: <Settings size={20} />, path: '/settings' },
  ];

  const adminMenuItems = [
    { name: 'Admin Overview', icon: <LayoutDashboard size={20} />, path: '/admin' },
    { name: 'Manage Users', icon: <Users size={20} />, path: '/admin/users' },
    { name: 'System Settings', icon: <Settings size={20} />, path: '/admin/settings' },
  ];

  const menuItems = isAdmin ? adminMenuItems : userMenuItems;

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
              <Link to="/" className="flex items-center">
                <img src="/logo.png" alt="Elister.ai" className="h-8 w-auto object-contain" />
              </Link>
            ) : (
              <Link to="/" className="flex items-center justify-center shrink-0">
                <img src="/icon.png" alt="Elister.ai" className="h-8 w-8 object-contain" />
              </Link>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-grow px-3 space-y-1">
            {menuItems.map((item) => {
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
              useAuth().user?.ebayAccount?.connected 
                ? 'bg-emerald-50 border-emerald-100 shadow-sm shadow-emerald-100/50' 
                : 'bg-rose-50 border-rose-100'
            }`}>
              <div className="relative">
                <div className={`w-2.5 h-2.5 rounded-full ${useAuth().user?.ebayAccount?.connected ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                {useAuth().user?.ebayAccount?.connected && (
                  <div className="absolute inset-0 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping opacity-75" />
                )}
              </div>
              <div className="flex flex-col">
                <span className={`text-[8px] font-black uppercase tracking-[0.15em] ${useAuth().user?.ebayAccount?.connected ? 'text-emerald-500' : 'text-rose-400'}`}>
                  {useAuth().user?.ebayAccount?.connected ? 'Production Live' : 'Marketplace Offline'}
                </span>
                <span className={`text-[10px] font-bold truncate max-w-[120px] ${useAuth().user?.ebayAccount?.connected ? 'text-emerald-900' : 'text-rose-600'}`}>
                  {useAuth().user?.ebayAccount?.connected 
                    ? useAuth().user?.ebayAccount?.username || 'Connected'
                    : 'Disconnected'}
                </span>
              </div>
            </div>

            <button className="p-2 text-slate-500 hover:bg-slate-50 rounded-lg relative">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center border border-indigo-200">
              <span className="text-indigo-700 text-xs font-bold">
                {useAuth().user?.firstName?.charAt(0)}{useAuth().user?.lastName?.charAt(0)}
              </span>
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
