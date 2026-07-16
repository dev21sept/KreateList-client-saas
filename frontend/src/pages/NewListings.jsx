/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps, no-unused-vars */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  ChevronDown, 
  SlidersHorizontal, 
  ChevronLeft, 
  ChevronRight, 
  AlertCircle,
  Edit,
  Trash2,
  ExternalLink,
  RefreshCw,
  X,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { listingService, ebayService, externalImportService, etsyService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import CrosslistingModal from '../components/CrosslistingModal';
import { DEPOP_CATEGORY_MAPPING } from '../constants/depopCategoryAttributes';
import { DEPOP_BRANDS } from '../constants/depopBrands';
const getDepopBrandId = (brandName) => {
  if (!brandName) return 'unbranded';
  const clean = brandName.trim().toLowerCase();
  const found = DEPOP_BRANDS.find(b => b.label.toLowerCase() === clean || b.id.toLowerCase() === clean);
  return found ? found.id : 'unbranded';
};

const NO_IMAGE_PLACEHOLDER = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150"><rect fill="%23f1f5f9" width="150" height="150"/><path d="M55 65 L75 85 L95 60 L115 90 L35 90 Z" fill="%23cbd5e1"/><circle cx="55" cy="50" r="8" fill="%23cbd5e1"/></svg>');

const getImageSrc = (src) => {
  if (!src) return NO_IMAGE_PLACEHOLDER;
  if (typeof src === 'string' && src.startsWith('blob:')) {
    return NO_IMAGE_PLACEHOLDER;
  }
  return src;
};

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
    etsyListingId: 'etsy-1',
    etsyUrl: 'https://etsy.com',
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
    etsyListingId: 'etsy-2',
    etsyUrl: 'https://etsy.com',
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
    etsyListingId: '',
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
    etsyListingId: 'etsy-4',
    etsyUrl: 'https://etsy.com',
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
    etsyListingId: 'etsy-5',
    etsyUrl: 'https://etsy.com',
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
    etsyListingId: 'etsy-6',
    etsyUrl: 'https://etsy.com',
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
    etsyListingId: 'etsy-7',
    etsyUrl: 'https://etsy.com',
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
    etsyListingId: '', // Not Listed
  }
];

const groupListingsBySku = (rawListings) => {
  const groups = [];

  rawListings.forEach(item => {
    const sku = item.sku ? item.sku.trim() : '';
    const thumbnail = item.thumbnail ? item.thumbnail.trim() : '';
    
    // Find if there is an existing group that matches by SKU or thumbnail
    let matchedGroup = null;
    if (sku && sku !== '-') {
      matchedGroup = groups.find(g => g.skus.includes(sku));
    }
    if (!matchedGroup && thumbnail) {
      matchedGroup = groups.find(g => g.thumbnails.includes(thumbnail));
    }

    if (matchedGroup) {
      // Merge listing details
      const existing = matchedGroup;
      
      // Add platform status documents or the item itself
      const platforms = ['ebay', 'poshmark', 'depop', 'etsy'];
      platforms.forEach(p => {
        if (item.platform === p || item[`${p}Status`] === 'draft' || item[`${p}Status`] === 'published' || item[`${p}Status`] === 'failed') {
          if (!existing.listingsMap[p] || (new Date(item.createdAt || 0) > new Date(existing.listingsMap[p].createdAt || 0))) {
            existing.listingsMap[p] = item;
          }
        }
      });

      // Keep both SKUs and thumbnails in the group's match arrays
      if (sku && !existing.skus.includes(sku)) existing.skus.push(sku);
      if (thumbnail && !existing.thumbnails.includes(thumbnail)) existing.thumbnails.push(thumbnail);

      // Merge listing IDs/URLs
      if (item.ebayListingId) {
        existing.ebayListingId = item.ebayListingId;
        existing.ebayUrl = item.ebayUrl;
      }
      if (item.poshmarkListingId) {
        existing.poshmarkListingId = item.poshmarkListingId;
        existing.poshmarkUrl = item.poshmarkUrl;
      }
      if (item.depopListingId) {
        existing.depopListingId = item.depopListingId;
        existing.depopUrl = item.depopUrl;
      }
      if (item.etsyListingId) {
        existing.etsyListingId = item.etsyListingId;
        existing.etsyUrl = item.etsyUrl;
      }

      // If any of the listings is more recent, use its title/thumbnail/date and other details
      if (new Date(item.createdAt || 0) > new Date(existing.createdAt || 0)) {
        existing.createdAt = item.createdAt;
        if (item.title) existing.title = item.title;
        if (item.thumbnail) existing.thumbnail = item.thumbnail;
        if (item.size) existing.size = item.size;
        if (item.brand) existing.brand = item.brand;
        if (item.color) existing.color = item.color;
        if (item.price) existing.price = item.price;
        if (item.description) existing.description = item.description;
        if (item.category) existing.category = item.category;
        if (item.categoryId) existing.categoryId = item.categoryId;
        if (item.itemSpecifics) existing.itemSpecifics = item.itemSpecifics;
        if (item.conditionNote) existing.conditionNote = item.conditionNote;
      }

      const statusLower = item.status?.toLowerCase();
      if (statusLower === 'active' || statusLower === 'published' || existing.status === 'Active' || existing.status === 'Published') {
        existing.status = 'Active';
      }
      
      // Keep track of all sub-document IDs in a list for deletion
      if (!existing.allIds.includes(item._id)) {
        existing.allIds.push(item._id);
      }
    } else {
      // Create new group copying all listing document fields
      const newGroup = {
        ...item,
        allIds: [item._id],
        sku: sku || '-',
        skus: sku ? [sku] : [],
        thumbnails: thumbnail ? [thumbnail] : [],
        listingsMap: {}
      };

      // Set the initial platform mappings
      const platforms = ['ebay', 'poshmark', 'depop', 'etsy'];
      platforms.forEach(p => {
        if (item.platform === p || item[`${p}Status`] === 'draft' || item[`${p}Status`] === 'published' || item[`${p}Status`] === 'failed') {
          newGroup.listingsMap[p] = item;
        }
      });

      groups.push(newGroup);
    }
  });

  return groups;
};

