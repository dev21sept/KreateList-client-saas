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

const Orders = () => {
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
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Sales Orders</h1>
          <p className="text-slate-400 text-xs mt-1 font-semibold">Track and manage multi-channel marketplace transactions</p>
        </div>
        <button 
          onClick={handleSync}
          disabled={syncing || loading}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-indigo-650 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black transition-all shadow-md shadow-indigo-650/15 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing Sales...' : 'Sync Sales'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-xs font-semibold text-red-650 flex items-center gap-2.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red-650 animate-ping"></span>
          {error}
        </div>
      )}

      {/* STATS BANNER */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* TOTAL SALES */}
        <div className="bg-white p-6 rounded-3xl border border-[#f1f3f9] shadow-sm flex flex-col justify-between h-32 relative overflow-hidden group hover:border-indigo-100 transition-all">
          <div className="absolute right-4 top-4 p-2 bg-indigo-50/50 rounded-xl text-indigo-600">
            <DollarSign className="w-4 h-4" />
          </div>
          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Sales</span>
          <div>
            <p className="text-2xl font-black text-[#111827] mt-1">${totalRevenue.toFixed(2)}</p>
            <p className="text-[10px] text-emerald-600 font-extrabold mt-1 flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" /> Live synced value
            </p>
          </div>
        </div>

        {/* ORDERS COUNT */}
        <div className="bg-white p-6 rounded-3xl border border-[#f1f3f9] shadow-sm flex flex-col justify-between h-32 relative overflow-hidden group hover:border-indigo-100 transition-all">
          <div className="absolute right-4 top-4 p-2 bg-blue-50/50 rounded-xl text-blue-600">
            <ShoppingBag className="w-4 h-4" />
          </div>
          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Orders Received</span>
          <div>
            <p className="text-2xl font-black text-[#111827] mt-1">{filteredSales.length}</p>
            <p className="text-[10px] text-slate-400 font-semibold mt-1">Across all active filters</p>
          </div>
        </div>

        {/* PENDING SHIPMENTS */}
        <div className="bg-white p-6 rounded-3xl border border-[#f1f3f9] shadow-sm flex flex-col justify-between h-32 relative overflow-hidden group hover:border-indigo-100 transition-all">
          <div className="absolute right-4 top-4 p-2 bg-amber-50/50 rounded-xl text-amber-500">
            <Clock className="w-4 h-4" />
          </div>
          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Awaiting Shipment</span>
          <div>
            <p className="text-2xl font-black text-[#111827] mt-1">{pendingShipment}</p>
            <p className="text-[10px] text-amber-500 font-extrabold mt-1">Needs action on marketplaces</p>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-white p-4 rounded-3xl border border-[#f1f3f9] shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-center gap-4">
          {/* Search Box */}
          <div className="relative flex-grow w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search sales by ID, buyer or product title..."
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2 w-full md:w-auto relative shrink-0">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 absolute left-4.5" />
            <select
              value={activeStatus}
              onChange={(e) => setActiveStatus(e.target.value)}
              className="w-full md:w-44 pl-11 pr-10 py-2.5 bg-white border border-[#e5e7eb] rounded-2xl text-xs font-bold text-slate-700 outline-none appearance-none cursor-pointer"
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
        <div className="flex items-center gap-2 border-t border-slate-50 pt-3.5 overflow-x-auto scrollbar-none">
          {['all', 'ebay', 'depop', 'poshmark', 'etsy'].map((plat) => (
            <button
              key={plat}
              onClick={() => setActivePlatform(plat)}
              className={`px-4 py-1.5 rounded-full text-xs font-black capitalize transition-all border shrink-0 ${
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
      <div className="bg-white rounded-3xl border border-[#f1f3f9] shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
            <p className="text-slate-400 text-xs font-semibold">Loading orders database...</p>
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4">
            <div className="p-4 bg-slate-50 rounded-full text-slate-400">
              <Package className="w-8 h-8" />
            </div>
            <div className="text-center">
              <p className="text-slate-800 text-sm font-bold">No sales orders found</p>
              <p className="text-slate-400 text-xs mt-1">Try changing filters or sync sales from connected marketplaces</p>
            </div>
            <button
              onClick={handleSync}
              className="mt-2 px-4.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-100 rounded-xl text-xs font-bold transition-all"
            >
              Sync Now
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#fcfcff] border-b border-[#f3f4f6]">
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
              <tbody className="divide-y divide-[#f8fafc]">
                {filteredSales.map((sale) => (
                  <tr key={sale._id} className="hover:bg-[#fafbfe]/40 transition-colors group">
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
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold transition-all hover:scale-105 cursor-pointer ${
                          sale.status === 'Delivered' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                          sale.status === 'Shipped' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                          sale.status === 'Pending' ? 'bg-amber-50 text-amber-500 border border-amber-100' : 
                          'bg-slate-50 text-slate-550 border border-slate-100'
                        }`}
                        title="Click to cycle status"
                      >
                        {sale.status || 'Pending'}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4.5 text-right">
                      <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        {sale.orderUrl && sale.orderUrl !== '#' && (
                          <a 
                            href={sale.orderUrl} 
                            target="_blank" 
                            rel="noreferrer"
                            className="p-1.5 text-slate-400 hover:text-indigo-650 hover:bg-slate-50 rounded-lg transition-all"
                            title="View Original Order"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button 
                          onClick={() => handleDelete(sale._id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-50 rounded-lg transition-all"
                          title="Delete Record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

export default Orders;
