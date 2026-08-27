import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Check,
  CheckCircle,
  X,
  Mail,
  Calendar,
  Filter,
  ChevronDown,
  ChevronUp,
  Edit2,
  Phone,
  BarChart2,
  Clock,
  ShieldAlert,
  CreditCard,
  RefreshCw,
  Users,
  Activity,
  PlusCircle,
  FileText
} from 'lucide-react';
import { adminService } from '../../services/api';
import { useNotification } from '../../context/NotificationContext';
import Button from '../../components/ui/Button';
import IconButton from '../../components/ui/IconButton';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { LoadingState } from '../../components/ui/LoadingState';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/ui/Modal';

const AdminUsers = () => {
  const { toast } = useNotification();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Search and Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [planFilter, setPlanFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Collapsible state
  const [expandedUserId, setExpandedUserId] = useState(null);

  // Modal Edit state
  const [editingUser, setEditingUser] = useState(null);
  const [editFormData, setEditFormData] = useState({
    email: '',
    plan: 'free',
    status: 'inactive',
    expiresAt: '',
    paymentAmount: 0,
    paymentDate: ''
  });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await adminService.getUsers();
      if (res.data?.success) {
        setUsers(res.data.data);
        setFilteredUsers(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching admin users:', err);
      setError('Failed to fetch user accounts. Please check server connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Filter users based on search, plan and status
  useEffect(() => {
    let result = users;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(user =>
        (user.firstName && user.firstName.toLowerCase().includes(term)) ||
        (user.lastName && user.lastName.toLowerCase().includes(term)) ||
        (user.email && user.email.toLowerCase().includes(term)) ||
        (user._id && user._id.toLowerCase().includes(term))
      );
    }

    if (planFilter !== 'All') {
      result = result.filter(user =>
        user.subscription?.plan?.toLowerCase() === planFilter.toLowerCase()
      );
    }

    if (statusFilter !== 'All') {
      result = result.filter(user =>
        user.subscription?.status?.toLowerCase() === statusFilter.toLowerCase()
      );
    }

    setFilteredUsers(result);
  }, [searchTerm, planFilter, statusFilter, users]);

  // Dynamic user lists calculations
  const quickStats = useMemo(() => {
    const total = users.length;
    const premium = users.filter(u => u.subscription?.status === 'active' && u.subscription?.plan !== 'free').length;
    const active = users.filter(u => u.subscription?.status === 'active').length;
    const canceling = users.filter(u => u.subscription?.status === 'canceled').length;

    return { total, premium, active, canceling };
  }, [users]);

  // Days remaining logic
  const getSubscriptionInfo = (user) => {
    const sub = user.subscription;
    if (!sub || sub.plan === 'free') {
      return { text: 'Unlimited', color: 'text-slate-500 bg-slate-50 border-slate-100' };
    }

    if (sub.status !== 'active') {
      return { text: sub.status?.toUpperCase() || 'INACTIVE', color: 'text-rose-500 bg-rose-50 border-rose-100' };
    }

    if (!sub.expiresAt) {
      return { text: 'Active (No Expiry)', color: 'text-emerald-600 bg-emerald-50 border-emerald-100' };
    }

    const expiry = new Date(sub.expiresAt);
    const today = new Date();
    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return { text: 'Expired', color: 'text-rose-500 bg-rose-50 border-rose-100' };
    }

    return {
      text: `${diffDays} days left`,
      color: diffDays <= 5
        ? 'text-amber-600 bg-amber-50 border-amber-100 animate-pulse'
        : 'text-emerald-600 bg-emerald-50 border-emerald-100'
    };
  };

  // Payment method display logic
  const getPaymentMethodDisplay = (user) => {
    const method = user.subscription?.paymentMethod;
    const plan = user.subscription?.plan;
    const status = user.subscription?.status;

    if (!plan || plan === 'free') {
      return { text: 'Free Tier', badgeColor: 'bg-slate-500/10 text-slate-500 border-slate-200/50' };
    }

    if (method === 'admin') {
      return { text: 'Admin Override', badgeColor: 'bg-amber-500/10 text-amber-500 border-amber-500/20' };
    }

    if (method === 'razorpay') {
      return { text: 'Razorpay API', badgeColor: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' };
    }

    if (method === 'stripe') {
      return { text: 'Stripe Direct', badgeColor: 'bg-violet-500/10 text-violet-500 border-violet-500/20' };
    }

    if (status === 'active') {
      return { text: 'Razorpay Gateway', badgeColor: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' };
    }

    return { text: 'Unspecified', badgeColor: 'bg-slate-500/10 text-slate-400 border-slate-200/50' };
  };

  // Visual variant for plan tier badges (Badge component drop-in)
  const getPlanBadgeVariant = (plan) => {
    const key = String(plan || 'free').toLowerCase();
    if (key === 'enterprise') return 'success';
    if (key === 'pro') return 'brand';
    if (key === 'basic') return 'info';
    return 'neutral';
  };

  const handleRowClick = (userId) => {
    setExpandedUserId(expandedUserId === userId ? null : userId);
  };

  const handleEditClick = (user, e) => {
    e.stopPropagation();
    setEditingUser(user);
    setEditFormData({
      email: user.email || '',
      plan: user.subscription?.plan || 'free',
      status: user.subscription?.status || 'inactive',
      expiresAt: user.subscription?.expiresAt ? new Date(user.subscription.expiresAt).toISOString().split('T')[0] : '',
      paymentAmount: user.subscription?.paymentAmount || 0,
      paymentDate: user.subscription?.paymentDate ? new Date(user.subscription.paymentDate).toISOString().split('T')[0] : ''
    });
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      const updateData = {
        email: editFormData.email,
        subscription: {
          plan: editFormData.plan,
          status: editFormData.status,
          expiresAt: editFormData.expiresAt ? new Date(editFormData.expiresAt) : null,
          paymentAmount: Number(editFormData.paymentAmount || 0),
          paymentDate: editFormData.paymentDate ? new Date(editFormData.paymentDate) : null
        }
      };
      const res = await adminService.updateUser(editingUser._id, updateData);
      if (res.data?.success) {
        setEditingUser(null);
        toast.success('User details updated successfully!');
        fetchUsers();
      }
    } catch (err) {
      console.error('Error saving user edits:', err);
      toast.error(err.response?.data?.message || 'Failed to update user details. Please try again.');
    }
  };

  // Shared expanded-detail content (used by both the desktop table row and the mobile card)
  const renderExpandedDetails = (user) => {
    const paymentInfo = getPaymentMethodDisplay(user);
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Contact Details Card */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="space-y-3">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-2">User details</h4>
            <p className="text-xs text-slate-700 flex items-center font-bold">
              <Phone size={12} className="mr-2.5 text-slate-400 shrink-0" />
              {user.phone || 'No phone registered'}
            </p>
            <p className="text-xs text-slate-700 flex items-center font-bold">
              <Calendar size={12} className="mr-2.5 text-slate-400 shrink-0" />
              Registered: {new Date(user.createdAt).toLocaleDateString()}
            </p>
            <p className="text-xs text-slate-700 flex items-center font-bold">
              <CreditCard size={12} className="mr-2.5 text-slate-400 shrink-0" />
              Gateway:
              <span className={`ml-2 px-2 py-0.5 rounded-lg text-[9px] font-extrabold uppercase border ${paymentInfo.badgeColor}`}>
                {paymentInfo.text}
              </span>
            </p>
            {user.subscription?.plan !== 'free' && (
              <div className="space-y-1.5 pt-2 border-t border-slate-50">
                <p className="text-xs text-slate-600 flex justify-between font-bold">
                  <span>Amount Paid:</span>
                  <span className="font-extrabold text-slate-900">${user.subscription?.paymentAmount || 0}</span>
                </p>
                {user.subscription?.paymentDate && (
                  <p className="text-[10px] text-slate-400 flex justify-between font-bold">
                    <span>Paid At:</span>
                    <span className="text-slate-700">{new Date(user.subscription.paymentDate).toLocaleDateString()}</span>
                  </p>
                )}
                {user.subscription?.stripeSubscriptionId && (
                  <p className="text-[9px] text-slate-400 flex justify-between font-mono font-bold">
                    <span>Stripe ID:</span>
                    <span className="text-slate-800 bg-slate-50 px-1 border border-slate-100 rounded max-w-[120px] truncate">{user.subscription.stripeSubscriptionId}</span>
                  </p>
                )}
                {user.subscription?.razorpayPaymentId && (
                  <p className="text-[9px] text-slate-400 flex justify-between font-mono font-bold">
                    <span>Razorpay ID:</span>
                    <span className="text-slate-800 bg-slate-50 px-1 border border-slate-100 rounded max-w-[120px] truncate">{user.subscription.razorpayPaymentId}</span>
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-[9px] font-mono text-slate-400 truncate">
            DB REF: {user._id}
          </div>
        </div>

        {/* AI Listing Fetches stats card */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100 shadow-inner shrink-0">
            <BarChart2 size={22} />
          </div>
          <div>
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AI Listing Imports</h4>
            <p className="text-2xl font-black text-slate-900 mt-1 tracking-tight">{user.stats?.total || 0}</p>
          </div>
        </div>

        {/* Live listings counts card */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 shadow-inner shrink-0">
            <Check size={22} />
          </div>
          <div>
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Live Listings</h4>
            <p className="text-2xl font-black text-slate-900 mt-1 tracking-tight">{user.stats?.published || 0}</p>
          </div>
        </div>

        {/* Listings status summary */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-2 mb-2">Listing distribution</h4>
          <div className="space-y-2.5">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-slate-500">Draft Listings:</span>
              <span className="text-slate-800 font-mono">{user.stats?.draft || 0}</span>
            </div>
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-slate-500">Scheduled:</span>
              <span className="text-slate-800 font-mono">{user.stats?.scheduled || 0}</span>
            </div>
            <div className="flex justify-between items-center text-xs font-bold pt-2 border-t border-slate-50">
              <span className="text-rose-500">Failed / Errors:</span>
              <span className="text-rose-600 font-mono font-black">{user.stats?.failed || 0}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading && users.length === 0) {
    return <LoadingState label="Loading user accounts..." />;
  }

  return (
    <div className="space-y-6">

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/20 rounded-full -mr-32 -mt-32 blur-2xl" />
        <div className="relative">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">User Management</h1>
          <p className="text-slate-500 font-medium text-xs mt-1">Control billing status, adjust subscription tiers, and review client details.</p>
        </div>
        <div className="relative">
          <Button
            onClick={fetchUsers}
            disabled={loading}
            loading={loading}
            icon={!loading && <RefreshCw size={14} />}
          >
            Sync Users
          </Button>
        </div>
      </div>

      {/* Aggregate Counts Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Total users */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shrink-0">
            <Users size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Registered</p>
            <p className="text-xl font-black text-slate-900 leading-tight truncate">{quickStats.total} accounts</p>
          </div>
        </div>

        {/* Premium Users */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shrink-0">
            <Activity size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Active Premium</p>
            <p className="text-xl font-black text-slate-900 leading-tight truncate">{quickStats.premium} active</p>
          </div>
        </div>

        {/* Active Accounts */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100 shrink-0">
            <CheckCircle size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Total Active</p>
            <p className="text-xl font-black text-slate-900 leading-tight truncate">{quickStats.active} accounts</p>
          </div>
        </div>

        {/* Canceled Accounts */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 shrink-0">
            <X size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Canceled</p>
            <p className="text-xl font-black text-slate-900 leading-tight truncate">{quickStats.canceling} accounts</p>
          </div>
        </div>

      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl font-bold flex items-center gap-2 text-sm">
          <ShieldAlert size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filters Container */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col lg:flex-row items-center gap-4">

        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search accounts by name, email or database ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-100 focus:bg-white rounded-2xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400"
          />
        </div>

        {/* Plan Filter */}
        <div className="flex items-center gap-2 w-full lg:w-auto shrink-0">
          <Filter size={14} className="text-slate-400 shrink-0" />
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="bg-slate-50 border border-slate-100 rounded-2xl text-xs font-extrabold text-slate-600 px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 cursor-pointer transition-all w-full lg:w-auto"
          >
            <option value="All">All Tiers</option>
            <option value="free">Free Plan</option>
            <option value="basic">Basic Plan</option>
            <option value="pro">Pro Plan</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2 w-full lg:w-auto shrink-0">
          <Filter size={14} className="text-slate-400 shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-100 rounded-2xl text-xs font-extrabold text-slate-600 px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 cursor-pointer transition-all w-full lg:w-auto"
          >
            <option value="All">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="canceled">Canceled</option>
          </select>
        </div>

      </div>

      {/* Users Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {filteredUsers.length === 0 ? (
          <EmptyState
            icon={<Users size={20} />}
            title="No matching user registrations found"
            description="Try adjusting your search or filters to see more results."
          />
        ) : (
          <>
            {/* MOBILE CARD VIEW */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredUsers.map((user) => {
                const subInfo = getSubscriptionInfo(user);
                const isExpanded = expandedUserId === user._id;
                return (
                  <div key={user._id} className="p-4 space-y-3">
                    <div
                      className="flex items-start gap-3 cursor-pointer"
                      onClick={() => handleRowClick(user._id)}
                    >
                      <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-800 text-white rounded-full flex items-center justify-center font-black text-xs shadow-sm shrink-0">
                        {`${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-extrabold text-slate-900 text-sm truncate">{user.firstName} {user.lastName}</p>
                        <p className="text-[11px] text-slate-400 flex items-center mt-0.5 font-medium truncate">
                          <Mail size={11} className="mr-1 text-slate-400 shrink-0" />
                          {user.email}
                        </p>
                      </div>
                      {isExpanded ? (
                        <ChevronUp size={16} className="text-indigo-600 shrink-0 mt-1.5" />
                      ) : (
                        <ChevronDown size={16} className="text-slate-400 shrink-0 mt-1.5" />
                      )}
                    </div>

                    <div className="flex items-center flex-wrap gap-2">
                      <Badge variant={getPlanBadgeVariant(user.subscription?.plan)}>
                        {user.subscription?.plan || 'free'}
                      </Badge>
                      <StatusBadge status={user.subscription?.status || 'inactive'} />
                      <span className={`text-[9px] font-black px-2.5 py-1 rounded-full border uppercase tracking-wider ${subInfo.color}`}>
                        {subInfo.text}
                      </span>
                    </div>

                    <div className="flex justify-end">
                      <IconButton
                        aria-label="Edit Plan"
                        variant="active"
                        onClick={(e) => handleEditClick(user, e)}
                      >
                        <Edit2 size={14} />
                      </IconButton>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden pt-1"
                        >
                          {renderExpandedDetails(user)}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>

            {/* DESKTOP TABLE VIEW */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-100">
                    <th className="w-12 px-6 py-4"></th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">User Account</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Tier Level</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Billing Status</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Time Remaining</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right pr-8">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredUsers.map((user) => {
                    const subInfo = getSubscriptionInfo(user);
                    const isExpanded = expandedUserId === user._id;

                    return (
                      <React.Fragment key={user._id}>
                        <tr
                          onClick={() => handleRowClick(user._id)}
                          className={`hover:bg-slate-50/60 cursor-pointer transition-all border-l-4 ${
                            isExpanded ? 'border-l-indigo-600 bg-indigo-50/10' : 'border-l-transparent'
                          }`}
                        >
                          <td className="px-4 py-4 text-center">
                            {isExpanded ? (
                              <ChevronUp size={16} className="text-indigo-600 transition-transform" />
                            ) : (
                              <ChevronDown size={16} className="text-slate-400 transition-transform" />
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3.5">
                              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-800 text-white rounded-full flex items-center justify-center font-black text-xs shadow-sm shrink-0">
                                {`${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || 'U'}
                              </div>
                              <div className="min-w-0">
                                <p className="font-extrabold text-slate-900 text-xs truncate">{user.firstName} {user.lastName}</p>
                                <p className="text-[11px] text-slate-400 flex items-center mt-0.5 font-medium truncate">
                                  <Mail size={12} className="mr-1 text-slate-400 shrink-0" />
                                  {user.email}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant={getPlanBadgeVariant(user.subscription?.plan)}>
                              {user.subscription?.plan || 'free'}
                            </Badge>
                          </td>
                          <td className="px-6 py-4">
                            <StatusBadge status={user.subscription?.status || 'inactive'} />
                          </td>
                          <td className="px-6 py-4">
                            <span className={`text-[10px] font-black px-3 py-1 rounded-xl border uppercase tracking-wider ${subInfo.color}`}>
                              {subInfo.text}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right pr-8">
                            <IconButton
                              aria-label="Edit Plan"
                              variant="active"
                              onClick={(e) => handleEditClick(user, e)}
                            >
                              <Edit2 size={14} />
                            </IconButton>
                          </td>
                        </tr>

                        {/* Collapsible Details Drawer */}
                        <AnimatePresence>
                          {isExpanded && (
                            <tr className="bg-slate-50/30">
                              <td colSpan={6} className="px-8 py-6">
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="overflow-hidden"
                                >
                                  {renderExpandedDetails(user)}
                                </motion.div>
                              </td>
                            </tr>
                          )}
                        </AnimatePresence>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Edit Subscription Modal */}
      <Modal open={!!editingUser} onClose={() => setEditingUser(null)} size="sm">
        {editingUser && (
          <>
            {/* Modal Header */}
            <div className="p-6 pb-4 border-b border-slate-100 flex justify-between items-center">
              <div className="min-w-0">
                <h3 className="font-black text-slate-900 text-lg">Modify Subscription</h3>
                <p className="text-xs text-slate-400 font-semibold mt-0.5 truncate">{editingUser.firstName} {editingUser.lastName} ({editingUser.email})</p>
              </div>
              <IconButton aria-label="Close" onClick={() => setEditingUser(null)} className="shrink-0">
                <X size={18} />
              </IconButton>
            </div>

            {/* Form fields */}
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">

              {/* User Email */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">User Email</label>
                <input
                  type="email"
                  name="email"
                  required
                  value={editFormData.email || ''}
                  onChange={handleFormChange}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                />
              </div>

              {/* Subscription Tier */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Subscription Tier</label>
                <select
                  name="plan"
                  value={editFormData.plan}
                  onChange={handleFormChange}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 cursor-pointer transition-all"
                >
                  <option value="free">Free Tier</option>
                  <option value="basic">Basic Plan</option>
                  <option value="pro">Pro Plan</option>
                  <option value="enterprise">Enterprise Plan</option>
                </select>
              </div>

              {/* Status Selection */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Billing Status</label>
                <select
                  name="status"
                  value={editFormData.status}
                  onChange={handleFormChange}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 cursor-pointer transition-all"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="canceled">Canceled</option>
                  <option value="past_due">Past Due</option>
                </select>
              </div>

              {/* Expiry Date */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center">
                  <Clock size={12} className="mr-1.5 text-slate-400" /> Account Expiration
                </label>
                <input
                  type="date"
                  name="expiresAt"
                  value={editFormData.expiresAt}
                  onChange={handleFormChange}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                />
              </div>

              {/* Custom Payment Metrics */}
              {editFormData.plan !== 'free' && (
                <div className="pt-2.5 border-t border-slate-100 space-y-4">

                  {/* Amount */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Payment Amount ($ USD)</label>
                    <input
                      type="number"
                      name="paymentAmount"
                      value={editFormData.paymentAmount}
                      onChange={handleFormChange}
                      placeholder="e.g. 149"
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                    />
                  </div>

                  {/* Date */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Payment Transaction Date</label>
                    <input
                      type="date"
                      name="paymentDate"
                      value={editFormData.paymentDate}
                      onChange={handleFormChange}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                    />
                  </div>

                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex gap-3 justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setEditingUser(null)}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  Apply Settings
                </Button>
              </div>

            </form>
          </>
        )}
      </Modal>
    </div>
  );
};

export default AdminUsers;