const NewListings = () => {
  const navigate = useNavigate();
  const { toast, confirm } = useNotification();

  // Auth and Channel Sync state
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('local'); // 'local' or 'channel'
  const [selectedChannel, setSelectedChannel] = useState('ebay');
  const [channelProducts, setChannelProducts] = useState([]);
  const [channelLoading, setChannelLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  // Preview & Edit system states
  const [previewListing, setPreviewListing] = useState(null);
  const [activeImage, setActiveImage] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // Publishing process states
  const [publishingId, setPublishingId] = useState(null);
  const [poshmarkPublishingId, setPoshmarkPublishingId] = useState(null);
  const [poshmarkDirectPublishingId, setPoshmarkDirectPublishingId] = useState(null);
  const [etsyPublishingId, setEtsyPublishingId] = useState(null);
  const [depopPublishingId, setDepopPublishingId] = useState(null);
  const [depopDirectPublishingId, setDepopDirectPublishingId] = useState(null);
  const [verifyingListingId, setVerifyingListingId] = useState(null);

  const handleDelete = async (item) => {
    const idsToDelete = item.allIds || (item.listingsMap ? Object.keys(item.listingsMap).map(k => item.listingsMap[k]._id) : [item._id]);
    const hasMultiple = idsToDelete.length > 1;
    const confirmMsg = hasMultiple
      ? `Are you sure you want to delete this listing and all its drafts?`
      : "Are you sure you want to delete this listing?";
      
    if (await confirm(confirmMsg, { title: 'Delete Listing', destructive: true })) {
      try {
        for (const id of idsToDelete) {
          await listingService.delete(id);
        }
        toast.success("Listing deleted successfully!");
        fetchListings();
      } catch (error) {
        console.error("Error deleting listing:", error);
        toast.error("Failed to delete listing.");
      }
    }
  };

  // Filter & Sort States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortOption, setSortOption] = useState('newest');
  
  // Filter Modal States
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [filterListedOn, setFilterListedOn] = useState([]);
  const [filterNoListedOn, setFilterNoListedOn] = useState([]);
  
  // Temporary Modal States
  const [tempListedOn, setTempListedOn] = useState([]);
  const [tempNoListedOn, setTempNoListedOn] = useState([]);
  const [tempSortOption, setTempSortOption] = useState('newest');

  // Helpers to toggle platforms inside modal
  const toggleTempListedOn = (platform) => {
    if (tempListedOn.includes(platform)) {
      setTempListedOn(tempListedOn.filter(p => p !== platform));
    } else {
      setTempListedOn([...tempListedOn, platform]);
      setTempNoListedOn(tempNoListedOn.filter(p => p !== platform));
    }
  };

  const toggleTempNoListedOn = (platform) => {
    if (tempNoListedOn.includes(platform)) {
      setTempNoListedOn(tempNoListedOn.filter(p => p !== platform));
    } else {
      setTempNoListedOn([...tempNoListedOn, platform]);
      setTempListedOn(tempListedOn.filter(p => p !== platform));
    }
  };

  const isPlatformListed = (item, platform) => {
    let id = null;
    if (platform === 'ebay') id = item.ebayListingId;
    else if (platform === 'poshmark') id = item.poshmarkListingId;
    else if (platform === 'depop') id = item.depopListingId;
    else if (platform === 'etsy') id = item.etsyListingId;
    
    return !!id && id !== 'undefined' && id !== 'null' && id !== '';
  };

  const isPlatformDraft = (item, platform) => {
    return item.platform === platform && item.status?.toLowerCase() === 'draft';
  };

  // Crosslisting Modal States
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState(null);
  const [selectedPlatform, setSelectedPlatform] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

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

  // Channel sync helper functions
  const isChannelConnected = () => {
    if (selectedChannel === 'ebay') return user?.ebayAccount?.connected;
    if (selectedChannel === 'poshmark') return !!user?.poshmarkAccount?.connected;
    if (selectedChannel === 'depop') return !!user?.depopAccount?.connected;
    return false;
  };

  const fetchChannelInventory = async () => {
    if (!isChannelConnected()) {
      setChannelProducts([]);
      return;
    }
    setChannelLoading(true);
    try {
      if (selectedChannel === 'ebay') {
        const res = await ebayService.getInventory();
        if (res.data.success) {
          setChannelProducts(res.data.data);
        }
      } else {
        const res = await externalImportService.getLive(selectedChannel);
        if (res.data.success) {
          setChannelProducts(res.data.data);
        }
      }
    } catch (error) {
      console.error(`Error fetching ${selectedChannel} inventory:`, error);
    } finally {
      setChannelLoading(false);
    }
  };

  const handleSyncInventory = async () => {
    setSyncing(true);
    try {
      if (selectedChannel === 'ebay') {
        const res = await ebayService.syncInventory();
        if (res.data.success) {
          toast.success(`Successfully synced ${res.data.count} items from eBay!`);
          fetchChannelInventory();
        }
      } else {
        const username = selectedChannel === 'poshmark' ? user?.poshmarkAccount?.username : user?.depopAccount?.username;
        if (!username) {
          toast.error(`No connected username found for ${selectedChannel}.`);
          return;
        }
        toast.success(`Syncing ${selectedChannel} closet...`);
        const res = await externalImportService.importCloset({ platform: selectedChannel, username });
        if (res.data?.success) {
          toast.success(`Successfully imported ${res.data.data.importedCount} new products from ${selectedChannel}!`);
          fetchChannelInventory();
          fetchListings(); // reload local listings in background too
        }
      }
    } catch (error) {
      console.error(`Error syncing ${selectedChannel} inventory:`, error);
      toast.error(`Failed to sync inventory from ${selectedChannel}.`);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchListings();
  }, []);

  useEffect(() => {
    if (previewListing && previewListing.images && previewListing.images.length > 0) {
      setActiveImage(previewListing.images[0]);
    } else {
      setActiveImage(null);
    }
  }, [previewListing]);

  useEffect(() => {
    // Check if there is an active listing publishing from session storage
    const activePublishingId = sessionStorage.getItem('elister_poshmark_publishing_id');
    if (activePublishingId) {
      setPoshmarkPublishingId(activePublishingId);
    }

    const handleMessage = (event) => {
      const isAllowedOrigin = event.origin.includes('elister.ai') || event.origin.includes('localhost') || event.origin.includes('127.0.0.1');
      if (!isAllowedOrigin) return;

      if (event.data && event.data.action === 'ELISTER_PUBLISH_STATUS_UPDATE') {
        const { status, message } = event.data;
        console.log('[Listings] Received publish status update from extension:', event.data);
        
        if (status === 'success') {
          toast.success("Listing successfully published to Poshmark!");
          sessionStorage.removeItem('elister_poshmark_publishing_id');
          setPoshmarkPublishingId(null);
          fetchListings(); // Reload listings from backend
        } else if (status === 'error') {
          toast.error(`Publish failed: ${message}`);
          sessionStorage.removeItem('elister_poshmark_publishing_id');
          setPoshmarkPublishingId(null);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case 'published':
      case 'active':
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

  const handleOpenPreview = async (listing, platform) => {
    try {
      setPreviewListing({ ...listing, platform });
      const res = await listingService.getOne(listing._id);
      if (res.data?.success) {
        setPreviewListing({ ...res.data.data, platform });
      }
    } catch (error) {
      console.error("Error fetching full listing details:", error);
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
          else if (listing.platform === 'etsy') url = listing.etsyUrl;
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
      else if (listing.platform === 'etsy') url = listing.etsyUrl;
      else if (listing.platform === 'depop') url = listing.depopUrl;
      window.open(url, '_blank');
    } finally {
      setVerifyingListingId(null);
    }
  };

  const handlePoshmarkPublish = async (listing) => {
    const isExtensionInstalled = document.body.dataset.elisterExtensionInstalled === "true";
    if (!isExtensionInstalled) {
      toast.warning("Please install and reload the Elister Chrome Extension to list automatically!");
      return;
    }

    setPoshmarkPublishingId(listing._id);
    sessionStorage.setItem('elister_poshmark_publishing_id', listing._id);
    try {
      const res = await listingService.getOne(listing._id);
      if (!res.data?.success || !res.data?.data) {
        throw new Error("Failed to fetch full listing details from server.");
      }
      
      const fullListing = res.data.data;
      
      if (!fullListing.images || fullListing.images.length === 0) {
        toast.warning("Listing has no images. Please add images before publishing!");
        sessionStorage.removeItem('elister_poshmark_publishing_id');
        setPoshmarkPublishingId(null);
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
          departmentId: fullListing.departmentId || "01008c10d97b4e1245005764",
          categoryId: fullListing.categoryId || "07008c10d97b4e1245005764",
          subcategoryIds: fullListing.subcategoryIds ? (Array.isArray(fullListing.subcategoryIds) ? fullListing.subcategoryIds : [fullListing.subcategoryIds]) : [],
          images: fullListing.images || []
        }
      }, "*");

      toast.success("Listing execution started in background...");
      setPreviewListing(null);
    } catch (err) {
      console.error("Error publishing to Poshmark:", err);
      toast.error("Failed to load listing details. Please try again.");
      sessionStorage.removeItem('elister_poshmark_publishing_id');
      setPoshmarkPublishingId(null);
    }
  };

  const handlePoshmarkDirectPublish = async (listing) => {
    setPoshmarkDirectPublishingId(listing._id);
    try {
      const res = await externalImportService.publish(listing._id, { platform: 'poshmark' });
      if (res.data?.success) {
        toast.success("Listing successfully published to Poshmark via API!");
        setPreviewListing(null);
        fetchListings();
      }
    } catch (error) {
      console.error("Error publishing directly to Poshmark:", error);
      toast.error(error.response?.data?.message || "Failed to publish listing to Poshmark directly.");
    } finally {
      setPoshmarkDirectPublishingId(null);
    }
  };

  const handleDepopDirectPublish = async (listing) => {
    setDepopDirectPublishingId(listing._id);
    try {
      toast.info("Publishing to Depop directly via API...");
      const res = await externalImportService.publish(listing._id, { platform: 'depop' });
      if (res.data?.success) {
        toast.success("Listing successfully published to Depop!");
        setPreviewListing(null);
        fetchListings();
      }
    } catch (error) {
      console.error("Error publishing directly to Depop:", error);
      toast.error(error.response?.data?.message || "Failed to publish listing to Depop directly.");
    } finally {
      setDepopDirectPublishingId(null);
    }
  };

  const handleEtsyPublish = async (listing) => {
    setEtsyPublishingId(listing._id);
    try {
      toast.info("Publishing to Etsy directly via API...");
      const res = await etsyService.publish(listing._id);
      if (res.data?.success) {
        toast.success("Listing successfully published to Etsy!");
        setPreviewListing(null);
        fetchListings();
      }
    } catch (error) {
      console.error("Error publishing to Etsy:", error);
      toast.error(error.response?.data?.message || "Failed to publish listing to Etsy.");
    } finally {
      setEtsyPublishingId(null);
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
          brand: getDepopBrandId(fullListing.brand) || "",
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

  const renderModalFooter = () => {
    if (!previewListing) return null;
    if (previewListing.isChannelProduct) {
      if (!previewListing.url) return null;
      return (
        <a 
          href={previewListing.url}
          target="_blank" 
          rel="noopener noreferrer"
          className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-1.5"
        >
          <ExternalLink size={16} />
          View on {previewListing.platform === 'ebay' ? 'eBay' : previewListing.platform === 'poshmark' ? 'Poshmark' : 'Depop'}
        </a>
      );
    }

    return (
      <>
        {previewListing.platform === 'poshmark' && (
          <>
            {previewListing.poshmarkUrl ? (
              <button 
                onClick={() => handleVerifyAndOpen(previewListing)}
                disabled={verifyingListingId === previewListing._id}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {verifyingListingId === previewListing._id ? (
                  <>
                    <div className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Verifying...
                  </>
                ) : (
                  'View on Poshmark'
                )}
              </button>
            ) : (
              <>
                <button 
                  onClick={() => handlePoshmarkDirectPublish(previewListing)}
                  disabled={poshmarkDirectPublishingId === previewListing._id || verifyingListingId === previewListing._id || poshmarkPublishingId === previewListing._id}
                  className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100 disabled:opacity-50"
                >
                  {poshmarkDirectPublishingId === previewListing._id ? (
                    <>
                      <div className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></div>
                      Listing Direct...
                    </>
                  ) : (
                    'List to Poshmark (Direct API)'
                  )}
                </button>
                <button 
                  onClick={() => handlePoshmarkPublish(previewListing)}
                  disabled={poshmarkPublishingId === previewListing._id || verifyingListingId === previewListing._id || poshmarkDirectPublishingId === previewListing._id}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 disabled:opacity-50"
                >
                  {poshmarkPublishingId === previewListing._id ? (
                    <>
                      <div className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></div>
                      Listing...
                    </>
                  ) : (
                    'List to Poshmark (Extension)'
                  )}
                </button>
              </>
            )}
          </>
        )}
        {previewListing.platform === 'ebay' && (
          <button 
            onClick={() => {
              if (previewListing.ebayUrl) {
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
            ) : previewListing.ebayUrl ? (
              'View on eBay'
            ) : (
              'List to eBay (API)'
            )}
          </button>
        )}
        {previewListing.platform === 'etsy' && (
          <button 
            onClick={() => {
              if (previewListing.etsyUrl) {
                handleVerifyAndOpen(previewListing);
              } else {
                handleEtsyPublish(previewListing);
              }
            }}
            disabled={etsyPublishingId === previewListing._id || verifyingListingId === previewListing._id}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {verifyingListingId === previewListing._id ? (
              <>
                <div className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Verifying...
              </>
            ) : etsyPublishingId === previewListing._id ? (
              <>
                <div className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Listing...
              </>
            ) : previewListing.etsyUrl ? (
              'View on Etsy'
            ) : (
              'List to Etsy (API)'
            )}
          </button>
        )}
        {previewListing.platform === 'depop' && (
          <>
            {previewListing.depopUrl ? (
              <button 
                onClick={() => handleVerifyAndOpen(previewListing)}
                disabled={verifyingListingId === previewListing._id}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {verifyingListingId === previewListing._id ? (
                  <>
                    <div className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Verifying...
                  </>
                ) : (
                  'View on Depop'
                )}
              </button>
            ) : (
              <>
                <button 
                  onClick={() => handleDepopDirectPublish(previewListing)}
                  disabled={depopDirectPublishingId === previewListing._id || verifyingListingId === previewListing._id || depopPublishingId === previewListing._id}
                  className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100 disabled:opacity-50"
                >
                  {depopDirectPublishingId === previewListing._id ? (
                    <>
                      <div className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></div>
                      Listing Direct...
                    </>
                  ) : (
                    'List to Depop (Direct API)'
                  )}
                </button>
                <button 
                  onClick={() => handleDepopPublish(previewListing)}
                  disabled={depopPublishingId === previewListing._id || verifyingListingId === previewListing._id || depopDirectPublishingId === previewListing._id}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 disabled:opacity-50"
                >
                  {depopPublishingId === previewListing._id ? (
                    <>
                      <div className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></div>
                      Listing...
                    </>
                  ) : (
                    'List to Depop (Extension)'
                  )}
                </button>
              </>
            )}
          </>
        )}
      </>
    );
  };

  useEffect(() => {
    if (activeTab === 'channel') {
      fetchChannelInventory();
    }
  }, [activeTab, selectedChannel, user]);

  useEffect(() => {
    if (user?.ebayAccount?.connected) setSelectedChannel('ebay');
    else if (user?.poshmarkAccount?.connected) setSelectedChannel('poshmark');
    else if (user?.depopAccount?.connected) setSelectedChannel('depop');
  }, [user]);

  const getProductDetails = (product) => {
    if (!product) {
      return { title: '', brand: '', sku: '-', thumbnail: '', status: 'draft', price: 0, liveId: '-', url: '', dateText: '' };
    }
    const isEbay = selectedChannel === 'ebay';
    const isPoshmark = selectedChannel === 'poshmark';
    const isDepop = selectedChannel === 'depop';

    const title = product.title || '';
    const brand = product.brand || '';
    const sku = product.sku || '-';
    const thumbnail = product.thumbnail || (product.images && product.images[0]) || '';
    
    // Status
    const status = isEbay ? (product.status || 'draft') : 'live';

    // Price
    const price = isEbay ? product.selling_price : product.price;
    const parsedPrice = typeof price === 'number' ? price : parseFloat(price) || 0;

    // Live ID and URL
    let liveId = '-';
    let url = '';
    if (isEbay) {
      liveId = product.ebayListingId || '-';
      url = product.ebayUrl || '';
    } else if (isPoshmark) {
      liveId = product.poshmarkListingId || '-';
      url = product.poshmarkUrl || '';
    } else if (isDepop) {
      liveId = product.depopListingId || '-';
      url = product.depopUrl || '';
    }

    // Last Synced Date / Scraped Date
    let dateText = 'Live';
    if (isEbay && product.updated_at) {
      dateText = new Date(product.updated_at).toLocaleDateString();
    } else if (product.createdAt) {
      dateText = new Date(product.createdAt).toLocaleDateString();
    }

    return { title, brand, sku, thumbnail, status, price: parsedPrice, liveId, url, dateText };
  };

  const handleOpenCrosslisting = (listing, platform) => {
    setSelectedListing(listing);
    setSelectedPlatform(platform);
    setModalOpen(true);
  };

  const groupedListingsList = React.useMemo(() => {
    return groupListingsBySku(listings);
  }, [listings]);

  // Filter listings
  const filteredListings = groupedListingsList.filter((item) => {
    const matchesSearch = 
      item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku?.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesStatus = false;
    if (statusFilter === 'all') {
      matchesStatus = true;
    } else if (statusFilter === 'active') {
      matchesStatus = item.status?.toLowerCase() === 'active';
    } else if (statusFilter === 'draft') {
      matchesStatus = item.status?.toLowerCase() === 'draft';
    } else if (statusFilter === 'failed') {
      matchesStatus = item.status?.toLowerCase() === 'failed';
    } else if (statusFilter === 'unlisted') {
      matchesStatus = item.status?.toLowerCase() !== 'active';
    }

    const statusLower = item.status?.toLowerCase();
    const isPublished = statusLower === 'active' || statusLower === 'published';
    const isUnpublished = statusLower === 'draft' || statusLower === 'failed';

    // Listed On platforms filter
    let matchesListedOn = true;
    if (filterListedOn.length > 0) {
      matchesListedOn = Object.values(item.listingsMap || {}).some(sub => 
        filterListedOn.includes(sub.platform?.toLowerCase()) && 
        (sub.status?.toLowerCase() === 'active' || sub.status?.toLowerCase() === 'published')
      );
    }

    // No Listed On platforms filter
    let matchesNoListedOn = true;
    if (filterNoListedOn.length > 0) {
      matchesNoListedOn = Object.values(item.listingsMap || {}).some(sub => 
        filterNoListedOn.includes(sub.platform?.toLowerCase()) && 
        (sub.status?.toLowerCase() === 'draft' || sub.status?.toLowerCase() === 'failed')
      );
    }

    return matchesSearch && matchesStatus && matchesListedOn && matchesNoListedOn;
  });

  // Sort listings
  const sortedListings = [...filteredListings].sort((a, b) => {
    if (sortOption === 'newest') {
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    }
    if (sortOption === 'oldest') {
      return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    }
    if (sortOption === 'title-asc') {
      return (a.title || '').localeCompare(b.title || '');
    }
    if (sortOption === 'title-desc') {
      return (b.title || '').localeCompare(a.title || '');
    }
    if (sortOption === 'qty-desc') {
      return (b.quantity || 0) - (a.quantity || 0);
    }
    if (sortOption === 'qty-asc') {
      return (a.quantity || 0) - (b.quantity || 0);
    }
    return 0;
  });

  // Filter Channel Products
  const filteredChannelProducts = channelProducts.filter((product) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      !searchTerm ||
      (product.title && product.title.toLowerCase().includes(term)) ||
      (product.sku && product.sku.toLowerCase().includes(term)) ||
      (product.ebayListingId && product.ebayListingId.toLowerCase().includes(term)) ||
      (product.poshmarkListingId && product.poshmarkListingId.toLowerCase().includes(term)) ||
      (product.depopListingId && product.depopListingId.toLowerCase().includes(term));
    const matchesStatus = statusFilter === 'all' || product.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Pagination Calculations
  // Local
  const totalPages = Math.ceil(sortedListings.length / itemsPerPage) || 1;
  const activePage = Math.min(currentPage, totalPages);
  const startIndex = (activePage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, sortedListings.length);
  const paginatedListings = sortedListings.slice(startIndex, endIndex);

  // Channel
  const totalChannelPages = Math.ceil(filteredChannelProducts.length / itemsPerPage) || 1;
  const activeChannelPage = Math.min(currentPage, totalChannelPages);
  const startChannelIndex = (activeChannelPage - 1) * itemsPerPage;
  const endChannelIndex = Math.min(startChannelIndex + itemsPerPage, filteredChannelProducts.length);
  const paginatedChannelProducts = filteredChannelProducts.slice(startChannelIndex, endChannelIndex);

  // Generalised Pagination Bounds for UI display
  const displayedTotalPages = activeTab === 'local' ? totalPages : totalChannelPages;
  const displayedActivePage = activeTab === 'local' ? activePage : activeChannelPage;
  const displayedStartIndex = activeTab === 'local' ? startIndex : startChannelIndex;
  const displayedEndIndex = activeTab === 'local' ? endIndex : endChannelIndex;
  const displayedTotalCount = activeTab === 'local' ? sortedListings.length : filteredChannelProducts.length;

  // Reset currentPage to 1 when filters, tabs, or items per page change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, itemsPerPage, activeTab, selectedChannel, sortOption, filterListedOn, filterNoListedOn]);

  const getPageNumbers = (curr, total) => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (total <= maxVisiblePages) {
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      
      const start = Math.max(2, curr - 1);
      const end = Math.min(total - 1, curr + 1);
      
      if (start > 2) {
        pages.push('...');
      }
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (end < total - 1) {
        pages.push('...');
      }
      
      pages.push(total);
    }
    return pages;
  };

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
    setFilterListedOn([]);
    setFilterNoListedOn([]);
    setTempListedOn([]);
    setTempNoListedOn([]);
    setSortOption('newest');
    setTempSortOption('newest');
  };

  // Render cross-listing badges
  const renderCrosslistingCell = (item, platformName, checkId, logoSrc) => {
    const platformSpecificItem = item.listingsMap ? item.listingsMap[platformName] : null;
    const isDraft = (platformSpecificItem && platformSpecificItem.status?.toLowerCase() === 'draft') || 
                    (!platformSpecificItem && item.platform === platformName && item.status?.toLowerCase() === 'draft');
    const isListed = !!checkId;

    if (isListed) {
      return (
        <div 
          onClick={() => handleOpenPreview(platformSpecificItem || item, platformName)}
          className="flex flex-col items-center justify-center py-1 cursor-pointer group hover:scale-105 transition-all select-none w-full"
        >
          <div className="w-8 h-8 rounded-full border border-slate-100 flex items-center justify-center bg-white shadow-sm shrink-0 group-hover:border-indigo-100">
            <img src={logoSrc} className="w-5 h-5 object-contain" alt={platformName} />
          </div>
          <span className="text-[10px] font-black text-emerald-600 mt-1 select-none group-hover:text-indigo-650">Listed</span>
          <span className="text-[9px] font-mono text-slate-400 mt-0.5 select-none truncate max-w-[70px] text-center" title={checkId}>{checkId}</span>
        </div>
      );
    } else if (isDraft) {
      return (
        <div 
          onClick={() => handleOpenPreview(platformSpecificItem || item, platformName)}
          className="flex flex-col items-center justify-center py-1 cursor-pointer group hover:scale-105 transition-all select-none"
        >
          <div className="w-8 h-8 rounded-full border border-orange-100 flex items-center justify-center bg-white shadow-sm shrink-0 group-hover:border-indigo-100">
            <img src={logoSrc} className="w-5 h-5 object-contain" alt={platformName} />
          </div>
          <span className="text-[10px] font-black text-orange-500 mt-1 select-none group-hover:text-indigo-650">Draft</span>
        </div>
      );
    } else {
      // Not Listed status
      return (
        <div 
          onClick={() => handleOpenCrosslisting(platformSpecificItem || item, platformName)}
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
        <div 
          onClick={() => setStatusFilter('all')}
          className={`p-6 rounded-3xl border flex flex-col justify-between h-36 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ${
            statusFilter === 'all' 
              ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/10' 
              : 'border-[#f1f3f9] bg-white shadow-sm'
          }`}
        >
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
        <div 
          onClick={() => setStatusFilter('active')}
          className={`p-6 rounded-3xl border flex flex-col justify-between h-36 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ${
            statusFilter === 'active' 
              ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/10' 
              : 'border-[#f1f3f9] bg-white shadow-sm'
          }`}
        >
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
        <div 
          onClick={() => setStatusFilter('draft')}
          className={`p-6 rounded-3xl border flex flex-col justify-between h-36 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ${
            statusFilter === 'draft' 
              ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/10' 
              : 'border-[#f1f3f9] bg-white shadow-sm'
          }`}
        >
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
        <div 
          onClick={() => setStatusFilter('failed')}
          className={`p-6 rounded-3xl border flex flex-col justify-between h-36 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ${
            statusFilter === 'failed' 
              ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/10' 
              : 'border-[#f1f3f9] bg-white shadow-sm'
          }`}
        >
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
        <div 
          onClick={() => setStatusFilter('unlisted')}
          className={`p-6 rounded-3xl border flex flex-col justify-between h-36 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ${
            statusFilter === 'unlisted' 
              ? 'border-slate-500 ring-2 ring-slate-500/20 bg-slate-50/10' 
              : 'border-[#f1f3f9] bg-white shadow-sm'
          }`}
        >
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

      {/* TABS SWITCHER & SYNC BAR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4.5 rounded-3xl border border-[#f1f3f9] shadow-sm">
        {/* Tabs */}
        <div className="flex bg-[#f3f4f6] p-1.5 rounded-2xl gap-1.5 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('local')}
            className={`flex-1 sm:flex-none px-6 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'local' 
                ? 'bg-white text-indigo-650 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Local Database
          </button>
          <button
            onClick={() => setActiveTab('channel')}
            className={`flex-1 sm:flex-none px-6 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'channel' 
                ? 'bg-white text-indigo-650 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Channel Inventory
          </button>
        </div>

        {/* Channel Selection & Sync Actions (only visible when in channel tab) */}
        {activeTab === 'channel' && (
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Channel Toggle Buttons */}
            <div className="flex bg-[#f3f4f6] p-1 rounded-xl gap-1 w-full sm:w-auto">
              <button
                onClick={() => setSelectedChannel('ebay')}
                className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                  selectedChannel === 'ebay' 
                    ? 'bg-white text-indigo-600 shadow-xs' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                eBay
              </button>
              <button
                onClick={() => setSelectedChannel('poshmark')}
                className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                  selectedChannel === 'poshmark' 
                    ? 'bg-white text-indigo-600 shadow-xs' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Poshmark
              </button>
              <button
                onClick={() => setSelectedChannel('depop')}
                className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                  selectedChannel === 'depop' 
                    ? 'bg-white text-indigo-600 shadow-xs' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Depop
              </button>
            </div>

            {/* Sync Button */}
            <button
              onClick={handleSyncInventory}
              disabled={syncing || !isChannelConnected()}
              className="flex items-center justify-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-150 disabled:cursor-not-allowed border border-transparent text-white text-xs font-black rounded-xl cursor-pointer transition-all shadow-sm shadow-indigo-150"
            >
              {syncing ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw size={14} />
                  Sync {selectedChannel === 'ebay' ? 'eBay' : selectedChannel === 'poshmark' ? 'Poshmark' : 'Depop'}
                </>
              )}
            </button>
          </div>
        )}
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
            placeholder={activeTab === 'local' ? "Search listings..." : `Search ${selectedChannel} products...`}
            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-100 focus:bg-white rounded-2xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400"
          />
        </div>

        {/* Dropdowns & Link options */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Consolidated Filter Button */}
          {activeTab === 'local' && (
            <button 
              onClick={() => {
                setTempListedOn(filterListedOn);
                setTempNoListedOn(filterNoListedOn);
                setTempSortOption(sortOption);
                setFilterModalOpen(true);
              }}
              className={`flex items-center gap-2 px-4 py-2.5 bg-white border rounded-2xl text-xs font-extrabold text-slate-700 hover:border-indigo-200 transition-all cursor-pointer ${
                (filterListedOn.length > 0 || filterNoListedOn.length > 0 || sortOption !== 'newest') ? 'border-indigo-500 ring-2 ring-indigo-500/10' : 'border-[#e5e7eb]'
              }`}
            >
              <SlidersHorizontal size={14} className="text-slate-400" />
              Filters
              {(filterListedOn.length > 0 || filterNoListedOn.length > 0 || sortOption !== 'newest') && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-black bg-indigo-600 text-white rounded-full leading-none">
                  {(filterListedOn.length > 0 ? 1 : 0) + (filterNoListedOn.length > 0 ? 1 : 0) + (sortOption !== 'newest' ? 1 : 0)}
                </span>
              )}
            </button>
          )}

          {/* Clear filter button */}
          {(searchTerm || statusFilter !== 'all' || filterListedOn.length > 0 || filterNoListedOn.length > 0 || sortOption !== 'newest') && (
            <button 
              onClick={handleClearFilters}
              className="text-xs font-extrabold text-indigo-600 hover:text-indigo-700 hover:underline px-2 transition-all cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

      </div>

      {/* TABLE */}
      <div className="bg-white rounded-3xl border border-[#f1f3f9] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {activeTab === 'local' ? (
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
                  <th className="py-2.5 text-center w-20">Etsy</th>
                  <th />
                </tr>
              </thead>

              {/* Rows */}
              <tbody className="divide-y divide-[#f8fafc]">
                {loading ? (
                  <tr>
                    <td colSpan="11" className="px-6 py-16 text-center text-slate-400 font-semibold animate-pulse">
                      Loading inventory data...
                    </td>
                  </tr>
                ) : paginatedListings.length > 0 ? (
                  paginatedListings.map((item) => (
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
                        {renderCrosslistingCell(item, 'etsy', item.etsyListingId, '/etsy.png')}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4.5 text-center">
                        <div className="flex justify-center items-center gap-2">
                          <button 
                            onClick={() => handleDelete(item)}
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
          ) : !isChannelConnected() ? (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center bg-white">
              <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mb-5 border border-amber-100 animate-pulse text-amber-500">
                <AlertCircle size={28} />
              </div>
              <h3 className="text-base font-extrabold text-slate-900 mb-1.5 capitalize">
                {selectedChannel} Channel Not Connected
              </h3>
              <p className="text-xs font-semibold text-slate-400 max-w-sm mb-6 leading-relaxed">
                Connect your {selectedChannel} account in Integrations settings to view and synchronize your live inventory.
              </p>
              <button 
                onClick={() => navigate('/integrations')}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-2xl shadow-md shadow-indigo-150 transition-all text-xs cursor-pointer active:scale-95"
              >
                Connect {selectedChannel === 'ebay' ? 'eBay' : selectedChannel === 'poshmark' ? 'Poshmark' : 'Depop'}
              </button>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              
              {/* Headers */}
              <thead>
                <tr className="bg-[#fcfcff] border-b border-[#f3f4f6]">
                  <th className="px-6 py-4.5 w-12 text-center">
                    <input type="checkbox" className="w-4 h-4 text-indigo-600 border-[#d1d5db] rounded focus:ring-indigo-500 cursor-pointer" />
                  </th>
                  <th className="px-6 py-4.5 text-xs font-black text-slate-400 uppercase tracking-wider">Product</th>
                  <th className="px-6 py-4.5 text-xs font-black text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4.5 text-xs font-black text-slate-400 uppercase tracking-wider">Live ID</th>
                  <th className="px-6 py-4.5 text-xs font-black text-slate-400 uppercase tracking-wider">SKU</th>
                  <th className="px-6 py-4.5 text-xs font-black text-slate-400 uppercase tracking-wider">Price</th>
                  <th className="px-6 py-4.5 text-xs font-black text-slate-400 uppercase tracking-wider">Last Synced / Live</th>
                  <th className="px-6 py-4.5 text-xs font-black text-slate-400 uppercase tracking-wider text-center">Actions</th>
                </tr>
              </thead>

              {/* Rows */}
              <tbody className="divide-y divide-[#f8fafc]">
                {channelLoading ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-16 text-center text-slate-400 font-semibold animate-pulse">
                      Loading {selectedChannel} inventory...
                    </td>
                  </tr>
                ) : paginatedChannelProducts.length > 0 ? (
                  paginatedChannelProducts.map((product, index) => {
                    const details = getProductDetails(product);
                    return (
                      <tr key={product._id || `${details.liveId}-${index}`} className="hover:bg-[#fafbfe]/40 transition-colors">
                        
                        {/* Checkbox */}
                        <td className="px-6 py-4.5 text-center">
                          <input type="checkbox" className="w-4 h-4 text-indigo-600 border-[#d1d5db] rounded focus:ring-indigo-500 cursor-pointer" />
                        </td>

                        {/* Product info */}
                        <td className="px-6 py-4.5 max-w-sm">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-[#f3f4f6] rounded-xl overflow-hidden shrink-0 shadow-inner flex items-center justify-center border border-[#e5e7eb]">
                              {details.thumbnail ? (
                                <img src={details.thumbnail} className="w-full h-full object-cover" alt="" />
                              ) : (
                                <span className="text-slate-300 font-bold text-xs">No img</span>
                              )}
                            </div>
                            <div>
                              <span className="font-extrabold text-slate-800 text-xs line-clamp-1 leading-relaxed">
                                {details.title}
                              </span>
                              {details.brand && (
                                <span className="text-[10px] text-slate-400 block font-semibold mt-0.5">{details.brand}</span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4.5">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold ${
                            details.status === 'live' || details.status === 'published' ? 'bg-[#e6f4ea] text-[#137333]' : 
                            'bg-[#fef7e0] text-[#b06000]'
                          }`}>
                            {details.status === 'live' || details.status === 'published' ? 'Live' : 'Draft'}
                          </span>
                        </td>

                        {/* Live ID */}
                        <td className="px-6 py-4.5">
                          <span className="font-mono text-xs font-bold text-slate-500">{details.liveId}</span>
                        </td>

                        {/* SKU */}
                        <td className="px-6 py-4.5">
                          <span className="font-mono text-xs font-bold text-slate-500">{details.sku || '-'}</span>
                        </td>

                        {/* Price */}
                        <td className="px-6 py-4.5 font-bold text-slate-900 text-sm">
                          ${details.price.toFixed(2)}
                        </td>

                        {/* Date */}
                        <td className="px-6 py-4.5 text-xs font-semibold text-slate-400">
                          {details.dateText}
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4.5 text-center">
                          <div className="flex justify-center items-center gap-2">
                            {details.url && (
                              <a 
                                href={details.url} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="p-1.5 hover:bg-slate-50 hover:text-slate-900 rounded-xl text-slate-400 transition-all cursor-pointer" 
                                title={`View on ${selectedChannel}`}
                              >
                                <ExternalLink size={16} />
                              </a>
                            )}
                          </div>
                        </td>

                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="8" className="px-6 py-16 text-center text-slate-400">
                      No live products found on this channel. Click &quot;Sync {selectedChannel === 'ebay' ? 'eBay' : selectedChannel === 'poshmark' ? 'Poshmark' : 'Depop'}&quot; to fetch your items.
                    </td>
                  </tr>
                )}
              </tbody>

            </table>
          )}
        </div>

        {/* Bottom Pagination */}
        <div className="px-6 py-4 bg-[#fcfcff] border-t border-[#f3f4f6] flex items-center justify-between">
          <p className="text-xs font-extrabold text-slate-400 select-none">
            Showing {displayedTotalCount === 0 ? 0 : displayedStartIndex + 1} to {displayedEndIndex} of {displayedTotalCount.toLocaleString()} {activeTab === 'local' ? 'listings' : 'live products'}
          </p>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="p-1.5 bg-white border border-[#e5e7eb] rounded-lg text-slate-500 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                disabled={displayedActivePage === 1}
              >
                <ChevronLeft size={16} />
              </button>
              
              {getPageNumbers(displayedActivePage, displayedTotalPages).map((page, index) => {
                if (page === '...') {
                  return (
                    <span key={`dots-${index}`} className="px-1 text-slate-400 text-xs font-extrabold select-none">
                      ...
                    </span>
                  );
                }
                const isCurrent = page === displayedActivePage;
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg font-extrabold text-xs transition-all ${
                      isCurrent 
                        ? 'border-2 border-indigo-600 bg-white text-indigo-600' 
                        : 'text-slate-500 hover:bg-slate-50 font-bold cursor-pointer'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}

              <button 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, displayedTotalPages))}
                className="p-1.5 bg-white border border-[#e5e7eb] rounded-lg text-slate-500 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                disabled={displayedActivePage === displayedTotalPages}
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* page count indicator */}
            <div className="relative flex items-center">
              <select 
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="appearance-none pr-8 pl-3.5 py-1.5 bg-white border border-[#e5e7eb] hover:border-indigo-200 rounded-lg text-xs font-bold text-slate-700 outline-none cursor-pointer"
              >
                <option value={5}>5 / page</option>
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
              </select>
              <ChevronDown size={14} className="text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

      </div>

      {/* Filter Inventory Modal */}
      {filterModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-[#f1f3f9] animate-in zoom-in-95 duration-200 flex flex-col">
            
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-[#f1f3f9] flex justify-between items-center bg-white">
              <div className="flex items-center gap-2.5">
                <svg className="w-5 h-5 text-indigo-650" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
                <h2 className="text-base font-extrabold text-slate-800">Filter Inventory</h2>
              </div>
              <button 
                onClick={() => setFilterModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-all cursor-pointer"
              >
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" stroke="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
              {/* Sort Listings Section */}
              <div className="border-b border-[#f1f3f9] pb-6">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Sort Listings</h3>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5 leading-normal">Choose how you want to order your inventory</p>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                  {[
                    { value: 'newest', label: 'Newest First' },
                    { value: 'oldest', label: 'Oldest First' },
                    { value: 'title-asc', label: 'Title (A-Z)' },
                    { value: 'title-desc', label: 'Title (Z-A)' },
                    { value: 'qty-desc', label: 'Qty (High-Low)' },
                    { value: 'qty-asc', label: 'Qty (Low-High)' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setTempSortOption(option.value)}
                      className={`px-4 py-2.5 rounded-2xl text-xs font-bold border transition-all cursor-pointer text-center ${
                        tempSortOption === option.value
                          ? 'border-indigo-650 bg-indigo-50/20 text-indigo-650 font-extrabold ring-2 ring-indigo-650/10'
                          : 'border-slate-150 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Listing Status</h3>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5 leading-normal">Filter items based on where they are listed</p>
              </div>

              <div className="space-y-4">
                {/* Listed On Row */}
                <div className="p-5.5 rounded-2xl border border-[#e6f4ea] bg-[#e6f4ea]/10 flex items-start gap-4">
                  <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </div>
                  
                  <div className="flex-1 space-y-3.5">
                    <h4 className="text-[11px] font-black text-emerald-700 uppercase tracking-wider">Listed On</h4>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {/* eBay */}
                      <label className="flex items-center gap-3 cursor-pointer group select-none">
                        <input 
                          type="checkbox" 
                          checked={tempListedOn.includes('ebay')}
                          onChange={() => toggleTempListedOn('ebay')}
                          className="w-4.5 h-4.5 text-emerald-650 border-[#d1d5db] rounded focus:ring-emerald-500 cursor-pointer" 
                        />
                        <div className="flex flex-col items-center gap-1.5 bg-white border border-[#f1f3f9] rounded-2xl p-2 w-16 h-16 shadow-xs group-hover:border-emerald-200 transition-all shrink-0">
                          <img src="/ebay.png" className="w-6 h-6 object-contain" alt="" />
                          <span className="text-[9px] font-bold text-slate-500">eBay</span>
                        </div>
                      </label>

                      {/* Poshmark */}
                      <label className="flex items-center gap-3 cursor-pointer group select-none">
                        <input 
                          type="checkbox" 
                          checked={tempListedOn.includes('poshmark')}
                          onChange={() => toggleTempListedOn('poshmark')}
                          className="w-4.5 h-4.5 text-emerald-650 border-[#d1d5db] rounded focus:ring-emerald-500 cursor-pointer" 
                        />
                        <div className="flex flex-col items-center gap-1.5 bg-white border border-[#f1f3f9] rounded-2xl p-2 w-16 h-16 shadow-xs group-hover:border-emerald-200 transition-all shrink-0">
                          <img src="/poshmark.png" className="w-6 h-6 object-contain" alt="" />
                          <span className="text-[9px] font-bold text-slate-500">Poshmark</span>
                        </div>
                      </label>

                      {/* Depop */}
                      <label className="flex items-center gap-3 cursor-pointer group select-none">
                        <input 
                          type="checkbox" 
                          checked={tempListedOn.includes('depop')}
                          onChange={() => toggleTempListedOn('depop')}
                          className="w-4.5 h-4.5 text-emerald-650 border-[#d1d5db] rounded focus:ring-emerald-500 cursor-pointer" 
                        />
                        <div className="flex flex-col items-center gap-1.5 bg-white border border-[#f1f3f9] rounded-2xl p-2 w-16 h-16 shadow-xs group-hover:border-emerald-200 transition-all shrink-0">
                          <img src="/depop.png" className="w-6 h-6 object-contain" alt="" />
                          <span className="text-[9px] font-bold text-slate-500">Depop</span>
                        </div>
                      </label>

                      {/* Etsy */}
                      <label className="flex items-center gap-3 cursor-pointer group select-none">
                        <input 
                          type="checkbox" 
                          checked={tempListedOn.includes('etsy')}
                          onChange={() => toggleTempListedOn('etsy')}
                          className="w-4.5 h-4.5 text-emerald-650 border-[#d1d5db] rounded focus:ring-emerald-500 cursor-pointer" 
                        />
                        <div className="flex flex-col items-center gap-1.5 bg-white border border-[#f1f3f9] rounded-2xl p-2 w-16 h-16 shadow-xs group-hover:border-emerald-200 transition-all shrink-0">
                          <img src="/etsy.png" className="w-6 h-6 object-contain rounded-md" alt="" />
                          <span className="text-[9px] font-bold text-slate-500">Etsy</span>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* No Listed On Row */}
                <div className="p-5.5 rounded-2xl border border-[#fce8e6] bg-[#fce8e6]/10 flex items-start gap-4">
                  <div className="w-5 h-5 rounded-full border-2 border-rose-500 text-rose-500 flex items-center justify-center shrink-0 mt-0.5 bg-white font-black text-xs select-none">
                    {/* Circle icon */}
                  </div>
                  
                  <div className="flex-1 space-y-3.5">
                    <h4 className="text-[11px] font-black text-rose-700 uppercase tracking-wider">No Listed On</h4>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {/* eBay */}
                      <label className="flex items-center gap-3 cursor-pointer group select-none">
                        <input 
                          type="checkbox" 
                          checked={tempNoListedOn.includes('ebay')}
                          onChange={() => toggleTempNoListedOn('ebay')}
                          className="w-4.5 h-4.5 text-rose-600 border-[#d1d5db] rounded focus:ring-rose-500 cursor-pointer" 
                        />
                        <div className="flex flex-col items-center gap-1.5 bg-white border border-[#f1f3f9] rounded-2xl p-2 w-16 h-16 shadow-xs group-hover:border-rose-200 transition-all shrink-0">
                          <img src="/ebay.png" className="w-6 h-6 object-contain opacity-60 group-hover:opacity-100" alt="" />
                          <span className="text-[9px] font-bold text-slate-500">eBay</span>
                        </div>
                      </label>

                      {/* Poshmark */}
                      <label className="flex items-center gap-3 cursor-pointer group select-none">
                        <input 
                          type="checkbox" 
                          checked={tempNoListedOn.includes('poshmark')}
                          onChange={() => toggleTempNoListedOn('poshmark')}
                          className="w-4.5 h-4.5 text-rose-600 border-[#d1d5db] rounded focus:ring-rose-500 cursor-pointer" 
                        />
                        <div className="flex flex-col items-center gap-1.5 bg-white border border-[#f1f3f9] rounded-2xl p-2 w-16 h-16 shadow-xs group-hover:border-rose-200 transition-all shrink-0">
                          <img src="/poshmark.png" className="w-6 h-6 object-contain opacity-60 group-hover:opacity-100" alt="" />
                          <span className="text-[9px] font-bold text-slate-500">Poshmark</span>
                        </div>
                      </label>

                      {/* Depop */}
                      <label className="flex items-center gap-3 cursor-pointer group select-none">
                        <input 
                          type="checkbox" 
                          checked={tempNoListedOn.includes('depop')}
                          onChange={() => toggleTempNoListedOn('depop')}
                          className="w-4.5 h-4.5 text-rose-600 border-[#d1d5db] rounded focus:ring-rose-500 cursor-pointer" 
                        />
                        <div className="flex flex-col items-center gap-1.5 bg-white border border-[#f1f3f9] rounded-2xl p-2 w-16 h-16 shadow-xs group-hover:border-rose-200 transition-all shrink-0">
                          <img src="/depop.png" className="w-6 h-6 object-contain opacity-60 group-hover:opacity-100" alt="" />
                          <span className="text-[9px] font-bold text-slate-500">Depop</span>
                        </div>
                      </label>

                      {/* Etsy */}
                      <label className="flex items-center gap-3 cursor-pointer group select-none">
                        <input 
                          type="checkbox" 
                          checked={tempNoListedOn.includes('etsy')}
                          onChange={() => toggleTempNoListedOn('etsy')}
                          className="w-4.5 h-4.5 text-rose-600 border-[#d1d5db] rounded focus:ring-rose-500 cursor-pointer" 
                        />
                        <div className="flex flex-col items-center gap-1.5 bg-white border border-[#f1f3f9] rounded-2xl p-2 w-16 h-16 shadow-xs group-hover:border-rose-200 transition-all shrink-0">
                          <img src="/etsy.png" className="w-6 h-6 object-contain rounded-md opacity-60 group-hover:opacity-100" alt="" />
                          <span className="text-[9px] font-bold text-slate-500">Etsy</span>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4.5 border-t border-[#f1f3f9] flex justify-between items-center bg-slate-50">
              <button 
                onClick={() => {
                  setTempListedOn([]);
                  setTempNoListedOn([]);
                  setFilterListedOn([]);
                  setFilterNoListedOn([]);
                  setTempSortOption('newest');
                  setSortOption('newest');
                }}
                className="flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-slate-100 border border-[#e5e7eb] text-slate-600 hover:text-slate-900 text-xs font-extrabold rounded-xl cursor-pointer transition-all shadow-xs"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                Reset
              </button>
              
              <button 
                onClick={() => {
                  setFilterListedOn(tempListedOn);
                  setFilterNoListedOn(tempNoListedOn);
                  setSortOption(tempSortOption);
                  setFilterModalOpen(false);
                }}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl cursor-pointer transition-all shadow-md shadow-indigo-100"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
                Apply Filters
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Crosslisting Modal */}
      <CrosslistingModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedListing(null);
          setIsEditMode(false);
        }}
        listing={selectedListing}
        platform={selectedPlatform}
        isEditMode={isEditMode}
        onSyncSuccess={fetchListings}
      />

      {/* Preview Modal */}
      {previewListing && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Listing Preview ({previewListing.platform?.toUpperCase()})</span>
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
                  {(previewListing.platform === 'poshmark' || previewListing.platform === 'etsy' || previewListing.platform === 'depop') && (
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
                  {previewListing.platform !== 'etsy' && (
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
                  {(previewListing.platform === 'etsy' || previewListing.platform === 'depop') && previewListing.material && (
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
                {previewListing.platform !== 'poshmark' && previewListing.platform !== 'etsy' && previewListing.platform !== 'depop' && (
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
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-605 hover:bg-slate-100 transition-all cursor-pointer"
              >
                Close
              </button>

              {!previewListing.isChannelProduct && (
                <button
                  onClick={() => {
                    setSelectedListing(previewListing);
                    setSelectedPlatform(previewListing.platform || 'ebay');
                    setIsEditMode(true);
                    setModalOpen(true);
                    setPreviewListing(null);
                  }}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-amber-100 flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Edit size={16} />
                  Edit Listing
                </button>
              )}

              {renderModalFooter()}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default NewListings;
