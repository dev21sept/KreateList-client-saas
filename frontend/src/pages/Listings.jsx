import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  MoreVertical, 
  ExternalLink, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Download, 
  Trash2, 
  Edit, 
  Eye, 
  X,
  RefreshCw,
  Zap,
  Sparkles
} from 'lucide-react';
import { listingService, ebayService } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { DEPOP_CATEGORY_MAPPING } from '../constants/depopCategoryAttributes';

const NO_IMAGE_PLACEHOLDER = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150"><rect fill="%23f1f5f9" width="150" height="150"/><path d="M55 65 L75 85 L95 60 L115 90 L35 90 Z" fill="%23cbd5e1"/><circle cx="55" cy="50" r="8" fill="%23cbd5e1"/></svg>');

const getImageSrc = (src) => {
  if (!src) return NO_IMAGE_PLACEHOLDER;
  if (typeof src === 'string' && src.startsWith('blob:')) {
    return NO_IMAGE_PLACEHOLDER;
  }
  return src;
};

// Session cache keys
const CACHE_KEY_LISTINGS = 'elister_cache_listings';
const CACHE_KEY_STATS = 'elister_cache_stats';
const CACHE_KEY_EBAY = 'elister_cache_ebay';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getCached = (key) => {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) {
      sessionStorage.removeItem(key);
      return null;
    }
    return data;
  } catch { return null; }
};

