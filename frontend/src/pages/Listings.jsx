import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
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
  RefreshCw
} from 'lucide-react';
import { listingService, ebayService } from '../services/api';

const getImageSrc = (src) => {
  if (!src) return 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60';
  if (typeof src === 'string' && src.startsWith('blob:')) {
    return 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60';
  }
  return src;
};

const Listings = () => {
  const navigate = useNavigate();
  const [selectedListings, setSelectedListings] = useState([]);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [previewListing, setPreviewListing] = useState(null);
  const [activeImage, setActiveImage] = useState(null);
  const [publishingId, setPublishingId] = useState(null);
  
  // eBay Sync and display state
  const [isEbayConnected, setIsEbayConnected] = useState(false);
  const [activeTab, setActiveTab] = useState('local'); // 'local' or 'ebay'
  const [ebayProducts, setEbayProducts] = useState([]);
  const [ebayLoading, setEbayLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    setSearchTerm('');
    setStatusFilter('all');
  }, [activeTab]);

  useEffect(() => {
    if (previewListing && previewListing.images && previewListing.images.length > 0) {
      setActiveImage(previewListing.images[0]);
    } else {
      setActiveImage(null);
    }
  }, [previewListing]);

  const filteredListings = listings.filter((listing) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      !searchTerm ||
      (listing.title && listing.title.toLowerCase().includes(term)) ||
      (listing.sku && listing.sku.toLowerCase().includes(term)) ||
      (listing.ebayListingId && listing.ebayListingId.toLowerCase().includes(term));
    const matchesStatus = statusFilter === 'all' || listing.status === statusFilter;
    return matchesSearch && matchesStatus;
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
        alert(`Successfully synced ${res.data.count} items from eBay!`);
        fetchEbayInventory();
      }
    } catch (error) {
      console.error("Error syncing eBay inventory:", error);
      alert("Failed to sync inventory from eBay.");
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchListings();
  }, []);

  const fetchListings = async () => {
    try {
      const [listingsRes, statsRes, ebayStatusRes] = await Promise.all([
        listingService.getAll(),
        listingService.getStats(),
        ebayService.getStatus().catch(() => ({ data: { success: false } }))
      ]);
      setListings(listingsRes.data.data);
      setStats(statsRes.data.data.stats);
      if (ebayStatusRes?.data?.success && ebayStatusRes.data.data.connected) {
        setIsEbayConnected(true);
      }
    } catch (error) {
      console.error("Error fetching listings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this listing?")) {
      try {
        await listingService.delete(id);
        alert("Listing deleted successfully!");
        fetchListings();
      } catch (error) {
        console.error("Error deleting listing:", error);
        alert("Failed to delete listing.");
      }
    }
  };

  const handlePublish = async (id) => {
    setPublishingId(id);
    try {
      await listingService.publish(id);
      alert("Listing published to eBay successfully!");
      setPreviewListing(null);
      fetchListings();
    } catch (error) {
      console.error("Error publishing listing:", error);
      alert(error.response?.data?.message || "Failed to publish listing to eBay.");
    } finally {
      setPublishingId(null);
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
          <button 
            onClick={() => navigate('/create-listing')}
            className="btn-primary"
          >
            Create Listing
          </button>
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
            placeholder="Search by title, SKU, eBay ID..." 
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
                    <input type="checkbox" className="rounded text-indigo-600" />
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Product</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">eBay ID</th>
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
                    <tr key={listing._id} className="hover:bg-slate-50/50 transition-all group">
                      <td className="px-6 py-4">
                        <input type="checkbox" className="rounded text-indigo-600" />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-slate-100 rounded-lg shrink-0 overflow-hidden">
                            <img src={getImageSrc(listing.images && listing.images[0])} alt="" className="w-full h-full object-cover" />
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
                            onClick={() => setPreviewListing(listing)}
                            className="p-2 hover:bg-blue-50 hover:text-blue-600 rounded-lg text-slate-400 transition-all"
                            title="Preview Listing"
                          >
                            <Eye size={16} />
                          </button>
                          <button 
                            onClick={() => navigate(`/create-listing?edit=${listing._id}`)}
                            className="p-2 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-slate-400 transition-all"
                            title="Edit Listing"
                          >
                            <Edit size={16} />
                          </button>
                          {listing.platform === 'poshmark' ? (
                            listing.poshmarkUrl && (
                              <a href={listing.poshmarkUrl} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-slate-100 hover:text-slate-900 rounded-lg text-slate-400 transition-all" title="View on Poshmark">
                                <ExternalLink size={16} />
                              </a>
                            )
                          ) : (
                            listing.ebayUrl && (
                              <a href={listing.ebayUrl} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-slate-100 hover:text-slate-900 rounded-lg text-slate-400 transition-all" title="View on eBay">
                                <ExternalLink size={16} />
                              </a>
                            )
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
                            <img src={getImageSrc(product.images && product.images[0])} alt="" className="w-full h-full object-cover" />
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
                  {previewListing.platform === 'poshmark' && (
                    <>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Original Price</p>
                        <p className="text-base font-black text-slate-500 mt-1">
                          ${previewListing.originalPrice ? parseFloat(previewListing.originalPrice || 0).toFixed(2) : '0.00'}
                        </p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Brand</p>
                        <p className="text-sm font-bold text-slate-800 mt-1 truncate">{previewListing.brand || '-'}</p>
                      </div>
                    </>
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

                {/* Description Template */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-sans">HTML Description</h4>
                  <div 
                    className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700 max-h-[300px] overflow-y-auto font-sans leading-relaxed prose prose-slate max-w-none"
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
              {previewListing.platform === 'poshmark' ? (
                <button 
                  onClick={() => {
                    const plainDescription = previewListing.description.replace(/<[^>]*>/g, '');
                    const brandVal = previewListing.brand || 'Generic';
                    const listingPriceVal = previewListing.price || '0.00';
                    const originalPriceVal = previewListing.originalPrice || '0.00';
                    const copyText = `Title: ${previewListing.title}\nBrand: ${brandVal}\nListing Price: $${listingPriceVal}\nOriginal Price: $${originalPriceVal}\n\nDescription:\n${plainDescription}`;
                    navigator.clipboard.writeText(copyText);
                    alert('Listing details copied to clipboard!');
                  }}
                  className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100 flex items-center gap-2"
                >
                  Copy Details
                </button>
              ) : (
                previewListing.status !== 'published' && (
                  <button 
                    onClick={() => handlePublish(previewListing._id)}
                    disabled={publishingId === previewListing._id}
                    className="btn-primary py-2 px-6 flex items-center justify-center gap-2 min-w-[120px] disabled:opacity-50"
                  >
                    {publishingId === previewListing._id ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Listing...
                      </>
                    ) : (
                      'List by API'
                    )}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Listings;
