import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  ChevronLeft, 
  CheckCircle2, 
  Image as ImageIcon,
  DollarSign,
  Info,
  Zap,
  Sparkles,
  Loader2,
  X,
  ChevronDown,
  Check,
  Tag,
  Search,
  Eye,
  Trash2,
  Package,
  Layers,
  ShieldCheck,
  Plus,
  ArrowLeft,
  ArrowRight,
  Clock,
  Globe,
  Heart,
  TrendingUp,
  FileText,
  HelpCircle,
  Percent,
  Sliders
} from 'lucide-react';
import { ruleService, aiService, listingService, externalImportService, ebayService } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { compressImage } from '../utils/imageCompressor';
import Button from '../components/ui/Button';
import IconButton from '../components/ui/IconButton';
import { Badge } from '../components/ui/Badge';
import { resolveEbayCategoryFallback, cleanHtmlDescription } from '../utils/categoryResolver';

const COUNTRIES_LIST = [
  { id: 'US', label: 'United States' },
  { id: 'CN', label: 'China' },
  { id: 'VN', label: 'Vietnam' },
  { id: 'IN', label: 'India' },
  { id: 'MX', label: 'Mexico' },
  { id: 'IT', label: 'Italy' },
  { id: 'JP', label: 'Japan' },
  { id: 'DE', label: 'Germany' },
  { id: 'GB', label: 'United Kingdom' },
  { id: 'CA', label: 'Canada' },
  { id: 'FR', label: 'France' },
  { id: 'KR', label: 'South Korea' },
  { id: 'ID', label: 'Indonesia' },
  { id: 'TH', label: 'Thailand' },
  { id: 'BD', label: 'Bangladesh' },
  { id: 'PK', label: 'Pakistan' },
  { id: 'TR', label: 'Turkey' },
  { id: 'BR', label: 'Brazil' },
  { id: 'ES', label: 'Spain' },
  { id: 'PT', label: 'Portugal' },
  { id: 'TW', label: 'Taiwan' }
];

const CHARITY_ORGS = [
  { id: 'direct_relief', label: 'Direct Relief' },
  { id: 'red_cross', label: 'American Red Cross' },
  { id: 'st_jude', label: "St. Jude Children's Research Hospital" },
  { id: 'wwf', label: 'World Wildlife Fund' },
  { id: 'feeding_america', label: 'Feeding America' },
  { id: 'habitat', label: 'Habitat for Humanity' },
  { id: 'doctors_without_borders', label: 'Doctors Without Borders' }
];

const PRODUCT_DOC_TYPES = [
  { id: 'user_guide', label: 'User Guide' },
  { id: 'certificate', label: 'Certificate of Authenticity' },
  { id: 'warranty', label: 'Warranty' },
  { id: 'manual', label: 'Manual' },
  { id: 'safety_sheet', label: 'Safety Sheet' },
  { id: 'declaration', label: 'Declaration of Conformity' }
];

const DEFAULT_COMMON_ASPECTS = [
  'Brand', 'Size', 'Color', 'Style', 'Department', 'Type', 'Material', 
  'Fit', 'Pattern', 'Season', 'Sleeve Length', 'Neckline', 'Occasion', 
  'Features', 'Closure', 'Accents', 'Theme', 'Vintage', 'Country/Region of Manufacture', 
  'Model', 'Character', 'Garment Care', 'Fabric Type', 'MPN', 'UPC'
];

const EBAY_CONDITIONS = [
  { id: '1000', label: 'New with tags', description: 'A brand-new, unused, and unworn item with original tags.' },
  { id: '1500', label: 'New without tags', description: 'A brand-new, unused, and unworn item without original tags.' },
  { id: '1750', label: 'New with defects', description: 'A brand-new, unused item with defects.' },
  { id: '3000', label: 'Pre-owned - Like New', description: 'An item that has been used but is in mint condition.' },
  { id: '4000', label: 'Pre-owned - Very Good', description: 'An item that has been used but shows minimal signs of wear.' },
  { id: '5000', label: 'Pre-owned - Good', description: 'An item that shows moderate wear and is fully functional.' },
  { id: '6000', label: 'Pre-owned - Fair', description: 'An item with obvious wear but functions properly.' }
];

const mapEbayCondition = (condition) => {
  if (!condition) return '5000';
  const c = String(condition).toLowerCase();
  if (c.includes('new with tag') || c === '1000' || c === 'new') return '1000';
  if (c.includes('without tag') || c === '1500') return '1500';
  if (c.includes('defect') || c === '1750') return '1750';
  if (c.includes('like new') || c === '3000') return '3000';
  if (c.includes('very good') || c === '4000') return '4000';
  if (c.includes('good') || c === '5000') return '5000';
  if (c.includes('fair') || c.includes('acceptable') || c === '6000') return '6000';
  return '5000';
};

