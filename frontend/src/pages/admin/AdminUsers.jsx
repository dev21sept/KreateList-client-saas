import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Check, 
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
  CreditCard
} from 'lucide-react';
import { adminService } from '../../services/api';
import { useNotification } from '../../context/NotificationContext';

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
        ? 'text-amber-600 bg-amber-50 border-amber-100' 
        : 'text-emerald-600 bg-emerald-50 border-emerald-100'
    };
  };

  // Payment method display logic
  const getPaymentMethodDisplay = (user) => {
    const method = user.subscription?.paymentMethod;
    const plan = user.subscription?.plan;
    const status = user.subscription?.status;

    if (!plan || plan === 'free') {
      return { text: 'Free Tier', badgeColor: 'bg-slate-100 text-slate-600 border-slate-200' };
    }

    if (method === 'admin') {
      return { text: 'Admin Activation', badgeColor: 'bg-amber-50 text-amber-700 border-amber-200' };
    }

    if (method === 'razorpay') {
      return { text: 'Razorpay Gateway', badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    }

    if (method === 'stripe') {
      return { text: 'Stripe Gateway', badgeColor: 'bg-violet-50 text-violet-700 border-violet-200' };
    }

    // Legacy fallback for previously active test users
    if (status === 'active') {
      return { text: 'Razorpay (Legacy)', badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    }

    return { text: 'None', badgeColor: 'bg-slate-100 text-slate-500 border-slate-200' };
  };

  const handleRowClick = (userId) => {
    setExpandedUserId(expandedUserId === userId ? null : userId);
  };

  const handleEditClick = (user, e) => {
    e.stopPropagation();
    setEditingUser(user);
    setEditFormData({
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
        toast.success('Subscription updated successfully!');
        fetchUsers();
      }
    } catch (err) {
      console.error('Error saving user edits:', err);
      toast.error('Failed to update subscription. Please try again.');
    }
  };

  if (loading && users.length === 0) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
          <p className="text-slate-500">Monitor and manage all Elister.ai customers.</p>
        </div>
        <div className="flex space-x-2">
          <button 
            onClick={fetchUsers} 
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all"
          >
            Refresh Data
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl font-bold">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-grow w-full md:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search by name, email or ID..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/10"
          />
        </div>

        {/* Plan Filter */}
        <div className="flex items-center space-x-2 w-full md:w-auto">
          <Filter size={14} className="text-slate-400" />
          <select 
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-600 px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/10"
          >
            <option value="All">All Plans</option>
            <option value="free">Free</option>
            <option value="basic">Basic</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>

        {/* Status Filter */}
        <div className="flex items-center space-x-2 w-full md:w-auto">
          <Filter size={14} className="text-slate-400" />
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-600 px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/10"
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
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider"></th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">User</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Plan</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Subscription Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Days Left</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => {
                  const subInfo = getSubscriptionInfo(user);
                  const paymentInfo = getPaymentMethodDisplay(user);
                  const isExpanded = expandedUserId === user._id;

                  return (
                    <React.Fragment key={user._id}>
                      <tr 
                        onClick={() => handleRowClick(user._id)}
                        className="hover:bg-slate-50/50 cursor-pointer transition-all border-l-4 border-l-transparent hover:border-l-indigo-500"
                      >
                        <td className="px-4 py-4 text-center">
                          {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xs">
                              {`${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || 'U'}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 text-sm">{user.firstName} {user.lastName}</p>
                              <p className="text-xs text-slate-400 flex items-center"><Mail size={12} className="mr-1" /> {user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                            user.subscription?.plan === 'enterprise' ? 'bg-indigo-100 text-indigo-600' : 
                            user.subscription?.plan === 'pro' ? 'bg-violet-100 text-violet-600' : 
                            user.subscription?.plan === 'basic' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {(user.subscription?.plan || 'free').toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            {user.subscription?.status === 'active' ? (
                              <Check size={16} className="text-emerald-500 mr-2" />
                            ) : (
                              <X size={16} className="text-rose-500 mr-2" />
                            )}
                            <span className="text-sm font-medium text-slate-700">
                              {(user.subscription?.status || 'inactive').toUpperCase()}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-xs font-bold px-2 py-1 rounded-xl border ${subInfo.color}`}>
                            {subInfo.text}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button 
                            onClick={(e) => handleEditClick(user, e)}
                            className="p-2 bg-indigo-50 hover:bg-indigo-100 rounded-lg text-indigo-600 transition-all flex items-center justify-center"
                            title="Edit Plan"
                          >
                            <Edit2 size={14} />
                          </button>
                        </td>
                      </tr>

                      {/* Collapsible details row */}
                      {isExpanded && (
                        <tr className="bg-slate-50/70">
                          <td colSpan={6} className="px-8 py-6">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                              {/* Contact Details */}
                              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                                <div>
                                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">User Details</h4>
                                  <p className="text-xs text-slate-600 flex items-center mb-1.5">
                                    <Phone size={12} className="mr-2 text-slate-400" /> {user.phone || 'No phone number'}
                                  </p>
                                  <p className="text-xs text-slate-600 flex items-center mb-1.5">
                                    <Calendar size={12} className="mr-2 text-slate-400" /> Joined: {new Date(user.createdAt).toLocaleDateString()}
                                  </p>
                                  <p className="text-xs text-slate-600 flex items-center mb-1.5">
                                    <CreditCard size={12} className="mr-2 text-slate-400" /> Payment: <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold border ${paymentInfo.badgeColor}`}>{paymentInfo.text}</span>
                                  </p>
                                  {user.subscription?.plan !== 'free' && (
                                    <>
                                      <p className="text-xs text-slate-600 flex items-center mb-1.5 pl-5">
                                        Amount: <span className="font-bold text-slate-900 ml-1">${user.subscription?.paymentAmount || 0}</span>
                                      </p>
                                      {user.subscription?.paymentDate && (
                                        <p className="text-xs text-slate-600 flex items-center mb-1.5 pl-5">
                                          Paid At: <span className="text-slate-900 ml-1">{new Date(user.subscription.paymentDate).toLocaleString()}</span>
                                        </p>
                                      )}
                                      {user.subscription?.razorpayPaymentId && (
                                        <p className="text-xs text-slate-600 flex items-center mb-1.5 pl-5">
                                          Txn ID: <span className="font-mono text-slate-900 ml-1">{user.subscription.razorpayPaymentId}</span>
                                        </p>
                                      )}
                                      {user.subscription?.stripeSubscriptionId && (
                                        <p className="text-xs text-slate-600 flex items-center mb-1.5 pl-5">
                                          Stripe ID: <span className="font-mono text-slate-900 ml-1">{user.subscription.stripeSubscriptionId}</span>
                                        </p>
                                      )}
                                    </>
                                  )}
                                </div>
                                <div className="mt-4 pt-4 border-t border-slate-100 text-[10px] text-slate-400">
                                  ID: {user._id}
                                </div>
                              </div>

                              {/* Listing Stats / AI usage */}
                              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
                                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                                  <BarChart2 size={20} />
                                </div>
                                <div>
                                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">AI Fetched Listings</h4>
                                  <p className="text-xl font-black text-slate-900 mt-1">{user.stats?.total || 0}</p>
                                </div>
                              </div>

                              {/* Live Listings */}
                              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
                                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                                  <Check size={20} />
                                </div>
                                <div>
                                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Live via API</h4>
                                  <p className="text-xl font-black text-slate-900 mt-1">{user.stats?.published || 0}</p>
                                </div>
                              </div>

                              {/* Draft / Scheduled */}
                              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                                <div className="flex justify-between items-center">
                                  <span className="text-xs font-bold text-slate-500">Drafts:</span>
                                  <span className="text-sm font-black text-slate-900">{user.stats?.draft || 0}</span>
                                </div>
                                <div className="flex justify-between items-center mt-2">
                                  <span className="text-xs font-bold text-slate-500">Scheduled:</span>
                                  <span className="text-sm font-black text-slate-900">{user.stats?.scheduled || 0}</span>
                                </div>
                                <div className="flex justify-between items-center mt-2 border-t border-slate-100 pt-2">
                                  <span className="text-xs font-bold text-rose-500">Failed:</span>
                                  <span className="text-sm font-black text-rose-600">{user.stats?.failed || 0}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    No users found matching current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Subscription Modal */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden"
            >
              <div className="bg-slate-50 p-6 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">Edit Subscription</h3>
                  <p className="text-xs text-slate-500">{editingUser.firstName} {editingUser.lastName} ({editingUser.email})</p>
                </div>
                <button 
                  onClick={() => setEditingUser(null)}
                  className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
                {/* Plan selection */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Subscription Plan</label>
                  <select 
                    name="plan"
                    value={editFormData.plan}
                    onChange={handleFormChange}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 font-medium"
                  >
                    <option value="free">Free</option>
                    <option value="basic">Basic</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>

                {/* Status selection */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Subscription Status</label>
                  <select 
                    name="status"
                    value={editFormData.status}
                    onChange={handleFormChange}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 font-medium"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="canceled">Canceled</option>
                    <option value="past_due">Past Due</option>
                  </select>
                </div>

                {/* Expiry Date */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center">
                    <Clock size={12} className="mr-1" /> Expiration Date
                  </label>
                  <input 
                    type="date"
                    name="expiresAt"
                    value={editFormData.expiresAt}
                    onChange={handleFormChange}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 font-medium"
                  />
                </div>

                {/* Custom Payment Amount (only relevant if not Free) */}
                {editFormData.plan !== 'free' && (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Payment Amount (USD)</label>
                      <input 
                        type="number"
                        name="paymentAmount"
                        value={editFormData.paymentAmount}
                        onChange={handleFormChange}
                        placeholder="e.g. 149"
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 font-medium"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Payment Date</label>
                      <input 
                        type="date"
                        name="paymentDate"
                        value={editFormData.paymentDate}
                        onChange={handleFormChange}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 font-medium"
                      />
                    </div>
                  </>
                )}

                <div className="pt-4 flex space-x-2 justify-end">
                  <button 
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminUsers;
