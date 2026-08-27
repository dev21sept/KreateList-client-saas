import React, { useState, useEffect } from 'react';
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
  Package
} from 'lucide-react';
import { orderService } from '../services/api';
import Button from '../components/ui/Button';
import IconButton from '../components/ui/IconButton';
import StatCard from '../components/ui/StatCard';
import EmptyState from '../components/ui/EmptyState';
import { LoadingState } from '../components/ui/LoadingState';
import { Badge } from '../components/ui/Badge';
import { useReducedMotion } from '../hooks/useReducedMotion';

const Orders = () => {
  const reducedMotion = useReducedMotion();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
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
      default: return '/logo192.png';
    }
  };

  // Helper for status badge variant
  const getStatusVariant = (status) => {
    switch (status) {
      case 'Delivered': return 'success';
      case 'Shipped': return 'info';
      case 'Pending': return 'warning';
      default: return 'neutral';
    }
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
  const pendingShipment = filteredSales.filter(sale => sale.status?.toLowerCase() === 'pending').length;

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
          {['all', 'ebay', 'depop', 'poshmark', 'etsy'].map((plat) => (
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
                <div className="flex items-start gap-3">
                  <img
                    src={sale.lineItems?.[0]?.thumbnail || "/logo192.png"}
                    className="w-12 h-12 object-cover rounded-xl border border-slate-100 shrink-0"
                    alt=""
                    onError={(e) => { e.target.src = "/logo192.png" }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-slate-800 text-xs truncate">
                      {sale.lineItems?.[0]?.title || 'No Title'}
                    </p>
                    <p className="text-[10px] text-slate-400 font-semibold truncate mt-0.5">
                      SKU: {sale.lineItems?.[0]?.sku || 'None'} · {sale.orderId || 'N/A'}
                    </p>
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

                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1.5">
                    <img
                      src={getPlatformLogo(sale.platform)}
                      className="w-4 h-4 object-contain shrink-0"
                      alt={sale.platform}
                      onError={(e) => { e.target.src = "/logo192.png" }}
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
                    {sale.createdDate ? new Date(sale.createdDate).toLocaleDateString(undefined, {
                      month: 'short', day: 'numeric', year: 'numeric'
                    }) : 'N/A'}
                  </span>
                  <div className="flex items-center gap-2">
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
                  <th className="px-6 py-4.5 text-xs font-black text-slate-400 uppercase tracking-wider">Item Purchased</th>
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
                  <tr key={sale._id} className="hover:bg-app-bg/40 transition-colors group">
                    {/* Order ID */}
                    <td className="px-6 py-4.5 font-mono text-xs font-bold text-slate-700">
                      {sale.orderId || 'N/A'}
                    </td>
                    
                    {/* Line Item / Title */}
                    <td className="px-6 py-4.5 max-w-[280px]">
                      <div className="flex items-center gap-3">
                        <img 
                          src={sale.lineItems?.[0]?.thumbnail || "/logo192.png"} 
                          className="w-10 h-10 object-cover rounded-xl border border-slate-100 shrink-0" 
                          alt="" 
                          onError={(e) => { e.target.src = "/logo192.png" }}
                        />
                        <div className="overflow-hidden">
                          <p className="font-extrabold text-slate-800 text-xs truncate">
                            {sale.lineItems?.[0]?.title || 'No Title'}
                          </p>
                          <p className="text-[10px] text-slate-400 font-semibold truncate mt-0.5">
                            SKU: {sale.lineItems?.[0]?.sku || 'None'}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Platform Logo */}
                    <td className="px-6 py-4.5">
                      <div className="flex items-center gap-2">
                        <img 
                          src={getPlatformLogo(sale.platform)} 
                          className="w-5 h-5 object-contain shrink-0" 
                          alt={sale.platform} 
                          onError={(e) => { e.target.src = "/logo192.png" }}
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
                      {sale.createdDate ? new Date(sale.createdDate).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      }) : 'N/A'}
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
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
