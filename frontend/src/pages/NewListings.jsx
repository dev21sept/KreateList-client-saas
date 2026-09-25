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
  GitMerge,
  MoreVertical,
  Star,
  ArrowUpDown,
  Zap,
  Sparkles,
  Layers,
  ArrowLeft,
  DollarSign,
  Clock,
  ShieldCheck,
  Flame,
  Tag,
  ArrowUpRight
} from 'lucide-react';
import api, { listingService, ebayService, externalImportService, etsyService, mercariService, amazonService, orderService } from '../services/api';
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
    title: "Untuckit Shirt Mens XL Long Sleeve Button Up Plaid Blue/White",
    sku: "5059",
    quantity: 1,
    status: "Active",
    price: 39.00,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2h ago
    thumbnail: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=150&q=80',
    images: ['https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800&q=80'],
    platform: 'ebay',
    ebayListingId: '206549719729',
    ebayUrl: 'https://www.ebay.com/itm/206549719729',
    ebayStatus: 'published',
    ebayPrice: 39.00,
    poshmarkListingId: '6a6ca52834fc5f862c1e3114',
    poshmarkUrl: 'https://poshmark.com/listing/6a6ca52834fc5f862c1e3114',
    poshmarkStatus: 'published',
    poshmarkPrice: 36.00,
    mercariListingId: 'm26470764471',
    mercariUrl: 'https://www.mercari.com/us/item/m26470764471/',
    mercariStatus: 'published',
    mercariPrice: 35.00,
    etsyListingId: '1849204810',
    etsyUrl: 'https://www.etsy.com/listing/1849204810',
    etsyStatus: 'published',
    etsyPrice: 34.00,
    amazonListingId: 'B09V3KXYZ1',
    amazonAsin: 'B09V3KXYZ1',
    amazonUrl: 'https://www.amazon.com/dp/B09V3KXYZ1',
    amazonStatus: 'published',
    amazonPrice: 42.00,
  },
  {
    _id: 'mock-2',
    title: "Ariat M5 Slim Straight FR Blue Jeans Men's 38x30 Cat 2 Work Pants",
    sku: "4821",
    quantity: 1,
    status: "Active",
    price: 58.00,
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4h ago
    thumbnail: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=150&q=80',
    images: ['https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=800&q=80'],
    platform: 'ebay',
    ebayListingId: '206549719730',
    ebayUrl: 'https://www.ebay.com/itm/206549719730',
    ebayStatus: 'published',
    ebayPrice: 58.00,
    poshmarkListingId: '6a6ca52834fc5f862c1e3115',
    poshmarkUrl: 'https://poshmark.com/listing/6a6ca52834fc5f862c1e3115',
    poshmarkStatus: 'published',
    poshmarkPrice: 52.00,
    mercariListingId: 'm26470764472',
    mercariUrl: 'https://www.mercari.com/us/item/m26470764472/',
    mercariStatus: 'published',
    mercariPrice: 50.00,
    etsyListingId: '',
    etsyUrl: '',
    etsyStatus: 'draft',
    etsyPrice: 48.00,
    amazonListingId: 'B09V3KXYZ2',
    amazonAsin: 'B09V3KXYZ2',
    amazonUrl: 'https://www.amazon.com/dp/B09V3KXYZ2',
    amazonStatus: 'published',
    amazonPrice: 56.00,
  },
  {
    _id: 'mock-3',
    title: "Duluth Pants Flex Fly On The Dry Mens 32x32 Relaxed Cargo",
    sku: "7713",
    quantity: 1,
    status: "Active",
    price: 45.00,
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6h ago
    thumbnail: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=150&q=80',
    images: ['https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800&q=80'],
    platform: 'ebay',
    ebayListingId: '206549719731',
    ebayUrl: 'https://www.ebay.com/itm/206549719731',
    ebayStatus: 'published',
    ebayPrice: 45.00,
    poshmarkListingId: '6a6ca52834fc5f862c1e3116',
    poshmarkUrl: 'https://poshmark.com/listing/6a6ca52834fc5f862c1e3116',
    poshmarkStatus: 'published',
    poshmarkPrice: 42.00,
    mercariListingId: '',
    mercariUrl: '',
    mercariStatus: 'failed',
    mercariPrice: 40.00,
    etsyListingId: '1849204812',
    etsyUrl: 'https://www.etsy.com/listing/1849204812',
    etsyStatus: 'published',
    etsyPrice: 38.00,
    amazonListingId: 'B09V3KXYZ3',
    amazonAsin: 'B09V3KXYZ3',
    amazonUrl: 'https://www.amazon.com/dp/B09V3KXYZ3',
    amazonStatus: 'published',
    amazonPrice: 44.00,
  },
  {
    _id: 'mock-4',
    title: "Gap Stripe Long Sleeve T-Shirt Women's Medium",
    sku: "6687",
    quantity: 1,
    status: "Active",
    price: 28.00,
    createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(), // 8h ago
    thumbnail: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=150&q=80',
    images: ['https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&q=80'],
    platform: 'ebay',
    ebayListingId: '206549719732',
    ebayUrl: 'https://www.ebay.com/itm/206549719732',
    ebayStatus: 'published',
    ebayPrice: 28.00,
    poshmarkListingId: '6a6ca52834fc5f862c1e3117',
    poshmarkUrl: 'https://poshmark.com/listing/6a6ca52834fc5f862c1e3117',
    poshmarkStatus: 'published',
    poshmarkPrice: 24.00,
    mercariListingId: 'm26470764474',
    mercariUrl: 'https://www.mercari.com/us/item/m26470764474/',
    mercariStatus: 'published',
    mercariPrice: 26.00,
    etsyListingId: '',
    etsyUrl: '',
    etsyStatus: 'failed',
    etsyPrice: 22.00,
    amazonListingId: 'B09V3KXYZ4',
    amazonAsin: 'B09V3KXYZ4',
    amazonUrl: 'https://www.amazon.com/dp/B09V3KXYZ4',
    amazonStatus: 'published',
    amazonPrice: 27.00,
  }
];

const isSyntheticPart = (part) => {
  if (!part || typeof part !== 'string') return true;
  const p = part.trim();
  if (p === '' || p === '-') return true;
  return (
    /^(EBAY|POSH|POSHMARK|MERCARI|ETSY|AMAZON|DEPOP|M|P|E)-[a-zA-Z0-9_\-]+$/i.test(p) ||
    /^[0-9]{11,14}$/.test(p) ||
    /^[a-f0-9]{24}$/i.test(p) ||
    /^m[0-9]{10,12}$/i.test(p)
  );
};

const isSyntheticSku = (str) => {
  if (!str || typeof str !== 'string') return true;
  const s = str.trim();
  if (s === '' || s === '-') return true;
  const parts = s.split(/[\s|,\/]+/).map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return true;
  return parts.every(part => isSyntheticPart(part));
};

const getDisplaySku = (rawSku) => {
  if (!rawSku || typeof rawSku !== 'string') return '-';
  const clean = rawSku.trim();
  if (!clean || clean === '-') return '-';
  
  // Filter out any synthetic marketplace IDs (e.g. 'P-6a7d6f6798bbf377f3a9c3f8 | 4913' -> '4913')
  const parts = clean.split(/[\s|,\/]+/).map(p => p.trim()).filter(Boolean);
  const realParts = parts.filter(p => !isSyntheticPart(p));
  
  if (realParts.length === 0) return '-';
  return realParts.join(' | ');
};

const getPlatformLiveId = (listing, plat) => {
  if (!listing) return '';
  const platData = listing.platformData?.[plat] || (listing.listingsMap?.[plat]) || (listing.platform === plat ? listing : {});
  if (platData.liveId && platData.liveId !== '-') return platData.liveId;
  if (platData.listingId && platData.listingId !== '-') return platData.listingId;
  if (listing[`${plat}ListingId`] && listing[`${plat}ListingId`] !== '-') return listing[`${plat}ListingId`];
  if (plat === 'ebay' && listing.ebayListingId) return listing.ebayListingId;
  if (plat === 'poshmark' && listing.poshmarkListingId) return listing.poshmarkListingId;
  if (plat === 'mercari' && listing.mercariListingId) return listing.mercariListingId;
  if (plat === 'etsy' && listing.etsyListingId) return listing.etsyListingId;
  if (plat === 'amazon' && (listing.amazonListingId || listing.amazonAsin)) return listing.amazonListingId || listing.amazonAsin;
  
  // Extract from raw SKU if any legacy value has it
  const rawSku = listing.sku || '';
  if (plat === 'ebay') {
    const m = rawSku.match(/EBAY-([0-9]+)/i);
    if (m) return m[1];
  } else if (plat === 'poshmark') {
    const m = rawSku.match(/P-([a-f0-9]{24})/i);
    if (m) return m[1];
  } else if (plat === 'mercari') {
    const m = rawSku.match(/M-(m[0-9]+)/i);
    if (m) return m[1];
  } else if (plat === 'etsy') {
    const m = rawSku.match(/ETSY-([0-9]+)/i);
    if (m) return m[1];
  }
  return '';
};

