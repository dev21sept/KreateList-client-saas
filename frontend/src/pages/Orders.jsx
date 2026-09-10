import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  ChevronDown,
  ShoppingBag,
  DollarSign,
  CheckCircle2,
  Clock,
  RefreshCw,
  Trash2,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  SlidersHorizontal,
  Package,
  Copy
} from 'lucide-react';
import { orderService } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import Button from '../components/ui/Button';
import IconButton from '../components/ui/IconButton';
import StatCard from '../components/ui/StatCard';
import EmptyState from '../components/ui/EmptyState';
import { LoadingState } from '../components/ui/LoadingState';
import { Badge } from '../components/ui/Badge';
import { useReducedMotion } from '../hooks/useReducedMotion';

const Orders = () => {
  const navigate = useNavigate();
  const { toast } = useNotification();
  const reducedMotion = useReducedMotion();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [relistingId, setRelistingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activePlatform, setActivePlatform] = useState('all');
  const [activeStatus, setActiveStatus] = useState('all');
  const [error, setError] = useState(null);

  // Fetch sales/orders on component mount
  const fetchSales = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await orderService.getAll();
      if (res?.data?.success) {
        setSales(res.data.data || []);
      } else {
        setError('Failed to fetch sales data');
      }
    } catch (err) {
      console.error('Error fetching sales:', err);
      setError(err.response?.data?.message || err.message || 'An error occurred while fetching sales');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, []);

  // Sync Sales trigger
  const handleSync = async () => {
    try {
      setSyncing(true);
      setError(null);
      const res = await orderService.sync();
      if (res?.data?.success) {
        setSales(res.data.data || []);
      } else {
        setError('Sync completed with warnings');
      }
    } catch (err) {
      console.error('Error syncing sales:', err);
      setError(err.response?.data?.message || err.message || 'An error occurred while syncing');
    } finally {
      setSyncing(false);
    }
  };

  // Delete an order
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this sale record?')) return;
    try {
      const res = await orderService.delete(id);
      if (res?.data?.success) {
        setSales(prev => prev.filter(sale => sale._id !== id));
      }
    } catch (err) {
      console.error('Error deleting sale:', err);
      alert('Failed to delete sale record');
    }
  };

  // Relist an order item to Local Database
  const handleRelist = async (id) => {
    try {
      setRelistingId(id);
      const res = await orderService.relist(id);
      if (res?.data?.success) {
        if (toast) {
          toast.success('Item successfully imported to Local Database drafts! You can now edit and publish it across all platforms.');
        } else {
          alert('Item successfully imported to Local Database drafts!');
        }
      } else {
        if (toast) {
          toast.error(res?.data?.message || 'Failed to relist order');
        } else {
          alert(res?.data?.message || 'Failed to relist order');
        }
      }
    } catch (err) {
      console.error('Error relisting order:', err);
      if (toast) {
        toast.error(err.response?.data?.message || 'Failed to relist order');
      } else {
        alert(err.response?.data?.message || 'Failed to relist order');
      }
    } finally {
      setRelistingId(null);
    }
  };

  // Update status (simulate shipping or delivery)
  const handleUpdateStatus = async (id, currentStatus) => {
    const nextStatusMap = {
      'Pending': 'Shipped',
      'Shipped': 'Delivered',
      'Delivered': 'Pending'
    };
    const nextStatus = nextStatusMap[currentStatus] || 'Pending';
    try {
      const res = await orderService.update(id, { status: nextStatus });
      if (res?.data?.success) {
        setSales(prev => prev.map(sale => sale._id === id ? { ...sale, status: nextStatus } : sale));
      }
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Failed to update status');
    }
  };

  // Helper for platform logo
  const getPlatformLogo = (platform) => {
    const p = String(platform || '').toLowerCase();
    switch (p) {
      case 'ebay': return '/ebay.png';
      case 'depop': return '/depop.png';
      case 'poshmark': return '/poshmark.png';
      case 'etsy': return '/etsy.png';
      case 'mercari': return '/mercari.png';
      default: return '/logo.png';
    }
  };

  // Helper for status badge variant
  const getStatusVariant = (status) => {
    const s = String(status || '').toLowerCase();
    switch (s) {
      case 'delivered':
      case 'completed': return 'success';
      case 'shipped': return 'info';
      case 'pending':
      case 'in progress':
      case 'in_progress':
      case 'trading': return 'warning';
      case 'cancelled': return 'danger';
      default: return 'neutral';
    }
  };

  // Helper for formatting Order dates accurately
  const formatOrderDate = (dateVal) => {
    if (!dateVal) return 'N/A';
    let d;
    if (typeof dateVal === 'number') {
      d = dateVal < 1e11 ? new Date(dateVal * 1000) : new Date(dateVal);
    } else {
      d = new Date(dateVal);
    }
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Filter & Search Logic
  const filteredSales = sales.filter(sale => {
    const matchesSearch =
      sale.orderId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.buyerUsername?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.lineItems?.some(li => li.title?.toLowerCase().includes(searchTerm.toLowerCase()) || li.sku?.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesPlatform = activePlatform === 'all' || sale.platform?.toLowerCase() === activePlatform.toLowerCase();
    const matchesStatus = activeStatus === 'all' || sale.status?.toLowerCase() === activeStatus.toLowerCase();

    return matchesSearch && matchesPlatform && matchesStatus;
  });

  // Stats calculation
  const totalRevenue = filteredSales.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
  const pendingShipment = filteredSales.filter(sale => {
    const s = String(sale.status || '').toLowerCase();
    return s === 'pending' || s === 'in progress' || s === 'in_progress' || s === 'trading';
  }).length;

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Orders</h1>
          <p className="text-slate-400 text-xs mt-1 font-semibold">Track and manage multi-channel marketplace transactions</p>
        </div>
        <Button
          onClick={handleSync}
          disabled={syncing || loading}
          loading={syncing}
          icon={!syncing && <RefreshCw className="w-4 h-4" />}
        >
          {syncing ? 'Syncing Orders...' : 'Sync Orders'}
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-xs font-semibold text-red-600 flex items-center gap-2.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping"></span>
          {error}
        </div>
      )}

      {/* STATS BANNER */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard
          name="Total Revenue"
          value={`$${totalRevenue.toFixed(2)}`}
          icon={<DollarSign className="w-4 h-4" />}
          color="indigo"
          trend="Live"
          delay={reducedMotion ? 0 : 0}
        />
        <StatCard
          name="Orders Received"
          value={filteredSales.length}
          icon={<ShoppingBag className="w-4 h-4" />}
          color="sky"
          trend="Filtered"
          delay={reducedMotion ? 0 : 0.05}
        />
        <StatCard
          name="Awaiting Shipment"
          value={pendingShipment}
          icon={<Clock className="w-4 h-4" />}
          color="amber"
          trend="Action"
          delay={reducedMotion ? 0 : 0.1}
        />
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-white p-4 rounded-3xl border border-border shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-center gap-4">
          {/* Search Box */}
          <div className="relative flex-grow w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search orders by ID, buyer or product title..."
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2 w-full md:w-auto relative shrink-0">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 absolute left-4.5" />
            <select
              value={activeStatus}
              onChange={(e) => setActiveStatus(e.target.value)}
              className="w-full md:w-44 pl-11 pr-10 py-2.5 bg-white border border-border rounded-2xl text-xs font-bold text-slate-700 outline-none appearance-none cursor-pointer"
            >
              <option value="all">Status: All</option>
              <option value="pending">Pending</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Platform Tabs */}
        <div className="flex items-center flex-wrap gap-2 border-t border-slate-50 pt-3.5">
          {['all', 'ebay', /* 'depop', */ 'poshmark', 'etsy', 'mercari'].map((plat) => (
            <button
              key={plat}
              onClick={() => setActivePlatform(plat)}
              className={`px-4 py-1.5 rounded-full text-xs font-black capitalize transition-all border ${
                activePlatform === plat 
                  ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                  : 'bg-white text-slate-500 border-slate-100 hover:bg-slate-50'
              }`}
            >
              {plat}
            </button>
          ))}
        </div>
      </div>

      {/* SALES ORDERS LIST */}
      <div className="bg-white rounded-3xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <LoadingState label="Loading orders database..." />
        ) : filteredSales.length === 0 ? (
          <EmptyState
            icon={<Package className="w-5 h-5" />}
            title="No orders found"
            description="Try changing filters or sync orders from connected marketplaces"
            action={
              <Button variant="secondary" onClick={handleSync}>
                Sync Now
              </Button>
            }
          />
        ) : (
          <>
          {/* Mobile card list */}
          <div className="md:hidden divide-y divide-border">
            {filteredSales.map((sale) => (
              <div key={sale._id} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-bold text-slate-600">
                      {sale.orderId || 'N/A'}
                    </span>
                    {sale.lineItems && sale.lineItems.length > 1 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {sale.lineItems.length} Items
                      </span>
                    )}
                  </div>
                  <IconButton
                    size="sm"
                    variant="danger"
                    onClick={() => handleDelete(sale._id)}
                    aria-label="Delete Record"
                    className="shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </IconButton>
                </div>

                {/* Items List */}
                <div className="space-y-2">
                  {(sale.lineItems && sale.lineItems.length > 0 ? sale.lineItems : [{ title: 'No Title', sku: 'None' }]).map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3 bg-slate-50/60 p-2 rounded-xl border border-slate-100">
                      <img
                        src={item.thumbnail || getPlatformLogo(sale.platform)}
                        className="w-11 h-11 object-cover rounded-xl border border-slate-100 shrink-0"
                        alt=""
                        onError={(e) => { e.target.src = getPlatformLogo(sale.platform) }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-extrabold text-slate-800 text-xs truncate">
                          {item.title || 'No Title'}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-semibold truncate mt-0.5">
                          <span>SKU: {item.sku || 'None'}</span>
                          {item.quantity > 1 && (
                            <span className="text-slate-600 font-bold bg-slate-200/60 px-1 rounded text-[9px]">
                              Qty: {item.quantity}
                            </span>
                          )}
                          {item.price > 0 && (
                            <span className="text-emerald-600 font-bold">
                              ${parseFloat(item.price).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1.5">
                    <img
                      src={getPlatformLogo(sale.platform)}
                      className="w-4 h-4 object-contain shrink-0"
                      alt={sale.platform}
                      onError={(e) => { e.target.src = "/logo.png" }}
                    />
                    <span className="text-[11px] font-bold text-slate-600 capitalize">
                      {sale.platform || 'eBay'}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-500">@{sale.buyerUsername || 'buyer'}</span>
                  <span className="font-black text-slate-800 text-xs">
                    {sale.currency === 'GBP' ? '£' : '$'}{(sale.totalAmount || 0).toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-semibold">
                    {formatOrderDate(sale.createdDate || sale.paidDate || sale.createdAt || sale.updated_at)}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRelist(sale._id)}
                      disabled={relistingId === sale._id}
                      className="px-2.5 py-1 text-[11px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-xl transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow-xs"
                      title="Relist item(s) to Local Database drafts"
                    >
                      <RefreshCw className={`w-3 h-3 ${relistingId === sale._id ? 'animate-spin' : ''}`} />
                      {relistingId === sale._id ? 'Relisting...' : 'Relist'}
                    </button>
                    {sale.orderUrl && sale.orderUrl !== '#' && (
                      <a
                        href={sale.orderUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition-all border border-transparent"
                        title="View Original Order"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button
                      onClick={() => handleUpdateStatus(sale._id, sale.status)}
                      className="transition-transform active:scale-95 cursor-pointer"
                      title="Click to cycle status"
                    >
                      <Badge variant={getStatusVariant(sale.status)}>
                        {sale.status || 'Pending'}
                      </Badge>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-app-bg border-b border-border">
                  <th className="px-6 py-4.5 text-xs font-black text-slate-400 uppercase tracking-wider">Order ID</th>
                  <th className="px-6 py-4.5 text-xs font-black text-slate-400 uppercase tracking-wider">Item(s) Purchased</th>
                  <th className="px-6 py-4.5 text-xs font-black text-slate-400 uppercase tracking-wider">Platform</th>
                  <th className="px-6 py-4.5 text-xs font-black text-slate-400 uppercase tracking-wider">Buyer</th>
                  <th className="px-6 py-4.5 text-xs font-black text-slate-400 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-4.5 text-xs font-black text-slate-400 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4.5 text-xs font-black text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4.5 text-xs font-black text-slate-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredSales.map((sale) => (
                  <tr key={sale._id} className="hover:bg-app-bg/40 transition-colors group align-top">
                    {/* Order ID */}
                    <td className="px-6 py-4.5 font-mono text-xs font-bold text-slate-700">
                      {sale.orderId || 'N/A'}
                    </td>
                    
                    {/* Line Items / Titles */}
                    <td className="px-6 py-4.5 max-w-[320px]">
                      {sale.lineItems && sale.lineItems.length > 1 ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-100">
                              {sale.lineItems.length} Items in Order
                            </span>
                          </div>
                          <div className="space-y-2">
                            {sale.lineItems.map((item, idx) => (
                              <div key={idx} className="flex items-center gap-2.5 bg-slate-50/70 p-1.5 rounded-xl border border-slate-100">
                                <img 
                                  src={item.thumbnail || getPlatformLogo(sale.platform)} 
                                  className="w-9 h-9 object-cover rounded-lg border border-slate-100 shrink-0" 
                                  alt="" 
                                  onError={(e) => { e.target.src = getPlatformLogo(sale.platform) }}
                                />
                                <div className="overflow-hidden min-w-0 flex-1">
                                  <p className="font-extrabold text-slate-800 text-[11px] truncate leading-tight" title={item.title}>
                                    {item.title || 'No Title'}
                                  </p>
                                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-semibold truncate mt-0.5">
                                    <span>SKU: {item.sku || 'None'}</span>
                                    {item.quantity > 1 && (
                                      <span className="text-slate-600 font-bold bg-slate-200/60 px-1 rounded text-[9px]">
                                        Qty: {item.quantity}
                                      </span>
                                    )}
                                    {item.price > 0 && (
                                      <span className="text-emerald-600 font-bold">
                                        ${parseFloat(item.price).toFixed(2)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <img 
                            src={sale.lineItems?.[0]?.thumbnail || getPlatformLogo(sale.platform)} 
                            className="w-10 h-10 object-cover rounded-xl border border-slate-100 shrink-0" 
                            alt="" 
                            onError={(e) => { e.target.src = getPlatformLogo(sale.platform) }}
                          />
                          <div className="overflow-hidden min-w-0">
                            <p className="font-extrabold text-slate-800 text-xs truncate" title={sale.lineItems?.[0]?.title}>
                              {sale.lineItems?.[0]?.title || 'No Title'}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-semibold truncate mt-0.5">
                              <span>SKU: {sale.lineItems?.[0]?.sku || 'None'}</span>
                              {sale.lineItems?.[0]?.quantity > 1 && (
                                <span className="text-slate-600 font-bold bg-slate-100 px-1 rounded text-[9px]">
                                  Qty: {sale.lineItems[0].quantity}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Platform Logo */}
                    <td className="px-6 py-4.5">
                      <div className="flex items-center gap-2">
                        <img 
                          src={getPlatformLogo(sale.platform)} 
                          className="w-5 h-5 object-contain shrink-0" 
                          alt={sale.platform} 
                          onError={(e) => { e.target.src = "/logo.png" }}
                        />
                        <span className="text-xs font-bold text-slate-600 capitalize">
                          {sale.platform || 'eBay'}
                        </span>
                      </div>
                    </td>

                    {/* Buyer Username */}
                    <td className="px-6 py-4.5 text-xs font-bold text-slate-700">
                      @{sale.buyerUsername || 'buyer'}
                    </td>

                    {/* Amount */}
                    <td className="px-6 py-4.5 font-black text-slate-800 text-xs">
                      {sale.currency === 'GBP' ? '£' : '$'}
                      {(sale.totalAmount || 0).toFixed(2)}
                    </td>

                    {/* Date */}
                    <td className="px-6 py-4.5 text-xs text-slate-400 font-semibold">
                      {formatOrderDate(sale.createdDate || sale.paidDate || sale.createdAt || sale.updated_at)}
                    </td>

                    {/* Status Badge */}
                    <td className="px-6 py-4.5">
                      <button
                        onClick={() => handleUpdateStatus(sale._id, sale.status)}
                        className="transition-transform hover:scale-105 cursor-pointer"
                        title="Click to cycle status"
                      >
                        <Badge variant={getStatusVariant(sale.status)}>
                          {sale.status || 'Pending'}
                        </Badge>
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleRelist(sale._id)}
                          disabled={relistingId === sale._id}
                          className="px-2.5 py-1 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
                          title="Relist item(s) to Local Database drafts"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${relistingId === sale._id ? 'animate-spin' : ''}`} />
                          {relistingId === sale._id ? 'Relisting...' : 'Relist'}
                        </button>
                        {sale.orderUrl && sale.orderUrl !== '#' && (
                          <a
                            href={sale.orderUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-2xl transition-all border border-transparent"
                            title="View Original Order"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <IconButton
                          size="sm"
                          variant="danger"
                          onClick={() => handleDelete(sale._id)}
                          aria-label="Delete Record"
                          title="Delete Record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

    </div>
  );
};

export default Orders;