const SearchableDropdown = ({ value, onSelect, options = [], placeholder = 'Select...', disabled = false, error = false }) => {
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
    return options.filter(opt => {
      const label = String(opt?.label || opt?.name || '').toLowerCase();
      const desc = String(opt?.description || '').toLowerCase();
      return label.includes(q) || desc.includes(q);
    });
  }, [options, searchTerm]);

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full h-11 px-3 bg-white border ${
          error ? 'border-rose-500 ring-2 ring-rose-500/10' : 'border-slate-200 hover:border-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/5'
        } rounded-xl text-left flex items-center justify-between text-xs font-bold text-slate-800 disabled:opacity-60 transition-all`}
      >
        <span className="truncate pr-2">{value || placeholder}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {value && !disabled && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onSelect({ id: '', label: '' });
                setSearchTerm('');
              }}
              className="p-1 hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {isOpen && !disabled && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-[9999] overflow-hidden animate-in fade-in duration-150">
          <div className="p-2 bg-slate-50 border-b border-slate-100">
            <input
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
              className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs font-medium outline-none focus:border-slate-800"
            />
          </div>
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-50">
            {filteredOptions.length > 0 ? filteredOptions.map((opt) => (
              <button
                key={opt.id || opt.label}
                type="button"
                onClick={() => {
                  onSelect(opt);
                  setIsOpen(false);
                  setSearchTerm('');
                }}
                className={`w-full text-left px-3.5 py-2.5 hover:bg-slate-100 text-slate-700 hover:text-slate-900 transition-colors flex items-center justify-between text-xs font-semibold ${value === opt.label ? 'bg-slate-100 font-bold text-slate-900' : ''}`}
              >
                <div className="truncate pr-2">
                  <div>{opt.label || opt.name}</div>
                  {opt.description && <div className="text-[10px] text-slate-400 font-normal">{opt.description}</div>}
                </div>
                {value === opt.label && <Check className="w-3.5 h-3.5 text-slate-900 shrink-0" />}
              </button>
            )) : (
              <div className="p-4 text-xs text-slate-400 text-center">No options found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const CategorySearchDropdown = ({ value, onSelect, placeholder = 'Search eBay categories...' }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setSuggestions([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await ebayService.suggestCategories(searchTerm);
        if (response.data.success) {
          setSuggestions(response.data.data);
        }
      } catch (err) {
        console.error("Error fetching category suggestions:", err);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [searchTerm]);

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div className="relative">
        <input 
          className="w-full px-3 h-11 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-slate-800 transition-all shadow-xs"
          value={isOpen ? searchTerm : (value || '')}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
            setSearchTerm(value || '');
          }}
          placeholder={placeholder}
        />
        <ChevronDown 
          className="absolute right-3 top-3.5 w-4 h-4 text-slate-400 cursor-pointer" 
          onClick={() => {
            setIsOpen(!isOpen);
            if (!isOpen) setSearchTerm(value || '');
          }}
        />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-[9999] max-h-60 overflow-y-auto animate-in fade-in duration-150">
          {loading && (
            <div className="p-3 text-xs font-semibold text-slate-400 text-center">Searching eBay Categories...</div>
          )}
          {!loading && suggestions.length === 0 && searchTerm.trim() && (
            <div className="p-3 text-xs font-semibold text-slate-400 text-center">No categories found</div>
          )}
          {suggestions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                onSelect(opt);
                setIsOpen(false);
                setSearchTerm('');
              }}
              className="w-full text-left px-3.5 py-2.5 border-b border-slate-50 last:border-b-0 hover:bg-slate-100 text-slate-700 transition-colors"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-slate-800">{opt.label}</span>
                <span className="text-[10px] text-slate-400">ID: {opt.id}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const CreateEbayListing = ({ isModal = false, editId: propEditId = null, initialListing = null, onClose = null }) => {
  const navigate = useNavigate();
  const { toast } = useNotification();
  const [searchParams] = useSearchParams();
  const editId = propEditId || searchParams.get('edit');
  const platform = 'ebay';

  const [loading, setLoading] = useState(false);
  const [descriptionMode, setDescriptionMode] = useState('edit');
  const [rules, setRules] = useState([]);
  const [aspects, setAspects] = useState([]);
  const [ebayPolicies, setEbayPolicies] = useState({ fulfillment: [], payment: [], returns: [], locations: [] });
  const [isConvertingImages, setIsConvertingImages] = useState(false);

  // Custom aspect adder
  const [newAspectKey, setNewAspectKey] = useState('');
  const [newAspectVal, setNewAspectVal] = useState('');
  const [showAddAspect, setShowAddAspect] = useState(false);

  const [formData, setFormData] = useState({
    images: [],
    selectedRule: '',
    selectedCondition: 'Pre-owned - Good',
    conditionId: '5000',
    title: '',
    category: '',
    categoryId: '',
    price: '',
    description: '',
    conditionNote: '',
    selectedAspects: {},
    sku: '',
    selectedModel: 'gpt-4o-mini',
    packageWeight: { lbs: 1, oz: 0 },
    packageDimensions: { length: 10, width: 8, height: 2 },
    fulfillmentPolicyId: '',
    paymentPolicyId: '',
    returnPolicyId: '',
    locationKey: '',
    format: 'Buy It Now',
    duration: 'GTC',
    quantity: '1',

    // New Fields from eBay PDF
    yourCost: '',
    allowOffers: false,
    minOfferPrice: '',
    autoAcceptPrice: '',
    volumePricingEnabled: false,
    volumePricingTier2: '5',
    volumePricingTier3: '10',
    volumePricingTier4: '15',
    scheduleListing: false,
    scheduleDate: '',
    scheduleTime: '12:00',
    irregularPackage: false,
    displayUkSite: false,
    countryOfOrigin: 'China',
    itemLocationZip: '23294',
    itemLocationCity: 'Henrico, Virginia, United States',
    productDocumentsEnabled: false,
    productDocType: 'User Guide',
    productDocUrl: '',
    promotedGeneral: false,
    promotedGeneralRate: '7.5',
    promotedPriority: false,
    promotedPriorityBid: '0.45',
    charityEnabled: false,
    charityPercentage: '10',
    charityOrg: 'Direct Relief'
  });

  const modelOptions = useMemo(() => [
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini (OpenAI)', description: 'Fast, cost-efficient model' },
    { id: 'gpt-4o', label: 'GPT-4o (OpenAI)', description: 'High-accuracy model' },
    { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (Google)', description: 'Fast Google AI model' },
    { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (Google)', description: 'Intelligent Google AI model' },
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (Google)', description: 'Ultra-fast Google AI model' }
  ], []);

  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const [rulesRes, policiesRes] = await Promise.all([
          ruleService.getAll(),
          ebayService.getPolicies()
        ]);

        if (rulesRes.data?.success) {
          const rulesData = rulesRes.data.data;
          setRules(rulesData);
          if (rulesData.length > 0 && !formData.selectedRule) {
            setFormData(prev => ({ ...prev, selectedRule: rulesData[0]._id || rulesData[0].id }));
          }
        }

        if (policiesRes.data?.success) {
          const pol = policiesRes.data.data || {};
          setEbayPolicies(pol);
          setFormData(prev => ({
            ...prev,
            fulfillmentPolicyId: prev.fulfillmentPolicyId || pol.fulfillment?.[0]?.fulfillmentPolicyId || '',
            paymentPolicyId: prev.paymentPolicyId || pol.payment?.[0]?.paymentPolicyId || '',
            returnPolicyId: prev.returnPolicyId || pol.returns?.[0]?.returnPolicyId || '',
            locationKey: prev.locationKey || pol.locations?.[0]?.merchantLocationKey || ''
          }));
        }
      } catch (err) {
        console.error("Failed to load initial data:", err);
      }

      if (initialListing) {
        const eData = initialListing.platformData?.ebay || (initialListing.platform === 'ebay' ? initialListing : {});
        let rawAspects = {};
        const srcAspects = eData.itemSpecifics || initialListing.itemSpecifics || eData.aspects || {};
        if (srcAspects && typeof srcAspects === 'object') {
          Object.entries(srcAspects).forEach(([k, v]) => {
            rawAspects[k] = Array.isArray(v) ? v : [v];
          });
        }
        const b = initialListing.brand || eData.brand || rawAspects['Brand']?.[0] || '';
        const s = initialListing.size || eData.size || rawAspects['Size']?.[0] || '';
        const c = initialListing.color || eData.color || rawAspects['Color']?.[0] || '';
        if (b && !rawAspects['Brand']) rawAspects['Brand'] = [b];
        if (s && !rawAspects['Size']) rawAspects['Size'] = [s];
        if (c && !rawAspects['Color']) rawAspects['Color'] = [c];

        setFormData(prev => ({
          ...prev,
          images: initialListing.images || [],
          title: eData.title || initialListing.title || '',
          price: eData.price !== undefined ? eData.price : (initialListing.price || ''),
          description: eData.description || initialListing.description || '',
          category: eData.category || (initialListing.platform === 'ebay' ? initialListing.category : '') || '',
          categoryId: eData.categoryId || (initialListing.platform === 'ebay' ? initialListing.categoryId : '') || '',
          selectedAspects: { ...prev.selectedAspects, ...rawAspects },
          sku: eData.sku || initialListing.sku || '',
          conditionId: eData.conditionId || mapEbayCondition(initialListing.condition),
          yourCost: eData.yourCost || prev.yourCost,
          format: eData.format || prev.format,
          quantity: eData.quantity || prev.quantity,
          allowOffers: eData.allowOffers !== undefined ? eData.allowOffers : prev.allowOffers,
          minOfferPrice: eData.minOfferPrice || prev.minOfferPrice,
          autoAcceptPrice: eData.autoAcceptPrice || prev.autoAcceptPrice,
          volumePricingEnabled: eData.volumePricingEnabled !== undefined ? eData.volumePricingEnabled : prev.volumePricingEnabled,
          volumePricingTier2: eData.volumePricingTier2 || prev.volumePricingTier2,
          volumePricingTier3: eData.volumePricingTier3 || prev.volumePricingTier3,
          volumePricingTier4: eData.volumePricingTier4 || prev.volumePricingTier4,
          scheduleListing: eData.scheduleListing !== undefined ? eData.scheduleListing : prev.scheduleListing,
          scheduleDate: eData.scheduleDate || prev.scheduleDate,
          scheduleTime: eData.scheduleTime || prev.scheduleTime,
          irregularPackage: eData.irregularPackage !== undefined ? eData.irregularPackage : prev.irregularPackage,
          displayUkSite: eData.displayUkSite !== undefined ? eData.displayUkSite : prev.displayUkSite,
          countryOfOrigin: eData.countryOfOrigin || prev.countryOfOrigin,
          itemLocationZip: eData.itemLocationZip || prev.itemLocationZip,
          itemLocationCity: eData.itemLocationCity || prev.itemLocationCity,
          productDocumentsEnabled: eData.productDocumentsEnabled !== undefined ? eData.productDocumentsEnabled : prev.productDocumentsEnabled,
          productDocType: eData.productDocType || prev.productDocType,
          productDocUrl: eData.productDocUrl || prev.productDocUrl,
          promotedGeneral: eData.promotedGeneral !== undefined ? eData.promotedGeneral : prev.promotedGeneral,
          promotedGeneralRate: eData.promotedGeneralRate || prev.promotedGeneralRate,
          promotedPriority: eData.promotedPriority !== undefined ? eData.promotedPriority : prev.promotedPriority,
          promotedPriorityBid: eData.promotedPriorityBid || prev.promotedPriorityBid,
          charityEnabled: eData.charityEnabled !== undefined ? eData.charityEnabled : prev.charityEnabled,
          charityPercentage: eData.charityPercentage || prev.charityPercentage,
          charityOrg: eData.charityOrg || prev.charityOrg
        }));
      }

      const targetDbId = editId || initialListing?._id || initialListing?.id;
      if (targetDbId && !String(targetDbId).startsWith('mock-')) {
        setLoading(true);
        try {
          const res = await listingService.getOne(targetDbId);
          if (res.data?.success && res.data?.data) {
            const raw = res.data.data;
            const eData = raw.platformData?.ebay || (raw.platform === 'ebay' ? raw : {});
            let rawAspects = {};
            const srcAspects = eData.itemSpecifics || raw.itemSpecifics || eData.aspects || {};
            if (srcAspects && typeof srcAspects === 'object') {
              Object.entries(srcAspects).forEach(([k, v]) => {
                rawAspects[k] = Array.isArray(v) ? v : [v];
              });
            }
            const b = raw.brand || eData.brand || rawAspects['Brand']?.[0] || '';
            const s = raw.size || eData.size || rawAspects['Size']?.[0] || '';
            const c = raw.color || eData.color || rawAspects['Color']?.[0] || '';
            if (b && !rawAspects['Brand']) rawAspects['Brand'] = [b];
            if (s && !rawAspects['Size']) rawAspects['Size'] = [s];
            if (c && !rawAspects['Color']) rawAspects['Color'] = [c];

            setFormData(prev => ({
              ...prev,
              images: (raw.images && raw.images.length > 0) ? raw.images : (eData.images || prev.images),
              title: eData.title || raw.title || prev.title,
              price: eData.price !== undefined ? eData.price : (raw.price || prev.price),
              description: eData.description || raw.description || prev.description,
              category: resolveEbayCategoryFallback(
                eData.category || (raw.platform === 'ebay' ? raw.category : '') || prev.category,
                eData.title || raw.title,
                b
              ).category,
              categoryId: (eData.categoryId && String(eData.categoryId) !== '206') ? String(eData.categoryId) : (resolveEbayCategoryFallback(
                eData.category || (raw.platform === 'ebay' ? raw.category : '') || prev.category,
                eData.title || raw.title,
                b
              ).categoryId || prev.categoryId),
              selectedAspects: { ...prev.selectedAspects, ...rawAspects },
              sku: eData.sku || raw.sku || prev.sku,
              fulfillmentPolicyId: eData.fulfillmentPolicyId || prev.fulfillmentPolicyId,
              paymentPolicyId: eData.paymentPolicyId || prev.paymentPolicyId,
              returnPolicyId: eData.returnPolicyId || prev.returnPolicyId,
              locationKey: eData.locationKey || prev.locationKey,
              conditionId: eData.conditionId || mapEbayCondition(raw.condition) || prev.conditionId,
              yourCost: eData.yourCost || prev.yourCost,
              format: eData.format || prev.format,
              quantity: eData.quantity || prev.quantity,
              allowOffers: eData.allowOffers !== undefined ? eData.allowOffers : prev.allowOffers,
              minOfferPrice: eData.minOfferPrice || prev.minOfferPrice,
              autoAcceptPrice: eData.autoAcceptPrice || prev.autoAcceptPrice,
              volumePricingEnabled: eData.volumePricingEnabled !== undefined ? eData.volumePricingEnabled : prev.volumePricingEnabled,
              volumePricingTier2: eData.volumePricingTier2 || prev.volumePricingTier2,
              volumePricingTier3: eData.volumePricingTier3 || prev.volumePricingTier3,
              volumePricingTier4: eData.volumePricingTier4 || prev.volumePricingTier4,
              scheduleListing: eData.scheduleListing !== undefined ? eData.scheduleListing : prev.scheduleListing,
              scheduleDate: eData.scheduleDate || prev.scheduleDate,
              scheduleTime: eData.scheduleTime || prev.scheduleTime,
              irregularPackage: eData.irregularPackage !== undefined ? eData.irregularPackage : prev.irregularPackage,
              displayUkSite: eData.displayUkSite !== undefined ? eData.displayUkSite : prev.displayUkSite,
              countryOfOrigin: eData.countryOfOrigin || prev.countryOfOrigin,
              itemLocationZip: eData.itemLocationZip || prev.itemLocationZip,
              itemLocationCity: eData.itemLocationCity || prev.itemLocationCity,
              productDocumentsEnabled: eData.productDocumentsEnabled !== undefined ? eData.productDocumentsEnabled : prev.productDocumentsEnabled,
              productDocType: eData.productDocType || prev.productDocType,
              productDocUrl: eData.productDocUrl || prev.productDocUrl,
              promotedGeneral: eData.promotedGeneral !== undefined ? eData.promotedGeneral : prev.promotedGeneral,
              promotedGeneralRate: eData.promotedGeneralRate || prev.promotedGeneralRate,
              promotedPriority: eData.promotedPriority !== undefined ? eData.promotedPriority : prev.promotedPriority,
              promotedPriorityBid: eData.promotedPriorityBid || prev.promotedPriorityBid,
              charityEnabled: eData.charityEnabled !== undefined ? eData.charityEnabled : prev.charityEnabled,
              charityPercentage: eData.charityPercentage || prev.charityPercentage,
              charityOrg: eData.charityOrg || prev.charityOrg
            }));
          }
        } catch (err) {
          console.error("Error fetching listing:", err);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchInitial();
  }, [editId, initialListing]);

  // Fetch aspects when categoryId changes
  useEffect(() => {
    if (!formData.categoryId) return;
    const fetchAspects = async () => {
      try {
        const res = await ebayService.getCategoryAspects(formData.categoryId);
        if (res.data?.success) {
          setAspects(res.data.data?.aspects || res.data.data || []);
        }
      } catch (err) {
        console.error("Error loading category aspects:", err);
      }
    };
    fetchAspects();
  }, [formData.categoryId]);

  const handleImageUpload = async (e) => {
    const uploadedFiles = Array.from(e.target.files);
    setIsConvertingImages(true);
    try {
      const base64Images = await Promise.all(
        uploadedFiles.map(file => compressImage(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.8 }))
      );
      setFormData(prev => ({ ...prev, images: [...prev.images, ...base64Images] }));
    } catch (err) {
      console.error("Error compressing images:", err);
      toast.error("Failed to process some images.");
    } finally {
      setIsConvertingImages(false);
    }
  };

  const startAIFetch = async () => {
    if (formData.images.length === 0) {
      toast.warning("Please upload at least one image.");
      return;
    }
    if (!formData.selectedRule) {
      toast.warning("Please select an AI Listing Rule.");
      return;
    }

    setLoading(true);
    const selectedRuleObj = rules.find(r => (r._id || r.id) === formData.selectedRule);

    try {
      const response = await aiService.ebayAnalyze({
        images: formData.images,
        title_sequence: selectedRuleObj?.title_sequence || [],
        description_prompt: selectedRuleObj?.description_prompt || '',
        description_template: selectedRuleObj?.description_template || '',
        condition_note: selectedRuleObj?.condition_note || '',
        condition_name: EBAY_CONDITIONS.find(c => c.id === formData.conditionId)?.label || 'Pre-owned - Good',
        model: formData.selectedModel || 'gpt-4o-mini',
        existing_title: formData.title || ''
      });

      if (response.data.success) {
        const result = response.data.data;
        const brandVal = result.brand || '';
        const sizeVal = result.size || '';
        const colorVal = result.color || '';
        const resolvedEbay = resolveEbayCategoryFallback(
          result.ebay_category_name || result.category_name || result.category || '',
          result.title || '',
          brandVal
        );

        if (Array.isArray(result.aspects) && result.aspects.length > 0) {
          setAspects(result.aspects);
        }

        const rawSpecifics = result.item_specifics || (typeof result.aspects === 'object' && !Array.isArray(result.aspects) ? result.aspects : {});
        const formattedAspects = {};
        Object.entries(rawSpecifics).forEach(([k, v]) => {
          if (v) formattedAspects[k] = Array.isArray(v) ? v : [String(v)];
        });

        const cleanedDesc = cleanHtmlDescription(result.description);

        setFormData(prev => ({
          ...prev,
          title: result.title || prev.title,
          price: result.price || prev.price,
          description: cleanedDesc || result.description || prev.description,
          category: result.ebay_category_name || resolvedEbay.category || prev.category,
          categoryId: (result.ebay_category_id && String(result.ebay_category_id) !== '206') ? String(result.ebay_category_id) : (result.category_id && String(result.category_id) !== '206' ? String(result.category_id) : (resolvedEbay.categoryId || prev.categoryId)),
          selectedAspects: {
            ...prev.selectedAspects,
            ...(brandVal ? { Brand: [brandVal] } : {}),
            ...(sizeVal ? { Size: [sizeVal] } : {}),
            ...(colorVal ? { Color: [colorVal] } : {}),
            ...formattedAspects
          },
          sku: result.sku || prev.sku
        }));
        toast.success("AI scanning complete! eBay details prefilled.");
      }
    } catch (error) {
      console.error("AI Analysis Error:", error);
      toast.error("Failed to analyze product with AI.");
    } finally {
      setLoading(false);
    }
  };

  const moveImage = (index, direction) => {
    const newImages = [...formData.images];
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newImages.length) return;
    [newImages[index], newImages[targetIndex]] = [newImages[targetIndex], newImages[index]];
    setFormData(prev => ({ ...prev, images: newImages }));
  };

  const deleteImage = (index) => {
    const newImages = formData.images.filter((_, idx) => idx !== index);
    setFormData(prev => ({ ...prev, images: newImages }));
  };

  const handleAspectChange = (aspectName, value) => {
    setFormData(prev => ({
      ...prev,
      selectedAspects: {
        ...prev.selectedAspects,
        [aspectName]: Array.isArray(value) ? value : [value]
      }
    }));
  };

  const handleAddCustomAspect = () => {
    if (!newAspectKey.trim() || !newAspectVal.trim()) return;
    setFormData(prev => ({
      ...prev,
      selectedAspects: {
        ...prev.selectedAspects,
        [newAspectKey.trim()]: [newAspectVal.trim()]
      }
    }));
    setNewAspectKey('');
    setNewAspectVal('');
    setShowAddAspect(false);
  };

  const handleSaveListing = async (publishMode = null) => {
    if (!formData.title) {
      toast.warning("Title is required before saving.");
      return;
    }
    if (!formData.price) {
      toast.warning("Price is required before saving.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        platform: 'ebay',
        images: formData.images,
        selectedRule: formData.selectedRule,
        title: formData.title,
        category: formData.category,
        categoryId: formData.categoryId,
        price: formData.price,
        description: formData.description,
        conditionId: formData.conditionId,
        conditionNote: formData.conditionNote,
        selectedAspects: formData.selectedAspects,
        itemSpecifics: formData.selectedAspects,
        sku: formData.sku,
        packageWeight: formData.packageWeight,
        packageDimensions: formData.packageDimensions,
        fulfillmentPolicyId: formData.fulfillmentPolicyId,
        paymentPolicyId: formData.paymentPolicyId,
        returnPolicyId: formData.returnPolicyId,
        locationKey: formData.locationKey,
        platformData: {
          ebay: {
            title: formData.title,
            category: formData.category,
            categoryId: formData.categoryId,
            price: formData.price,
            yourCost: formData.yourCost,
            quantity: formData.quantity,
            conditionId: formData.conditionId,
            selectedAspects: formData.selectedAspects,
            aspects: formData.selectedAspects,
            sku: formData.sku,
            fulfillmentPolicyId: formData.fulfillmentPolicyId,
            paymentPolicyId: formData.paymentPolicyId,
            returnPolicyId: formData.returnPolicyId,
            locationKey: formData.locationKey,
            packageWeight: formData.packageWeight,
            packageDimensions: formData.packageDimensions,
            description: formData.description,
            format: formData.format,
            allowOffers: formData.allowOffers,
            minOfferPrice: formData.minOfferPrice,
            autoAcceptPrice: formData.autoAcceptPrice,
            volumePricingEnabled: formData.volumePricingEnabled,
            volumePricingTier2: formData.volumePricingTier2,
            volumePricingTier3: formData.volumePricingTier3,
            volumePricingTier4: formData.volumePricingTier4,
            scheduleListing: formData.scheduleListing,
            scheduleDate: formData.scheduleDate,
            scheduleTime: formData.scheduleTime,
            irregularPackage: formData.irregularPackage,
            displayUkSite: formData.displayUkSite,
            countryOfOrigin: formData.countryOfOrigin,
            itemLocationZip: formData.itemLocationZip,
            itemLocationCity: formData.itemLocationCity,
            productDocumentsEnabled: formData.productDocumentsEnabled,
            productDocType: formData.productDocType,
            productDocUrl: formData.productDocUrl,
            promotedGeneral: formData.promotedGeneral,
            promotedGeneralRate: formData.promotedGeneralRate,
            promotedPriority: formData.promotedPriority,
            promotedPriorityBid: formData.promotedPriorityBid,
            charityEnabled: formData.charityEnabled,
            charityPercentage: formData.charityPercentage,
            charityOrg: formData.charityOrg
          }
        }
      };

      let listingIdResult = editId;

      if (editId) {
        await listingService.update(editId, payload);
        toast.success("eBay listing updated successfully!");
      } else {
        const res = await listingService.create(payload);
        listingIdResult = res.data?.data?._id;
        toast.success("Saved as draft successfully!");
      }

      if (publishMode === 'direct') {
        toast.info("Listing to eBay via Direct API...");
        const pubRes = await externalImportService.publish(listingIdResult, { platform: 'ebay' });
        if (pubRes.data?.success) {
          toast.success("Successfully published to eBay!");
        }
      }

      if (onClose) onClose();
      else navigate('/listings');

    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to save listing.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto py-4 px-4 sm:px-6 space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <button 
            type="button" 
            onClick={() => onClose ? onClose() : navigate(-1)}
            className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 transition-colors"
            title="Go Back"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center border border-slate-200">
            <img src="/ebay.png" className="w-6 h-6 object-contain" alt="eBay" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">
                {editId ? 'Edit eBay Listing' : 'Create eBay Listing'}
              </h1>
              <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-bold rounded-md uppercase">
                eBay
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Configure product specifics, categories, pricing, business policies, and item aspects
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleSaveListing(null)}
            disabled={loading}
          >
            Save Draft
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => handleSaveListing('direct')}
            loading={loading}
            icon={<Zap size={14} />}
          >
            {editId ? 'Update & List' : 'List on eBay'}
          </Button>
        </div>
      </div>

      {/* Main 2-Column Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Photos & AI Scanner */}
        <div className="lg:col-span-4 lg:sticky lg:top-4 space-y-4">
          
          {/* Photo Manager Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <ImageIcon size={14} className="text-slate-600" /> Photos ({formData.images.length})
              </label>
              <label className="text-[11px] font-bold text-slate-700 hover:text-slate-900 cursor-pointer underline">
                + Add Photos
                <input 
                  type="file" 
                  multiple 
                  accept="image/*" 
                  onChange={handleImageUpload} 
                  className="hidden" 
                />
              </label>
            </div>

            {formData.images.length === 0 ? (
              <label className="border-2 border-dashed border-slate-200 hover:border-slate-400 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-slate-50 hover:bg-slate-100">
                <Upload size={24} className="text-slate-400 mb-2" />
                <span className="text-xs font-bold text-slate-700">Upload Product Images</span>
                <span className="text-[10px] text-slate-400 mt-0.5">JPEG, PNG, WEBP up to 10MB</span>
                <input 
                  type="file" 
                  multiple 
                  accept="image/*" 
                  onChange={handleImageUpload} 
                  className="hidden" 
                />
              </label>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {formData.images.map((img, idx) => (
                  <div 
                    key={idx} 
                    className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shadow-xs"
                  >
                    <img 
                      src={img} 
                      alt="" 
                      className="w-full h-full object-cover" 
                    />
                    
                    {idx === 0 && (
                      <span className="absolute top-1 left-1 bg-slate-900 text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow">
                        Cover
                      </span>
                    )}

                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-1">
                      <button 
                        type="button" 
                        onClick={() => deleteImage(idx)}
                        className="self-end p-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px]"
                        title="Delete photo"
                      >
                        <Trash2 size={10} />
                      </button>
                      <div className="flex justify-between gap-1">
                        <button 
                          type="button" 
                          disabled={idx === 0}
                          onClick={() => moveImage(idx, 'left')}
                          className="px-1.5 py-0.5 bg-white/30 hover:bg-white/50 text-white rounded text-[9px] font-bold disabled:opacity-30"
                          title="Move left"
                        >
                          <ArrowLeft size={10} />
                        </button>
                        <button 
                          type="button" 
                          disabled={idx === formData.images.length - 1}
                          onClick={() => moveImage(idx, 'right')}
                          className="px-1.5 py-0.5 bg-white/30 hover:bg-white/50 text-white rounded text-[9px] font-bold disabled:opacity-30"
                          title="Move right"
                        >
                          <ArrowRight size={10} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {isConvertingImages && (
              <div className="flex items-center gap-2 text-slate-600 text-xs font-semibold animate-pulse pt-1">
                <Loader2 className="animate-spin" size={12} /> Processing images...
              </div>
            )}
          </div>

          {/* AI Listing Scanner Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Sparkles size={14} className="text-slate-700" /> AI Listing Scanner
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Auto-prefill</span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Listing Rule</label>
                <SearchableDropdown 
                  value={rules.find(r => (r._id || r.id) === formData.selectedRule)?.name}
                  onSelect={(opt) => setFormData(prev => ({ ...prev, selectedRule: opt.id }))}
                  options={rules.map(r => ({ id: r._id || r.id, label: r.name }))}
                  placeholder="Select rule..."
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Condition</label>
                  <SearchableDropdown 
                    value={EBAY_CONDITIONS.find(c => c.id === formData.conditionId)?.label}
                    onSelect={(opt) => setFormData(prev => ({ ...prev, conditionId: opt.id }))}
                    options={EBAY_CONDITIONS}
                    placeholder="Select condition..."
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">AI Model</label>
                  <SearchableDropdown 
                    value={modelOptions.find(m => m.id === formData.selectedModel)?.label}
                    onSelect={(opt) => setFormData(prev => ({ ...prev, selectedModel: opt.id }))}
                    options={modelOptions}
                    placeholder="Select model..."
                  />
                </div>
              </div>

              <Button
                type="button"
                variant="primary"
                size="md"
                className="w-full mt-2"
                onClick={startAIFetch}
                loading={loading}
                disabled={loading || formData.images.length === 0}
                icon={<Sparkles size={14} />}
              >
                Analyze Product & Prefill
              </Button>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: eBay Form Details, Aspects & Policies */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Section 1: Listing Details */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              eBay Listing Details
            </h2>

            {/* Title */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-slate-700">Listing Title *</label>
                <span className="text-[10px] text-slate-400">{formData.title.length}/80</span>
              </div>
              <input 
                type="text"
                className="w-full px-3 h-10 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-slate-800"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value.substring(0, 80) }))}
                placeholder="Brand, item name, model, size, color, condition..."
                maxLength={80}
              />
            </div>

            {/* Category Search Dropdown */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">eBay Category *</label>
              <CategorySearchDropdown 
                value={formData.category}
                onSelect={(opt) => setFormData(prev => ({ ...prev, category: opt.label, categoryId: opt.id }))}
                placeholder="Search eBay category (e.g. Men's Sneakers, Vintage Jackets)..."
              />
            </div>

            {/* Format, Price, Your Cost, Quantity & SKU */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Format</label>
                <select
                  value={formData.format}
                  onChange={(e) => setFormData(prev => ({ ...prev, format: e.target.value }))}
                  className="w-full px-2.5 h-10 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-slate-800"
                >
                  <option value="Buy It Now">Buy It Now</option>
                  <option value="Auction">Auction</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Item Price ($) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">$</span>
                  <input 
                    type="number"
                    step="0.01"
                    className="w-full pl-7 pr-3 h-10 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-slate-800"
                    value={formData.price}
                    onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-700">Your Cost ($)</label>
                  <span className="text-[9px] text-slate-400 font-normal">Optional</span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">$</span>
                  <input 
                    type="number"
                    step="0.01"
                    className="w-full pl-7 pr-3 h-10 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-slate-800"
                    value={formData.yourCost}
                    onChange={(e) => setFormData(prev => ({ ...prev, yourCost: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
                <span className="text-[9px] text-slate-400 block mt-0.5">Not visible to buyers</span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Quantity</label>
                <input 
                  type="number"
                  min="1"
                  className="w-full px-3 h-10 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-slate-800"
                  value={formData.quantity}
                  onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Custom SKU</label>
                <input 
                  type="text"
                  className="w-full px-3 h-10 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-slate-800"
                  value={formData.sku}
                  onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                  placeholder="Optional SKU"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Description */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-slate-700" />
                <h2 className="text-sm font-bold text-slate-900">Description</h2>
              </div>
              <button
                type="button"
                onClick={() => setDescriptionMode(prev => prev === 'edit' ? 'preview' : 'edit')}
                className="text-[11px] font-bold text-slate-600 hover:text-slate-900 px-2 py-1 bg-slate-100 rounded-lg"
              >
                {descriptionMode === 'edit' ? 'Preview' : 'Edit'}
              </button>
            </div>

            {descriptionMode === 'edit' ? (
              <textarea 
                rows={6}
                className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-slate-800 leading-relaxed"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Detailed item description (features, dimensions, condition details)..."
              />
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 whitespace-pre-wrap min-h-[140px] leading-relaxed">
                {formData.description || <span className="text-slate-400 italic">No description entered</span>}
              </div>
            )}
          </div>

          {/* Section 3: Item Specifics (Aspects) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-slate-700" />
                <h2 className="text-sm font-bold text-slate-900">Item Specifics (Aspects)</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowAddAspect(!showAddAspect)}
                className="text-xs font-bold text-slate-700 hover:text-slate-900 flex items-center gap-1 underline"
              >
                <Plus size={13} /> Add Custom Aspect
              </button>
            </div>

            {/* Custom Aspect Adder Modal/Inline */}
            {showAddAspect && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center gap-2">
                <input 
                  type="text"
                  placeholder="Aspect Name (e.g. Pattern)"
                  value={newAspectKey}
                  onChange={(e) => setNewAspectKey(e.target.value)}
                  className="flex-1 min-w-[140px] px-3 h-9 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-slate-800"
                />
                <input 
                  type="text"
                  placeholder="Value (e.g. Solid)"
                  value={newAspectVal}
                  onChange={(e) => setNewAspectVal(e.target.value)}
                  className="flex-1 min-w-[140px] px-3 h-9 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-slate-800"
                />
                <Button type="button" variant="primary" size="sm" onClick={handleAddCustomAspect}>
                  Add
                </Button>
                <button type="button" onClick={() => setShowAddAspect(false)} className="p-1 text-slate-400 hover:text-slate-600">
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Aspects Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[520px] overflow-y-auto pr-1">
              {aspects.length > 0 ? (
                aspects.map((aspect) => {
                  const aspectName = aspect.localizedAspectName || aspect.aspectConstraint?.aspectName || aspect.name;
                  const currentVal = formData.selectedAspects[aspectName]?.[0] || formData.selectedAspects[aspectName] || '';
                  const isRequired = aspect.aspectConstraint?.aspectRequired || false;
                  const hasValues = aspect.aspectValues && aspect.aspectValues.length > 0;
                  const listId = `ebay-single-aspect-${aspectName.replace(/[^a-zA-Z0-9]/g, '_')}`;

                  return (
                    <div key={aspectName} className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700 truncate" title={aspectName}>
                        {aspectName} {isRequired && <span className="text-rose-500">*</span>}
                      </label>
                      <input 
                        type="text"
                        list={hasValues ? listId : undefined}
                        className="w-full px-3 h-9 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-slate-800"
                        value={currentVal}
                        onChange={(e) => handleAspectChange(aspectName, e.target.value)}
                        placeholder={`Enter ${aspectName}...`}
                      />
                      {hasValues && (
                        <datalist id={listId}>
                          {aspect.aspectValues.map((v, i) => (
                            <option key={i} value={v.localizedValue || v.value || v} />
                          ))}
                        </datalist>
                      )}
                    </div>
                  );
                })
              ) : (
                DEFAULT_COMMON_ASPECTS.map((name) => {
                  const val = formData.selectedAspects[name]?.[0] || formData.selectedAspects[name] || '';
                  return (
                    <div key={name} className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-700">{name}</label>
                      <input 
                        type="text"
                        className="w-full px-3 h-9 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-slate-800"
                        value={val}
                        onChange={(e) => handleAspectChange(name, e.target.value)}
                        placeholder={`Enter ${name}...`}
                      />
                    </div>
                  );
                })
              )}

              {Object.keys(formData.selectedAspects)
                .filter(k => 
                  (aspects.length > 0 
                    ? !aspects.some(a => (a.localizedAspectName || a.name) === k)
                    : !DEFAULT_COMMON_ASPECTS.includes(k)
                  )
                )
                .map((k) => (
                  <div key={k} className="space-y-1 relative group">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-bold text-slate-700 truncate">{k}</label>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = { ...formData.selectedAspects };
                          delete updated[k];
                          setFormData(prev => ({ ...prev, selectedAspects: updated }));
                        }}
                        className="text-rose-500 hover:text-rose-700 text-[10px]"
                      >
                        Remove
                      </button>
                    </div>
                    <input 
                      type="text"
                      className="w-full px-3 h-9 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-slate-800"
                      value={formData.selectedAspects[k]?.[0] || formData.selectedAspects[k] || ''}
                      onChange={(e) => handleAspectChange(k, e.target.value)}
                    />
                  </div>
                ))}
            </div>
          </div>

          {/* Section 4: PRICING & SELLING FORMAT OPTIONS */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <DollarSign size={16} className="text-slate-700" />
                <h2 className="text-sm font-bold text-slate-900">Pricing & Selling Options</h2>
              </div>
              <span className="text-[10px] text-slate-400 font-semibold">Payment & Pricing Toggles</span>
            </div>

            {/* Payment Policy */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Payment Policy *</label>
              <SearchableDropdown 
                value={ebayPolicies.payment?.find(p => p.paymentPolicyId === formData.paymentPolicyId)?.name}
                onSelect={(opt) => setFormData(prev => ({ ...prev, paymentPolicyId: opt.id }))}
                options={ebayPolicies.payment?.map(p => ({ id: p.paymentPolicyId, label: p.name })) || []}
                placeholder="Select payment policy..."
              />
            </div>

            {/* Sold Listings Insights Card */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <TrendingUp size={14} className="text-emerald-600" /> Sold listings in the last 90 days
                </div>
                <p className="text-[11px] text-slate-500">Based on similar items sold on eBay recently</p>
              </div>
              <div className="flex items-center gap-4 text-right">
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">Recommended price</span>
                  <span className="text-xs font-extrabold text-slate-900">${formData.price || '35.99'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-semibold">Free shipping</span>
                  <span className="text-xs font-extrabold text-emerald-600">86%</span>
                </div>
              </div>
            </div>

            {/* Allow Offers (Best Offer) Toggle */}
            <div className="p-3.5 border border-slate-200 rounded-xl space-y-3 bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800">Allow offers (optional)</span>
                  <p className="text-[11px] text-slate-500">Interested buyers can send an offer for this item. You can accept, counter, or decline.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input 
                    type="checkbox"
                    checked={formData.allowOffers}
                    onChange={(e) => setFormData(prev => ({ ...prev, allowOffers: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-slate-900"></div>
                </label>
              </div>

              {formData.allowOffers && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Minimum offer amount (Auto-decline)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">$</span>
                      <input 
                        type="number"
                        step="0.01"
                        value={formData.minOfferPrice}
                        onChange={(e) => setFormData(prev => ({ ...prev, minOfferPrice: e.target.value }))}
                        placeholder="0.00"
                        className="w-full pl-7 pr-3 h-8 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-slate-800"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Auto-accept offers at or above</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">$</span>
                      <input 
                        type="number"
                        step="0.01"
                        value={formData.autoAcceptPrice}
                        onChange={(e) => setFormData(prev => ({ ...prev, autoAcceptPrice: e.target.value }))}
                        placeholder="0.00"
                        className="w-full pl-7 pr-3 h-8 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-slate-800"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Volume Pricing Toggle */}
            <div className="p-3.5 border border-slate-200 rounded-xl space-y-3 bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800">Add volume pricing</span>
                  <p className="text-[11px] text-slate-500">Offer a discount when buyers purchase more than one item at a time.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input 
                    type="checkbox"
                    checked={formData.volumePricingEnabled}
                    onChange={(e) => setFormData(prev => ({ ...prev, volumePricingEnabled: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-slate-900"></div>
                </label>
              </div>

              {formData.volumePricingEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Buy 2 items</label>
                    <div className="relative">
                      <input 
                        type="number"
                        min="1"
                        max="99"
                        value={formData.volumePricingTier2}
                        onChange={(e) => setFormData(prev => ({ ...prev, volumePricingTier2: e.target.value }))}
                        className="w-full px-3 pr-8 h-8 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-slate-800"
                      />
                      <span className="absolute right-3 top-1.5 text-xs text-slate-400 font-bold">% off</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Buy 3 items</label>
                    <div className="relative">
                      <input 
                        type="number"
                        min="1"
                        max="99"
                        value={formData.volumePricingTier3}
                        onChange={(e) => setFormData(prev => ({ ...prev, volumePricingTier3: e.target.value }))}
                        className="w-full px-3 pr-8 h-8 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-slate-800"
                      />
                      <span className="absolute right-3 top-1.5 text-xs text-slate-400 font-bold">% off</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Buy 4+ items</label>
                    <div className="relative">
                      <input 
                        type="number"
                        min="1"
                        max="99"
                        value={formData.volumePricingTier4}
                        onChange={(e) => setFormData(prev => ({ ...prev, volumePricingTier4: e.target.value }))}
                        className="w-full px-3 pr-8 h-8 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-slate-800"
                      />
                      <span className="absolute right-3 top-1.5 text-xs text-slate-400 font-bold">% off</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Schedule Listing Toggle */}
            <div className="p-3.5 border border-slate-200 rounded-xl space-y-3 bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800">Schedule your listing</span>
                  <p className="text-[11px] text-slate-500">Your listing goes live immediately, unless you select a time and date you want it to start.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input 
                    type="checkbox"
                    checked={formData.scheduleListing}
                    onChange={(e) => setFormData(prev => ({ ...prev, scheduleListing: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-slate-900"></div>
                </label>
              </div>

              {formData.scheduleListing && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Start Date</label>
                    <input 
                      type="date"
                      value={formData.scheduleDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, scheduleDate: e.target.value }))}
                      className="w-full px-3 h-8 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Start Time</label>
                    <input 
                      type="time"
                      value={formData.scheduleTime}
                      onChange={(e) => setFormData(prev => ({ ...prev, scheduleTime: e.target.value }))}
                      className="w-full px-3 h-8 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-slate-800"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="text-[10px] text-slate-400 italic">
              Use the sales tax table to manage the tax rate for jurisdictions where you may have an obligation to collect sales tax from buyers.
            </div>
          </div>

          {/* Section 5: SHIPPING & PACKAGE */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <Package size={16} className="text-slate-700" />
                <h2 className="text-sm font-bold text-slate-900">Shipping & Package</h2>
              </div>
            </div>

            {/* Shipping Policy */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Shipping / Fulfillment Policy *</label>
              <SearchableDropdown 
                value={ebayPolicies.fulfillment?.find(p => p.fulfillmentPolicyId === formData.fulfillmentPolicyId)?.name}
                onSelect={(opt) => setFormData(prev => ({ ...prev, fulfillmentPolicyId: opt.id }))}
                options={ebayPolicies.fulfillment?.map(p => ({ id: p.fulfillmentPolicyId, label: p.name })) || []}
                placeholder="Select shipping policy..."
              />
            </div>

            {/* Package Weight & Dimensions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Package weight (optional)</label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <input 
                      type="number"
                      min="0"
                      className="w-full px-3 pr-8 h-9 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-slate-800"
                      value={formData.packageWeight?.lbs || 0}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        packageWeight: { ...prev.packageWeight, lbs: parseInt(e.target.value) || 0 }
                      }))}
                    />
                    <span className="absolute right-3 top-2 text-[10px] text-slate-400 font-semibold">lbs.</span>
                  </div>
                  <div className="relative">
                    <input 
                      type="number"
                      min="0"
                      max="15"
                      className="w-full px-3 pr-8 h-9 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-slate-800"
                      value={formData.packageWeight?.oz || 0}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        packageWeight: { ...prev.packageWeight, oz: parseInt(e.target.value) || 0 }
                      }))}
                    />
                    <span className="absolute right-3 top-2 text-[10px] text-slate-400 font-semibold">oz.</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Package dimensions (optional)</label>
                <div className="grid grid-cols-3 gap-2">
                  <div className="relative">
                    <input 
                      type="number"
                      min="1"
                      placeholder="L"
                      className="w-full px-2 pr-6 h-9 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-slate-800"
                      value={formData.packageDimensions?.length || 10}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        packageDimensions: { ...prev.packageDimensions, length: parseInt(e.target.value) || 0 }
                      }))}
                    />
                    <span className="absolute right-2 top-2 text-[9px] text-slate-400">in.</span>
                  </div>
                  <div className="relative">
                    <input 
                      type="number"
                      min="1"
                      placeholder="W"
                      className="w-full px-2 pr-6 h-9 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-slate-800"
                      value={formData.packageDimensions?.width || 8}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        packageDimensions: { ...prev.packageDimensions, width: parseInt(e.target.value) || 0 }
                      }))}
                    />
                    <span className="absolute right-2 top-2 text-[9px] text-slate-400">in.</span>
                  </div>
                  <div className="relative">
                    <input 
                      type="number"
                      min="1"
                      placeholder="H"
                      className="w-full px-2 pr-6 h-9 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-slate-800"
                      value={formData.packageDimensions?.height || 2}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        packageDimensions: { ...prev.packageDimensions, height: parseInt(e.target.value) || 0 }
                      }))}
                    />
                    <span className="absolute right-2 top-2 text-[9px] text-slate-400">in.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Irregular Package Checkbox */}
            <div className="pt-2">
              <label className="flex items-start gap-2 cursor-pointer">
                <input 
                  type="checkbox"
                  checked={formData.irregularPackage}
                  onChange={(e) => setFormData(prev => ({ ...prev, irregularPackage: e.target.checked }))}
                  className="rounded border-slate-300 text-slate-900 focus:ring-0 mt-0.5"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-800">Irregular package</span>
                  <p className="text-[11px] text-slate-500">Carriers may charge extra for items not shipped in standard packages. Learn more</p>
                </div>
              </label>
            </div>

            {/* eBay International Shipping Banner */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
                <Globe size={14} className="text-blue-600" /> eBay International Shipping
              </div>
              <p className="text-[11px] text-slate-600">Send to our hub in the US and reach buyers worldwide with no extra cost or effort.</p>
            </div>

            {/* UK Site Checkbox */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox"
                  checked={formData.displayUkSite}
                  onChange={(e) => setFormData(prev => ({ ...prev, displayUkSite: e.target.checked }))}
                  className="rounded border-slate-300 text-slate-900 focus:ring-0"
                />
                <span className="text-xs font-semibold text-slate-800">
                  Display your listing on eBay UK site — <span className="text-slate-500 font-normal">fees apply</span>
                </span>
              </label>
            </div>
          </div>

          {/* Section 6: ITEM ORIGIN */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <Globe size={16} className="text-slate-700" />
              <h2 className="text-sm font-bold text-slate-900">Item Origin</h2>
            </div>

            <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-xl flex items-start gap-2.5 text-xs text-slate-700">
              <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
              <div>
                We prefilled the country of origin for you. To comply with customs policies, make sure the country is correct before listing.
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Country of Origin</label>
              <SearchableDropdown 
                value={formData.countryOfOrigin}
                options={COUNTRIES_LIST}
                onSelect={(opt) => setFormData(prev => ({ ...prev, countryOfOrigin: opt.label || opt.name }))}
                placeholder="Select country of origin..."
              />
              <span className="text-[10px] text-slate-400 block mt-1">This information may be needed for your listing to be visible to international buyers.</span>
            </div>
          </div>

          {/* Section 7: PREFERENCES & RETURN SETTINGS */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-slate-700" />
                <h2 className="text-sm font-bold text-slate-900">Preferences & Return Settings</h2>
              </div>
            </div>

            {/* Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Item Location ZIP</label>
                <input 
                  type="text"
                  value={formData.itemLocationZip}
                  onChange={(e) => setFormData(prev => ({ ...prev, itemLocationZip: e.target.value }))}
                  placeholder="23294"
                  className="w-full px-3 h-9 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-slate-800"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">City, State, Country</label>
                <input 
                  type="text"
                  value={formData.itemLocationCity}
                  onChange={(e) => setFormData(prev => ({ ...prev, itemLocationCity: e.target.value }))}
                  placeholder="Henrico, Virginia, United States"
                  className="w-full px-3 h-9 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-slate-800"
                />
              </div>
            </div>

            {/* Return Policy */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Return Policy *</label>
              <SearchableDropdown 
                value={ebayPolicies.returns?.find(p => p.returnPolicyId === formData.returnPolicyId)?.name}
                onSelect={(opt) => setFormData(prev => ({ ...prev, returnPolicyId: opt.id }))}
                options={ebayPolicies.returns?.map(p => ({ id: p.returnPolicyId, label: p.name })) || []}
                placeholder="Select return policy..."
              />
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-0.5">
              <div className="font-bold text-slate-800">Returns through eBay International Shipping</div>
              <div>Accepted within 30 days — eBay handles on your behalf.</div>
            </div>
          </div>

          {/* Section 8: ITEM DISCLOSURES */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Item Disclosures</h2>
                <p className="text-[11px] text-slate-500">Add product information to meet regulatory requirements in your buyer's region.</p>
              </div>
            </div>

            <div className="p-3.5 border border-slate-200 rounded-xl space-y-3 bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800">Product documents</span>
                  <p className="text-[11px] text-slate-500">Upload user guides, certificates, documents and accessibility information that are included with the item.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input 
                    type="checkbox"
                    checked={formData.productDocumentsEnabled}
                    onChange={(e) => setFormData(prev => ({ ...prev, productDocumentsEnabled: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-slate-900"></div>
                </label>
              </div>

              {formData.productDocumentsEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Document Type</label>
                    <SearchableDropdown 
                      value={formData.productDocType}
                      options={PRODUCT_DOC_TYPES}
                      onSelect={(opt) => setFormData(prev => ({ ...prev, productDocType: opt.label || opt.name }))}
                      placeholder="Select doc type..."
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Document File or URL</label>
                    <input 
                      type="text"
                      value={formData.productDocUrl}
                      onChange={(e) => setFormData(prev => ({ ...prev, productDocUrl: e.target.value }))}
                      placeholder="https://... or doc identifier"
                      className="w-full px-3 h-10 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-slate-800"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 9: PROMOTE YOUR LISTING / SPONSORED ADS */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Promote Your Listing</h2>
                <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">Competitive Category</span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">66% of items in this category are promoted</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* General Campaign */}
              <div className={`p-4 rounded-xl border transition-all ${formData.promotedGeneral ? 'border-slate-900 bg-slate-50/50' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-900">General</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={formData.promotedGeneral}
                      onChange={(e) => setFormData(prev => ({ ...prev, promotedGeneral: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-slate-900"></div>
                  </label>
                </div>
                <div className="flex items-center gap-1 text-emerald-600 font-bold text-xs mb-2">
                  <span>▲ 90%</span> <span className="text-slate-600 font-normal">more visibility, on average</span>
                </div>
                <ul className="text-[11px] text-slate-600 space-y-1 mb-3">
                  <li className="flex items-center gap-1.5"><Check size={12} className="text-slate-800" /> Basic access to ad placements</li>
                  <li className="flex items-center gap-1.5"><Check size={12} className="text-slate-800" /> Only pay when your item sells</li>
                </ul>
                {formData.promotedGeneral && (
                  <div className="pt-2 border-t border-slate-200">
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">Ad Rate (%)</label>
                    <div className="relative">
                      <input 
                        type="number"
                        step="0.1"
                        min="2"
                        max="100"
                        value={formData.promotedGeneralRate}
                        onChange={(e) => setFormData(prev => ({ ...prev, promotedGeneralRate: e.target.value }))}
                        className="w-full px-3 pr-8 h-8 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-slate-800"
                      />
                      <span className="absolute right-3 top-1.5 text-xs text-slate-400 font-bold">%</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Priority Campaign */}
              <div className={`p-4 rounded-xl border transition-all ${formData.promotedPriority ? 'border-slate-900 bg-slate-50/50' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-900">Priority</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={formData.promotedPriority}
                      onChange={(e) => setFormData(prev => ({ ...prev, promotedPriority: e.target.checked }))}
                      className="sr-only peer"
                    />
                    <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-slate-900"></div>
                  </label>
                </div>
                <div className="flex items-center gap-1 text-emerald-600 font-bold text-xs mb-2">
                  <span>▲ 170%</span> <span className="text-slate-600 font-normal">more visibility, on average</span>
                </div>
                <ul className="text-[11px] text-slate-600 space-y-1 mb-3">
                  <li className="flex items-center gap-1.5"><Check size={12} className="text-slate-800" /> Exclusive access to top of search</li>
                  <li className="flex items-center gap-1.5"><Check size={12} className="text-slate-800" /> Advanced targeting & bid controls</li>
                  <li className="flex items-center gap-1.5"><Check size={12} className="text-slate-800" /> Only pay for clicks on your ads</li>
                </ul>
                {formData.promotedPriority && (
                  <div className="pt-2 border-t border-slate-200">
                    <label className="block text-[10px] font-bold text-slate-700 mb-1">Target CPC Bid ($)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1.5 text-xs text-slate-400 font-bold">$</span>
                      <input 
                        type="number"
                        step="0.01"
                        value={formData.promotedPriorityBid}
                        onChange={(e) => setFormData(prev => ({ ...prev, promotedPriorityBid: e.target.value }))}
                        className="w-full pl-7 pr-3 h-8 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-slate-800"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 10: CHARITY */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <Heart size={16} className="text-rose-500" />
                <h2 className="text-sm font-bold text-slate-900">Charity</h2>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox"
                  checked={formData.charityEnabled}
                  onChange={(e) => setFormData(prev => ({ ...prev, charityEnabled: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-slate-900"></div>
              </label>
            </div>

            <p className="text-[11px] text-slate-500">
              Donate a portion to charity. You'll get a final value fee discount for sold items.
            </p>

            {formData.charityEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Donation Percentage</label>
                  <select
                    value={formData.charityPercentage}
                    onChange={(e) => setFormData(prev => ({ ...prev, charityPercentage: e.target.value }))}
                    className="w-full px-3 h-10 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-slate-800"
                  >
                    <option value="10">10% of sale</option>
                    <option value="15">15% of sale</option>
                    <option value="20">20% of sale</option>
                    <option value="25">25% of sale</option>
                    <option value="50">50% of sale</option>
                    <option value="100">100% of sale</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Charity Organization</label>
                  <SearchableDropdown 
                    value={formData.charityOrg}
                    options={CHARITY_ORGS}
                    onSelect={(opt) => setFormData(prev => ({ ...prev, charityOrg: opt.label || opt.name }))}
                    placeholder="Select charity..."
                  />
                </div>
              </div>
            )}
          </div>

          {/* List it for free note & Action Footer */}
          <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4">
            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold text-slate-900">List it for free.</h3>
              <p className="text-[11px] text-slate-500">A final value fee applies when your item sells.</p>
              <p className="text-[10px] text-slate-400 max-w-xl mx-auto leading-relaxed">
                By selecting List it, you agree to pay the fees, accept the eBay User Agreement, Payments Terms of Use and Marketing Program Terms; acknowledge reading the User Privacy Notice.
              </p>
            </div>

            <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => handleSaveListing(null)}
                disabled={loading}
              >
                Save for later
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => handleSaveListing('direct')}
                loading={loading}
                icon={<Zap size={14} />}
              >
                {editId ? 'Update eBay Listing' : 'List it'}
              </Button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default CreateEbayListing;