const setCache = (key, data) => {
  try {
    sessionStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch { /* quota exceeded, ignore */ }
};

const Listings = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const { toast, confirm } = useNotification();
  const [selectedListings, setSelectedListings] = useState([]);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [previewListing, setPreviewListing] = useState(null);
  const [activeImage, setActiveImage] = useState(null);
  const [publishingId, setPublishingId] = useState(null);
  const [poshmarkPublishingId, setPoshmarkPublishingId] = useState(null);
  const [vintedPublishingId, setVintedPublishingId] = useState(null);
  const [depopPublishingId, setDepopPublishingId] = useState(null);
  const [verifyingListingId, setVerifyingListingId] = useState(null);
  
  // eBay Sync and display state
  const [isEbayConnected, setIsEbayConnected] = useState(false);
  const [activeTab, setActiveTab] = useState('local'); // 'local' or 'ebay'
  const [ebayProducts, setEbayProducts] = useState([]);
  const [ebayLoading, setEbayLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [selectedListingIds, setSelectedListingIds] = useState([]);
  const [isBulkLoading, setIsBulkLoading] = useState(false);

  useEffect(() => {
    setSearchTerm('');
    setStatusFilter('all');
    setPlatformFilter('all');
    setSelectedListingIds([]);
  }, [activeTab]);

  useEffect(() => {
    setSelectedListingIds([]);
  }, [platformFilter, statusFilter, searchTerm]);

  const handleToggleSelectListing = (id) => {
    setSelectedListingIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAllListings = () => {
    const allIds = filteredListings.map(l => l._id);
    const allSelected = allIds.length > 0 && allIds.every(id => selectedListingIds.includes(id));
    
    if (allSelected) {
      setSelectedListingIds(prev => prev.filter(id => !allIds.includes(id)));
    } else {
      setSelectedListingIds(prev => {
        const unique = new Set([...prev, ...allIds]);
        return Array.from(unique);
      });
    }
  };

  const handleBulkListSelected = async () => {
    if (isBulkLoading) return;
    setIsBulkLoading(true);
    try {
      const responses = await Promise.all(
        selectedListingIds.map(id => listingService.getOne(id))
      );
      const fullListings = responses
        .map(res => res.data?.success ? res.data.data : null)
        .filter(Boolean);

      if (fullListings.length === 0) {
        toast.error("Failed to fetch details for selected listings.");
        setIsBulkLoading(false);
        return;
      }

      sessionStorage.setItem('elister_ebay_bulk_queue', JSON.stringify(fullListings));
      navigate('/create-ebay-bulk-listing');
    } catch (error) {
      console.error("Error fetching full details for bulk listing:", error);
      toast.error("An error occurred while preparing bulk listings.");
    } finally {
      setIsBulkLoading(false);
    }
  };

  useEffect(() => {
    if (previewListing && previewListing.images && previewListing.images.length > 0) {
      setActiveImage(previewListing.images[0]);
    } else {
      setActiveImage(null);
    }
  }, [previewListing]);

  useEffect(() => {
    if (highlightId && listings.length > 0) {
      setTimeout(() => {
        const element = document.getElementById(`listing-row-${highlightId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 500);
    }
  }, [highlightId, listings]);

  const filteredListings = listings.filter((listing) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      !searchTerm ||
      (listing.title && listing.title.toLowerCase().includes(term)) ||
      (listing.sku && listing.sku.toLowerCase().includes(term)) ||
      (listing.ebayListingId && listing.ebayListingId.toLowerCase().includes(term));
    const matchesStatus = statusFilter === 'all' || listing.status === statusFilter;
    const matchesPlatform = platformFilter === 'all' || listing.platform === platformFilter;
    return matchesSearch && matchesStatus && matchesPlatform;
  });

  const filteredEbayProducts = ebayProducts.filter((product) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      !searchTerm ||
      (product.title && product.title.toLowerCase().includes(term)) ||
      (product.sku && product.sku.toLowerCase().includes(term)) ||
      (product.ebayListingId && product.ebayListingId.toLowerCase().includes(term));
    const matchesStatus = statusFilter === 'all' || product.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const fetchEbayInventory = async () => {
    setEbayLoading(true);
    try {
      const res = await ebayService.getInventory();
      if (res.data.success) {
        setEbayProducts(res.data.data);
      }
    } catch (error) {
      console.error("Error fetching eBay inventory:", error);
    } finally {
      setEbayLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'ebay') {
      fetchEbayInventory();
    }
  }, [activeTab]);

  const handleSyncInventory = async () => {
    setSyncing(true);
    try {
      const res = await ebayService.syncInventory();
      if (res.data.success) {
        toast.success(`Successfully synced ${res.data.count} items from eBay!`);
        fetchEbayInventory();
      }
    } catch (error) {
      console.error("Error syncing eBay inventory:", error);
      toast.error("Failed to sync inventory from eBay.");
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    // Load from cache first for instant render
    const cachedListings = getCached(CACHE_KEY_LISTINGS);
    const cachedStats = getCached(CACHE_KEY_STATS);
    const cachedEbay = getCached(CACHE_KEY_EBAY);
    if (cachedListings) {
      setListings(cachedListings);
      setLoading(false);
    }
    if (cachedStats) setStats(cachedStats);
    if (cachedEbay) setIsEbayConnected(cachedEbay);
    fetchListings(!cachedListings);
  }, []);

  const fetchListings = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const [listingsRes, statsRes, ebayStatusRes] = await Promise.all([
        listingService.getAll(),
        listingService.getStats(),
        ebayService.getStatus().catch(() => ({ data: { success: false } }))
      ]);
      const listingsData = listingsRes.data.data;
      const statsData = statsRes.data.data.stats;
      const ebayConnected = !!(ebayStatusRes?.data?.success && ebayStatusRes.data.data.connected);

      setListings(listingsData);
      setStats(statsData);
      setIsEbayConnected(ebayConnected);

      // Update cache
      setCache(CACHE_KEY_LISTINGS, listingsData);
      setCache(CACHE_KEY_STATS, statsData);
      setCache(CACHE_KEY_EBAY, ebayConnected);
    } catch (error) {
      console.error("Error fetching listings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (await confirm("Are you sure you want to delete this listing?", { title: 'Delete Listing', destructive: true })) {
      try {
        await listingService.delete(id);
        toast.success("Listing deleted successfully!");
        fetchListings();
      } catch (error) {
        console.error("Error deleting listing:", error);
        toast.error("Failed to delete listing.");
      }
    }
  };

  const handlePublish = async (id) => {
    setPublishingId(id);
    try {
      await listingService.publish(id);
      toast.success("Listing published to eBay successfully!");
      setPreviewListing(null);
      fetchListings();
    } catch (error) {
      console.error("Error publishing listing:", error);
      toast.error(error.response?.data?.message || "Failed to publish listing to eBay.");
    } finally {
      setPublishingId(null);
    }
  };

  const handleVerifyAndOpen = async (listing) => {
    setVerifyingListingId(listing._id);
    try {
      const res = await listingService.verifyLive(listing._id);
      if (res.data?.success) {
        if (res.data.isLive) {
          let url = '';
          if (listing.platform === 'poshmark') url = listing.poshmarkUrl;
          else if (listing.platform === 'ebay') url = listing.ebayUrl;
          else if (listing.platform === 'vinted') url = listing.vintedUrl;
          else if (listing.platform === 'depop') url = listing.depopUrl;
          window.open(url, '_blank');
        } else {
          toast.warning(`Listing was deleted/not found on ${listing.platform}. Status reset to Draft!`);
          setPreviewListing(res.data.data);
          setListings(prev => prev.map(l => l._id === listing._id ? res.data.data : l));
        }
      }
    } catch (err) {
      console.error("Error verifying listing status:", err);
      let url = '';
      if (listing.platform === 'poshmark') url = listing.poshmarkUrl;
      else if (listing.platform === 'ebay') url = listing.ebayUrl;
      else if (listing.platform === 'vinted') url = listing.vintedUrl;
      else if (listing.platform === 'depop') url = listing.depopUrl;
      window.open(url, '_blank');
    } finally {
      setVerifyingListingId(null);
    }
  };

  const handleOpenPreview = async (listing) => {
    try {
      setPreviewListing(listing);
      const res = await listingService.getOne(listing._id);
      if (res.data?.success) {
        setPreviewListing(res.data.data);
      }
    } catch (error) {
      console.error("Error fetching full listing details:", error);
    }
  };

  const handlePoshmarkPublish = async (listing) => {
    const isExtensionInstalled = document.body.dataset.elisterExtensionInstalled === "true";
    if (!isExtensionInstalled) {
      toast.warning("Please install and reload the Elister Chrome Extension to list automatically!");
      return;
    }

    setPoshmarkPublishingId(listing._id);
    try {
      // Fetch full listing details with images and description since list view excludes them
      const res = await listingService.getOne(listing._id);
      if (!res.data?.success || !res.data?.data) {
        throw new Error("Failed to fetch full listing details from server.");
      }
      
      const fullListing = res.data.data;
      
      if (!fullListing.images || fullListing.images.length === 0) {
        toast.warning("Listing has no images. Please add images before publishing!");
        return;
      }

      // Strip HTML tags for Poshmark's text-only description box
      const plainDesc = fullListing.description 
        ? fullListing.description.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '') 
        : '';

      const token = localStorage.getItem('token');
      const backendUrl = import.meta.env.MODE === 'production'
        ? (import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : 'https://api.elister.ai/api')
        : 'http://localhost:5000/api';

      window.postMessage({
        action: 'ELISTER_LIST_ITEM_TRIGGER',
        data: {
          listingId: fullListing._id,
          token,
          backendUrl,
          title: fullListing.title,
          description: plainDesc,
          brand: fullListing.brand || "",
          price: parseFloat(fullListing.price) || 0.0,
          originalPrice: parseFloat(fullListing.originalPrice) || 0.0,
          size: fullListing.size || "OS",
          colors: fullListing.color 
            ? fullListing.color.split(',').map(c => c.trim()).filter(Boolean).slice(0, 2) 
            : [],
          condition: fullListing.conditionId || "uln",
          styleTags: fullListing.styleTag ? fullListing.styleTag.split(',').map(t => t.trim()) : [],
          departmentId: fullListing.departmentId || "01008c10d97b4e1245005764", // Default Men
          categoryId: fullListing.categoryId || "07008c10d97b4e1245005764", // Default Shirts
          subcategoryIds: fullListing.subcategoryIds ? (Array.isArray(fullListing.subcategoryIds) ? fullListing.subcategoryIds : [fullListing.subcategoryIds]) : [],
          images: fullListing.images || []
        }
      }, "*");

      toast.success("Opening Poshmark and launching publisher queue...");
      setPreviewListing(null);
    } catch (err) {
      console.error("Error publishing to Poshmark:", err);
      toast.error("Failed to load listing details. Please try again.");
    } finally {
      setPoshmarkPublishingId(null);
    }
  };

  const handleVintedPublish = async (listing) => {
    const isExtensionInstalled = document.body.dataset.elisterVintedExtensionInstalled === "true";
    if (!isExtensionInstalled) {
      toast.warning("Please install and reload the Elister Vinted Chrome Extension to list automatically!");
      return;
    }

    setVintedPublishingId(listing._id);
    try {
      const res = await listingService.getOne(listing._id);
      if (!res.data?.success || !res.data?.data) {
        throw new Error("Failed to fetch full listing details from server.");
      }
      
      const fullListing = res.data.data;
      
      if (!fullListing.images || fullListing.images.length === 0) {
        toast.warning("Listing has no images. Please add images before publishing!");
        return;
      }

      const plainDesc = fullListing.description 
        ? fullListing.description.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '') 
        : '';

      const token = localStorage.getItem('token');
      const backendUrl = import.meta.env.MODE === 'production'
        ? (import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : 'https://api.elister.ai/api')
        : 'http://localhost:5000/api';

      window.postMessage({
        action: 'ELISTER_VINTED_LIST_ITEM_TRIGGER',
        data: {
          listingId: fullListing._id,
          token,
          backendUrl,
          title: fullListing.title,
          description: plainDesc,
          brand: fullListing.brand || "",
          price: parseFloat(fullListing.price) || 0.0,
          originalPrice: parseFloat(fullListing.originalPrice) || 0.0,
          size: fullListing.size || "",
          color: fullListing.color || "",
          material: fullListing.material || "",
          conditionId: fullListing.conditionId || "very_good",
          categoryId: fullListing.categoryId || "1807",
          isbn: fullListing.isbn || "",
          author: fullListing.author || "",
          bookTitle: fullListing.bookTitle || "",
          videoGameRating: fullListing.videoGameRating || "",
          measurements: fullListing.measurements || "",
          images: fullListing.images || []
        }
      }, "*");

      toast.success("Opening Vinted and launching publisher queue...");
      setPreviewListing(null);
    } catch (err) {
      console.error("Error publishing to Vinted:", err);
      toast.error("Failed to load listing details. Please try again.");
    } finally {
      setVintedPublishingId(null);
    }
  };

  const handleDepopPublish = async (listing) => {
    const isExtensionInstalled = document.body.dataset.elisterDepopExtensionInstalled === "true";
    if (!isExtensionInstalled) {
      toast.warning("Please install and reload the Elister Depop Chrome Extension to list automatically!");
      return;
    }

    setDepopPublishingId(listing._id);
    try {
      const res = await listingService.getOne(listing._id);
      if (!res.data?.success || !res.data?.data) {
        throw new Error("Failed to fetch full listing details from server.");
      }
      
      const fullListing = res.data.data;
      
      if (!fullListing.images || fullListing.images.length === 0) {
        toast.warning("Listing has no images. Please add images before publishing!");
        return;
      }

      const plainDesc = fullListing.description 
        ? fullListing.description.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '') 
        : '';

      const token = localStorage.getItem('token');
      const backendUrl = import.meta.env.MODE === 'production'
        ? (import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : 'https://api.elister.ai/api')
        : 'http://localhost:5000/api';

      window.postMessage({
        action: 'ELISTER_DEPOP_LIST_ITEM_TRIGGER',
        data: {
          listingId: fullListing._id,
          token,
          backendUrl,
          title: fullListing.title,
          description: plainDesc,
          brand: fullListing.brand || "",
          price: parseFloat(fullListing.price) || 0.0,
          originalPrice: parseFloat(fullListing.originalPrice) || 0.0,
          size: fullListing.size || "",
          color: fullListing.color || "",
          material: fullListing.material || "",
          conditionId: fullListing.conditionId || "3000",
          categoryId: fullListing.categoryId || "",
          category: fullListing.category || "",
          allowedAttributes: DEPOP_CATEGORY_MAPPING[fullListing.categoryId] || [],
          age: fullListing.age || "",
          source: fullListing.source || "",
          bodyFit: fullListing.bodyFit || "",
          occasion: fullListing.occasion || "",
          depopType: fullListing.depopType || "",
          fastening: fullListing.fastening || "",
          fit: fullListing.fit || "",
          country: fullListing.country || "US",
          shippingPrice: parseFloat(fullListing.shippingPrice) || 0.0,
          worldwideShipping: !!fullListing.worldwideShipping,
          quantity: parseInt(fullListing.quantity) || 1,
          images: fullListing.images || []
        }
      }, "*");

      toast.success("Opening Depop and launching publisher queue...");
      setPreviewListing(null);
    } catch (err) {
      console.error("Error publishing to Depop:", err);
      toast.error("Failed to load listing details. Please try again.");
    } finally {
      setDepopPublishingId(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'published':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100"><CheckCircle2 size={12} className="mr-1" /> Published</span>;
      case 'draft':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-50 text-slate-600 border border-slate-200"><Clock size={12} className="mr-1" /> Draft</span>;
      case 'scheduled':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-600 border border-amber-100"><Clock size={12} className="mr-1" /> Scheduled</span>;
      case 'failed':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-600 border border-rose-100"><AlertCircle size={12} className="mr-1" /> Failed</span>;
      default:
        return null;
    }
  };

  const getEbayStatusBadge = (status) => {
    switch (status) {
      case 'live':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100"><CheckCircle2 size={12} className="mr-1" /> Live</span>;
      case 'draft':
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-50 text-slate-600 border border-slate-200"><Clock size={12} className="mr-1" /> Draft</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Listings</h1>
          <p className="text-slate-500">Manage and track your eBay inventory.</p>
        </div>
        <div className="flex space-x-3">
          {activeTab === 'ebay' && (
            <button 
              onClick={handleSyncInventory}
              disabled={syncing}
              className="px-6 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 text-sm"
            >
              {syncing ? (
                <>
                  <RefreshCw size={16} className="animate-spin text-slate-500" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw size={16} className="text-slate-500" />
                  Sync with eBay
                </>
              )}
            </button>
          )}
          <div className="flex gap-3">
            {activeTab === 'local' && platformFilter === 'ebay' && selectedListingIds.length > 0 && (
              <button 
                onClick={handleBulkListSelected}
                disabled={isBulkLoading}
                className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md shadow-indigo-100 flex items-center gap-2 text-sm animate-in fade-in slide-in-from-top-1 duration-200"
              >
                {isBulkLoading ? (
                  <>
                    <RefreshCw size={16} className="animate-spin text-white" />
                    Loading Details ({selectedListingIds.length})...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} className="text-white animate-pulse" />
                    Bulk List Selected to eBay ({selectedListingIds.length})
                  </>
                )}
              </button>
            )}
            <button 
              onClick={() => navigate('/create-listing')}
              className="btn-primary"
            >
              Create Listing
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Toggle */}
      {isEbayConnected && (
        <div className="flex border-b border-slate-100 bg-white px-6 rounded-3xl py-1 shadow-sm border border-slate-50 gap-4">
          <button
            onClick={() => setActiveTab('local')}
            className={`px-4 py-3 text-sm font-bold border-b-2 transition-all ${
              activeTab === 'local' 
                ? 'border-indigo-600 text-indigo-600' 
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            Local Database
          </button>
          <button
            onClick={() => setActiveTab('ebay')}
            className={`px-4 py-3 text-sm font-bold border-b-2 transition-all ${
              activeTab === 'ebay' 
                ? 'border-indigo-600 text-indigo-600' 
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            eBay Inventory
          </button>
        </div>
      )}

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-grow w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by title, SKU, Live ID..." 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
          />
        </div>
        <div className="flex space-x-2 w-full md:w-auto items-center">
          <div className="relative w-full md:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full md:w-48 pl-10 pr-8 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 cursor-pointer appearance-none"
            >
              <option value="all">All Statuses</option>
              {activeTab === 'local' ? (
                <>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="failed">Failed</option>
                </>
              ) : (
                <>
                  <option value="draft">eBay Draft</option>
                  <option value="live">eBay Live</option>
                </>
              )}
            </select>
            <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
          {activeTab === 'local' && (
            <div className="relative w-full md:w-auto">
              <select
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value)}
                className="w-full md:w-48 pl-10 pr-8 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 cursor-pointer appearance-none"
              >
                <option value="all">All Platforms</option>
                <option value="ebay">eBay</option>
                <option value="poshmark">Poshmark</option>
                <option value="vinted">Vinted</option>
                <option value="depop">Depop</option>
              </select>
              <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          )}
        </div>
      </div>

      {/* Listings Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {activeTab === 'local' ? (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4">
                    <input 
                      type="checkbox" 
                      className="rounded text-indigo-600 cursor-pointer" 
                      checked={filteredListings.length > 0 && filteredListings.every(l => selectedListingIds.includes(l._id))}
                      onChange={handleToggleSelectAllListings}
                    />
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Product</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Live ID</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Price</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-10 text-center text-slate-400">Loading listings...</td>
                  </tr>
                ) : filteredListings.length > 0 ? (
                  filteredListings.map((listing) => (
                    <tr 
                      key={listing._id} 
                      id={`listing-row-${listing._id}`}
                      className={`transition-all group ${
                        listing._id === highlightId 
                          ? 'bg-indigo-50 border-l-4 border-l-indigo-600 ring-1 ring-indigo-100' 
                          : 'hover:bg-slate-50/50'
                      }`}
                    >
                      <td className="px-6 py-4">
                        <input 
                          type="checkbox" 
                          className="rounded text-indigo-600 cursor-pointer" 
                          checked={selectedListingIds.includes(listing._id)}
                          onChange={() => handleToggleSelectListing(listing._id)}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-slate-100 rounded-lg shrink-0 overflow-hidden">
                            <img src={getImageSrc(listing.thumbnail)} alt="" className="w-full h-full object-cover" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 text-sm line-clamp-1">{listing.title}</span>
                            <span className={`inline-block text-[9px] font-black uppercase px-2 py-0.5 rounded-md mt-1 border ${
                              listing.platform === 'poshmark' 
                                ? 'bg-rose-50 text-rose-600 border-rose-100' 
                                : 'bg-blue-50 text-blue-600 border-blue-100'
                            }`}>
                              {listing.platform || 'ebay'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(listing.status)}</td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-500">
                        {listing.platform === 'poshmark' ? (listing.poshmarkListingId || '-') : (listing.ebayListingId || '-')}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900 text-sm">
                        ${(typeof listing.price === 'number' ? listing.price : parseFloat(listing.price) || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">{new Date(listing.createdAt).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <div className="flex space-x-2">
                          <button 
                            onClick={() => handleOpenPreview(listing)}
                            className="p-2 hover:bg-blue-50 hover:text-blue-600 rounded-lg text-slate-400 transition-all"
                            title="Preview Listing"
                          >
                            <Eye size={16} />
                          </button>
                          <button 
                            onClick={() => navigate(listing.platform === 'vinted' ? `/create-vinted-listing?edit=${listing._id}` : `/create-listing?edit=${listing._id}`)}
                            className="p-2 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-slate-400 transition-all"
                            title="Edit Listing"
                          >
                            <Edit size={16} />
                          </button>
                          {listing.platform === 'poshmark' && listing.poshmarkUrl && (
                            <a href={listing.poshmarkUrl} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-slate-100 hover:text-slate-900 rounded-lg text-slate-400 transition-all" title="View on Poshmark">
                              <ExternalLink size={16} />
                            </a>
                          )}
                          {listing.platform === 'ebay' && listing.ebayUrl && (
                            <a href={listing.ebayUrl} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-slate-100 hover:text-slate-900 rounded-lg text-slate-400 transition-all" title="View on eBay">
                              <ExternalLink size={16} />
                            </a>
                          )}
                          {listing.platform === 'vinted' && listing.vintedUrl && (
                            <a href={listing.vintedUrl} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-slate-100 hover:text-slate-900 rounded-lg text-slate-400 transition-all" title="View on Vinted">
                              <ExternalLink size={16} />
                            </a>
                          )}
                          {listing.platform === 'depop' && listing.depopUrl && (
                            <a href={listing.depopUrl} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-slate-100 hover:text-slate-900 rounded-lg text-slate-400 transition-all" title="View on Depop">
                              <ExternalLink size={16} />
                            </a>
                          )}
                          <button 
                            onClick={() => handleDelete(listing._id)}
                            className="p-2 hover:bg-rose-50 hover:text-rose-600 rounded-lg text-slate-400 transition-all"
                            title="Delete Listing"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="px-6 py-10 text-center text-slate-400">No listings found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-4">
                    <input type="checkbox" className="rounded text-indigo-600" />
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Product</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">SKU</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Price</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Last Synced</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {ebayLoading ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-10 text-center text-slate-400">Loading eBay inventory...</td>
                  </tr>
                ) : filteredEbayProducts.length > 0 ? (
                  filteredEbayProducts.map((product) => (
                    <tr key={product._id} className="hover:bg-slate-50/50 transition-all group">
                      <td className="px-6 py-4">
                        <input type="checkbox" className="rounded text-indigo-600" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-slate-100 rounded-lg shrink-0 overflow-hidden">
                            <img src={getImageSrc(product.thumbnail || (product.images && product.images[0]))} alt="" className="w-full h-full object-cover" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 text-sm line-clamp-1">{product.title}</span>
                            {product.brand && <span className="text-[10px] text-slate-400 block font-semibold">{product.brand}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {getEbayStatusBadge(product.status)}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-500">{product.sku || '-'}</td>
                      <td className="px-6 py-4 font-bold text-slate-900 text-sm">
                        ${(typeof product.selling_price === 'number' ? product.selling_price : parseFloat(product.selling_price) || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">{new Date(product.updated_at).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <div className="flex space-x-2">
                          <button 
                            onClick={() => setPreviewListing({
                              ...product,
                              price: product.selling_price || 0,
                              status: product.status === 'live' ? 'published' : 'draft',
                              ebayListingId: product.ebayListingId,
                              ebayUrl: product.ebayUrl,
                              createdAt: product.updated_at
                            })}
                            className="p-2 hover:bg-blue-50 hover:text-blue-600 rounded-lg text-slate-400 transition-all"
                            title="Preview Sync Detail"
                          >
                            <Eye size={16} />
                          </button>
                          {product.ebayUrl && (
                            <a href={product.ebayUrl} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-slate-100 hover:text-slate-900 rounded-lg text-slate-400 transition-all" title="View on eBay">
                              <ExternalLink size={16} />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="px-6 py-10 text-center text-slate-400">No synced products found. Click "Sync with eBay" to sync.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs font-bold text-slate-500 uppercase">
            {activeTab === 'local' 
              ? `Showing ${filteredListings.length} of ${stats?.total || 0} listings` 
              : `Showing ${filteredEbayProducts.length} synced products`}
          </p>
          <div className="flex space-x-2">
            <button className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold disabled:opacity-50">Prev</button>
            <button className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold hover:bg-slate-100">Next</button>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {previewListing && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Listing Preview</span>
                <h3 className="text-lg font-bold text-slate-950 truncate max-w-lg mt-0.5">{previewListing.title}</h3>
              </div>
              <button 
                onClick={() => setPreviewListing(null)}
                className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-700 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-8">
              {/* Left Column - Gallery & Basic Details */}
              <div className="md:col-span-5 space-y-6">
                {/* Image Gallery */}
                {previewListing.images && previewListing.images.length > 0 ? (
                  <div className="space-y-4">
                    <div className="aspect-[4/3] bg-slate-100 border border-slate-200 rounded-2xl overflow-hidden flex items-center justify-center">
                      <img 
                        src={getImageSrc(activeImage || (previewListing.images && previewListing.images[0]))} 
                        alt="Main Preview" 
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                    {previewListing.images.length > 1 && (
                      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin font-sans">
                        {previewListing.images.map((img, i) => (
                          <button 
                            key={i}
                            onClick={() => setActiveImage(img)}
                            className={`w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                              (activeImage || previewListing.images[0]) === img ? 'border-indigo-600 shadow-md shadow-indigo-100' : 'border-slate-200'
                            }`}
                          >
                            <img src={getImageSrc(img)} className="w-full h-full object-cover" alt="" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="aspect-[4/3] bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 text-sm">
                    No Images Uploaded
                  </div>
                )}

                {/* Logistics */}
                {(previewListing.packageWeight || previewListing.packageDimensions) && (
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3 font-sans">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Logistics & Packaging</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {previewListing.packageWeight && (
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Weight</p>
                          <p className="text-sm font-bold text-slate-800">
                            {previewListing.packageWeight.lbs || 0} lbs {previewListing.packageWeight.oz || 0} oz
                          </p>
                        </div>
                      )}
                      {previewListing.packageDimensions && (
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Dimensions</p>
                          <p className="text-sm font-bold text-slate-800">
                            {previewListing.packageDimensions.length || 0}L x {previewListing.packageDimensions.width || 0}W x {previewListing.packageDimensions.height || 0}H in
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column - Specifics, Pricing & HTML Description */}
              <div className="md:col-span-7 space-y-6 font-sans">
                {/* Meta details */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Status</p>
                    <div className="mt-1">{getStatusBadge(previewListing.status)}</div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      {previewListing.platform === 'poshmark' ? 'Listing Price' : 'Price'}
                    </p>
                    <p className="text-base font-black text-slate-900 mt-1">
                      ${(typeof previewListing.price === 'number' ? previewListing.price : parseFloat(previewListing.price) || 0).toFixed(2)}
                    </p>
                  </div>
                      {(previewListing.platform === 'poshmark' || previewListing.platform === 'vinted' || previewListing.platform === 'depop') && (
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Original Price</p>
                          <p className="text-base font-black text-slate-500 mt-1">
                            ${previewListing.originalPrice ? parseFloat(previewListing.originalPrice || 0).toFixed(2) : '0.00'}
                          </p>
                        </div>
                      )}
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Brand</p>
                        <p className="text-sm font-bold text-slate-800 mt-1 truncate">{previewListing.brand || '-'}</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Color</p>
                        <p className="text-sm font-bold text-slate-800 mt-1 truncate">{previewListing.color || '-'}</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Size</p>
                        <p className="text-sm font-bold text-slate-800 mt-1 truncate">{previewListing.size || '-'}</p>
                      </div>
                      {previewListing.platform !== 'vinted' && (
                        <>
                          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Quantity</p>
                            <p className="text-sm font-bold text-slate-800 mt-1 truncate">{previewListing.quantity || '1'}</p>
                          </div>
                          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Style Tags</p>
                            <p className="text-sm font-bold text-slate-800 mt-1 truncate">{previewListing.styleTag || '-'}</p>
                          </div>
                        </>
                      )}
                      {(previewListing.platform === 'vinted' || previewListing.platform === 'depop') && previewListing.material && (
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Material</p>
                          <p className="text-sm font-bold text-slate-800 mt-1 truncate">{previewListing.material}</p>
                        </div>
                      )}
                      {previewListing.platform === 'depop' && previewListing.age && (
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Age</p>
                          <p className="text-sm font-bold text-slate-800 mt-1 truncate">{previewListing.age}</p>
                        </div>
                      )}
                      {previewListing.platform === 'depop' && previewListing.source && (
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Source</p>
                          <p className="text-sm font-bold text-slate-800 mt-1 truncate">{previewListing.source}</p>
                        </div>
                      )}
                      {previewListing.platform === 'depop' && previewListing.bodyFit && (
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Body Fit</p>
                          <p className="text-sm font-bold text-slate-800 mt-1 truncate">{previewListing.bodyFit}</p>
                        </div>
                      )}
                      {previewListing.platform === 'depop' && previewListing.occasion && (
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Occasion</p>
                          <p className="text-sm font-bold text-slate-800 mt-1 truncate">{previewListing.occasion}</p>
                        </div>
                      )}
                      {previewListing.platform === 'depop' && previewListing.depopType && (
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Depop Type</p>
                          <p className="text-sm font-bold text-slate-800 mt-1 truncate">{previewListing.depopType}</p>
                        </div>
                      )}
                      {previewListing.platform === 'depop' && previewListing.fastening && (
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Fastening</p>
                          <p className="text-sm font-bold text-slate-800 mt-1 truncate">{previewListing.fastening}</p>
                        </div>
                      )}
                      {previewListing.platform === 'depop' && previewListing.fit && (
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Fit</p>
                          <p className="text-sm font-bold text-slate-800 mt-1 truncate">{previewListing.fit}</p>
                        </div>
                      )}
                      {previewListing.measurements && (
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Measurements</p>
                          <p className="text-sm font-bold text-slate-800 mt-1 truncate">{previewListing.measurements}</p>
                        </div>
                      )}
                      {previewListing.isbn && (
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">ISBN</p>
                          <p className="text-sm font-bold text-slate-800 mt-1 truncate">{previewListing.isbn}</p>
                        </div>
                      )}
                      {previewListing.author && (
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Author</p>
                          <p className="text-sm font-bold text-slate-800 mt-1 truncate">{previewListing.author}</p>
                        </div>
                      )}
                      {previewListing.bookTitle && (
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Book Title</p>
                          <p className="text-sm font-bold text-slate-800 mt-1 truncate">{previewListing.bookTitle}</p>
                        </div>
                      )}
                      {previewListing.videoGameRating && (
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Video Game Rating</p>
                          <p className="text-sm font-bold text-slate-800 mt-1 truncate">{previewListing.videoGameRating}</p>
                        </div>
                      )}
                      {previewListing.selectedCondition && (
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Condition</p>
                          <p className="text-sm font-bold text-slate-800 mt-1 truncate">{previewListing.selectedCondition}</p>
                        </div>
                      )}
                      {previewListing.shippingPrice && (
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Shipping Price</p>
                          <p className="text-sm font-bold text-slate-800 mt-1 truncate">
                            ${parseFloat(previewListing.shippingPrice || 0).toFixed(2)}
                          </p>
                        </div>
                      )}
                      {previewListing.worldwideShipping !== undefined && (
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Worldwide Shipping</p>
                          <p className="text-sm font-bold text-slate-800 mt-1 truncate">
                            {previewListing.worldwideShipping ? 'Yes' : 'No'}
                          </p>
                        </div>
                      )}
                      {previewListing.country && (
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Country/Location</p>
                          <p className="text-sm font-bold text-slate-800 mt-1 truncate">{previewListing.country}</p>
                        </div>
                      )}
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">SKU</p>
                    <p className="text-sm font-bold text-slate-800 mt-1 truncate">{previewListing.sku || '-'}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Category</p>
                    <p className="text-sm font-bold text-slate-800 mt-1 truncate">{previewListing.category || '-'}</p>
                  </div>
                </div>

                {/* Condition note */}
                {previewListing.platform !== 'poshmark' && previewListing.conditionNote && (
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Condition Note</p>
                    <p className="text-sm text-slate-700 mt-1 leading-relaxed">{previewListing.conditionNote}</p>
                  </div>
                )}

                {/* Item Specifics */}
                {previewListing.platform !== 'poshmark' && previewListing.platform !== 'vinted' && previewListing.platform !== 'depop' && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-sans">Item Specifics</h4>
                    {previewListing.itemSpecifics && Object.keys(previewListing.itemSpecifics).length > 0 ? (
                      <div className="grid grid-cols-2 gap-3">
                        {Object.entries(previewListing.itemSpecifics).map(([key, val]) => {
                          const displayVal = Array.isArray(val) ? val.join(', ') : val;
                          return (
                            <div key={key} className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between items-center">
                              <span className="text-xs font-bold text-slate-500">{key}</span>
                              <span className="text-xs font-extrabold text-slate-800 text-right truncate max-w-[150px]">{displayVal || '-'}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No specifics configured.</p>
                    )}
                  </div>
                )}

                {/* Description Template */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-sans">Description</h4>
                  <div 
                    className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700 max-h-[300px] overflow-y-auto font-sans leading-relaxed prose prose-slate max-w-none"
                    style={{ whiteSpace: 'pre-wrap' }}
                    dangerouslySetInnerHTML={{ __html: previewListing.description }}
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-3 font-sans">
              <button 
                onClick={() => setPreviewListing(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-all"
              >
                Close
              </button>
              {previewListing.platform === 'poshmark' && (
                <button 
                  onClick={() => {
                    if (previewListing.status === 'published' && previewListing.poshmarkUrl) {
                      handleVerifyAndOpen(previewListing);
                    } else {
                      handlePoshmarkPublish(previewListing);
                    }
                  }}
                  disabled={poshmarkPublishingId === previewListing._id || verifyingListingId === previewListing._id}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 disabled:opacity-50"
                >
                  {verifyingListingId === previewListing._id ? (
                    <>
                      <div className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></div>
                      Verifying...
                    </>
                  ) : poshmarkPublishingId === previewListing._id ? (
                    <>
                      <div className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></div>
                      Listing...
                    </>
                  ) : (
                    'List to Poshmark (API)'
                  )}
                </button>
              )}
              {previewListing.platform === 'ebay' && (
                <button 
                  onClick={() => {
                    if (previewListing.status === 'published' && previewListing.ebayUrl) {
                      handleVerifyAndOpen(previewListing);
                    } else {
                      handlePublish(previewListing._id);
                    }
                  }}
                  disabled={publishingId === previewListing._id || verifyingListingId === previewListing._id}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 disabled:opacity-50"
                >
                  {verifyingListingId === previewListing._id ? (
                    <>
                      <div className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></div>
                      Verifying...
                    </>
                  ) : publishingId === previewListing._id ? (
                    <>
                      <div className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></div>
                      Listing...
                    </>
                  ) : (
                    'List to eBay (API)'
                  )}
                </button>
              )}
              {previewListing.platform === 'vinted' && (
                <button 
                  onClick={() => {
                    if (previewListing.status === 'published' && previewListing.vintedUrl) {
                      handleVerifyAndOpen(previewListing);
                    } else {
                      handleVintedPublish(previewListing);
                    }
                  }}
                  disabled={vintedPublishingId === previewListing._id || verifyingListingId === previewListing._id}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {verifyingListingId === previewListing._id ? (
                    <>
                      <div className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Verifying...
                    </>
                  ) : vintedPublishingId === previewListing._id ? (
                    <>
                      <div className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Listing...
                    </>
                  ) : previewListing.status === 'published' && previewListing.vintedUrl ? (
                    'View on Vinted'
                  ) : (
                    'List to Vinted (API)'
                  )}
                </button>
              )}
              {previewListing.platform === 'depop' && (
                <button 
                  onClick={() => {
                    if (previewListing.status === 'published' && previewListing.depopUrl) {
                      handleVerifyAndOpen(previewListing);
                    } else {
                      handleDepopPublish(previewListing);
                    }
                  }}
                  disabled={depopPublishingId === previewListing._id || verifyingListingId === previewListing._id}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {verifyingListingId === previewListing._id ? (
                    <>
                      <div className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Verifying...
                    </>
                  ) : depopPublishingId === previewListing._id ? (
                    <>
                      <div className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Listing...
                    </>
                  ) : previewListing.status === 'published' && previewListing.depopUrl ? (
                    'View on Depop'
                  ) : (
                    'List to Depop (API)'
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Listings;
