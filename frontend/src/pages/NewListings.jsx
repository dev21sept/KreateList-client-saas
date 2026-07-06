import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  ChevronDown, 
  SlidersHorizontal, 
  MoreHorizontal, 
  ChevronLeft, 
  ChevronRight, 
  AlertCircle,
  Edit,
  Trash2,
  Eye,
  ExternalLink
} from 'lucide-react';
import { listingService } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import CrosslistingModal from '../components/CrosslistingModal';

// Fallback listing data mimicking screenshot exactly if backend has no listings
const MOCK_LISTINGS = [
  {
    _id: 'mock-1',
    title: "Nike Air Max 90 White Men's Size 10 - Classic Running Shoes with Air Cushion Comfort and...",
    sku: "SKU-1001",
    quantity: 2,
    status: "Active",
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2h ago
    thumbnail: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=150&q=80',
    images: ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80'],
    platform: 'ebay',
    ebayListingId: 'ebay-1',
    ebayUrl: 'https://ebay.com',
    poshmarkListingId: 'poshmark-1',
    poshmarkUrl: 'https://poshmark.com',
    depopListingId: 'depop-1',
    depopUrl: 'https://depop.com',
    vintedListingId: 'vinted-1',
    vintedUrl: 'https://vinted.com',
  },
  {
    _id: 'mock-2',
    title: "Vintage Levi's Denim Jacket Large - Classic Blue Jean Trucker Jacket for Men Retro Style",
    sku: "SKU-1002",
    quantity: 1,
    status: "Active",
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4h ago
    thumbnail: 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=150&q=80',
    images: ['https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=800&q=80'],
    platform: 'poshmark',
    ebayListingId: 'ebay-2',
    ebayUrl: 'https://ebay.com',
    poshmarkListingId: 'poshmark-2',
    poshmarkUrl: 'https://poshmark.com',
    depopListingId: 'depop-2',
    depopUrl: 'https://depop.com',
    vintedListingId: 'vinted-2',
    vintedUrl: 'https://vinted.com',
  },
  {
    _id: 'mock-3',
    title: "Apple AirPods Pro 2nd Generation with MagSafe Charging Case - USB-C - Active Noise Cancelling",
    sku: "SKU-1003",
    quantity: 3,
    status: "Draft",
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
    thumbnail: 'https://images.unsplash.com/photo-1588449668338-d1f176363c44?w=150&q=80',
    images: ['https://images.unsplash.com/photo-1588449668338-d1f176363c44?w=800&q=80'],
    platform: 'ebay',
    ebayListingId: '',
    poshmarkListingId: '',
    depopListingId: '',
    vintedListingId: '',
  },
  {
    _id: 'mock-4',
    title: "Louis Vuitton Neverfull MM Damier Ebene Tote Bag - Authentic LV Shoulder Bag for Women",
    sku: "SKU-1004",
    quantity: 1,
    status: "Active",
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3h ago
    thumbnail: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=150&q=80',
    images: ['https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&q=80'],
    platform: 'ebay',
    ebayListingId: 'ebay-4',
    ebayUrl: 'https://ebay.com',
    poshmarkListingId: 'poshmark-4',
    poshmarkUrl: 'https://poshmark.com',
    depopListingId: 'depop-4',
    depopUrl: 'https://depop.com',
    vintedListingId: 'vinted-4',
    vintedUrl: 'https://vinted.com',
  },
  {
    _id: 'mock-5',
    title: "Canon EOS Rebel T7 DSLR Camera with 18-55mm Lens - 24.1MP Full HD Video Photography Kit",
    sku: "SKU-1005",
    quantity: 2,
    status: "Active",
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1h ago
    thumbnail: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=150&q=80',
    images: ['https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&q=80'],
    platform: 'ebay',
    ebayListingId: 'ebay-5',
    ebayUrl: 'https://ebay.com',
    poshmarkListingId: 'poshmark-5',
    poshmarkUrl: 'https://poshmark.com',
    depopListingId: 'depop-5',
    depopUrl: 'https://depop.com',
    vintedListingId: 'vinted-5',
    vintedUrl: 'https://vinted.com',
  },
  {
    _id: 'mock-6',
    title: "Yeezy Boost 350 V2 Zebra Size 9 - Authentic adidas Primeknit Sneakers White Black",
    sku: "SKU-1006",
    quantity: 1,
    status: "Active",
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5h ago
    thumbnail: 'https://images.unsplash.com/photo-1556906781-9a412961c28c?w=150&q=80',
    images: ['https://images.unsplash.com/photo-1556906781-9a412961c28c?w=800&q=80'],
    platform: 'ebay',
    ebayListingId: 'ebay-6',
    ebayUrl: 'https://ebay.com',
    poshmarkListingId: 'poshmark-6',
    poshmarkUrl: 'https://poshmark.com',
    depopListingId: '', // Not Listed
    vintedListingId: 'vinted-6',
    vintedUrl: 'https://vinted.com',
  },
  {
    _id: 'mock-7',
    title: "Seiko 5 Automatic Watch SNK809 - Men's Stainless Steel Black Dial Analog Wristwatch",
    sku: "SKU-1007",
    quantity: 1,
    status: "Active",
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2h ago
    thumbnail: 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=150&q=80',
    images: ['https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=800&q=80'],
    platform: 'ebay',
    ebayListingId: 'ebay-7',
    ebayUrl: 'https://ebay.com',
    poshmarkListingId: 'poshmark-7',
    poshmarkUrl: 'https://poshmark.com',
    depopListingId: 'depop-7',
    depopUrl: 'https://depop.com',
    vintedListingId: 'vinted-7',
    vintedUrl: 'https://vinted.com',
  },
  {
    _id: 'mock-8',
    title: "Funko Pop! Star Wars Darth Vader #01 - Vinyl Bobble-Head Collectible Figure",
    sku: "SKU-1008",
    quantity: 3,
    status: "Active",
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6h ago
    thumbnail: 'https://images.unsplash.com/photo-1608889174633-56ad0f24248a?w=150&q=80',
    images: ['https://images.unsplash.com/photo-1608889174633-56ad0f24248a?w=800&q=80'],
    platform: 'ebay',
    ebayListingId: 'ebay-8',
    ebayUrl: 'https://ebay.com',
    poshmarkListingId: 'poshmark-8',
    poshmarkUrl: 'https://poshmark.com',
    depopListingId: 'depop-8',
    depopUrl: 'https://depop.com',
    vintedListingId: '', // Not Listed
  }
];