const groupListingsBySku = (rawListings) => {
  const groups = [];

  rawListings.forEach(item => {
    const rawSku = item.sku ? item.sku.trim() : '';
    const cleanSku = getDisplaySku(rawSku);
    const sku = cleanSku !== '-' ? cleanSku : '';
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
      const platforms = ['ebay', 'poshmark', 'depop', 'etsy', 'mercari', 'amazon'];
      platforms.forEach(p => {
        if (item.platform === p || item[`${p}Status`] === 'draft' || item[`${p}Status`] === 'published' || item[`${p}Status`] === 'failed' || item[`${p}Status`] === 'delisted' || item[`${p}Status`] === 'active') {
          if (!existing.listingsMap[p] || (new Date(item.createdAt || 0) > new Date(existing.listingsMap[p].createdAt || 0))) {
            existing.listingsMap[p] = item;
          }
        }
      });

      // Keep both SKUs and thumbnails in the group's match arrays
      if (sku && !existing.skus.includes(sku)) existing.skus.push(sku);
      if (thumbnail && !existing.thumbnails.includes(thumbnail)) existing.thumbnails.push(thumbnail);

      // Merge listing IDs/URLs
      if (item.ebayListingId) { existing.ebayListingId = item.ebayListingId; existing.ebayUrl = item.ebayUrl; }
      if (item.poshmarkListingId) { existing.poshmarkListingId = item.poshmarkListingId; existing.poshmarkUrl = item.poshmarkUrl; }
      if (item.depopListingId) { existing.depopListingId = item.depopListingId; existing.depopUrl = item.depopUrl; }
      if (item.etsyListingId) { existing.etsyListingId = item.etsyListingId; existing.etsyUrl = item.etsyUrl; }
      if (item.mercariListingId) { existing.mercariListingId = item.mercariListingId; existing.mercariUrl = item.mercariUrl; }
      if (item.amazonListingId || item.amazonAsin) { existing.amazonListingId = item.amazonListingId; existing.amazonAsin = item.amazonAsin; existing.amazonUrl = item.amazonUrl; }

      // Merge platform statuses if set
      if (item.ebayStatus) existing.ebayStatus = item.ebayStatus;
      if (item.poshmarkStatus) existing.poshmarkStatus = item.poshmarkStatus;
      if (item.etsyStatus) existing.etsyStatus = item.etsyStatus;
      if (item.mercariStatus) existing.mercariStatus = item.mercariStatus;
      if (item.amazonStatus) existing.amazonStatus = item.amazonStatus;

      // Merge platformData and platform-specific prices
      if (!existing.platformData) existing.platformData = {};
      if (item.platformData) {
        existing.platformData = { ...existing.platformData, ...item.platformData };
      }
      if (item.platform && item.price) {
        existing.platformData[item.platform] = { ...(existing.platformData[item.platform] || {}), price: item.price };
      }
      if (item.ebayPrice) {
        existing.platformData.ebay = { ...(existing.platformData.ebay || {}), price: item.ebayPrice };
      }
      if (item.poshmarkPrice) {
        existing.platformData.poshmark = { ...(existing.platformData.poshmark || {}), price: item.poshmarkPrice };
      }
      if (item.mercariPrice) {
        existing.platformData.mercari = { ...(existing.platformData.mercari || {}), price: item.mercariPrice };
      }
      if (item.etsyPrice) {
        existing.platformData.etsy = { ...(existing.platformData.etsy || {}), price: item.etsyPrice };
      }
      if (item.amazonPrice) {
        existing.platformData.amazon = { ...(existing.platformData.amazon || {}), price: item.amazonPrice };
      }

      // If any of the listings is more recent, use its title/thumbnail/date and other details
      const itemTime = new Date(item.updatedAt || item.updated_at || item.createdAt || item.created_at || 0).getTime();
      const existingTime = new Date(existing.updatedAt || existing.updated_at || existing.createdAt || existing.created_at || 0).getTime();
      if (itemTime > existingTime) {
        existing.updatedAt = item.updatedAt || item.updated_at || item.createdAt;
        existing.createdAt = item.createdAt || item.created_at || existing.createdAt;
        if (item.title) existing.title = item.title;
        if (item.thumbnail) existing.thumbnail = item.thumbnail;
        if (item.size) existing.size = item.size;
        if (item.brand) existing.brand = item.brand;
        if (item.color) existing.color = item.color;
        if (item.description) existing.description = item.description;
        if (item.category) existing.category = item.category;
        if (item.categoryId) existing.categoryId = item.categoryId;
        if (item.itemSpecifics) existing.itemSpecifics = item.itemSpecifics;
        if (item.conditionNote) existing.conditionNote = item.conditionNote;
      }

      // Merge sold metadata if either item is sold
      if (item.status === 'sold' || existing.status === 'sold') {
        existing.status = 'sold';
      }
      if (item.soldOn) existing.soldOn = item.soldOn;
      if (item.soldPlatform) existing.soldPlatform = item.soldPlatform;
      if (item.soldOrderId) existing.soldOrderId = item.soldOrderId;
      if (item.soldAt) existing.soldAt = item.soldAt;
      if (item.soldPrice) existing.soldPrice = item.soldPrice;
      if (item.errorMessage && item.errorMessage.toLowerCase().startsWith('sold on')) {
        existing.errorMessage = item.errorMessage;
      }
      if (item.autoDelistLog) {
        existing.autoDelistLog = { ...(existing.autoDelistLog || {}), ...item.autoDelistLog };
      }

      // If existing SKU is '-' but incoming item has real SKU, use it
      if (existing.sku === '-' && sku) {
        existing.sku = sku;
      }

      const statusLower = item.status?.toLowerCase();
      if (existing.status !== 'sold') {
        if (statusLower === 'active' || statusLower === 'published' || existing.status === 'Active' || existing.status === 'Published') {
          existing.status = 'Active';
        }
      }
      
      // Keep track of all sub-document IDs in a list for deletion
      if (!existing.allIds.includes(item._id)) {
        existing.allIds.push(item._id);
      }
    } else {
      // Create new group copying all listing document fields
      const newGroup = {
        ...item,
        updatedAt: item.updatedAt || item.updated_at || item.createdAt,
        createdAt: item.createdAt || item.created_at || item.updatedAt,
        allIds: [item._id],
        sku: (sku && sku !== '-') ? sku : '-',
        skus: (sku && sku !== '-') ? [sku] : [],
        thumbnails: thumbnail ? [thumbnail] : [],
        platformData: {
          ...(item.platformData || {}),
          ...(item.platform && item.price ? { [item.platform]: { ...(item.platformData?.[item.platform] || {}), price: item.price } } : {}),
          ...(item.ebayPrice ? { ebay: { ...(item.platformData?.ebay || {}), price: item.ebayPrice } } : {}),
          ...(item.poshmarkPrice ? { poshmark: { ...(item.platformData?.poshmark || {}), price: item.poshmarkPrice } } : {}),
          ...(item.mercariPrice ? { mercari: { ...(item.platformData?.mercari || {}), price: item.mercariPrice } } : {}),
          ...(item.etsyPrice ? { etsy: { ...(item.platformData?.etsy || {}), price: item.etsyPrice } } : {}),
          ...(item.amazonPrice ? { amazon: { ...(item.platformData?.amazon || {}), price: item.amazonPrice } } : {}),
        },
        listingsMap: {}
      };

      // Set the initial platform mappings
      const platforms = ['ebay', 'poshmark', 'depop', 'etsy', 'mercari', 'amazon'];
      platforms.forEach(p => {
        if (item.platform === p || item[`${p}Status`] === 'draft' || item[`${p}Status`] === 'published' || item[`${p}Status`] === 'failed' || item[`${p}Status`] === 'delisted' || item[`${p}Status`] === 'active') {
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

  // Sold Tracker states
  const [soldOrders, setSoldOrders] = useState([]);
  const [soldStats, setSoldStats] = useState(null);
  const [soldLoading, setSoldLoading] = useState(false);
  const [soldSyncing, setSoldSyncing] = useState(false);
  const [soldSearchTerm, setSoldSearchTerm] = useState('');
  const [soldPlatformFilter, setSoldPlatformFilter] = useState('all');
  const [soldSortOption, setSoldSortOption] = useState('newest');
  const [soldCurrentPage, setSoldCurrentPage] = useState(1);
  const [soldItemsPerPage, setSoldItemsPerPage] = useState(10);
  const [lastSoldSyncTime, setLastSoldSyncTime] = useState(() => new Date());

  // Preview & Edit system states
  const [previewListing, setPreviewListing] = useState(null);
  const [previewPlatform, setPreviewPlatform] = useState('ebay');
  const [activeImage, setActiveImage] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // Quick SKU Edit states
  const [editingSkuId, setEditingSkuId] = useState(null);
  const [tempSkuValue, setTempSkuValue] = useState('');
  const [savingSku, setSavingSku] = useState(false);

  const handleQuickUpdateSku = async (listingId, newSku) => {
    if (!listingId) return;
    setSavingSku(true);
    try {
      const cleanNewSku = (newSku || '').trim();
      await listingService.update(listingId, { sku: cleanNewSku });
      toast.success('SKU updated successfully!');
      setListings(prev => prev.map(l => (l._id === listingId || (l.allIds && l.allIds.includes(listingId))) ? { ...l, sku: cleanNewSku } : l));
      setPreviewListing(prev => {
        if (!prev) return null;
        if (prev._id === listingId || (prev.allIds && prev.allIds.includes(listingId))) {
          return { ...prev, sku: cleanNewSku };
        }
        return prev;
      });
      setEditingSkuId(null);
    } catch (err) {
      console.error('Failed to update SKU:', err);
      toast.error('Failed to update SKU');
    } finally {
      setSavingSku(false);
    }
  };

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
  const [sortOption, setSortOption] = useState('crosslisted-desc');
  
  // Favorites State
  const [favoriteIds, setFavoriteIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('elister_favorite_listings') || '[]');
    } catch {
      return [];
    }
  });

  const handleToggleFavorite = (itemId, e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setFavoriteIds(prev => {
      const next = prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId];
      try {
        localStorage.setItem('elister_favorite_listings', JSON.stringify(next));
      } catch (err) {
        console.error('Error saving favorites:', err);
      }
      return next;
    });
  };

  const handleToggleSortDirection = () => {
    const pairs = {
      'crosslisted-desc': 'crosslisted-asc',
      'crosslisted-asc': 'crosslisted-desc',
      'newest': 'oldest',
      'oldest': 'newest',
      'title-asc': 'title-desc',
      'title-desc': 'title-asc',
      'price-desc': 'price-asc',
      'price-asc': 'price-desc',
      'qty-desc': 'qty-asc',
      'qty-asc': 'qty-desc',
    };
    setSortOption(prev => pairs[prev] || 'crosslisted-desc');
  };

  const handleToggleChannelSortDirection = () => {
    const pairs = {
      'newest': 'oldest',
      'oldest': 'newest',
      'price-desc': 'price-asc',
      'price-asc': 'price-desc',
      'title-asc': 'title-desc',
      'title-desc': 'title-asc',
    };
    setChannelSortOption(prev => {
      const next = pairs[prev] || 'newest';
      localStorage.setItem('elister_channel_sort_option', next);
      return next;
    });
  };

  const getCrosslistedPlatformCount = (item) => {
    if (!item) return 0;
    let count = 0;
    const platforms = ['ebay', 'poshmark', 'mercari', 'etsy', 'amazon'];
    for (const p of platforms) {
      const pSub = item.listingsMap?.[p];
      const rawSt = (pSub ? pSub.status : item[`${p}Status`])?.toLowerCase();
      const liveId = item[`${p}ListingId`] || pSub?.listingId || item.platformData?.[p]?.liveId || item.platformData?.[p]?.listingId;
      
      const isExplicitlyUnlisted = rawSt === 'none' || rawSt === 'unlisted';
      const hasPresence = 
        (liveId && liveId !== '-' && liveId !== 'undefined' && liveId !== 'null') ||
        (rawSt && !isExplicitlyUnlisted) ||
        Boolean(pSub) ||
        Boolean(item.platformData?.[p]) ||
        (item.platform === p);

      if (hasPresence && !isExplicitlyUnlisted) {
        count++;
      }
    }
    return count;
  };

  const getActivePlatformCount = (item) => {
    if (!item) return 0;
    let count = 0;
    const platforms = ['ebay', 'poshmark', 'mercari', 'etsy', 'amazon'];
    for (const p of platforms) {
      const pSub = item.listingsMap?.[p];
      const rawSt = (pSub ? pSub.status : item[`${p}Status`])?.toLowerCase();
      const liveId = item[`${p}ListingId`] || pSub?.listingId || item.platformData?.[p]?.liveId || item.platformData?.[p]?.listingId;
      if ((rawSt === 'published' || rawSt === 'active' || rawSt === 'live') && liveId && liveId !== '-') {
        count++;
      } else if (!rawSt && item.platform === p && (item.status?.toLowerCase() === 'active' || item.status?.toLowerCase() === 'published')) {
        count++;
      }
    }
    return count;
  };

  const getSortPlatformCount = (item) => {
    if (statusFilter === 'active') {
      const activeCount = getActivePlatformCount(item);
      return activeCount > 0 ? activeCount : getCrosslistedPlatformCount(item);
    }
    return getCrosslistedPlatformCount(item);
  };

  // Filter Modal States
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [filterListedOn, setFilterListedOn] = useState([]);
  const [filterNoListedOn, setFilterNoListedOn] = useState([]);
  
  // Temporary Modal States
  const [tempListedOn, setTempListedOn] = useState([]);
  const [tempNoListedOn, setTempNoListedOn] = useState([]);
  const [tempSortOption, setTempSortOption] = useState('crosslisted-desc');

  const hasActiveLocalFilters = Boolean(
    searchTerm ||
    statusFilter !== 'all' ||
    (filterListedOn && filterListedOn.length > 0) ||
    (filterNoListedOn && filterNoListedOn.length > 0) ||
    sortOption !== 'crosslisted-desc'
  );

  const hasActiveChannelFilters = Boolean(
    searchTerm ||
    channelStatusFilter !== 'all' ||
    channelSortOption !== 'newest'
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

  // Smart Sync & Import Modal States
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importViewMode, setImportViewMode] = useState('overview'); // 'overview' | 'custom'
  const [importBreakdown, setImportBreakdown] = useState(null);
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

  const fetchListings = async (silent = false) => {
    if (!silent && listings.length === 0) {
      setLoading(true);
    }
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
      if (listings.length === 0) {
        setListings(MOCK_LISTINGS);
        setStats({
          total: 2456,
          published: 1982,
          draft: 215,
          failed: 70,
          unlisted: 189
        });
      }
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

  const fetchChannelInventory = async (silent = false) => {
    if (!isChannelConnected()) {
      setChannelProducts([]);
      return;
    }
    if (!silent && channelProducts.length === 0) {
      setChannelLoading(true);
    }
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

  const fetchSoldOrders = async (silent = false) => {
    if (!silent && soldOrders.length === 0) {
      setSoldLoading(true);
    }
    try {
      const res = await orderService.getAll({ onlyMaster: true });
      if (res.data?.success) {
        setSoldOrders(res.data.data || []);
        if (res.data.stats) {
          setSoldStats(res.data.stats);
        }
        setLastSoldSyncTime(new Date());
      }
    } catch (error) {
      console.error('Error loading sold orders:', error);
    } finally {
      setSoldLoading(false);
    }
  };

  const handleManualSoldSync = async () => {
    setSoldSyncing(true);
    try {
      const res = await orderService.sync();
      if (res.data?.success) {
        toast.success(res.data.message || 'Sales synchronized successfully!');
        setLastSoldSyncTime(new Date());
        await Promise.all([fetchSoldOrders(), fetchListings()]);
      } else {
        toast.error(res.data?.message || 'Failed to sync sales.');
      }
    } catch (err) {
      console.error('Error syncing sales:', err);
      toast.error(err.response?.data?.message || 'Failed to sync sales.');
    } finally {
      setSoldSyncing(false);
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
    fetchSoldOrders();

    const handleUpdate = () => {
      if (handleUpdateRef.current) {
        handleUpdateRef.current();
      }
    };
    window.addEventListener('elister-listings-update', handleUpdate);
    return () => window.removeEventListener('elister-listings-update', handleUpdate);
  }, []);

  useEffect(() => {
    if (activeTab === 'sold') {
      fetchSoldOrders(true);
    }
  }, [activeTab]);

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
      if (platform === 'mercari' && fallbackUrl.includes('mercari.com/item/')) {
        fallbackUrl = fallbackUrl.replace('mercari.com/item/', 'mercari.com/us/item/');
      }
      if (!fallbackUrl) {
        const checkId = targetItem[`${platform}ListingId`] || targetItem.listingId;
        if (checkId) {
          if (platform === 'mercari') fallbackUrl = `https://www.mercari.com/us/item/${checkId}/`;
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

      // Only enrich Mercari details if the user explicitly clicked Preview for Mercari
      if (platform === 'mercari') {
        const mercId = targetItem.mercariListingId || (targetItem.sku && targetItem.sku.startsWith('M-m') ? targetItem.sku.replace('M-', '') : targetItem._id);
        if (mercId && (!targetItem.images || targetItem.images.length <= 1 || !targetItem.description || targetItem.description === targetItem.title)) {
          mercariService.getItemDetails(mercId).then(res => {
            if (res.data?.success && res.data?.data) {
              const fullData = res.data.data;
              setPreviewListing(prev => {
                if (!prev || prev.platform !== 'mercari') return prev; // Do not re-open if closed or switched
                return {
                  ...prev,
                  ...fullData,
                  platform: 'mercari',
                  status: fullData.status === 'active' ? 'published' : 'delisted',
                  url: fullData.mercariUrl || prev?.url
                };
              });
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
          else if (listing.platform === 'mercari') url = (listing.mercariUrl || (listing.mercariListingId ? `https://www.mercari.com/us/item/${listing.mercariListingId}/` : '')).replace('mercari.com/item/', 'mercari.com/us/item/');
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
      else if (listing.platform === 'mercari') url = (listing.mercariUrl || (listing.mercariListingId ? `https://www.mercari.com/us/item/${listing.mercariListingId}/` : '')).replace('mercari.com/item/', 'mercari.com/us/item/');
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
      if (platformName === 'mercari' && url && url.includes('mercari.com/item/')) {
        url = url.replace('mercari.com/item/', 'mercari.com/us/item/');
      }
      if (!url) {
        const id = previewListing[`${platformName}ListingId`] || platformSpecificItem?.listingId || (previewListing.platform === platformName ? (previewListing.liveId || previewListing.itemId || previewListing._id) : null);
        if (id && id !== '-') {
          if (platformName === 'ebay') url = `https://www.ebay.com/itm/${id}`;
          else if (platformName === 'poshmark') url = `https://poshmark.com/listing/${id}`;
          else if (platformName === 'mercari') url = `https://www.mercari.com/us/item/${id}/`;
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
    const sku = getDisplaySku(product.sku);
    const thumbnail = product.thumbnail || (product.images && product.images[0]) || '';

    const rawStatus = (product.status || '').toLowerCase();
    let status = 'active';
    if (rawStatus === 'active' || rawStatus === 'live' || rawStatus === 'published') {
      status = 'active';
    } else if (rawStatus === 'draft') {
      status = 'draft';
    } else if (rawStatus === 'delisted' || rawStatus === 'ended' || rawStatus === 'inactive' || rawStatus === 'cancelled' || rawStatus === 'closed' || rawStatus === 'sold' || rawStatus === 'completed') {
      status = 'delisted';
    } else if (rawStatus === 'failed' || rawStatus === 'error' || rawStatus === 'action_required') {
      status = 'error';
    } else {
      status = 'active';
    }

    // Price
    const price = product.selling_price !== undefined ? product.selling_price : product.price;
    const parsedPrice = typeof price === 'number' ? price : parseFloat(price) || 0;

    // Live ID and URL
    let liveId = '-';
    let url = '';
    if (isEbay) {
      liveId = product.ebayListingId || product.itemId || (product.sku?.match(/EBAY-([0-9]+)/i)?.[1]) || product.liveId || '-';
      url = product.ebayUrl || (liveId !== '-' ? `https://www.ebay.com/itm/${liveId}` : '');
    } else if (isEtsy) {
      liveId = product.etsyListingId || product.listingId || (product.sku?.match(/ETSY-([0-9]+)/i)?.[1]) || product.liveId || '-';
      url = product.etsyUrl || (liveId !== '-' ? `https://www.etsy.com/listing/${liveId}` : '');
    } else if (isPoshmark) {
      liveId = product.poshmarkListingId || product.postId || (product.sku?.match(/P-([a-f0-9]{24})/i)?.[1]) || product.liveId || '-';
      url = product.poshmarkUrl || (liveId !== '-' ? `https://poshmark.com/listing/${liveId}` : '');
    } else if (isDepop) {
      liveId = product.depopListingId || product.liveId || '-';
      url = product.depopUrl || '';
    } else if (isMercari) {
      liveId = product.mercariListingId || product.itemId || (product.sku?.match(/M-(m[0-9]+)/i)?.[1]) || product.liveId || '-';
      url = (product.mercariUrl || (liveId !== '-' ? `https://www.mercari.com/us/item/${liveId}/` : '')).replace('mercari.com/item/', 'mercari.com/us/item/');
    } else if (isAmazon) {
      liveId = product.amazonListingId || product.amazonAsin || product.asin || product.liveId || '-';
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

  // Tab counts for Local Database status tabs
  const localTabCounts = React.useMemo(() => {
    let all = groupedListingsList.length;
    let active = 0;
    let sold = 0;
    let delisted = 0;
    let draft = 0;
    let error = 0;
    let favorite = 0;

    groupedListingsList.forEach((item) => {
      const statusLower = item.status?.toLowerCase();
      const isSold =
        statusLower === 'sold' ||
        Boolean(item.soldOn) ||
        Boolean(item.soldPlatform) ||
        (item.errorMessage && item.errorMessage.toLowerCase().startsWith('sold on'));
      const pCount = getActivePlatformCount(item);

      if (isSold) {
        sold++;
      } else if (pCount > 0 || statusLower === 'active' || statusLower === 'published') {
        active++;
      } else if (statusLower === 'delisted') {
        delisted++;
      } else if (statusLower === 'draft') {
        draft++;
      } else if (statusLower === 'failed' || statusLower === 'error') {
        error++;
      } else {
        draft++;
      }

      if (favoriteIds.includes(item._id) || item.isFavorite) {
        favorite++;
      }
    });

    return { all, active, sold, delisted, draft, error, favorite };
  }, [groupedListingsList, favoriteIds]);

  // Tab counts for All Platform Inventory status tabs (All, Active, Delisted, Drafts, Errors - NO Sold, NO Favorites)
  const channelTabCounts = React.useMemo(() => {
    let all = channelProducts.length;
    let active = 0;
    let delisted = 0;
    let draft = 0;
    let error = 0;

    channelProducts.forEach((p) => {
      const details = getProductDetails(p);
      const st = details.status;
      if (st === 'active') active++;
      else if (st === 'delisted') delisted++;
      else if (st === 'draft') draft++;
      else if (st === 'error') error++;
      else active++;
    });

    return { all, active, delisted, draft, error };
  }, [channelProducts, selectedChannel]);

  // Filter listings
  const filteredListings = groupedListingsList.filter((item) => {
    const term = (searchTerm || '').trim().toLowerCase();
    const matchesSearch = 
      !term ||
      item.title?.toLowerCase().includes(term) ||
      item.sku?.toLowerCase().includes(term) ||
      (item.brand && item.brand.toLowerCase().includes(term));
    
    const statusLower = item.status?.toLowerCase();
    const isSold =
      statusLower === 'sold' ||
      Boolean(item.soldOn) ||
      Boolean(item.soldPlatform) ||
      (item.errorMessage && item.errorMessage.toLowerCase().startsWith('sold on'));
    const pCount = getActivePlatformCount(item);

    let matchesStatus = false;
    if (statusFilter === 'all') {
      matchesStatus = true;
    } else if (statusFilter === 'active') {
      matchesStatus = !isSold && (pCount > 0 || statusLower === 'active' || statusLower === 'published');
    } else if (statusFilter === 'sold') {
      matchesStatus = isSold;
    } else if (statusFilter === 'delisted') {
      matchesStatus = !isSold && statusLower === 'delisted';
    } else if (statusFilter === 'draft') {
      matchesStatus = !isSold && (statusLower === 'draft' || (!statusLower && pCount === 0));
    } else if (statusFilter === 'error' || statusFilter === 'failed') {
      matchesStatus = !isSold && (statusLower === 'failed' || statusLower === 'error');
    } else if (statusFilter === 'favorite') {
      matchesStatus = favoriteIds.includes(item._id) || item.isFavorite;
    } else if (statusFilter === 'unlisted') {
      matchesStatus = !isSold && pCount === 0 && statusLower !== 'active' && statusLower !== 'published';
    }

    // Listed On platforms filter
    let matchesListedOn = true;
    if (filterListedOn.length > 0) {
      matchesListedOn = Object.values(item.listingsMap || {}).some(sub => 
        filterListedOn.includes(sub.platform?.toLowerCase()) && 
        (sub.status?.toLowerCase() === 'active' || sub.status?.toLowerCase() === 'published')
      ) || filterListedOn.some(p => {
        const rawSt = item[`${p}Status`]?.toLowerCase();
        const liveId = item[`${p}ListingId`];
        return (rawSt === 'published' || rawSt === 'active') && liveId && liveId !== '-';
      });
    }

    // No Listed On platforms filter
    let matchesNoListedOn = true;
    if (filterNoListedOn.length > 0) {
      matchesNoListedOn = filterNoListedOn.every(p => {
        const pSub = item.listingsMap?.[p];
        const rawSt = pSub ? pSub.status?.toLowerCase() : item[`${p}Status`]?.toLowerCase();
        const liveId = item[`${p}ListingId`] || pSub?.listingId;
        const isLiveOnP = (rawSt === 'published' || rawSt === 'active') && liveId && liveId !== '-';
        return !isLiveOnP;
      });
    }

    return matchesSearch && matchesStatus && matchesListedOn && matchesNoListedOn;
  });

  // Sort listings
  const sortedListings = [...filteredListings].sort((a, b) => {
    const timeA = new Date(a.updatedAt || a.updated_at || a.createdAt || a.created_at || 0).getTime();
    const timeB = new Date(b.updatedAt || b.updated_at || b.createdAt || b.created_at || 0).getTime();
    const countA = getSortPlatformCount(a);
    const countB = getSortPlatformCount(b);
    const priceA = parseFloat(a.price) || 0;
    const priceB = parseFloat(b.price) || 0;

    switch (sortOption) {
      case 'crosslisted-desc':
        return (countB - countA) || (timeB - timeA);
      case 'crosslisted-asc':
        return (countA - countB) || (timeB - timeA);
      case 'newest':
        return timeB - timeA;
      case 'oldest':
        return timeA - timeB;
      case 'price-desc':
        return priceB - priceA;
      case 'price-asc':
        return priceA - priceB;
      case 'title-asc':
        return (a.title || '').localeCompare(b.title || '');
      case 'title-desc':
        return (b.title || '').localeCompare(a.title || '');
      case 'qty-desc':
        return (b.quantity || 0) - (a.quantity || 0);
      case 'qty-asc':
        return (a.quantity || 0) - (b.quantity || 0);
      default:
        return (countB - countA) || (timeB - timeA);
    }
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
        const normalizedStatus = details.status; // 'active' | 'delisted' | 'draft' | 'error'
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

  // Filter & Sort Sold Tracker Orders
  const filteredAndSortedSoldOrders = React.useMemo(() => {
    let list = [...soldOrders];

    if (soldPlatformFilter !== 'all') {
      list = list.filter(o => (o.platform || 'ebay').toLowerCase() === soldPlatformFilter.toLowerCase());
    }

    if (soldSearchTerm.trim()) {
      const q = soldSearchTerm.toLowerCase();
      list = list.filter(o => {
        const titleMatch = o.lineItems?.some(li => li.title?.toLowerCase().includes(q)) || o.listingId?.title?.toLowerCase().includes(q);
        const skuMatch = o.lineItems?.some(li => li.sku?.toLowerCase().includes(q)) || o.listingId?.sku?.toLowerCase().includes(q);
        const orderIdMatch = String(o.orderId || '').toLowerCase().includes(q) || String(o.ebayOrderId || '').toLowerCase().includes(q);
        const buyerMatch = String(o.buyerUsername || '').toLowerCase().includes(q);
        return titleMatch || skuMatch || orderIdMatch || buyerMatch;
      });
    }

    list.sort((a, b) => {
      const dateA = new Date(a.createdDate || a.createdAt || 0).getTime();
      const dateB = new Date(b.createdDate || b.createdAt || 0).getTime();
      if (soldSortOption === 'newest') return dateB - dateA;
      if (soldSortOption === 'oldest') return dateA - dateB;
      if (soldSortOption === 'price-desc') return (b.totalAmount || 0) - (a.totalAmount || 0);
      if (soldSortOption === 'price-asc') return (a.totalAmount || 0) - (b.totalAmount || 0);
      return dateB - dateA;
    });

    return list;
  }, [soldOrders, soldPlatformFilter, soldSearchTerm, soldSortOption]);

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

  // Sold
  const totalSoldPages = Math.ceil(filteredAndSortedSoldOrders.length / soldItemsPerPage) || 1;
  const activeSoldPage = Math.min(soldCurrentPage, totalSoldPages);
  const startSoldIndex = (activeSoldPage - 1) * soldItemsPerPage;
  const endSoldIndex = Math.min(startSoldIndex + soldItemsPerPage, filteredAndSortedSoldOrders.length);
  const paginatedSoldOrders = filteredAndSortedSoldOrders.slice(startSoldIndex, endSoldIndex);

  // Generalised Pagination Bounds for UI display
  const displayedTotalPages = activeTab === 'local' ? totalPages : (activeTab === 'channel' ? totalChannelPages : totalSoldPages);
  const displayedActivePage = activeTab === 'local' ? activePage : (activeTab === 'channel' ? activeChannelPage : activeSoldPage);
  const displayedStartIndex = activeTab === 'local' ? startIndex : (activeTab === 'channel' ? startChannelIndex : startSoldIndex);
  const displayedEndIndex = activeTab === 'local' ? endIndex : (activeTab === 'channel' ? endChannelIndex : endSoldIndex);
  const displayedTotalCount = activeTab === 'local' ? sortedListings.length : (activeTab === 'channel' ? filteredAndSortedChannelProducts.length : filteredAndSortedSoldOrders.length);

  // Multi-select Bulk Actions State
  const [selectedListingIds, setSelectedListingIds] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDelisting, setBulkDelisting] = useState(false);

  // Reset currentPage to 1 when filters, tabs, or items per page change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedListingIds([]);
  }, [searchTerm, statusFilter, channelStatusFilter, channelSortOption, itemsPerPage, activeTab, selectedChannel, sortOption, filterListedOn, filterNoListedOn]);

  useEffect(() => {
    setSelectedListingIds([]);
  }, [currentPage]);

  const getChannelItemKey = (product, index) => {
    const details = getProductDetails(product);
    return product._id || product.id || details.liveId || `${selectedChannel}-${details.sku || index}`;
  };

  const currentDisplayedPageIds = activeTab === 'local'
    ? paginatedListings.map(item => item._id)
    : paginatedChannelProducts.map((p, i) => getChannelItemKey(p, i));

  const isAllSelected = currentDisplayedPageIds.length > 0 && currentDisplayedPageIds.every(id => selectedListingIds.includes(id));

  const handleToggleSelectItem = (itemId, e) => {
    if (e) {
      e.stopPropagation();
    }
    setSelectedListingIds(prev =>
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  };

  const handleToggleSelectAll = (e) => {
    if (e) {
      e.stopPropagation();
    }
    if (isAllSelected) {
      setSelectedListingIds(prev => prev.filter(id => !currentDisplayedPageIds.includes(id)));
    } else {
      setSelectedListingIds(prev => Array.from(new Set([...prev, ...currentDisplayedPageIds])));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedListingIds.length === 0) return;

    const count = selectedListingIds.length;

    if (activeTab === 'channel') {
      const confirmDelete = await confirm(
        `Are you sure you want to delete/end all ${count} selected item${count > 1 ? 's' : ''} from ${getChannelDisplayName(selectedChannel)}?`,
        {
          title: `Delete ${count} Selected Item${count > 1 ? 's' : ''} from ${getChannelDisplayName(selectedChannel)}`,
          destructive: true
        }
      );
      if (!confirmDelete) return;

      setBulkDeleting(true);
      toast.info(`Deleting selected items from ${getChannelDisplayName(selectedChannel)}...`);
      try {
        const promises = paginatedChannelProducts
          .filter((p, i) => selectedListingIds.includes(getChannelItemKey(p, i)))
          .map(async (product) => {
            const details = getProductDetails(product);
            const targetItem = buildChannelDropdownItem(product, details, selectedChannel);
            if (targetItem._id && !String(targetItem._id).startsWith('mock-')) {
              return listingService.deletePlatform(targetItem._id, selectedChannel, false);
            }
          });
        await Promise.allSettled(promises);
        toast.success(`Deleted selected items from ${getChannelDisplayName(selectedChannel)}!`);
        setSelectedListingIds([]);
        fetchChannelInventory();
      } catch (err) {
        console.error('Error deleting channel items:', err);
        toast.error('Failed to delete selected items.');
      } finally {
        setBulkDeleting(false);
      }
      return;
    }

    const confirmDelete = await confirm(
      `Are you sure you want to delete all ${count} selected item${count > 1 ? 's' : ''} from the database? This cannot be undone.`,
      {
        title: `Delete ${count} Selected Item${count > 1 ? 's' : ''}`,
        destructive: true
      }
    );
    if (!confirmDelete) return;

    setBulkDeleting(true);
    toast.info(`Deleting ${count} items from database...`);

    try {
      const selectedItems = listings.filter(l => selectedListingIds.includes(l._id));
      const allTargetIds = new Set();

      selectedListingIds.forEach(id => allTargetIds.add(id));
      selectedItems.forEach(item => {
        if (Array.isArray(item.allIds)) {
          item.allIds.forEach(id => allTargetIds.add(id));
        }
        if (item.listingsMap && typeof item.listingsMap === 'object') {
          Object.values(item.listingsMap).forEach(sub => {
            if (sub?._id) allTargetIds.add(sub._id);
          });
        }
      });

      const deletePromises = Array.from(allTargetIds).map(id => {
        if (String(id).startsWith('mock-')) return Promise.resolve();
        return listingService.delete(id);
      });

      await Promise.allSettled(deletePromises);
      toast.success(`Successfully deleted ${count} listing${count > 1 ? 's' : ''}!`);
      setSelectedListingIds([]);
      fetchListings();
    } catch (err) {
      console.error('Error deleting selected listings:', err);
      toast.error('Failed to delete selected listings.');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleBulkDelist = async () => {
    if (selectedListingIds.length === 0) return;

    const count = selectedListingIds.length;

    if (activeTab === 'channel') {
      const confirmDelist = await confirm(
        `Are you sure you want to delist all ${count} selected item${count > 1 ? 's' : ''} from ${getChannelDisplayName(selectedChannel)}?`,
        {
          title: `Delist ${count} Selected Item${count > 1 ? 's' : ''} from ${getChannelDisplayName(selectedChannel)}`,
          destructive: true
        }
      );
      if (!confirmDelist) return;

      setBulkDelisting(true);
      toast.info(`Delisting selected items from ${getChannelDisplayName(selectedChannel)}...`);
      try {
        const promises = paginatedChannelProducts
          .filter((p, i) => selectedListingIds.includes(getChannelItemKey(p, i)))
          .map(async (product) => {
            const details = getProductDetails(product);
            const targetItem = buildChannelDropdownItem(product, details, selectedChannel);
            if (targetItem._id && !String(targetItem._id).startsWith('mock-')) {
              return listingService.delist(targetItem._id, selectedChannel);
            }
          });
        await Promise.allSettled(promises);
        toast.success(`Delisted selected items from ${getChannelDisplayName(selectedChannel)}!`);
        setSelectedListingIds([]);
        fetchChannelInventory();
      } catch (err) {
        console.error('Error delisting channel items:', err);
        toast.error('Failed to delist selected items.');
      } finally {
        setBulkDelisting(false);
      }
      return;
    }

    const confirmDelist = await confirm(
      `Are you sure you want to delist all ${count} selected item${count > 1 ? 's' : ''} from ALL active marketplaces (eBay, Poshmark, Mercari, Etsy, Amazon)?`,
      {
        title: `Delist ${count} Selected Item${count > 1 ? 's' : ''}`,
        destructive: true
      }
    );
    if (!confirmDelist) return;

    setBulkDelisting(true);
    toast.info(`Delisting ${count} items from all marketplaces...`);

    try {
      const selectedItems = listings.filter(l => selectedListingIds.includes(l._id));
      const platforms = ['ebay', 'poshmark', 'mercari', 'etsy', 'amazon'];
      const delistPromises = [];

      selectedItems.forEach(item => {
        platforms.forEach(plat => {
          const platSpecific = item.listingsMap ? item.listingsMap[plat] : null;
          const rawSt = (platSpecific ? platSpecific.status : item[`${plat}Status`])?.toLowerCase();
          const liveId = item[`${plat}ListingId`] || platSpecific?.listingId || item.platformData?.[plat]?.liveId;
          const isLive = (rawSt === 'published' || rawSt === 'active') || (liveId && liveId !== '-');
          if (isLive) {
            const targetId = platSpecific?._id || item._id;
            if (!String(targetId).startsWith('mock-')) {
              delistPromises.push(listingService.delist(targetId, plat).catch(e => console.warn(`Delist failed on ${plat}:`, e)));
            }
          }
        });
      });

      await Promise.allSettled(delistPromises);
      toast.success(`Delist requests sent for ${count} listings!`);
      setSelectedListingIds([]);
      fetchListings();
    } catch (err) {
      console.error('Error delisting selected items:', err);
      toast.error('Failed to delist selected items.');
    } finally {
      setBulkDelisting(false);
    }
  };

  // Smart Sync & Import Modal Handlers
  const handleOpenImportModal = async () => {
    setImportModalOpen(true);
    setImportViewMode('overview');
    setImportLoading(true);
    setImportSearchTerm('');
    setImportFilterTab('all');
    try {
      const res = await listingService.getActiveChannelPreview();
      if (res.data.success) {
        const groups = res.data.groups || [];
        setImportGroups(groups);
        setImportBreakdown(res.data.breakdown || null);

        const initialGroupIds = {};
        const initialPlatforms = {};

        groups.forEach((grp) => {
          initialGroupIds[grp.groupId] = !grp.alreadyInLocal;
          initialPlatforms[grp.groupId] = {};
          ['ebay', 'poshmark', 'mercari', /* 'depop', */ 'etsy', 'amazon'].forEach((plat) => {
            if (grp.channels?.[plat]) {
              initialPlatforms[grp.groupId][plat] = !grp.channels[plat].alreadyInLocal;
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

  const handleExecuteImportAll = async () => {
    const unlinkedGroups = importGroups.filter(g => !g.alreadyInLocal);
    if (unlinkedGroups.length === 0) {
      toast.info('All active channel listings are already synced to your Local Database!');
      return;
    }

    const selectedPayload = [];
    for (const group of unlinkedGroups) {
      const activeSelectedChannels = {};
      let hasAny = false;

      for (const plat of ['ebay', 'poshmark', 'mercari', /* 'depop', */ 'etsy', 'amazon']) {
        if (group.channels?.[plat] && !group.channels[plat].alreadyInLocal) {
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
      toast.info('No new active channel listings found to sync.');
      return;
    }

    setImportSubmitting(true);
    try {
      const res = await listingService.importActiveChannels({ items: selectedPayload });
      if (res.data.success) {
        toast.success(res.data.message || `Successfully synced & merged ${selectedPayload.length} items to Local Database!`);
        setImportModalOpen(false);
        await fetchListings();
        setActiveTab('local');
        localStorage.setItem('elister_active_listings_tab', 'local');
      } else {
        toast.error(res.data.message || 'Failed to sync items.');
      }
    } catch (err) {
      console.error('Error syncing active channels:', err);
      toast.error(err.response?.data?.message || 'Failed to sync items.');
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

  // Helper for computing last updated string from real timestamp
  const formatTimeAgo = (dateVal) => {
    if (!dateVal) return 'Recently';
    let d;
    if (dateVal instanceof Date) {
      d = dateVal;
    } else if (typeof dateVal === 'number') {
      d = dateVal < 1e11 ? new Date(dateVal * 1000) : new Date(dateVal);
    } else if (typeof dateVal === 'string') {
      const parsedNum = Number(dateVal);
      if (!isNaN(parsedNum) && dateVal.trim() !== '' && !dateVal.includes('-') && !dateVal.includes('T')) {
        d = parsedNum < 1e11 ? new Date(parsedNum * 1000) : new Date(parsedNum);
      } else {
        d = new Date(dateVal);
      }
    } else {
      d = new Date(dateVal);
    }

    if (isNaN(d.getTime())) return 'Recently';

    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);

    if (diffSeconds < 0 || diffSeconds < 45) return 'Just now';
    if (diffSeconds < 90) return '1m ago';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 7200) return '1h ago';
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
    if (diffSeconds < 172800) return '1d ago';
    if (diffSeconds < 2592000) return `${Math.floor(diffSeconds / 86400)}d ago`;
    if (diffSeconds < 5184000) return '1mo ago';
    if (diffSeconds < 31536000) return `${Math.floor(diffSeconds / 2592000)}mo ago`;
    return `${Math.floor(diffSeconds / 31536000)}y ago`;
  };

  // Active Dropdown states
  const [activeListedDropdown, setActiveListedDropdown] = useState(null);
  const [activeMasterDropdown, setActiveMasterDropdown] = useState(null);

  useEffect(() => {
    const handleClickOutside = () => {
      setActiveListedDropdown(null);
      setActiveMasterDropdown(null);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  // Close floating dropdowns if the page scrolls
  useEffect(() => {
    if (!activeListedDropdown && !activeMasterDropdown) return;
    const closeOnScroll = () => {
      setActiveListedDropdown(null);
      setActiveMasterDropdown(null);
    };
    window.addEventListener('scroll', closeOnScroll, true);
    window.addEventListener('resize', closeOnScroll);
    return () => {
      window.removeEventListener('scroll', closeOnScroll, true);
      window.removeEventListener('resize', closeOnScroll);
    };
  }, [activeListedDropdown, activeMasterDropdown]);

  const handleDelistAllPlatforms = async (item) => {
    setActiveMasterDropdown(null);
    setActiveListedDropdown(null);

    if (String(item._id).startsWith('mock-')) {
      toast.info('Mock item cannot be delisted from real platforms.');
      return;
    }

    const confirmDelist = await confirm(
      `Are you sure you want to delist "${item.title}" from ALL active marketplaces (eBay, Poshmark, Mercari, Etsy, Amazon)? This will end the active listings on all connected platforms.`,
      {
        title: 'Delist from ALL Marketplaces',
        destructive: true
      }
    );
    if (!confirmDelist) return;

    toast.info("Delisting from all marketplaces...");
    try {
      const res = await listingService.delistAll(item._id);
      if (res.data?.success) {
        toast.success(`Successfully delisted "${item.title}" from all marketplaces!`);
      } else {
        toast.success("Successfully sent delist requests to all marketplaces!");
      }
      await fetchListings();
      if (typeof fetchChannelInventory === 'function') {
        fetchChannelInventory();
      }
    } catch (err) {
      console.warn("Unified delist-all failed, falling back to sequential delist:", err);
      try {
        const platformsToDelist = ['ebay', 'poshmark', 'mercari', 'etsy', 'amazon'];
        for (const plat of platformsToDelist) {
          const platSpecific = item.listingsMap ? item.listingsMap[plat] : null;
          const rawSt = (platSpecific ? platSpecific.status : item[`${plat}Status`])?.toLowerCase();
          const liveId = item[`${plat}ListingId`] || platSpecific?.listingId || item.platformData?.[plat]?.liveId;
          const isLive = (rawSt === 'published' || rawSt === 'active') || (liveId && liveId !== '-');
          if (isLive) {
            try {
              await listingService.delist(platSpecific?._id || item._id, plat);
            } catch (e) {
              console.warn(`Delisting on ${plat} failed:`, e);
            }
          }
        }
        toast.success("Successfully delisted from active marketplaces!");
        await fetchListings();
        if (typeof fetchChannelInventory === 'function') {
          fetchChannelInventory();
        }
      } catch (seqErr) {
        console.error("Error delisting from all:", seqErr);
        toast.error(err.response?.data?.message || "Failed to delist from all marketplaces.");
      }
    }
  };

  const renderMasterPortalDropdown = () => {
    if (!activeMasterDropdown) return null;
    const { item, openUpward, left, verticalOffset } = activeMasterDropdown;
    if (!item) return null;

    const style = {
      position: 'fixed',
      left: `${left}px`,
      zIndex: 9999,
      width: '210px',
    };
    if (openUpward) {
      style.bottom = `${verticalOffset}px`;
    } else {
      style.top = `${verticalOffset}px`;
    }

    return createPortal(
      <div
        style={style}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl border border-slate-150 p-1.5 space-y-0.5 animate-in fade-in zoom-in-95 duration-150"
      >
        <button
          type="button"
          onClick={() => {
            setActiveMasterDropdown(null);
            setSelectedListing(item);
            setSelectedPlatform(null);
            setIsEditMode(true);
            setModalOpen(true);
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-700 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer text-left"
        >
          <Edit size={13} className="text-slate-400" />
          <span>Edit Listing</span>
        </button>

        <div className="h-px bg-slate-100 my-1" />

        <button
          type="button"
          onClick={() => handleDelistAllPlatforms(item)}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-700 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer text-left"
        >
          <XCircle size={13} className="text-slate-400" />
          <span>Delist from All Marketplaces</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveMasterDropdown(null);
            handleDelete(item);
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-700 hover:text-rose-600 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer text-left"
        >
          <Trash2 size={13} className="text-slate-400" />
          <span>Delete Item</span>
        </button>
      </div>,
      document.body
    );
  };

  const getListingUrl = (item, platformName, checkId) => {
    let directUrl = item[`${platformName}Url`];
    const platformSpecificItem = item.listingsMap ? item.listingsMap[platformName] : null;
    if (!directUrl && platformSpecificItem && platformSpecificItem.url) directUrl = platformSpecificItem.url;
    if (directUrl) {
      if (platformName === 'mercari') return directUrl.replace('mercari.com/item/', 'mercari.com/us/item/');
      return directUrl;
    }

    if (platformName === 'depop') {
      return `https://www.depop.com/products/${checkId}`;
    } else if (platformName === 'ebay') {
      return `https://www.ebay.com/itm/${checkId}`;
    } else if (platformName === 'poshmark') {
      return `https://poshmark.com/listing/${checkId}`;
    } else if (platformName === 'mercari') {
      return `https://www.mercari.com/us/item/${checkId}/`;
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
    setSortOption('crosslisted-desc');
    setTempSortOption('crosslisted-desc');
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
    let isSold = false;

    const itemStatusLower = item.status?.toLowerCase();
    const isMasterSold = itemStatusLower === 'sold';
    const isSoldPlatform = isMasterSold && (
      rawPlatformStatus === 'sold' ||
      item.soldOn === platformName ||
      item.soldPlatform === platformName ||
      (item.errorMessage && item.errorMessage.toLowerCase().includes(platformName.toLowerCase()))
    );

    if (rawPlatformStatus === 'sold' || isSoldPlatform) {
      isSold = true;
    } else if (rawPlatformStatus === 'none' || rawPlatformStatus === 'unlisted') {
      // Explicitly Not Listed on this platform
      isListed = false;
      isDraft = false;
      isDelisted = false;
      isFailed = false;
      isSold = false;
    } else if (rawPlatformStatus === 'delisted' || (isMasterSold && (item[`${platformName}ListingId`] || platformSpecificItem))) {
      isDelisted = true;
    } else if (rawPlatformStatus === 'published' || rawPlatformStatus === 'active') {
      isListed = true;
    } else if (rawPlatformStatus === 'draft') {
      isDraft = true;
    } else if (rawPlatformStatus === 'failed') {
      isFailed = true;
    } else if (!rawPlatformStatus) {
      // Fallbacks only if rawPlatformStatus is undefined
      const specificStatus = platformSpecificItem?.status?.toLowerCase();
      if (specificStatus && specificStatus !== 'none' && specificStatus !== 'unlisted') {
        if (specificStatus === 'sold') {
          isSold = true;
        } else if (specificStatus === 'published' || specificStatus === 'active') {
          isListed = true;
        } else if (specificStatus === 'draft') {
          isDraft = true;
        } else if (specificStatus === 'delisted') {
          isDelisted = true;
        } else if (specificStatus === 'failed') {
          isFailed = true;
        }
      } else if (item.platform === platformName) {
        if (itemStatusLower === 'sold') {
          isSold = true;
        } else if (itemStatusLower === 'active' || itemStatusLower === 'published') {
          isListed = true;
        } else if (itemStatusLower === 'draft') {
          isDraft = true;
        } else if (itemStatusLower === 'delisted') {
          isDelisted = true;
        } else if (itemStatusLower === 'failed') {
          isFailed = true;
        }
      }
    }

    // Resolved platform listing id
    const resolvedCheckId = checkId || getPlatformLiveId(item, platformName);

    // Ensure listed items have a valid id (if not mock)
    if (isListed && (!resolvedCheckId || resolvedCheckId === '-')) {
      const realId = resolvedCheckId || item[`${platformName}ListingId`] || platformSpecificItem?.listingId;
      if (!realId || realId === '-') {
        isListed = false;
      }
    }

    const isDropdownOpen = activeListedDropdown?.itemId === item._id && activeListedDropdown?.platform === platformName;
    const isBeingDragged = draggedChannel?.sourceListingId === item._id && draggedChannel?.platform === platformName;
    const isDropTarget = activeTab === 'local' && draggedChannel && draggedChannel.platform === platformName && draggedChannel.sourceListingId !== item._id;
    const isHovered = dragOverTarget === `${item._id}-${platformName}`;

    // Platform-specific price & image
    let platformPrice = null;
    if (item.platformData?.[platformName]?.price !== undefined && item.platformData[platformName]?.price !== null) {
      platformPrice = item.platformData[platformName].price;
    } else if (platformSpecificItem?.platformData?.[platformName]?.price !== undefined && platformSpecificItem.platformData[platformName]?.price !== null) {
      platformPrice = platformSpecificItem.platformData[platformName].price;
    } else if (item[`${platformName}Price`] !== undefined && item[`${platformName}Price`] !== null && item[`${platformName}Price`] !== '') {
      platformPrice = item[`${platformName}Price`];
    } else if (platformSpecificItem?.[`${platformName}Price`] !== undefined && platformSpecificItem[`${platformName}Price`] !== null && platformSpecificItem[`${platformName}Price`] !== '') {
      platformPrice = platformSpecificItem[`${platformName}Price`];
    } else if (platformSpecificItem && platformSpecificItem.platform === platformName && platformSpecificItem.price !== undefined && platformSpecificItem.price !== null) {
      platformPrice = platformSpecificItem.price;
    } else {
      platformPrice = item.price;
    }

    const numPrice = typeof platformPrice === 'number' ? platformPrice : parseFloat(platformPrice);
    const formattedPrice = (!isNaN(numPrice) && numPrice > 0) ? `$${numPrice.toFixed(2)}` : (item.price ? `$${parseFloat(item.price || 0).toFixed(2)}` : '$0.00');

    const platformImg = 
      item.platformData?.[platformName]?.thumbnail || 
      (item.platformData?.[platformName]?.images && item.platformData[platformName].images[0]) ||
      platformSpecificItem?.platformData?.[platformName]?.thumbnail ||
      (platformSpecificItem?.platformData?.[platformName]?.images && platformSpecificItem.platformData[platformName].images[0]) ||
      (platformSpecificItem && platformSpecificItem.platform === platformName && (platformSpecificItem.thumbnail || (platformSpecificItem.images && platformSpecificItem.images[0]))) ||
      platformSpecificItem?.thumbnail || 
      (platformSpecificItem?.images && platformSpecificItem.images[0]) || 
      item.thumbnail || 
      (item.images && item.images[0]) || 
      null;
    const liveUrl = getListingUrl(item, platformName, resolvedCheckId);

    // Dropdown Portal Menu Component
    const renderPortalDropdown = () => (
      activeListedDropdown && activeListedDropdown.itemId === item._id && activeListedDropdown.platform === platformName && createPortal(
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: activeListedDropdown.left,
            [activeListedDropdown.openUpward ? 'bottom' : 'top']: activeListedDropdown.verticalOffset,
            width: 190,
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
              className="w-full px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 flex items-center gap-2 transition-colors cursor-pointer text-left border-t border-slate-100"
            >
              <XCircle size={13} className="text-slate-400 shrink-0" />
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
      )
    );

    // ==========================================
    // 1. LOCAL DATABASE TAB: MATRIX CARD LAYOUT
    // ==========================================
    if (activeTab === 'local') {
      if (isListed || isDelisted || isDraft || isFailed || isSold) {
        return (
          <div
            draggable={true}
            onDragStart={(e) => {
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
            className={`relative bg-white border border-slate-200/90 rounded-2xl p-2 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all group/card flex items-center justify-between gap-2 w-full min-w-[136px] max-w-[170px] sm:min-w-[145px] h-[98px] sm:h-[104px] select-none cursor-grab active:cursor-grabbing shrink-0 ${isBeingDragged ? 'opacity-40 scale-95' : ''}`}
          >
            {/* Left Side: Clean Marketplace Image Thumbnail (No colored border, No overlaid badge) */}
            <div 
              onClick={(e) => {
                e.stopPropagation();
                handleOpenPreview(item, platformName);
              }}
              title={`Click to preview on ${getChannelDisplayName(platformName)}`}
              className="w-[60px] sm:w-[68px] h-[82px] sm:h-[88px] rounded-xl overflow-hidden shrink-0 bg-slate-50 flex items-center justify-center border border-slate-200/80 shadow-2xs group-hover/card:scale-105 transition-transform cursor-pointer"
            >
              {platformImg ? (
                <img src={platformImg} alt="" className="w-full h-full object-cover" />
              ) : (
                <ImageOff size={16} className="text-slate-300" />
              )}
            </div>

            {/* 3-dots Menu Button at Top-Right Corner */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (isDropdownOpen) {
                  setActiveListedDropdown(null);
                  return;
                }
                const rect = e.currentTarget.getBoundingClientRect();
                const openUpward = rect.bottom > window.innerHeight * 0.6;
                const menuWidth = 190;
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
              className="absolute top-1.5 right-1.5 w-5 h-5 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer z-10"
              title="Marketplace options"
            >
              <MoreVertical size={13} className="stroke-[2.2]" />
            </button>

            {/* Right Side: Centered Status on Top, Price in Center, Action/Open at Bottom */}
            <div className="flex flex-col justify-between items-center flex-1 min-w-0 h-full py-1 text-center">
              {/* Top: Status Text (Centered) */}
              <div className="w-full text-center px-4 truncate">
                {isSold ? (
                  <span className="text-[11px] font-extrabold text-purple-700 leading-none">Sold</span>
                ) : isListed ? (
                  <span className="text-[11px] font-extrabold text-emerald-600 leading-none">Listed</span>
                ) : isDelisted ? (
                  <span className="text-[11px] font-extrabold text-slate-500 leading-none">Delisted</span>
                ) : isDraft ? (
                  <span className="text-[11px] font-extrabold text-amber-600 leading-none">Draft</span>
                ) : isFailed ? (
                  <span className="text-[11px] font-extrabold text-rose-600 leading-none">Error</span>
                ) : null}
              </div>

              {/* Center: Clean Price */}
              <div className="text-[13px] font-extrabold text-slate-800 tracking-tight text-center my-auto">
                {formattedPrice}
              </div>

              {/* Bottom: Action / Link */}
              <div className="w-full text-center">
                {liveUrl && liveUrl !== '#' && isListed ? (
                  <a
                    href={liveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center justify-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors group-hover/card:underline"
                  >
                    <span>Open</span>
                    <ExternalLink size={10} className="stroke-[2.2]" />
                  </a>
                ) : isSold ? (
                  <span className="text-[10px] font-bold text-purple-700">Sold Out</span>
                ) : isDraft ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenCrosslisting(platformSpecificItem || item, platformName);
                    }}
                    className="text-[10px] font-bold text-amber-700 hover:text-amber-900 hover:underline cursor-pointer"
                  >
                    Edit Draft
                  </button>
                ) : isFailed ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRelistItemDirect(item, platformName);
                    }}
                    className="text-[10px] font-bold text-rose-600 hover:text-rose-800 hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    <RefreshCw size={9} /> Retry
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRelistItemDirect(item, platformName);
                    }}
                    className="text-[10px] font-bold text-slate-600 hover:text-slate-900 hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    <RefreshCw size={9} /> Relist
                  </button>
                )}
              </div>
            </div>

            {/* Dropdown Portal */}
            {renderPortalDropdown()}
          </div>
        );
      } else {
        // Not Listed Matrix Card (Dashed Placeholder matching brand theme)
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
            className={`relative border-2 border-dashed border-indigo-200 hover:border-indigo-400 rounded-2xl p-2 bg-indigo-50/20 hover:bg-indigo-50/50 transition-all cursor-pointer group flex flex-col items-center justify-center text-center w-full min-w-[136px] max-w-[170px] sm:min-w-[145px] h-[98px] sm:h-[104px] select-none shrink-0 ${
              isDropTarget
                ? isHovered
                  ? 'scale-105 ring-2 ring-indigo-500 rounded-2xl bg-indigo-100/80 shadow-md'
                  : 'ring-2 ring-dashed ring-indigo-400 rounded-2xl bg-indigo-50/60 animate-pulse'
                : 'hover:scale-[1.02]'
            }`}
            title={isDropTarget ? "Drop here to merge channel into this item!" : `Click to list on ${getChannelDisplayName(platformName)}`}
          >
            <Plus size={20} className="stroke-[2.5] text-indigo-600 group-hover:scale-110 transition-transform mb-1 shrink-0" />
            <span className="text-[11px] font-bold text-indigo-700 leading-tight select-none">
              {isDropTarget ? (isHovered ? 'Drop Here' : 'Drop to Merge') : (
                <>
                  List on<br />
                  {getChannelDisplayName(platformName)}
                </>
              )}
            </span>
          </div>
        );
      }
    }

    // ==============================================
    // 2. CHANNEL INVENTORY TAB: CIRCLE LOGO + STATUS DROPDOWN
    // ==============================================
    return (
      <div className="relative flex flex-col items-center justify-center py-1 select-none">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (isDropdownOpen) {
              setActiveListedDropdown(null);
              return;
            }
            const rect = e.currentTarget.getBoundingClientRect();
            const openUpward = rect.bottom > window.innerHeight * 0.6;
            const menuWidth = 190;
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
          className="flex flex-col items-center justify-center cursor-pointer group hover:scale-105 transition-all select-none"
          title={`${getChannelDisplayName(platformName)} options`}
        >
          {/* Circular Platform Logo */}
          <div className="relative w-8 h-8 rounded-full border border-slate-200 bg-white group-hover:border-indigo-300 flex items-center justify-center shadow-xs shrink-0 transition-all">
            <img src={logoSrc} className="w-5 h-5 object-contain" alt={platformName} />
            {isListed && (
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-white"></span>
              </span>
            )}
          </div>

          {/* Real Status Text below circle logo */}
          <div className="mt-1 flex items-center gap-0.5">
            {isSold ? (
              <span className="text-[10px] font-black text-purple-600 flex items-center gap-0.5">
                Sold <ChevronDown size={10} className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </span>
            ) : isListed ? (
              <span className="text-[10px] font-black text-emerald-600 flex items-center gap-0.5">
                Listed <ChevronDown size={10} className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </span>
            ) : isDraft ? (
              <span className="text-[10px] font-black text-slate-500 flex items-center gap-0.5">
                Draft <ChevronDown size={10} className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </span>
            ) : isDelisted ? (
              <span className="text-[10px] font-black text-slate-500 flex items-center gap-0.5">
                Delisted <ChevronDown size={10} className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </span>
            ) : (
              <span className="text-[10px] font-black text-slate-500 flex items-center gap-0.5">
                Inactive <ChevronDown size={10} className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </span>
            )}
          </div>
        </button>

        {renderPortalDropdown()}
      </div>
    );
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

  return (
    <div className="space-y-6">

      {/* TABS SWITCHER & TOP ACTIONS BAR */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3.5 bg-white p-3.5 sm:p-4 rounded-3xl border border-slate-100 shadow-sm">
        {/* Left Side: Tabs Switcher */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1 w-full md:w-auto overflow-x-auto no-scrollbar">
          <button
            onClick={() => {
              setActiveTab('local');
              localStorage.setItem('elister_active_listings_tab', 'local');
              fetchListings(true);
            }}
            className={`flex-1 md:flex-none px-3.5 sm:px-5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap text-center ${
              activeTab === 'local'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Master Cross-Listing
          </button>
          <button
            onClick={() => {
              setActiveTab('channel');
              localStorage.setItem('elister_active_listings_tab', 'channel');
              fetchChannelInventory(true);
            }}
            className={`flex-1 md:flex-none px-3.5 sm:px-5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap text-center ${
              activeTab === 'channel'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            All Platform Inventory
          </button>
          <button
            onClick={() => {
              setActiveTab('sold');
              localStorage.setItem('elister_active_listings_tab', 'sold');
              fetchSoldOrders(true);
            }}
            className={`flex-1 md:flex-none px-3.5 sm:px-5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap text-center ${
              activeTab === 'sold'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Sold Tracker
          </button>
        </div>

        {/* Right Side: Channel Switcher (if channel tab) + Universal Actions (Smart Merge & Import) */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-stretch sm:justify-end flex-wrap sm:flex-nowrap">
          {activeTab === 'channel' && (
            <>
              {/* Channel Switcher Pills */}
              <div className="flex bg-slate-100 p-1 rounded-xl gap-1 w-full sm:w-auto overflow-x-auto no-scrollbar">
                {['ebay', 'etsy', 'poshmark', 'mercari', 'amazon'].map((ch) => (
                  <button
                    key={ch}
                    onClick={() => {
                      setSelectedChannel(ch);
                      localStorage.setItem('elister_selected_listings_channel', ch);
                    }}
                    className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer whitespace-nowrap ${
                      selectedChannel === ch
                        ? 'bg-white text-indigo-600 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {getChannelDisplayName(ch)}
                  </button>
                ))}
              </div>

              {/* Sync Button */}
              <Button
                onClick={handleSyncInventory}
                disabled={syncing || !isChannelConnected()}
                size="sm"
                icon={<RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />}
                className="flex-1 sm:flex-none"
              >
                {syncing ? 'Syncing...' : `Sync ${getChannelDisplayName(selectedChannel)}`}
              </Button>
            </>
          )}

          {/* Smart Merge Button (Universal) */}
          <button
            onClick={handleOpenLocalMergeModal}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200/80 rounded-xl text-xs font-black shadow-2xs transition-all cursor-pointer active:scale-[0.98]"
            title="Scan and merge duplicated or cross-channel listings"
          >
            <GitMerge size={14} className="text-indigo-600" />
            <span>Smart Merge</span>
          </button>

          {/* Sync Platforms Button (Universal) */}
          <button
            onClick={handleOpenImportModal}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl text-xs font-black shadow-sm hover:shadow transition-all cursor-pointer active:scale-[0.98]"
            title="Sync & merge live active items from connected channels into database"
          >
            <RefreshCw size={14} className={importLoading ? "animate-spin" : ""} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* SOLD TRACKER CONTROLS OR LOCAL/CHANNEL CONTROLS */}
      {activeTab === 'sold' ? (
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Search Bar */}
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={soldSearchTerm}
                onChange={(e) => setSoldSearchTerm(e.target.value)}
                placeholder="Search sold items by title, SKU, buyer username, or Order ID..."
                className="w-full pl-11 pr-10 py-2.5 bg-slate-50/80 border border-slate-200 focus:bg-white rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-purple-500/10 focus:border-purple-500 transition-all placeholder:text-slate-400 shadow-2xs"
              />
              {soldSearchTerm && (
                <button
                  type="button"
                  onClick={() => setSoldSearchTerm('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Marketplace Filter & Sort */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Marketplace Filter Dropdown */}
              <div className="relative">
                <select
                  value={soldPlatformFilter}
                  onChange={(e) => setSoldPlatformFilter(e.target.value)}
                  className="pl-3.5 pr-8 py-2 bg-slate-50 border border-slate-200 hover:border-indigo-300 rounded-xl text-xs font-extrabold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all cursor-pointer appearance-none shadow-2xs"
                >
                  <option value="all">All Marketplaces ({soldOrders.length})</option>
                  <option value="ebay">eBay ({soldOrders.filter(o => (o.platform || 'ebay') === 'ebay').length})</option>
                  <option value="poshmark">Poshmark ({soldOrders.filter(o => o.platform === 'poshmark').length})</option>
                  <option value="mercari">Mercari ({soldOrders.filter(o => o.platform === 'mercari').length})</option>
                  <option value="etsy">Etsy ({soldOrders.filter(o => o.platform === 'etsy').length})</option>
                  <option value="amazon">Amazon ({soldOrders.filter(o => o.platform === 'amazon').length})</option>
                </select>
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <ChevronDown size={14} />
                </div>
              </div>

              {/* Sort dropdown */}
              <div className="relative">
                <select
                  value={soldSortOption}
                  onChange={(e) => setSoldSortOption(e.target.value)}
                  className="pl-3.5 pr-8 py-2 bg-slate-50 border border-slate-200 hover:border-indigo-300 rounded-xl text-xs font-extrabold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all cursor-pointer appearance-none shadow-2xs"
                >
                  <option value="newest">Sold Date (Newest)</option>
                  <option value="oldest">Sold Date (Oldest)</option>
                  <option value="price-desc">Price (High - Low)</option>
                  <option value="price-asc">Price (Low - High)</option>
                </select>
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <ChevronDown size={14} />
                </div>
              </div>

              {(soldSearchTerm || soldPlatformFilter !== 'all') && (
                <button
                  onClick={() => {
                    setSoldSearchTerm('');
                    setSoldPlatformFilter('all');
                  }}
                  className="text-xs font-extrabold text-indigo-600 hover:text-indigo-700 hover:underline px-1.5 transition-all cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Sync Time Status (Small, directly aligned underneath search bar) */}
          <div className="flex items-center gap-2 text-[11px] text-slate-400 pl-1 pt-0.5">
            <span>Last synced: <strong className="font-semibold text-slate-600 font-mono">{lastSoldSyncTime ? lastSoldSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) : 'Just now'}</strong></span>
            <span>•</span>
            <span>Next sync: <strong className="font-semibold text-slate-600">Every 10 min</strong></span>
            <button
              onClick={handleManualSoldSync}
              disabled={soldSyncing}
              title="Refresh sold orders"
              className="p-0.5 text-slate-400 hover:text-indigo-600 rounded hover:bg-indigo-50 transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1 ml-1"
            >
              <RefreshCw size={11} className={soldSyncing ? "animate-spin text-indigo-600" : ""} />
              {soldSyncing && <span className="text-[10px] text-indigo-600 font-bold">Syncing...</span>}
            </button>
          </div>
        </div>
      ) : activeTab === 'local' ? (
        <div className="bg-white p-3.5 sm:p-5 rounded-3xl border border-slate-100 shadow-sm space-y-3.5">
          
          {/* Top Row: Horizontal Status Tabs on Left, Sort / Direction / Filter on Right */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3.5 border-b border-slate-100 pb-3">
            {/* Status Tabs Navigation */}
            <div className="flex items-center gap-2 sm:gap-4 md:gap-6 overflow-x-auto no-scrollbar -mb-3 pb-3">
              {[
                { key: 'all', label: 'All Listings', count: localTabCounts.all },
                { key: 'active', label: 'Active', count: localTabCounts.active },
                { key: 'sold', label: 'Sold', count: localTabCounts.sold },
                { key: 'delisted', label: 'Delisted', count: localTabCounts.delisted },
                { key: 'draft', label: 'Drafts', count: localTabCounts.draft },
                { key: 'error', label: 'Errors', count: localTabCounts.error },
                { key: 'favorite', label: 'Favorites', count: localTabCounts.favorite },
              ].map((tab) => {
                const isActive = statusFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setStatusFilter(tab.key)}
                    className={`flex items-center gap-1.5 pb-3 pt-1 text-xs transition-all cursor-pointer whitespace-nowrap relative ${
                      isActive
                        ? 'text-indigo-600 font-extrabold'
                        : 'text-slate-500 hover:text-slate-800 font-bold'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`text-[11px] font-bold ${isActive ? 'text-indigo-600 font-extrabold' : 'text-slate-400'}`}>
                      {tab.count.toLocaleString()}
                    </span>
                    {isActive && (
                      <motion.div
                        layoutId="activeListingTabIndicator"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full"
                        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Right Controls: Sort dropdown, Invert Sort Direction, Filter Modal Trigger, Clear */}
            <div className="flex items-center flex-wrap sm:flex-nowrap gap-2 shrink-0 justify-between sm:justify-end w-full xl:w-auto">
              {/* Sort Dropdown */}
              <div className="relative flex-1 sm:flex-none">
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value)}
                  className="w-full sm:w-auto pl-3.5 pr-8 py-2 bg-slate-50 border border-slate-200 hover:border-indigo-300 rounded-xl text-xs font-extrabold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all cursor-pointer appearance-none shadow-2xs"
                  title="Sort Listings"
                >
                  <option value="crosslisted-desc">Most Cross-Listed (5 → 1)</option>
                  <option value="crosslisted-asc">Least Cross-Listed (1 → 5)</option>
                  <option value="newest">Last Updated (Newest)</option>
                  <option value="oldest">Last Updated (Oldest)</option>
                  <option value="title-asc">Title (A - Z)</option>
                  <option value="title-desc">Title (Z - A)</option>
                  <option value="price-desc">Price (High - Low)</option>
                  <option value="price-asc">Price (Low - High)</option>
                  <option value="qty-desc">Quantity (High - Low)</option>
                  <option value="qty-asc">Quantity (Low - High)</option>
                </select>
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <ChevronDown size={14} />
                </div>
              </div>

              {/* Sort Invert Toggle Button */}
              <button
                type="button"
                onClick={handleToggleSortDirection}
                title="Invert / Toggle Sort Order"
                className="p-2 rounded-xl bg-slate-50 border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 text-slate-600 hover:text-indigo-600 transition-all cursor-pointer shadow-2xs active:scale-95 shrink-0"
              >
                <ArrowUpDown size={14} />
              </button>

              {/* Filter Button */}
              <button
                onClick={() => {
                  setTempListedOn(filterListedOn);
                  setTempNoListedOn(filterNoListedOn);
                  setTempSortOption(sortOption);
                  setFilterModalOpen(true);
                }}
                className={`flex items-center gap-1.5 px-3 py-2 bg-white border rounded-xl text-xs font-extrabold text-slate-700 hover:border-indigo-300 transition-all cursor-pointer shadow-2xs shrink-0 ${
                  (filterListedOn.length > 0 || filterNoListedOn.length > 0 || sortOption !== 'crosslisted-desc') ? 'border-indigo-500 ring-2 ring-indigo-500/10 text-indigo-600' : 'border-slate-200'
                }`}
              >
                <SlidersHorizontal size={13} className="text-slate-400" />
                <span>Filters</span>
                {(filterListedOn.length > 0 || filterNoListedOn.length > 0 || sortOption !== 'crosslisted-desc') && (
                  <span className="ml-0.5 px-1.5 py-0.2 text-[9px] font-black bg-indigo-600 text-white rounded-full leading-none">
                    {(filterListedOn.length > 0 ? 1 : 0) + (filterNoListedOn.length > 0 ? 1 : 0) + (sortOption !== 'crosslisted-desc' ? 1 : 0)}
                  </span>
                )}
              </button>

              {/* Clear filters button */}
              {hasActiveLocalFilters && (
                <button
                  onClick={handleClearFilters}
                  className="text-xs font-extrabold text-indigo-600 hover:text-indigo-700 hover:underline px-1.5 transition-all cursor-pointer shrink-0"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Full-width Search Bar */}
          <div className="relative w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search listings by title, SKU, or brand..."
              className="w-full pl-11 pr-10 py-2.5 bg-slate-50/80 border border-slate-150 focus:bg-white rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400 shadow-2xs"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

        </div>
      ) : (
        /* ALL PLATFORM INVENTORY CONTROLS: 5 STATUS TABS + SORT + FULL-WIDTH SEARCH */
        <div className="bg-white p-3.5 sm:p-5 rounded-3xl border border-slate-100 shadow-sm space-y-3.5">
          
          {/* Top Row: Horizontal Status Tabs on Left, Sort dropdown on Right */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3.5 border-b border-slate-100 pb-3">
            {/* Status Tabs Navigation (NO Sold, NO Favorites) */}
            <div className="flex items-center gap-2 sm:gap-4 md:gap-6 overflow-x-auto no-scrollbar -mb-3 pb-3">
              {[
                { key: 'all', label: 'All Products', count: channelTabCounts.all },
                { key: 'active', label: 'Active', count: channelTabCounts.active },
                { key: 'delisted', label: 'Delisted', count: channelTabCounts.delisted },
                { key: 'draft', label: 'Drafts', count: channelTabCounts.draft },
                { key: 'error', label: 'Errors', count: channelTabCounts.error },
              ].map((tab) => {
                const isActive = channelStatusFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setChannelStatusFilter(tab.key)}
                    className={`flex items-center gap-1.5 pb-3 pt-1 text-xs transition-all cursor-pointer whitespace-nowrap relative ${
                      isActive
                        ? 'text-indigo-600 font-extrabold'
                        : 'text-slate-500 hover:text-slate-800 font-bold'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`text-[11px] font-bold ${isActive ? 'text-indigo-600 font-extrabold' : 'text-slate-400'}`}>
                      {tab.count.toLocaleString()}
                    </span>
                    {isActive && (
                      <motion.div
                        layoutId="activeChannelListingTabIndicator"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full"
                        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Right Controls: Sort dropdown, Invert Sort Direction, Clear */}
            <div className="flex items-center flex-wrap sm:flex-nowrap gap-2 shrink-0 justify-between sm:justify-end w-full xl:w-auto">
              {/* Sort Dropdown */}
              <div className="relative flex-1 sm:flex-none">
                <select
                  value={channelSortOption}
                  onChange={(e) => {
                    setChannelSortOption(e.target.value);
                    localStorage.setItem('elister_channel_sort_option', e.target.value);
                  }}
                  className="w-full sm:w-auto pl-3.5 pr-8 py-2 bg-slate-50 border border-slate-200 hover:border-indigo-300 rounded-xl text-xs font-extrabold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all cursor-pointer appearance-none shadow-2xs"
                  title="Sort Channel Inventory"
                >
                  <option value="newest">Last Updated (Newest)</option>
                  <option value="oldest">Last Updated (Oldest)</option>
                  <option value="price-desc">Price (High - Low)</option>
                  <option value="price-asc">Price (Low - High)</option>
                  <option value="title-asc">Title (A - Z)</option>
                  <option value="title-desc">Title (Z - A)</option>
                </select>
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <ChevronDown size={14} />
                </div>
              </div>

              {/* Sort Invert Toggle Button */}
              <button
                type="button"
                onClick={handleToggleChannelSortDirection}
                title="Invert / Toggle Sort Order"
                className="p-2 rounded-xl bg-slate-50 border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 text-slate-600 hover:text-indigo-600 transition-all cursor-pointer shadow-2xs active:scale-95 shrink-0"
              >
                <ArrowUpDown size={14} />
              </button>

              {/* Clear filters button */}
              {hasActiveChannelFilters && (
                <button
                  onClick={handleClearFilters}
                  className="text-xs font-extrabold text-indigo-600 hover:text-indigo-700 hover:underline px-1.5 transition-all cursor-pointer shrink-0"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Full-width Search Bar */}
          <div className="relative w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Search ${getChannelDisplayName(selectedChannel)} products by title, SKU, or ID...`}
              className="w-full pl-11 pr-10 py-2.5 bg-slate-50/80 border border-slate-150 focus:bg-white rounded-2xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400 shadow-2xs"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

        </div>
      )}

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
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleOpenImportModal}
                    className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl text-xs font-black shadow-sm hover:shadow transition-all cursor-pointer"
                  >
                    <Download size={14} />
                    <span>Import from Channels</span>
                  </button>
                  <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => navigate('/create-ebay-listing')}>
                    Create a Listing
                  </Button>
                </div>
              )}
            />
          ) : (
            <>
              {/* MOBILE & TABLET CARD VIEW */}
              <div className="md:hidden divide-y divide-slate-100">
                {paginatedListings.map((item) => {
                  const isCardSelected = selectedListingIds.includes(item._id);
                  const realUpdatedTime = item.updatedAt || item.updated_at || item.createdAt || item.created_at || item.lastUpdated;
                  return (
                    <div key={item._id} className={`p-4 space-y-3.5 transition-colors ${isCardSelected ? 'bg-indigo-50/40' : ''}`}>
                      <div className="flex items-start gap-3">
                        <input 
                          type="checkbox" 
                          checked={isCardSelected}
                          onChange={(e) => handleToggleSelectItem(item._id, e)}
                          onClick={(e) => e.stopPropagation()} 
                          className="w-4 h-4 mt-1.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer shrink-0" 
                        />
                        <div 
                          className="w-14 h-18 bg-slate-50 rounded-xl overflow-hidden shrink-0 shadow-inner flex items-center justify-center border border-slate-100 relative"
                        >
                          {item.thumbnail || (item.images && item.images.length > 0) ? (
                            <img src={item.thumbnail || item.images[0]} className="w-full h-full object-cover" alt="" />
                          ) : (
                            <ImageOff size={16} className="text-slate-300" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-1.5">
                            <p 
                              className="font-extrabold text-slate-800 text-xs leading-relaxed line-clamp-2 flex-1"
                            >
                              {item.title}
                            </p>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (activeMasterDropdown?.itemId === item._id) {
                                  setActiveMasterDropdown(null);
                                  return;
                                }
                                const rect = e.currentTarget.getBoundingClientRect();
                                const openUpward = rect.bottom > window.innerHeight * 0.6;
                                const menuWidth = 200;
                                const left = Math.min(
                                  Math.max(rect.left + rect.width / 2 - menuWidth / 2, 8),
                                  window.innerWidth - menuWidth - 8
                                );
                                setActiveMasterDropdown({
                                  itemId: item._id,
                                  item,
                                  openUpward,
                                  left,
                                  verticalOffset: openUpward ? window.innerHeight - rect.top + 4 : rect.bottom + 4,
                                });
                              }}
                              className="w-6 h-6 -mr-1 -mt-0.5 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                              title="Item options"
                            >
                              <MoreVertical size={13} />
                            </button>
                          </div>
                          <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mt-1.5 text-[10px] font-bold text-slate-400">
                            <button
                              type="button"
                              onClick={(e) => handleToggleFavorite(item._id, e)}
                              title={favoriteIds.includes(item._id) ? "Remove from Favorites" : "Add to Favorites"}
                              className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                                favoriteIds.includes(item._id)
                                  ? 'bg-amber-50 text-amber-600 font-black border border-amber-200'
                                  : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100'
                              }`}
                            >
                              <Star
                                size={11}
                                className={favoriteIds.includes(item._id) ? "fill-amber-400 text-amber-400" : "text-slate-400"}
                              />
                              <span>{favoriteIds.includes(item._id) ? 'Favorited' : 'Favorite'}</span>
                            </button>
                            <span className="text-slate-300">•</span>
                            <span className="font-mono text-slate-500">{getDisplaySku(item.sku)}</span>
                            <span className="text-slate-300">•</span>
                            <span>Qty <span className="text-slate-700 font-extrabold">{item.quantity || 1}</span></span>
                            <span className="text-slate-300">•</span>
                            <span>{formatTimeAgo(realUpdatedTime)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Marketplace Cross-Listing Cards Tray */}
                      <div className="pt-2 border-t border-slate-100">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                            Marketplace Channels
                          </span>
                          <span className="text-[10px] font-semibold text-indigo-600">
                            Swipe horizontally →
                          </span>
                        </div>
                        <div className="flex items-center gap-2.5 overflow-x-auto pb-2 -mx-1 px-1">
                          {renderCrosslistingCell(item, 'ebay', item.ebayListingId, '/ebay.png')}
                          {renderCrosslistingCell(item, 'poshmark', item.poshmarkListingId, '/poshmark.png')}
                          {renderCrosslistingCell(item, 'mercari', item.mercariListingId, '/mercari.png')}
                          {renderCrosslistingCell(item, 'etsy', item.etsyListingId, '/etsy.png')}
                          {renderCrosslistingCell(item, 'amazon', item.amazonListingId, '/amazon.png')}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* DESKTOP & TABLET TABLE VIEW */}
              <div className="hidden md:block overflow-x-auto overflow-y-hidden pb-1">
                <table className="min-w-[1060px] w-full text-left border-collapse">

                  {/* Headers */}
                  <thead className="bg-slate-50/80 border-b border-slate-100">
                    <tr className="border-b border-slate-100 select-none">
                      <th className="px-3 py-3.5 w-10 text-center">
                        <input 
                          type="checkbox" 
                          checked={isAllSelected}
                          onChange={handleToggleSelectAll}
                          title={isAllSelected ? "Deselect all on this page" : "Select all on this page"}
                          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer" 
                        />
                      </th>
                      <th className="px-4 py-3.5 text-xs font-black text-slate-500 tracking-wider min-w-[280px] w-[32%]">Item</th>
                      <th className="px-1.5 py-3.5 text-xs font-black text-slate-700 tracking-wider text-center min-w-[150px] w-[13.6%]">
                        <div className="flex items-center justify-center gap-1.5">
                          <img src="/ebay.png" className="w-4 h-4 object-contain" alt="" />
                          <span>eBay</span>
                        </div>
                      </th>
                      <th className="px-1.5 py-3.5 text-xs font-black text-slate-700 tracking-wider text-center min-w-[150px] w-[13.6%]">
                        <div className="flex items-center justify-center gap-1.5">
                          <img src="/poshmark.png" className="w-4 h-4 object-contain" alt="" />
                          <span>Poshmark</span>
                        </div>
                      </th>
                      <th className="px-1.5 py-3.5 text-xs font-black text-slate-700 tracking-wider text-center min-w-[150px] w-[13.6%]">
                        <div className="flex items-center justify-center gap-1.5">
                          <img src="/mercari.png" className="w-4 h-4 object-contain" alt="" />
                          <span>Mercari</span>
                        </div>
                      </th>
                      <th className="px-1.5 py-3.5 text-xs font-black text-slate-700 tracking-wider text-center min-w-[150px] w-[13.6%]">
                        <div className="flex items-center justify-center gap-1.5">
                          <img src="/etsy.png" className="w-4 h-4 object-contain" alt="" />
                          <span>Etsy</span>
                        </div>
                      </th>
                      <th className="px-1.5 py-3.5 text-xs font-black text-slate-700 tracking-wider text-center min-w-[150px] w-[13.6%]">
                        <div className="flex items-center justify-center gap-1.5">
                          <img src="/amazon.png" className="w-4 h-4 object-contain" alt="" />
                          <span>Amazon</span>
                        </div>
                      </th>
                    </tr>
                  </thead>

                  {/* Rows */}
                  <tbody className="divide-y divide-slate-100">
                    {paginatedListings.map((item) => {
                      const realUpdatedTime = item.updatedAt || item.updated_at || item.createdAt || item.created_at || item.lastUpdated;
                      const isRowSelected = selectedListingIds.includes(item._id);
                      return (
                        <tr key={item._id} className={`transition-colors ${isRowSelected ? 'bg-indigo-50/60 hover:bg-indigo-50/80' : 'hover:bg-slate-50/70'}`}>

                          {/* Checkbox */}
                          <td className="px-3 py-3 text-center align-middle w-10">
                            <input 
                              type="checkbox" 
                              checked={isRowSelected}
                              onChange={(e) => handleToggleSelectItem(item._id, e)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer" 
                            />
                          </td>

                          {/* Item */}
                          <td className="px-4 py-3 align-middle min-w-[280px] w-[32%]">
                            <div className="flex items-start gap-3.5">
                              <div 
                                className="w-[72px] h-[94px] bg-slate-50 rounded-2xl overflow-hidden shrink-0 shadow-2xs flex items-center justify-center border border-slate-100 relative"
                              >
                                {item.thumbnail || (item.images && item.images.length > 0) ? (
                                  <img src={item.thumbnail || item.images[0]} className="w-full h-full object-cover" alt="" />
                                ) : (
                                  <ImageOff size={18} className="text-slate-300" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-1.5">
                                  <p 
                                    className="font-bold text-slate-900 text-sm leading-snug line-clamp-2 flex-1"
                                    title={item.title}
                                  >
                                    {item.title}
                                  </p>
                                  {/* Master 3-Dot Options Trigger */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (activeMasterDropdown?.itemId === item._id) {
                                        setActiveMasterDropdown(null);
                                        return;
                                      }
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      const openUpward = rect.bottom > window.innerHeight * 0.6;
                                      const menuWidth = 210;
                                      const left = Math.min(
                                        Math.max(rect.left + rect.width / 2 - menuWidth / 2, 8),
                                        window.innerWidth - menuWidth - 8
                                      );
                                      setActiveMasterDropdown({
                                        itemId: item._id,
                                        item,
                                        openUpward,
                                        left,
                                        verticalOffset: openUpward ? window.innerHeight - rect.top + 4 : rect.bottom + 4,
                                      });
                                    }}
                                    className="w-6 h-6 -mr-1 -mt-0.5 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                                    title="Item options"
                                  >
                                    <MoreVertical size={14} />
                                  </button>
                                </div>
                                
                                <div className="flex items-center flex-wrap gap-x-2.5 gap-y-1 mt-2 text-xs font-semibold text-slate-400">
                                  {/* Favorite Star Under Title */}
                                  <button
                                    type="button"
                                    onClick={(e) => handleToggleFavorite(item._id, e)}
                                    title={favoriteIds.includes(item._id) ? "Remove from Favorites" : "Add to Favorites"}
                                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md transition-all cursor-pointer ${
                                      favoriteIds.includes(item._id)
                                        ? 'bg-amber-50 text-amber-600 font-bold border border-amber-200'
                                        : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100'
                                    }`}
                                  >
                                    <Star
                                      size={12}
                                      className={favoriteIds.includes(item._id) ? "fill-amber-400 text-amber-400" : "text-slate-400 hover:text-amber-400"}
                                    />
                                    <span className="text-[11px]">{favoriteIds.includes(item._id) ? 'Favorited' : 'Favorite'}</span>
                                  </button>

                                  <span className="text-slate-300">•</span>

                                  {/* SKU with inline edit */}
                                  <div className="flex items-center gap-1">
                                    <span className="text-slate-400 font-bold">SKU:</span>
                                    {editingSkuId === item._id ? (
                                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                        <input
                                          type="text"
                                          value={tempSkuValue}
                                          onChange={(e) => setTempSkuValue(e.target.value)}
                                          placeholder="SKU"
                                          className="text-xs font-mono font-bold bg-white border border-indigo-400 rounded px-1.5 py-0.5 w-20 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                          autoFocus
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleQuickUpdateSku(item._id, tempSkuValue);
                                            else if (e.key === 'Escape') setEditingSkuId(null);
                                          }}
                                        />
                                        <button
                                          type="button"
                                          disabled={savingSku}
                                          onClick={() => handleQuickUpdateSku(item._id, tempSkuValue)}
                                          className="px-1.5 py-0.5 bg-indigo-600 text-white text-[10px] font-bold rounded cursor-pointer shrink-0"
                                        >
                                          {savingSku ? '...' : 'Save'}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setEditingSkuId(null)}
                                          className="text-slate-400 hover:text-slate-600 text-[10px] font-bold cursor-pointer shrink-0"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    ) : (
                                      <div 
                                        className="flex items-center gap-1 group/sku cursor-pointer"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingSkuId(item._id);
                                          const direct = getDisplaySku(item.sku);
                                          const fallback = (item.skus?.map(s => getDisplaySku(s)).find(s => s && s !== '-')) || '';
                                          const currentVal = direct !== '-' ? direct : fallback;
                                          setTempSkuValue(currentVal === '-' ? '' : currentVal);
                                        }}
                                        title="Click to edit SKU"
                                      >
                                        <span className="font-mono font-bold text-slate-600">
                                          {(() => {
                                            const direct = getDisplaySku(item.sku);
                                            if (direct && direct !== '-') return direct;
                                            if (Array.isArray(item.skus)) {
                                              const fromSkus = item.skus.map(s => getDisplaySku(s)).find(s => s && s !== '-');
                                              if (fromSkus) return fromSkus;
                                            }
                                            if (item.listingsMap) {
                                              const fromMap = Object.values(item.listingsMap).map(sub => getDisplaySku(sub?.sku)).find(s => s && s !== '-');
                                              if (fromMap) return fromMap;
                                            }
                                            if (item.platformData) {
                                              for (const p of Object.keys(item.platformData)) {
                                                const fromPData = getDisplaySku(item.platformData[p]?.sku);
                                                if (fromPData && fromPData !== '-') return fromPData;
                                              }
                                            }
                                            return '-';
                                          })()}
                                        </span>
                                        <Edit size={10} className="text-slate-400 opacity-0 group-hover/sku:opacity-100 hover:text-indigo-600 transition-opacity" />
                                      </div>
                                    )}
                                  </div>

                                  <span className="text-slate-300">•</span>

                                  {/* Last Updated (Real time) */}
                                  <span>Last updated: {formatTimeAgo(realUpdatedTime)}</span>

                                  {item.status === 'sold' && (
                                    <>
                                      <span className="text-slate-300">•</span>
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-700 border border-purple-200">
                                        <span className="w-1.5 h-1.5 rounded-full bg-purple-600 mr-1.5"></span>
                                        Sold Out {(item.soldPlatform || item.soldOn || item.platform) ? `(${getChannelDisplayName(item.soldPlatform || item.soldOn || item.platform)})` : ''}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* 5 Crosslisting Platform Matrix Cards */}
                          <td className="px-1.5 py-3 align-middle min-w-[150px] w-[13.6%] text-center">
                            <div className="flex justify-center">
                              {renderCrosslistingCell(item, 'ebay', item.ebayListingId, '/ebay.png')}
                            </div>
                          </td>
                          <td className="px-1.5 py-3 align-middle min-w-[150px] w-[13.6%] text-center">
                            <div className="flex justify-center">
                              {renderCrosslistingCell(item, 'poshmark', item.poshmarkListingId, '/poshmark.png')}
                            </div>
                          </td>
                          <td className="px-1.5 py-3 align-middle min-w-[150px] w-[13.6%] text-center">
                            <div className="flex justify-center">
                              {renderCrosslistingCell(item, 'mercari', item.mercariListingId, '/mercari.png')}
                            </div>
                          </td>
                          <td className="px-1.5 py-3 align-middle min-w-[150px] w-[13.6%] text-center">
                            <div className="flex justify-center">
                              {renderCrosslistingCell(item, 'etsy', item.etsyListingId, '/etsy.png')}
                            </div>
                          </td>
                          <td className="px-1.5 py-3 align-middle min-w-[150px] w-[13.6%] text-center">
                            <div className="flex justify-center">
                              {renderCrosslistingCell(item, 'amazon', item.amazonListingId, '/amazon.png')}
                            </div>
                          </td>

                        </tr>
                      );
                    })}
                  </tbody>

                </table>
              </div>
            </>
          )
        ) : activeTab === 'sold' ? (
          soldLoading ? (
            <LoadingState label="Loading sold items and auto-delist logs..." />
          ) : paginatedSoldOrders.length === 0 ? (
            <EmptyState
              icon={<Flame size={24} className="text-purple-500" />}
              title={soldSearchTerm || soldPlatformFilter !== 'all' ? "No sold items match your filters" : "No sold items recorded yet"}
              description={
                soldSearchTerm || soldPlatformFilter !== 'all'
                  ? "Try changing your search term or platform filter."
                  : "When an item sells on eBay, Poshmark, Mercari, or Etsy, it will appear here automatically with exact sale time and cross-platform auto-delist status."
              }
              action={
                soldSearchTerm || soldPlatformFilter !== 'all' ? (
                  <Button variant="secondary" size="sm" onClick={() => { setSoldSearchTerm(''); setSoldPlatformFilter('all'); }}>
                    Clear Filters
                  </Button>
                ) : (
                  <Button size="sm" icon={<RefreshCw size={14} className={soldSyncing ? 'animate-spin' : ''} />} onClick={handleManualSoldSync} disabled={soldSyncing}>
                    {soldSyncing ? 'Checking Marketplace Sales...' : 'Sync Sales Now'}
                  </Button>
                )
              }
            />
          ) : (
            <>
              {/* MOBILE SOLD CARD VIEW */}
              <div className="md:hidden divide-y divide-slate-100">
                {paginatedSoldOrders.map((order) => {
                  const firstItem = (order.lineItems && order.lineItems[0]) || {};
                  const thumb = firstItem.thumbnail || order.listingId?.thumbnail || (order.listingId?.images && order.listingId.images[0]);
                  const title = firstItem.title || order.listingId?.title || 'Sold Item';
                  const sku = firstItem.sku || order.listingId?.sku || '-';
                  const platformName = (order.platform || 'ebay').toLowerCase();
                  const platformLogo = platformName === 'ebay' ? '/ebay.png' : (platformName === 'poshmark' ? '/poshmark.png' : (platformName === 'mercari' ? '/mercari.png' : (platformName === 'etsy' ? '/etsy.png' : '/amazon.png')));
                  const price = order.totalAmount !== undefined ? order.totalAmount : (firstItem.price || 0);
                  const delistLog = order.delistActions || order.listingId?.autoDelistLog || {};
                  const directDelisted = Object.keys(delistLog).filter(p => delistLog[p]?.success || delistLog[p]?.status === 'delisted' || delistLog[p]?.status === 'inactive');
                  const allPlatforms = ['ebay', 'poshmark', 'mercari', 'etsy', 'amazon', 'depop'];
                  const listingDelisted = order.listingId ? allPlatforms.filter(p => {
                    if (p === platformName) return false;
                    const pStatus = order.listingId[`${p}Status`]?.toLowerCase();
                    const pDataStatus = order.listingId.platformData?.[p]?.status?.toLowerCase();
                    const pMapStatus = order.listingId.listingsMap?.[p]?.status?.toLowerCase();
                    return (pStatus === 'delisted' || pDataStatus === 'delisted' || pMapStatus === 'delisted');
                  }) : [];
                  const delistedPlatforms = Array.from(new Set([...directDelisted, ...listingDelisted]));

                  return (
                    <div key={order._id || order.orderId} className="p-4 space-y-2.5">
                      <div className="flex items-start gap-3">
                        <div className="w-14 h-14 bg-slate-50 rounded-xl overflow-hidden shrink-0 shadow-inner flex items-center justify-center border border-slate-100 relative">
                          {thumb ? (
                            <img src={thumb} className="w-full h-full object-cover" alt="" />
                          ) : (
                            <ImageOff size={16} className="text-slate-300" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-800 text-xs leading-relaxed line-clamp-2">{title}</p>
                          <div className="mt-1">
                            <span className="font-mono text-slate-500 text-[11px]">SKU: {getDisplaySku(sku)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1">
                        <div className="flex items-center gap-2">
                          <img src={platformLogo} className="w-4 h-4 object-contain" alt="" />
                          <span className="font-bold text-slate-700 capitalize">{platformName}</span>
                          <span className="font-extrabold text-slate-900 text-xs">${Number(price).toFixed(2)}</span>
                          <span className="text-[10px] font-mono text-slate-400">#{order.orderId}</span>
                        </div>
                        <span className="text-[10px] font-medium text-slate-500">
                          {formatTimeAgo(order.createdDate || order.paidDate || order.createdAt)}
                        </span>
                      </div>

                      {delistedPlatforms.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                          <span className="text-[10px] font-semibold text-slate-400">Auto-Delisted:</span>
                          {delistedPlatforms.map(p => {
                            const pLogo = p === 'ebay' ? '/ebay.png' : (p === 'poshmark' ? '/poshmark.png' : (p === 'mercari' ? '/mercari.png' : (p === 'etsy' ? '/etsy.png' : (p === 'amazon' ? '/amazon.png' : '/depop.png'))));
                            return (
                              <div key={p} className="flex items-center gap-1.5 font-medium text-slate-700">
                                <img src={pLogo} className="w-3.5 h-3.5 object-contain" alt="" />
                                <span>{getChannelDisplayName(p)}</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {/* DESKTOP SOLD TABLE VIEW */}
              <div className="hidden md:block overflow-x-auto overflow-y-hidden pb-1">
                <table className="min-w-[850px] w-full text-left border-collapse">
                  <thead className="bg-slate-50/80 border-b border-slate-100">
                    <tr className="border-b border-slate-100 select-none text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      <th className="px-5 py-3.5 min-w-[280px] w-[36%]">Product</th>
                      <th className="px-5 py-3.5 min-w-[170px] w-[22%]">Sold On & Order ID</th>
                      <th className="px-5 py-3.5 min-w-[170px] w-[22%]">Sale Date & Time</th>
                      <th className="px-5 py-3.5 min-w-[170px] w-[20%]">Auto-Delist Protection</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedSoldOrders.map((order) => {
                      const firstItem = (order.lineItems && order.lineItems[0]) || {};
                      const thumb = firstItem.thumbnail || order.listingId?.thumbnail || (order.listingId?.images && order.listingId.images[0]);
                      const title = firstItem.title || order.listingId?.title || 'Sold Item';
                      const sku = firstItem.sku || order.listingId?.sku || '-';
                      const platformName = (order.platform || 'ebay').toLowerCase();
                      const platformLogo = platformName === 'ebay' ? '/ebay.png' : (platformName === 'poshmark' ? '/poshmark.png' : (platformName === 'mercari' ? '/mercari.png' : (platformName === 'etsy' ? '/etsy.png' : '/amazon.png')));
                      const price = order.totalAmount !== undefined ? order.totalAmount : (firstItem.price || 0);
                      const rawDate = order.createdDate || order.paidDate || order.createdAt;
                      const dateObj = rawDate ? new Date(rawDate) : null;
                      const formattedDate = dateObj && !isNaN(dateObj.getTime())
                        ? dateObj.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
                        : 'Recently';
                      
                      const delistLog = order.delistActions || order.listingId?.autoDelistLog || {};
                      const directDelisted = Object.keys(delistLog).filter(p => delistLog[p]?.success || delistLog[p]?.status === 'delisted' || delistLog[p]?.status === 'inactive');
                      const allPlatforms = ['ebay', 'poshmark', 'mercari', 'etsy', 'amazon', 'depop'];
                      const listingDelisted = order.listingId ? allPlatforms.filter(p => {
                        if (p === platformName) return false;
                        const pStatus = order.listingId[`${p}Status`]?.toLowerCase();
                        const pDataStatus = order.listingId.platformData?.[p]?.status?.toLowerCase();
                        const pMapStatus = order.listingId.listingsMap?.[p]?.status?.toLowerCase();
                        return (pStatus === 'delisted' || pDataStatus === 'delisted' || pMapStatus === 'delisted');
                      }) : [];
                      const delistedPlatforms = Array.from(new Set([...directDelisted, ...listingDelisted]));

                      return (
                        <tr key={order._id || order.orderId} className="hover:bg-slate-50/60 transition-colors">
                          {/* Product Info */}
                          <td className="px-5 py-4 w-[36%] align-middle">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 bg-slate-50 rounded-xl overflow-hidden shrink-0 shadow-inner flex items-center justify-center border border-slate-100">
                                {thumb ? (
                                  <img src={thumb} className="w-full h-full object-cover" alt="" />
                                ) : (
                                  <ImageOff size={16} className="text-slate-300" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <span className="font-bold text-slate-800 text-xs line-clamp-1 leading-snug block" title={title}>
                                  {title}
                                </span>
                                <div className="mt-1">
                                  <span className="font-mono text-slate-500 text-[11px] block">
                                    SKU: {getDisplaySku(sku)}
                                    {firstItem.quantity > 1 && ` • Qty ${firstItem.quantity}`}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Sold Platform & Order */}
                          <td className="px-5 py-4 w-[22%] align-middle">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-2">
                                <img src={platformLogo} className="w-4 h-4 object-contain" alt="" />
                                <span className="text-xs font-bold text-slate-800 capitalize">{platformName}</span>
                                <span className="text-xs font-extrabold text-slate-900">${Number(price).toFixed(2)}</span>
                              </div>
                              <span className="text-[11px] font-mono text-slate-400 font-medium block">
                                Order #{order.orderId}
                              </span>
                              {order.buyerUsername && (
                                <span className="text-[10px] text-slate-400">Buyer: <strong className="text-slate-600 font-medium">@{order.buyerUsername}</strong></span>
                              )}
                            </div>
                          </td>

                          {/* Sale Date & Time */}
                          <td className="px-5 py-4 w-[22%] align-middle">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                                <Clock size={12} className="text-slate-400 shrink-0" />
                                {formattedDate}
                              </span>
                              <span className="text-[10px] font-medium text-slate-400">
                                {formatTimeAgo(rawDate)}
                              </span>
                            </div>
                          </td>

                          {/* Auto-Delist Protection (Clean Logo + Platform Name) */}
                          <td className="px-5 py-4 w-[20%] align-middle">
                            {delistedPlatforms.length > 0 ? (
                              <div className="flex flex-wrap items-center gap-2">
                                {delistedPlatforms.map(p => {
                                  const pLogo = p === 'ebay' ? '/ebay.png' : (p === 'poshmark' ? '/poshmark.png' : (p === 'mercari' ? '/mercari.png' : (p === 'etsy' ? '/etsy.png' : (p === 'amazon' ? '/amazon.png' : '/depop.png'))));
                                  return (
                                    <div key={p} className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                                      <img src={pLogo} className="w-3.5 h-3.5 object-contain" alt="" />
                                      <span>{getChannelDisplayName(p)}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                                <img src={platformLogo} className="w-3.5 h-3.5 object-contain opacity-60" alt="" />
                                <span>{getChannelDisplayName(platformName)} (Single Channel)</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
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
            title={hasActiveChannelFilters ? 'No products match your filters' : `No ${getChannelDisplayName(selectedChannel)} products found`}
            description={hasActiveChannelFilters
              ? 'Try adjusting or clearing your filters to see more results.'
              : `No products found. Click "Sync ${getChannelDisplayName(selectedChannel)}" to fetch your live items.`}
            action={hasActiveChannelFilters ? (
              <Button variant="secondary" size="sm" onClick={handleClearFilters}>
                Clear Filters
              </Button>
            ) : (
              <Button size="sm" icon={<RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />} onClick={handleSyncInventory} disabled={syncing}>
                Sync {getChannelDisplayName(selectedChannel)}
              </Button>
            )}
          />
        ) : (
          <>
            {/* MOBILE CARD VIEW */}
            <div className="md:hidden divide-y divide-slate-100">
              {paginatedChannelProducts.map((product, index) => {
                const details = getProductDetails(product);
                const itemKey = getChannelItemKey(product, index);
                const isCardSelected = selectedListingIds.includes(itemKey);
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
                const channelItem = buildChannelDropdownItem(product, details, selectedChannel);
                const liveUrl = getListingUrl(channelItem, selectedChannel, details.liveId);

                return (
                  <div key={itemKey} className={`p-4 space-y-3 transition-colors ${isCardSelected ? 'bg-indigo-50/40' : ''}`}>
                    <div className="flex items-start gap-3">
                      <input 
                        type="checkbox" 
                        checked={isCardSelected}
                        onChange={(e) => handleToggleSelectItem(itemKey, e)}
                        onClick={(e) => e.stopPropagation()} 
                        className="w-4 h-4 mt-1.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer shrink-0" 
                      />
                      <div 
                        className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer group select-none"
                        onClick={() => handleOpenPreview(channelItem, selectedChannel)}
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
                      <div className="flex items-center gap-1.5">
                        {liveUrl && liveUrl !== '#' && (
                          <a
                            href={liveUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 text-[11px] font-bold flex items-center gap-1 transition-colors"
                          >
                            <span>Open</span>
                            <ExternalLink size={10} />
                          </a>
                        )}
                        {renderCrosslistingCell(
                          channelItem,
                          selectedChannel,
                          details.liveId,
                          channelIcon
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* DESKTOP & TABLET TABLE VIEW */}
            <div className="hidden md:block overflow-x-auto overflow-y-hidden pb-1">
              <table className="min-w-[900px] w-full text-left border-collapse">

                {/* Headers */}
                <thead className="bg-slate-50/80 border-b border-slate-100">
                  <tr className="border-b border-slate-100 select-none">
                    <th className="px-4 py-3.5 w-10 text-center">
                      <input 
                        type="checkbox" 
                        checked={isAllSelected}
                        onChange={handleToggleSelectAll}
                        title={isAllSelected ? "Deselect all on this page" : "Select all on this page"}
                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer" 
                      />
                    </th>
                    <th className="px-4 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-wider min-w-[260px]">Product</th>
                    <th className="px-4 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-wider min-w-[100px]">Status</th>
                    <th className="px-4 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-wider min-w-[110px]">Live ID</th>
                    <th className="px-4 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-wider min-w-[110px]">SKU</th>
                    <th className="px-4 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-wider min-w-[90px]">Price</th>
                    <th className="px-4 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-wider min-w-[100px]">Date</th>
                    <th className="px-4 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-wider text-center min-w-[90px]">Actions</th>
                  </tr>
                </thead>

                {/* Rows */}
                <tbody className="divide-y divide-slate-100">
                  {paginatedChannelProducts.map((product, index) => {
                    const details = getProductDetails(product);
                    const itemKey = getChannelItemKey(product, index);
                    const isRowSelected = selectedListingIds.includes(itemKey);
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
                    const channelItem = buildChannelDropdownItem(product, details, selectedChannel);

                    return (
                      <tr key={itemKey} className={`transition-colors ${isRowSelected ? 'bg-indigo-50/60 hover:bg-indigo-50/80' : 'hover:bg-slate-50/60'}`}>

                        {/* Checkbox */}
                        <td className="px-6 py-4 text-center">
                          <input 
                            type="checkbox" 
                            checked={isRowSelected}
                            onChange={(e) => handleToggleSelectItem(itemKey, e)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer" 
                          />
                        </td>

                        {/* Product info */}
                        <td 
                          className="px-6 py-4 max-w-sm cursor-pointer group select-none"
                          onClick={() => handleOpenPreview(channelItem, selectedChannel)}
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
                              channelItem,
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
            Showing {displayedTotalCount === 0 ? 0 : displayedStartIndex + 1} to {displayedEndIndex} of {displayedTotalCount.toLocaleString()} {activeTab === 'local' ? 'listings' : (activeTab === 'sold' ? 'sold items' : 'live products')}
          </p>

          <div className="flex items-center gap-4 sm:gap-6 order-1 sm:order-2">
            <div className="flex items-center gap-1">
              <IconButton
                aria-label="Previous page"
                onClick={() => {
                  if (activeTab === 'sold') {
                    setSoldCurrentPage(prev => Math.max(prev - 1, 1));
                  } else {
                    setCurrentPage(prev => Math.max(prev - 1, 1));
                  }
                }}
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
                    onClick={() => {
                      if (activeTab === 'sold') {
                        setSoldCurrentPage(page);
                      } else {
                        setCurrentPage(page);
                      }
                    }}
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
                onClick={() => {
                  if (activeTab === 'sold') {
                    setSoldCurrentPage(prev => Math.min(prev + 1, displayedTotalPages));
                  } else {
                    setCurrentPage(prev => Math.min(prev + 1, displayedTotalPages));
                  }
                }}
                disabled={displayedActivePage === displayedTotalPages}
                size="sm"
              >
                <ChevronRight size={16} />
              </IconButton>
            </div>

            {/* page count indicator */}
            <div className="relative flex items-center">
              <select
                value={activeTab === 'sold' ? soldItemsPerPage : itemsPerPage}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (activeTab === 'sold') {
                    setSoldItemsPerPage(val);
                    setSoldCurrentPage(1);
                  } else {
                    setItemsPerPage(val);
                    setCurrentPage(1);
                  }
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
                    { value: 'crosslisted-desc', label: 'Most Cross-Listed (5 → 1)' },
                    { value: 'crosslisted-asc', label: 'Least Cross-Listed (1 → 5)' },
                    { value: 'newest', label: 'Newest First' },
                    { value: 'oldest', label: 'Oldest First' },
                    { value: 'price-desc', label: 'Price (High - Low)' },
                    { value: 'price-asc', label: 'Price (Low - High)' },
                    { value: 'title-asc', label: 'Title (A-Z)' },
                    { value: 'title-desc', label: 'Title (Z-A)' },
                    { value: 'qty-desc', label: 'Qty (High-Low)' },
                    { value: 'qty-asc', label: 'Qty (Low-High)' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setTempSortOption(option.value)}
                      className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold border transition-all cursor-pointer text-center ${
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
                  setTempSortOption('crosslisted-desc');
                  setSortOption('crosslisted-desc');
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

      {/* Floating Bulk Actions Toolbar */}
      {selectedListingIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 duration-200 w-[92%] max-w-xl">
          <div className="bg-slate-900/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700/80 flex items-center justify-between gap-3">
            {/* Selection info */}
            <div className="flex items-center gap-2.5 shrink-0">
              <span className="flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-full bg-indigo-600 text-white text-xs font-black">
                {selectedListingIds.length}
              </span>
              <span className="text-xs font-bold text-slate-200">
                {activeTab === 'channel'
                  ? (selectedListingIds.length === 1 ? 'product selected' : 'products selected')
                  : (selectedListingIds.length === 1 ? 'listing selected' : 'listings selected')}
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {activeTab === 'channel' && (
                <button
                  type="button"
                  onClick={handleOpenImportModal}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition-all cursor-pointer shadow-md shadow-indigo-950/40"
                  title="Import selected products to Local Database"
                >
                  <Download size={13} className="shrink-0" />
                  <span className="hidden sm:inline">Import Selected</span>
                  <span className="sm:hidden">Import</span>
                </button>
              )}

              <button
                type="button"
                disabled={bulkDelisting || bulkDeleting}
                onClick={handleBulkDelist}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                title={activeTab === 'channel' ? `Delist selected items from ${getChannelDisplayName(selectedChannel)}` : "Delist selected listings from all connected marketplaces"}
              >
                <XCircle size={14} className="text-amber-400 shrink-0" />
                <span className="hidden sm:inline">{bulkDelisting ? 'Delisting...' : 'Delist Selected'}</span>
                <span className="sm:hidden">Delist</span>
              </button>

              <button
                type="button"
                disabled={bulkDeleting || bulkDelisting}
                onClick={handleBulkDelete}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition-all cursor-pointer shadow-md shadow-rose-950/40 disabled:opacity-50"
                title={activeTab === 'channel' ? `Delete selected items from ${getChannelDisplayName(selectedChannel)}` : "Permanently delete selected listings from database"}
              >
                <Trash2 size={14} className="shrink-0" />
                <span>{bulkDeleting ? 'Deleting...' : 'Delete Selected'}</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedListingIds([])}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Deselect all"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Master Item Dropdown Portal */}
      {renderMasterPortalDropdown()}

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
      {previewListing && (() => {
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
        const displaySku = getDisplaySku(platData.sku || previewListing.sku || '');
        let displaySpecifics = {};
        if (activePlat === 'ebay') {
          if (platData.itemSpecifics && typeof platData.itemSpecifics === 'object' && Object.keys(platData.itemSpecifics).length > 0) {
            displaySpecifics = { ...platData.itemSpecifics };
          } else if (previewListing.itemSpecifics && typeof previewListing.itemSpecifics === 'object' && Object.keys(previewListing.itemSpecifics).length > 0) {
            displaySpecifics = { ...previewListing.itemSpecifics };
          } else if (previewListing.platformData?.ebay?.itemSpecifics && typeof previewListing.platformData.ebay.itemSpecifics === 'object') {
            displaySpecifics = { ...previewListing.platformData.ebay.itemSpecifics };
          }
          
          if (!displaySpecifics['Brand'] && (platData.brand || previewListing.brand)) displaySpecifics['Brand'] = platData.brand || previewListing.brand;
          if (!displaySpecifics['Size'] && (platData.size || previewListing.size)) displaySpecifics['Size'] = platData.size || previewListing.size;
          if (!displaySpecifics['Color'] && (platData.color || previewListing.color)) displaySpecifics['Color'] = platData.color || previewListing.color;
          if (!displaySpecifics['Material'] && (platData.material || previewListing.material)) displaySpecifics['Material'] = platData.material || previewListing.material;
          if (!displaySpecifics['Department'] && (platData.department || previewListing.department || platData.gender || previewListing.gender)) displaySpecifics['Department'] = platData.department || previewListing.department || platData.gender || previewListing.gender;
          if (!displaySpecifics['Style'] && (platData.style || previewListing.style || platData.fit || previewListing.fit)) displaySpecifics['Style'] = platData.style || previewListing.style || platData.fit || previewListing.fit;
          if (!displaySpecifics['Condition'] && displayCondition) displaySpecifics['Condition'] = displayCondition;
          if (!displaySpecifics['Condition Description'] && (platData.conditionDescription || previewListing.conditionDescription || previewListing.conditionNote)) {
            displaySpecifics['Condition Description'] = platData.conditionDescription || previewListing.conditionDescription || previewListing.conditionNote;
          }
        }
        const displayStatus = previewListing[`${activePlat}Status`] || (previewListing.platform === activePlat ? previewListing.status : 'none');
        const displayLiveId = getPlatformLiveId(previewListing, activePlat);
        const displayUrl = platData.url || previewListing[`${activePlat}Url`];

        return (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-6xl w-full max-h-[92vh] overflow-hidden shadow-2xl border border-slate-100 flex flex-col animate-in zoom-in-95 duration-200">
              {/* Modal Header */}
              <div className="px-6 py-4 bg-slate-50 border-b border-border flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Listing Preview</span>
                  <h3 className="text-lg font-bold text-slate-950 mt-0.5 break-words leading-snug">{displayTitle}</h3>
                </div>
                <div className="flex items-center gap-2 shrink-0 pt-0.5">
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
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">SKU</p>
                        {editingSkuId !== previewListing._id && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSkuId(previewListing._id);
                              setTempSkuValue(displaySku === '-' ? '' : displaySku);
                            }}
                            className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                          >
                            <Edit size={10} />
                            <span>Edit</span>
                          </button>
                        )}
                      </div>
                      {editingSkuId === previewListing._id ? (
                        <div className="mt-1 flex items-center gap-1.5">
                          <input
                            type="text"
                            value={tempSkuValue}
                            onChange={(e) => setTempSkuValue(e.target.value)}
                            placeholder="Enter SKU..."
                            className="text-xs font-mono font-bold bg-white border border-indigo-400 rounded-lg px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleQuickUpdateSku(previewListing._id, tempSkuValue);
                              } else if (e.key === 'Escape') {
                                setEditingSkuId(null);
                              }
                            }}
                          />
                          <button
                            type="button"
                            disabled={savingSku}
                            onClick={() => handleQuickUpdateSku(previewListing._id, tempSkuValue)}
                            className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-lg cursor-pointer shrink-0"
                          >
                            {savingSku ? '...' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingSkuId(null)}
                            className="px-1.5 py-1 text-slate-400 hover:text-slate-600 text-[10px] font-bold cursor-pointer shrink-0"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <p className="text-sm font-mono font-bold text-slate-800 mt-1 truncate">{displaySku}</p>
                      )}
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
                    {displayLiveId && displayLiveId !== '-' && (
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

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-slate-50 border-t border-border flex items-center justify-between font-sans">
                <Button
                  variant="outline"
                  onClick={() => setPreviewListing(null)}
                >
                  Close
                </Button>

                <div className="flex items-center gap-2.5">
                  {/* Live Link Button if available */}
                  {displayUrl && (
                    <a
                      href={displayUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors inline-flex items-center gap-1.5 shadow-2xs"
                    >
                      <span>Open Live Listing</span>
                      <ExternalLink size={13} />
                    </a>
                  )}

                  {/* Smart Dynamic Action Button */}
                  {(displayStatus === 'published' || displayStatus === 'active' || (displayLiveId && displayLiveId !== '-')) ? (
                    <button
                      type="button"
                      onClick={async () => {
                        setPreviewListing(null);
                        await handleDelistItem(previewListing, activePlat);
                      }}
                      className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <XCircle size={14} className="text-slate-500" />
                      <span>Delist from {getChannelDisplayName(activePlat)}</span>
                    </button>
                  ) : displayStatus === 'delisted' ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedListing(previewListing);
                        setSelectedPlatform(activePlat);
                        setIsEditMode(true);
                        setModalOpen(true);
                        setPreviewListing(null);
                      }}
                      className="px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-md shadow-indigo-200 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw size={14} />
                      <span>Relist on {getChannelDisplayName(activePlat)}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedListing(previewListing);
                        setSelectedPlatform(activePlat);
                        setIsEditMode(false);
                        setModalOpen(true);
                        setPreviewListing(null);
                      }}
                      className="px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-md shadow-indigo-200 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus size={14} />
                      <span>List on {getChannelDisplayName(activePlat)}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Smart Sync & Auto-Merge Modal */}
      {importModalOpen && (() => {
        const computedBreakdown = importBreakdown || (() => {
          let match5 = 0, match4 = 0, match3 = 0, match2 = 0, single = 0;
          let alreadyInLocalCount = 0, newToImportCount = 0, unlinkedChannelsTotal = 0;
          let totalActiveProducts = 0;
          const platformCounts = { ebay: 0, poshmark: 0, mercari: 0, etsy: 0, amazon: 0 };

          importGroups.forEach(g => {
            if (g.alreadyInLocal) alreadyInLocalCount++;
            else newToImportCount++;
            unlinkedChannelsTotal += (g.unlinkedChannelCount || 0);

            if (g.channelCount >= 5) match5++;
            else if (g.channelCount === 4) match4++;
            else if (g.channelCount === 3) match3++;
            else if (g.channelCount === 2) match2++;
            else single++;

            ['ebay', 'poshmark', 'mercari', 'etsy', 'amazon'].forEach(p => {
              if (g.channels?.[p]) {
                platformCounts[p]++;
                totalActiveProducts++;
              }
            });
          });

          return {
            totalActiveProducts,
            groupedCount: importGroups.length,
            match5, match4, match3, match2, single,
            alreadyInLocalCount,
            newToImportCount,
            unlinkedChannelsTotal,
            platformCounts
          };
        })();

        return (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl w-full max-w-[94vw] max-h-[92vh] overflow-hidden shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200 flex flex-col">

              {/* OVERVIEW MODE: 1-CLICK AUTO-SYNC & MATCH BREAKDOWN */}
              {importViewMode === 'overview' ? (
                <div className="flex flex-col flex-1 overflow-hidden">
                  {/* Overview Modal Header */}
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100/80 shrink-0">
                        <RefreshCw size={20} className={importLoading ? "animate-spin" : ""} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-base sm:text-lg font-black text-slate-900">Sync Platforms & Auto-Merge</h2>
                          <span className="px-2.5 py-0.5 text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200/80 rounded-full flex items-center gap-1">
                            <Zap size={10} className="fill-indigo-600" />
                            1-Click Auto Sync
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-semibold mt-0.5">
                          Auto-scan active listings across all connected marketplaces and merge matching products into your Local Database.
                        </p>
                      </div>
                    </div>

                    <IconButton
                      aria-label="Close"
                      onClick={() => setImportModalOpen(false)}
                    >
                      <X size={16} />
                    </IconButton>
                  </div>

                  {/* Overview Modal Body */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
                    {importLoading ? (
                      <div className="flex flex-col items-center justify-center py-24 space-y-3">
                        <RefreshCw size={32} className="text-indigo-600 animate-spin" />
                        <p className="text-sm font-black text-slate-800">Scanning & matching active channel listings...</p>
                        <p className="text-xs text-slate-400 font-medium">Checking eBay, Poshmark, Mercari, Etsy, and Amazon</p>
                      </div>
                    ) : importGroups.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 text-center">
                        <Package size={40} className="text-slate-300 mb-3" />
                        <h3 className="text-base font-extrabold text-slate-800">No Active Channel Listings Found</h3>
                        <p className="text-xs text-slate-500 max-w-md mt-1">
                          Make sure you have active listings synced in your channel inventory (eBay, Poshmark, Mercari, Etsy, Amazon).
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Top Summary Stats Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Active Channel Listings</span>
                              <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600"><CheckCircle2 size={14} /></span>
                            </div>
                            <p className="text-2xl font-black text-slate-900 mt-2">{computedBreakdown.totalActiveProducts}</p>
                            <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Found across connected marketplaces</p>
                          </div>

                          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Unique Master Products</span>
                              <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600"><Boxes size={14} /></span>
                            </div>
                            <p className="text-2xl font-black text-indigo-600 mt-2">{computedBreakdown.groupedCount}</p>
                            <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Grouped by SKU, Image & Title</p>
                          </div>

                          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Ready to Sync & Merge</span>
                              <span className="p-1.5 rounded-lg bg-violet-50 text-violet-600"><Zap size={14} /></span>
                            </div>
                            <p className="text-2xl font-black text-violet-700 mt-2">{computedBreakdown.newToImportCount}</p>
                            <p className="text-[11px] text-slate-500 font-semibold mt-0.5">{computedBreakdown.alreadyInLocalCount} already in database</p>
                          </div>
                        </div>

                        {/* Cross-Platform Match Breakdown Card */}
                        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                                <span>Cross-Platform Matching Breakdown</span>
                                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">Auto-Detected</span>
                              </h3>
                              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                                How your active listings are matched across marketplaces:
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                            {/* 5 Platforms */}
                            <div className="p-3.5 rounded-xl border border-indigo-200/80 bg-indigo-50/30 flex flex-col justify-between">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-black text-indigo-900">5 Platforms</span>
                                <span className="text-xs font-black px-2 py-0.5 rounded-full bg-indigo-600 text-white shadow-2xs">
                                  {computedBreakdown.match5}
                                </span>
                              </div>
                              <p className="text-[11px] text-indigo-700/80 font-semibold mt-2">All 5 Marketplaces</p>
                            </div>

                            {/* 4 Platforms */}
                            <div className="p-3.5 rounded-xl border border-blue-200/80 bg-blue-50/30 flex flex-col justify-between">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-black text-blue-900">4 Platforms</span>
                                <span className="text-xs font-black px-2 py-0.5 rounded-full bg-blue-600 text-white shadow-2xs">
                                  {computedBreakdown.match4}
                                </span>
                              </div>
                              <p className="text-[11px] text-blue-700/80 font-semibold mt-2">4 Marketplaces Match</p>
                            </div>

                            {/* 3 Platforms */}
                            <div className="p-3.5 rounded-xl border border-emerald-200/80 bg-emerald-50/30 flex flex-col justify-between">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-black text-emerald-900">3 Platforms</span>
                                <span className="text-xs font-black px-2 py-0.5 rounded-full bg-emerald-600 text-white shadow-2xs">
                                  {computedBreakdown.match3}
                                </span>
                              </div>
                              <p className="text-[11px] text-emerald-700/80 font-semibold mt-2">3 Marketplaces Match</p>
                            </div>

                            {/* 2 Platforms */}
                            <div className="p-3.5 rounded-xl border border-amber-200/80 bg-amber-50/30 flex flex-col justify-between">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-black text-amber-900">2 Platforms</span>
                                <span className="text-xs font-black px-2 py-0.5 rounded-full bg-amber-600 text-white shadow-2xs">
                                  {computedBreakdown.match2}
                                </span>
                              </div>
                              <p className="text-[11px] text-amber-700/80 font-semibold mt-2">2 Marketplaces Match</p>
                            </div>

                            {/* Single Platform */}
                            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-black text-slate-800">Single Channel</span>
                                <span className="text-xs font-black px-2 py-0.5 rounded-full bg-slate-700 text-white shadow-2xs">
                                  {computedBreakdown.single}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 font-semibold mt-2">Unique to 1 Marketplace</p>
                            </div>
                          </div>
                        </div>

                        {/* Marketplace Active Inventory Badges */}
                        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">Connected Marketplaces Active Items</h4>
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                            {[
                              { name: 'eBay', key: 'ebay', logo: '/ebay.png' },
                              { name: 'Poshmark', key: 'poshmark', logo: '/poshmark.png' },
                              { name: 'Mercari', key: 'mercari', logo: '/mercari.png' },
                              { name: 'Etsy', key: 'etsy', logo: '/etsy.png' },
                              { name: 'Amazon', key: 'amazon', logo: '/amazon.png' },
                            ].map(m => (
                              <div key={m.key} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/60">
                                <div className="flex items-center gap-2">
                                  <img src={m.logo} alt={m.name} className="w-5 h-5 object-contain" />
                                  <span className="text-xs font-bold text-slate-700">{m.name}</span>
                                </div>
                                <span className="text-xs font-black text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200/80">
                                  {computedBreakdown.platformCounts?.[m.key] || 0}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Overview Modal Footer */}
                  <div className="px-6 py-4 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
                    <div>
                      <button
                        type="button"
                        onClick={() => setImportViewMode('custom')}
                        disabled={importLoading || importGroups.length === 0}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black border border-slate-200/80 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                      >
                        <SlidersHorizontal size={14} className="text-indigo-600" />
                        <span>Review & Custom Select</span>
                      </button>
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
                        onClick={handleExecuteImportAll}
                        disabled={importSubmitting || importLoading || computedBreakdown.newToImportCount === 0}
                        className="flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl text-xs font-black shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer w-full sm:w-auto active:scale-[0.98]"
                      >
                        {importSubmitting ? (
                          <>
                            <RefreshCw size={14} className="animate-spin" />
                            <span>Syncing to Local...</span>
                          </>
                        ) : (
                          <>
                            <Zap size={14} className="fill-white" />
                            <span>1-Click Auto Sync & Merge All ({computedBreakdown.newToImportCount} Items)</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* CUSTOM / ADVANCED SELECTION MODE */
                <div className="flex flex-col flex-1 overflow-hidden">
                  {/* Custom Mode Header */}
                  <div className="px-6 py-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white shrink-0">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setImportViewMode('overview')}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 text-xs font-bold"
                        title="Back to Overview"
                      >
                        <ArrowLeft size={16} />
                        <span className="hidden sm:inline">Overview</span>
                      </button>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-base sm:text-lg font-black text-slate-900">Custom Selection</h2>
                          <span className="px-2.5 py-0.5 text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                            Active Only
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-semibold mt-0.5">
                          Select specific items or individual platform channels to import into Local Database.
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
                  <div className="px-6 py-2.5 bg-slate-50/80 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
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
                    {filteredImportGroups.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 text-center">
                        <Package size={36} className="text-slate-300 mb-2" />
                        <h3 className="text-sm font-extrabold text-slate-700">No active channel items found</h3>
                        <p className="text-xs text-slate-400 max-w-md mt-1">
                          {importSearchTerm ? 'No items match your search term.' : 'Make sure you have active listings synced in your channel inventory (eBay, Poshmark, Mercari, Etsy, Amazon).'}
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
                                          {getDisplaySku(group.sku) || '-'}
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

                  {/* Custom Mode Footer */}
                  <div className="px-6 py-4 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
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
                        onClick={() => setImportViewMode('overview')}
                        className="w-full sm:w-auto"
                      >
                        ← Back to Overview
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
              )}

            </div>
          </div>
        );
      })()}

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
                                        SKU: {getDisplaySku(master.sku)}
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
