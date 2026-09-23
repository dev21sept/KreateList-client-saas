import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Upload, 
  ImageIcon,
  DollarSign,
  Zap,
  Sparkles,
  Loader2,
  X,
  Tag,
  Eye,
  Trash2,
  ArrowLeft,
  ArrowRight,
  ShoppingBag,
  RefreshCw,
  Check,
  ChevronDown,
  Layers,
  Globe,
  Package,
  Plus,
  Code,
  FileText
} from 'lucide-react';
import { 
  ruleService, 
  aiService, 
  listingService, 
  ebayService, 
  etsyService, 
  mercariService, 
  poshmarkService, 
  amazonService,
  externalImportService 
} from '../services/api';
import CategorySearchDropdown from '../components/CategorySearchDropdown';
import { useNotification } from '../context/NotificationContext';
import { compressImage } from '../utils/imageCompressor';
import Button from '../components/ui/Button';
import IconButton from '../components/ui/IconButton';
import { Badge } from '../components/ui/Badge';
import { POSHMARK_CONDITIONS } from '../constants/poshmarkConditions';
import mercariTaxonomy from '../../../backend/constants/mercariCategoryTaxonomy.json';

const { MERCARI_CATEGORY_TREE } = mercariTaxonomy;

const POPULAR_BRANDS = [
  { id: 4578, name: "Nike" },
  { id: 54, name: "Adidas" },
  { id: 3370, name: "Jordan" },
  { id: 115, name: "Air Jordan" },
  { id: 3778, name: "Levi's" },
  { id: 5487, name: "ROCKMOUNT" },
  { id: 27436, name: "Rockmount Ranchwear" },
  { id: 969, name: "Carhartt" },
  { id: 4867, name: "Patagonia" },
  { id: 5212, name: "Polo Ralph Lauren" },
  { id: 5971, name: "The North Face" },
  { id: 6223, name: "Under Armour" }
];

const PLATFORMS_CONFIG = [
  { id: 'ebay', name: 'eBay', logo: '/ebay.png' },
  { id: 'poshmark', name: 'Poshmark', logo: '/poshmark.png' },
  { id: 'mercari', name: 'Mercari', logo: '/mercari.png' },
  { id: 'etsy', name: 'Etsy', logo: '/etsy.png' },
  { id: 'amazon', name: 'Amazon', logo: '/amazon.png' }
];

const MASTER_CONDITIONS = [
  { id: "new", label: "New (with tags / box)", description: "Brand new, unused, unopened with tags/original packaging." },
  { id: "like_new", label: "Like New (Mint)", description: "Mint condition pre-owned, looks and feels brand new." },
  { id: "good", label: "Good (Gently Used)", description: "Gently used, minor signs of wear but in great shape." },
  { id: "fair", label: "Fair (Visible Wear)", description: "Noticeable wear, cosmetic marks or blemishes." }
];

const MERCARI_CONDITIONS = [
  { id: "new", label: "New (with tags)" },
  { id: "like_new", label: "Like New" },
  { id: "good", label: "Good" },
  { id: "fair", label: "Fair" },
  { id: "poor", label: "Poor" }
];

const POSHMARK_DEPARTMENTS = [
  { id: 'Women', label: 'Women' },
  { id: 'Men', label: 'Men' },
  { id: 'Kids', label: 'Kids' },
  { id: 'Home', label: 'Home' },
  { id: 'Pets', label: 'Pets' }
];