const NewListings = () => {
  const navigate = useNavigate();
  const { toast, confirm } = useNotification();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

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

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Crosslisting Modal States
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState(null);
  const [selectedPlatform, setSelectedPlatform] = useState('');

  // Pagination Mock
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchListings = async () => {
    setLoading(true);
    try {
      const [listingsRes, statsRes] = await Promise.all([
        listingService.getAll().catch(() => ({ data: { success: false, data: [] } })),
        listingService.getStats().catch(() => ({ data: { success: false, data: { stats: null } } }))
      ]);

      let backendListings = [];
      if (listingsRes.data?.success && listingsRes.data.data.length > 0) {
        backendListings = listingsRes.data.data.map(l => ({
          ...l,
          status: l.status ? (l.status === 'published' ? 'Active' : l.status.charAt(0).toUpperCase() + l.status.slice(1)) : 'Draft'
        }));
      }

      setListings(backendListings);

      if (statsRes.data?.success && statsRes.data.data?.stats) {
        setStats(statsRes.data.data.stats);
      } else {
        // Compute stats from backendListings if stats API fails
        const total = backendListings.length;
        const active = backendListings.filter(l => l.status === 'Active').length;
        const draft = backendListings.filter(l => l.status === 'Draft').length;
        const failed = backendListings.filter(l => l.status === 'Failed').length;
        setStats({
          total,
          published: active,
          draft,
          failed,
          unlisted: total - active
        });
      }
    } catch (error) {
      console.error('Error loading listings:', error);
      setListings(MOCK_LISTINGS);
      setStats({
        total: 2456,
        published: 1982,
        draft: 215,
        failed: 70,
        unlisted: 189
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchListings();
  }, []);

  const handleOpenCrosslisting = (listing, platform) => {
    setSelectedListing(listing);
    setSelectedPlatform(platform);
    setModalOpen(true);
  };

  // Filter listings
  const filteredListings = listings.filter((item) => {
    const matchesSearch = 
      item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = 
      statusFilter === 'all' || 
      item.status?.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  // Helper for computing last updated string
  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return 'Yesterday';
    const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000);
    let interval = Math.floor(seconds / 31536000);

    if (interval >= 1) return `${interval}y ago`;
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) return `${interval}mo ago`;
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) return `${interval}d ago`;
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) return `${interval}h ago`;
    interval = Math.floor(seconds / 60);
    if (interval >= 1) return `${interval}m ago`;
    return 'Just now';
  };

  // Handle clear filters
  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
  };

  // Render cross-listing badges
  const renderCrosslistingCell = (item, platformName, checkId, logoSrc) => {
    const isDraft = item.platform === platformName && item.status?.toLowerCase() === 'draft';
    const isListed = !!checkId;
    const isNotListed = !isListed && !isDraft;

    if (isListed) {
      return (
        <div className="flex flex-col items-center justify-center py-1 select-none">
          <div className="w-8 h-8 rounded-full border border-slate-100 flex items-center justify-center bg-white shadow-sm shrink-0">
            <img src={logoSrc} className="w-5 h-5 object-contain" alt={platformName} />
          </div>
          <span className="text-[10px] font-black text-emerald-600 mt-1 select-none">Listed</span>
        </div>
      );
    } else if (isDraft) {
      return (
        <div className="flex flex-col items-center justify-center py-1 select-none">
          <div className="w-8 h-8 rounded-full border border-orange-100 flex items-center justify-center bg-white shadow-sm shrink-0">
            <img src={logoSrc} className="w-5 h-5 object-contain" alt={platformName} />
          </div>
          <span className="text-[10px] font-black text-orange-500 mt-1 select-none">Draft</span>
        </div>
      );
    } else {
      // Not Listed status
      return (
        <div 
          onClick={() => handleOpenCrosslisting(item, platformName)}
          className="flex flex-col items-center justify-center py-1 cursor-pointer group hover:scale-105 transition-all select-none"
        >
          <div className="w-8 h-8 rounded-full border border-[#f3f4f6] flex items-center justify-center bg-[#fcfcff] text-[#9ca3af] shadow-sm shrink-0 group-hover:bg-indigo-50 group-hover:text-indigo-600 group-hover:border-indigo-100">
            {/* Custom generic shop/building logo for grey placeholder */}
            <svg className="w-4 h-4 opacity-40 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <span className="text-[10px] font-bold text-slate-400 group-hover:text-indigo-600 mt-1 select-none transition-colors">Not Listed</span>
        </div>
      );
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* STATS BANNER */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
        
        {/* Total Listings */}
        <div className="bg-white p-6 rounded-3xl border border-[#f1f3f9] shadow-sm flex flex-col justify-between h-36">
          <div className="flex justify-between items-start">
            <div className="bg-violet-50 p-3 rounded-2xl text-indigo-600">
              <SlidersHorizontal size={20} />
            </div>
            <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 flex items-center gap-1">
              ↑ 12% <span className="text-slate-400 font-semibold lowercase">vs 7d</span>
            </span>
          </div>
          <div>
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Listings</h3>
            <p className="text-2xl font-black text-[#111827] mt-1">{(stats?.total ?? 0).toLocaleString()}</p>
          </div>
        </div>

        {/* Active */}
        <div className="bg-white p-6 rounded-3xl border border-[#f1f3f9] shadow-sm flex flex-col justify-between h-36">
          <div className="flex justify-between items-start">
            <div className="bg-emerald-50 p-3 rounded-2xl text-emerald-600">
              {/* Checkmark icon for active */}
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 flex items-center gap-1">
              ↑ 8% <span className="text-slate-400 font-semibold lowercase">vs 7d</span>
            </span>
          </div>
          <div>
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">Active</h3>
            <p className="text-2xl font-black text-[#111827] mt-1">{(stats?.published ?? 0).toLocaleString()}</p>
          </div>
        </div>

        {/* Drafts */}
        <div className="bg-white p-6 rounded-3xl border border-[#f1f3f9] shadow-sm flex flex-col justify-between h-36">
          <div className="flex justify-between items-start">
            <div className="bg-amber-50 p-3 rounded-2xl text-amber-600">
              {/* File Icon */}
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 flex items-center gap-1">
              ↓ 5% <span className="text-slate-400 font-semibold lowercase">vs 7d</span>
            </span>
          </div>
          <div>
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">Drafts</h3>
            <p className="text-2xl font-black text-[#111827] mt-1">{(stats?.draft ?? 0).toLocaleString()}</p>
          </div>
        </div>

        {/* Errors */}
        <div className="bg-white p-6 rounded-3xl border border-[#f1f3f9] shadow-sm flex flex-col justify-between h-36">
          <div className="flex justify-between items-start">
            <div className="bg-rose-50 p-3 rounded-2xl text-rose-600">
              <AlertCircle size={20} />
            </div>
            <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 flex items-center gap-1">
              ↓ 8% <span className="text-slate-400 font-semibold lowercase">vs 7d</span>
            </span>
          </div>
          <div>
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">Errors</h3>
            <p className="text-2xl font-black text-[#111827] mt-1">{(stats?.failed ?? 0).toLocaleString()}</p>
          </div>
        </div>

        {/* Unlisted */}
        <div className="bg-white p-6 rounded-3xl border border-[#f1f3f9] shadow-sm flex flex-col justify-between h-36">
          <div className="flex justify-between items-start">
            <div className="bg-slate-50 p-3 rounded-2xl text-slate-500">
              {/* Eye-off icon */}
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            </div>
            <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 flex items-center gap-1">
              ↑ 3% <span className="text-slate-400 font-semibold lowercase">vs 7d</span>
            </span>
          </div>
          <div>
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">Unlisted</h3>
            <p className="text-2xl font-black text-[#111827] mt-1">{(stats?.unlisted ?? 0).toLocaleString()}</p>
          </div>
        </div>

      </div>

      {/* FILTER / SEARCH ROW */}
      <div className="bg-white p-4 rounded-3xl border border-[#f1f3f9] shadow-sm flex flex-col lg:flex-row items-center justify-between gap-4">
        
        {/* Search Input */}
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 pointer-events-none" />
          <input 
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search listings..."
            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-100 focus:bg-white rounded-2xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400"
          />
        </div>

        {/* Dropdowns & Link options */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Status Dropdown */}
          <div className="relative">
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none pl-4 pr-10 py-2.5 bg-white border border-[#e5e7eb] hover:border-indigo-200 rounded-2xl text-xs font-extrabold text-slate-700 cursor-pointer outline-none transition-all"
            >
              <option value="all">Status</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="failed">Error</option>
            </select>
            <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>

          {/* Price Dropdown */}
          <div className="relative">
            <button className="flex items-center gap-2 pl-4 pr-10 py-2.5 bg-white border border-[#e5e7eb] hover:border-indigo-200 rounded-2xl text-xs font-extrabold text-slate-700 cursor-pointer transition-all">
              Price
              <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </button>
          </div>

          {/* More Filters */}
          <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[#e5e7eb] hover:border-indigo-200 rounded-2xl text-xs font-extrabold text-slate-700 transition-all">
            <SlidersHorizontal size={14} className="text-slate-400" />
            More Filters
          </button>

          {/* Clear filter button */}
          {(searchTerm || statusFilter !== 'all') && (
            <button 
              onClick={handleClearFilters}
              className="text-xs font-extrabold text-indigo-600 hover:text-indigo-700 hover:underline px-2 transition-all cursor-pointer"
            >
              Clear
            </button>
          )}

          {/* Sort dropdown */}
          <div className="relative ml-auto lg:ml-0">
            <button className="flex items-center gap-2 pl-4 pr-10 py-2.5 bg-white border border-[#e5e7eb] hover:border-indigo-200 rounded-2xl text-xs font-extrabold text-slate-700 transition-all">
              Sort: Newest
              <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </button>
          </div>
        </div>

      </div>

      {/* TABLE */}
      <div className="bg-white rounded-3xl border border-[#f1f3f9] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            
            {/* Headers */}
            <thead>
              <tr className="bg-[#fcfcff] border-b border-[#f3f4f6]">
                <th className="px-6 py-4.5 w-12 text-center">
                  <input type="checkbox" className="w-4 h-4 text-indigo-600 border-[#d1d5db] rounded focus:ring-indigo-500 cursor-pointer" />
                </th>
                <th className="px-6 py-4.5 text-xs font-black text-slate-400 uppercase tracking-wider">Item</th>
                <th className="px-6 py-4.5 text-xs font-black text-slate-400 uppercase tracking-wider">SKU</th>
                <th className="px-6 py-4.5 text-xs font-black text-slate-400 uppercase tracking-wider text-center">Qty</th>
                <th className="px-6 py-4.5 text-xs font-black text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4.5 text-xs font-black text-slate-400 uppercase tracking-wider">Last Updated</th>
                <th className="px-6 py-4.5 text-xs font-black text-slate-400 uppercase tracking-wider text-center border-l border-[#f3f4f6]" colSpan="4">
                  Cross-listed On
                </th>
                <th className="px-6 py-4.5 text-xs font-black text-slate-400 uppercase tracking-wider text-center">Actions</th>
              </tr>
              {/* Platform subheaders matching image */}
              <tr className="bg-[#fcfcff] border-b border-[#f3f4f6] text-[10px] font-extrabold text-slate-400 select-none">
                <th colSpan="6" />
                <th className="py-2.5 text-center border-l border-[#f3f4f6] w-20">eBay</th>
                <th className="py-2.5 text-center w-20">Poshmark</th>
                <th className="py-2.5 text-center w-20">Depop</th>
                <th className="py-2.5 text-center w-20">Vinted</th>
                <th />
              </tr>
            </thead>

            {/* Rows */}
            <tbody className="divide-y divide-[#f8fafc]">
              {loading ? (
                <tr>
                  <td colSpan="11" className="px-6 py-16 text-center text-slate-400 font-semibold">
                    Loading inventory data...
                  </td>
                </tr>
              ) : filteredListings.length > 0 ? (
                filteredListings.slice(0, itemsPerPage).map((item) => (
                  <tr key={item._id} className="hover:bg-[#fafbfe]/40 transition-colors">
                    
                    {/* Checkbox */}
                    <td className="px-6 py-4.5 text-center">
                      <input type="checkbox" className="w-4 h-4 text-indigo-600 border-[#d1d5db] rounded focus:ring-indigo-500 cursor-pointer" />
                    </td>

                    {/* Item */}
                    <td className="px-6 py-4.5 max-w-sm">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-[#f3f4f6] rounded-xl overflow-hidden shrink-0 shadow-inner flex items-center justify-center border border-[#e5e7eb]">
                          {item.thumbnail ? (
                            <img src={item.thumbnail} className="w-full h-full object-cover" alt="" />
                          ) : (
                            <span className="text-slate-300 font-bold text-xs">No img</span>
                          )}
                        </div>
                        <span className="font-extrabold text-slate-800 text-xs line-clamp-2 leading-relaxed">
                          {item.title}
                        </span>
                      </div>
                    </td>

                    {/* SKU */}
                    <td className="px-6 py-4.5">
                      <span className="font-mono text-xs font-bold text-slate-500">{item.sku || '-'}</span>
                    </td>

                    {/* Qty */}
                    <td className="px-6 py-4.5 text-center">
                      <span className="text-xs font-extrabold text-slate-700">{item.quantity || 1}</span>
                    </td>

                    {/* Status badge */}
                    <td className="px-6 py-4.5">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold ${
                        item.status === 'Active' ? 'bg-[#e6f4ea] text-[#137333]' : 
                        item.status === 'Draft' ? 'bg-[#fef7e0] text-[#b06000]' : 
                        'bg-rose-50 text-rose-600'
                      }`}>
                        {item.status || 'Draft'}
                      </span>
                    </td>

                    {/* Last Updated */}
                    <td className="px-6 py-4.5">
                      <span className="text-xs font-semibold text-slate-400">
                        {formatTimeAgo(item.createdAt)}
                      </span>
                    </td>

                    {/* Crosslisting cell components: eBay, Poshmark, Depop, Vinted */}
                    <td className="border-l border-[#f3f4f6]">
                      {renderCrosslistingCell(item, 'ebay', item.ebayListingId, '/ebay.png')}
                    </td>
                    <td>
                      {renderCrosslistingCell(item, 'poshmark', item.poshmarkListingId, '/poshmark.png')}
                    </td>
                    <td>
                      {renderCrosslistingCell(item, 'depop', item.depopListingId, '/depop.png')}
                    </td>
                    <td className="border-r border-[#f3f4f6]">
                      {renderCrosslistingCell(item, 'vinted', item.vintedListingId, '/vinted.jpg')}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4.5 text-center">
                      <div className="flex justify-center items-center gap-2">
                        <button 
                          onClick={() => navigate(item.platform === 'vinted' ? `/create-vinted-listing?edit=${item._id}` : `/create-listing?edit=${item._id}`)}
                          className="p-1.5 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl text-slate-400 transition-all cursor-pointer"
                          title="Edit Listing"
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(item._id)}
                          className="p-1.5 hover:bg-rose-50 hover:text-rose-600 rounded-xl text-slate-400 transition-all cursor-pointer"
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
                  <td colSpan="11" className="px-6 py-16 text-center text-slate-400">
                    No listings found matching filter constraints.
                  </td>
                </tr>
              )}
            </tbody>

          </table>
        </div>

        {/* Bottom Pagination */}
        <div className="px-6 py-4 bg-[#fcfcff] border-t border-[#f3f4f6] flex items-center justify-between">
          <p className="text-xs font-extrabold text-slate-400 select-none">
            Showing 1 to {Math.min(filteredListings.length, itemsPerPage)} of {filteredListings.length.toLocaleString()} listings
          </p>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="p-1.5 bg-white border border-[#e5e7eb] rounded-lg text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                disabled={currentPage === 1}
              >
                <ChevronLeft size={16} />
              </button>
              
              <button className="w-8 h-8 flex items-center justify-center rounded-lg border-2 border-indigo-600 bg-white text-indigo-600 font-extrabold text-xs">
                1
              </button>
              <button className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50 font-bold text-xs">
                2
              </button>
              <button className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50 font-bold text-xs">
                3
              </button>
              <span className="px-1 text-slate-400 text-xs font-extrabold">...</span>
              <button className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50 font-bold text-xs">
                307
              </button>

              <button 
                onClick={() => setCurrentPage(prev => prev + 1)}
                className="p-1.5 bg-white border border-[#e5e7eb] rounded-lg text-slate-500 hover:bg-slate-50"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* page count indicator */}
            <div className="relative">
              <button className="flex items-center gap-2 px-3 py-1.5 bg-white border border-[#e5e7eb] hover:border-indigo-200 rounded-lg text-xs font-bold text-slate-700">
                10 / page
                <ChevronDown size={14} className="text-slate-400" />
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Crosslisting Modal */}
      <CrosslistingModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedListing(null);
        }}
        listing={selectedListing}
        platform={selectedPlatform}
        onSyncSuccess={fetchListings}
      />

    </div>
  );
};

export default NewListings;
