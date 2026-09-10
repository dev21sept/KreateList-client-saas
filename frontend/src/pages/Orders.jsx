import React, { useState, useEffect, useRef } from 'react';
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
  Package,
  Calendar,
  Check,
  RotateCcw,
  SlidersHorizontal,
  X
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

// eBay Specific Status Options
const EBAY_STATUS_OPTIONS = [
  { id: 'all', label: 'All orders' },
  { id: 'awaiting_payment', label: 'Awaiting payment' },
  { id: 'awaiting_shipment', label: 'Awaiting shipment' },
  { id: 'awaiting_shipment_overdue', label: 'Awaiting shipment—overdue' },
  { id: 'awaiting_shipment_24h', label: 'Awaiting shipment—ship within 24 hours' },
  { id: 'awaiting_expedited_shipment', label: 'Awaiting expedited shipment' },
  { id: 'paid_and_shipped', label: 'Paid and shipped' },
  { id: 'paid_awaiting_feedback', label: 'Paid—awaiting your feedback' },
  { id: 'shipped_awaiting_feedback', label: 'Shipped—awaiting your feedback' },
  { id: 'archived', label: 'Archived' },
];

// Poshmark Specific Status Options
const POSHMARK_STATUS_OPTIONS = [
  { id: 'all', label: 'All orders' },
  { id: 'awaiting_shipment', label: 'Awaiting shipment' },
  { id: 'shipped', label: 'Shipped' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

// Period / Date Filter Options
const PERIOD_OPTIONS = [
  { id: 'all_time', label: 'All time' },
  { id: 'last_90_days', label: 'Last 90 days' },
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'this_week', label: 'This week' },
  { id: 'last_week', label: 'Last week' },
  { id: 'this_month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
  { id: 'this_year', label: 'This year' },
  { id: 'last_year', label: 'Last year' },
  { id: 'custom', label: 'Custom' },
];

// Search By Filter Options
const SEARCH_BY_OPTIONS = [
  { id: 'buyer_username', label: 'Buyer username' },
  { id: 'buyer_name', label: 'Buyer name' },
  { id: 'order_number', label: 'Order number' },
  { id: 'sales_record_number', label: 'Sales record number' },
  { id: 'item_title', label: 'Item title' },
  { id: 'item_id', label: 'Item ID' },
  { id: 'sku', label: 'Custom label (SKU)' },
];

const PLATFORMS = [
  { id: 'all', label: 'All Channels', icon: null },
  { id: 'ebay', label: 'eBay', icon: '/ebay.png' },
  { id: 'poshmark', label: 'Poshmark', icon: '/poshmark.png' },
  { id: 'mercari', label: 'Mercari', icon: '/mercari.png' },
  { id: 'etsy', label: 'Etsy', icon: '/etsy.png' },
  { id: 'amazon', label: 'Amazon', icon: '/amazon.png' },
];

const Orders = () => {
  const navigate = useNavigate();
  const { toast } = useNotification();
  const reducedMotion = useReducedMotion();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [relistingId, setRelistingId] = useState(null);
  const [error, setError] = useState(null);

  // Platform & Filter States
  const [activePlatform, setActivePlatform] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('all_time');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [searchBy, setSearchBy] = useState('buyer_username');
  const [searchTerm, setSearchTerm] = useState('');

  // Dropdown open states
  const [statusOpen, setStatusOpen] = useState(false);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [searchByOpen, setSearchByOpen] = useState(false);

  const statusRef = useRef(null);
  const periodRef = useRef(null);
  const searchByRef = useRef(null);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (statusRef.current && !statusRef.current.contains(event.target)) {
        setStatusOpen(false);
      }
      if (periodRef.current && !periodRef.current.contains(event.target)) {
        setPeriodOpen(false);
      }
      if (searchByRef.current && !searchByRef.current.contains(event.target)) {
        setSearchByOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
        if (toast) toast.success('Orders synced successfully!');
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
        if (toast) toast.success('Order record deleted.');
      }
    } catch (err) {
      console.error('Error deleting sale:', err);
      if (toast) toast.error('Failed to delete sale record');
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

  // Update status
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
      case 'amazon': return '/amazon.png';
      default: return '/logo.png';
    }
  };

  // Helper for status badge variant
  const getStatusVariant = (status) => {
    const s = String(status || '').toLowerCase();
    switch (s) {
      case 'delivered':
      case 'completed':
      case 'fulfilled': return 'success';
      case 'shipped':
      case 'paid and shipped': return 'info';
      case 'pending':
      case 'in progress':
      case 'in_progress':
      case 'trading':
      case 'awaiting shipment': return 'warning';
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

  // Period Matcher
  const matchesPeriod = (sale) => {
    if (periodFilter === 'all_time') return true;
    const rawDate = sale.paidDate || sale.createdDate || sale.createdAt || sale.updated_at;
    if (!rawDate) return true;
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) return true;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    switch (periodFilter) {
      case 'today':
        return d >= startOfToday && d <= endOfToday;
      case 'yesterday': {
        const yStart = new Date(startOfToday);
        yStart.setDate(yStart.getDate() - 1);
        const yEnd = new Date(endOfToday);
        yEnd.setDate(yEnd.getDate() - 1);
        return d >= yStart && d <= yEnd;
      }
      case 'this_week': {
        const day = startOfToday.getDay();
        const weekStart = new Date(startOfToday);
        weekStart.setDate(weekStart.getDate() - day);
        return d >= weekStart && d <= endOfToday;
      }
      case 'last_week': {
        const day = startOfToday.getDay();
        const thisWeekStart = new Date(startOfToday);
        thisWeekStart.setDate(thisWeekStart.getDate() - day);
        const lastWeekStart = new Date(thisWeekStart);
        lastWeekStart.setDate(lastWeekStart.getDate() - 7);
        const lastWeekEnd = new Date(thisWeekStart);
        lastWeekEnd.setMilliseconds(-1);
        return d >= lastWeekStart && d <= lastWeekEnd;
      }
      case 'this_month': {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return d >= monthStart && d <= endOfToday;
      }
      case 'last_month': {
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        return d >= lastMonthStart && d <= lastMonthEnd;
      }
      case 'last_90_days': {
        const ninetyDaysAgo = new Date(now);
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        return d >= ninetyDaysAgo && d <= endOfToday;
      }
      case 'this_year': {
        const yearStart = new Date(now.getFullYear(), 0, 1);
        return d >= yearStart && d <= endOfToday;
      }
      case 'last_year': {
        const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
        const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
        return d >= lastYearStart && d <= lastYearEnd;
      }
      case 'custom': {
        if (customStartDate) {
          const sDate = new Date(customStartDate + 'T00:00:00');
          if (!isNaN(sDate.getTime()) && d < sDate) return false;
        }
        if (customEndDate) {
          const eDate = new Date(customEndDate + 'T23:59:59');
          if (!isNaN(eDate.getTime()) && d > eDate) return false;
        }
        return true;
      }
      default:
        return true;
    }
  };

  // Status Matcher (Handles eBay, Poshmark, and General Statuses)
  const matchesStatus = (sale, statusId) => {
    if (statusId === 'all') return true;
    const s = String(sale.status || '').toLowerCase();
    const payment = String(sale.paymentStatus || '').toLowerCase();

    // eBay & Poshmark Statuses
    switch (statusId) {
      case 'awaiting_payment':
        return payment === 'pending' || s.includes('pending') || s.includes('awaiting_payment') || s.includes('unpaid');
      case 'awaiting_shipment':
        return s === 'paid' || s === 'not_started' || s === 'in_progress' || s === 'pending' || s.includes('trading') || s.includes('awaiting_shipment');
      case 'awaiting_shipment_overdue': {
        const isAwaiting = s === 'paid' || s === 'not_started' || s === 'in_progress' || s === 'pending' || s.includes('trading');
        const rawDate = sale.paidDate || sale.createdDate || sale.createdAt;
        const orderDate = new Date(rawDate);
        const ageInDays = (Date.now() - orderDate.getTime()) / (1000 * 60 * 60 * 24);
        return isAwaiting && ageInDays > 3;
      }
      case 'awaiting_shipment_24h': {
        const isAwaiting = s === 'paid' || s === 'not_started' || s === 'in_progress' || s === 'pending' || s.includes('trading');
        const rawDate = sale.paidDate || sale.createdDate || sale.createdAt;
        const orderDate = new Date(rawDate);
        const ageInHours = (Date.now() - orderDate.getTime()) / (1000 * 60 * 60);
        return isAwaiting && ageInHours <= 24;
      }
      case 'awaiting_expedited_shipment':
        return (s === 'paid' || s === 'not_started' || s === 'in_progress') && (s.includes('expedited') || sale.shippingStep?.shippingServiceCode?.toLowerCase().includes('expedited'));
      case 'paid_and_shipped':
      case 'shipped':
        return s === 'fulfilled' || s === 'shipped' || s === 'delivered' || s === 'completed';
      case 'paid_awaiting_feedback':
        return payment === 'paid' || s === 'fulfilled' || s === 'shipped' || s === 'delivered' || s === 'completed' || s === 'paid';
      case 'shipped_awaiting_feedback':
        return s === 'fulfilled' || s === 'shipped' || s === 'delivered' || s === 'completed';
      case 'delivered':
        return s === 'delivered' || s === 'completed' || s === 'fulfilled';
      case 'completed':
        return s === 'completed' || s === 'delivered' || s === 'fulfilled';
      case 'pending':
        return s.includes('pending') || s.includes('in_progress') || s.includes('trading') || s === 'not_started';
      case 'cancelled':
      case 'archived':
        return s.includes('archive') || s.includes('cancel');
      default:
        return s.includes(statusId.toLowerCase());
    }
  };

  // Search Matcher
  const matchesSearch = (sale) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase().trim();

    if (activePlatform === 'ebay' || activePlatform === 'poshmark') {
      switch (searchBy) {
        case 'buyer_username':
          return sale.buyerUsername?.toLowerCase().includes(q);
        case 'buyer_name':
          return sale.buyerName?.toLowerCase().includes(q) || sale.buyerUsername?.toLowerCase().includes(q);
        case 'order_number':
          return sale.orderId?.toLowerCase().includes(q) || sale.ebayOrderId?.toLowerCase().includes(q);
        case 'sales_record_number':
          return sale.orderId?.toLowerCase().includes(q);
        case 'item_title':
          return sale.lineItems?.some(li => li.title?.toLowerCase().includes(q));
        case 'item_id':
          return sale.lineItems?.some(li => li.lineItemId?.toLowerCase().includes(q));
        case 'sku':
          return sale.lineItems?.some(li => li.sku?.toLowerCase().includes(q));
        default:
          return (
            sale.orderId?.toLowerCase().includes(q) ||
            sale.buyerUsername?.toLowerCase().includes(q) ||
            sale.lineItems?.some(li => li.title?.toLowerCase().includes(q) || li.sku?.toLowerCase().includes(q))
          );
      }
    }

    // Default general search across all fields for standard view
    return (
      sale.orderId?.toLowerCase().includes(q) ||
      sale.buyerUsername?.toLowerCase().includes(q) ||
      sale.lineItems?.some(li => li.title?.toLowerCase().includes(q) || li.sku?.toLowerCase().includes(q))
    );
  };

  // Get dynamic count for status option
  const getStatusCount = (statusId) => {
    return sales.filter(sale => {
      if (activePlatform !== 'all' && sale.platform?.toLowerCase() !== activePlatform.toLowerCase()) {
        return false;
      }
      if (!matchesPeriod(sale)) return false;
      return matchesStatus(sale, statusId);
    }).length;
  };

  // Main Filtered Sales
  const filteredSales = sales.filter(sale => {
    const matchesPlatform = activePlatform === 'all' || sale.platform?.toLowerCase() === activePlatform.toLowerCase();
    const periodOk = matchesPeriod(sale);
    const statusOk = matchesStatus(sale, statusFilter);
    const searchOk = matchesSearch(sale);

    return matchesPlatform && periodOk && statusOk && searchOk;
  });

  // Reset Filters Handler
  const handleReset = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setPeriodFilter('all_time');
    setCustomStartDate('');
    setCustomEndDate('');
    setSearchBy('buyer_username');
  };

  // Switch Platform Handler
  const handlePlatformChange = (platId) => {
    setActivePlatform(platId);
    setStatusFilter('all');
    setPeriodFilter('all_time');
    setSearchTerm('');
  };

  // Stats calculation
  const totalRevenue = filteredSales.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
  const pendingShipment = filteredSales.filter(sale => {
    const s = String(sale.status || '').toLowerCase();
    return s === 'pending' || s === 'in progress' || s === 'in_progress' || s === 'trading' || s.includes('awaiting') || s === 'not_started';
  }).length;

  const currentEbayStatusOption = EBAY_STATUS_OPTIONS.find(o => o.id === statusFilter) || EBAY_STATUS_OPTIONS[0];
  const currentPoshmarkStatusOption = POSHMARK_STATUS_OPTIONS.find(o => o.id === statusFilter) || POSHMARK_STATUS_OPTIONS[0];
  const currentPeriodOption = PERIOD_OPTIONS.find(o => o.id === periodFilter) || PERIOD_OPTIONS[0];
  const currentSearchByOption = SEARCH_BY_OPTIONS.find(o => o.id === searchBy) || SEARCH_BY_OPTIONS[0];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* 1. TOP PLATFORM TABS & SYNC BUTTON TOOLBAR */}
      <div className="bg-white p-3 sm:p-4 rounded-3xl border border-slate-100 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        
        {/* Platform Selection Tabs (Left) */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto p-1 bg-slate-50/80 rounded-2xl">
          {PLATFORMS.map((plat) => {
            const isActive = activePlatform === plat.id;
            return (
              <button
                key={plat.id}
                onClick={() => handlePlatformChange(plat.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80 scale-[1.02]'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/70 border border-transparent'
                }`}
              >
                {plat.icon ? (
                  <img src={plat.icon} alt={plat.label} className="w-4 h-4 object-contain shrink-0" />
                ) : (
                  <Package className="w-4 h-4 text-slate-400" />
                )}
                <span>{plat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Sync Orders Action (Right) */}
        <button
          onClick={handleSync}
          disabled={syncing || loading}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-2xl text-xs font-black shadow-md shadow-indigo-500/20 transition-all cursor-pointer shrink-0 w-full sm:w-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
          <span>{syncing ? 'Syncing Orders...' : 'Sync Orders'}</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-xs font-semibold text-red-600 flex items-center gap-2.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping"></span>
          {error}
        </div>
      )}

      {/* 2. STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
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

      {/* 3. DYNAMIC MARKETPLACE FILTER & SEARCH TOOLBAR */}
      {activePlatform === 'ebay' ? (
        /* --- EBAY DYNAMIC FILTER BAR --- */
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-100 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            
            {/* eBay Status Dropdown */}
            <div className="relative" ref={statusRef}>
              <button
                type="button"
                onClick={() => {
                  setStatusOpen(!statusOpen);
                  setPeriodOpen(false);
                  setSearchByOpen(false);
                }}
                className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300/90 rounded-xl text-xs font-bold text-slate-800 shadow-2xs transition-all cursor-pointer"
              >
                <span>Status: <span className="font-extrabold">{currentEbayStatusOption.label} ({getStatusCount(statusFilter)})</span></span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              </button>

              {statusOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 py-1.5 max-h-80 overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
                  {EBAY_STATUS_OPTIONS.map((opt) => {
                    const count = getStatusCount(opt.id);
                    const isSelected = statusFilter === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setStatusFilter(opt.id);
                          setStatusOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3.5 py-2 text-left text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer ${
                          isSelected ? 'text-slate-900 font-extrabold bg-slate-50/70' : 'text-slate-700'
                        }`}
                      >
                        <span className="truncate pr-2">
                          {opt.label} {count > 0 || opt.id === 'all' ? `(${count})` : ''}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-slate-900 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Period Dropdown */}
            <div className="relative" ref={periodRef}>
              <button
                type="button"
                onClick={() => {
                  setPeriodOpen(!periodOpen);
                  setStatusOpen(false);
                  setSearchByOpen(false);
                }}
                className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300/90 rounded-xl text-xs font-bold text-slate-800 shadow-2xs transition-all cursor-pointer"
              >
                <span>Period: <span className="font-extrabold">{currentPeriodOption.label}</span></span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              </button>

              {periodOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 py-1.5 max-h-80 overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
                  {PERIOD_OPTIONS.map((opt) => {
                    const isSelected = periodFilter === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setPeriodFilter(opt.id);
                          setPeriodOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3.5 py-2 text-left text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer ${
                          isSelected ? 'text-slate-900 font-extrabold bg-slate-50/70' : 'text-slate-700'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-slate-900 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* eBay Combined Search Box: [Search by: Buyer username v] [ Search... ] [ 🔍 ] */}
            <div className="flex-1 min-w-[280px] flex items-center border border-slate-300/90 rounded-xl bg-white focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/10 shadow-2xs transition-all">
              <div className="relative border-r border-slate-200" ref={searchByRef}>
                <button
                  type="button"
                  onClick={() => {
                    setSearchByOpen(!searchByOpen);
                    setStatusOpen(false);
                    setPeriodOpen(false);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-l-xl transition-colors cursor-pointer whitespace-nowrap"
                >
                  <span>Search by: <span className="font-extrabold text-slate-900">{currentSearchByOption.label}</span></span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {searchByOpen && (
                  <div className="absolute left-0 top-full mt-1.5 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 py-1.5 max-h-80 overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
                    {SEARCH_BY_OPTIONS.map((opt) => {
                      const isSelected = searchBy === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setSearchBy(opt.id);
                            setSearchByOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3.5 py-2 text-left text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer ${
                            isSelected ? 'text-slate-900 font-extrabold bg-slate-50/70' : 'text-slate-700'
                          }`}
                        >
                          <span>{opt.label}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-slate-900 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                className="flex-1 px-3 py-2 text-xs font-bold text-slate-800 outline-none bg-transparent placeholder:text-slate-400"
              />

              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              <div className="border-l border-slate-200 p-2 text-slate-500 flex items-center justify-center">
                <Search className="w-4 h-4" />
              </div>
            </div>

            {/* Reset */}
            <button
              type="button"
              onClick={handleReset}
              className="text-xs font-bold text-slate-600 hover:text-indigo-600 hover:underline px-2 py-1 transition-colors cursor-pointer"
            >
              Reset
            </button>
          </div>

          {/* Custom Date Range Row */}
          {periodFilter === 'custom' && (
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 animate-in fade-in duration-150">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Date Range:</span>
              <div className="relative flex items-center border border-slate-300 rounded-xl px-3 py-1.5 bg-white shadow-2xs">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="text-xs font-bold text-slate-800 outline-none cursor-pointer bg-transparent"
                />
              </div>
              <span className="text-xs font-bold text-slate-400">to</span>
              <div className="relative flex items-center border border-slate-300 rounded-xl px-3 py-1.5 bg-white shadow-2xs">
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="text-xs font-bold text-slate-800 outline-none cursor-pointer bg-transparent"
                />
              </div>
              {(customStartDate || customEndDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomStartDate('');
                    setCustomEndDate('');
                  }}
                  className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                >
                  Clear Dates
                </button>
              )}
            </div>
          )}
        </div>
      ) : activePlatform === 'poshmark' ? (
        /* --- POSHMARK DYNAMIC FILTER BAR --- */
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-100 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            
            {/* Poshmark Status Dropdown */}
            <div className="relative" ref={statusRef}>
              <button
                type="button"
                onClick={() => {
                  setStatusOpen(!statusOpen);
                  setPeriodOpen(false);
                  setSearchByOpen(false);
                }}
                className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300/90 rounded-xl text-xs font-bold text-slate-800 shadow-2xs transition-all cursor-pointer"
              >
                <span>Status: <span className="font-extrabold">{currentPoshmarkStatusOption.label} ({getStatusCount(statusFilter)})</span></span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              </button>

              {statusOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-60 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 py-1.5 max-h-80 overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
                  {POSHMARK_STATUS_OPTIONS.map((opt) => {
                    const count = getStatusCount(opt.id);
                    const isSelected = statusFilter === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setStatusFilter(opt.id);
                          setStatusOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3.5 py-2 text-left text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer ${
                          isSelected ? 'text-slate-900 font-extrabold bg-slate-50/70' : 'text-slate-700'
                        }`}
                      >
                        <span className="truncate pr-2">
                          {opt.label} {count > 0 || opt.id === 'all' ? `(${count})` : ''}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-slate-900 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Poshmark Period Dropdown */}
            <div className="relative" ref={periodRef}>
              <button
                type="button"
                onClick={() => {
                  setPeriodOpen(!periodOpen);
                  setStatusOpen(false);
                  setSearchByOpen(false);
                }}
                className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300/90 rounded-xl text-xs font-bold text-slate-800 shadow-2xs transition-all cursor-pointer"
              >
                <span>Period: <span className="font-extrabold">{currentPeriodOption.label}</span></span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              </button>

              {periodOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 py-1.5 max-h-80 overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
                  {PERIOD_OPTIONS.map((opt) => {
                    const isSelected = periodFilter === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setPeriodFilter(opt.id);
                          setPeriodOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3.5 py-2 text-left text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer ${
                          isSelected ? 'text-slate-900 font-extrabold bg-slate-50/70' : 'text-slate-700'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-slate-900 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Poshmark Search Input */}
            <div className="flex-1 min-w-[240px] flex items-center border border-slate-300/90 rounded-xl bg-white focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/10 shadow-2xs transition-all px-3 py-2">
              <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by buyer, order ID or item..."
                className="flex-1 text-xs font-bold text-slate-800 outline-none bg-transparent placeholder:text-slate-400"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Reset */}
            <button
              type="button"
              onClick={handleReset}
              className="text-xs font-bold text-slate-600 hover:text-indigo-600 hover:underline px-2 py-1 transition-colors cursor-pointer"
            >
              Reset
            </button>
          </div>

          {/* Custom Date Range Row */}
          {periodFilter === 'custom' && (
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 animate-in fade-in duration-150">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Date Range:</span>
              <div className="relative flex items-center border border-slate-300 rounded-xl px-3 py-1.5 bg-white shadow-2xs">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="text-xs font-bold text-slate-800 outline-none cursor-pointer bg-transparent"
                />
              </div>
              <span className="text-xs font-bold text-slate-400">to</span>
              <div className="relative flex items-center border border-slate-300 rounded-xl px-3 py-1.5 bg-white shadow-2xs">
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="text-xs font-bold text-slate-800 outline-none cursor-pointer bg-transparent"
                />
              </div>
              {(customStartDate || customEndDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomStartDate('');
                    setCustomEndDate('');
                  }}
                  className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                >
                  Clear Dates
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        /* --- STANDARD / NORMAL SEARCH BAR (For All, Mercari, Etsy, Amazon) --- */
        <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-xs flex flex-col md:flex-row items-center gap-4">
          {/* Search Box */}
          <div className="relative flex-grow w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search orders by ID, buyer or product title..."
              className="w-full pl-11 pr-10 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2 w-full md:w-auto relative shrink-0">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 absolute left-4.5" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full md:w-44 pl-11 pr-10 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none appearance-none cursor-pointer"
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
      )}

      {/* 4. SALES ORDERS LIST & TABLE */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
        {loading ? (
          <LoadingState label="Loading orders database..." />
        ) : filteredSales.length === 0 ? (
          <EmptyState
            icon={<Package className="w-5 h-5" />}
            title="No orders found"
            description="Try adjusting your status, date range, search query or sync orders from connected marketplaces."
            action={
              <Button variant="secondary" onClick={handleSync}>
                Sync Now
              </Button>
            }
          />
        ) : (
          <>
          {/* Mobile card list */}
          <div className="md:hidden divide-y divide-slate-100">
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
                <tr className="bg-slate-50/70 border-b border-slate-100">
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">Order ID</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">Item(s) Purchased</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">Platform</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">Buyer</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredSales.map((sale) => (
                  <tr key={sale._id} className="hover:bg-slate-50/60 transition-colors group align-top">
                    {/* Order ID */}
                    <td className="px-6 py-4 font-mono text-xs font-bold text-slate-700">
                      {sale.orderId || 'N/A'}
                    </td>
                    
                    {/* Line Items / Titles */}
                    <td className="px-6 py-4 max-w-[320px]">
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
                    <td className="px-6 py-4">
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
                    <td className="px-6 py-4 text-xs font-bold text-slate-700">
                      @{sale.buyerUsername || 'buyer'}
                    </td>

                    {/* Amount */}
                    <td className="px-6 py-4 font-black text-slate-800 text-xs">
                      {sale.currency === 'GBP' ? '£' : '$'}
                      {(sale.totalAmount || 0).toFixed(2)}
                    </td>

                    {/* Date */}
                    <td className="px-6 py-4 text-xs text-slate-400 font-semibold">
                      {formatOrderDate(sale.createdDate || sale.paidDate || sale.createdAt || sale.updated_at)}
                    </td>

                    {/* Status Badge */}
                    <td className="px-6 py-4">
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
                    <td className="px-6 py-4 text-right">
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