const SearchableDropdown = ({ value, onSelect, options = [], placeholder = 'Select...', disabled = false, error = false, className = '' }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => {
      const label = String(opt?.label || opt?.name || '').toLowerCase();
      const desc = String(opt?.description || '').toLowerCase();
      return label.includes(q) || desc.includes(q);
    });
  }, [options, searchTerm]);

  return (
    <div className={`relative w-full ${className}`} ref={wrapperRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full h-11 px-3.5 bg-white border ${
          error ? 'border-rose-500 focus:ring-rose-500/10' : 'border-slate-200 hover:border-slate-300 focus:border-slate-400 focus:ring-1 focus:ring-slate-300'
        } rounded-xl text-left flex items-center justify-between text-xs font-bold text-slate-700 disabled:opacity-60 transition-all`}
      >
        <span className="truncate">{value || placeholder}</span>
        <span className="flex items-center gap-1 shrink-0 ml-1.5">
          {value && !disabled && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onSelect({ id: '', label: '', name: '' });
                setSearchTerm('');
              }}
              className="p-0.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {isOpen && !disabled && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-[500] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="p-2.5 bg-slate-50 border-b border-slate-100">
            <input
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
              className="w-full h-8.5 px-3 rounded-lg border border-slate-200 text-xs font-semibold outline-none focus:border-slate-400"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => (
                <button
                  key={opt.id || opt.label || opt.name}
                  type="button"
                  onClick={() => {
                    onSelect(opt);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                  className={`w-full text-left px-3.5 py-2.5 border-b border-slate-50 last:border-b-0 hover:bg-slate-100 text-xs font-bold transition-colors ${
                    value === (opt.label || opt.name) ? 'bg-slate-100 text-slate-900' : 'text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="leading-snug break-words">{opt.label || opt.name}</span>
                    {value === (opt.label || opt.name) && <Check className="w-3.5 h-3.5 text-slate-800 shrink-0" />}
                  </div>
                  {opt.description && (
                    <p className="text-[10px] text-slate-400 font-normal mt-0.5">{opt.description}</p>
                  )}
                </button>
              ))
            ) : (
              <div className="p-3.5 text-xs text-slate-400 text-center">No options found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const CreateMasterListing = ({ 
  isModal = false, 
  editId: propEditId = null, 
  initialListing = null, 
  initialPlatform = null,
  isSinglePlatformOnly = false,
  isEditMode: propIsEditMode = false,
  onClose = null, 
  onSyncSuccess = null 
}) => {
  const navigate = useNavigate();
  const { toast } = useNotification();
  const [searchParams] = useSearchParams();
  const editId = propEditId || searchParams.get('edit');
  const queryPlatform = searchParams.get('platform');
  const isEditMode = propIsEditMode || Boolean(editId);

  // Selected Target Platforms state
  const [selectedPlatforms, setSelectedPlatforms] = useState(() => {
    if (initialPlatform) return [initialPlatform];
    if (queryPlatform) return [queryPlatform];
    if (initialListing?.platform) return [initialListing.platform];
    return ['ebay', 'poshmark', 'mercari', 'etsy', 'amazon'];
  });

  const [hasScanned, setHasScanned] = useState(Boolean(editId || initialListing));
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [descriptionMode, setDescriptionMode] = useState('edit'); // 'edit' or 'preview'
  const [rules, setRules] = useState([]);
  const [files, setFiles] = useState([]);
  const [isConvertingImages, setIsConvertingImages] = useState(false);
  const [draggedImgIdx, setDraggedImgIdx] = useState(null);
  const [dragOverImgIdx, setDragOverImgIdx] = useState(null);

  // Platform Specific Extra States
  const [ebayPolicies, setEbayPolicies] = useState({ fulfillment: [], payment: [], returns: [], locations: [] });
  const [ebayAspects, setEbayAspects] = useState([]);
  const [shippingProfiles, setShippingProfiles] = useState([]);
  const [etsyProperties, setEtsyProperties] = useState([]);

  // Custom Aspect Input State (for eBay)
  const [newAspectName, setNewAspectName] = useState('');
  const [newAspectValue, setNewAspectValue] = useState('');
  const [showAddAspect, setShowAddAspect] = useState(false);

  // Mercari Brand Autocomplete State
  const [mercariBrandQuery, setMercariBrandQuery] = useState('');
  const [mercariBrandSuggestions, setMercariBrandSuggestions] = useState([]);
  const [isMercariBrandOpen, setIsMercariBrandOpen] = useState(false);
  const mercariBrandRef = useRef(null);

  // Unified Form Data State with Master + Individual Platform Pricing & Specifics
  const [formData, setFormData] = useState({
    // Master Fields (Universal)
    images: [],
    selectedRule: '',
    selectedCondition: 'Good (Gently Used)',
    conditionId: 'good',
    title: '',
    price: '', // Master Selling Price
    originalPrice: '', // Master Original Price
    sku: '',
    brand: '',
    size: '',
    color: '',
    quantity: '1',
    description: '',
    selectedModel: 'gpt-4o-mini',
    packageWeight: { lbs: 1, oz: 0 },
    packageDimensions: { length: 10, width: 8, height: 2 },

    // eBay Specific
    ebayCategory: '',
    ebayCategoryId: '',
    ebayPrice: '',
    ebayCondition: 'Pre-owned - Good',
    ebayAspects: {},
    fulfillmentPolicyId: '',
    paymentPolicyId: '',
    returnPolicyId: '',
    locationKey: '',

    // Poshmark Specific
    poshmarkDepartment: 'Women',
    poshmarkCategory: '',
    poshmarkPrice: '',
    poshmarkOriginalPrice: '',
    poshmarkSubcategory: '',
    poshmarkSize: '',
    poshmarkCondition: 'Good',
    poshmarkStyleTags: '',

    // Mercari Specific
    mercariCategory: '',
    mercariCategoryId: '',
    mercariPrice: '',
    mercariBrand: '',
    mercariBrandId: '',
    mercariCondition: 'good',
    mercariShippingPayer: 'seller',

    // Etsy Specific
    etsyCategory: '',
    etsyCategoryId: '',
    etsyPrice: '',
    who_made: 'i_did',
    when_made: '2020_2026',
    is_supply: 'false',
    renewal: 'manual',
    shipping_profile_id: '',
    etsyAttributes: {},
    material: '',
    styleTag: '',

    // Amazon Specific
    amazonAsin: '',
    amazonPrice: '',
    amazonStandardProductId: { idType: 'UPC', value: '' },
    amazonProductType: '',
    amazonCondition: 'Used - Good'
  });

  const modelOptions = useMemo(() => [
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini (OpenAI)', description: 'Fast, cost-efficient model' },
    { id: 'gpt-4o', label: 'GPT-4o (OpenAI)', description: 'High-accuracy multi-modal model' },
    { id: 'gpt-4-turbo', label: 'GPT-4 Turbo (OpenAI)', description: 'Legacy high-performance model' },
    { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (Google)', description: 'Ultra-fast Google AI model' },
    { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (Google)', description: 'Intelligent Google AI model' },
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (Google)', description: 'Latest ultra-fast Google AI model' }
  ], []);

  // Fetch Rules & Initial Setup
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const rulesRes = await ruleService.getAll();
        if (rulesRes.data?.success) {
          setRules(rulesRes.data.data);
          const defaultRule = rulesRes.data.data.find(r => r.isDefault) || rulesRes.data.data[0];
          if (defaultRule && !editId && !initialListing) {
            setFormData(prev => ({
              ...prev,
              selectedRule: defaultRule._id || defaultRule.id
            }));
          }
        }
      } catch (err) {
        console.error("Failed to fetch rules:", err);
      }

      // Fetch eBay Policies
      try {
        const policiesRes = await ebayService.getPolicies();
        if (policiesRes.data?.success) {
          const pData = policiesRes.data.data || {};
          setEbayPolicies(pData);
          setFormData(prev => ({
            ...prev,
            fulfillmentPolicyId: prev.fulfillmentPolicyId || pData.fulfillment?.[0]?.fulfillmentPolicyId || '',
            paymentPolicyId: prev.paymentPolicyId || pData.payment?.[0]?.paymentPolicyId || '',
            returnPolicyId: prev.returnPolicyId || pData.returns?.[0]?.returnPolicyId || '',
            locationKey: prev.locationKey || pData.locations?.[0]?.merchantLocationKey || ''
          }));
        }
      } catch (err) {
        console.warn("Could not fetch eBay policies:", err);
      }

      // Fetch Etsy Shipping Profiles
      try {
        const profilesRes = await etsyService.getShippingProfiles();
        if (profilesRes.data?.success) {
          setShippingProfiles(profilesRes.data.data || []);
          if (profilesRes.data.data?.length > 0 && !formData.shipping_profile_id) {
            setFormData(prev => ({
              ...prev,
              shipping_profile_id: prev.shipping_profile_id || profilesRes.data.data[0].shipping_profile_id
            }));
          }
        }
      } catch (err) {
        console.warn("Could not fetch Etsy shipping profiles:", err);
      }
    };

    fetchInitialData();
  }, [editId]);

  // Load initial listing or fetch from API if editId is provided
  useEffect(() => {
    const populateListingData = (listing) => {
      if (!listing) return;
      const ebData = listing.platformData?.ebay || (listing.listingsMap?.ebay ? listing.listingsMap.ebay : {}) || {};
      const pmData = listing.platformData?.poshmark || (listing.listingsMap?.poshmark ? listing.listingsMap.poshmark : {}) || {};
      const mcData = listing.platformData?.mercari || (listing.listingsMap?.mercari ? listing.listingsMap.mercari : {}) || {};
      const etData = listing.platformData?.etsy || (listing.listingsMap?.etsy ? listing.listingsMap.etsy : {}) || {};
      const amData = listing.platformData?.amazon || (listing.listingsMap?.amazon ? listing.listingsMap.amazon : {}) || {};

      // Determine active platforms
      if (!isSinglePlatformOnly) {
        const activePlats = new Set();
        PLATFORMS_CONFIG.forEach(p => {
          if (
            listing.platform === p.id ||
            listing[`${p.id}Status`] === 'published' ||
            listing[`${p.id}ListingId`] ||
            listing.platformData?.[p.id] ||
            (listing.listingsMap && listing.listingsMap[p.id])
          ) {
            activePlats.add(p.id);
          }
        });
        if (initialPlatform) activePlats.add(initialPlatform);
        if (queryPlatform) activePlats.add(queryPlatform);
        if (activePlats.size > 0) {
          setSelectedPlatforms(Array.from(activePlats));
        }
      }

      // Extract raw aspects / specifics for eBay
      let rawAspects = {};
      const srcAspects = ebData.itemSpecifics || listing.itemSpecifics || listing.selectedAspects || ebData.selectedAspects || listing.aspects || {};
      if (srcAspects && typeof srcAspects === 'object') {
        if (srcAspects instanceof Map) {
          srcAspects.forEach((val, key) => { rawAspects[key] = Array.isArray(val) ? val : [val]; });
        } else {
          Object.entries(srcAspects).forEach(([k, v]) => {
            rawAspects[k] = Array.isArray(v) ? v : [v];
          });
        }
      }

      // Merge base product aspects
      const bBrand = listing.brand || ebData.brand || mcData.brand || '';
      const bSize = listing.size || ebData.size || mcData.size || pmData.size || '';
      const bColor = listing.color || ebData.color || mcData.color || '';
      const bMaterial = listing.material || ebData.material || etData.material || '';
      const bDepartment = listing.departmentId || pmData.departmentId || '';

      if (bBrand && !rawAspects['Brand']) rawAspects['Brand'] = [bBrand];
      if (bSize && !rawAspects['Size']) rawAspects['Size'] = [bSize];
      if (bColor && !rawAspects['Color']) rawAspects['Color'] = [bColor];
      if (bMaterial && !rawAspects['Material']) rawAspects['Material'] = [bMaterial];
      if (bDepartment && !rawAspects['Department']) rawAspects['Department'] = [bDepartment];

      // Robust Description Resolver
      const resolvedDesc = 
        listing.description || 
        ebData.description || 
        pmData.description || 
        mcData.description || 
        etData.description || 
        amData.description || 
        listing.listingsMap?.ebay?.description ||
        listing.listingsMap?.mercari?.description ||
        listing.listingsMap?.poshmark?.description ||
        listing.listingsMap?.etsy?.description ||
        listing.details?.description ||
        '';

      const masterPrice = listing.price !== undefined && listing.price !== '' ? String(listing.price) : (ebData.price ? String(ebData.price) : '');
      const ebPrice = ebData.price !== undefined && ebData.price !== '' ? String(ebData.price) : (listing.ebayPrice ? String(listing.ebayPrice) : '');
      const pmPrice = pmData.price !== undefined && pmData.price !== '' ? String(pmData.price) : (listing.poshmarkPrice ? String(listing.poshmarkPrice) : '');
      const mcPrice = mcData.price !== undefined && mcData.price !== '' ? String(mcData.price) : (listing.mercariPrice ? String(listing.mercariPrice) : '');
      const etPrice = etData.price !== undefined && etData.price !== '' ? String(etData.price) : (listing.etsyPrice ? String(listing.etsyPrice) : '');
      const amPrice = amData.price !== undefined && amData.price !== '' ? String(amData.price) : (listing.amazonPrice ? String(listing.amazonPrice) : '');

      const catId = ebData.categoryId || listing.categoryId || '';
      const ebCategory = ebData.category || listing.ebayCategory || (listing.platform === 'ebay' ? listing.category : '') || '';
      const pmCategory = pmData.category || listing.poshmarkCategory || (listing.platform === 'poshmark' ? listing.category : '') || '';
      const mcCategory = mcData.category || listing.mercariCategory || (listing.platform === 'mercari' ? listing.category : '') || '';
      const etCategory = etData.category || listing.etsyCategory || (listing.platform === 'etsy' ? listing.category : '') || '';

      setFormData(prev => ({
        ...prev,
        images: (listing.images && listing.images.length > 0) ? listing.images : (listing.thumbnail ? [listing.thumbnail] : []),
        selectedRule: listing.selectedRule || prev.selectedRule,
        selectedCondition: listing.selectedCondition || prev.selectedCondition,
        conditionId: listing.conditionId || prev.conditionId,
        title: listing.title || ebData.title || pmData.title || mcData.title || prev.title,
        price: masterPrice || prev.price,
        originalPrice: listing.originalPrice !== undefined ? String(listing.originalPrice) : prev.originalPrice,
        sku: listing.sku || ebData.sku || mcData.sku || prev.sku,
        brand: bBrand || prev.brand,
        size: bSize || prev.size,
        color: bColor || prev.color,
        quantity: String(listing.quantity || '1'),
        description: resolvedDesc || prev.description,
        selectedModel: listing.selectedModel || prev.selectedModel,
        packageWeight: listing.packageWeight || ebData.packageWeight || prev.packageWeight,
        packageDimensions: listing.packageDimensions || ebData.packageDimensions || prev.packageDimensions,

        // eBay
        ebayCategory: ebCategory || prev.ebayCategory,
        ebayCategoryId: catId || prev.ebayCategoryId,
        ebayPrice: ebPrice || prev.ebayPrice,
        ebayCondition: ebData.selectedCondition || ebData.condition || listing.selectedCondition || prev.ebayCondition,
        ebayAspects: { ...prev.ebayAspects, ...rawAspects },
        fulfillmentPolicyId: ebData.fulfillmentPolicyId || listing.fulfillmentPolicyId || prev.fulfillmentPolicyId,
        paymentPolicyId: ebData.paymentPolicyId || listing.paymentPolicyId || prev.paymentPolicyId,
        returnPolicyId: ebData.returnPolicyId || listing.returnPolicyId || prev.returnPolicyId,
        locationKey: ebData.locationKey || listing.locationKey || prev.locationKey,

        // Poshmark
        poshmarkDepartment: pmData.departmentId || listing.departmentId || prev.poshmarkDepartment,
        poshmarkCategory: pmCategory || prev.poshmarkCategory,
        poshmarkPrice: pmPrice || prev.poshmarkPrice,
        poshmarkOriginalPrice: pmData.originalPrice !== undefined ? String(pmData.originalPrice) : prev.poshmarkOriginalPrice,
        poshmarkSubcategory: pmData.subcategoryIds?.[0] || listing.subcategoryIds?.[0] || prev.poshmarkSubcategory,
        poshmarkSize: pmData.size || listing.size || prev.poshmarkSize,
        poshmarkCondition: pmData.condition || listing.selectedCondition || prev.poshmarkCondition,
        poshmarkStyleTags: pmData.styleTag || listing.styleTag || prev.poshmarkStyleTags,

        // Mercari
        mercariCategory: mcCategory || prev.mercariCategory,
        mercariCategoryId: mcData.categoryId || listing.categoryId || prev.mercariCategoryId,
        mercariPrice: mcPrice || prev.mercariPrice,
        mercariBrand: mcData.brand || bBrand || prev.mercariBrand,
        mercariBrandId: mcData.brandId || listing.brandId || prev.mercariBrandId,
        mercariCondition: mcData.condition || prev.mercariCondition,
        mercariShippingPayer: mcData.shippingPayer || listing.shippingPayer || prev.mercariShippingPayer,

        // Etsy
        etsyCategory: etCategory || prev.etsyCategory,
        etsyCategoryId: etData.categoryId || listing.categoryId || prev.etsyCategoryId,
        etsyPrice: etPrice || prev.etsyPrice,
        who_made: etData.who_made || listing.etsyWhoMade || prev.who_made,
        when_made: etData.when_made || listing.etsyWhenMade || prev.when_made,
        is_supply: String(etData.is_supply !== undefined ? etData.is_supply : (listing.etsyIsSupply !== undefined ? listing.etsyIsSupply : 'false')),
        renewal: etData.renewal || listing.etsyRenewal || prev.renewal,
        shipping_profile_id: etData.shipping_profile_id || listing.etsyShippingProfileId || prev.shipping_profile_id,
        etsyAttributes: etData.etsyAttributes || listing.etsyAttributes || prev.etsyAttributes,
        material: bMaterial || prev.material,
        styleTag: etData.styleTag || listing.styleTag || prev.styleTag,

        // Amazon
        amazonAsin: amData.asin || listing.amazonAsin || prev.amazonAsin,
        amazonPrice: amPrice || prev.amazonPrice,
        amazonStandardProductId: amData.standardProductId || listing.amazonStandardProductId || prev.amazonStandardProductId,
        amazonProductType: amData.productType || listing.amazonProductType || prev.amazonProductType,
        amazonCondition: amData.condition || listing.amazonCondition || prev.amazonCondition
      }));

      if (catId) {
        ebayService.getCategoryAspects(catId)
          .then(res => {
            if (res.data?.success && Array.isArray(res.data.data)) {
              setEbayAspects(res.data.data);
            }
          })
          .catch(e => console.warn("Failed to fetch category aspects:", e));
      }

      setHasScanned(true);
    };

    if (initialListing) {
      populateListingData(initialListing);
    } else if (editId) {
      setLoading(true);
      listingService.getOne(editId)
        .then(res => {
          if (res.data?.success) {
            populateListingData(res.data.data);
          }
        })
        .catch(err => {
          console.error("Failed to load listing for editing:", err);
          toast.error("Failed to load listing details.");
        })
        .finally(() => setLoading(false));
    }
  }, [initialListing, editId, isSinglePlatformOnly, initialPlatform, queryPlatform]);

  // Fetch eBay Category Aspects when eBay Category ID changes
  useEffect(() => {
    if (formData.ebayCategoryId) {
      ebayService.getCategoryAspects(formData.ebayCategoryId)
        .then(res => {
          if (res.data?.success && Array.isArray(res.data.data)) {
            setEbayAspects(res.data.data);
          }
        })
        .catch(err => console.warn("Could not fetch eBay aspects:", err));
    }
  }, [formData.ebayCategoryId]);

  // Fetch Etsy Category Properties when Etsy Category ID changes
  useEffect(() => {
    if (formData.etsyCategoryId) {
      etsyService.getCategoryProperties(formData.etsyCategoryId)
        .then(res => {
          if (res.data?.success && Array.isArray(res.data.data)) {
            setEtsyProperties(res.data.data);
          }
        })
        .catch(err => console.warn("Could not fetch Etsy properties:", err));
    }
  }, [formData.etsyCategoryId]);

  // Mercari Category Options from Tree (Full Paths)
  const mercariCategoryOptions = useMemo(() => {
    const list = [];
    const traverse = (node, path = '') => {
      if (!node) return;
      const currentPath = path ? `${path} > ${node.name}` : node.name;
      if (node.children && node.children.length > 0) {
        node.children.forEach(child => traverse(child, currentPath));
      } else {
        list.push({ id: String(node.id), label: currentPath });
      }
    };
    if (Array.isArray(MERCARI_CATEGORY_TREE)) {
      MERCARI_CATEGORY_TREE.forEach(root => traverse(root));
    }
    return list;
  }, []);

  // Toggle platform selection
  const handleTogglePlatform = (platformId) => {
    if (isSinglePlatformOnly) return;
    setSelectedPlatforms(prev => {
      if (prev.includes(platformId)) {
        if (prev.length === 1) {
          toast.warning("At least one platform must be selected.");
          return prev;
        }
        return prev.filter(p => p !== platformId);
      } else {
        return [...prev, platformId];
      }
    });
  };

  // Image Upload Handler
  const handleImageUpload = async (e) => {
    const uploadedFiles = Array.from(e.target.files);
    if (uploadedFiles.length === 0) return;
    setFiles(prev => [...prev, ...uploadedFiles]);
    setIsConvertingImages(true);
    try {
      const base64Images = await Promise.all(
        uploadedFiles.map(file => compressImage(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.8 }))
      );
      setFormData(prev => ({ ...prev, images: [...prev.images, ...base64Images] }));
    } catch (err) {
      console.error("Error processing images:", err);
      toast.error("Failed to process some images.");
    } finally {
      setIsConvertingImages(false);
    }
  };

  const handleReorderImages = (sourceIndex, targetIndex) => {
    if (sourceIndex === null || targetIndex === null || sourceIndex === targetIndex) return;
    const newImages = [...formData.images];
    const [movedImg] = newImages.splice(sourceIndex, 1);
    newImages.splice(targetIndex, 0, movedImg);
    setFormData(prev => ({ ...prev, images: newImages }));
    setDraggedImgIdx(null);
    setDragOverImgIdx(null);
  };

  const deleteImage = (index) => {
    const newImages = formData.images.filter((_, idx) => idx !== index);
    setFormData(prev => ({ ...prev, images: newImages }));
  };

  const moveImage = (index, direction) => {
    const newImages = [...formData.images];
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newImages.length) return;
    [newImages[index], newImages[targetIndex]] = [newImages[targetIndex], newImages[index]];
    setFormData(prev => ({ ...prev, images: newImages }));
  };

  // Mercari Brand Search
  const handleMercariBrandSearch = async (val) => {
    setMercariBrandQuery(val);
    setFormData(prev => ({ ...prev, mercariBrand: val, brand: prev.brand || val }));
    if (!val || val.length < 2) {
      setMercariBrandSuggestions(POPULAR_BRANDS);
      return;
    }
    try {
      const res = await mercariService.suggestBrands(val);
      if (res.data?.success && Array.isArray(res.data.data)) {
        setMercariBrandSuggestions(res.data.data);
      }
    } catch (e) {
      const filtered = POPULAR_BRANDS.filter(b => b.name.toLowerCase().includes(val.toLowerCase()));
      setMercariBrandSuggestions(filtered);
    }
  };

  // Handle Changing Individual eBay Item Specific
  const handleAspectChange = (aspectName, value) => {
    setFormData(prev => {
      const nextAspects = { ...prev.ebayAspects };
      if (value === '' || value === null || value === undefined) {
        delete nextAspects[aspectName];
      } else {
        nextAspects[aspectName] = Array.isArray(value) ? value : [value];
      }

      // Sync standard fields if matching
      const extraUpdates = {};
      const lName = aspectName.toLowerCase();
      if (lName === 'brand') {
        extraUpdates.brand = value;
        extraUpdates.mercariBrand = value;
      } else if (lName === 'size') {
        extraUpdates.size = value;
        extraUpdates.poshmarkSize = value;
      } else if (lName === 'color') {
        extraUpdates.color = value;
      } else if (lName === 'material') {
        extraUpdates.material = value;
      } else if (lName === 'department') {
        extraUpdates.poshmarkDepartment = value;
      }

      return {
        ...prev,
        ebayAspects: nextAspects,
        ...extraUpdates
      };
    });
  };

  // Handle Adding New Custom eBay Aspect
  const handleAddCustomAspect = () => {
    const trimmedName = newAspectName.trim();
    const trimmedValue = newAspectValue.trim();
    if (!trimmedName || !trimmedValue) {
      toast.warning("Please provide both Aspect Name and Value.");
      return;
    }
    handleAspectChange(trimmedName, trimmedValue);
    setNewAspectName('');
    setNewAspectValue('');
    setShowAddAspect(false);
    toast.success(`Added item specific: ${trimmedName}`);
  };

  // Handle Deleting an eBay Aspect
  const handleDeleteAspect = (aspectName) => {
    handleAspectChange(aspectName, '');
  };

  // AI Scan & Prefill Handler
  const startAIFetch = async () => {
    if (formData.images.length === 0) {
      toast.warning("Please upload at least one image first.");
      return;
    }
    if (!formData.selectedRule) {
      toast.warning("Please select an AI Rule.");
      return;
    }

    setLoading(true);
    setHasScanned(true);

    const selectedRuleObj = rules.find(r => (r._id || r.id) === formData.selectedRule);

    try {
      toast.info("AI is analyzing images, extracting item specifics & building description...");
      const response = await aiService.analyze({
        images: formData.images,
        platform: selectedPlatforms[0] || 'ebay',
        title_sequence: selectedRuleObj?.title_sequence || [],
        description_prompt: selectedRuleObj?.description_prompt || '',
        description_template: selectedRuleObj?.description_template || '',
        condition_note: selectedRuleObj?.condition_note || '',
        condition_name: formData.selectedCondition,
        model: formData.selectedModel || 'gpt-4o-mini',
        existing_title: formData.title || ''
      });

      if (response.data?.success) {
        const res = response.data.data;
        const genSku = res.sku || formData.sku || `KL${Date.now().toString().slice(-6)}`;
        
        // Extract all raw item specifics from AI response
        const rawSpecifics = res.item_specifics || res.itemSpecifics || res.selectedAspects || {};
        const mergedAspects = { ...formData.ebayAspects };

        Object.entries(rawSpecifics).forEach(([k, v]) => {
          if (v) mergedAspects[k] = Array.isArray(v) ? v : [String(v)];
        });

        if (res.brand && !mergedAspects['Brand']) mergedAspects['Brand'] = [res.brand];
        if (res.color && !mergedAspects['Color']) mergedAspects['Color'] = [res.color];
        if (res.size && !mergedAspects['Size']) mergedAspects['Size'] = [res.size];
        if (res.material && !mergedAspects['Material']) mergedAspects['Material'] = [res.material];
        if (res.type && !mergedAspects['Type']) mergedAspects['Type'] = [res.type];
        if (res.department && !mergedAspects['Department']) mergedAspects['Department'] = [res.department];

        if (res.aspects && Array.isArray(res.aspects) && res.aspects.length > 0) {
          setEbayAspects(res.aspects);
        }

        const resolvedDescription = res.description || res.item_description || res.templatedDescription || formData.description;
        const aiPrice = res.price !== undefined && res.price !== '' ? String(res.price) : (formData.price || '29.99');
        const aiCategory = res.category_name || res.category || '';

        setFormData(prev => ({
          ...prev,
          title: res.title || prev.title,
          price: aiPrice,
          originalPrice: res.originalPrice !== undefined ? String(res.originalPrice) : (prev.originalPrice || '59.99'),
          description: resolvedDescription || prev.description,
          sku: genSku,
          brand: res.brand || prev.brand,
          size: res.size || prev.size,
          color: res.color || prev.color,
          material: res.material || prev.material,
          
          // eBay
          ebayCategory: aiCategory || prev.ebayCategory,
          ebayCategoryId: res.category_id || res.categoryId || prev.ebayCategoryId,
          ebayPrice: prev.ebayPrice || aiPrice,
          ebayAspects: mergedAspects,
          
          // Mercari
          mercariBrand: res.brand || prev.mercariBrand,
          mercariCategory: aiCategory || prev.mercariCategory,
          mercariPrice: prev.mercariPrice || aiPrice,
          
          // Poshmark
          poshmarkCategory: aiCategory || prev.poshmarkCategory,
          poshmarkPrice: prev.poshmarkPrice || aiPrice,
          poshmarkSize: res.size || prev.poshmarkSize,
          poshmarkDepartment: res.department || prev.poshmarkDepartment,
          
          // Etsy
          etsyCategory: aiCategory || prev.etsyCategory,
          etsyCategoryId: res.category_id || res.categoryId || prev.etsyCategoryId,
          etsyPrice: prev.etsyPrice || aiPrice,

          // Amazon
          amazonPrice: prev.amazonPrice || aiPrice
        }));

        toast.success("AI Scan complete! Product details, specifics & description populated.");
      }
    } catch (error) {
      console.error("AI Scan Error:", error);
      toast.error("Failed to analyze images with AI.");
    } finally {
      setLoading(false);
    }
  };

  // Build unified payload for Database Save / Update
  const buildListingPayload = (targetStatus = 'draft') => {
    return {
      title: formData.title || 'Untitled Product',
      description: formData.description || '',
      price: formData.price || '0.00',
      originalPrice: formData.originalPrice || '',
      sku: formData.sku || `KL${Date.now().toString().slice(-6)}`,
      brand: formData.brand || '',
      size: formData.size || '',
      color: formData.color || '',
      quantity: parseInt(formData.quantity) || 1,
      category: formData.ebayCategory || formData.mercariCategory || formData.etsyCategory || formData.poshmarkCategory || 'General',
      categoryId: formData.ebayCategoryId || formData.mercariCategoryId || formData.etsyCategoryId || '',
      images: formData.images,
      thumbnail: formData.images[0] || '',
      status: targetStatus,
      selectedRule: formData.selectedRule,
      selectedCondition: formData.selectedCondition,
      conditionId: formData.conditionId,
      selectedModel: formData.selectedModel,
      packageWeight: formData.packageWeight,
      packageDimensions: formData.packageDimensions,

      // Top level fields for backwards compatibility
      fulfillmentPolicyId: formData.fulfillmentPolicyId,
      paymentPolicyId: formData.paymentPolicyId,
      returnPolicyId: formData.returnPolicyId,
      locationKey: formData.locationKey,
      itemSpecifics: formData.ebayAspects,
      etsyWhoMade: formData.who_made,
      etsyWhenMade: formData.when_made,
      etsyIsSupply: formData.is_supply === 'true',
      etsyRenewal: formData.renewal,
      etsyShippingProfileId: formData.shipping_profile_id,
      etsyAttributes: formData.etsyAttributes,
      material: formData.material,
      styleTag: formData.styleTag || formData.poshmarkStyleTags,

      // Structured platformData container
      platformData: {
        ebay: {
          title: formData.title,
          price: formData.ebayPrice || formData.price || '0.00',
          description: formData.description,
          category: formData.ebayCategory,
          categoryId: formData.ebayCategoryId,
          selectedCondition: formData.ebayCondition,
          itemSpecifics: formData.ebayAspects,
          fulfillmentPolicyId: formData.fulfillmentPolicyId,
          paymentPolicyId: formData.paymentPolicyId,
          returnPolicyId: formData.returnPolicyId,
          locationKey: formData.locationKey,
          packageWeight: formData.packageWeight,
          packageDimensions: formData.packageDimensions,
          images: formData.images
        },
        poshmark: {
          title: formData.title,
          price: formData.poshmarkPrice || formData.price || '0.00',
          description: formData.description,
          originalPrice: formData.poshmarkOriginalPrice || formData.originalPrice,
          departmentId: formData.poshmarkDepartment,
          category: formData.poshmarkCategory,
          subcategoryIds: formData.poshmarkSubcategory ? [formData.poshmarkSubcategory] : [],
          size: formData.poshmarkSize || formData.size,
          condition: formData.poshmarkCondition,
          styleTag: formData.poshmarkStyleTags,
          images: formData.images
        },
        mercari: {
          title: formData.title,
          price: formData.mercariPrice || formData.price || '0.00',
          description: formData.description,
          category: formData.mercariCategory,
          categoryId: formData.mercariCategoryId,
          brand: formData.mercariBrand || formData.brand,
          brandId: formData.mercariBrandId,
          condition: formData.mercariCondition,
          shippingPayer: formData.mercariShippingPayer,
          images: formData.images
        },
        etsy: {
          title: formData.title,
          price: formData.etsyPrice || formData.price || '0.00',
          description: formData.description,
          category: formData.etsyCategory,
          categoryId: formData.etsyCategoryId,
          who_made: formData.who_made,
          when_made: formData.when_made,
          is_supply: formData.is_supply === 'true',
          renewal: formData.renewal,
          shipping_profile_id: formData.shipping_profile_id,
          etsyAttributes: formData.etsyAttributes,
          material: formData.material,
          images: formData.images
        },
        amazon: {
          title: formData.title,
          price: formData.amazonPrice || formData.price || '0.00',
          description: formData.description,
          asin: formData.amazonAsin,
          standardProductId: formData.amazonStandardProductId,
          productType: formData.amazonProductType,
          condition: formData.amazonCondition,
          images: formData.images
        }
      }
    };
  };

  // Save Draft Handler
  const handleSaveDraft = async () => {
    if (!formData.title) {
      toast.warning("Please enter a Listing Title.");
      return;
    }
    setLoading(true);
    const payload = buildListingPayload('draft');

    try {
      const activeId = editId || initialListing?._id || initialListing?.id;
      const res = activeId 
        ? await listingService.update(activeId, payload)
        : await listingService.create(payload);

      if (res.data?.success) {
        toast.success(isEditMode ? "Listing updated successfully!" : "Listing saved as Draft!");
        if (onSyncSuccess) onSyncSuccess();
        if (isModal && onClose) {
          onClose();
        } else {
          navigate('/listings');
        }
      }
    } catch (err) {
      console.error("Save Draft Error:", err);
      toast.error(err.response?.data?.message || "Failed to save draft.");
    } finally {
      setLoading(false);
    }
  };

  // Publish / Update on Selected Platforms Handler
  const handlePublishOrUpdateAll = async () => {
    if (!formData.title) {
      toast.warning("Please enter a Listing Title.");
      return;
    }
    if (formData.images.length === 0) {
      toast.warning("Please upload at least one image.");
      return;
    }
    if (selectedPlatforms.length === 0) {
      toast.warning("Please select at least one target platform.");
      return;
    }

    setPublishing(true);
    const payload = buildListingPayload('published');

    try {
      const activeId = editId || initialListing?._id || initialListing?.id;
      
      const res = activeId 
        ? await listingService.update(activeId, payload)
        : await listingService.create(payload);

      const savedListing = res.data?.data;
      const targetListingId = activeId || savedListing?._id || savedListing?.id;

      if (!targetListingId) {
        throw new Error("Could not obtain listing ID for multi-platform sync.");
      }

      toast.info(`Publishing to ${selectedPlatforms.map(p => p.toUpperCase()).join(', ')}...`);

      const syncResults = await Promise.allSettled(
        selectedPlatforms.map(async (plat) => {
          if (plat === 'ebay') {
            return await listingService.publish(targetListingId);
          } else if (plat === 'etsy') {
            return await etsyService.publish(targetListingId, payload.platformData.etsy);
          } else if (plat === 'poshmark') {
            return await externalImportService.publish(targetListingId, { platform: 'poshmark', ...payload.platformData.poshmark });
          } else if (plat === 'mercari') {
            return await externalImportService.publish(targetListingId, { platform: 'mercari', ...payload.platformData.mercari });
          } else if (plat === 'amazon') {
            return await amazonService.publish(targetListingId, payload.platformData.amazon);
          }
        })
      );

      let successCount = 0;
      syncResults.forEach((result, idx) => {
        const plat = selectedPlatforms[idx];
        if (result.status === 'fulfilled' && (result.value?.data?.success || result.value?.status === 200)) {
          successCount++;
          toast.success(`✓ Successfully synced on ${plat.toUpperCase()}`);
        } else {
          const errMsg = result.reason?.response?.data?.message || result.value?.data?.message || "Sync error";
          console.warn(`Sync failed for ${plat}:`, errMsg);
          toast.warning(`${plat.toUpperCase()} sync note: ${errMsg}`);
        }
      });

      if (successCount > 0) {
        toast.success(`Listing successfully updated across ${successCount}/${selectedPlatforms.length} platforms!`);
      }

      if (onSyncSuccess) onSyncSuccess();
      if (isModal && onClose) {
        onClose();
      } else {
        navigate('/listings');
      }
    } catch (err) {
      console.error("Multi-platform publish error:", err);
      toast.error(err.response?.data?.message || "Failed to publish on platforms.");
    } finally {
      setPublishing(false);
    }
  };

  const ruleOptions = useMemo(() => rules.map(rule => ({
    id: rule._id || rule.id,
    label: rule.name
  })), [rules]);

  const conditionOptions = useMemo(() => MASTER_CONDITIONS.map(c => ({
    id: c.id,
    label: c.label,
    description: c.description
  })), []);

  // Combined List of All eBay Aspects
  const combinedEbayAspectsList = useMemo(() => {
    const list = [];
    const addedNames = new Set();

    if (formData.ebayAspects && typeof formData.ebayAspects === 'object') {
      Object.entries(formData.ebayAspects).forEach(([name, valArr]) => {
        const val = Array.isArray(valArr) ? valArr[0] : valArr;
        if (name && val !== undefined && val !== null && String(val).trim() !== '') {
          addedNames.add(name.toLowerCase());
          const matchTaxonomy = ebayAspects.find(a => a.localizedAspectName?.toLowerCase() === name.toLowerCase());
          const options = matchTaxonomy ? (matchTaxonomy.aspectValues || []).map(v => ({ id: v.localizedValue, label: v.localizedValue })) : [];
          list.push({
            name,
            value: String(val),
            isRequired: matchTaxonomy?.aspectConstraint?.aspectRequired === true,
            isRecommended: matchTaxonomy?.aspectConstraint?.aspectUsage === 'RECOMMENDED',
            options
          });
        }
      });
    }

    ebayAspects.forEach((asp) => {
      const name = asp.localizedAspectName;
      if (name && !addedNames.has(name.toLowerCase())) {
        const isReq = asp.aspectConstraint?.aspectRequired === true;
        const isRec = asp.aspectConstraint?.aspectUsage === 'RECOMMENDED';
        const options = (asp.aspectValues || []).map(v => ({ id: v.localizedValue, label: v.localizedValue }));
        list.push({
          name,
          value: '',
          isRequired: isReq,
          isRecommended: isRec,
          options
        });
      }
    });

    return list;
  }, [formData.ebayAspects, ebayAspects]);

  const activePlatformTitle = useMemo(() => {
    if (isSinglePlatformOnly && selectedPlatforms.length === 1) {
      const p = PLATFORMS_CONFIG.find(x => x.id === selectedPlatforms[0]);
      return p ? p.name : 'Single Platform';
    }
    return 'Master Listing';
  }, [isSinglePlatformOnly, selectedPlatforms]);

  return (
    <div className={`w-full ${isModal ? 'h-full flex flex-col' : 'max-w-[96vw] xl:max-w-[1440px] mx-auto py-6 px-4 space-y-6'}`}>
      
      {/* Top Header Bar */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shadow-2xs">
            <Layers size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                {isEditMode ? `Edit ${activePlatformTitle}` : `Create ${activePlatformTitle}`}
              </h1>
              <Badge variant="neutral">
                {isEditMode ? 'Edit Mode' : (isSinglePlatformOnly ? selectedPlatforms[0]?.toUpperCase() : 'Multi-Platform')}
              </Badge>
            </div>
            <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
              Customize product details, category hierarchy, pricing, and specifics in a clean unified layout.
            </p>
          </div>
        </div>

        {isModal && onClose && (
          <IconButton
            aria-label="Close"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl"
          >
            <X size={18} />
          </IconButton>
        )}
      </div>

      {/* Main Split Layout Grid */}
      <div className={`grid grid-cols-1 lg:grid-cols-12 gap-5 items-start flex-1 min-h-0 ${isModal ? 'overflow-hidden' : ''}`}>
        
        {/* ========================================================================= */}
        {/* LEFT COLUMN (FIXED / STICKY): Platforms, Images & AI Scanning Box        */}
        {/* ========================================================================= */}
        <div className={`lg:col-span-4 space-y-4 ${isModal ? 'h-full overflow-y-auto pr-1' : 'sticky top-4 h-fit max-h-[calc(100vh-60px)] overflow-y-auto pr-1'}`}>
          
          {/* Target Platforms Multi-Select Badges (Shown when not forced single platform) */}
          {!isSinglePlatformOnly && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Globe size={12} className="text-slate-500" />
                  Target Marketplaces
                </label>
                <span className="text-[9px] font-extrabold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
                  {selectedPlatforms.length} Active
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PLATFORMS_CONFIG.map((p) => {
                  const isSelected = selectedPlatforms.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleTogglePlatform(p.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-black transition-all cursor-pointer select-none shadow-2xs ${
                        isSelected
                          ? 'border-slate-800 bg-slate-900 text-white shadow-xs'
                          : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 opacity-60'
                      }`}
                    >
                      <img src={p.logo} alt={p.name} className={`w-3.5 h-3.5 object-contain ${!isSelected ? 'grayscale opacity-60' : ''}`} />
                      <span>{p.name}</span>
                      {isSelected && <Check size={11} className="text-white ml-0.5" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Product Images Gallery (Compact 4-column Grid) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon size={12} className="text-slate-500" />
                Product Photos
              </label>
              <span className="text-[9px] font-bold text-slate-400">
                {formData.images.length}/12 Photos
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {formData.images.map((img, idx) => (
                <div
                  key={idx}
                  draggable={true}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', String(idx));
                    e.dataTransfer.effectAllowed = 'move';
                    setDraggedImgIdx(idx);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (dragOverImgIdx !== idx) setDragOverImgIdx(idx);
                  }}
                  onDragLeave={() => {
                    if (dragOverImgIdx === idx) setDragOverImgIdx(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const sourceIdx = draggedImgIdx !== null ? draggedImgIdx : parseInt(e.dataTransfer.getData('text/plain'), 10);
                    if (!isNaN(sourceIdx)) {
                      handleReorderImages(sourceIdx, idx);
                    }
                  }}
                  onDragEnd={() => {
                    setDraggedImgIdx(null);
                    setDragOverImgIdx(null);
                  }}
                  className={`relative aspect-square border rounded-xl overflow-hidden group cursor-grab active:cursor-grabbing transition-all duration-150 ${
                    draggedImgIdx === idx ? 'opacity-40 scale-95 ring-2 ring-slate-400' : ''
                  } ${
                    dragOverImgIdx === idx ? 'ring-2 ring-slate-800 scale-105 shadow-md border-slate-700 bg-slate-100' : 'border-slate-200 bg-slate-50'
                  }`}
                  title="Drag and drop to reorder"
                >
                  <img src={img} className="w-full h-full object-cover pointer-events-none" alt="" />

                  {/* Hover Overlay Controls */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 p-0.5">
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveImage(idx, 'left');
                        }}
                        className="p-1 bg-white/20 hover:bg-white/40 text-white rounded text-[9px] font-bold transition-colors cursor-pointer"
                        title="Move Left"
                      >
                        <ArrowLeft size={9} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteImage(idx);
                      }}
                      className="p-1 bg-rose-600/90 hover:bg-rose-600 text-white rounded text-[9px] font-bold transition-colors cursor-pointer"
                      title="Delete Photo"
                    >
                      <Trash2 size={9} />
                    </button>
                    {idx < formData.images.length - 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveImage(idx, 'right');
                        }}
                        className="p-1 bg-white/20 hover:bg-white/40 text-white rounded text-[9px] font-bold transition-colors cursor-pointer"
                        title="Move Right"
                      >
                        <ArrowRight size={9} />
                      </button>
                    )}
                  </div>

                  {idx === 0 && (
                    <span className="absolute top-1 left-1 px-1 py-0.2 bg-slate-900 text-white text-[7px] font-black uppercase rounded shadow-xs pointer-events-none">
                      Cover
                    </span>
                  )}
                </div>
              ))}

              {formData.images.length < 12 && (
                <label className="aspect-square border-2 border-dashed border-slate-200 hover:border-slate-400 rounded-xl flex flex-col items-center justify-center gap-0.5 cursor-pointer bg-slate-50 hover:bg-slate-100 transition-all group">
                  <Upload size={13} className="text-slate-400 group-hover:text-slate-700 transition-colors" />
                  <span className="text-[8.5px] font-black text-slate-400 group-hover:text-slate-700 uppercase tracking-wider">
                    Add
                  </span>
                  <input type="file" multiple accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
              )}
            </div>

            {isConvertingImages && (
              <div className="flex items-center gap-1.5 text-slate-600 text-[11px] font-semibold animate-pulse pt-0.5">
                <Loader2 size={11} className="animate-spin" /> Processing images...
              </div>
            )}
          </div>

          {/* AI Scanner Settings Box */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
            <div className="flex items-center gap-2">
              <Zap size={13} className="text-slate-600" />
              <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-wider">AI Scanner Settings</h3>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">AI Listing Rule</label>
                <SearchableDropdown
                  value={rules.find(r => (r._id || r.id) === formData.selectedRule)?.name || ''}
                  options={ruleOptions}
                  onSelect={(opt) => setFormData(prev => ({ ...prev, selectedRule: opt.id }))}
                  placeholder="Select prefill rule..."
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Condition</label>
                  <SearchableDropdown
                    value={formData.selectedCondition}
                    options={conditionOptions}
                    onSelect={(opt) => setFormData(prev => ({ ...prev, selectedCondition: opt.label, conditionId: opt.id }))}
                    placeholder="Select condition..."
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">AI Model</label>
                  <SearchableDropdown
                    value={modelOptions.find(m => m.id === formData.selectedModel)?.label || 'GPT-4o Mini'}
                    options={modelOptions}
                    onSelect={(opt) => setFormData(prev => ({ ...prev, selectedModel: opt.id }))}
                    placeholder="Select model..."
                  />
                </div>
              </div>

              <div className="pt-1.5">
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold shadow-sm py-2 text-xs"
                  onClick={startAIFetch}
                  loading={loading}
                  disabled={loading || isConvertingImages || formData.images.length === 0}
                  icon={<Sparkles size={14} />}
                >
                  {loading ? 'AI Scanning & Extracting...' : 'Scan Image with AI'}
                </Button>
              </div>
            </div>
          </div>

        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN (SCROLLABLE): Master Details & Platform-Specific Cards       */}
        {/* ========================================================================= */}
        <div className={`lg:col-span-8 space-y-5 ${isModal ? 'h-full overflow-y-auto pr-2 pb-16' : 'space-y-5'}`}>
          
          {/* Card 1: Product Core Details (Shared / Common Data) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                  <Package size={15} />
                </div>
                <div>
                  <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider">Product Details</h2>
                  <p className="text-[10px] font-semibold text-slate-400">Core listing data</p>
                </div>
              </div>
              <Badge variant="neutral">Common</Badge>
            </div>

            <div className="space-y-3.5">
              {/* Title */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Listing Title</label>
                  <span className="text-[10px] font-bold text-slate-400">{formData.title.length}/80</span>
                </div>
                <input
                  value={formData.title}
                  maxLength={80}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter descriptive title (e.g. Nike Air Max 90 Running Shoes Black / White Size 10)..."
                  className="w-full h-11 px-3.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-slate-400 transition-all"
                />
              </div>

              {/* Master Default Price, Original Price, SKU */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Selling Price ($)</label>
                  <div className="relative">
                    <DollarSign size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                      placeholder="0.00"
                      className="w-full h-11 pl-9 pr-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-slate-400 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Original Price ($)</label>
                  <div className="relative">
                    <DollarSign size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="number"
                      step="0.01"
                      value={formData.originalPrice}
                      onChange={(e) => setFormData(prev => ({ ...prev, originalPrice: e.target.value }))}
                      placeholder="0.00"
                      className="w-full h-11 pl-9 pr-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-slate-400 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">SKU / Custom Code</label>
                  <input
                    value={formData.sku}
                    onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                    placeholder="e.g. KL-1002"
                    className="w-full h-11 px-3.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 outline-none focus:border-slate-400 transition-all"
                  />
                </div>
              </div>

              {/* Brand, Size, Color, Quantity */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Brand</label>
                  <input
                    value={formData.brand}
                    onChange={(e) => {
                      const v = e.target.value;
                      handleAspectChange('Brand', v);
                    }}
                    placeholder="e.g. Nike"
                    className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-slate-400 transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Size</label>
                  <input
                    value={formData.size}
                    onChange={(e) => {
                      const v = e.target.value;
                      handleAspectChange('Size', v);
                    }}
                    placeholder="e.g. 10 / L"
                    className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-slate-400 transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Color</label>
                  <input
                    value={formData.color}
                    onChange={(e) => {
                      const v = e.target.value;
                      handleAspectChange('Color', v);
                    }}
                    placeholder="e.g. Black"
                    className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-slate-400 transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.quantity}
                    onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                    className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-slate-400 transition-all"
                  />
                </div>
              </div>

              {/* Description with HTML Preview & Source Code Toggle */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                    <FileText size={11} className="text-slate-500" />
                    Product Description
                  </label>
                  <div className="flex bg-slate-100 p-0.5 rounded-lg gap-1">
                    <button 
                      type="button"
                      onClick={() => setDescriptionMode('edit')}
                      className={`flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-extrabold transition-all cursor-pointer ${
                        descriptionMode === 'edit' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <Code size={11} /> Edit
                    </button>
                    <button 
                      type="button"
                      onClick={() => setDescriptionMode('preview')}
                      className={`flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-extrabold transition-all cursor-pointer ${
                        descriptionMode === 'preview' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <Eye size={11} /> Preview
                    </button>
                  </div>
                </div>

                {descriptionMode === 'edit' ? (
                  <textarea
                    rows={5}
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Enter detailed item description or HTML template..."
                    className="w-full p-3.5 bg-white border border-slate-200 rounded-xl text-xs font-mono leading-relaxed outline-none focus:border-slate-400 transition-all"
                  />
                ) : (
                  <div className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs leading-relaxed min-h-[140px] max-h-[300px] overflow-y-auto text-slate-700 font-sans">
                    {formData.description ? (
                      <div dangerouslySetInnerHTML={{ __html: formData.description }} />
                    ) : (
                      <span className="text-slate-400 italic">No description entered yet.</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Card 2: eBay Platform Specific Details, Policies, Pricing & Item Specifics */}
          {selectedPlatforms.includes('ebay') && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <img src="/ebay.png" className="w-5 h-5 object-contain" alt="eBay" />
                  <div>
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">eBay Listing & Policies</h3>
                    <p className="text-[10px] font-semibold text-slate-400">eBay category hierarchy, price, policies & item specifics</p>
                  </div>
                </div>
                <Badge variant="neutral">eBay</Badge>
              </div>

              <div className="space-y-3.5">
                {/* eBay Category (Full Path) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">eBay Category (Full Path)</label>
                    {formData.ebayCategoryId && (
                      <span className="text-[10px] font-bold text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded-md">
                        ID: {formData.ebayCategoryId}
                      </span>
                    )}
                  </div>
                  <CategorySearchDropdown
                    value={formData.ebayCategory}
                    platform="ebay"
                    onSelect={(opt) => {
                      setFormData(prev => ({
                        ...prev,
                        ebayCategory: opt.fullName || opt.label,
                        ebayCategoryId: opt.id
                      }));
                    }}
                    placeholder="Search eBay full category path (e.g. Clothing > Men's Shoes > Athletic Shoes)..."
                  />
                </div>

                {/* eBay Price Override & Condition */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                      eBay Price ($) <span className="text-[9px] text-slate-400 font-normal">(Optional override)</span>
                    </label>
                    <div className="relative">
                      <DollarSign size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="number"
                        step="0.01"
                        value={formData.ebayPrice}
                        onChange={(e) => setFormData(prev => ({ ...prev, ebayPrice: e.target.value }))}
                        placeholder={formData.price ? `${formData.price} (Default)` : "0.00"}
                        className="w-full h-11 pl-9 pr-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-slate-400 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">eBay Condition</label>
                    <SearchableDropdown
                      value={formData.ebayCondition}
                      options={[
                        { id: 'Brand New', label: 'Brand New' },
                        { id: 'Like New', label: 'Like New' },
                        { id: 'Pre-owned - Excellent', label: 'Pre-owned - Excellent' },
                        { id: 'Pre-owned - Good', label: 'Pre-owned - Good' },
                        { id: 'Pre-owned - Fair', label: 'Pre-owned - Fair' },
                        { id: 'For parts or not working', label: 'For parts or not working' }
                      ]}
                      onSelect={(opt) => setFormData(prev => ({ ...prev, ebayCondition: opt.label }))}
                      placeholder="Select eBay condition..."
                    />
                  </div>
                </div>

                {/* eBay Business Policies */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Shipping Policy</label>
                    <SearchableDropdown
                      value={ebayPolicies.fulfillment?.find(p => p.fulfillmentPolicyId === formData.fulfillmentPolicyId)?.name || 'Default Shipping'}
                      options={(ebayPolicies.fulfillment || []).map(p => ({ id: p.fulfillmentPolicyId, label: p.name }))}
                      onSelect={(opt) => setFormData(prev => ({ ...prev, fulfillmentPolicyId: opt.id }))}
                      placeholder="Select shipping policy..."
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Payment Policy</label>
                    <SearchableDropdown
                      value={ebayPolicies.payment?.find(p => p.paymentPolicyId === formData.paymentPolicyId)?.name || 'Default Payment'}
                      options={(ebayPolicies.payment || []).map(p => ({ id: p.paymentPolicyId, label: p.name }))}
                      onSelect={(opt) => setFormData(prev => ({ ...prev, paymentPolicyId: opt.id }))}
                      placeholder="Select payment policy..."
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Return Policy</label>
                    <SearchableDropdown
                      value={ebayPolicies.returns?.find(p => p.returnPolicyId === formData.returnPolicyId)?.name || 'Default Returns'}
                      options={(ebayPolicies.returns || []).map(p => ({ id: p.returnPolicyId, label: p.name }))}
                      onSelect={(opt) => setFormData(prev => ({ ...prev, returnPolicyId: opt.id }))}
                      placeholder="Select return policy..."
                    />
                  </div>
                </div>

                {/* Weight & Dimensions */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider ml-1">Weight (Lbs)</label>
                    <input
                      type="number"
                      value={formData.packageWeight.lbs}
                      onChange={(e) => setFormData(prev => ({ ...prev, packageWeight: { ...prev.packageWeight, lbs: Number(e.target.value) } }))}
                      className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider ml-1">Weight (Oz)</label>
                    <input
                      type="number"
                      value={formData.packageWeight.oz}
                      onChange={(e) => setFormData(prev => ({ ...prev, packageWeight: { ...prev.packageWeight, oz: Number(e.target.value) } }))}
                      className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider ml-1">Dimensions (L x W)</label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        placeholder="L"
                        value={formData.packageDimensions.length}
                        onChange={(e) => setFormData(prev => ({ ...prev, packageDimensions: { ...prev.packageDimensions, length: Number(e.target.value) } }))}
                        className="w-1/2 h-9 px-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none"
                      />
                      <input
                        type="number"
                        placeholder="W"
                        value={formData.packageDimensions.width}
                        onChange={(e) => setFormData(prev => ({ ...prev, packageDimensions: { ...prev.packageDimensions, width: Number(e.target.value) } }))}
                        className="w-1/2 h-9 px-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider ml-1">Height (H)</label>
                    <input
                      type="number"
                      placeholder="H"
                      value={formData.packageDimensions.height}
                      onChange={(e) => setFormData(prev => ({ ...prev, packageDimensions: { ...prev.packageDimensions, height: Number(e.target.value) } }))}
                      className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none"
                    />
                  </div>
                </div>

                {/* ========================================================================= */}
                {/* eBay ITEM SPECIFICS & ATTRIBUTES (PLACED DIRECTLY INSIDE EBAY CARD)       */}
                {/* ========================================================================= */}
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Tag size={13} className="text-slate-600" />
                      <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-wider">eBay Item Specifics</h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddAspect(!showAddAspect)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-[10px] font-black transition-all cursor-pointer"
                    >
                      <Plus size={11} /> Add Aspect
                    </button>
                  </div>

                  {/* Add Custom Aspect Row */}
                  {showAddAspect && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-center gap-2 animate-in fade-in duration-150">
                      <input
                        placeholder="Aspect Name (e.g. Closure, Theme)"
                        value={newAspectName}
                        onChange={(e) => setNewAspectName(e.target.value)}
                        className="w-full sm:w-1/2 h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none"
                      />
                      <input
                        placeholder="Aspect Value (e.g. Lace Up, Vintage)"
                        value={newAspectValue}
                        onChange={(e) => setNewAspectValue(e.target.value)}
                        className="w-full sm:w-1/2 h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none"
                      />
                      <div className="flex items-center gap-1.5 w-full sm:w-auto">
                        <Button
                          type="button"
                          size="sm"
                          variant="primary"
                          onClick={handleAddCustomAspect}
                          className="flex-1 sm:flex-none py-1.5 text-xs bg-slate-900 text-white"
                        >
                          Save
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setShowAddAspect(false)}
                          className="py-1.5 text-xs"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Aspects Grid */}
                  {combinedEbayAspectsList.length === 0 ? (
                    <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center space-y-1">
                      <p className="text-xs font-bold text-slate-600">No eBay Item Specifics Extracted</p>
                      <p className="text-[10px] font-semibold text-slate-400">Click "Scan Image with AI" on the left or "+ Add Aspect" above.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[320px] overflow-y-auto pr-1">
                      {combinedEbayAspectsList.map((aspect) => {
                        const currentVal = formData.ebayAspects?.[aspect.name]?.[0] || aspect.value || '';
                        const hasOptions = aspect.options && aspect.options.length > 0;

                        return (
                          <div key={aspect.name} className="space-y-1 bg-slate-50 p-2 rounded-xl border border-slate-100 relative group">
                            <div className="flex items-center justify-between">
                              <label className="text-[9px] font-black text-slate-600 uppercase tracking-wider block truncate">
                                {aspect.name}
                                {aspect.isRequired && <span className="text-rose-500 ml-0.5">*</span>}
                                {aspect.isRecommended && <span className="text-[8px] text-slate-400 font-bold ml-1">(Rec)</span>}
                              </label>
                              <button
                                type="button"
                                onClick={() => handleDeleteAspect(aspect.name)}
                                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 p-0.5 transition-opacity cursor-pointer"
                                title={`Delete ${aspect.name}`}
                              >
                                <X size={11} />
                              </button>
                            </div>

                            {hasOptions ? (
                              <SearchableDropdown
                                value={currentVal}
                                options={aspect.options}
                                onSelect={(opt) => handleAspectChange(aspect.name, opt.label)}
                                placeholder={`Select ${aspect.name}...`}
                              />
                            ) : (
                              <input
                                value={currentVal}
                                onChange={(e) => handleAspectChange(aspect.name, e.target.value)}
                                placeholder={`Enter ${aspect.name}...`}
                                className="w-full h-9.5 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-slate-400 transition-all"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Card 3: Poshmark Platform Specific Details & Pricing */}
          {selectedPlatforms.includes('poshmark') && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <img src="/poshmark.png" className="w-5 h-5 object-contain" alt="Poshmark" />
                  <div>
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Poshmark Listing & Pricing</h3>
                    <p className="text-[10px] font-semibold text-slate-400">Poshmark full category path, price override, department, size & style tags</p>
                  </div>
                </div>
                <Badge variant="neutral">Poshmark</Badge>
              </div>

              <div className="space-y-3.5">
                {/* Poshmark Category (Full Path) */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Poshmark Category (Full Path)</label>
                  <CategorySearchDropdown
                    value={formData.poshmarkCategory}
                    platform="poshmark"
                    onSelect={(opt) => {
                      setFormData(prev => ({
                        ...prev,
                        poshmarkCategory: opt.fullName || opt.label,
                        poshmarkDepartment: opt.departmentId || prev.poshmarkDepartment,
                        poshmarkSubcategory: opt.subcategoryIds?.[0] || prev.poshmarkSubcategory
                      }));
                    }}
                    placeholder="Search Poshmark full category path (e.g. Women > Tops > Sweaters)..."
                  />
                </div>

                {/* Poshmark Price Override & Original Price */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                      Poshmark Price ($) <span className="text-[9px] text-slate-400 font-normal">(Optional override)</span>
                    </label>
                    <div className="relative">
                      <DollarSign size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="number"
                        step="0.01"
                        value={formData.poshmarkPrice}
                        onChange={(e) => setFormData(prev => ({ ...prev, poshmarkPrice: e.target.value }))}
                        placeholder={formData.price ? `${formData.price} (Default)` : "0.00"}
                        className="w-full h-11 pl-9 pr-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-slate-400 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Poshmark Original Price ($)</label>
                    <div className="relative">
                      <DollarSign size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="number"
                        step="0.01"
                        value={formData.poshmarkOriginalPrice || formData.originalPrice}
                        onChange={(e) => setFormData(prev => ({ ...prev, poshmarkOriginalPrice: e.target.value }))}
                        placeholder="0.00"
                        className="w-full h-11 pl-9 pr-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-slate-400 transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Department, Size, Condition */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Department</label>
                    <SearchableDropdown
                      value={formData.poshmarkDepartment}
                      options={POSHMARK_DEPARTMENTS}
                      onSelect={(opt) => setFormData(prev => ({ ...prev, poshmarkDepartment: opt.id }))}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Poshmark Size</label>
                    <input
                      value={formData.poshmarkSize || formData.size}
                      onChange={(e) => setFormData(prev => ({ ...prev, poshmarkSize: e.target.value }))}
                      placeholder="e.g. M / 8 / One Size"
                      className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-slate-400 transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Condition</label>
                    <SearchableDropdown
                      value={formData.poshmarkCondition}
                      options={POSHMARK_CONDITIONS}
                      onSelect={(opt) => setFormData(prev => ({ ...prev, poshmarkCondition: opt.label || opt.id }))}
                    />
                  </div>
                </div>

                {/* Style Tags */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Style Tags (Optional)</label>
                  <input
                    value={formData.poshmarkStyleTags}
                    onChange={(e) => setFormData(prev => ({ ...prev, poshmarkStyleTags: e.target.value }))}
                    placeholder="e.g. Vintage, Streetwear, Casual..."
                    className="w-full h-11 px-3.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-slate-400 transition-all"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Card 4: Mercari Platform Specific Details & Pricing */}
          {selectedPlatforms.includes('mercari') && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <img src="/mercari.png" className="w-5 h-5 object-contain" alt="Mercari" />
                  <div>
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Mercari Listing & Pricing</h3>
                    <p className="text-[10px] font-semibold text-slate-400">Category hierarchy, price override, brand & shipping</p>
                  </div>
                </div>
                <Badge variant="neutral">Mercari</Badge>
              </div>

              <div className="space-y-3.5">
                {/* Mercari Category (Full Hierarchy Tree) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Mercari Category (Full Hierarchy)</label>
                    {formData.mercariCategoryId && (
                      <span className="text-[10px] font-bold text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded-md">
                        ID: {formData.mercariCategoryId}
                      </span>
                    )}
                  </div>
                  <SearchableDropdown
                    value={formData.mercariCategory}
                    options={mercariCategoryOptions}
                    onSelect={(opt) => setFormData(prev => ({ ...prev, mercariCategory: opt.label, mercariCategoryId: opt.id }))}
                    placeholder="Select Mercari category hierarchy..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  {/* Mercari Price Override */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Mercari Price ($)</label>
                    <div className="relative">
                      <DollarSign size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="number"
                        step="0.01"
                        value={formData.mercariPrice}
                        onChange={(e) => setFormData(prev => ({ ...prev, mercariPrice: e.target.value }))}
                        placeholder={formData.price ? `${formData.price} (Default)` : "0.00"}
                        className="w-full h-11 pl-9 pr-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-slate-400 transition-all"
                      />
                    </div>
                  </div>

                  {/* Brand Autocomplete */}
                  <div className="space-y-1 relative" ref={mercariBrandRef}>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Mercari Brand</label>
                    <input
                      value={formData.mercariBrand || formData.brand}
                      onChange={(e) => handleMercariBrandSearch(e.target.value)}
                      onFocus={() => setIsMercariBrandOpen(true)}
                      placeholder="Search brand..."
                      className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-slate-400 transition-all"
                    />
                    {isMercariBrandOpen && mercariBrandSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 shadow-xl rounded-xl z-[999] max-h-48 overflow-y-auto py-1">
                        {mercariBrandSuggestions.map((b) => (
                          <button
                            key={b.id || b.name}
                            type="button"
                            onClick={() => {
                              setFormData(prev => ({ ...prev, mercariBrand: b.name, mercariBrandId: String(b.id || ''), brand: prev.brand || b.name }));
                              setIsMercariBrandOpen(false);
                            }}
                            className="w-full px-3.5 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                          >
                            <span>{b.name}</span>
                            <span className="text-[9px] text-slate-400 font-mono">ID: {b.id}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Condition</label>
                    <SearchableDropdown
                      value={MERCARI_CONDITIONS.find(c => c.id === formData.mercariCondition)?.label || 'Good'}
                      options={MERCARI_CONDITIONS}
                      onSelect={(opt) => setFormData(prev => ({ ...prev, mercariCondition: opt.id }))}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Shipping Payer</label>
                    <select
                      value={formData.mercariShippingPayer}
                      onChange={(e) => setFormData(prev => ({ ...prev, mercariShippingPayer: e.target.value }))}
                      className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-slate-400 cursor-pointer"
                    >
                      <option value="seller">Free Shipping (Seller Pays)</option>
                      <option value="buyer">Buyer Pays (Prepaid Label)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Card 5: Etsy Platform Specific Details & Pricing */}
          {selectedPlatforms.includes('etsy') && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <img src="/etsy.png" className="w-5 h-5 object-contain" alt="Etsy" />
                  <div>
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Etsy Listing & Pricing</h3>
                    <p className="text-[10px] font-semibold text-slate-400">Etsy taxonomy path, price override & delivery profile</p>
                  </div>
                </div>
                <Badge variant="neutral">Etsy</Badge>
              </div>

              <div className="space-y-3.5">
                {/* Etsy Category (Full Taxonomy Path) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Etsy Taxonomy Path</label>
                    {formData.etsyCategoryId && (
                      <span className="text-[10px] font-bold text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded-md">
                        Taxonomy ID: {formData.etsyCategoryId}
                      </span>
                    )}
                  </div>
                  <CategorySearchDropdown
                    value={formData.etsyCategory}
                    platform="etsy"
                    onSelect={(opt) => {
                      setFormData(prev => ({
                        ...prev,
                        etsyCategory: opt.fullName || opt.label,
                        etsyCategoryId: opt.id
                      }));
                    }}
                    placeholder="Search Etsy taxonomy path (e.g. Clothing > Men's Clothing > Jackets & Coats)..."
                  />
                </div>

                {/* Etsy Price Override & Shipping Profile */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                      Etsy Price ($) <span className="text-[9px] text-slate-400 font-normal">(Optional override)</span>
                    </label>
                    <div className="relative">
                      <DollarSign size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="number"
                        step="0.01"
                        value={formData.etsyPrice}
                        onChange={(e) => setFormData(prev => ({ ...prev, etsyPrice: e.target.value }))}
                        placeholder={formData.price ? `${formData.price} (Default)` : "0.00"}
                        className="w-full h-11 pl-9 pr-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-slate-400 transition-all"
                      />
                    </div>
                  </div>

                  {/* Etsy Delivery Profile */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Delivery Profile</label>
                      <button
                        type="button"
                        onClick={async () => {
                          toast.info("Refreshing Etsy profiles...");
                          const res = await etsyService.getShippingProfiles();
                          if (res.data?.success) {
                            setShippingProfiles(res.data.data || []);
                            toast.success("Profiles updated!");
                          }
                        }}
                        className="text-[10px] font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw size={10} /> Refresh
                      </button>
                    </div>
                    <SearchableDropdown
                      value={shippingProfiles.find(p => String(p.shipping_profile_id) === String(formData.shipping_profile_id))?.title || ''}
                      options={shippingProfiles.map(p => ({ id: String(p.shipping_profile_id), label: `${p.title} (${p.processing_days_display_label || 'Calculated'})` }))}
                      onSelect={(opt) => setFormData(prev => ({ ...prev, shipping_profile_id: opt.id }))}
                      placeholder="Select Etsy delivery profile..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Who Made It?</label>
                    <select
                      value={formData.who_made}
                      onChange={(e) => setFormData(prev => ({ ...prev, who_made: e.target.value }))}
                      className="w-full h-11 px-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-slate-400 cursor-pointer"
                    >
                      <option value="i_did">I did (Handmade)</option>
                      <option value="collective">A member of my shop</option>
                      <option value="someone_else">Another company (Vintage)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">When Made?</label>
                    <select
                      value={formData.when_made}
                      onChange={(e) => setFormData(prev => ({ ...prev, when_made: e.target.value }))}
                      className="w-full h-11 px-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-slate-400 cursor-pointer"
                    >
                      <option value="2020_2026">2020 - 2026</option>
                      <option value="2010_2019">2010 - 2019</option>
                      <option value="2000_2009">2000 - 2009</option>
                      <option value="1990s">1990s (Vintage)</option>
                      <option value="1980s">1980s (Vintage)</option>
                      <option value="before_1980">Before 1980 (Vintage)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">What is it?</label>
                    <select
                      value={formData.is_supply}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_supply: e.target.value }))}
                      className="w-full h-11 px-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-slate-400 cursor-pointer"
                    >
                      <option value="false">Finished Product</option>
                      <option value="true">A Craft Supply / Tool</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Renewal</label>
                    <select
                      value={formData.renewal}
                      onChange={(e) => setFormData(prev => ({ ...prev, renewal: e.target.value }))}
                      className="w-full h-11 px-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-slate-400 cursor-pointer"
                    >
                      <option value="manual">Manual</option>
                      <option value="automatic">Automatic</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Card 6: Amazon Platform Specific Details & Pricing */}
          {selectedPlatforms.includes('amazon') && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <img src="/amazon.png" className="w-5 h-5 object-contain" alt="Amazon" />
                  <div>
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Amazon Listing & Pricing</h3>
                    <p className="text-[10px] font-semibold text-slate-400">Product type, price override & Standard Product ID</p>
                  </div>
                </div>
                <Badge variant="neutral">Amazon</Badge>
              </div>

              <div className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Product Type / Category</label>
                    <input
                      value={formData.amazonProductType}
                      onChange={(e) => setFormData(prev => ({ ...prev, amazonProductType: e.target.value }))}
                      placeholder="e.g. APPAREL, SHOES, HANDBAG..."
                      className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-slate-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                      Amazon Price ($) <span className="text-[9px] text-slate-400 font-normal">(Optional override)</span>
                    </label>
                    <div className="relative">
                      <DollarSign size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="number"
                        step="0.01"
                        value={formData.amazonPrice}
                        onChange={(e) => setFormData(prev => ({ ...prev, amazonPrice: e.target.value }))}
                        placeholder={formData.price ? `${formData.price} (Default)` : "0.00"}
                        className="w-full h-11 pl-9 pr-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-slate-400"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Identifier Type</label>
                    <select
                      value={formData.amazonStandardProductId?.idType || 'UPC'}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        amazonStandardProductId: { ...prev.amazonStandardProductId, idType: e.target.value }
                      }))}
                      className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-slate-400 cursor-pointer"
                    >
                      <option value="ASIN">ASIN</option>
                      <option value="UPC">UPC</option>
                      <option value="EAN">EAN</option>
                      <option value="GTIN">GTIN</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Product ID Value</label>
                    <input
                      value={formData.amazonStandardProductId?.value || ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        amazonStandardProductId: { ...prev.amazonStandardProductId, value: e.target.value }
                      }))}
                      placeholder="e.g. 012345678901 / B08XYZ..."
                      className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 outline-none focus:border-slate-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Amazon Condition</label>
                    <select
                      value={formData.amazonCondition}
                      onChange={(e) => setFormData(prev => ({ ...prev, amazonCondition: e.target.value }))}
                      className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-slate-400 cursor-pointer"
                    >
                      <option value="New">New</option>
                      <option value="Used - Like New">Used - Like New</option>
                      <option value="Used - Very Good">Used - Very Good</option>
                      <option value="Used - Good">Used - Good</option>
                      <option value="Used - Acceptable">Used - Acceptable</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ========================================================================= */}
      {/* BOTTOM STICKY ACTION BAR: Cancel, Save Draft, Publish/Update Multi-Platform */}
      {/* ========================================================================= */}
      <div className="sticky bottom-0 bg-white/95 backdrop-blur-md border-t border-slate-200 py-3.5 px-4 sm:px-6 -mx-4 sm:-mx-6 flex items-center justify-between gap-4 z-40 shadow-lg rounded-b-2xl">
        <Button
          type="button"
          variant="ghost"
          size="md"
          onClick={() => {
            if (isModal && onClose) {
              onClose();
            } else {
              navigate('/listings');
            }
          }}
          className="text-slate-500 hover:text-slate-800 font-bold text-xs"
        >
          Cancel
        </Button>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={handleSaveDraft}
            loading={loading && !publishing}
            disabled={loading || publishing}
            className="border-slate-300 hover:bg-slate-50 text-slate-700 font-extrabold text-xs"
          >
            Save Draft
          </Button>

          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={handlePublishOrUpdateAll}
            loading={publishing}
            disabled={loading || publishing || selectedPlatforms.length === 0}
            icon={<ShoppingBag size={14} />}
            className="bg-slate-900 hover:bg-slate-800 text-white font-black text-xs shadow-sm px-5"
          >
            {publishing 
              ? `Publishing...` 
              : isEditMode 
                ? (isSinglePlatformOnly ? `Update on ${activePlatformTitle}` : `Update on ${selectedPlatforms.length} Platforms`)
                : (isSinglePlatformOnly ? `List on ${activePlatformTitle}` : `List on ${selectedPlatforms.length} Platforms`)}
          </Button>
        </div>
      </div>

    </div>
  );
};

export default CreateMasterListing;
