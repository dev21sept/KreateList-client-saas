/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps, no-unused-vars */
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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
  XCircle,
  Package,
  ImageOff,
  Plus,
  ShoppingBag,
  Boxes,
  CheckCircle2,
  FileText,
  Eye,
  EyeOff,
  Download,
  GitMerge
} from 'lucide-react';
import api, { listingService, ebayService, externalImportService, etsyService, mercariService, amazonService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import CrosslistingModal from '../components/CrosslistingModal';
import { DEPOP_CATEGORY_MAPPING } from '../constants/depopCategoryAttributes';
import { DEPOP_BRANDS } from '../constants/depopBrands';
import { StatusBadge } from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import { LoadingState } from '../components/ui/LoadingState';
import IconButton from '../components/ui/IconButton';
import Button from '../components/ui/Button';
import { useReducedMotion } from '../hooks/useReducedMotion';
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
    
    // Find if there is an existing group that matches by SKU
    let matchedGroup = null;
    if (sku && sku !== '' && sku !== '-') {
      matchedGroup = groups.find(g => g.skus.includes(sku));
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
  const reducedMotion = useReducedMotion();
  const handleUpdateRef = useRef();

  // Auth and Channel Sync state
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('elister_active_listings_tab') || 'local');
  const [selectedChannel, setSelectedChannel] = useState(() => localStorage.getItem('elister_selected_listings_channel') || 'ebay');
  const [channelProducts, setChannelProducts] = useState([]);
  const [channelLoading, setChannelLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  // Preview & Edit system states
  const [previewListing, setPreviewListing] = useState(null);
  const [previewPlatform, setPreviewPlatform] = useState('ebay');
  const [activeImage, setActiveImage] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // Publishing process states
  const [publishingId, setPublishingId] = useState(null);
  const [poshmarkPublishingId, setPoshmarkPublishingId] = useState(null);
  const [poshmarkDirectPublishingId, setPoshmarkDirectPublishingId] = useState(null);
  const [etsyPublishingId, setEtsyPublishingId] = useState(null);
  const [depopPublishingId, setDepopPublishingId] = useState(null);
  const [depopDirectPublishingId, setDepopDirectPublishingId] = useState(null);
  const [mercariPublishingId, setMercariPublishingId] = useState(null);
  const [amazonPublishingId, setAmazonPublishingId] = useState(null);
  const [verifyingListingId, setVerifyingListingId] = useState(null);

  // Drag & Drop / Pick & Drop channel merge states
  const [draggedChannel, setDraggedChannel] = useState(null);
  const [dragOverTarget, setDragOverTarget] = useState(null);

  const handleDelete = async (item) => {
    const idsToDelete = item.allIds || (item.listingsMap && typeof item.listingsMap === 'object' ? Object.keys(item.listingsMap).map(k => item.listingsMap[k]?._id).filter(Boolean) : [item._id]);
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
  const [channelStatusFilter, setChannelStatusFilter] = useState('all'); // 'all' | 'active' | 'inactive' | 'draft'
  const [channelSortOption, setChannelSortOption] = useState(() => {
    return localStorage.getItem('elister_channel_sort_option') || 'newest';
  });
  const [sortOption, setSortOption] = useState('newest');
  
  // Filter Modal States
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [filterListedOn, setFilterListedOn] = useState([]);
  const [filterNoListedOn, setFilterNoListedOn] = useState([]);
  
  // Temporary Modal States
  const [tempListedOn, setTempListedOn] = useState([]);
  const [tempNoListedOn, setTempNoListedOn] = useState([]);
  const [tempSortOption, setTempSortOption] = useState('newest');

  const hasActiveLocalFilters = Boolean(
    searchTerm ||
    statusFilter !== 'all' ||
    (filterListedOn && filterListedOn.length > 0) ||
    (filterNoListedOn && filterNoListedOn.length > 0)
  );

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

  // Smart Import Modal States
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importSubmitting, setImportSubmitting] = useState(false);
  const [importGroups, setImportGroups] = useState([]);
  const [importSearchTerm, setImportSearchTerm] = useState('');
  const [importFilterTab, setImportFilterTab] = useState('all'); // 'all' | 'multi' | 'single'
  const [selectedGroupIds, setSelectedGroupIds] = useState({});
  const [selectedPlatforms, setSelectedPlatforms] = useState({});

  // Smart Local Merge Modal States
  const [localMergeModalOpen, setLocalMergeModalOpen] = useState(false);
  const [localMergeLoading, setLocalMergeLoading] = useState(false);
  const [localMergeSubmitting, setLocalMergeSubmitting] = useState(false);
  const [localMergeGroups, setLocalMergeGroups] = useState([]);
  const [localMergeSearchTerm, setLocalMergeSearchTerm] = useState('');
  const [localMergeFilterTab, setLocalMergeFilterTab] = useState('all'); // 'all' | 'multi' | '2plus'
  const [selectedMergeGroupIds, setSelectedMergeGroupIds] = useState({});

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
    if (selectedChannel === 'etsy') return !!user?.etsyAccount?.connected;
    if (selectedChannel === 'poshmark') return !!user?.poshmarkAccount?.connected;
    if (selectedChannel === 'depop') return !!user?.depopAccount?.connected;
    if (selectedChannel === 'mercari') return !!user?.mercariAccount?.connected;
    if (selectedChannel === 'amazon') return !!user?.amazonAccount?.connected;
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
      } else if (selectedChannel === 'etsy') {
        const res = await etsyService.getInventory();
        if (res.data.success) {
          setChannelProducts(res.data.data);
        }
      } else if (selectedChannel === 'amazon') {
        const res = await amazonService.getInventory();
        if (res.data.success) {
          setChannelProducts(res.data.listings || []);
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
      } else if (selectedChannel === 'etsy') {
        const res = await etsyService.sync();
        if (res.data.success) {
          toast.success(`Successfully synced ${res.data.count} items from Etsy!`);
          fetchChannelInventory();
        }
      } else if (selectedChannel === 'amazon') {
        const res = await amazonService.sync();
        if (res.data.success) {
          toast.success(`Successfully synced ${res.data.count || 0} items from Amazon!`);
          fetchChannelInventory();
        }
      } else {
        const username = selectedChannel === 'poshmark' 
          ? user?.poshmarkAccount?.username 
          : selectedChannel === 'mercari'
            ? user?.mercariAccount?.username
            : user?.depopAccount?.username;
        if (!username) {
          toast.error(`No connected username found for ${selectedChannel}.`);
          return;
        }

        let listings = [];
        if (selectedChannel === 'depop') {
          try {
            const fetchListingsViaExtension = (userId, accessToken) => {
              return new Promise((resolve, reject) => {
                const handleResponse = (event) => {
                  if (event.data && event.data.action === 'ELISTER_FETCH_DEPOP_PRODUCTS_RESPONSE') {
                    window.removeEventListener('message', handleResponse);
                    if (event.data.success) {
                      resolve(event.data.products || []);
                    } else {
                      reject(new Error(event.data.error || 'Failed to fetch products'));
                    }
                  }
                };
                window.addEventListener('message', handleResponse);
                window.postMessage({
                  action: 'ELISTER_FETCH_DEPOP_PRODUCTS',
                  userId,
                  accessToken
                }, '*');
                
                setTimeout(() => {
                  window.removeEventListener('message', handleResponse);
                  reject(new Error('Extension response timeout'));
                }, 15000);
              });
            };

            const depopAcc = user?.depopAccount;
            if (depopAcc?.userId && depopAcc?.accessToken) {
              toast.info("Fetching products directly from Depop via Extension...");
              listings = await fetchListingsViaExtension(depopAcc.userId, depopAcc.accessToken);
              console.log(`[Listings] Fetched ${listings.length} products via Extension.`);
            }
          } catch (e) {
            console.warn('[Listings] Extension listing fetch failed, falling back to server scraping...', e);
            toast.warning(`Extension Sync Warning: ${e.message}. Falling back to server scraper...`);
          }
        }

        toast.success(`Syncing ${selectedChannel} closet...`);
        const res = await externalImportService.importCloset({ 
          platform: selectedChannel, 
          username,
          listings: listings.length > 0 ? listings : undefined
        });

        if (res.data?.success) {
          const count = res.data.data.importedCount;
          if (count > 0) {
            toast.success(`Successfully imported ${count} new products from ${selectedChannel}!`);
          } else {
            toast.success(`Synced successfully! Your ${selectedChannel} inventory is already up-to-date.`);
          }
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

  handleUpdateRef.current = () => {
    fetchListings();
    fetchChannelInventory();
  };

  useEffect(() => {
    fetchListings();

    const handleUpdate = () => {
      if (handleUpdateRef.current) {
        handleUpdateRef.current();
      }
    };
    window.addEventListener('elister-listings-update', handleUpdate);
    return () => window.removeEventListener('elister-listings-update', handleUpdate);
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
    if (!status) return null;
    return <StatusBadge status={status} className="text-[10px] px-3 py-1" />;
  };

  const handleOpenPreview = async (item, platformName) => {
    setActiveListedDropdown(null);
    try {
      const platform = platformName || item.platform || selectedChannel || 'ebay';
      const targetItem = item.listingsMap && item.listingsMap[platform] 
        ? item.listingsMap[platform] 
        : item;

      let fallbackUrl = targetItem[`${platform}Url`] || targetItem.url || '';
      if (!fallbackUrl) {
        const checkId = targetItem[`${platform}ListingId`] || targetItem.listingId;
        if (checkId) {
          if (platform === 'mercari') fallbackUrl = `https://www.mercari.com/item/${checkId}/`;
          else if (platform === 'ebay') fallbackUrl = `https://www.ebay.com/itm/${checkId}`;
          else if (platform === 'poshmark') fallbackUrl = `https://poshmark.com/listing/${checkId}`;
          else if (platform === 'etsy') fallbackUrl = `https://www.etsy.com/listing/${checkId}`;
          else if (platform === 'depop') fallbackUrl = `https://www.depop.com/products/${checkId}`;
        }
      }

      const initialPreview = {
        ...targetItem,
        platform,
        status: targetItem[`${platform}Status`] || targetItem.status || 'draft',
        url: fallbackUrl
      };
      setPreviewListing(initialPreview);
      setPreviewPlatform(platform);
      if (initialPreview.images && initialPreview.images.length > 0) {
        setActiveImage(initialPreview.images[0]);
      }

      if (targetItem._id && !String(targetItem._id).startsWith('mock-')) {
        const res = await listingService.getOne(targetItem._id);
        if (res.data?.success && res.data.data) {
          const fullData = res.data.data;
          setPreviewListing(prev => ({
            ...prev,
            ...fullData,
            platform,
            status: targetItem[`${platform}Status`] || fullData[`${platform}Status`] || fullData.status || prev.status,
            url: targetItem[`${platform}Url`] || fullData[`${platform}Url`] || fullData.url || prev.url
          }));
          if (fullData.images && fullData.images.length > 0) {
            setActiveImage(fullData.images[0]);
          }
        }
      }

      if (platform === 'mercari' || targetItem.platform === 'mercari' || targetItem.source === 'mercari' || targetItem.mercariListingId) {
        const mercId = targetItem.mercariListingId || (targetItem.sku && targetItem.sku.startsWith('M-m') ? targetItem.sku.replace('M-', '') : targetItem._id);
        if (mercId && (!targetItem.images || targetItem.images.length <= 1 || !targetItem.description || targetItem.description === targetItem.title)) {
          mercariService.getItemDetails(mercId).then(res => {
            if (res.data?.success && res.data?.data) {
              const fullData = res.data.data;
              setPreviewListing(prev => ({
                ...prev,
                ...fullData,
                platform: 'mercari',
                status: fullData.status === 'active' ? 'published' : 'delisted',
                url: fullData.mercariUrl || prev?.url
              }));
              if (fullData.images && fullData.images.length > 0) {
                setActiveImage(fullData.images[0]);
              }
            }
          }).catch(e => console.warn("Mercari details preview auto-enrich failed:", e));
        }
      }
    } catch (error) {
      console.error("Error fetching full listing details for preview:", error);
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
      let res;
      if (listing.platform === 'mercari') {
        res = await mercariService.verifyStatus(listing._id || listing.mercariListingId);
      } else {
        res = await listingService.verifyLive(listing._id, listing.platform || 'ebay');
      }
      if (res.data?.success) {
        if (res.data.isLive) {
          let url = '';
          if (listing.platform === 'poshmark') url = listing.poshmarkUrl;
          else if (listing.platform === 'ebay') url = listing.ebayUrl;
          else if (listing.platform === 'etsy') url = listing.etsyUrl;
          else if (listing.platform === 'depop') url = listing.depopUrl;
          else if (listing.platform === 'mercari') url = listing.mercariUrl || (listing.mercariListingId ? `https://www.mercari.com/item/${listing.mercariListingId}/` : '');
          if (url) window.open(url, '_blank');
        } else {
          toast.warning(`Listing was deleted/delisted on ${listing.platform}. Status updated!`);
          fetchListings();
          if (activeTab === 'channel') fetchChannelInventory();
          setPreviewListing(null);
        }
      }
    } catch (err) {
      console.error("Error verifying listing status:", err);
      let url = '';
      if (listing.platform === 'poshmark') url = listing.poshmarkUrl;
      else if (listing.platform === 'ebay') url = listing.ebayUrl;
      else if (listing.platform === 'etsy') url = listing.etsyUrl;
      else if (listing.platform === 'depop') url = listing.depopUrl;
      else if (listing.platform === 'mercari') url = listing.mercariUrl || (listing.mercariListingId ? `https://www.mercari.com/item/${listing.mercariListingId}/` : '');
      if (url) window.open(url, '_blank');
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

  const handleMercariPublish = async (listing) => {
    setMercariPublishingId(listing._id);
    try {
      toast.info("Publishing to Mercari directly via API...");
      const res = await externalImportService.publish(listing._id, { platform: 'mercari' });
      if (res.data?.success) {
        toast.success("Listing successfully published to Mercari!");
        fetchListings();
        if (activeTab === 'channel') fetchChannelInventory();
      }
    } catch (error) {
      console.error("Error publishing to Mercari:", error);
      toast.error(error.response?.data?.message || "Failed to publish listing to Mercari.");
    } finally {
      setMercariPublishingId(null);
    }
  };

  const handleAmazonPublish = async (listing) => {
    setAmazonPublishingId(listing._id);
    try {
      toast.info("Publishing to Amazon directly via SP-API...");
      const res = await amazonService.publish(listing._id);
      if (res.data?.success) {
        toast.success("Listing successfully published to Amazon!");
        setPreviewListing(null);
        fetchListings();
        if (activeTab === 'channel') fetchChannelInventory();
      }
    } catch (error) {
      console.error("Error publishing to Amazon:", error);
      toast.error(error.response?.data?.message || "Failed to publish listing to Amazon.");
    } finally {
      setAmazonPublishingId(null);
    }
  };

  const renderModalFooter = () => {
    if (!previewListing) return null;

    const getPlatformInfo = (platformName, logoSrc, name) => {
      const platformSpecificItem = previewListing.listingsMap ? previewListing.listingsMap[platformName] : null;
      const rawPlatformStatus = platformSpecificItem 
        ? platformSpecificItem.status?.toLowerCase() 
        : previewListing[`${platformName}Status`]?.toLowerCase();

      let isLive = false;
      if (rawPlatformStatus === 'published' || rawPlatformStatus === 'active' || rawPlatformStatus === 'live') {
        isLive = true;
      } else if (!rawPlatformStatus) {
        if (previewListing.platform === platformName && (previewListing.status === 'published' || previewListing.status === 'active' || previewListing.status === 'live')) {
          isLive = true;
        }
      }

      let url = previewListing[`${platformName}Url`] || (previewListing.platform === platformName ? previewListing.url : null);
      if (!url) {
        const id = previewListing[`${platformName}ListingId`] || platformSpecificItem?.listingId || (previewListing.platform === platformName ? (previewListing.liveId || previewListing.itemId || previewListing._id) : null);
        if (id && id !== '-') {
          if (platformName === 'ebay') url = `https://www.ebay.com/itm/${id}`;
          else if (platformName === 'poshmark') url = `https://poshmark.com/listing/${id}`;
          else if (platformName === 'mercari') url = `https://www.mercari.com/item/${id}/`;
          else if (platformName === 'etsy') url = `https://www.etsy.com/listing/${id}`;
          else if (platformName === 'amazon') url = previewListing.amazonAsin ? `https://www.amazon.com/dp/${previewListing.amazonAsin}` : (id ? `https://sellercentral.amazon.com/inventory` : null);
          else if (platformName === 'depop') url = `https://www.depop.com/products/${id}`;
        }
      }

      let isLoading = false;
      let onPublish = () => {};

      if (platformName === 'ebay') {
        isLoading = publishingId === previewListing._id || (verifyingListingId === previewListing._id && previewListing.platform === 'ebay');
        onPublish = () => handlePublish(previewListing._id);
      } else if (platformName === 'poshmark') {
        isLoading = poshmarkDirectPublishingId === previewListing._id || (verifyingListingId === previewListing._id && previewListing.platform === 'poshmark');
        onPublish = () => handlePoshmarkDirectPublish(previewListing);
      } else if (platformName === 'mercari') {
        isLoading = mercariPublishingId === previewListing._id || (verifyingListingId === previewListing._id && previewListing.platform === 'mercari');
        onPublish = () => handleMercariPublish(previewListing);
      } else if (platformName === 'etsy') {
        isLoading = etsyPublishingId === previewListing._id || (verifyingListingId === previewListing._id && previewListing.platform === 'etsy');
        onPublish = () => handleEtsyPublish(previewListing);
      } else if (platformName === 'amazon') {
        isLoading = amazonPublishingId === previewListing._id || (verifyingListingId === previewListing._id && previewListing.platform === 'amazon');
        onPublish = () => handleAmazonPublish(previewListing);
      } else if (platformName === 'depop') {
        isLoading = depopDirectPublishingId === previewListing._id || (verifyingListingId === previewListing._id && previewListing.platform === 'depop');
        onPublish = () => handleDepopDirectPublish(previewListing);
      }

      return {
        id: platformName,
        name,
        logo: logoSrc,
        isLive: isLive && !!url,
        url,
        isLoading,
        onPublish
      };
    };

    let platforms = [
      getPlatformInfo('ebay', '/ebay.png', 'eBay'),
      getPlatformInfo('poshmark', '/poshmark.png', 'Poshmark'),
      getPlatformInfo('mercari', '/mercari.png', 'Mercari'),
      getPlatformInfo('etsy', '/etsy.png', 'Etsy'),
      getPlatformInfo('amazon', '/amazon.png', 'Amazon'),
      // getPlatformInfo('depop', '/depop.png', 'Depop'),
    ];

    if (activeTab === 'channel' || previewListing.isChannelProduct) {
      const targetPlatform = previewListing.platform || selectedChannel;
      platforms = platforms.filter(p => p.id === targetPlatform);
    }

    return (
      <div className="flex items-center gap-2">
        {platforms.map((p) => {
          const tooltip = p.isLoading 
            ? `Publishing to ${p.name}...` 
            : p.isLive 
              ? `Live on ${p.name} - Click to open listing` 
              : `Click to list on ${p.name}`;

          return (
            <button
              key={p.id}
              type="button"
              title={tooltip}
              disabled={p.isLoading}
              onClick={(e) => {
                e.stopPropagation();
                if (p.isLive) {
                  if (p.url) window.open(p.url, '_blank');
                  else handleVerifyAndOpen(previewListing);
                } else {
                  p.onPublish();
                }
              }}
              className={`relative w-9 h-9 rounded-full border flex items-center justify-center p-1.5 transition-all cursor-pointer group ${
                p.isLive
                  ? 'border-emerald-300 bg-white hover:border-emerald-500 hover:shadow-md hover:shadow-emerald-500/10 hover:scale-105'
                  : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-indigo-500 hover:shadow-md hover:shadow-indigo-500/10 hover:scale-105'
              }`}
            >
              <img 
                src={p.logo} 
                alt={p.name} 
                className={`w-full h-full object-contain transition-all ${
                  p.isLive ? '' : 'opacity-60 grayscale group-hover:opacity-100 group-hover:grayscale-0'
                }`} 
              />
              {/* Live Green Dot */}
              {p.isLive && (
                <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-white"></span>
                </span>
              )}
              {/* Spinner if Loading */}
              {p.isLoading && (
                <div className="absolute inset-0 bg-white/80 rounded-full flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  useEffect(() => {
    if (activeTab === 'channel') {
      fetchChannelInventory();
    }
  }, [activeTab, selectedChannel, user]);

  useEffect(() => {
    const cachedChannel = localStorage.getItem('elister_selected_listings_channel');
    if (cachedChannel) {
      setSelectedChannel(cachedChannel);
    } else {
      if (user?.ebayAccount?.connected) {
        setSelectedChannel('ebay');
        localStorage.setItem('elister_selected_listings_channel', 'ebay');
      }
      else if (user?.poshmarkAccount?.connected) {
        setSelectedChannel('poshmark');
        localStorage.setItem('elister_selected_listings_channel', 'poshmark');
      }
      else if (user?.depopAccount?.connected) {
        setSelectedChannel('depop');
        localStorage.setItem('elister_selected_listings_channel', 'depop');
      }
    }
  }, [user]);

  const getProductDetails = (product) => {
    if (!product) {
      return { title: '', brand: '', sku: '-', thumbnail: '', status: 'draft', price: 0, liveId: '-', url: '', dateText: '' };
    }
    const isEbay = selectedChannel === 'ebay';
    const isEtsy = selectedChannel === 'etsy';
    const isPoshmark = selectedChannel === 'poshmark';
    const isDepop = selectedChannel === 'depop';
    const isMercari = selectedChannel === 'mercari';
    const isAmazon = selectedChannel === 'amazon';

    const title = product.title || '';
    const brand = product.brand || '';
    const sku = product.sku || '-';
    const thumbnail = product.thumbnail || (product.images && product.images[0]) || '';

    const status = (isEbay || isEtsy || isPoshmark || isDepop || isMercari || isAmazon) 
      ? ((product.status === 'active' || product.status === 'live') ? 'active' : product.status === 'draft' ? 'draft' : 'inactive') 
      : 'live';

    // Price
    const price = product.selling_price !== undefined ? product.selling_price : product.price;
    const parsedPrice = typeof price === 'number' ? price : parseFloat(price) || 0;

    // Live ID and URL
    let liveId = '-';
    let url = '';
    if (isEbay) {
      liveId = product.ebayListingId || '-';
      url = product.ebayUrl || '';
    } else if (isEtsy) {
      liveId = product.etsyListingId || '-';
      url = product.etsyUrl || '';
    } else if (isPoshmark) {
      liveId = product.poshmarkListingId || '-';
      url = product.poshmarkUrl || '';
    } else if (isDepop) {
      liveId = product.depopListingId || '-';
      url = product.depopUrl || '';
    } else if (isMercari) {
      liveId = product.mercariListingId || '-';
      url = product.mercariUrl || (product.mercariListingId ? `https://www.mercari.com/item/${product.mercariListingId}/` : '');
    } else if (isAmazon) {
      liveId = product.amazonListingId || product.amazonAsin || '-';
      url = product.amazonUrl || (product.amazonAsin ? `https://www.amazon.com/dp/${product.amazonAsin}` : '');
    }

    // Extract and format accurate Date
    const rawDate = product.updated_at || product.updatedAt || product.createdAt || product.created_at || product.createdDate || product.created || product.updated || product.date_created || product.inventory_booked_at;
    let dateText = 'Recent';
    if (rawDate) {
      let d;
      if (typeof rawDate === 'number') {
        d = rawDate < 1e11 ? new Date(rawDate * 1000) : new Date(rawDate);
      } else {
        d = new Date(rawDate);
      }
      if (!isNaN(d.getTime())) {
        dateText = d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      }
    }

    return { title, brand, sku, thumbnail, status, price: parsedPrice, liveId, url, dateText };
  };

  const getChannelDisplayName = (channel) => {
    if (channel === 'ebay') return 'eBay';
    if (channel === 'etsy') return 'Etsy';
    if (channel === 'poshmark') return 'Poshmark';
    if (channel === 'depop') return 'Depop';
    if (channel === 'mercari') return 'Mercari';
    if (channel === 'amazon') return 'Amazon';
    return channel;
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

  // Filter & Sort Channel Products
  const filteredAndSortedChannelProducts = React.useMemo(() => {
    const term = (searchTerm || '').trim().toLowerCase();
    
    // 1. Filter
    const filtered = channelProducts.filter((product) => {
      const details = getProductDetails(product);
      
      const matchesSearch =
        !term ||
        (details.title && details.title.toLowerCase().includes(term)) ||
        (details.sku && details.sku.toLowerCase().includes(term)) ||
        (details.brand && details.brand.toLowerCase().includes(term)) ||
        (details.liveId && details.liveId.toLowerCase().includes(term)) ||
        (product.title && product.title.toLowerCase().includes(term)) ||
        (product.sku && product.sku.toLowerCase().includes(term)) ||
        (product.ebayListingId && product.ebayListingId.toLowerCase().includes(term)) ||
        (product.etsyListingId && product.etsyListingId.toLowerCase().includes(term)) ||
        (product.poshmarkListingId && product.poshmarkListingId.toLowerCase().includes(term)) ||
        (product.depopListingId && product.depopListingId.toLowerCase().includes(term)) ||
        (product.mercariListingId && product.mercariListingId.toLowerCase().includes(term));

      let matchesStatus = true;
      if (channelStatusFilter !== 'all') {
        const normalizedStatus = details.status; // 'active' | 'inactive' | 'draft'
        matchesStatus = normalizedStatus === channelStatusFilter;
      }

      return matchesSearch && matchesStatus;
    });

    // 2. Sort
    return [...filtered].sort((a, b) => {
      const detailsA = getProductDetails(a);
      const detailsB = getProductDetails(b);

      const rawDateA = a.updated_at || a.updatedAt || a.createdAt || a.created_at || a.createdDate || a.created || a.updated || a.date_created || 0;
      const rawDateB = b.updated_at || b.updatedAt || b.createdAt || b.created_at || b.createdDate || b.created || b.updated || b.date_created || 0;
      const timeA = typeof rawDateA === 'number' ? (rawDateA < 1e11 ? rawDateA * 1000 : rawDateA) : new Date(rawDateA || 0).getTime();
      const timeB = typeof rawDateB === 'number' ? (rawDateB < 1e11 ? rawDateB * 1000 : rawDateB) : new Date(rawDateB || 0).getTime();

      const priceA = detailsA.price || 0;
      const priceB = detailsB.price || 0;

      const titleA = (detailsA.title || '').toLowerCase();
      const titleB = (detailsB.title || '').toLowerCase();

      switch (channelSortOption) {
        case 'newest':
          return (timeB || 0) - (timeA || 0);
        case 'oldest':
          return (timeA || 0) - (timeB || 0);
        case 'price-asc':
          return priceA - priceB;
        case 'price-desc':
          return priceB - priceA;
        case 'title-asc':
          return titleA.localeCompare(titleB);
        case 'title-desc':
          return titleB.localeCompare(titleA);
        default:
          return (timeB || 0) - (timeA || 0);
      }
    });
  }, [channelProducts, searchTerm, channelStatusFilter, channelSortOption, selectedChannel]);

  // Pagination Calculations
  // Local
  const totalPages = Math.ceil(sortedListings.length / itemsPerPage) || 1;
  const activePage = Math.min(currentPage, totalPages);
  const startIndex = (activePage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, sortedListings.length);
  const paginatedListings = sortedListings.slice(startIndex, endIndex);

  // Channel
  const totalChannelPages = Math.ceil(filteredAndSortedChannelProducts.length / itemsPerPage) || 1;
  const activeChannelPage = Math.min(currentPage, totalChannelPages);
  const startChannelIndex = (activeChannelPage - 1) * itemsPerPage;
  const endChannelIndex = Math.min(startChannelIndex + itemsPerPage, filteredAndSortedChannelProducts.length);
  const paginatedChannelProducts = filteredAndSortedChannelProducts.slice(startChannelIndex, endChannelIndex);

  // Generalised Pagination Bounds for UI display
  const displayedTotalPages = activeTab === 'local' ? totalPages : totalChannelPages;
  const displayedActivePage = activeTab === 'local' ? activePage : activeChannelPage;
  const displayedStartIndex = activeTab === 'local' ? startIndex : startChannelIndex;
  const displayedEndIndex = activeTab === 'local' ? endIndex : endChannelIndex;
  const displayedTotalCount = activeTab === 'local' ? sortedListings.length : filteredAndSortedChannelProducts.length;

  // Reset currentPage to 1 when filters, tabs, or items per page change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, channelStatusFilter, channelSortOption, itemsPerPage, activeTab, selectedChannel, sortOption, filterListedOn, filterNoListedOn]);

  // Smart Import Modal Handlers
  const handleOpenImportModal = async () => {
    setImportModalOpen(true);
    setImportLoading(true);
    setImportSearchTerm('');
    try {
      const res = await listingService.getActiveChannelPreview();
      if (res.data.success) {
        const groups = res.data.groups || [];
        setImportGroups(groups);

        const initialGroupIds = {};
        const initialPlatforms = {};

        groups.forEach((grp) => {
          initialGroupIds[grp.groupId] = false;
          initialPlatforms[grp.groupId] = {};
          ['ebay', 'poshmark', 'mercari', /* 'depop', */ 'etsy'].forEach((plat) => {
            if (grp.channels?.[plat]) {
              initialPlatforms[grp.groupId][plat] = false;
            }
          });
        });

        setSelectedGroupIds(initialGroupIds);
        setSelectedPlatforms(initialPlatforms);
      } else {
        toast.error(res.data.message || 'Failed to fetch active channel listings.');
      }
    } catch (err) {
      console.error('Error fetching active channel preview:', err);
      toast.error(err.response?.data?.message || 'Failed to fetch active channel listings.');
    } finally {
      setImportLoading(false);
    }
  };

  const filteredImportGroups = importGroups
    .filter((grp) => {
      if (importFilterTab === 'multi' && grp.channelCount <= 1) return false;
      if (importFilterTab === 'single' && grp.channelCount > 1) return false;
      if (importFilterTab === 'in_local' && !grp.alreadyInLocal) return false;
      if (importFilterTab === 'not_in_local' && grp.alreadyInLocal) return false;

      if (!importSearchTerm) return true;
      const term = importSearchTerm.toLowerCase();
      const titleMatch = grp.title?.toLowerCase().includes(term);
      const skuMatch = grp.sku?.toLowerCase().includes(term);
      const brandMatch = grp.brand?.toLowerCase().includes(term);
      return titleMatch || skuMatch || brandMatch;
    })
    .sort((a, b) => {
      if (!a.alreadyInLocal && b.alreadyInLocal) return -1;
      if (a.alreadyInLocal && !b.alreadyInLocal) return 1;
      if ((b.unlinkedChannelCount || 0) !== (a.unlinkedChannelCount || 0)) {
        return (b.unlinkedChannelCount || 0) - (a.unlinkedChannelCount || 0);
      }
      return b.channelCount - a.channelCount;
    });

  const handleSelectByCriteria = (criteria) => {
    const newGroupIds = { ...selectedGroupIds };
    const newPlatforms = { ...selectedPlatforms };

    importGroups.forEach((grp) => {
      if (grp.alreadyInLocal) {
        newGroupIds[grp.groupId] = false;
        if (newPlatforms[grp.groupId]) {
          Object.keys(newPlatforms[grp.groupId]).forEach((p) => {
            newPlatforms[grp.groupId][p] = false;
          });
        }
        return;
      }

      let shouldSelect = false;
      if (criteria === 'all') {
        shouldSelect = true;
      } else if (criteria === 'multi') {
        shouldSelect = grp.channelCount > 1;
      } else if (criteria === 'single') {
        shouldSelect = grp.channelCount === 1;
      } else if (criteria === 'none') {
        shouldSelect = false;
      }

      let hasAnySelectedChannel = false;
      if (!newPlatforms[grp.groupId]) newPlatforms[grp.groupId] = {};

      ['ebay', 'poshmark', 'mercari', /* 'depop', */ 'etsy'].forEach((plat) => {
        if (grp.channels?.[plat]) {
          const isAlreadyInLocal = !!grp.channels[plat].alreadyInLocal;
          if (!isAlreadyInLocal && shouldSelect) {
            newPlatforms[grp.groupId][plat] = true;
            hasAnySelectedChannel = true;
          } else {
            newPlatforms[grp.groupId][plat] = false;
          }
        }
      });

      newGroupIds[grp.groupId] = hasAnySelectedChannel;
    });

    setSelectedGroupIds(newGroupIds);
    setSelectedPlatforms(newPlatforms);
  };

  const handleToggleSelectAllImport = () => {
    const importableFiltered = filteredImportGroups.filter(g => !g.alreadyInLocal);
    const allSelected = importableFiltered.length > 0 && importableFiltered.every(grp => selectedGroupIds[grp.groupId]);

    const newGroupIds = { ...selectedGroupIds };
    const newPlatforms = { ...selectedPlatforms };

    if (allSelected) {
      importableFiltered.forEach(grp => {
        newGroupIds[grp.groupId] = false;
        if (newPlatforms[grp.groupId]) {
          Object.keys(newPlatforms[grp.groupId]).forEach(plat => {
            newPlatforms[grp.groupId][plat] = false;
          });
        }
      });
    } else {
      importableFiltered.forEach(grp => {
        let hasAny = false;
        if (!newPlatforms[grp.groupId]) newPlatforms[grp.groupId] = {};
        ['ebay', 'poshmark', 'mercari', /* 'depop', */ 'etsy', 'amazon'].forEach(plat => {
          if (grp.channels?.[plat] && !grp.channels[plat].alreadyInLocal) {
            newPlatforms[grp.groupId][plat] = true;
            hasAny = true;
          }
        });
        newGroupIds[grp.groupId] = hasAny;
      });
    }

    setSelectedGroupIds(newGroupIds);
    setSelectedPlatforms(newPlatforms);
  };

  const handleToggleGroupRow = (groupId) => {
    const grp = importGroups.find(g => g.groupId === groupId);
    if (!grp || grp.alreadyInLocal) return;

    const isCurrentlySelected = !!selectedGroupIds[groupId];
    const newGroupIds = { ...selectedGroupIds };
    const newPlatforms = { ...selectedPlatforms };

    if (!newPlatforms[groupId]) newPlatforms[groupId] = {};

    let hasAnySelected = false;
    ['ebay', 'poshmark', 'mercari', /* 'depop', */ 'etsy', 'amazon'].forEach(plat => {
      if (grp.channels?.[plat]) {
        if (grp.channels[plat].alreadyInLocal) {
          newPlatforms[groupId][plat] = false;
        } else {
          newPlatforms[groupId][plat] = !isCurrentlySelected;
          if (!isCurrentlySelected) hasAnySelected = true;
        }
      }
    });

    newGroupIds[groupId] = !isCurrentlySelected && hasAnySelected;

    setSelectedGroupIds(newGroupIds);
    setSelectedPlatforms(newPlatforms);
  };

  const handleTogglePlatform = (groupId, platform) => {
    const grp = importGroups.find(g => g.groupId === groupId);
    if (!grp || grp.alreadyInLocal) return;
    if (grp.channels?.[platform]?.alreadyInLocal) return;

    const currentPlats = selectedPlatforms[groupId] || {};
    const newPlatState = !currentPlats[platform];
    const updatedPlats = { ...currentPlats, [platform]: newPlatState };

    const newPlatforms = { ...selectedPlatforms, [groupId]: updatedPlats };

    const hasAny = Object.keys(updatedPlats).some(p => updatedPlats[p]);
    const newGroupIds = { ...selectedGroupIds, [groupId]: hasAny };
    setSelectedPlatforms(newPlatforms);
    setSelectedGroupIds(newGroupIds);
  };

  const getSelectedImportCounts = () => {
    let groupCount = 0;
    let channelCount = 0;

    importGroups.forEach(grp => {
      if (selectedGroupIds[grp.groupId]) {
        const plats = selectedPlatforms[grp.groupId] || {};
        let activeInGroup = 0;
        ['ebay', 'poshmark', 'mercari', /* 'depop', */ 'etsy', 'amazon'].forEach(plat => {
          if (grp.channels?.[plat] && plats[plat] && !grp.channels[plat].alreadyInLocal) {
            activeInGroup++;
          }
        });
        if (activeInGroup > 0) {
          groupCount++;
          channelCount += activeInGroup;
        }
      }
    });

    return { groupCount, channelCount };
  };

  const handleExecuteImport = async () => {
    const selectedPayload = [];

    for (const group of importGroups) {
      if (!selectedGroupIds[group.groupId]) continue;

      const groupPlats = selectedPlatforms[group.groupId] || {};
      const activeSelectedChannels = {};
      let hasAny = false;

      for (const plat of ['ebay', 'poshmark', 'mercari', /* 'depop', */ 'etsy']) {
        if (group.channels?.[plat] && groupPlats[plat] && !group.channels[plat].alreadyInLocal) {
          activeSelectedChannels[plat] = {
            ...group.channels[plat],
            selected: true
          };
          hasAny = true;
        }
      }

      if (hasAny) {
        selectedPayload.push({
          ...group,
          channels: activeSelectedChannels
        });
      }
    }

    if (selectedPayload.length === 0) {
      toast.error('Please select at least one item and platform to import.');
      return;
    }

    setImportSubmitting(true);
    try {
      const res = await listingService.importActiveChannels({ items: selectedPayload });
      if (res.data.success) {
        toast.success(res.data.message || 'Successfully imported to Local Database!');
        setImportModalOpen(false);
        await fetchListings();
        setActiveTab('local');
        localStorage.setItem('elister_active_listings_tab', 'local');
      } else {
        toast.error(res.data.message || 'Failed to import items.');
      }
    } catch (err) {
      console.error('Error importing active channels:', err);
      toast.error(err.response?.data?.message || 'Failed to import items.');
    } finally {
      setImportSubmitting(false);
    }
  };

  // Smart Local Merge Handlers
  const handleOpenLocalMergeModal = async () => {
    setLocalMergeModalOpen(true);
    setLocalMergeLoading(true);
    setLocalMergeSearchTerm('');
    setLocalMergeFilterTab('all');
    try {
      const res = await listingService.getLocalMergePreview();
      if (res.data.success) {
        const groups = res.data.groups || [];
        setLocalMergeGroups(groups);
        const initialSelected = {};
        groups.forEach(g => {
          initialSelected[g.groupId] = false;
        });
        setSelectedMergeGroupIds(initialSelected);
      } else {
        toast.error(res.data.message || 'Failed to scan local duplicates.');
      }
    } catch (err) {
      console.error('Error fetching local merge preview:', err);
      toast.error(err.response?.data?.message || 'Failed to scan local duplicates.');
    } finally {
      setLocalMergeLoading(false);
    }
  };

  const filteredLocalMergeGroups = localMergeGroups.filter(grp => {
    if (localMergeFilterTab === 'multi' && grp.channelCount <= 1) return false;
    if (localMergeFilterTab === '2plus' && grp.duplicateCount < 2) return false;

    if (!localMergeSearchTerm) return true;
    const term = localMergeSearchTerm.toLowerCase();
    const titleMatch = grp.masterListing?.title?.toLowerCase().includes(term);
    const skuMatch = grp.masterListing?.sku?.toLowerCase().includes(term);
    return titleMatch || skuMatch;
  });

  const handleSelectLocalMergeByCriteria = (criteria) => {
    const newSelected = { ...selectedMergeGroupIds };
    localMergeGroups.forEach(grp => {
      if (criteria === 'all') {
        newSelected[grp.groupId] = true;
      } else if (criteria === 'multi') {
        newSelected[grp.groupId] = grp.channelCount > 1;
      } else if (criteria === '2plus') {
        newSelected[grp.groupId] = grp.duplicateCount >= 2;
      } else if (criteria === 'none') {
        newSelected[grp.groupId] = false;
      }
    });
    setSelectedMergeGroupIds(newSelected);
  };

  const handleToggleSelectAllLocalMerge = () => {
    const filtered = filteredLocalMergeGroups;
    const allSelected = filtered.length > 0 && filtered.every(g => selectedMergeGroupIds[g.groupId]);
    const newSelected = { ...selectedMergeGroupIds };

    if (allSelected) {
      filtered.forEach(g => { newSelected[g.groupId] = false; });
    } else {
      filtered.forEach(g => { newSelected[g.groupId] = true; });
    }
    setSelectedMergeGroupIds(newSelected);
  };

  const handleToggleMergeGroupRow = (groupId) => {
    setSelectedMergeGroupIds(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  const getSelectedLocalMergeCounts = () => {
    let groupCount = 0;
    let duplicateCount = 0;
    localMergeGroups.forEach(grp => {
      if (selectedMergeGroupIds[grp.groupId]) {
        groupCount++;
        duplicateCount += grp.duplicateCount;
      }
    });
    return { groupCount, duplicateCount };
  };

  const handleExecuteBulkMerge = async () => {
    const selectedGroupsToMerge = localMergeGroups.filter(g => selectedMergeGroupIds[g.groupId]);
    if (selectedGroupsToMerge.length === 0) {
      toast.error('Please select at least one cluster to merge.');
      return;
    }

    setLocalMergeSubmitting(true);
    try {
      const res = await listingService.bulkMergeListings({ groups: selectedGroupsToMerge });
      if (res.data.success) {
        toast.success(res.data.message || 'Successfully merged local listings!');
        setLocalMergeModalOpen(false);
        await fetchListings();
      } else {
        toast.error(res.data.message || 'Failed to merge listings.');
      }
    } catch (err) {
      console.error('Error executing bulk merge:', err);
      toast.error(err.response?.data?.message || 'Failed to merge listings.');
    } finally {
      setLocalMergeSubmitting(false);
    }
  };

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

  // Active Listed Dropdown state
  const [activeListedDropdown, setActiveListedDropdown] = useState(null);

  useEffect(() => {
    const handleClickOutside = () => setActiveListedDropdown(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  // Close the floating crosslisting dropdown if the page scrolls out from under it,
  // since its position is computed once (fixed, in viewport coords) at open time.
  useEffect(() => {
    if (!activeListedDropdown) return;
    const closeOnScroll = () => setActiveListedDropdown(null);
    window.addEventListener('scroll', closeOnScroll, true);
    window.addEventListener('resize', closeOnScroll);
    return () => {
      window.removeEventListener('scroll', closeOnScroll, true);
      window.removeEventListener('resize', closeOnScroll);
    };
  }, [activeListedDropdown]);

  const getListingUrl = (item, platformName, checkId) => {
    if (item[`${platformName}Url`]) return item[`${platformName}Url`];
    const platformSpecificItem = item.listingsMap ? item.listingsMap[platformName] : null;
    if (platformSpecificItem && platformSpecificItem.url) return platformSpecificItem.url;

    if (platformName === 'depop') {
      return `https://www.depop.com/products/${checkId}`;
    } else if (platformName === 'ebay') {
      return `https://www.ebay.com/itm/${checkId}`;
    } else if (platformName === 'poshmark') {
      return `https://poshmark.com/listing/${checkId}`;
    } else if (platformName === 'etsy') {
      return `https://www.etsy.com/listing/${checkId}`;
    } else if (platformName === 'amazon') {
      return `https://www.amazon.com/dp/${checkId}`;
    }
    return '#';
  };

  const handleEditListedItem = (item, platformName) => {
    setActiveListedDropdown(null);
    const targetItem = item.listingsMap && item.listingsMap[platformName] 
      ? item.listingsMap[platformName] 
      : item;
    setSelectedListing(targetItem);
    setSelectedPlatform(platformName);
    setIsEditMode(true);
    setModalOpen(true);
  };

  const handleMoveToNewList = async (item, platformName) => {
    setActiveListedDropdown(null);

    try {
      if (item._id && !String(item._id).startsWith('mock-')) {
        // Create a brand new independent listing copy in DB
        const newListingPayload = {
          title: item.title || 'New Listing',
          description: item.description || '',
          price: item.price || 0,
          originalPrice: item.originalPrice || 0,
          brand: item.brand || '',
          size: item.size || '',
          color: item.color || '',
          sku: item.sku ? `${item.sku}-NEW` : `KL${Date.now()}`,
          category: item.category || '',
          categoryId: item.categoryId || '',
          material: item.material || '',
          quantity: item.quantity || 1,
          images: item.images || (item.thumbnail ? [item.thumbnail] : []),
          age: item.age || '',
          source: item.source || '',
          bodyFit: item.bodyFit || '',
          occasion: item.occasion || '',
          depopType: item.depopType || '',
          fastening: item.fastening || '',
          fit: item.fit || '',
          shippingPrice: item.shippingPrice || 0,
          worldwideShipping: item.worldwideShipping || false,
          country: item.country || 'US',
          styleTag: item.styleTag || '',
          status: 'draft',
          platform: 'draft'
        };

        await listingService.create(newListingPayload);
        toast.success(`✨ Created new draft listing! Original ${platformName.toUpperCase()} listed item remains untouched.`);
        fetchListings();
      } else {
        toast.info("Created new draft copy!");
      }
    } catch (err) {
      console.error('Error creating new listing copy:', err);
      toast.error('Failed to create new listing copy.');
    }
  };

  const handleDelistItem = async (item, platformName) => {
    setActiveListedDropdown(null);

    if (String(item._id).startsWith('mock-')) {
      toast.info(`Mock item cannot be delisted from real platforms.`);
      return;
    }

    const confirmDelist = await confirm(`Are you sure you want to delist this item from ${platformName.toUpperCase()}?`, {
      title: 'Delist Listing',
      destructive: true
    });
    if (!confirmDelist) return;

    try {
      toast.info(`Delisting from ${platformName.toUpperCase()}...`);
      const response = await listingService.delist(item._id, platformName);
      if (response.data.success) {
        toast.success(`Successfully delisted from ${platformName.toUpperCase()}!`);
        fetchListings();
      } else {
        toast.error(response.data.message || `Failed to delist from ${platformName}`);
      }
    } catch (err) {
      console.error(`Error delisting:`, err);
      toast.error(err.response?.data?.message || `Failed to delist from ${platformName}`);
    }
  };

  const handleDeletePlatformListing = async (item, platformName) => {
    setActiveListedDropdown(null);

    const platformDisplayName = getChannelDisplayName(platformName);
    const disconnectOnly = activeTab === 'local';

    const confirmMessage = disconnectOnly
      ? `Are you sure you want to delete this listing connection from ${platformDisplayName}? This will NOT delete or end the listing on the actual ${platformDisplayName} website. It will only clear the connection in this app.`
      : `Are you sure you want to end/delete this listing from the actual ${platformDisplayName} website? This will end the active listing on the actual marketplace and delete it from your inventory.`;

    const confirmTitle = disconnectOnly
      ? `Delete connection from ${platformDisplayName}`
      : `Delete from ${platformDisplayName} (Actual Site)`;

    const confirmDelete = await confirm(
      confirmMessage,
      {
        title: confirmTitle,
        destructive: true
      }
    );
    if (!confirmDelete) return;

    try {
      toast.info(disconnectOnly ? `Disconnecting listing...` : `Deleting listing from ${platformDisplayName} site...`);
      
      const targetId = item._id;
      if (!targetId || String(targetId).startsWith('mock-')) {
        toast.success(`Successfully deleted connection for mock item!`);
        return;
      }
      
      const response = await listingService.deletePlatform(targetId, platformName, disconnectOnly);
      if (response.data?.success || response.data) {
        toast.success(
          disconnectOnly 
            ? `Successfully disconnected listing connection!` 
            : `Successfully deleted listing from ${platformDisplayName} site!`
        );
        fetchListings();
        fetchChannelInventory();
      } else {
        toast.error(response.data?.message || `Failed to delete listing from ${platformDisplayName}`);
      }
    } catch (err) {
      console.error(`Error deleting platform listing:`, err);
      toast.error(err.response?.data?.message || `Failed to delete listing from ${platformDisplayName}`);
    }
  };

  const handleMoveToNewItem = async (item, platformName) => {
    setActiveListedDropdown(null);

    const platformDisplayName = getChannelDisplayName(platformName);
    const confirmMove = await confirm(
      `Are you sure you want to move this ${platformDisplayName} listing to a New Item row in Local Database? It will be removed from this current row and created as an independent new item.`,
      {
        title: `Move ${platformDisplayName} to New Item`,
        destructive: false
      }
    );
    if (!confirmMove) return;

    try {
      toast.info(`Moving ${platformDisplayName} to a new item...`);
      const targetId = item._id;
      if (!targetId || String(targetId).startsWith('mock-')) {
        toast.success(`Successfully moved mock item to new item!`);
        return;
      }

      const response = await listingService.moveToNewItem(targetId, platformName);
      if (response.data?.success) {
        toast.success(`Successfully moved ${platformDisplayName} to a new independent item!`);
        fetchListings();
        fetchChannelInventory();
      } else {
        toast.error(response.data?.message || `Failed to move ${platformDisplayName} to new item.`);
      }
    } catch (err) {
      console.error(`Error moving platform to new item:`, err);
      toast.error(err.response?.data?.message || `Failed to move ${platformDisplayName} to new item.`);
    }
  };

  const handleMergeChannel = async (sourceListingId, targetListingId, platformName) => {
    const platformDisplayName = getChannelDisplayName(platformName);
    toast.info(`Merging ${platformDisplayName} into item...`);

    try {
      if (String(sourceListingId).startsWith('mock-') || String(targetListingId).startsWith('mock-')) {
        toast.success(`Successfully merged ${platformDisplayName} into item!`);
        return;
      }

      const response = await listingService.mergeChannel({
        sourceListingId,
        targetListingId,
        platform: platformName
      });

      if (response.data?.success) {
        toast.success(`Successfully merged ${platformDisplayName} into this item!`);
        fetchListings();
        fetchChannelInventory();
      } else {
        toast.error(response.data?.message || `Failed to merge ${platformDisplayName}`);
      }
    } catch (err) {
      console.error('Error merging channel:', err);
      toast.error(err.response?.data?.message || `Failed to merge ${platformDisplayName}`);
    }
  };

  const handleVerifyStatus = async (item, platformName) => {
    setActiveListedDropdown(null);
    
    if (String(item._id).startsWith('mock-')) {
      toast.info(`Mock item status is verified.`);
      return;
    }

    const platform = platformName || item.platform || selectedChannel || 'ebay';
    toast.info(`Verifying live status on ${platform.toUpperCase()}...`);
    try {
      let response;
      if (platform === 'mercari') {
        response = await mercariService.verifyStatus(item._id || item.mercariListingId);
      } else {
        response = await listingService.verifyLive(item._id, platform);
      }
      
      if (response.data?.success) {
        toast.success(response.data.message || `Status verified on ${platform.toUpperCase()}!`);
        fetchListings();
        if (activeTab === 'channel') {
          fetchChannelInventory();
        }
      }
    } catch (err) {
      console.error(`Error verifying live status:`, err);
      toast.error(err.response?.data?.message || `Failed to verify status on ${platform.toUpperCase()}.`);
    }
  };

  const handleRelistItemDirect = async (item, platformName) => {
    setActiveListedDropdown(null);
    
    if (String(item._id).startsWith('mock-')) {
      toast.info(`Mock item cannot be relisted.`);
      return;
    }

    toast.info(`Relisting on ${platformName.toUpperCase()}...`);
    
    try {
      if (platformName === 'ebay') {
        const res = await listingService.publish(item._id);
        if (res.data?.success || res.data) {
          toast.success("Listing successfully reactivated on eBay!");
          fetchListings();
        }
      } else if (platformName === 'etsy') {
        const res = await etsyService.publish(item._id);
        if (res.data?.success) {
          toast.success("Listing successfully reactivated on Etsy!");
          fetchListings();
        }
      } else if (platformName === 'poshmark') {
        const res = await externalImportService.publish(item._id, { platform: 'poshmark' });
        if (res.data?.success) {
          toast.success("Listing successfully reactivated on Poshmark!");
          fetchListings();
        }
      } else if (platformName === 'depop') {
        const res = await externalImportService.publish(item._id, { platform: 'depop' });
        if (res.data?.success) {
          toast.success("Listing successfully reactivated on Depop!");
          fetchListings();
        }
      } else if (platformName === 'mercari') {
        const res = await externalImportService.publish(item._id, { platform: 'mercari' });
        if (res.data?.success) {
          toast.success("Listing successfully reactivated on Mercari!");
          fetchListings();
        }
      } else if (platformName === 'amazon') {
        const res = await amazonService.publish(item._id);
        if (res.data?.success) {
          toast.success("Listing successfully reactivated on Amazon!");
          fetchListings();
        }
      }
    } catch (error) {
      console.error(`Error relisting on ${platformName}:`, error);
      toast.error(error.response?.data?.message || `Failed to relist on ${platformName}.`);
    }
  };

  // Handle clear filters
  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setChannelStatusFilter('all');
    setChannelSortOption('newest');
    localStorage.removeItem('elister_channel_sort_option');
    setFilterListedOn([]);
    setFilterNoListedOn([]);
    setTempListedOn([]);
    setTempNoListedOn([]);
    setSortOption('newest');
    setTempSortOption('newest');
  };

  const renderCrosslistingCell = (item, platformName, checkId, logoSrc) => {
    const disconnectOnly = activeTab === 'local';
    const platformSpecificItem = item.listingsMap ? item.listingsMap[platformName] : null;
    const isMasterListing = platformSpecificItem && platformSpecificItem._id === item._id;
    const rawPlatformStatus = (platformSpecificItem && !isMasterListing)
      ? platformSpecificItem.status?.toLowerCase() 
      : item[`${platformName}Status`]?.toLowerCase();

    // Clean status resolver to avoid false positives
    let isListed = false;
    let isDraft = false;
    let isDelisted = false;
    let isFailed = false;

    if (rawPlatformStatus === 'none' || rawPlatformStatus === 'unlisted') {
      // Explicitly Not Listed on this platform
      isListed = false;
      isDraft = false;
      isDelisted = false;
      isFailed = false;
    } else if (rawPlatformStatus === 'published' || rawPlatformStatus === 'active') {
      isListed = true;
    } else if (rawPlatformStatus === 'draft') {
      isDraft = true;
    } else if (rawPlatformStatus === 'delisted') {
      isDelisted = true;
    } else if (rawPlatformStatus === 'failed') {
      isFailed = true;
    } else if (!rawPlatformStatus) {
      // Fallbacks only if rawPlatformStatus is undefined
      const specificStatus = platformSpecificItem?.status?.toLowerCase();
      if (specificStatus && specificStatus !== 'none' && specificStatus !== 'unlisted') {
        if (specificStatus === 'published' || specificStatus === 'active') {
          isListed = true;
        } else if (specificStatus === 'draft') {
          isDraft = true;
        } else if (specificStatus === 'delisted') {
          isDelisted = true;
        } else if (specificStatus === 'failed') {
          isFailed = true;
        }
      } else if (item.platform === platformName) {
        const itemStatus = item.status?.toLowerCase();
        if (itemStatus === 'active' || itemStatus === 'published') {
          isListed = true;
        } else if (itemStatus === 'draft') {
          isDraft = true;
        } else if (itemStatus === 'delisted') {
          isDelisted = true;
        } else if (itemStatus === 'failed') {
          isFailed = true;
        }
      }
    }

    // Ensure listed items have a valid checkId (if not mock / fallback)
    if (isListed && (!checkId || checkId === '-')) {
      const realId = checkId || item[`${platformName}ListingId`] || platformSpecificItem?.listingId;
      if (!realId || realId === '-') {
        isListed = false;
      }
    }

    const isDropdownOpen = activeListedDropdown?.itemId === item._id && activeListedDropdown?.platform === platformName;
    const isBeingDragged = draggedChannel?.sourceListingId === item._id && draggedChannel?.platform === platformName;

    if (isListed || isDelisted || isDraft || isFailed) {
      const liveUrl = getListingUrl(item, platformName, checkId);

      return (
        <div 
          draggable={activeTab === 'local'}
          onDragStart={(e) => {
            if (activeTab !== 'local') return;
            e.dataTransfer.setData('text/plain', JSON.stringify({
              sourceListingId: item._id,
              platform: platformName,
              title: item.title,
              images: item.images || [item.thumbnail],
              sku: item.sku
            }));
            e.dataTransfer.effectAllowed = 'move';
            setDraggedChannel({ sourceListingId: item._id, platform: platformName, title: item.title });
          }}
          onDragEnd={() => {
            setDraggedChannel(null);
            setDragOverTarget(null);
          }}
          className={`relative flex flex-col items-center justify-center py-1 select-none w-full ${
            activeTab === 'local' ? 'cursor-grab active:cursor-grabbing' : ''
          } ${isBeingDragged ? 'opacity-40 scale-95' : ''}`}
        >
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (isDropdownOpen) {
                setActiveListedDropdown(null);
                return;
              }
              const rect = e.currentTarget.getBoundingClientRect();
              const openUpward = rect.bottom > window.innerHeight * 0.6;
              const menuWidth = 180;
              const left = Math.min(
                Math.max(rect.left + rect.width / 2 - menuWidth / 2, 8),
                window.innerWidth - menuWidth - 8
              );
              setActiveListedDropdown({
                itemId: item._id,
                platform: platformName,
                openUpward,
                left,
                verticalOffset: openUpward ? window.innerHeight - rect.top + 4 : rect.bottom + 4,
              });
            }}
            className="flex flex-col items-center justify-center cursor-pointer group hover:scale-105 transition-all select-none w-full"
            title={activeTab === 'local' ? "Click for options or Drag to another item to merge" : "Click for options"}
          >
            <div className={`w-8 h-8 rounded-full border flex items-center justify-center shadow-sm shrink-0 transition-colors ${
              isListed 
                ? 'border-slate-100 bg-white group-hover:border-indigo-200' 
                : isDraft
                  ? 'border-orange-100 bg-white group-hover:border-orange-300'
                  : isFailed
                    ? 'border-rose-100 bg-rose-50/50 group-hover:border-rose-300 group-hover:bg-rose-100/50'
                    : 'border-amber-200 bg-amber-50/50 group-hover:border-amber-300 group-hover:bg-amber-100/50'
            }`}>
              <img src={logoSrc} className={`w-5 h-5 object-contain ${isListed || isDraft ? '' : 'opacity-60 grayscale group-hover:opacity-100 group-hover:grayscale-0'}`} alt={platformName} />
            </div>
            <span className={`text-[10px] font-black mt-1 select-none flex items-center gap-0.5 ${
              isListed 
                ? 'text-emerald-600 group-hover:text-indigo-650' 
                : isDraft
                  ? 'text-orange-500 group-hover:text-orange-700'
                  : isFailed
                    ? 'text-rose-600 group-hover:text-rose-800'
                    : 'text-amber-500 group-hover:text-amber-700'
            }`}>
              {isListed ? 'Listed' : isDraft ? 'Draft' : isFailed ? 'Failed' : 'Delisted'} <ChevronDown size={10} className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </span>
            {isListed && (
              <span className="text-[9px] font-mono text-slate-400 mt-0.5 select-none truncate max-w-[70px] text-center" title={checkId}>{checkId}</span>
            )}
          </div>

          {isDropdownOpen && createPortal(
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                left: activeListedDropdown.left,
                [activeListedDropdown.openUpward ? 'bottom' : 'top']: activeListedDropdown.verticalOffset,
                width: 180,
              }}
              className="z-[999] bg-white rounded-2xl shadow-2xl border border-slate-100 py-1.5 animate-in fade-in zoom-in-95 duration-150 text-left"
            >
              {!isDraft && liveUrl && liveUrl !== '#' && (
                <a
                  href={liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setActiveListedDropdown(null)}
                  className="w-full px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <ExternalLink size={13} className="text-indigo-500 shrink-0" />
                  View on {getChannelDisplayName(platformName)}
                </a>
              )}
              {!isDraft && (
                <button
                  type="button"
                  onClick={() => handleVerifyStatus(item, platformName)}
                  className="w-full px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2 transition-colors cursor-pointer text-left border-t border-slate-100"
                >
                  <RefreshCw size={13} className="text-indigo-500 shrink-0" />
                  Verify Status
                </button>
              )}
              <button
                type="button"
                onClick={() => handleEditListedItem(item, platformName)}
                className="w-full px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2 transition-colors cursor-pointer text-left border-t border-slate-100"
              >
                <Edit size={13} className="text-indigo-500 shrink-0" />
                Edit Listing
              </button>
              {(isDraft || isDelisted || isFailed) && (
                <button
                  type="button"
                  onClick={() => handleRelistItemDirect(item, platformName)}
                  className="w-full px-3.5 py-2 text-xs font-bold text-emerald-650 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2 transition-colors cursor-pointer text-left border-t border-slate-100"
                >
                  <RefreshCw size={13} className="text-emerald-500 shrink-0" />
                  List / Publish
                </button>
              )}
              {isListed && (
                <button
                  type="button"
                  onClick={() => handleDelistItem(item, platformName)}
                  className="w-full px-3.5 py-2 text-xs font-bold text-amber-600 hover:bg-amber-50 hover:text-amber-700 flex items-center gap-2 transition-colors cursor-pointer text-left border-t border-slate-100"
                >
                  <XCircle size={13} className="text-amber-500 shrink-0" />
                  Delist Listing
                </button>
              )}
              {activeTab === 'local' ? (
                <>
                  {(isDraft || isListed) && (
                    <button
                      type="button"
                      onClick={() => handleMoveToNewItem(item, platformName)}
                      className="w-full px-3.5 py-2 text-xs font-bold text-indigo-650 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2 transition-colors cursor-pointer text-left border-t border-slate-100"
                    >
                      <Plus size={13} className="text-indigo-500 shrink-0" />
                      New Item
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeletePlatformListing(item, platformName, true)}
                    className="w-full px-3.5 py-2 text-xs font-bold text-red-650 hover:bg-red-50 hover:text-red-700 flex items-center gap-2 transition-colors cursor-pointer text-left border-t border-slate-100"
                  >
                    <Trash2 size={13} className="text-red-500 shrink-0" />
                    Delete from Crosslisting
                  </button>
                  {(isListed || isDelisted) && (
                    <button
                      type="button"
                      onClick={() => handleDeletePlatformListing(item, platformName, false)}
                      className="w-full px-3.5 py-2 text-xs font-bold text-red-650 hover:bg-red-50 hover:text-red-700 flex items-center gap-2 transition-colors cursor-pointer text-left border-t border-slate-100"
                    >
                      <Trash2 size={13} className="text-red-500 shrink-0" />
                      Delete from {getChannelDisplayName(platformName)} (Actual Site)
                    </button>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => handleDeletePlatformListing(item, platformName, false)}
                  className="w-full px-3.5 py-2 text-xs font-bold text-red-650 hover:bg-red-50 hover:text-red-700 flex items-center gap-2 transition-colors cursor-pointer text-left border-t border-slate-100"
                >
                  <Trash2 size={13} className="text-red-500 shrink-0" />
                  Delete from {getChannelDisplayName(platformName)}
                </button>
              )}
            </div>,
            document.body
          )}
        </div>
      );
    } else {
      // Not Listed status
      const isDropTarget = activeTab === 'local' && draggedChannel && draggedChannel.platform === platformName && draggedChannel.sourceListingId !== item._id;
      const isHovered = dragOverTarget === `${item._id}-${platformName}`;

      return (
        <div 
          onClick={() => handleOpenCrosslisting(platformSpecificItem || item, platformName)}
          onDragOver={(e) => {
            if (isDropTarget) {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (dragOverTarget !== `${item._id}-${platformName}`) {
                setDragOverTarget(`${item._id}-${platformName}`);
              }
            }
          }}
          onDragLeave={() => {
            if (dragOverTarget === `${item._id}-${platformName}`) {
              setDragOverTarget(null);
            }
          }}
          onDrop={async (e) => {
            if (!isDropTarget) return;
            e.preventDefault();
            setDragOverTarget(null);
            setDraggedChannel(null);
            try {
              const dataStr = e.dataTransfer.getData('text/plain');
              if (!dataStr) return;
              const data = JSON.parse(dataStr);
              if (data.sourceListingId && data.platform === platformName && data.sourceListingId !== item._id) {
                // Client-side quick validation check
                const srcTitle = (data.title || '').trim().toLowerCase();
                const trgTitle = (item.title || '').trim().toLowerCase();
                const srcSku = (data.sku || '').trim().toLowerCase();
                const trgSku = (item.sku || '').trim().toLowerCase();

                const skuMatches = srcSku && trgSku && srcSku !== '-' && trgSku !== '-' && srcSku === trgSku;
                const imagesMatch = Array.isArray(data.images) && Array.isArray(item.images) && data.images.some(img => item.images.includes(img));
                
                // Token overlap check
                const t1 = srcTitle.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 1);
                const t2 = trgTitle.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 1);
                const common = t1.filter(w => t2.includes(w));
                const diceScore = (t1.length + t2.length > 0) ? (2 * common.length) / (t1.length + t2.length) : 0;

                if (!skuMatches && !imagesMatch && diceScore < 0.60) {
                  toast.error(`Cannot merge: Products do not match (${Math.round(diceScore * 100)}% match)! Merging is only allowed for the same physical product across platforms.`);
                  return;
                }

                await handleMergeChannel(data.sourceListingId, item._id, platformName);
              }
            } catch (err) {
              console.error('Drop error:', err);
            }
          }}
          className={`flex flex-col items-center justify-center py-1 cursor-pointer group transition-all select-none ${
            isDropTarget
              ? isHovered
                ? 'scale-110 ring-2 ring-indigo-500 rounded-xl bg-indigo-50/90 shadow-lg animate-pulse'
                : 'ring-2 ring-dashed ring-indigo-400 rounded-xl bg-indigo-50/40 animate-pulse'
              : 'hover:scale-105'
          }`}
          title={isDropTarget ? "Drop here to merge channel into this item!" : "Not Listed"}
        >
          <div className={`w-8 h-8 rounded-full border flex items-center justify-center shadow-sm shrink-0 transition-colors ${
            isDropTarget
              ? isHovered
                ? 'border-indigo-500 bg-indigo-100 text-indigo-700'
                : 'border-indigo-300 bg-indigo-50 text-indigo-500'
              : 'border-slate-100 bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 group-hover:border-indigo-100'
          }`}>
            {/* Custom generic shop/building logo for grey placeholder */}
            <svg className="w-4 h-4 opacity-40 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <span className={`text-[10px] font-bold mt-1 select-none transition-colors ${
            isDropTarget ? 'text-indigo-600 font-extrabold' : 'text-slate-400 group-hover:text-indigo-600'
          }`}>
            {isDropTarget ? (isHovered ? 'Drop Here' : 'Drop to Merge') : 'Not Listed'}
          </span>
        </div>
      );
    }
  };

  // Builds an item shape compatible with renderCrosslistingCell's Listed/Delisted
  // dropdown for a Channel Inventory row. If the product was created via Elister
  // (correlated by its live marketplace listing ID, falling back to SKU), the full
  // Listing record is reused so Edit/Move-to-New-List/Delist keep working against
  // it; otherwise a minimal item is built from the channel product itself.
  const buildChannelDropdownItem = (product, details, platformName) => {
    const liveId = details.liveId;
    let matched = null;

    if (liveId && liveId !== '-') {
      matched = groupedListingsList.find(l => l[`${platformName}ListingId`] === liveId);
    }
    if (!matched && product.sku && product.sku !== '-') {
      matched = groupedListingsList.find(l => l.sku === product.sku || (l.skus || []).includes(product.sku));
    }

    const base = matched ? { ...matched } : { 
      _id: product._id || product.id || details.liveId || product.sku || Math.random().toString(), 
      title: product.title || details.title, 
      sku: product.sku || '',
      brand: product.brand || details.brand || '',
      size: product.size || '',
      color: product.color || '',
      description: product.description || '',
      price: typeof product.selling_price === 'number' ? product.selling_price : (parseFloat(product.price) || 0),
      originalPrice: product.originalPrice || '',
      images: product.images && product.images.length > 0 ? product.images : (details.thumbnail ? [details.thumbnail] : []),
      category: product.category_name || product.category || details.category || '',
      itemSpecifics: product.itemSpecifics || {},
      selectedCondition: product.condition || product.selectedCondition || '',
      conditionNote: product.conditionNote || '',
      status: details.status === 'active' ? 'published' : (details.status === 'draft' ? 'draft' : 'delisted'),
      isFromSyncedProduct: true,
      isChannelProduct: true
    };
    delete base.listingsMap;
    base.platform = platformName;
    base[`${platformName}Url`] = details.url || base[`${platformName}Url`];
    base[`${platformName}Status`] = details.status === 'active' ? 'published' : (details.status === 'draft' ? 'draft' : 'delisted');
    base[`${platformName}ListingId`] = details.liveId || product.mercariListingId || base[`${platformName}ListingId`];
    if (platformName === 'mercari') {
      base.mercariListingId = product.mercariListingId || (product.sku && product.sku.startsWith('M-m') ? product.sku.replace('M-', '') : details.liveId);
      base.categoryId = product.categoryId || base.categoryId;
    }
    return base;
  };

  // Channel-specific stat metrics
  const channelStats = React.useMemo(() => {
    let total = channelProducts.length;
    let active = 0;
    let draft = 0;
    let inactive = 0;
    let errors = 0;

    channelProducts.forEach(p => {
      const details = getProductDetails(p);
      const st = (details.status || p.status || '').toLowerCase();
      if (st === 'active' || st === 'live' || st === 'published') active++;
      else if (st === 'draft') draft++;
      else if (st === 'failed' || st === 'error') errors++;
      else inactive++;
    });

    return { total, active, draft, inactive, errors };
  }, [channelProducts]);

  const statCards = activeTab === 'local' ? [
    {
      key: 'all',
      label: 'Total Listings',
      value: stats?.total ?? 0,
      icon: <Boxes size={20} />,
      color: 'bg-indigo-50 text-indigo-600 border-indigo-100',
      ring: 'border-indigo-500 ring-2 ring-indigo-500/15',
    },
    {
      key: 'active',
      label: 'Active',
      value: stats?.published ?? 0,
      icon: <CheckCircle2 size={20} />,
      color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      ring: 'border-emerald-500 ring-2 ring-emerald-500/15',
    },
    {
      key: 'draft',
      label: 'Drafts',
      value: stats?.draft ?? 0,
      icon: <FileText size={20} />,
      color: 'bg-amber-50 text-amber-600 border-amber-100',
      ring: 'border-amber-500 ring-2 ring-amber-500/15',
    },
    {
      key: 'failed',
      label: 'Errors',
      value: stats?.failed ?? 0,
      icon: <AlertCircle size={20} />,
      color: 'bg-rose-50 text-rose-600 border-rose-100',
      ring: 'border-rose-500 ring-2 ring-rose-500/15',
    },
    {
      key: 'unlisted',
      label: 'Unlisted',
      value: stats?.unlisted ?? 0,
      icon: <EyeOff size={20} />,
      color: 'bg-slate-100 text-slate-500 border-slate-200',
      ring: 'border-slate-400 ring-2 ring-slate-400/15',
    },
  ] : [
    {
      key: 'all',
      label: `${getChannelDisplayName(selectedChannel)} Total`,
      value: channelStats.total,
      icon: <Boxes size={20} />,
      color: 'bg-indigo-50 text-indigo-600 border-indigo-100',
      ring: 'border-indigo-500 ring-2 ring-indigo-500/15',
    },
    {
      key: 'active',
      label: 'Active',
      value: channelStats.active,
      icon: <CheckCircle2 size={20} />,
      color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      ring: 'border-emerald-500 ring-2 ring-emerald-500/15',
    },
    {
      key: 'draft',
      label: 'Drafts',
      value: channelStats.draft,
      icon: <FileText size={20} />,
      color: 'bg-amber-50 text-amber-600 border-amber-100',
      ring: 'border-amber-500 ring-2 ring-amber-500/15',
    },
    {
      key: 'failed',
      label: 'Errors',
      value: channelStats.errors,
      icon: <AlertCircle size={20} />,
      color: 'bg-rose-50 text-rose-600 border-rose-100',
      ring: 'border-rose-500 ring-2 ring-rose-500/15',
    },
    {
      key: 'inactive',
      label: 'Inactive / Ended',
      value: channelStats.inactive,
      icon: <EyeOff size={20} />,
      color: 'bg-slate-100 text-slate-500 border-slate-200',
      ring: 'border-slate-400 ring-2 ring-slate-400/15',
    },
  ];

  return (
    <div className="space-y-6">

      {/* STATS BANNER */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
        {statCards.map((card, idx) => (
          <motion.div
            key={card.key}
            initial={reducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reducedMotion ? 0 : idx * 0.05 }}
            onClick={() => {
              if (activeTab === 'local') {
                setStatusFilter(card.key);
              } else {
                setChannelStatusFilter(card.key);
              }
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { 
              if (e.key === 'Enter') {
                if (activeTab === 'local') setStatusFilter(card.key);
                else setChannelStatusFilter(card.key);
              }
            }}
            className={`p-5 rounded-3xl border flex flex-col justify-between h-32 cursor-pointer transition-all select-none ${
              (activeTab === 'local' ? statusFilter === card.key : channelStatusFilter === card.key)
                ? `${card.ring} bg-white shadow-md`
                : 'border-slate-100 bg-white shadow-sm hover:shadow-card-hover hover:border-slate-200'
            }`}
          >
            <div className="flex justify-between items-start">
              <div className={`p-3 rounded-2xl border shrink-0 ${card.color}`}>
                {card.icon}
              </div>
            </div>
            <div>
              <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-wider">{card.label}</h3>
              <p className="text-2xl font-black text-slate-900 mt-0.5">{(card.value ?? 0).toLocaleString()}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* TABS SWITCHER & SYNC BAR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
        {/* Tabs */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1.5 w-full sm:w-auto">
          <button
            onClick={() => {
              setActiveTab('local');
              localStorage.setItem('elister_active_listings_tab', 'local');
            }}
            className={`flex-1 sm:flex-none px-6 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'local'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Local Database
          </button>
          <button
            onClick={() => {
              setActiveTab('channel');
              localStorage.setItem('elister_active_listings_tab', 'channel');
            }}
            className={`flex-1 sm:flex-none px-6 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'channel'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Channel Inventory
          </button>
        </div>

        {/* Local Database Actions (only visible when in local tab) */}
        {activeTab === 'local' && (
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <button
              onClick={handleOpenLocalMergeModal}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl text-xs font-black shadow-sm hover:shadow transition-all cursor-pointer w-full sm:w-auto active:scale-[0.98]"
            >
              <GitMerge size={14} />
              <span>Smart Merge</span>
            </button>
          </div>
        )}

        {/* Channel Selection & Sync Actions (only visible when in channel tab) */}
        {activeTab === 'channel' && (
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Channel Toggle Buttons */}
            <div className="flex bg-slate-100 p-1 rounded-xl gap-1 w-full sm:w-auto overflow-x-auto">
              <button
                onClick={() => {
                  setSelectedChannel('ebay');
                  localStorage.setItem('elister_selected_listings_channel', 'ebay');
                }}
                className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer whitespace-nowrap ${
                  selectedChannel === 'ebay'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                eBay
              </button>
              <button
                onClick={() => {
                  setSelectedChannel('etsy');
                  localStorage.setItem('elister_selected_listings_channel', 'etsy');
                }}
                className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer whitespace-nowrap ${
                  selectedChannel === 'etsy'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Etsy
              </button>
              <button
                onClick={() => {
                  setSelectedChannel('poshmark');
                  localStorage.setItem('elister_selected_listings_channel', 'poshmark');
                }}
                className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer whitespace-nowrap ${
                  selectedChannel === 'poshmark'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Poshmark
              </button>
              {/* <button
                onClick={() => {
                  setSelectedChannel('depop');
                  localStorage.setItem('elister_selected_listings_channel', 'depop');
                }}
                className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer whitespace-nowrap ${
                  selectedChannel === 'depop'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Depop
              </button> */}
              <button
                onClick={() => {
                  setSelectedChannel('mercari');
                  localStorage.setItem('elister_selected_listings_channel', 'mercari');
                }}
                className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer whitespace-nowrap ${
                  selectedChannel === 'mercari'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Mercari
              </button>
              <button
                onClick={() => {
                  setSelectedChannel('amazon');
                  localStorage.setItem('elister_selected_listings_channel', 'amazon');
                }}
                className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer whitespace-nowrap ${
                  selectedChannel === 'amazon'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Amazon
              </button>
            </div>

            {/* Sync Button */}
            <Button
              onClick={handleSyncInventory}
              disabled={syncing || !isChannelConnected()}
              size="sm"
              icon={<RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />}
              className="w-full sm:w-auto"
            >
              {syncing ? 'Syncing...' : `Sync ${getChannelDisplayName(selectedChannel)}`}
            </Button>

            {/* Import to Local Button */}
            <button
              onClick={handleOpenImportModal}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl text-xs font-black shadow-sm hover:shadow transition-all cursor-pointer w-full sm:w-auto active:scale-[0.98]"
            >
              <Download size={14} />
              <span>Import to Local</span>
            </button>
          </div>
        )}
      </div>

      {/* FILTER / SEARCH ROW */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-4">

        {/* Search Input */}
        <div className={`relative ${activeTab === 'channel' ? 'w-full sm:w-64 md:w-72 lg:w-80 shrink-0' : 'flex-1 w-full'}`}>
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={activeTab === 'local' ? "Search listings by title or SKU..." : `Search ${getChannelDisplayName(selectedChannel)} products...`}
            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-100 focus:bg-white rounded-2xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400"
          />
        </div>

        {/* Dropdowns & Link options */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Channel Inventory Status Filter: All / Active / Inactive / Draft */}
          {activeTab === 'channel' && (
            <>
              <div className="flex bg-slate-100 p-1 rounded-xl gap-1 overflow-x-auto">
                {['all', 'active', 'inactive', 'draft'].map((option) => (
                  <button
                    key={option}
                    onClick={() => setChannelStatusFilter(option)}
                    className={`px-3.5 py-1.5 rounded-lg text-[11px] font-black capitalize transition-all cursor-pointer whitespace-nowrap ${
                      channelStatusFilter === option
                        ? 'bg-white text-indigo-600 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>

              {/* Channel Inventory Sort Dropdown (Date, Price, Alphabetical) */}
              <div className="relative">
                <select
                  value={channelSortOption}
                  onChange={(e) => {
                    setChannelSortOption(e.target.value);
                    localStorage.setItem('elister_channel_sort_option', e.target.value);
                  }}
                  className="px-4 py-2.5 bg-white border border-slate-200 hover:border-indigo-200 rounded-2xl text-xs font-extrabold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all cursor-pointer appearance-none pr-9"
                >
                  <option value="newest">Date: Newest First</option>
                  <option value="oldest">Date: Oldest First</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="title-asc">Alphabetical (A - Z)</option>
                  <option value="title-desc">Alphabetical (Z - A)</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <ChevronDown size={14} />
                </div>
              </div>
            </>
          )}

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
                (filterListedOn.length > 0 || filterNoListedOn.length > 0 || sortOption !== 'newest') ? 'border-indigo-500 ring-2 ring-indigo-500/10' : 'border-slate-200'
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
          {((activeTab === 'local' && (searchTerm || statusFilter !== 'all' || filterListedOn.length > 0 || filterNoListedOn.length > 0 || sortOption !== 'newest')) ||
            (activeTab === 'channel' && (searchTerm || channelStatusFilter !== 'all' || channelSortOption !== 'newest'))) && (
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
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {activeTab === 'local' ? (
          loading ? (
            <LoadingState label="Loading inventory data..." />
          ) : paginatedListings.length === 0 ? (
            <EmptyState
              icon={<Package size={20} />}
              title={hasActiveLocalFilters ? 'No listings match your filters' : 'No listings yet'}
              description={hasActiveLocalFilters
                ? 'Try adjusting or clearing your filters to see more results.'
                : 'Create your first listing to start cross-listing it across marketplaces.'}
              action={hasActiveLocalFilters ? (
                <Button variant="secondary" size="sm" onClick={handleClearFilters}>
                  Clear Filters
                </Button>
              ) : (
                <Button size="sm" icon={<Plus size={14} />} onClick={() => navigate('/create-ebay-listing')}>
                  Create a Listing
                </Button>
              )}
            />
          ) : (
            <>
              {/* MOBILE CARD VIEW */}
              <div className="md:hidden divide-y divide-slate-100">
                {paginatedListings.map((item) => (
                  <div key={item._id} className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <input type="checkbox" onClick={(e) => e.stopPropagation()} className="w-4 h-4 mt-1.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer shrink-0" />
                      <div 
                        className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer group select-none"
                        onClick={() => handleOpenPreview(item, 'ebay')}
                        title="Click to preview listing"
                      >
                        <div className="w-14 h-14 bg-slate-50 rounded-xl overflow-hidden shrink-0 shadow-inner flex items-center justify-center border border-slate-100 group-hover:scale-105 transition-transform">
                          {item.thumbnail || (item.images && item.images.length > 0) ? (
                            <img src={item.thumbnail || item.images[0]} className="w-full h-full object-cover" alt="" />
                          ) : (
                            <ImageOff size={16} className="text-slate-300" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-extrabold text-slate-800 text-xs leading-relaxed line-clamp-2 group-hover:text-indigo-600 transition-colors">
                            {item.title}
                          </p>
                          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1.5 text-[10px] font-bold text-slate-400">
                            <span className="font-mono text-slate-500">{item.sku || '-'}</span>
                            <span>Qty <span className="text-slate-700 font-extrabold">{item.quantity || 1}</span></span>
                            <span>{formatTimeAgo(item.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                      <IconButton
                        variant="danger"
                        size="sm"
                        aria-label="Delete Listing"
                        onClick={() => handleDelete(item)}
                        className="shrink-0"
                      >
                        <Trash2 size={14} />
                      </IconButton>
                    </div>

                    <div>
                      <StatusBadge status={item.status} />
                    </div>

                    <div className="flex items-center gap-4 overflow-x-auto pt-2 border-t border-slate-100 -mx-1 px-1">
                      {renderCrosslistingCell(item, 'ebay', item.ebayListingId, '/ebay.png')}
                      {renderCrosslistingCell(item, 'poshmark', item.poshmarkListingId, '/poshmark.png')}
                      {/* {renderCrosslistingCell(item, 'depop', item.depopListingId, '/depop.png')} */}
                      {renderCrosslistingCell(item, 'etsy', item.etsyListingId, '/etsy.png')}
                      {renderCrosslistingCell(item, 'mercari', item.mercariListingId, '/mercari.png')}
                      {renderCrosslistingCell(item, 'amazon', item.amazonListingId, '/amazon.png')}
                    </div>
                  </div>
                ))}
              </div>

              {/* DESKTOP TABLE VIEW */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">

                  {/* Headers */}
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr className="border-b border-slate-100">
                      <th className="px-6 py-4 w-12 text-center">
                        <input type="checkbox" className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer" />
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Item</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">SKU</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">Qty</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Last Updated</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center border-l border-slate-100" colSpan="5">
                        Cross-listed On
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">Actions</th>
                    </tr>
                    {/* Platform subheaders matching image */}
                    <tr className="border-b border-slate-100 text-[10px] font-extrabold text-slate-400 select-none">
                      <th colSpan="6" />
                      <th className="py-2.5 text-center border-l border-slate-100 w-20">eBay</th>
                      <th className="py-2.5 text-center w-20">Poshmark</th>
                      {/* <th className="py-2.5 text-center w-20">Depop</th> */}
                      <th className="py-2.5 text-center w-20">Etsy</th>
                      <th className="py-2.5 text-center w-20">Mercari</th>
                      <th className="py-2.5 text-center w-20 border-r border-slate-100">Amazon</th>
                      <th />
                    </tr>
                  </thead>

                  {/* Rows */}
                  <tbody className="divide-y divide-slate-50">
                    {paginatedListings.map((item) => (
                      <tr key={item._id} className="hover:bg-slate-50/60 transition-colors">

                        {/* Checkbox */}
                        <td className="px-6 py-4 text-center">
                          <input type="checkbox" className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer" />
                        </td>

                        {/* Item */}
                        <td 
                          className="px-6 py-4 max-w-sm cursor-pointer group select-none"
                          onClick={() => handleOpenPreview(item, 'ebay')}
                          title="Click to preview listing"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-slate-50 rounded-xl overflow-hidden shrink-0 shadow-inner flex items-center justify-center border border-slate-100 group-hover:ring-2 group-hover:ring-indigo-500/20 group-hover:scale-105 transition-all">
                              {item.thumbnail || (item.images && item.images.length > 0) ? (
                                <img src={item.thumbnail || item.images[0]} className="w-full h-full object-cover" alt="" />
                              ) : (
                                <ImageOff size={16} className="text-slate-300" />
                              )}
                            </div>
                            <span className="font-extrabold text-slate-800 text-xs line-clamp-2 leading-relaxed group-hover:text-indigo-600 transition-colors">
                              {item.title}
                            </span>
                          </div>
                        </td>

                        {/* SKU */}
                        <td className="px-6 py-4">
                          <span className="font-mono text-xs font-bold text-slate-500">{item.sku || '-'}</span>
                        </td>

                        {/* Qty */}
                        <td className="px-6 py-4 text-center">
                          <span className="text-xs font-extrabold text-slate-700">{item.quantity || 1}</span>
                        </td>

                        {/* Status badge */}
                        <td className="px-6 py-4">
                          <StatusBadge status={item.status} />
                        </td>

                        {/* Last Updated */}
                        <td className="px-6 py-4">
                          <span className="text-xs font-semibold text-slate-400">
                            {formatTimeAgo(item.createdAt)}
                          </span>
                        </td>

                        {/* Crosslisting cell components: eBay, Poshmark, Depop, Etsy, Mercari, Amazon */}
                        <td className="border-l border-slate-100">
                          {renderCrosslistingCell(item, 'ebay', item.ebayListingId, '/ebay.png')}
                        </td>
                        <td>
                          {renderCrosslistingCell(item, 'poshmark', item.poshmarkListingId, '/poshmark.png')}
                        </td>
                        {/* <td>
                          {renderCrosslistingCell(item, 'depop', item.depopListingId, '/depop.png')}
                        </td> */}
                        <td>
                          {renderCrosslistingCell(item, 'etsy', item.etsyListingId, '/etsy.png')}
                        </td>
                        <td>
                          {renderCrosslistingCell(item, 'mercari', item.mercariListingId, '/mercari.png')}
                        </td>
                        <td className="border-r border-slate-100">
                          {renderCrosslistingCell(item, 'amazon', item.amazonListingId, '/amazon.png')}
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 text-center">
                          <div className="flex justify-center items-center gap-2">
                            <IconButton
                              variant="danger"
                              size="sm"
                              aria-label="Delete Listing"
                              onClick={() => handleDelete(item)}
                            >
                              <Trash2 size={15} />
                            </IconButton>
                          </div>
                        </td>

                      </tr>
                    ))}
                  </tbody>

                </table>
              </div>
            </>
          )
        ) : !isChannelConnected() ? (
          <EmptyState
            icon={<AlertCircle size={20} className="text-amber-500" />}
            title={<span className="capitalize">{selectedChannel} Channel Not Connected</span>}
            description={`Connect your ${selectedChannel} account in Integrations settings to view and synchronize your live inventory.`}
            action={
              <Button size="sm" onClick={() => navigate('/integrations')}>
                Connect {getChannelDisplayName(selectedChannel)}
              </Button>
            }
          />
        ) : channelLoading ? (
          <LoadingState label={`Loading ${selectedChannel} inventory...`} />
        ) : paginatedChannelProducts.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag size={20} />}
            title="No products found"
            description={`No products found matching the current filters. Click "Sync ${getChannelDisplayName(selectedChannel)}" to fetch your items.`}
            action={
              <Button size="sm" icon={<RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />} onClick={handleSyncInventory} disabled={syncing}>
                Sync {getChannelDisplayName(selectedChannel)}
              </Button>
            }
          />
        ) : (
          <>
            {/* MOBILE CARD VIEW */}
            <div className="md:hidden divide-y divide-slate-100">
              {paginatedChannelProducts.map((product, index) => {
                const details = getProductDetails(product);
                const isMarketplaceStatus = ['ebay', 'etsy', 'poshmark', 'depop', 'mercari'].includes(selectedChannel);
                const channelIcon = selectedChannel === 'ebay' 
                  ? '/ebay.png' 
                  : selectedChannel === 'etsy' 
                    ? '/etsy.png' 
                    : selectedChannel === 'poshmark' 
                      ? '/poshmark.png' 
                      : selectedChannel === 'depop' 
                        ? '/depop.png' 
                        : '/mercari.png';
                const badgeStatus = isMarketplaceStatus
                  ? details.status
                  : ((details.status === 'live' || details.status === 'published' || details.status === 'active') ? 'live' : 'draft');
                return (
                  <div key={product._id || `${details.liveId}-${index}`} className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <input type="checkbox" onClick={(e) => e.stopPropagation()} className="w-4 h-4 mt-1.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer shrink-0" />
                      <div 
                        className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer group select-none"
                        onClick={() => handleOpenPreview(buildChannelDropdownItem(product, details, selectedChannel), selectedChannel)}
                        title={`Click to preview ${getChannelDisplayName(selectedChannel)} product`}
                      >
                        <div className="w-14 h-14 bg-slate-50 rounded-xl overflow-hidden shrink-0 shadow-inner flex items-center justify-center border border-slate-100 group-hover:scale-105 transition-transform">
                          {details.thumbnail ? (
                            <img src={details.thumbnail} className="w-full h-full object-cover" alt="" />
                          ) : (
                            <ImageOff size={16} className="text-slate-300" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-extrabold text-slate-800 text-xs leading-relaxed line-clamp-2 group-hover:text-indigo-600 transition-colors">
                            {details.title}
                          </p>
                          {details.brand && (
                            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{details.brand}</p>
                          )}
                          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1.5 text-[10px] font-bold text-slate-400">
                            <span className="font-mono text-slate-500">{details.sku || '-'}</span>
                            <span className="text-slate-700 font-extrabold">${details.price.toFixed(2)}</span>
                            <span>{details.dateText}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                      <StatusBadge status={badgeStatus} />
                      {renderCrosslistingCell(
                        buildChannelDropdownItem(product, details, selectedChannel),
                        selectedChannel,
                        details.liveId,
                        channelIcon
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* DESKTOP TABLE VIEW */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">

                {/* Headers */}
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr className="border-b border-slate-100">
                    <th className="px-6 py-4 w-12 text-center">
                      <input type="checkbox" className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer" />
                    </th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Product</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Live ID</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">SKU</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Price</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">Actions</th>
                  </tr>
                </thead>

                {/* Rows */}
                <tbody className="divide-y divide-slate-50">
                  {paginatedChannelProducts.map((product, index) => {
                    const details = getProductDetails(product);
                    const isMarketplaceStatus = ['ebay', 'etsy', 'poshmark', 'depop', 'mercari'].includes(selectedChannel);
                    const channelIcon = selectedChannel === 'ebay' 
                      ? '/ebay.png' 
                      : selectedChannel === 'etsy' 
                        ? '/etsy.png' 
                        : selectedChannel === 'poshmark' 
                          ? '/poshmark.png' 
                          : selectedChannel === 'depop' 
                            ? '/depop.png' 
                            : '/mercari.png';
                    const badgeStatus = isMarketplaceStatus
                      ? details.status
                      : ((details.status === 'live' || details.status === 'published' || details.status === 'active') ? 'live' : 'draft');
                    return (
                      <tr key={product._id || `${details.liveId}-${index}`} className="hover:bg-slate-50/60 transition-colors">

                        {/* Checkbox */}
                        <td className="px-6 py-4 text-center">
                          <input type="checkbox" className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer" />
                        </td>

                        {/* Product info */}
                        <td 
                          className="px-6 py-4 max-w-sm cursor-pointer group select-none"
                          onClick={() => handleOpenPreview(buildChannelDropdownItem(product, details, selectedChannel), selectedChannel)}
                          title={`Click to preview ${getChannelDisplayName(selectedChannel)} product`}
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-slate-50 rounded-xl overflow-hidden shrink-0 shadow-inner flex items-center justify-center border border-slate-100 group-hover:ring-2 group-hover:ring-indigo-500/20 group-hover:scale-105 transition-all">
                              {details.thumbnail ? (
                                <img src={details.thumbnail} className="w-full h-full object-cover" alt="" />
                              ) : (
                                <ImageOff size={16} className="text-slate-300" />
                              )}
                            </div>
                            <div>
                              <span className="font-extrabold text-slate-800 text-xs line-clamp-1 leading-relaxed group-hover:text-indigo-600 transition-colors">
                                {details.title}
                              </span>
                              {details.brand && (
                                <span className="text-[10px] text-slate-400 block font-semibold mt-0.5">{details.brand}</span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4">
                          <StatusBadge status={badgeStatus} />
                        </td>

                        {/* Live ID */}
                        <td className="px-6 py-4">
                          <span className="font-mono text-xs font-bold text-slate-500">{details.liveId}</span>
                        </td>

                        {/* SKU */}
                        <td className="px-6 py-4">
                          <span className="font-mono text-xs font-bold text-slate-500">{details.sku || '-'}</span>
                        </td>

                        {/* Price */}
                        <td className="px-6 py-4 font-bold text-slate-900 text-sm">
                          ${details.price.toFixed(2)}
                        </td>

                        {/* Date */}
                        <td className="px-6 py-4 text-xs font-semibold text-slate-400">
                          {details.dateText}
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 text-center">
                          <div className="flex justify-center">
                            {renderCrosslistingCell(
                              buildChannelDropdownItem(product, details, selectedChannel),
                              selectedChannel,
                              details.liveId,
                              channelIcon
                            )}
                          </div>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>

              </table>
            </div>
          </>
        )}

        {/* Bottom Pagination */}
        <div className="px-6 py-4 bg-slate-50/60 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs font-extrabold text-slate-400 select-none order-2 sm:order-1">
            Showing {displayedTotalCount === 0 ? 0 : displayedStartIndex + 1} to {displayedEndIndex} of {displayedTotalCount.toLocaleString()} {activeTab === 'local' ? 'listings' : 'live products'}
          </p>

          <div className="flex items-center gap-4 sm:gap-6 order-1 sm:order-2">
            <div className="flex items-center gap-1">
              <IconButton
                aria-label="Previous page"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={displayedActivePage === 1}
                size="sm"
              >
                <ChevronLeft size={16} />
              </IconButton>

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
                    className={`w-8 h-8 flex items-center justify-center rounded-xl font-extrabold text-xs transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                        : 'text-slate-500 hover:bg-slate-100 font-bold'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}

              <IconButton
                aria-label="Next page"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, displayedTotalPages))}
                disabled={displayedActivePage === displayedTotalPages}
                size="sm"
              >
                <ChevronRight size={16} />
              </IconButton>
            </div>

            {/* page count indicator */}
            <div className="relative flex items-center">
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="appearance-none pr-8 pl-3.5 py-1.5 bg-white border border-border hover:border-indigo-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
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
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-border animate-in zoom-in-95 duration-200 flex flex-col">

            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-border flex justify-between items-center bg-white">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <SlidersHorizontal size={16} />
                </div>
                <h2 className="text-base font-extrabold text-slate-900">Filter Inventory</h2>
              </div>
              <IconButton
                aria-label="Close"
                onClick={() => setFilterModalOpen(false)}
              >
                <X size={16} />
              </IconButton>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
              {/* Sort Listings Section */}
              <div className="border-b border-border pb-6">
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
                          ? 'border-indigo-500 bg-indigo-50/40 text-indigo-600 font-extrabold ring-2 ring-indigo-500/10'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
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
                <div className="p-5.5 rounded-2xl border border-emerald-100 bg-emerald-50/40 flex items-start gap-4">
                  <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </div>
                  
                  <div className="flex-1 space-y-3.5">
                    <h4 className="text-[11px] font-black text-emerald-700 uppercase tracking-wider">Listed On</h4>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {/* eBay */}
                      <label className="flex items-center gap-2 cursor-pointer group select-none">
                        <input 
                          type="checkbox" 
                          checked={tempListedOn.includes('ebay')}
                          onChange={() => toggleTempListedOn('ebay')}
                          className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 cursor-pointer" 
                        />
                        <div className="flex flex-col items-center gap-1 bg-white border border-slate-100 rounded-2xl p-2 w-14 h-14 shadow-xs group-hover:border-emerald-200 transition-all shrink-0">
                          <img src="/ebay.png" className="w-5 h-5 object-contain" alt="" />
                          <span className="text-[9px] font-bold text-slate-500">eBay</span>
                        </div>
                      </label>

                      {/* Poshmark */}
                      <label className="flex items-center gap-2 cursor-pointer group select-none">
                        <input 
                          type="checkbox" 
                          checked={tempListedOn.includes('poshmark')}
                          onChange={() => toggleTempListedOn('poshmark')}
                          className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 cursor-pointer" 
                        />
                        <div className="flex flex-col items-center gap-1 bg-white border border-slate-100 rounded-2xl p-2 w-14 h-14 shadow-xs group-hover:border-emerald-200 transition-all shrink-0">
                          <img src="/poshmark.png" className="w-5 h-5 object-contain" alt="" />
                          <span className="text-[9px] font-bold text-slate-500">Poshmark</span>
                        </div>
                      </label>

                      {/* Etsy */}
                      <label className="flex items-center gap-2 cursor-pointer group select-none">
                        <input 
                          type="checkbox" 
                          checked={tempListedOn.includes('etsy')}
                          onChange={() => toggleTempListedOn('etsy')}
                          className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 cursor-pointer" 
                        />
                        <div className="flex flex-col items-center gap-1 bg-white border border-slate-100 rounded-2xl p-2 w-14 h-14 shadow-xs group-hover:border-emerald-200 transition-all shrink-0">
                          <img src="/etsy.png" className="w-5 h-5 object-contain rounded-md" alt="" />
                          <span className="text-[9px] font-bold text-slate-500">Etsy</span>
                        </div>
                      </label>

                      {/* Mercari */}
                      <label className="flex items-center gap-2 cursor-pointer group select-none">
                        <input 
                          type="checkbox" 
                          checked={tempListedOn.includes('mercari')}
                          onChange={() => toggleTempListedOn('mercari')}
                          className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 cursor-pointer" 
                        />
                        <div className="flex flex-col items-center gap-1 bg-white border border-slate-100 rounded-2xl p-2 w-14 h-14 shadow-xs group-hover:border-emerald-200 transition-all shrink-0">
                          <img src="/mercari.png" className="w-5 h-5 object-contain" alt="" />
                          <span className="text-[9px] font-bold text-slate-500">Mercari</span>
                        </div>
                      </label>

                      {/* Amazon */}
                      <label className="flex items-center gap-2 cursor-pointer group select-none">
                        <input 
                          type="checkbox" 
                          checked={tempListedOn.includes('amazon')}
                          onChange={() => toggleTempListedOn('amazon')}
                          className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 cursor-pointer" 
                        />
                        <div className="flex flex-col items-center gap-1 bg-slate-900 border border-slate-800 rounded-2xl p-2 w-14 h-14 shadow-xs group-hover:border-emerald-400 transition-all shrink-0">
                          <img src="/amazon.png" className="w-5 h-5 object-contain" alt="" />
                          <span className="text-[9px] font-bold text-slate-200">Amazon</span>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* No Listed On Row */}
                <div className="p-5.5 rounded-2xl border border-rose-100 bg-rose-50/40 flex items-start gap-4">
                  <div className="w-5 h-5 rounded-full border-2 border-rose-500 text-rose-500 flex items-center justify-center shrink-0 mt-0.5 bg-white font-black text-xs select-none">
                    {/* Circle icon */}
                  </div>
                  
                  <div className="flex-1 space-y-3.5">
                    <h4 className="text-[11px] font-black text-rose-700 uppercase tracking-wider">No Listed On</h4>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {/* eBay */}
                      <label className="flex items-center gap-2 cursor-pointer group select-none">
                        <input 
                          type="checkbox" 
                          checked={tempNoListedOn.includes('ebay')}
                          onChange={() => toggleTempNoListedOn('ebay')}
                          className="w-4 h-4 text-rose-600 border-slate-300 rounded focus:ring-rose-500 cursor-pointer" 
                        />
                        <div className="flex flex-col items-center gap-1 bg-white border border-slate-100 rounded-2xl p-2 w-14 h-14 shadow-xs group-hover:border-rose-200 transition-all shrink-0">
                          <img src="/ebay.png" className="w-5 h-5 object-contain opacity-60 group-hover:opacity-100" alt="" />
                          <span className="text-[9px] font-bold text-slate-500">eBay</span>
                        </div>
                      </label>

                      {/* Poshmark */}
                      <label className="flex items-center gap-2 cursor-pointer group select-none">
                        <input 
                          type="checkbox" 
                          checked={tempNoListedOn.includes('poshmark')}
                          onChange={() => toggleTempNoListedOn('poshmark')}
                          className="w-4 h-4 text-rose-600 border-slate-300 rounded focus:ring-rose-500 cursor-pointer" 
                        />
                        <div className="flex flex-col items-center gap-1 bg-white border border-slate-100 rounded-2xl p-2 w-14 h-14 shadow-xs group-hover:border-rose-200 transition-all shrink-0">
                          <img src="/poshmark.png" className="w-5 h-5 object-contain opacity-60 group-hover:opacity-100" alt="" />
                          <span className="text-[9px] font-bold text-slate-500">Poshmark</span>
                        </div>
                      </label>

                      {/* Etsy */}
                      <label className="flex items-center gap-2 cursor-pointer group select-none">
                        <input 
                          type="checkbox" 
                          checked={tempNoListedOn.includes('etsy')}
                          onChange={() => toggleTempNoListedOn('etsy')}
                          className="w-4 h-4 text-rose-600 border-slate-300 rounded focus:ring-rose-500 cursor-pointer" 
                        />
                        <div className="flex flex-col items-center gap-1 bg-white border border-slate-100 rounded-2xl p-2 w-14 h-14 shadow-xs group-hover:border-rose-200 transition-all shrink-0">
                          <img src="/etsy.png" className="w-5 h-6 object-contain rounded-md opacity-60 group-hover:opacity-100" alt="" />
                          <span className="text-[9px] font-bold text-slate-500">Etsy</span>
                        </div>
                      </label>

                      {/* Mercari */}
                      <label className="flex items-center gap-2 cursor-pointer group select-none">
                        <input 
                          type="checkbox" 
                          checked={tempNoListedOn.includes('mercari')}
                          onChange={() => toggleTempNoListedOn('mercari')}
                          className="w-4 h-4 text-rose-600 border-slate-300 rounded focus:ring-rose-500 cursor-pointer" 
                        />
                        <div className="flex flex-col items-center gap-1 bg-white border border-slate-100 rounded-2xl p-2 w-14 h-14 shadow-xs group-hover:border-rose-200 transition-all shrink-0">
                          <img src="/mercari.png" className="w-5 h-5 object-contain opacity-60 group-hover:opacity-100" alt="" />
                          <span className="text-[9px] font-bold text-slate-500">Mercari</span>
                        </div>
                      </label>

                      {/* Amazon */}
                      <label className="flex items-center gap-2 cursor-pointer group select-none">
                        <input 
                          type="checkbox" 
                          checked={tempNoListedOn.includes('amazon')}
                          onChange={() => toggleTempNoListedOn('amazon')}
                          className="w-4 h-4 text-rose-600 border-slate-300 rounded focus:ring-rose-500 cursor-pointer" 
                        />
                        <div className="flex flex-col items-center gap-1 bg-slate-900 border border-slate-800 rounded-2xl p-2 w-14 h-14 shadow-xs group-hover:border-rose-400 transition-all shrink-0">
                          <img src="/amazon.png" className="w-5 h-5 object-contain opacity-60 group-hover:opacity-100" alt="" />
                          <span className="text-[9px] font-bold text-slate-200">Amazon</span>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4.5 border-t border-border flex justify-between items-center bg-slate-50">
              <Button
                variant="outline"
                size="md"
                icon={<RefreshCw size={14} />}
                onClick={() => {
                  setTempListedOn([]);
                  setTempNoListedOn([]);
                  setFilterListedOn([]);
                  setFilterNoListedOn([]);
                  setTempSortOption('newest');
                  setSortOption('newest');
                }}
              >
                Reset
              </Button>

              <Button
                size="md"
                icon={<SlidersHorizontal size={14} />}
                onClick={() => {
                  setFilterListedOn(tempListedOn);
                  setFilterNoListedOn(tempNoListedOn);
                  setSortOption(tempSortOption);
                  setFilterModalOpen(false);
                }}
              >
                Apply Filters
              </Button>
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
        onSyncSuccess={() => window.dispatchEvent(new Event('elister-listings-update'))}
      />

      {/* Preview Modal */}
      {previewListing && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-border flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-border flex items-center justify-between">
              <div className="min-w-0 pr-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Listing Preview</span>
                <h3 className="text-lg font-bold text-slate-950 truncate max-w-lg mt-0.5">{previewListing.title}</h3>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <IconButton
                  aria-label="Edit Listing"
                  title="Edit Listing"
                  onClick={() => {
                    setSelectedListing(previewListing);
                    setSelectedPlatform(previewListing.platform || selectedChannel || 'ebay');
                    setIsEditMode(true);
                    setModalOpen(true);
                    setPreviewListing(null);
                  }}
                >
                  <Edit size={16} />
                </IconButton>
                <IconButton
                  aria-label="Close"
                  title="Close"
                  onClick={() => setPreviewListing(null)}
                >
                  <X size={18} />
                </IconButton>
              </div>
            </div>

            {/* Modal Body */}
            {(() => {
              const activePlat = previewPlatform || previewListing.platform || 'ebay';
              const platData = previewListing.platformData?.[activePlat] || 
                (previewListing.listingsMap && previewListing.listingsMap[activePlat]) || 
                (previewListing.platform === activePlat ? previewListing : {});

              const displayTitle = platData.title || (previewListing.platform === activePlat ? previewListing.title : previewListing.title) || 'Untitled Item';
              const displayDesc = platData.description || (previewListing.platform === activePlat ? previewListing.description : '') || previewListing.description || '';
              const displayPrice = platData.price !== undefined && platData.price !== null
                ? (typeof platData.price === 'number' ? platData.price : parseFloat(platData.price) || 0)
                : (typeof previewListing.price === 'number' ? previewListing.price : parseFloat(previewListing.price) || 0);
              const displayOrigPrice = platData.originalPrice || (previewListing.platform === activePlat ? previewListing.originalPrice : '');
              const displayBrand = platData.brand || previewListing.brand || '-';
              const displaySize = platData.size || previewListing.size || '-';
              const displayColor = platData.color || previewListing.color || '-';
              const displayCategory = platData.category || (previewListing.platform === activePlat ? previewListing.category : '-');
              const displayCondition = platData.condition || platData.selectedCondition || (previewListing.platform === activePlat ? (previewListing.selectedCondition || previewListing.condition) : '');
              const displaySku = platData.sku || previewListing.sku || '-';
              const displaySpecifics = activePlat === 'ebay' 
                ? (platData.itemSpecifics || (previewListing.platform === 'ebay' ? previewListing.itemSpecifics : {})) 
                : {};
              const displayStatus = previewListing[`${activePlat}Status`] || (previewListing.platform === activePlat ? previewListing.status : 'none');
              const displayLiveId = platData.liveId || previewListing[`${activePlat}ListingId`];
              const displayUrl = platData.url || previewListing[`${activePlat}Url`];

              return (
                <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-8">
                  {/* Left Column - Gallery, Platform Switcher & Logistics */}
                  <div className="md:col-span-5 space-y-5">
                    {/* Image Gallery */}
                    {previewListing.images && previewListing.images.length > 0 ? (
                      <div className="space-y-3">
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
                                className={`w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0 transition-all cursor-pointer ${
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

                    {/* Platform Preview Selector Card */}
                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                          Platform Preview Selector
                        </span>
                        <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                          Viewing: {activePlat.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 font-semibold leading-tight">
                        Click any platform to view that marketplace's specific data:
                      </p>
                      <div className="grid grid-cols-5 gap-1.5">
                        {[
                          { id: 'ebay', name: 'eBay', logo: '/ebay.png' },
                          { id: 'poshmark', name: 'Poshmark', logo: '/poshmark.png' },
                          { id: 'mercari', name: 'Mercari', logo: '/mercari.png' },
                          /* { id: 'depop', name: 'Depop', logo: '/depop.png' }, */
                          { id: 'etsy', name: 'Etsy', logo: '/etsy.png' },
                          { id: 'amazon', name: 'Amazon', logo: '/amazon.png' },
                        ].map((p) => {
                          const isSelected = activePlat === p.id;
                          const pData = previewListing.platformData?.[p.id] || (previewListing.listingsMap?.[p.id]);
                          const isListed = !!(
                            previewListing[`${p.id}ListingId`] ||
                            pData?.liveId ||
                            previewListing[`${p.id}Status`] === 'published' ||
                            (previewListing.platform === p.id && (previewListing.status === 'published' || previewListing.status === 'active'))
                          );

                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setPreviewPlatform(p.id)}
                              className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all cursor-pointer select-none ${
                                isSelected
                                  ? 'bg-white border-indigo-600 shadow-md ring-2 ring-indigo-500/20'
                                  : 'bg-white/70 hover:bg-white border-slate-200 hover:border-slate-300 opacity-80 hover:opacity-100'
                              }`}
                            >
                              <img src={p.logo} alt={p.name} className="w-5 h-5 object-contain" />
                              <span className={`text-[10px] font-bold mt-1 ${isSelected ? 'text-indigo-600 font-black' : 'text-slate-600'}`}>
                                {p.name}
                              </span>
                              <span className={`text-[8px] font-extrabold px-1 rounded mt-0.5 ${
                                isListed ? 'text-emerald-600 bg-emerald-50 border border-emerald-100' : 'text-slate-400 bg-slate-100'
                              }`}>
                                {isListed ? 'Active' : 'Unlisted'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

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

                  {/* Right Column - Platform Details, Specifics, Pricing & HTML Description */}
                  <div className="md:col-span-7 space-y-5 font-sans">
                    {/* Platform banner */}
                    <div className="flex items-center justify-between p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                      <div className="flex items-center gap-2">
                        <img 
                          src={`/${activePlat}.png`} 
                          alt={activePlat} 
                          className="w-5 h-5 object-contain" 
                        />
                        <span className="text-xs font-black text-slate-800 capitalize">
                          {activePlat} Listing Data
                        </span>
                      </div>
                      {displayUrl && (
                        <a
                          href={displayUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-extrabold text-indigo-600 hover:text-indigo-800 underline flex items-center gap-1"
                        >
                          View Live Listing
                        </a>
                      )}
                    </div>

                    {/* Meta details */}
                    <div className="grid grid-cols-2 gap-3.5">
                      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Status on {activePlat}</p>
                        <div className="mt-1">{getStatusBadge(displayStatus)}</div>
                      </div>
                      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                          {activePlat === 'poshmark' ? 'Listing Price' : 'Price'}
                        </p>
                        <p className="text-base font-black text-slate-900 mt-1">
                          ${displayPrice.toFixed(2)}
                        </p>
                      </div>
                      {(activePlat === 'poshmark' || activePlat === 'etsy' || activePlat === 'depop') && (
                        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Original Price</p>
                          <p className="text-base font-black text-slate-500 mt-1">
                            ${displayOrigPrice ? parseFloat(displayOrigPrice || 0).toFixed(2) : '0.00'}
                          </p>
                        </div>
                      )}
                      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Brand</p>
                        <p className="text-sm font-bold text-slate-800 mt-1 truncate">{displayBrand}</p>
                      </div>
                      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Color</p>
                        <p className="text-sm font-bold text-slate-800 mt-1 truncate">{displayColor}</p>
                      </div>
                      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Size</p>
                        <p className="text-sm font-bold text-slate-800 mt-1 truncate">{displaySize}</p>
                      </div>
                      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">SKU</p>
                        <p className="text-sm font-mono font-bold text-slate-800 mt-1 truncate">{displaySku}</p>
                      </div>
                      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Category</p>
                        <p className="text-sm font-bold text-slate-800 mt-1 truncate">{displayCategory}</p>
                      </div>
                      {displayCondition && (
                        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 col-span-2 sm:col-span-1">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Condition</p>
                          <p className="text-sm font-bold text-slate-800 mt-1 truncate">{displayCondition}</p>
                        </div>
                      )}
                      {displayLiveId && (
                        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 col-span-2">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{activePlat} Live ID</p>
                          <p className="text-xs font-mono font-bold text-slate-700 mt-0.5 truncate">{displayLiveId}</p>
                        </div>
                      )}
                    </div>

                    {/* Item Specifics - ONLY for eBay */}
                    {activePlat === 'ebay' && displaySpecifics && typeof displaySpecifics === 'object' && Object.keys(displaySpecifics).length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-sans">
                          eBay Item Specifics
                        </h4>
                        <div className="grid grid-cols-2 gap-2.5">
                          {Object.entries(displaySpecifics).map(([key, val]) => {
                            const displayVal = Array.isArray(val) ? val.join(', ') : val;
                            return (
                              <div key={key} className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-500">{key}</span>
                                <span className="text-xs font-extrabold text-slate-800 text-right truncate max-w-[140px]">{displayVal || '-'}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Description Template */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-sans">
                        {activePlat} Description
                      </h4>
                      <div 
                        className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700 max-h-[260px] overflow-y-auto font-sans leading-relaxed prose prose-slate max-w-none"
                        style={{ whiteSpace: 'pre-wrap' }}
                        dangerouslySetInnerHTML={{ __html: displayDesc }}
                      />
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-border flex items-center justify-between font-sans">
              <Button
                variant="outline"
                onClick={() => setPreviewListing(null)}
              >
                Close
              </Button>

              <div className="flex items-center gap-3">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider hidden sm:inline-block">Marketplaces:</span>
                {renderModalFooter()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Smart Import to Local Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-[94vw] max-h-[92vh] overflow-hidden shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200 flex flex-col">

            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100/80 shrink-0">
                  <Download size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-black text-slate-900">Import to Local Database</h2>
                    <span className="px-2.5 py-0.5 text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                      Active Only
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">
                    Match and merge active products across all channels into your Master Local Database.
                  </p>
                </div>
              </div>

              {/* Header Right Actions */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Filter Tabs */}
                <div className="flex bg-slate-100 p-1 rounded-xl gap-1 overflow-x-auto">
                  <button
                    onClick={() => setImportFilterTab('all')}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer whitespace-nowrap ${
                      importFilterTab === 'all'
                        ? 'bg-white text-indigo-600 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    All ({importGroups.length})
                  </button>
                  <button
                    onClick={() => setImportFilterTab('multi')}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer whitespace-nowrap ${
                      importFilterTab === 'multi'
                        ? 'bg-white text-indigo-600 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Multi-Channel ({importGroups.filter(g => g.channelCount > 1).length})
                  </button>
                  <button
                    onClick={() => setImportFilterTab('single')}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer whitespace-nowrap ${
                      importFilterTab === 'single'
                        ? 'bg-white text-indigo-600 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Single Channel ({importGroups.filter(g => g.channelCount === 1).length})
                  </button>
                  <button
                    onClick={() => setImportFilterTab('not_in_local')}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer whitespace-nowrap ${
                      importFilterTab === 'not_in_local'
                        ? 'bg-white text-indigo-600 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Not in DB ({importGroups.filter(g => !g.alreadyInLocal).length})
                  </button>
                  <button
                    onClick={() => setImportFilterTab('in_local')}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer whitespace-nowrap ${
                      importFilterTab === 'in_local'
                        ? 'bg-white text-indigo-600 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    In Local DB ({importGroups.filter(g => g.alreadyInLocal).length})
                  </button>
                </div>

                {/* Search in modal */}
                <div className="relative w-full sm:w-56">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={importSearchTerm}
                    onChange={(e) => setImportSearchTerm(e.target.value)}
                    placeholder="Search title, SKU..."
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                  />
                  {importSearchTerm && (
                    <button
                      onClick={() => setImportSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                <IconButton
                  aria-label="Close"
                  onClick={() => setImportModalOpen(false)}
                >
                  <X size={16} />
                </IconButton>
              </div>
            </div>

            {/* Quick Selection Actions Toolbar */}
            <div className="px-6 py-2.5 bg-slate-50/80 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mr-1">Quick Select:</span>
                <button
                  type="button"
                  onClick={() => handleSelectByCriteria('all')}
                  className="px-3 py-1 text-[11px] font-extrabold rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs transition-all cursor-pointer"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectByCriteria('multi')}
                  className="px-3 py-1 text-[11px] font-extrabold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 shadow-2xs transition-all cursor-pointer"
                >
                  Select Multi-Channel Only
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectByCriteria('single')}
                  className="px-3 py-1 text-[11px] font-extrabold rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 shadow-2xs transition-all cursor-pointer"
                >
                  Select Single Only
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectByCriteria('none')}
                  className="px-3 py-1 text-[11px] font-extrabold rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-all cursor-pointer"
                >
                  Deselect All
                </button>
              </div>

              <div className="text-[11px] text-slate-500 font-bold">
                Showing <span className="text-slate-800 font-extrabold">{filteredImportGroups.length}</span> items
              </div>
            </div>

            {/* Modal Body / Table */}
            <div className="flex-1 overflow-y-auto min-h-[350px] p-4 sm:p-6 bg-slate-50/40">
              {importLoading ? (
                <div className="flex flex-col items-center justify-center py-24 space-y-3">
                  <RefreshCw size={28} className="text-indigo-600 animate-spin" />
                  <p className="text-xs font-black text-slate-700">Scanning & matching active channel listings...</p>
                  <p className="text-[11px] text-slate-400 font-medium">Checking eBay, Poshmark, Mercari, Depop, and Etsy</p>
                </div>
              ) : filteredImportGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Package size={36} className="text-slate-300 mb-2" />
                  <h3 className="text-sm font-extrabold text-slate-700">No active channel items found</h3>
                  <p className="text-xs text-slate-400 max-w-md mt-1">
                    {importSearchTerm ? 'No items match your search term.' : 'Make sure you have active listings synced in your channel inventory (eBay, Poshmark, Mercari, Depop, Etsy).'}
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      {/* Table Header with Platform Logos */}
                      <thead className="bg-slate-50/90 border-b border-slate-100">
                        <tr>
                          <th className="px-4 py-3.5 w-12 text-center">
                            <input
                              type="checkbox"
                              checked={
                                filteredImportGroups.filter(g => !g.alreadyInLocal).length > 0 &&
                                filteredImportGroups.filter(g => !g.alreadyInLocal).every((grp) => selectedGroupIds[grp.groupId])
                              }
                              onChange={handleToggleSelectAllImport}
                              className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                              title="Select / Deselect Unimported Items"
                            />
                          </th>
                          <th className="px-4 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-wider min-w-[280px]">
                            Product (Master)
                          </th>
                          <th className="px-4 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            SKU & Price
                          </th>

                          {/* Platform Columns with Logos */}
                          <th className="px-3 py-3 text-center w-28 border-l border-slate-100">
                            <div className="flex flex-col items-center justify-center gap-1">
                              <img src="/ebay.png" alt="eBay" className="w-5 h-5 object-contain" />
                              <span className="text-[10px] font-black text-slate-600">eBay</span>
                            </div>
                          </th>
                          <th className="px-3 py-3 text-center w-28">
                            <div className="flex flex-col items-center justify-center gap-1">
                              <img src="/poshmark.png" alt="Poshmark" className="w-5 h-5 object-contain" />
                              <span className="text-[10px] font-black text-slate-600">Poshmark</span>
                            </div>
                          </th>
                          <th className="px-3 py-3 text-center w-28">
                            <div className="flex flex-col items-center justify-center gap-1">
                              <img src="/mercari.png" alt="Mercari" className="w-5 h-5 object-contain" />
                              <span className="text-[10px] font-black text-slate-600">Mercari</span>
                            </div>
                          </th>
                          {/* <th className="px-3 py-3 text-center w-28">
                            <div className="flex flex-col items-center justify-center gap-1">
                              <img src="/depop.png" alt="Depop" className="w-5 h-5 object-contain" />
                              <span className="text-[10px] font-black text-slate-600">Depop</span>
                            </div>
                          </th> */}
                          <th className="px-3 py-3 text-center w-28">
                            <div className="flex flex-col items-center justify-center gap-1">
                              <img src="/etsy.png" alt="Etsy" className="w-5 h-5 object-contain" />
                              <span className="text-[10px] font-black text-slate-600">Etsy</span>
                            </div>
                          </th>
                          <th className="px-3 py-3 text-center w-28 border-r border-slate-100">
                            <div className="flex flex-col items-center justify-center gap-1">
                              <img src="/amazon.png" alt="Amazon" className="w-5 h-5 object-contain" />
                              <span className="text-[10px] font-black text-slate-600">Amazon</span>
                            </div>
                          </th>

                          <th className="px-4 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">
                            Match Status
                          </th>
                        </tr>
                      </thead>

                      {/* Table Rows */}
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {filteredImportGroups.map((group) => {
                          const isRowChecked = !group.alreadyInLocal && !!selectedGroupIds[group.groupId];
                          const groupPlats = selectedPlatforms[group.groupId] || {};

                          return (
                            <tr
                              key={group.groupId}
                              className={`transition-colors ${
                                group.alreadyInLocal
                                  ? 'bg-slate-50/50 opacity-60'
                                  : isRowChecked
                                  ? 'bg-indigo-50/20 hover:bg-indigo-50/40'
                                  : 'hover:bg-slate-50/60 opacity-80'
                              }`}
                            >
                              {/* Row Checkbox */}
                              <td className="px-4 py-3.5 text-center">
                                {group.alreadyInLocal ? (
                                  <input
                                    type="checkbox"
                                    checked={false}
                                    disabled={true}
                                    className="w-4 h-4 text-slate-300 border-slate-200 rounded cursor-not-allowed bg-slate-100"
                                    title="Already in Local Database"
                                  />
                                ) : (
                                  <input
                                    type="checkbox"
                                    checked={isRowChecked}
                                    onChange={() => handleToggleGroupRow(group.groupId)}
                                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                                  />
                                )}
                              </td>

                              {/* Product Info */}
                              <td className="px-4 py-3.5">
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 bg-slate-100 rounded-xl overflow-hidden shrink-0 border border-slate-200 flex items-center justify-center">
                                    {group.thumbnail || (group.images && group.images[0]) ? (
                                      <img
                                        src={group.thumbnail || group.images[0]}
                                        className="w-full h-full object-cover"
                                        alt=""
                                        onError={(e) => { e.currentTarget.src = NO_IMAGE_PLACEHOLDER; }}
                                      />
                                    ) : (
                                      <ImageOff size={16} className="text-slate-300" />
                                    )}
                                  </div>
                                  <div className="min-w-0 max-w-sm lg:max-w-md">
                                    <p className="font-extrabold text-slate-800 text-xs line-clamp-2 leading-snug">
                                      {group.title}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                      {group.brand && (
                                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                          {group.brand}
                                        </span>
                                      )}
                                      {group.size && (
                                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                          Size: {group.size}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* SKU & Price */}
                              <td className="px-4 py-3.5">
                                <div className="space-y-0.5">
                                  <span className="font-mono text-[11px] font-bold text-slate-600 block">
                                    {group.sku || '-'}
                                  </span>
                                  <span className="font-extrabold text-slate-800 text-xs block">
                                    ${Number(group.price || 0).toFixed(2)}
                                  </span>
                                </div>
                              </td>

                              {/* Platform Columns */}
                              {['ebay', 'poshmark', 'mercari', /* 'depop', */ 'etsy', 'amazon'].map((plat) => {
                                const chData = group.channels?.[plat];
                                const isAlreadyInLocal = !!chData?.alreadyInLocal;
                                const isPlatChecked = !isAlreadyInLocal && !!groupPlats[plat];

                                if (!chData) {
                                  return (
                                    <td key={plat} className="px-3 py-3 text-center border-l first:border-l-0 border-slate-100">
                                      <span className="text-slate-300 font-bold text-xs">—</span>
                                    </td>
                                  );
                                }

                                return (
                                  <td key={plat} className="px-3 py-3 text-center border-l first:border-l-0 border-slate-100">
                                    <div className="inline-flex flex-col items-center gap-1">
                                      <label className={`flex items-center gap-1.5 p-1.5 rounded-lg border transition-colors ${
                                        isAlreadyInLocal
                                          ? 'bg-slate-50/80 border-slate-100 opacity-60 cursor-not-allowed'
                                          : 'bg-slate-50 hover:bg-indigo-50/70 border-slate-200 cursor-pointer select-none'
                                      }`}>
                                        <input
                                          type="checkbox"
                                          checked={isAlreadyInLocal ? false : isPlatChecked}
                                          disabled={isAlreadyInLocal}
                                          onChange={() => !isAlreadyInLocal && handleTogglePlatform(group.groupId, plat)}
                                          className="w-3.5 h-3.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 disabled:cursor-not-allowed cursor-pointer"
                                        />
                                        {isAlreadyInLocal ? (
                                          <span className="text-[10px] font-extrabold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                            In DB
                                          </span>
                                        ) : (
                                          <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                            Active
                                          </span>
                                        )}
                                      </label>
                                      {chData.liveId && (
                                        <span className="text-[9px] font-mono text-slate-400 truncate max-w-[85px]" title={chData.liveId}>
                                          {chData.liveId}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                );
                              })}

                              {/* Match Status */}
                              <td className="px-4 py-3.5 text-center">
                                <div className="inline-flex flex-col items-center gap-1">
                                  {group.channelCount > 1 ? (
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200/60 whitespace-nowrap">
                                      {group.channelCount} Channels Merged
                                    </span>
                                  ) : (
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap">
                                      Single Channel
                                    </span>
                                  )}

                                  {group.alreadyInLocal ? (
                                    <span className="text-[9px] font-extrabold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 whitespace-nowrap">
                                      Already in Local DB
                                    </span>
                                  ) : group.partiallyInLocal ? (
                                    <span className="text-[9px] font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 whitespace-nowrap">
                                      {group.unlinkedChannelCount || 1} {group.unlinkedChannelCount === 1 ? 'Channel' : 'Channels'} to Link
                                    </span>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-500 font-bold">
                {(() => {
                  const counts = getSelectedImportCounts();
                  return (
                    <span>
                      Selected: <span className="text-indigo-600 font-extrabold">{counts.groupCount} master products</span> ({counts.channelCount} channel listings)
                    </span>
                  );
                })()}
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setImportModalOpen(false)}
                  disabled={importSubmitting}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <button
                  onClick={handleExecuteImport}
                  disabled={importSubmitting || getSelectedImportCounts().groupCount === 0}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl text-xs font-black shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer w-full sm:w-auto active:scale-[0.98]"
                >
                  {importSubmitting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Importing to Local...</span>
                    </>
                  ) : (
                    <>
                      <Download size={14} />
                      <span>Import Selected to Local Database</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Smart Local Merge Modal */}
      {localMergeModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-[94vw] max-h-[92vh] overflow-hidden shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200 flex flex-col">

            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100/80 shrink-0">
                  <GitMerge size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-black text-slate-900">Smart Merge Local Listings</h2>
                    <span className="px-2.5 py-0.5 text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full">
                      Duplicates Found ({localMergeGroups.length})
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">
                    Merge duplicate listings of the same physical item across channels into a single unified master listing.
                  </p>
                </div>
              </div>

              {/* Header Right Actions */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Filter Tabs */}
                <div className="flex bg-slate-100 p-1 rounded-xl gap-1 overflow-x-auto">
                  <button
                    onClick={() => setLocalMergeFilterTab('all')}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer whitespace-nowrap ${
                      localMergeFilterTab === 'all'
                        ? 'bg-white text-indigo-600 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    All Duplicates ({localMergeGroups.length})
                  </button>
                  <button
                    onClick={() => setLocalMergeFilterTab('multi')}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer whitespace-nowrap ${
                      localMergeFilterTab === 'multi'
                        ? 'bg-white text-indigo-600 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Multi-Channel ({localMergeGroups.filter(g => g.channelCount > 1).length})
                  </button>
                  <button
                    onClick={() => setLocalMergeFilterTab('2plus')}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer whitespace-nowrap ${
                      localMergeFilterTab === '2plus'
                        ? 'bg-white text-indigo-600 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    2+ Duplicates ({localMergeGroups.filter(g => g.duplicateCount >= 2).length})
                  </button>
                </div>

                {/* Search in modal */}
                <div className="relative w-full sm:w-56">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={localMergeSearchTerm}
                    onChange={(e) => setLocalMergeSearchTerm(e.target.value)}
                    placeholder="Search title, SKU..."
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 focus:bg-white rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                  />
                  {localMergeSearchTerm && (
                    <button
                      onClick={() => setLocalMergeSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                <IconButton
                  aria-label="Close"
                  onClick={() => setLocalMergeModalOpen(false)}
                >
                  <X size={16} />
                </IconButton>
              </div>
            </div>

            {/* Quick Selection Actions Toolbar */}
            <div className="px-6 py-2.5 bg-slate-50/80 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mr-1">Quick Select:</span>
                <button
                  type="button"
                  onClick={() => handleSelectLocalMergeByCriteria('all')}
                  className="px-3 py-1 text-[11px] font-extrabold rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs transition-all cursor-pointer"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectLocalMergeByCriteria('multi')}
                  className="px-3 py-1 text-[11px] font-extrabold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 shadow-2xs transition-all cursor-pointer"
                >
                  Select Multi-Channel Only
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectLocalMergeByCriteria('2plus')}
                  className="px-3 py-1 text-[11px] font-extrabold rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 shadow-2xs transition-all cursor-pointer"
                >
                  Select 2+ Duplicates Only
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectLocalMergeByCriteria('none')}
                  className="px-3 py-1 text-[11px] font-extrabold rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-all cursor-pointer"
                >
                  Deselect All
                </button>
              </div>

              <div className="text-[11px] text-slate-500 font-bold">
                Showing <span className="text-slate-800 font-extrabold">{filteredLocalMergeGroups.length}</span> duplicate clusters
              </div>
            </div>

            {/* Modal Body / Table */}
            <div className="flex-1 overflow-y-auto min-h-[350px] p-4 sm:p-6 bg-slate-50/40">
              {localMergeLoading ? (
                <div className="flex flex-col items-center justify-center py-24 space-y-3">
                  <RefreshCw size={28} className="text-indigo-600 animate-spin" />
                  <p className="text-xs font-black text-slate-700">Scanning local database for duplicate items...</p>
                  <p className="text-[11px] text-slate-400 font-medium">Matching titles, images, and SKU relationships</p>
                </div>
              ) : filteredLocalMergeGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <CheckCircle2 size={36} className="text-emerald-500 mb-2" />
                  <h3 className="text-sm font-extrabold text-slate-700">No duplicate items found in Local Database</h3>
                  <p className="text-xs text-slate-400 max-w-md mt-1">
                    {localMergeSearchTerm ? 'No duplicate clusters match your search term.' : 'All local listings are cleanly organized without duplicates.'}
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      {/* Table Header */}
                      <thead className="bg-slate-50/90 border-b border-slate-100">
                        <tr>
                          <th className="px-4 py-3.5 w-12 text-center">
                            <input
                              type="checkbox"
                              checked={
                                filteredLocalMergeGroups.length > 0 &&
                                filteredLocalMergeGroups.every((grp) => selectedMergeGroupIds[grp.groupId])
                              }
                              onChange={handleToggleSelectAllLocalMerge}
                              className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                              title="Select / Deselect Visible Items"
                            />
                          </th>
                          <th className="px-4 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-wider min-w-[280px]">
                            Master Listing (Kept)
                          </th>
                          <th className="px-4 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-wider min-w-[220px]">
                            Duplicates to Merge & Clean
                          </th>

                          {/* Platform Columns with Logos */}
                          <th className="px-3 py-3 text-center w-24 border-l border-slate-100">
                            <div className="flex flex-col items-center justify-center gap-1">
                              <img src="/ebay.png" alt="eBay" className="w-5 h-5 object-contain" />
                              <span className="text-[10px] font-black text-slate-600">eBay</span>
                            </div>
                          </th>
                          <th className="px-3 py-3 text-center w-24">
                            <div className="flex flex-col items-center justify-center gap-1">
                              <img src="/poshmark.png" alt="Poshmark" className="w-5 h-5 object-contain" />
                              <span className="text-[10px] font-black text-slate-600">Poshmark</span>
                            </div>
                          </th>
                          <th className="px-3 py-3 text-center w-24">
                            <div className="flex flex-col items-center justify-center gap-1">
                              <img src="/mercari.png" alt="Mercari" className="w-5 h-5 object-contain" />
                              <span className="text-[10px] font-black text-slate-600">Mercari</span>
                            </div>
                          </th>
                          {/* <th className="px-3 py-3 text-center w-24">
                            <div className="flex flex-col items-center justify-center gap-1">
                              <img src="/depop.png" alt="Depop" className="w-5 h-5 object-contain" />
                              <span className="text-[10px] font-black text-slate-600">Depop</span>
                            </div>
                          </th> */}
                          <th className="px-3 py-3 text-center w-24">
                            <div className="flex flex-col items-center justify-center gap-1">
                              <img src="/etsy.png" alt="Etsy" className="w-5 h-5 object-contain" />
                              <span className="text-[10px] font-black text-slate-600">Etsy</span>
                            </div>
                          </th>
                          <th className="px-3 py-3 text-center w-24 border-r border-slate-100">
                            <div className="flex flex-col items-center justify-center gap-1">
                              <img src="/amazon.png" alt="Amazon" className="w-5 h-5 object-contain" />
                              <span className="text-[10px] font-black text-slate-600">Amazon</span>
                            </div>
                          </th>

                          <th className="px-4 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center">
                            Merge Summary
                          </th>
                        </tr>
                      </thead>

                      {/* Table Rows */}
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {filteredLocalMergeGroups.map((group) => {
                          const isRowChecked = !!selectedMergeGroupIds[group.groupId];
                          const master = group.masterListing || {};
                          const duplicates = group.duplicateListings || [];

                          return (
                            <tr
                              key={group.groupId}
                              className={`transition-colors ${
                                isRowChecked ? 'bg-indigo-50/20 hover:bg-indigo-50/40' : 'hover:bg-slate-50/60 opacity-65'
                              }`}
                            >
                              {/* Row Checkbox */}
                              <td className="px-4 py-3.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={isRowChecked}
                                  onChange={() => handleToggleMergeGroupRow(group.groupId)}
                                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                                />
                              </td>

                              {/* Master Listing Info */}
                              <td className="px-4 py-3.5">
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 bg-slate-100 rounded-xl overflow-hidden shrink-0 border border-slate-200 flex items-center justify-center">
                                    {master.thumbnail || (master.images && master.images[0]) ? (
                                      <img
                                        src={master.thumbnail || master.images[0]}
                                        className="w-full h-full object-cover"
                                        alt=""
                                        onError={(e) => { e.currentTarget.src = NO_IMAGE_PLACEHOLDER; }}
                                      />
                                    ) : (
                                      <ImageOff size={16} className="text-slate-300" />
                                    )}
                                  </div>
                                  <div className="min-w-0 max-w-sm">
                                    <p className="font-extrabold text-slate-800 text-xs line-clamp-2 leading-snug">
                                      {master.title}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                        SKU: {master.sku || '-'}
                                      </span>
                                      <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60">
                                        ${Number(master.price || 0).toFixed(2)}
                                      </span>
                                      {master.status && (
                                        <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase ${
                                          master.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                                        }`}>
                                          {master.status}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Duplicates to Merge & Delete */}
                              <td className="px-4 py-3.5">
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200/60">
                                      {group.duplicateCount} Duplicate Listing{group.duplicateCount > 1 ? 's' : ''}
                                    </span>
                                  </div>
                                  <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                                    {duplicates.map((dup, idx) => (
                                      <div key={dup._id || idx} className="flex items-center gap-2 text-[11px] text-slate-600 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                                        <div className="w-6 h-6 bg-slate-200 rounded shrink-0 overflow-hidden flex items-center justify-center">
                                          {dup.thumbnail ? (
                                            <img src={dup.thumbnail} className="w-full h-full object-cover" alt="" onError={(e) => { e.currentTarget.src = NO_IMAGE_PLACEHOLDER; }} />
                                          ) : (
                                            <ImageOff size={10} className="text-slate-400" />
                                          )}
                                        </div>
                                        <span className="truncate max-w-[180px] font-semibold text-slate-700" title={dup.title}>
                                          {dup.title}
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-mono ml-auto shrink-0">
                                          {dup.platform || dup.status}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </td>

                              {/* Platform Columns */}
                              {['ebay', 'poshmark', 'mercari', /* 'depop', */ 'etsy', 'amazon'].map((plat) => {
                                const chData = group.channels?.[plat];
                                if (!chData) {
                                  return (
                                    <td key={plat} className="px-3 py-3 text-center border-l first:border-l-0 border-slate-100">
                                      <span className="text-slate-300 font-bold text-xs">—</span>
                                    </td>
                                  );
                                }

                                return (
                                  <td key={plat} className="px-3 py-3 text-center border-l first:border-l-0 border-slate-100">
                                    <div className="inline-flex flex-col items-center gap-0.5">
                                      <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                        Connected
                                      </span>
                                      {chData.liveId && (
                                        <span className="text-[9px] font-mono text-slate-400 truncate max-w-[75px]" title={chData.liveId}>
                                          {chData.liveId}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                );
                              })}

                              {/* Merge Summary */}
                              <td className="px-4 py-3.5 text-center">
                                <div className="inline-flex flex-col items-center gap-1">
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200/60 whitespace-nowrap">
                                    Merge {group.totalListingsInGroup} into 1 Master
                                  </span>
                                  <span className="text-[9px] font-bold text-slate-400">
                                    Deletes {group.duplicateCount} Redundant
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-500 font-bold">
                {(() => {
                  const counts = getSelectedLocalMergeCounts();
                  return (
                    <span>
                      Selected: <span className="text-indigo-600 font-extrabold">{counts.groupCount} item clusters</span> ({counts.duplicateCount} duplicate listings will be safely merged and removed)
                    </span>
                  );
                })()}
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setLocalMergeModalOpen(false)}
                  disabled={localMergeSubmitting}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <button
                  onClick={handleExecuteBulkMerge}
                  disabled={localMergeSubmitting || getSelectedLocalMergeCounts().groupCount === 0}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl text-xs font-black shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer w-full sm:w-auto active:scale-[0.98]"
                >
                  {localMergeSubmitting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Merging Listings...</span>
                    </>
                  ) : (
                    <>
                      <GitMerge size={14} />
                      <span>Execute Bulk Merge</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default NewListings;
