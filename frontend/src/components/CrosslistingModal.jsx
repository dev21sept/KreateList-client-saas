/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps, no-unused-vars */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Sparkles, Loader2, ShieldCheck, ChevronDown, ShoppingBag, Search, Check, Tag, Info, Eye, Code, RefreshCw } from 'lucide-react';
import CategorySearchDropdown from './CategorySearchDropdown';
import { aiService, listingService, ruleService, externalImportService, ebayService, etsyService } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { EBAY_CONDITIONS } from '../constants/ebayConditions';
import { POSHMARK_CONDITIONS } from '../constants/poshmarkConditions';
import { DEPOP_CONDITIONS } from '../constants/depopConditions';
import { DEPOP_COLOURS } from '../constants/depopColours';
import { DEPOP_STYLES } from '../constants/depopStyles';
import { DEPOP_AGES } from '../constants/depopAges';
import { DEPOP_SOURCES } from '../constants/depopSources';
import { DEPOP_BRANDS } from '../constants/depopBrands';
import { DEPOP_MATERIALS } from '../constants/depopMaterials';
import { DEPOP_BODY_FITS } from '../constants/depopBodyFits';
import { DEPOP_COUNTRIES } from '../constants/depopCountries';
import { DEPOP_OCCASIONS } from '../constants/depopOccasions';
import { DEPOP_FASTENINGS } from '../constants/depopFastenings';
import { DEPOP_FITS } from '../constants/depopFits';
import { DEPOP_TYPES } from '../constants/depopTypes';
import { DEPOP_ATTRIBUTE_OPTIONS, DEPOP_CATEGORY_MAPPING } from '../constants/depopCategoryAttributes';
import {
  DEPOP_KIDS_APPAREL_SIZES,
  DEPOP_KIDS_SHOE_SIZES,
  DEPOP_WOMENS_TOPS_SIZES,
  DEPOP_WOMENS_DRESSES_SIZES,
  DEPOP_WOMENS_BOTTOMS_SIZES,
  DEPOP_WOMENS_OUTERWEAR_SIZES,
  DEPOP_WOMENS_SHOE_SIZES,
  DEPOP_MENS_TOPS_SIZES,
  DEPOP_MENS_BOTTOMS_SIZES,
  DEPOP_MENS_OUTERWEAR_SIZES,
  DEPOP_MENS_SHOE_SIZES
} from '../constants/depopSizes';

const POSHMARK_COLORS = [
  'Red', 'Pink', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple', 'Gold', 'Silver', 'Black', 'Gray', 'White', 'Cream', 'Brown', 'Tan'
];

const POSHMARK_STYLE_TAGS = [
  "70s", "80s", "90s", "Activewear", "Animal Print", "Athleisure", "Avant Garde", "Baggy", 
  "Balletcore", "Beach", "Beaded", "Bikercore", "Blokecore", "Bodycon", "Bohemian", "Bow", 
  "Bridal", "Bridesmaid", "Business Casual", "Cable Knit", "Cashmere", "Casual", "Chunky", 
  "Collegiate", "Colorblock", "Colorful", "Contemporary", "Coord Sets", "Coquette Girl", 
  "Corduroy", "Cottagecore", "Cozy", "Crochet", "Cropped", "Cruelty-Free", "Cut Out", 
  "Denim", "Distressed", "DIY", "Drop Waist", "Eclectic Grandpa", "Embroidered", "Fall", 
  "Faux Fur", "Feminine", "Festival", "Festive", "Flannel", "Flare", "Floral", "Formal", 
  "Fringe", "Gingham", "Girlhoodcore", "Gorpcore", "Goth", "Grunge", "Hand Knit", 
  "Handmade", "Herringbone", "Houndstooth", "Indie Sleeze", "Knit", "Lace", "Leather", 
  "Leopard Print", "Lightweight", "Linen", "Luxury", "Maximalism", "Mesh", "Metallic", 
  "Minimalist", "Monochrome", "Monogram", "Moto", "Neon", "Neutral", "Nylon", "Office", 
  "Oversized", "Paisley", "Party", "Pastel", "Patchwork", "Peplum", "Plaid", "Platform", 
  "Pleated", "Polka Dot", "Preppy", "Punk", "Quiet Luxury", "Quilted", "Relaxed Fit", 
  "Resortwear", "Retro", "Rosette", "Ruffle", "Satin", "Sequins", "Sheer", "Sherpa", 
  "Silk", "Sporty", "Strapless", "Streetwear", "Stripes", "Suede", "Tailored", 
  "Tennis Prep", "Travel", "Tropical", "Tweed", "Two-Tone", "Unisex", "Upcycled", 
  "Utility", "Vacation", "Vegan", "Velour", "Vintage", "Waterproof", "Wedding", 
  "Western", "Whimsigoth", "Winter", "Wool", "Woven", "Y2K"
];

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

  const filteredOptions = options.filter((opt) => {
    const label = String(opt?.label || '').toLowerCase();
    const desc = String(opt?.description || '').toLowerCase();
    const q = searchTerm.toLowerCase();
    return label.includes(q) || desc.includes(q);
  });

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full h-12 px-4 bg-white border ${
          error ? 'border-rose-500 focus:ring-rose-500/10' : 'border-slate-200 hover:border-indigo-300 focus:ring-indigo-500/10'
        } rounded-2xl text-left flex items-center justify-between text-xs font-bold text-slate-700 disabled:opacity-60 transition-all focus:ring-2`}
      >
        <span className="truncate">{typeof value === 'object' && value !== null ? (value.label || value.name || value.id || '') : (value || placeholder)}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {value && !disabled && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onSelect({ id: '', label: '' });
                setSearchTerm('');
              }}
              className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-655 transition-all cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {isOpen && !disabled && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[500] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-3 bg-slate-50 border-b border-slate-100">
            <div className="relative">
              <input
                autoFocus
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                className="w-full h-10 px-4 rounded-xl border border-slate-200 text-xs font-semibold outline-none focus:border-indigo-500"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filteredOptions.length > 0 ? filteredOptions.map((opt) => (
              <button
                key={opt.id || opt.label}
                type="button"
                onClick={() => {
                  onSelect(opt);
                  setIsOpen(false);
                  setSearchTerm('');
                }}
                className={`w-full text-left px-4 py-3 border-b border-slate-55 last:border-b-0 hover:bg-indigo-600 hover:text-white transition-colors ${value === opt.label ? 'bg-indigo-50' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold">{typeof opt === 'object' && opt !== null ? (opt.label || opt.name || opt.id || '') : String(opt || '')}</span>
                  {value === (opt?.label || opt) && <Check className="w-4 h-4 text-indigo-600" />}
                </div>
                {opt.description && (
                  <p className={`text-[9px] mt-0.5 line-clamp-1 ${value === opt.label ? 'text-indigo-200' : 'text-slate-400'}`}>{opt.description}</p>
                )}
              </button>
            )) : (
              <div className="p-4 text-xs text-slate-400 text-center">No results found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const ColorMultiSelectDropdown = ({ value, onChange, placeholder = 'Select colors (max 2)...' }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);
  const { toast } = useNotification();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = useMemo(() => {
    return value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
  }, [value]);

  const filteredOptions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return POSHMARK_COLORS;
    return POSHMARK_COLORS.filter(c => c.toLowerCase().includes(q));
  }, [searchTerm]);

  const handleSelect = (color) => {
    if (selected.includes(color)) {
      const updated = selected.filter(item => item !== color);
      onChange(updated.join(', '));
    } else {
      if (selected.length >= 2) {
        toast.warning("You can select a maximum of 2 colors.");
        return;
      }
      const updated = [...selected, color];
      onChange(updated.join(', '));
    }
  };

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full min-h-12 px-4 py-2 bg-white border border-slate-200 hover:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-500/10 focus-within:border-indigo-500 rounded-2xl text-left flex items-center justify-between text-xs font-bold text-slate-700 cursor-pointer transition-all"
      >
        <div className="flex flex-wrap gap-1.5 items-center flex-1 min-w-0 mr-2">
          {selected.length > 0 ? (
            selected.map((item) => (
              <span
                key={item}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-extrabold rounded-lg shadow-sm"
              >
                {item}
                <button
                  type="button"
                  onClick={() => handleSelect(item)}
                  className="p-0.5 hover:bg-indigo-100 rounded-md text-indigo-400 hover:text-indigo-755 transition-all cursor-pointer flex items-center justify-center"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))
          ) : (
            <span className="text-slate-400 font-semibold">{placeholder}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {selected.length > 0 && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
                setSearchTerm('');
              }}
              className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[500] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-3 bg-slate-50 border-b border-slate-100">
            <div className="relative">
              <input
                autoFocus
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search colors..."
                className="w-full h-10 px-4 rounded-xl border border-slate-200 text-xs font-semibold outline-none focus:border-indigo-500"
              />
            </div>
          </div>
          
          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((item) => {
                const isSelected = selected.includes(item);
                const isLimitReached = selected.length >= 2 && !isSelected;
                return (
                  <button
                    key={item}
                    type="button"
                    disabled={isLimitReached}
                    onClick={() => handleSelect(item)}
                    className={`w-full text-left px-4 py-3 border-b border-slate-50 last:border-b-0 transition-colors flex items-center justify-between ${
                      isSelected 
                        ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' 
                        : isLimitReached 
                          ? 'opacity-40 cursor-not-allowed bg-slate-50 text-slate-400' 
                          : 'hover:bg-indigo-600 hover:text-white text-slate-700'
                    }`}
                  >
                    <span className="text-xs font-bold">{item}</span>
                    {isSelected && <Check className="w-4 h-4 text-indigo-600" />}
                  </button>
                );
              })
            ) : (
              <div className="p-4 text-xs text-slate-400 text-center font-medium">No colors found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const MaterialMultiSelectDropdown = ({ value, onChange, placeholder = 'Select materials (max 3)...' }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);
  const { toast } = useNotification();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = useMemo(() => {
    return value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
  }, [value]);

  const filteredOptions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return VINTED_MATERIALS;
    return VINTED_MATERIALS.filter(m => m.toLowerCase().includes(q));
  }, [searchTerm]);

  const handleSelect = (material) => {
    if (selected.includes(material)) {
      const updated = selected.filter(item => item !== material);
      onChange(updated.join(', '));
    } else {
      if (selected.length >= 3) {
        toast.warning("You can select a maximum of 3 materials.");
        return;
      }
      const updated = [...selected, material];
      onChange(updated.join(', '));
    }
  };

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full min-h-12 px-4 py-2 bg-white border border-slate-200 hover:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-500/10 focus-within:border-indigo-500 rounded-2xl text-left flex items-center justify-between text-xs font-bold text-slate-700 cursor-pointer transition-all"
      >
        <div className="flex flex-wrap gap-1.5 items-center flex-1 min-w-0 mr-2">
          {selected.length > 0 ? (
            selected.map((item) => (
              <span
                key={item}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-extrabold rounded-lg shadow-sm"
              >
                {item}
                <button
                  type="button"
                  onClick={() => handleSelect(item)}
                  className="p-0.5 hover:bg-indigo-100 rounded-md text-indigo-400 hover:text-indigo-700 transition-all cursor-pointer flex items-center justify-center"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))
          ) : (
            <span className="text-slate-400 font-semibold">{placeholder}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {selected.length > 0 && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
                setSearchTerm('');
              }}
              className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-650 transition-all cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[500] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-3 bg-slate-50 border-b border-slate-100">
            <div className="relative">
              <input
                autoFocus
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search materials..."
                className="w-full h-10 px-4 rounded-xl border border-slate-200 text-xs font-semibold outline-none focus:border-indigo-500"
              />
            </div>
          </div>
          
          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((item) => {
                const isSelected = selected.includes(item);
                const isLimitReached = selected.length >= 3 && !isSelected;
                return (
                  <button
                    key={item}
                    type="button"
                    disabled={isLimitReached}
                    onClick={() => handleSelect(item)}
                    className={`w-full text-left px-4 py-3 border-b border-slate-50 last:border-b-0 transition-colors flex items-center justify-between ${
                      isSelected 
                        ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' 
                        : isLimitReached 
                          ? 'opacity-40 cursor-not-allowed bg-slate-50 text-slate-400' 
                          : 'hover:bg-indigo-600 hover:text-white text-slate-700'
                    }`}
                  >
                    <span className="text-xs font-bold">{item}</span>
                    {isSelected && <Check className="w-4 h-4 text-indigo-600" />}
                  </button>
                );
              })
            ) : (
              <div className="p-4 text-xs text-slate-400 text-center font-medium">No materials found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const getDepopBrandId = (brandName) => {
  if (!brandName) return 'unbranded';
  const clean = brandName.trim().toLowerCase();
  const found = DEPOP_BRANDS.find(b => b.label.toLowerCase() === clean || b.id.toLowerCase() === clean);
  return found ? found.id : 'unbranded';
};

const htmlToPlainText = (html = '') => {
  if (!html) return '';
  let text = html;
  
  // Replace line breaks and blocks with newlines
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<\/li>/gi, '\n');
  text = text.replace(/<\/tr>/gi, '\n');
  text = text.replace(/<\/h[1-6]>/gi, '\n\n');
  
  // Replace list items with bullets
  text = text.replace(/<li[^>]*>/gi, '• ');
  
  // Strip all other HTML tags
  text = text.replace(/<[^>]*>/g, '');
  
  // Decode common HTML entities
  text = text.replace(/&nbsp;/gi, ' ')
             .replace(/&amp;/gi, '&')
             .replace(/&quot;/gi, '"')
             .replace(/&lt;/gi, '<')
             .replace(/&gt;/gi, '>')
             .replace(/&#39;/gi, "'");
             
  // Normalize whitespace: reduce multiple consecutive spaces/newlines
  text = text.replace(/[ \t]+/g, ' '); // collapse spaces
  text = text.replace(/\n\s*\n\s*\n+/g, '\n\n'); // collapse 3+ newlines to 2
  
  return text.trim();
};

const CrosslistingModal = ({ isOpen, onClose, listing, platform, onSyncSuccess, isEditMode = false }) => {
  const { toast } = useNotification();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [prepLoading, setPrepLoading] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [activeImage, setActiveImage] = useState('');
  const [forceShowForm, setForceShowForm] = useState(false);
  
  const isAlreadyPublished = useMemo(() => {
    if (!listing) return false;
    if (platform === 'ebay' && (listing.ebayStatus === 'published' || listing.ebayListingId)) return true;
    if (platform === 'poshmark' && (listing.poshmarkStatus === 'published' || listing.poshmarkListingId)) return true;
    if (platform === 'depop' && (listing.depopStatus === 'published' || listing.depopListingId)) return true;
    if (platform === 'etsy' && (listing.etsyStatus === 'published' || listing.etsyListingId)) return true;
    return false;
  }, [listing, platform]);
  
  // Rules and Options lists
  const [rules, setRules] = useState([]);
  const [selectedRule, setSelectedRule] = useState('');
  const [selectedCondition, setSelectedCondition] = useState('');
  const [selectedConditionId, setSelectedConditionId] = useState('');
  const [selectedModel, setSelectedModel] = useState('gpt-4o-mini');
  const [descriptionMode, setDescriptionMode] = useState('preview');
  const [etsyUrlInput, setEtsyUrlInput] = useState('');

  // Dynamic lists from Vinted/Depop/eBay APIs


  const [activeAttributesState, setActiveAttributesState] = useState([]);
  const [kidsSizeScale, setKidsSizeScale] = useState('US');

  const [ebayPolicies, setEbayPolicies] = useState({ fulfillment: [], payment: [], returns: [], locations: [] });
  const [aspects, setAspects] = useState([]);
  const [etsyProperties, setEtsyProperties] = useState([]);
  const [errors, setErrors] = useState({});

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    originalPrice: '',
    brand: '',
    size: '',
    color: '',
    sku: '',
    category: '',
    material: '',
    quantity: '1',
    age: '',
    source: '',
    bodyFit: '',
    occasion: '',
    shippingPrice: '0.00',
    worldwideShipping: false,
    country: 'US',
    styleTag: '',
    categoryId: '',
    departmentId: '',
    subcategoryIds: [],
    conditionNote: '',
    isbn: '',
    author: '',
    bookTitle: '',
    videoGameRating: '',
    measurements: '',
    depopType: '',
    fastening: '',
    fit: '',
    packageWeight: { lbs: 0, oz: 0 },
    packageDimensions: { length: 0, width: 0, height: 0 },
    returnPolicyId: '',
    locationKey: '',
    fulfillmentPolicyId: '',
    paymentPolicyId: '',
    itemSpecifics: {},
    etsyAttributes: {},
    images: [],
    who_made: 'i_did',
    when_made: '2020_2026',
    is_supply: 'false',
    renewal: 'manual',
    shipping_profile_id: '',
  });

  const [shippingProfiles, setShippingProfiles] = useState([]);

  const getConditions = () => {
    switch (platform) {
      case 'ebay': return EBAY_CONDITIONS;
      case 'poshmark': return POSHMARK_CONDITIONS;
      case 'depop': return DEPOP_CONDITIONS;
      case 'etsy': return [
        { id: 'new', label: 'New' },
        { id: 'like_new', label: 'Like New' },
        { id: 'good', label: 'Good' },
        { id: 'fair', label: 'Fair' }
      ];
      default: return [];
    }
  };

  useEffect(() => {
    if (isOpen) {
      ruleService.getAll()
        .then(res => {
          if (res.data?.success) {
            setRules(res.data.data);
            const defaultRule = res.data.data.find(r => r.isDefault) || res.data.data[0];
            if (defaultRule) {
              setSelectedRule(defaultRule._id || defaultRule.id);
            }
          }
        })
        .catch(err => console.error('Error fetching rules:', err));
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && platform === 'etsy') {
      etsyService.getShippingProfiles()
        .then(res => {
          if (res.data?.success) {
            setShippingProfiles(res.data.data);
          }
        })
        .catch(err => console.error('Error fetching Etsy shipping profiles:', err));
    }
  }, [isOpen, platform]);

  useEffect(() => {
    if (isOpen && listing) {
      const targetId = listing._id || listing.id;

      const normalizedSpecs = (raw) => {
        if (!raw) return {};
        if (raw instanceof Map) return Object.fromEntries(raw);
        if (typeof raw === 'object') {
          const res = {};
          for (const [k, v] of Object.entries(raw)) {
            if (v !== undefined && v !== null) {
              res[k] = Array.isArray(v) ? v : [String(v)];
            }
          }
          return res;
        }
        return {};
      };

      // 1. Initial quick state from passed listing prop
      setFormData(prev => ({
        ...prev,
        title: listing.title || prev.title || '',
        description: (platform === 'etsy' || platform === 'poshmark' || platform === 'depop')
          ? htmlToPlainText(listing.description || prev.description || '')
          : (listing.description || prev.description || ''),
        price: listing.price || prev.price || '',
        originalPrice: listing.originalPrice || prev.originalPrice || '',
        brand: listing.brand || prev.brand || '',
        size: listing.size || prev.size || '',
        color: listing.color || prev.color || '',
        sku: listing.sku || prev.sku || '',
        category: listing.category || prev.category || '',
        categoryId: listing.categoryId || prev.categoryId || '',
        material: listing.material || prev.material || '',
        quantity: String(listing.quantity || prev.quantity || '1'),
        images: (listing.images && listing.images.length > 0) ? listing.images : (listing.thumbnail ? [listing.thumbnail] : prev.images || []),
        packageWeight: listing.packageWeight || prev.packageWeight || { lbs: 0, oz: 0 },
        packageDimensions: listing.packageDimensions || prev.packageDimensions || { length: 0, width: 0, height: 0 },
        itemSpecifics: normalizedSpecs(listing.itemSpecifics || listing.item_specifics),
        etsyAttributes: listing.etsyAttributes || prev.etsyAttributes || {},
        returnPolicyId: listing.returnPolicyId || prev.returnPolicyId || '',
        locationKey: listing.locationKey || prev.locationKey || '',
        fulfillmentPolicyId: listing.fulfillmentPolicyId || prev.fulfillmentPolicyId || '',
        paymentPolicyId: listing.paymentPolicyId || prev.paymentPolicyId || '',
        conditionNote: listing.conditionNote || prev.conditionNote || '',
        who_made: listing.etsyWhoMade || prev.who_made || 'i_did',
        when_made: listing.etsyWhenMade || prev.when_made || '2020_2026',
        is_supply: String(listing.etsyIsSupply !== undefined ? listing.etsyIsSupply : 'false'),
        renewal: listing.etsyRenewal || prev.renewal || 'manual',
        shipping_profile_id: listing.etsyShippingProfileId || prev.shipping_profile_id || '',
      }));

      if (listing.images && listing.images.length > 0) {
        setActiveImage(listing.images[0]);
      } else if (listing.thumbnail) {
        setActiveImage(listing.thumbnail);
      }

      // Pre-select condition matching list
      const condList = getConditions();
      if (condList.length > 0) {
        setSelectedCondition(listing.selectedCondition || condList[0].label);
        setSelectedConditionId(listing.conditionId || condList[0].id);
      }
      setHasScanned(isEditMode || !!(listing.title || listing.description || listing.price));
      setScanning(false);

      // 2. Fetch complete master listing from DB to guarantee 100% full data (Description, Images, ItemSpecifics, etc.)
      if (targetId && !String(targetId).startsWith('mock-')) {
        setPrepLoading(true);
        listingService.getOne(targetId)
          .then(res => {
            if (res.data?.success && res.data?.data) {
              const fullItem = res.data.data;
              const specsObj = normalizedSpecs(fullItem.itemSpecifics || fullItem.item_specifics);

              setFormData(prev => ({
                ...prev,
                title: fullItem.title || prev.title || '',
                description: (platform === 'etsy' || platform === 'poshmark' || platform === 'depop')
                  ? htmlToPlainText(fullItem.description || prev.description || '')
                  : (fullItem.description || prev.description || ''),
                price: fullItem.price || prev.price || '',
                originalPrice: fullItem.originalPrice || prev.originalPrice || '',
                brand: fullItem.brand || prev.brand || '',
                size: fullItem.size || prev.size || '',
                color: fullItem.color || prev.color || '',
                sku: fullItem.sku || prev.sku || '',
                category: fullItem.category || prev.category || '',
                categoryId: fullItem.categoryId || prev.categoryId || '',
                departmentId: fullItem.departmentId || prev.departmentId || '',
                conditionId: fullItem.conditionId || prev.conditionId || '',
                selectedCondition: fullItem.selectedCondition || prev.selectedCondition || '',
                material: fullItem.material || prev.material || '',
                quantity: String(fullItem.quantity || '1'),
                age: fullItem.age || prev.age || '',
                source: fullItem.source || prev.source || '',
                bodyFit: fullItem.bodyFit || prev.bodyFit || '',
                occasion: fullItem.occasion || prev.occasion || '',
                depopType: fullItem.depopType || prev.depopType || '',
                fastening: fullItem.fastening || prev.fastening || '',
                fit: fullItem.fit || prev.fit || '',
                packageWeight: fullItem.packageWeight || prev.packageWeight || { lbs: 0, oz: 0 },
                packageDimensions: fullItem.packageDimensions || prev.packageDimensions || { length: 0, width: 0, height: 0 },
                images: (fullItem.images && fullItem.images.length > 0) ? fullItem.images : (fullItem.thumbnail ? [fullItem.thumbnail] : prev.images || []),
                itemSpecifics: Object.keys(specsObj).length > 0 ? specsObj : prev.itemSpecifics,
                etsyAttributes: fullItem.etsyAttributes || prev.etsyAttributes || {},
                returnPolicyId: fullItem.returnPolicyId || prev.returnPolicyId || '',
                locationKey: fullItem.locationKey || prev.locationKey || '',
                fulfillmentPolicyId: fullItem.fulfillmentPolicyId || prev.fulfillmentPolicyId || '',
                paymentPolicyId: fullItem.paymentPolicyId || prev.paymentPolicyId || '',
                conditionNote: fullItem.conditionNote || prev.conditionNote || '',
                who_made: fullItem.etsyWhoMade || prev.who_made || 'i_did',
                when_made: fullItem.etsyWhenMade || prev.when_made || '2020_2026',
                is_supply: String(fullItem.etsyIsSupply !== undefined ? fullItem.etsyIsSupply : 'false'),
                renewal: fullItem.etsyRenewal || prev.renewal || 'manual',
                shipping_profile_id: fullItem.etsyShippingProfileId || prev.shipping_profile_id || '',
              }));

              if (fullItem.images && fullItem.images.length > 0) {
                setActiveImage(fullItem.images[0]);
              }
              if (fullItem.selectedCondition) {
                setSelectedCondition(fullItem.selectedCondition);
              }
              if (fullItem.conditionId) {
                setSelectedConditionId(fullItem.conditionId);
              }
              setHasScanned(true);
            }
          })
          .catch(err => console.error("Error loading full master listing data:", err))
          .finally(() => setPrepLoading(false));
      }
    }
  }, [isOpen, listing, platform, isEditMode]);

  const handleRefreshShippingProfiles = async () => {
    try {
      toast.info("Fetching shipping profiles from Etsy...");
      const response = await etsyService.getShippingProfiles();
      if (response.data?.success) {
        setShippingProfiles(response.data.data);
        toast.success("Shipping profiles updated!");
      } else {
        toast.error("Failed to fetch shipping profiles.");
      }
    } catch (err) {
      console.error("Failed to fetch Etsy shipping profiles:", err);
      toast.error("Error loading shipping profiles.");
    }
  };

  // eBay policy fetching
  useEffect(() => {
    console.log("eBay policy useEffect triggered:", { isOpen, platform });
    if (isOpen && platform === 'ebay') {
      console.log("Fetching eBay policies...");
      ebayService.getPolicies()
        .then(response => {
          console.log("eBay policies fetched successfully:", response.data.success);
          if (response.data?.success) {
            setEbayPolicies({
              fulfillment: (response.data.data.fulfillment || []).map(p => ({ id: p.fulfillmentPolicyId, label: p.name })),
              payment: (response.data.data.payment || []).map(p => ({ id: p.paymentPolicyId, label: p.name })),
              returns: (response.data.data.returns || []).map(p => ({ id: p.returnPolicyId, label: p.name })),
              locations: (response.data.data.locations || []).map(l => ({
                id: l.merchantLocationKey,
                label: l.name 
                  ? `${l.name}${l.location?.address?.city ? ` (${l.location.address.city})` : ''}` 
                  : l.merchantLocationKey
              }))
            });
          }
        })
        .catch(err => console.error("Error fetching eBay policies:", err));
    }
  }, [isOpen, platform]);

  // eBay Aspects fetching
  useEffect(() => {
    console.log("eBay Aspects useEffect triggered:", { isOpen, platform, categoryId: formData.categoryId });
    if (isOpen && platform === 'ebay' && formData.categoryId) {
      console.log("Fetching eBay aspects for category:", formData.categoryId);
      ebayService.getCategoryAspects(formData.categoryId)
        .then(res => {
          console.log("eBay aspects fetched successfully:", res.data.data?.length, "aspects");
          if (res.data.success) {
            setAspects(res.data.data || []);
          }
        })
        .catch(err => console.error("Error fetching eBay aspects:", err));
    }
  }, [isOpen, platform, formData.categoryId]);

  // Clear or re-resolve category ID on platform switch
  useEffect(() => {
    if (isOpen && formData.category) {
      setFormData(prev => ({ ...prev, categoryId: '' }));
    }
  }, [isOpen, platform]);

  // Auto-resolve Etsy category ID from text
  useEffect(() => {
    if (isOpen && platform === 'etsy' && formData.category && !formData.categoryId) {
      console.log("Auto-resolving Etsy category ID for path:", formData.category);
      etsyService.resolveCategory(formData.category)
        .then(res => {
          if (res.data?.success && res.data.data) {
            console.log("Auto-resolved category successfully:", res.data.data);
            setFormData(prev => ({
              ...prev,
              categoryId: res.data.data.id
            }));
          }
        })
        .catch(err => console.error("Error auto-resolving Etsy category:", err));
    }
  }, [isOpen, platform, formData.category, formData.categoryId]);

  // Etsy Properties fetching
  useEffect(() => {
    console.log("Etsy Properties useEffect triggered:", { isOpen, platform, categoryId: formData.categoryId });
    if (isOpen && platform === 'etsy' && formData.categoryId) {
      console.log("Fetching Etsy properties for category:", formData.categoryId);
      etsyService.getCategoryProperties(formData.categoryId)
        .then(res => {
          if (res.data?.success) {
            console.log("Etsy properties fetched successfully:", res.data.data?.length, "properties");
            setEtsyProperties(res.data.data || []);
          }
        })
        .catch(err => console.error("Error fetching Etsy properties:", err));
    }
  }, [isOpen, platform, formData.categoryId]);

  // Synchronize standard fields (color, size, material) into etsyAttributes map
  useEffect(() => {
    if (isOpen && platform === 'etsy' && etsyProperties.length > 0) {
      setFormData(prev => {
        let updated = false;
        const nextAttrs = { ...prev.etsyAttributes };

        // 1. Sync Color (Property 200)
        const colorProp = etsyProperties.find(p => p.property_id === 200 || p.name === 'Primary color');
        if (colorProp && prev.color) {
          const valOptions = [];
          if (colorProp.possible_values) {
            colorProp.possible_values.forEach(v => valOptions.push({ id: String(v.value_id), label: v.name }));
          }
          const matchedOpt = valOptions.find(o => o.label.toLowerCase() === prev.color.toLowerCase().trim());
          const targetVal = matchedOpt ? [matchedOpt.id] : [prev.color.trim()];
          if (JSON.stringify(nextAttrs[200]) !== JSON.stringify(targetVal)) {
            nextAttrs[200] = targetVal;
            updated = true;
          }
        }

        // 2. Sync Size (Property 100)
        const sizeProp = etsyProperties.find(p => p.property_id === 100 || p.name === 'TeeShirtSize' || p.display_name === 'Size');
        if (sizeProp && prev.size) {
          const valOptions = [];
          if (sizeProp.possible_values) {
            sizeProp.possible_values.forEach(v => valOptions.push({ id: String(v.value_id), label: v.name }));
          }
          const matchedOpt = valOptions.find(o => o.label.toLowerCase() === prev.size.toLowerCase().trim());
          const targetVal = matchedOpt ? [matchedOpt.id] : [prev.size.trim()];
          if (JSON.stringify(nextAttrs[100]) !== JSON.stringify(targetVal)) {
            nextAttrs[100] = targetVal;
            updated = true;
          }
        }

        // 3. Sync Material (Property 148789511893)
        const materialProp = etsyProperties.find(p => p.property_id === 148789511893 || p.display_name === 'Materials' || p.name === 'Material multi');
        if (materialProp && prev.material) {
          const valOptions = [];
          if (materialProp.possible_values) {
            materialProp.possible_values.forEach(v => valOptions.push({ id: String(v.value_id), label: v.name }));
          }
          const firstMat = prev.material.split(',')[0].trim();
          const matchedOpt = valOptions.find(o => o.label.toLowerCase() === firstMat.toLowerCase());
          const targetVal = matchedOpt ? [matchedOpt.id] : [firstMat];
          if (JSON.stringify(nextAttrs[148789511893]) !== JSON.stringify(targetVal)) {
            nextAttrs[148789511893] = targetVal;
            updated = true;
          }
        }

        if (updated) {
          return { ...prev, etsyAttributes: nextAttrs };
        }
        return prev;
      });
    }
  }, [isOpen, platform, etsyProperties, formData.color, formData.size, formData.material]);  // Depop Category detail visibilities
  useEffect(() => {
    if (isOpen && platform === 'depop' && formData.categoryId) {
      aiService.depopGetCategoryDetails({ id: formData.categoryId })
        .then(res => {
          if (res.data?.success && res.data?.data) {
            setActiveAttributesState(res.data.data.attribute_ids || []);
          }
        })
        .catch(err => console.error("Error loading Depop details:", err));
    }
  }, [isOpen, platform, formData.categoryId]);
  // Depop Sizes Resolution Dataset
  const activeSizeDataset = useMemo(() => {
    if (platform !== 'depop' || !formData.category) return null;
    
    if (formData.category.startsWith('Kids >')) {
      const isShoe = formData.category.includes('Footwear');
      return isShoe ? DEPOP_KIDS_SHOE_SIZES : DEPOP_KIDS_APPAREL_SIZES;
    }
    
    if (formData.category.startsWith('Women >')) {
      const isShoe = formData.category.includes('Footwear');
      if (isShoe) return DEPOP_WOMENS_SHOE_SIZES;
      const isBottom = formData.category.includes('Bottoms') || formData.category.includes('Jeans') || formData.category.includes('Skirts');
      if (isBottom) return DEPOP_WOMENS_BOTTOMS_SIZES;
      const isOuterwear = formData.category.includes('Outerwear') || formData.category.includes('Coats') || formData.category.includes('Jackets');
      if (isOuterwear) return DEPOP_WOMENS_OUTERWEAR_SIZES;
      const isDress = formData.category.includes('Dresses');
      if (isDress) return DEPOP_WOMENS_DRESSES_SIZES;
      return DEPOP_WOMENS_TOPS_SIZES;
    }

    if (formData.category.startsWith('Men >')) {
      const isShoe = formData.category.includes('Footwear');
      if (isShoe) return DEPOP_MENS_SHOE_SIZES;
      const isBottom = formData.category.includes('Bottoms') || formData.category.includes('Jeans') || formData.category.includes('Trousers') || formData.category.includes('Shorts');
      if (isBottom) return DEPOP_MENS_BOTTOMS_SIZES;
      const isOuterwear = formData.category.includes('Outerwear') || formData.category.includes('Coats') || formData.category.includes('Jackets');
      if (isOuterwear) return DEPOP_MENS_OUTERWEAR_SIZES;
      return DEPOP_MENS_TOPS_SIZES;
    }
    
    return null;
  }, [platform, formData.category]);

  const depopSizeOptions = useMemo(() => {
    if (!activeSizeDataset) return [];
    return (activeSizeDataset[kidsSizeScale] || []).map(s => ({
      id: s.composite_id,
      label: s.name
    }));
  }, [activeSizeDataset, kidsSizeScale]);

  const activeAttributes = useMemo(() => {
    if (platform !== 'depop') return [];
    if (activeAttributesState && activeAttributesState.length > 0) {
      return activeAttributesState;
    }
    const cat = String(formData.category || '').toLowerCase();
    const isBeauty = cat.includes('beauty') || cat.includes('skincare');
    const isFootwear = cat.includes('footwear');
    const isBottoms = cat.includes('bottoms') || cat.includes('jeans') || cat.includes('trousers');
    const isTops = cat.includes('tops') || cat.includes('hoodies') || cat.includes('shirts') || cat.includes('dresses');
    
    const attrs = [];
    if (!isBeauty) {
      attrs.push("material", "size-fit");
      if (isFootwear || isBottoms || isTops) attrs.push("occasion");
      if (isBottoms || isTops) attrs.push("body-fit");
      if (isFootwear) {
        attrs.push("shoe-type");
        attrs.push("fastening");
      } else if (isBottoms) {
        attrs.push("bottom-style");
        attrs.push("bottom-fit");
      }
    } else {
      attrs.push("beauty-type");
    }
    return attrs;
  }, [activeAttributesState, formData.category, platform]);

  const activeTypeAttribute = useMemo(() => {
    const typeAttrs = [
      "bottom-style", "dress-type", "coat-type", "jacket-type", 
      "jumpssuit-type", "dungarees-type", "trainers-type", 
      "shoe-type", "boot-type", "beauty-type"
    ];
    return activeAttributes.find(attr => typeAttrs.includes(attr)) || null;
  }, [activeAttributes]);

  const activeFitAttribute = useMemo(() => {
    const fitAttrs = ["bottom-fit", "dress-length", "heel-type"];
    return activeAttributes.find(attr => fitAttrs.includes(attr)) || null;
  }, [activeAttributes]);

  const typeFieldLabel = useMemo(() => {
    if (!activeTypeAttribute) return "Type";
    const labels = {
      "bottom-style": "Bottom Style",
      "dress-type": "Dress Type",
      "coat-type": "Coat Type",
      "jacket-type": "Jacket Type",
      "jumpssuit-type": "Jumpsuit Type",
      "dungarees-type": "Dungarees Type",
      "trainers-type": "Trainer Type",
      "shoe-type": "Shoe Type",
      "boot-type": "Boot Type",
      "beauty-type": "Beauty Type"
    };
    return labels[activeTypeAttribute] || "Type";
  }, [activeTypeAttribute]);

  const fitFieldLabel = useMemo(() => {
    if (!activeFitAttribute) return "Fit";
    const labels = {
      "bottom-fit": "Bottom Fit",
      "dress-length": "Dress Length",
      "heel-type": "Heel Type"
    };
    return labels[activeFitAttribute] || "Fit";
  }, [activeFitAttribute]);

  // Auto-resolve Depop / Vinted brand and size from raw text
  useEffect(() => {
    if (isOpen && platform === 'depop' && formData.brand) {
      const currentBrand = String(formData.brand).trim().toLowerCase();
      const matched = DEPOP_BRANDS.find(b => b.label.toLowerCase() === currentBrand);
      if (matched && formData.brand !== matched.label) {
        setFormData(prev => ({ ...prev, brand: matched.label }));
      }
    }
  }, [isOpen, platform, formData.brand]);

  useEffect(() => {
    if (isOpen && platform === 'depop' && depopSizeOptions.length > 0 && formData.size) {
      const currentSize = String(formData.size).trim().toLowerCase();
      const isComposite = currentSize.includes('-') && (currentSize.includes('us') || currentSize.includes('uk') || currentSize.includes('eur') || currentSize.includes('au'));
      if (!isComposite) {
        const matched = depopSizeOptions.find(opt => {
          const lbl = String(opt.label).trim().toLowerCase();
          return lbl === currentSize || 
                 lbl === (currentSize === 'm' ? 'medium' : currentSize === 's' ? 'small' : currentSize === 'l' ? 'large' : currentSize === 'xl' ? 'extra large' : currentSize);
        });
        if (matched) {
          setFormData(prev => ({ ...prev, size: matched.id }));
        }
      }
    }
  }, [isOpen, platform, depopSizeOptions, formData.size]);

  useEffect(() => {
    if (isOpen && platform === 'depop' && formData.color) {
      const currentColor = String(formData.color).trim().toLowerCase();
      const matched = DEPOP_COLOURS.find(c => c.label.toLowerCase() === currentColor || currentColor.includes(c.label.toLowerCase()));
      if (matched && formData.color !== matched.label) {
        setFormData(prev => ({ ...prev, color: matched.label }));
      }
    }
  }, [isOpen, platform, formData.color]);



  if (!isOpen || !listing) return null;

  const handleConditionChange = (e) => {
    const label = e.target.value;
    setSelectedCondition(label);
    const condList = getConditions();
    const found = condList.find(c => c.label === label);
    if (found) {
      setSelectedConditionId(found.id);
    }
  };

  const triggerAIScan = async () => {
    setScanning(true);
    toast.info(`✨ AI is scanning listing image for ${platform} using selected rule parameters...`);
    
    try {
      const selectedRuleObj = rules.find(r => (r._id || r.id) === selectedRule);
      const payload = {
        images: listing.images && listing.images.length > 0 ? listing.images : [listing.thumbnail],
        platform: platform,
        title_sequence: selectedRuleObj?.title_sequence || [],
        description_prompt: selectedRuleObj?.description_prompt || '',
        description_template: selectedRuleObj?.description_template || '',
        condition_note: selectedRuleObj?.condition_note || '',
        condition_name: selectedCondition,
        model: selectedModel || 'gpt-4o-mini',
      };

      let response;
      if (platform === 'ebay' || platform === 'etsy') {
        response = await aiService.analyze(payload);
      } else if (platform === 'poshmark') {
        response = await aiService.poshmarkAnalyze(payload);
      } else if (platform === 'depop') {
        response = await aiService.depopAnalyze(payload);
      }

      if (response && response.data?.success) {
        const result = response.data.data;

        const findClosestMatch = (val, list) => {
          if (!val) return '';
          const clean = String(val).toLowerCase().trim();
          const found = list.find(item => 
            item.label?.toLowerCase() === clean || 
            item.id?.toLowerCase() === clean ||
            clean.includes(item.label?.toLowerCase()) ||
            clean.includes(item.id?.toLowerCase())
          );
          return found ? found.label : '';
        };

        const resolvedBrand = platform === 'depop' ? (findClosestMatch(result.brand, DEPOP_BRANDS) || 'Other') : (result.brand || '');
        const resolvedColor = platform === 'depop' ? (findClosestMatch(result.color, DEPOP_COLOURS) || '') : (result.color || '');
        const resolvedStyle = platform === 'depop' ? (findClosestMatch(result.styleTag, DEPOP_STYLES) || '') : (result.styleTag || '');
        const resolvedAge = platform === 'depop' ? (findClosestMatch(result.age, DEPOP_AGES) || '') : '';
        const resolvedSource = platform === 'depop' ? (findClosestMatch(result.source, DEPOP_SOURCES) || '') : '';
        const resolvedMaterial = platform === 'depop' ? (findClosestMatch(result.material, DEPOP_MATERIALS) || '') : (result.material || '');
        const resolvedBodyFit = platform === 'depop' ? (findClosestMatch(result.bodyFit, DEPOP_BODY_FITS) || '') : '';
        const resolvedOccasion = platform === 'depop' ? (findClosestMatch(result.occasion, DEPOP_OCCASIONS) || '') : '';
        const resolvedFastening = platform === 'depop' ? (findClosestMatch(result.fastening, DEPOP_FASTENINGS) || '') : '';

        const allTypesList = [
          ...DEPOP_TYPES.footwear, 
          ...DEPOP_TYPES.bottoms, 
          ...DEPOP_TYPES.beauty,
          ...Object.values(DEPOP_ATTRIBUTE_OPTIONS).flat()
        ];
        const allFitsList = [
          ...DEPOP_FITS,
          ...Object.values(DEPOP_ATTRIBUTE_OPTIONS).flat()
        ];
        const resolvedFit = platform === 'depop' ? (findClosestMatch(result.fit, allFitsList) || result.fit || '') : '';
        const resolvedDepopType = platform === 'depop' ? (findClosestMatch(result.depopType, allTypesList) || result.depopType || '') : '';

        setFormData(prev => ({
          ...prev,
          title: result.title || prev.title,
          price: result.price || prev.price,
          description: (platform === 'etsy' || platform === 'poshmark' || platform === 'depop')
            ? htmlToPlainText(result.description || prev.description || '')
            : (result.description || prev.description),
          brand: resolvedBrand || prev.brand,
          size: result.size || prev.size,
          color: resolvedColor || prev.color,
          sku: result.sku || prev.sku,
          category: result.category_name || result.category || prev.category,
          categoryId: result.categoryId || result.category_id || prev.categoryId,
          material: resolvedMaterial || prev.material,
          originalPrice: result.originalPrice || prev.originalPrice,
          styleTag: resolvedStyle || prev.styleTag,
          age: resolvedAge || prev.age,
          source: resolvedSource || prev.source,
          bodyFit: resolvedBodyFit || prev.bodyFit,
          occasion: resolvedOccasion || prev.occasion,
          depopType: resolvedDepopType || prev.depopType,
          fastening: resolvedFastening || prev.fastening,
          fit: resolvedFit || prev.fit,
          isbn: result.isbn || prev.isbn,
          author: result.author || prev.author,
          bookTitle: result.bookTitle || prev.bookTitle,
          videoGameRating: result.videoGameRating || prev.videoGameRating,
          measurements: result.measurements || prev.measurements,
          itemSpecifics: result.aspects ? (() => {
            const initialAspects = {};
            result.aspects.forEach(aspect => {
              const name = aspect.localizedAspectName;
              if (result.item_specifics && result.item_specifics[name]) {
                initialAspects[name] = [result.item_specifics[name]];
              } else if (result.title_parts && result.title_parts[name]) {
                initialAspects[name] = [result.title_parts[name]];
              }
            });
            return initialAspects;
          })() : result.itemSpecifics || result.item_specifics || prev.itemSpecifics,
          packageWeight: result.packageWeight || selectedRuleObj?.packageWeight || prev.packageWeight,
          packageDimensions: result.packageDimensions || selectedRuleObj?.packageDimensions || prev.packageDimensions,
        }));

        if (platform === 'depop' && result.attribute_ids) {
          setActiveAttributesState(result.attribute_ids);
        }
        if (platform === 'ebay' && result.aspects) {
          setAspects(result.aspects);
        }

        setHasScanned(true);
      } else {
        toast.error('AI Scan returned unsuccessful response.');
      }
    } catch (err) {
      console.error('AI scan error:', err);
      const errMsg = err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to fetch data using AI.';
      toast.error(errMsg);
    } finally {
      setScanning(false);
    }
  };

  const triggerEtsyAIUrlFetch = async () => {
    if (!etsyUrlInput) {
      toast.warning("Please enter an Etsy listing URL.");
      return;
    }
    setScanning(true);
    toast.info(`✨ Fetching and parsing Etsy listing with AI for ${platform}...`);

    const detectGender = (text = '') => {
      const clean = text.toLowerCase();
      if (clean.includes('women') || clean.includes('female') || clean.includes('womens') || clean.includes('girl')) {
        return 'Women';
      }
      if (clean.includes('men') || clean.includes('male') || clean.includes('mens') || clean.includes('boy')) {
        return 'Men';
      }
      return 'Unisex';
    };

    try {
      const selectedRuleObj = rules.find(r => (r._id || r.id) === selectedRule);
      const response = await aiService.etsyFetch({
        url: etsyUrlInput,
        title_sequence: selectedRuleObj?.title_sequence || [],
        description_prompt: selectedRuleObj?.description_prompt || '',
        description_template: selectedRuleObj?.description_template || '',
        condition_name: selectedCondition,
        model: selectedModel || 'gpt-4o-mini',
        platform: platform,
        gender: detectGender(formData.title || listing.title)
      });

      if (response && response.data?.success) {
        const result = response.data.data;

        const findClosestMatch = (val, list) => {
          if (!val) return '';
          const clean = String(val).toLowerCase().trim();
          const found = list.find(item => 
            item.label?.toLowerCase() === clean || 
            item.id?.toLowerCase() === clean ||
            clean.includes(item.label?.toLowerCase()) ||
            clean.includes(item.id?.toLowerCase())
          );
          return found ? found.label : '';
        };

        const resolvedBrand = platform === 'depop' ? (findClosestMatch(result.brand, DEPOP_BRANDS) || 'Other') : (result.brand || '');
        const resolvedColor = platform === 'depop' ? (findClosestMatch(result.color, DEPOP_COLOURS) || '') : (result.color || '');
        const resolvedStyle = platform === 'depop' ? (findClosestMatch(result.styleTag, DEPOP_STYLES) || '') : (result.styleTag || '');
        const resolvedAge = platform === 'depop' ? (findClosestMatch(result.age, DEPOP_AGES) || '') : '';
        const resolvedSource = platform === 'depop' ? (findClosestMatch(result.source, DEPOP_SOURCES) || '') : '';
        const resolvedMaterial = platform === 'depop' ? (findClosestMatch(result.material, DEPOP_MATERIALS) || '') : (result.material || '');
        const resolvedBodyFit = platform === 'depop' ? (findClosestMatch(result.bodyFit, DEPOP_BODY_FITS) || '') : '';
        const resolvedOccasion = platform === 'depop' ? (findClosestMatch(result.occasion, DEPOP_OCCASIONS) || '') : '';
        const resolvedFastening = platform === 'depop' ? (findClosestMatch(result.fastening, DEPOP_FASTENINGS) || '') : '';

        const allTypesList = [
          ...DEPOP_TYPES.footwear, 
          ...DEPOP_TYPES.bottoms, 
          ...DEPOP_TYPES.beauty,
          ...Object.values(DEPOP_ATTRIBUTE_OPTIONS).flat()
        ];
        const allFitsList = [
          ...DEPOP_FITS,
          ...Object.values(DEPOP_ATTRIBUTE_OPTIONS).flat()
        ];
        const resolvedFit = platform === 'depop' ? (findClosestMatch(result.fit, allFitsList) || result.fit || '') : '';
        const resolvedDepopType = platform === 'depop' ? (findClosestMatch(result.depopType, allTypesList) || result.depopType || '') : '';

        setFormData(prev => ({
          ...prev,
          title: result.title || prev.title,
          price: result.price || prev.price,
          description: (platform === 'etsy' || platform === 'poshmark' || platform === 'depop')
            ? htmlToPlainText(result.description || prev.description || '')
            : (result.description || prev.description),
          brand: resolvedBrand || prev.brand,
          size: result.size || prev.size,
          color: result.color || resolvedColor || prev.color,
          sku: result.sku || prev.sku,
          category: result.category_name || result.category || prev.category,
          categoryId: result.categoryId || result.category_id || prev.categoryId,
          material: result.material || resolvedMaterial || prev.material,
          originalPrice: result.originalPrice || prev.originalPrice,
          styleTag: result.styleTag || resolvedStyle || prev.styleTag,
          age: resolvedAge || prev.age,
          source: resolvedSource || prev.source,
          bodyFit: resolvedBodyFit || prev.bodyFit,
          occasion: resolvedOccasion || prev.occasion,
          depopType: resolvedDepopType || prev.depopType,
          fastening: resolvedFastening || prev.fastening,
          fit: resolvedFit || prev.fit,
          images: result.images && result.images.length > 0 ? result.images : prev.images,
          departmentId: result.departmentId || prev.departmentId,
          subcategoryIds: result.subcategoryIds || prev.subcategoryIds,
          attribute_ids: result.attribute_ids || prev.attribute_ids,
          who_made: result.who_made || prev.who_made || 'i_did',
          when_made: result.when_made || prev.when_made || '2020_2026',
          is_supply: String(result.is_supply !== undefined ? result.is_supply : 'false'),
          renewal: result.renewal || prev.renewal || 'manual',
          quantity: String(result.quantity || prev.quantity || '1')
        }));

        if (result.images && result.images.length > 0) {
          setActiveImage(result.images[0]);
        }

        setHasScanned(true);
        toast.success("Etsy AI Fetch complete! Review and publish below.");
      } else {
        toast.error("Failed to fetch Etsy details.");
      }
    } catch (err) {
      console.error("Etsy AI URL Fetch error:", err);
      const errMsg = err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to fetch Etsy listing using AI.';
      toast.error(errMsg);
    } finally {
      setScanning(false);
    }
  };

  const handleInputChange = (field, val) => {
    setFormData(prev => ({
      ...prev,
      [field]: val
    }));
  };

  const handlePublish = async (e, publishMethod = 'api') => {
    if (e) e.preventDefault();

    // Aspects validation check:
    let isValid = true;
    const newErrors = {};

    if (platform === 'ebay') {
      aspects.forEach(aspect => {
        const name = aspect.localizedAspectName;
        const isRequired = aspect.aspectConstraint?.aspectRequired === true || aspect.aspectConstraint?.aspectUsage === 'REQUIRED';
        const valOptions = (aspect.aspectValues || aspect.values || []).map(v => {
          return typeof v === 'object' && v !== null ? (v.localizedValue || v.label || '') : String(v);
        });
        const currentVal = Array.isArray(formData.itemSpecifics?.[name]) 
          ? (formData.itemSpecifics[name]?.[0] || '') 
          : (formData.itemSpecifics?.[name] || '');

        if (isRequired) {
          if (!currentVal.trim()) {
            newErrors[name] = true;
            isValid = false;
          } else if (valOptions.length > 0 && !valOptions.some(opt => opt.toLowerCase() === currentVal.trim().toLowerCase())) {
            newErrors[name] = true;
            isValid = false;
          }
        }
      });
    }

    if (platform === 'etsy' && !formData.shipping_profile_id) {
      toast.error("Please select an Etsy Delivery Profile before listing.");
      return;
    }

    if (!isValid) {
      setErrors(newErrors);
      toast.error("Please fill all required aspects with valid values before proceeding.");
      return;
    }

    setLoading(true);
    try {
      const selectedRuleObj = rules.find(r => (r._id || r.id) === selectedRule);

      const updatedFields = {
        title: formData.title,
        description: formData.description,
        price: formData.price,
        originalPrice: formData.originalPrice,
        brand: formData.brand,
        size: formData.size,
        color: formData.color,
        sku: formData.sku,
        category: formData.category,
        categoryId: formData.categoryId,
        material: formData.material,
        quantity: parseInt(formData.quantity) || 1,
        age: formData.age,
        source: formData.source,
        bodyFit: formData.bodyFit,
        occasion: formData.occasion,
        shippingPrice: formData.shippingPrice,
        worldwideShipping: formData.worldwideShipping,
        country: formData.country,
        styleTag: formData.styleTag,
        departmentId: formData.departmentId,
        subcategoryIds: formData.subcategoryIds,
        conditionNote: formData.conditionNote,
        isbn: formData.isbn,
        author: formData.author,
        bookTitle: formData.bookTitle,
        videoGameRating: formData.videoGameRating,
        measurements: formData.measurements,
        depopType: formData.depopType,
        fastening: formData.fastening,
        fit: formData.fit,
        packageWeight: formData.packageWeight || selectedRuleObj?.packageWeight || { lbs: 0, oz: 0 },
        packageDimensions: formData.packageDimensions || selectedRuleObj?.packageDimensions || { length: 0, width: 0, height: 0 },
        returnPolicyId: formData.returnPolicyId,
        locationKey: formData.locationKey,
        fulfillmentPolicyId: formData.fulfillmentPolicyId,
        paymentPolicyId: formData.paymentPolicyId,
        itemSpecifics: formData.itemSpecifics,
        selectedRule,
        selectedCondition,
        conditionId: selectedConditionId,
        selectedModel,
        status: 'draft',
        platform,
        images: formData.images,
        etsyWhoMade: formData.who_made,
        etsyWhenMade: formData.when_made,
        etsyIsSupply: formData.is_supply === 'true' || formData.is_supply === true,
        etsyRenewal: formData.renewal,
        etsyShippingProfileId: formData.shipping_profile_id,
        etsyAttributes: formData.etsyAttributes,
      };

      let activeListingId = listing._id;

      // Save listing changes to DB first
      await listingService.update(listing._id, {
        ...updatedFields,
        [`${platform}Status`]: publishMethod === 'draft' ? 'draft' : 'none'
      });

      if (isEditMode) {
        if (platform === 'ebay' && (listing.ebayListingId || listing.status === 'published')) {
          try {
            toast.info("Syncing updates to live eBay listing...");
            await listingService.publish(activeListingId);
            toast.success("✨ Live eBay listing updated successfully!");
          } catch (ebayErr) {
            console.error("Failed to sync live update to eBay:", ebayErr);
            toast.warning("Saved locally. Could not sync live to eBay: " + (ebayErr.response?.data?.message || ebayErr.message));
          }
        } else {
          toast.success("Listing updated successfully!");
        }
        onSyncSuccess();
        onClose();
        return;
      }

      if (publishMethod === 'draft') {
        toast.success("Draft saved successfully!");
        onSyncSuccess();
        onClose();
        return;
      }

      // Publish flows:
      if (platform === 'ebay') {
        const publishRes = await listingService.publish(activeListingId);
        if (publishRes.data?.success) {
          toast.success('Listing published on eBay!');
        }
      } else if (platform === 'poshmark') {
        if (publishMethod === 'extension') {
          const isExtensionInstalled = document.body.dataset.elisterExtensionInstalled === "true";
          if (!isExtensionInstalled) {
            toast.warning("Please install and reload the Elister Chrome Extension to list automatically!");
            setLoading(false);
            return;
          }
          const plainDesc = formData.description;
          const token = localStorage.getItem('token');
          const backendUrl = import.meta.env.MODE === 'production'
            ? (import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : 'https://api.elister.ai/api')
            : 'http://localhost:5000/api';

          window.postMessage({
            action: 'ELISTER_LIST_ITEM_TRIGGER',
            data: {
              listingId: activeListingId,
              token,
              backendUrl,
              title: formData.title,
              description: plainDesc,
              brand: formData.brand || "",
              price: parseFloat(formData.price) || 0.0,
              originalPrice: parseFloat(formData.originalPrice) || 0.0,
              size: formData.size || "OS",
              colors: formData.color 
                ? formData.color.split(',').map(c => c.trim()).filter(Boolean).slice(0, 2) 
                : [],
              condition: selectedConditionId || "uln",
              styleTags: formData.styleTag ? formData.styleTag.split(',').map(t => t.trim()) : [],
              departmentId: formData.departmentId || "01008c10d97b4e1245005764",
              categoryId: formData.categoryId || "07008c10d97b4e1245005764",
              subcategoryIds: formData.subcategoryIds ? (Array.isArray(formData.subcategoryIds) ? formData.subcategoryIds : [formData.subcategoryIds]) : [],
              images: formData.images || []
            }
          }, "*");
          toast.success("Opening Poshmark and launching publisher queue...");
        } else {
          const publishRes = await externalImportService.publish(activeListingId, { platform: 'poshmark' });
          if (publishRes.data?.success) {
            toast.success('Listing successfully published to Poshmark via API!');
          }
        }
      } else if (platform === 'depop') {
        if (publishMethod === 'extension') {
          const isExtensionInstalled = document.body.dataset.elisterDepopExtensionInstalled === "true";
          if (!isExtensionInstalled) {
            toast.warning("Please install and reload the Elister Depop Chrome Extension to list automatically!");
            setLoading(false);
            return;
          }
          const plainDesc = formData.description;
          const token = localStorage.getItem('token');
          const backendUrl = import.meta.env.MODE === 'production'
            ? (import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : 'https://api.elister.ai/api')
            : 'http://localhost:5000/api';

          window.postMessage({
            action: 'ELISTER_DEPOP_LIST_ITEM_TRIGGER',
            data: {
              listingId: activeListingId,
              token,
              backendUrl,
              title: formData.title,
              description: plainDesc,
              brand: getDepopBrandId(formData.brand) || "",
              price: parseFloat(formData.price) || 0.0,
              originalPrice: parseFloat(formData.originalPrice) || 0.0,
              size: formData.size || "",
              color: formData.color || "",
              material: formData.material || "",
              conditionId: selectedConditionId || "3000",
              categoryId: formData.categoryId || "",
              category: formData.category || "",
              allowedAttributes: DEPOP_CATEGORY_MAPPING[formData.categoryId] || [],
              age: formData.age || "",
              source: formData.source || "",
              bodyFit: formData.bodyFit || "",
              occasion: formData.occasion || "",
              depopType: formData.depopType || "",
              fastening: formData.fastening || "",
              fit: formData.fit || "",
              country: formData.country || "US",
              shippingPrice: parseFloat(formData.shippingPrice) || 0.0,
              worldwideShipping: !!formData.worldwideShipping,
              quantity: parseInt(formData.quantity) || 1,
              images: formData.images || []
            }
          }, "*");
          toast.success("Opening Depop and launching publisher queue...");
        } else {
          const publishRes = await externalImportService.publish(activeListingId, { platform: 'depop' });
          if (publishRes.data?.success) {
            toast.success('Listing successfully published to Depop via API!');
          }
        }
      } else if (platform === 'etsy') {
        const publishRes = await etsyService.publish(activeListingId);
        if (publishRes.data?.success) {
          toast.success('Listing successfully published to Etsy!');
        }
      }

      onSyncSuccess();
      onClose();
    } catch (err) {
      console.error(`Error crosslisting to ${platform}:`, err);
      toast.error(err.response?.data?.message || `Failed to crosslist to ${platform}.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0f172a]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-[94vw] max-h-[94vh] overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200 border border-[#e2e8f0]">
        
        {/* Header */}
        <div className="px-8 py-5 border-b border-[#f1f5f9] flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-50 p-2.5 rounded-2xl text-indigo-600">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Crosslisting Suite</span>
              <h3 className="text-lg font-black text-slate-900 capitalize flex items-center gap-2">
                {isEditMode ? `Edit ${platform.toUpperCase()} Listing` : `Cross-list on ${platform}`}
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={() => {
                navigate(`/create-listing?edit=${listing._id || listing.id}`);
                onClose();
              }}
              title="Edit Master Listing"
              className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-extrabold rounded-2xl border border-indigo-100 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit Master
            </button>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-50 border border-slate-100 rounded-2xl text-slate-400 hover:text-slate-650 transition-all cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body Container */}
        <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-8">
          
          {isAlreadyPublished && !forceShowForm ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center my-auto min-h-[400px]">
              <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-emerald-100/50">
                <ShieldCheck size={40} className="stroke-[2.5]" />
              </div>
              <h3 className="text-xl font-black text-slate-900 capitalize">
                Already Listed on {platform}!
              </h3>
              <p className="text-slate-500 text-xs font-semibold mt-3 max-w-sm leading-relaxed">
                This product has been successfully published to {platform}. You can view the live listing or manage it directly.
              </p>
              {listing[`${platform}Url`] && (
                <a
                  href={listing[`${platform}Url`]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-2xl transition-all shadow-lg shadow-indigo-100 flex items-center gap-2"
                >
                  View Live Listing
                </a>
              )}
              <button
                onClick={() => setForceShowForm(true)}
                className="mt-4 px-6 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-750 font-black text-xs rounded-2xl border border-indigo-100 transition-all cursor-pointer flex items-center gap-2"
              >
                Update Listing Details
              </button>
              <button
                onClick={onClose}
                className="mt-2 text-slate-400 hover:text-slate-600 font-extrabold text-xs transition-all cursor-pointer"
              >
                Close Window
              </button>
            </div>
          ) : (
            <>
              {/* Setup Configuration */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start shrink-0">
            {/* Visual scan frame */}
            <div className="md:col-span-5 flex flex-col gap-4">
              <div className="relative aspect-[4/3] max-h-[280px] w-full mx-auto bg-slate-50 border border-[#e2e8f0] rounded-3xl overflow-hidden flex items-center justify-center shadow-inner select-none">
                {activeImage ? (
                  <img 
                    src={activeImage} 
                    alt="Listing Preview" 
                    className={`max-w-full max-h-full object-contain transition-all duration-700 ${scanning ? 'blur-[3px] brightness-75 scale-102' : ''}`}
                  />
                ) : (
                  <div className="text-slate-350 text-xs font-bold">No product image detected</div>
                )}

                {scanning && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-[#0f172af0]/40 gap-3">
                    <div className="relative w-full max-w-[180px]">
                      <div className="h-1 bg-indigo-500 rounded-full overflow-hidden">
                        <div className="h-full bg-white animate-infinite-loading w-1/3"></div>
                      </div>
                    </div>
                    <span className="text-[10px] font-black tracking-widest uppercase animate-pulse text-white">Scanning visual metrics...</span>
                    <div className="absolute inset-x-0 h-0.5 bg-indigo-400 shadow-[0_0_8px_#6366f1] animate-laser-scan"></div>
                  </div>
                )}

                {prepLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-[#0f172af0]/60 gap-3 z-30">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                    <span className="text-[10px] font-black tracking-widest uppercase text-white">Mapping categories...</span>
                  </div>
                )}
              </div>

              {/* Thumbnails & Reordering controls */}
              {formData.images && formData.images.length > 0 && (
                <div className="flex gap-2 overflow-x-auto py-1 scrollbar-thin">
                  {formData.images.map((img, idx) => (
                    <div 
                      key={idx} 
                      className={`relative w-16 h-16 border rounded-xl overflow-hidden cursor-pointer shrink-0 transition-all ${
                        activeImage === img ? 'border-indigo-600 ring-2 ring-indigo-500/20 scale-95' : 'border-slate-200 hover:border-slate-300'
                      }`}
                      onClick={() => setActiveImage(img)}
                    >
                      <img src={img} className="w-full h-full object-cover" alt="" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                        {idx > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const newImgs = [...formData.images];
                              const temp = newImgs[idx];
                              newImgs[idx] = newImgs[idx - 1];
                              newImgs[idx - 1] = temp;
                              setFormData(prev => ({ ...prev, images: newImgs }));
                            }}
                            title="Move Left"
                            className="p-1 bg-slate-900/80 hover:bg-indigo-655 rounded text-white text-[10px] font-extrabold cursor-pointer"
                          >
                            &lt;
                          </button>
                        )}
                        {idx < formData.images.length - 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const newImgs = [...formData.images];
                              const temp = newImgs[idx];
                              newImgs[idx] = newImgs[idx + 1];
                              newImgs[idx + 1] = temp;
                              setFormData(prev => ({ ...prev, images: newImgs }));
                            }}
                            title="Move Right"
                            className="p-1 bg-slate-900/80 hover:bg-indigo-655 rounded text-white text-[10px] font-extrabold cursor-pointer"
                          >
                            &gt;
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* AI Setup Config Panel */}
            <div className="md:col-span-7 bg-white border border-[#e2e8f0] rounded-3xl p-6 space-y-5 shadow-sm">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-[#f1f5f9] pb-3">
                <Sparkles size={14} className="text-indigo-600" />
                AI Vision Scanner Settings
              </h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Rule selection */}
                <div>
                  <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider block mb-1.5">AI Listing Rule</label>
                  <div className="relative">
                    <select
                      value={selectedRule}
                      onChange={(e) => setSelectedRule(e.target.value)}
                      className="w-full pl-3 pr-9 py-2.5 bg-slate-50 hover:bg-white border border-[#e2e8f0] rounded-xl text-xs font-bold text-slate-750 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 cursor-pointer appearance-none transition-all"
                    >
                      {rules.map(r => (
                        <option key={r._id || r.id} value={r._id || r.id}>{r.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* Condition selection */}
                <div>
                  <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider block mb-1.5">Product Condition</label>
                  <div className="relative">
                    <select
                      value={selectedCondition}
                      onChange={handleConditionChange}
                      className="w-full pl-3 pr-9 py-2.5 bg-slate-50 hover:bg-white border border-[#e2e8f0] rounded-xl text-xs font-bold text-slate-750 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 cursor-pointer appearance-none transition-all"
                    >
                      {getConditions().map(c => (
                        <option key={c.id} value={c.label}>{c.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* Model selection */}
                <div>
                  <label className="text-[9px] font-black text-slate-455 uppercase tracking-wider block mb-1.5">AI Vision Model</label>
                  <div className="relative">
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="w-full pl-3 pr-9 py-2.5 bg-slate-50 hover:bg-white border border-[#e2e8f0] rounded-xl text-xs font-bold text-slate-750 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 cursor-pointer appearance-none transition-all"
                    >
                      <option value="gpt-4o-mini">GPT-4o Mini (OpenAI)</option>
                      <option value="gpt-4o">GPT-4o (OpenAI)</option>
                      <option value="gpt-4-turbo">GPT-4 Turbo (OpenAI)</option>
                      <option value="gemini-1.5-flash">1.5 Flash (AI Studio)</option>
                      <option value="gemini-1.5-pro">1.5 Pro (AI Studio)</option>
                      <option value="gemini-2.0-flash">2.0 Flash (AI Studio)</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-455 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Submit AI Fetch Button */}
              <button
                type="button"
                disabled={scanning}
                onClick={triggerAIScan}
                className="w-full py-3 bg-[#0f172a] hover:bg-black text-white font-extrabold rounded-2xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-98 cursor-pointer disabled:opacity-50"
              >
                {scanning ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                    Scanning & Analyzing Image...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    ✨ Populate Form with AI
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Form Section */}
          {hasScanned && (
            <div className="animate-in fade-in slide-in-from-top-4 duration-300">
              <form onSubmit={(e) => handlePublish(e, 'api')} className="space-y-6">
                {platform === 'ebay' ? (
                  /* eBay 2-Column same-to-same Layout */
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start font-sans">
                    
                    {/* Left Column: Metadata & Description */}
                    <div className="lg:col-span-6 space-y-5 bg-white border border-[#e2e8f0] rounded-3xl p-6 shadow-sm">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-[#f1f5f9] pb-3">
                        <ShieldCheck size={16} className="text-emerald-500" />
                        3. Listing Metadata Fields
                      </h4>

                      <div className="space-y-4">
                        {/* Category */}
                        <div>
                          <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider block mb-1">Search/Assign Category</label>
                          <CategorySearchDropdown 
                            value={formData.category}
                            platform={platform}
                            onSelect={(opt) => {
                              setFormData(prev => ({
                                ...prev,
                                category: opt.fullName || opt.label,
                                categoryId: opt.id
                              }));
                            }}
                            placeholder="Search category..."
                          />
                        </div>

                        {/* Title */}
                        <div>
                          <label className="text-[9px] font-black text-slate-455 uppercase tracking-wider block mb-1">Product Title</label>
                          <input
                            type="text"
                            required
                            value={formData.title}
                            onChange={(e) => handleInputChange('title', e.target.value)}
                            placeholder="Title details..."
                            className="w-full px-4 h-12 bg-white border border-[#e2e8f0] focus:border-indigo-500 rounded-xl outline-none text-xs font-bold text-slate-700"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Price */}
                          <div>
                            <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider block mb-1">Price ($)</label>
                            <input
                              type="number"
                              step="0.01"
                              required
                              value={formData.price}
                              onChange={(e) => handleInputChange('price', e.target.value)}
                              placeholder="0.00"
                              className="w-full px-4 h-12 bg-white border border-[#e2e8f0] focus:border-indigo-500 rounded-xl outline-none text-xs font-bold text-slate-700"
                            />
                          </div>

                          {/* SKU */}
                          <div>
                            <label className="text-[9px] font-black text-slate-455 uppercase tracking-wider block mb-1">SKU</label>
                            <input
                              type="text"
                              value={formData.sku}
                              onChange={(e) => handleInputChange('sku', e.target.value)}
                              className="w-full px-4 h-12 bg-white border border-[#e2e8f0] focus:border-indigo-500 rounded-xl outline-none text-xs font-bold text-slate-700"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          {/* Quantity */}
                          <div>
                            <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider block mb-1">Quantity</label>
                            <input
                              type="number"
                              min="1"
                              value={formData.quantity}
                              onChange={(e) => handleInputChange('quantity', e.target.value)}
                              className="w-full px-4 h-12 bg-white border border-[#e2e8f0] focus:border-indigo-500 rounded-xl outline-none text-xs font-bold text-slate-700"
                            />
                          </div>

                          {/* Brand */}
                          <div>
                            <label className="text-[9px] font-black text-slate-455 uppercase tracking-wider block mb-1">Brand</label>
                            <input
                              type="text"
                              value={formData.brand}
                              onChange={(e) => handleInputChange('brand', e.target.value)}
                              className="w-full px-4 h-12 bg-white border border-[#e2e8f0] focus:border-indigo-500 rounded-xl outline-none text-xs font-bold text-slate-700"
                            />
                          </div>

                          {/* Size */}
                          <div>
                            <label className="text-[9px] font-black text-slate-455 uppercase tracking-wider block mb-1">Size</label>
                            <input
                              type="text"
                              value={formData.size}
                              onChange={(e) => handleInputChange('size', e.target.value)}
                              className="w-full px-4 h-12 bg-white border border-[#e2e8f0] focus:border-indigo-500 rounded-xl outline-none text-xs font-bold text-slate-700"
                            />
                          </div>

                          {/* Color */}
                          <div>
                            <label className="text-[9px] font-black text-slate-455 uppercase tracking-wider block mb-1">Color</label>
                            <input
                              type="text"
                              value={formData.color}
                              onChange={(e) => handleInputChange('color', e.target.value)}
                              className="w-full px-4 h-12 bg-white border border-[#e2e8f0] focus:border-indigo-500 rounded-xl outline-none text-xs font-bold text-slate-700"
                            />
                          </div>
                        </div>

                        {/* Condition Note & Synced Dropdown */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider block mb-1">Product Condition</label>
                            <div className="relative">
                              <select
                                value={selectedCondition}
                                onChange={handleConditionChange}
                                className="w-full pl-3 pr-9 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 cursor-pointer appearance-none h-12 transition-all font-sans"
                              >
                                {getConditions().map(c => (
                                  <option key={c.id} value={c.label}>{c.label}</option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                          </div>
                          <div>
                            <label className="text-[9px] font-black text-slate-455 uppercase tracking-wider block mb-1">Condition Description / Note</label>
                            <input
                              type="text"
                              value={formData.conditionNote}
                              onChange={(e) => handleInputChange('conditionNote', e.target.value)}
                              placeholder="Note down condition details..."
                              className="w-full px-4 h-12 bg-white border border-[#e2e8f0] focus:border-indigo-500 rounded-xl outline-none text-xs font-bold text-slate-700"
                            />
                          </div>
                        </div>

                        {/* Description Switcher & Area */}
                        <div className="space-y-1.5 pt-2">
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[9px] font-black text-slate-455 uppercase tracking-widest block">Product Description</label>
                            <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                              <button 
                                type="button"
                                onClick={() => setDescriptionMode('preview')}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[9px] font-black transition-all cursor-pointer ${descriptionMode === 'preview' ? 'bg-white text-indigo-650 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                              >
                                <Eye size={11} /> Preview
                              </button>
                              <button 
                                type="button"
                                onClick={() => setDescriptionMode('edit')}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[9px] font-black transition-all cursor-pointer ${descriptionMode === 'edit' ? 'bg-white text-indigo-650 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                              >
                                <Code size={11} /> HTML
                              </button>
                            </div>
                          </div>

                          {descriptionMode === 'edit' ? (
                            <textarea 
                              rows="8"
                              value={formData.description}
                              onChange={(e) => handleInputChange('description', e.target.value)}
                              placeholder="Enter raw HTML description..."
                              className="w-full p-4 bg-white border border-[#e2e8f0] focus:border-indigo-500 rounded-xl outline-none text-xs font-mono leading-relaxed min-h-[250px]"
                            />
                          ) : (
                            <div 
                              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold leading-relaxed min-h-[250px] overflow-y-auto max-h-[350px]"
                              dangerouslySetInnerHTML={{ __html: formData.description }}
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Aspects, Policies & Weight */}
                    <div className="lg:col-span-6 space-y-6">
                      
                      {/* Item Specifics */}
                      <div className="bg-white border border-[#e2e8f0] rounded-3xl p-6 shadow-sm space-y-4">
                        <h3 className="text-xs font-black text-indigo-900 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center justify-between">
                          <span>4. Item Specifics (Aspects)</span>
                          <span className="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg font-extrabold">Category: {formData.categoryId || '-'}</span>
                        </h3>

                        {aspects.length === 0 ? (
                          <p className="text-xs text-slate-400 font-semibold p-4 bg-slate-50 rounded-xl border border-dashed text-center">No aspects required for this category.</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-2 border border-slate-100 p-4 rounded-2xl bg-slate-50/30 font-sans">
                            {aspects.map((aspect) => {
                              const name = aspect.localizedAspectName;
                              const isRequired = aspect.aspectConstraint?.aspectRequired === true || aspect.aspectConstraint?.aspectUsage === 'REQUIRED';
                              const isRecommended = aspect.aspectConstraint?.aspectUsage === 'RECOMMENDED';
                              const valOptions = (aspect.aspectValues || aspect.values || []).map(v => {
                                const text = typeof v === 'object' && v !== null ? (v.localizedValue || v.label || '') : String(v);
                                return { id: text, label: text };
                              });
                              const currentVal = Array.isArray(formData.itemSpecifics[name]) 
                                ? (formData.itemSpecifics[name]?.[0] || '') 
                                : (formData.itemSpecifics[name] || '');
                              const hasError = !!errors[name];

                              return (
                                <div key={name}>
                                  <label className={`text-[9px] font-black uppercase tracking-wider block mb-1 ${hasError ? 'text-rose-500' : 'text-slate-455'}`}>
                                    {name} {isRequired && <span className="text-rose-500">*</span>}
                                    {isRecommended && <span className="text-[8px] text-slate-400 normal-case font-bold ml-1">(Rec)</span>}
                                  </label>
                                  {valOptions.length > 0 ? (
                                    <SearchableDropdown
                                      value={currentVal}
                                      onSelect={(opt) => {
                                        setFormData(prev => ({
                                          ...prev,
                                          itemSpecifics: {
                                            ...prev.itemSpecifics,
                                            [name]: [opt.label]
                                          }
                                        }));
                                        if (errors[name]) {
                                          setErrors(prev => {
                                            const copy = { ...prev };
                                            delete copy[name];
                                            return copy;
                                          });
                                        }
                                      }}
                                      options={valOptions}
                                      placeholder={`Select ${name}...`}
                                      error={hasError}
                                    />
                                  ) : (
                                    <input
                                      type="text"
                                      value={currentVal}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setFormData(prev => ({
                                          ...prev,
                                          itemSpecifics: {
                                            ...prev.itemSpecifics,
                                            [name]: [val]
                                          }
                                        }));
                                        if (errors[name]) {
                                          setErrors(prev => {
                                            const copy = { ...prev };
                                            delete copy[name];
                                            return copy;
                                          });
                                        }
                                      }}
                                      className={`w-full px-4 h-12 bg-white border ${
                                        hasError ? 'border-rose-500 focus:border-rose-500' : 'border-[#e2e8f0] focus:border-indigo-500'
                                      } rounded-xl outline-none text-xs font-bold text-slate-700`}
                                      placeholder={`Enter ${name}...`}
                                    />
                                  )}
                                  {hasError && (
                                    <span className="text-[9px] font-bold text-rose-500 mt-1 block">
                                      {valOptions.length > 0 && currentVal.trim()
                                        ? 'Please select a valid option from the dropdown'
                                        : 'This field is required'}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Policies */}
                      <div className="bg-white border border-[#e2e8f0] rounded-3xl p-6 shadow-sm space-y-4">
                        <h3 className="text-xs font-black text-indigo-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                          5. eBay Policies & Locations
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider block mb-1 font-sans">Shipping Policy</label>
                            <SearchableDropdown 
                              value={ebayPolicies.fulfillment.find(p => p.id === formData.fulfillmentPolicyId)?.label || formData.fulfillmentPolicyId}
                              onSelect={(opt) => handleInputChange('fulfillmentPolicyId', opt.id)}
                              options={ebayPolicies.fulfillment}
                              placeholder="Select Shipping Policy..."
                            />
                          </div>

                          <div>
                            <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider block mb-1 font-sans">Payment Policy</label>
                            <SearchableDropdown 
                              value={ebayPolicies.payment.find(p => p.id === formData.paymentPolicyId)?.label || formData.paymentPolicyId}
                              onSelect={(opt) => handleInputChange('paymentPolicyId', opt.id)}
                              options={ebayPolicies.payment}
                              placeholder="Select Payment Policy..."
                            />
                          </div>

                          <div>
                            <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider block mb-1 font-sans">Return Policy</label>
                            <SearchableDropdown 
                              value={ebayPolicies.returns.find(p => p.id === formData.returnPolicyId)?.label || formData.returnPolicyId}
                              onSelect={(opt) => handleInputChange('returnPolicyId', opt.id)}
                              options={ebayPolicies.returns}
                              placeholder="Select Return Policy..."
                            />
                          </div>

                          <div>
                            <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider block mb-1 font-sans">Merchant Location</label>
                            <SearchableDropdown 
                              value={ebayPolicies.locations.find(l => l.id === formData.locationKey)?.label || formData.locationKey}
                              onSelect={(opt) => handleInputChange('locationKey', opt.id)}
                              options={ebayPolicies.locations}
                              placeholder="Select Location Key..."
                            />
                          </div>
                        </div>
                      </div>

                      {/* Package details */}
                      <div className="bg-white border border-[#e2e8f0] rounded-3xl p-6 shadow-sm space-y-4">
                        <h3 className="text-xs font-black text-indigo-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                          6. Shipping Package Specs
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[9px] font-black text-slate-455 uppercase tracking-wider block mb-1">Package Weight</label>
                            <div className="flex gap-2">
                              <input
                                type="number"
                                placeholder="Lbs"
                                value={formData.packageWeight.lbs}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev,
                                  packageWeight: { ...prev.packageWeight, lbs: parseInt(e.target.value) || 0 }
                                }))}
                                className="w-1/2 px-4 h-12 bg-white border border-[#e2e8f0] focus:border-indigo-500 rounded-xl outline-none text-xs font-bold text-slate-700"
                              />
                              <input
                                type="number"
                                placeholder="Oz"
                                value={formData.packageWeight.oz}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev,
                                  packageWeight: { ...prev.packageWeight, oz: parseInt(e.target.value) || 0 }
                                }))}
                                className="w-1/2 px-4 h-12 bg-white border border-[#e2e8f0] focus:border-indigo-500 rounded-xl outline-none text-xs font-bold text-slate-700"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[9px] font-black text-slate-455 uppercase tracking-wider block mb-1">Package Dimensions</label>
                            <div className="flex gap-2">
                              <input
                                type="number"
                                placeholder="L"
                                value={formData.packageDimensions.length}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev,
                                  packageDimensions: { ...prev.packageDimensions, length: parseInt(e.target.value) || 0 }
                                }))}
                                className="w-1/3 px-2 h-12 bg-white border border-[#e2e8f0] focus:border-indigo-500 rounded-xl outline-none text-xs font-bold text-slate-700 text-center"
                              />
                              <input
                                type="number"
                                placeholder="W"
                                value={formData.packageDimensions.width}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev,
                                  packageDimensions: { ...prev.packageDimensions, width: parseInt(e.target.value) || 0 }
                                }))}
                                className="w-1/3 px-2 h-12 bg-white border border-[#e2e8f0] focus:border-indigo-500 rounded-xl outline-none text-xs font-bold text-slate-700 text-center"
                              />
                              <input
                                type="number"
                                placeholder="H"
                                value={formData.packageDimensions.height}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev,
                                  packageDimensions: { ...prev.packageDimensions, height: parseInt(e.target.value) || 0 }
                                }))}
                                className="w-1/3 px-2 h-12 bg-white border border-[#e2e8f0] focus:border-indigo-500 rounded-xl outline-none text-xs font-bold text-slate-700 text-center"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                ) : (
                  /* Standard Single-Column List for Poshmark / Depop / Vinted */
                  <div className="bg-white border border-[#e2e8f0] rounded-3xl p-6 shadow-sm space-y-5 font-sans">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-[#f1f5f9] pb-3">
                      <ShieldCheck size={16} className="text-emerald-500" />
                      Listing Metadata Fields
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Category Search Dropdown (Searchable across APIs) */}
                      <div className="sm:col-span-2">
                        <label className="text-[9px] font-black text-slate-455 uppercase tracking-wider block mb-1">Search/Assign Category</label>
                        <CategorySearchDropdown 
                          value={formData.category}
                          platform={platform}
                          onSelect={(opt) => {
                            setFormData(prev => ({
                              ...prev,
                              category: opt.fullName || opt.label,
                              categoryId: opt.id
                            }));
                          }}
                          placeholder={`Search ${platform} category...`}
                        />
                      </div>

                      {/* Title */}
                      <div className="sm:col-span-2">
                        <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider block mb-1">Product Title</label>
                        <input
                          type="text"
                          required
                          value={formData.title}
                          onChange={(e) => handleInputChange('title', e.target.value)}
                          placeholder="Title details..."
                          className="w-full px-4 h-12 bg-white border border-[#e2e8f0] focus:border-indigo-500 rounded-xl focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all text-xs font-bold text-slate-700"
                        />
                      </div>

                      {/* Price */}
                      <div>
                        <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider block mb-1">Price ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={formData.price}
                          onChange={(e) => handleInputChange('price', e.target.value)}
                          placeholder="0.00"
                          className="w-full px-4 h-12 bg-white border border-[#e2e8f0] focus:border-indigo-500 rounded-xl focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all text-xs font-bold text-slate-700"
                        />
                      </div>

                      {/* Original Price */}
                      {(platform === 'poshmark' || platform === 'depop') && (
                        <div>
                          <label className="text-[9px] font-black text-slate-455 uppercase tracking-wider block mb-1">Original Price ($)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={formData.originalPrice}
                            onChange={(e) => handleInputChange('originalPrice', e.target.value)}
                            placeholder="0.00"
                            className="w-full px-4 h-12 bg-white border border-[#e2e8f0] focus:border-indigo-500 rounded-xl focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all text-xs font-bold text-slate-700"
                          />
                        </div>
                      )}

                      {/* SKU */}
                      <div>
                        <label className="text-[9px] font-black text-slate-455 uppercase tracking-wider block mb-1">SKU</label>
                        <input
                          type="text"
                          value={formData.sku}
                          onChange={(e) => handleInputChange('sku', e.target.value)}
                          className="w-full px-4 h-12 bg-white border border-[#e2e8f0] focus:border-indigo-500 rounded-xl focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all text-xs font-bold text-slate-700"
                        />
                      </div>

                      {/* Quantity */}
                      <div>
                        <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider block mb-1">Quantity</label>
                        <input
                          type="number"
                          min="1"
                          value={formData.quantity}
                          onChange={(e) => handleInputChange('quantity', e.target.value)}
                          className="w-full px-4 h-12 bg-white border border-[#e2e8f0] focus:border-indigo-500 rounded-xl focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all text-xs font-bold text-slate-700"
                        />
                      </div>

                      {/* Brand */}
                      {platform !== 'etsy' && (
                        <div>
                          <label className="text-[9px] font-black text-slate-455 uppercase tracking-wider block mb-1">Brand</label>
                          {platform === 'depop' ? (
                            <SearchableDropdown 
                              value={formData.brand}
                              onSelect={(opt) => handleInputChange('brand', opt.label)}
                              options={DEPOP_BRANDS.map(b => ({ id: b.id, label: b.label }))}
                              placeholder="Select Depop brand..."
                            />
                          ) : (
                            <input
                              type="text"
                              value={formData.brand}
                              onChange={(e) => handleInputChange('brand', e.target.value)}
                              className="w-full px-4 h-12 bg-white border border-[#e2e8f0] focus:border-indigo-500 rounded-xl focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all text-xs font-bold text-slate-700"
                            />
                          )}
                        </div>
                      )}

                      {/* Size */}
                      {platform === 'etsy' ? (
                        <div>
                          <label className="text-[9px] font-black text-slate-455 uppercase tracking-wider block mb-1">Size</label>
                          {etsyProperties.find(p => p.property_id === 100 || p.name === 'TeeShirtSize' || p.display_name === 'Size') ? (
                            (() => {
                              const prop = etsyProperties.find(p => p.property_id === 100 || p.name === 'TeeShirtSize' || p.display_name === 'Size');
                              const valOptions = (prop.possible_values || []).map(v => ({ id: String(v.value_id), label: v.name }));
                              return (
                                <SearchableDropdown
                                  value={formData.size}
                                  onSelect={(opt) => handleInputChange('size', opt.label)}
                                  options={valOptions}
                                  placeholder="Select Size..."
                                />
                              );
                            })()
                          ) : (
                            <input
                              type="text"
                              value={formData.size}
                              onChange={(e) => handleInputChange('size', e.target.value)}
                              className="w-full px-4 h-12 bg-white border border-[#e2e8f0] focus:border-indigo-500 rounded-xl focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all text-xs font-bold text-slate-700"
                              placeholder="Size..."
                            />
                          )}
                        </div>
                      ) : platform !== 'depop' ? (
                        <div>
                          <label className="text-[9px] font-black text-slate-455 uppercase tracking-wider block mb-1">Size</label>
                          <input
                            type="text"
                            value={formData.size}
                            onChange={(e) => handleInputChange('size', e.target.value)}
                            className="w-full px-4 h-12 bg-white border border-[#e2e8f0] focus:border-indigo-500 rounded-xl focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all text-xs font-bold text-slate-700"
                          />
                        </div>
                      ) : (
                        activeSizeDataset && (
                          <div>
                            <label className="text-[9px] font-black text-slate-455 uppercase tracking-wider block mb-1">Depop Size</label>
                            <div className="flex gap-2">
                              {/* Scale select */}
                              <select
                                value={kidsSizeScale}
                                onChange={(e) => setKidsSizeScale(e.target.value)}
                                className="px-2 h-12 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
                              >
                                {['US', 'UK', 'EUR', 'AU'].map(sc => (
                                  <option key={sc} value={sc}>{sc}</option>
                                ))}
                              </select>
                              <div className="flex-1">
                                <SearchableDropdown 
                                  value={depopSizeOptions.find(o => o.id === formData.size)?.label || formData.size}
                                  onSelect={(opt) => handleInputChange('size', opt.id)}
                                  options={depopSizeOptions}
                                  placeholder="Select size..."
                                />
                              </div>
                            </div>
                          </div>
                        )
                      )}

                      {/* Color */}
                      {platform === 'etsy' ? (
                        <div>
                          <label className="text-[9px] font-black text-slate-455 uppercase tracking-wider block mb-1">Color</label>
                          {etsyProperties.find(p => p.property_id === 200 || p.name === 'Primary color') ? (
                            (() => {
                              const prop = etsyProperties.find(p => p.property_id === 200 || p.name === 'Primary color');
                              const valOptions = (prop.possible_values || []).map(v => ({ id: String(v.value_id), label: v.name }));
                              return (
                                <SearchableDropdown
                                  value={formData.color}
                                  onSelect={(opt) => handleInputChange('color', opt.label)}
                                  options={valOptions}
                                  placeholder="Select Color..."
                                />
                              );
                            })()
                          ) : (
                            <input
                              type="text"
                              value={formData.color}
                              onChange={(e) => handleInputChange('color', e.target.value)}
                              className="w-full px-4 h-12 bg-white border border-[#e2e8f0] focus:border-indigo-500 rounded-xl focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all text-xs font-bold text-slate-700"
                              placeholder="Color..."
                            />
                          )}
                        </div>
                      ) : platform === 'poshmark' ? (
                        <div>
                          <label className="text-[9px] font-black text-slate-455 uppercase tracking-wider block mb-1">Colors (Max 2)</label>
                          <ColorMultiSelectDropdown 
                            value={formData.color}
                            onChange={(val) => handleInputChange('color', val)}
                          />
                        </div>
                      ) : platform === 'depop' ? (
                        <div>
                          <label className="text-[9px] font-black text-slate-455 uppercase tracking-wider block mb-1">Depop Color</label>
                          <SearchableDropdown 
                            value={formData.color}
                            onSelect={(opt) => handleInputChange('color', opt.label)}
                            options={DEPOP_COLOURS.map(c => ({ id: c.id, label: c.label }))}
                            placeholder="Select Depop color..."
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="text-[9px] font-black text-slate-455 uppercase tracking-wider block mb-1">Color</label>
                          <input
                            type="text"
                            value={formData.color}
                            onChange={(e) => handleInputChange('color', e.target.value)}
                            className="w-full px-4 h-12 bg-white border border-[#e2e8f0] focus:border-indigo-500 rounded-xl focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all text-xs font-bold text-slate-700"
                          />
                        </div>
                      )}

                      {/* Material */}
                      {platform === 'depop' ? (
                        <div>
                          <label className="text-[9px] font-black text-slate-455 uppercase tracking-wider block mb-1">Material</label>
                          <SearchableDropdown 
                            value={formData.material}
                            onSelect={(opt) => handleInputChange('material', opt.label)}
                            options={DEPOP_MATERIALS.map(m => ({ id: m.id, label: m.label }))}
                            placeholder="Select Depop material..."
                          />
                        </div>
                      ) : platform === 'etsy' ? (
                        <div>
                          <label className="text-[9px] font-black text-slate-455 uppercase tracking-wider block mb-1">Materials</label>
                          {etsyProperties.find(p => p.property_id === 148789511893 || p.display_name === 'Materials' || p.name === 'Material multi') ? (
                            (() => {
                              const prop = etsyProperties.find(p => p.property_id === 148789511893 || p.display_name === 'Materials' || p.name === 'Material multi');
                              const valOptions = (prop.possible_values || []).map(v => ({ id: String(v.value_id), label: v.name }));
                              return (
                                <SearchableDropdown
                                  value={formData.material}
                                  onSelect={(opt) => handleInputChange('material', opt.label)}
                                  options={valOptions}
                                  placeholder="Select Material..."
                                />
                              );
                            })()
                          ) : (
                            <input
                              value={formData.material}
                              onChange={(e) => handleInputChange('material', e.target.value)}
                              className="w-full px-4 h-12 bg-white border border-[#e2e8f0] focus:border-indigo-500 rounded-xl focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all text-xs font-bold text-slate-700"
                              placeholder="e.g. Chenille, Cotton (up to 4)"
                            />
                          )}
                        </div>
                      ) : null}

                      {/* Style Tags (Poshmark, Depop & Etsy) */}
                      {(platform === 'poshmark' || platform === 'depop' || platform === 'etsy') && (
                        <div>
                          <label className="text-[9px] font-black text-slate-455 uppercase tracking-wider block mb-1">
                            {platform === 'etsy' ? 'Style Tags (Up to 13)' : 'Style Tags (Style Tag)'}
                          </label>
                          {platform === 'poshmark' ? (
                            <SearchableDropdown 
                              value={formData.styleTag}
                              onSelect={(opt) => handleInputChange('styleTag', opt.label)}
                              options={POSHMARK_STYLE_TAGS.map(t => ({ id: t, label: t }))}
                              placeholder="Select style tag..."
                            />
                          ) : platform === 'depop' ? (
                            <SearchableDropdown 
                              value={formData.styleTag}
                              onSelect={(opt) => handleInputChange('styleTag', opt.label)}
                              options={DEPOP_STYLES.map(s => ({ id: s.id, label: s.label }))}
                              placeholder="Select style tag..."
                            />
                          ) : (
                            <input
                              value={formData.styleTag}
                              onChange={(e) => handleInputChange('styleTag', e.target.value)}
                              className="w-full px-4 h-12 bg-white border border-[#e2e8f0] focus:border-indigo-500 rounded-xl focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all text-xs font-bold text-slate-700"
                              placeholder="e.g. vintage, cottagecore"
                            />
                          )}
                        </div>
                      )}

                      {/* Depop Specific Attributes */}
                      {platform === 'depop' && (
                        <>
                          {activeAttributes.includes("vintage") && (
                            <div>
                              <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider block mb-1">Age / Era</label>
                              <SearchableDropdown 
                                value={formData.age}
                                onSelect={(opt) => handleInputChange('age', opt.label)}
                                options={DEPOP_AGES.map(a => ({ id: a.id, label: a.label }))}
                                placeholder="Select era..."
                              />
                            </div>
                          )}
                          {activeAttributes.includes("source") && (
                            <div>
                              <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider block mb-1">Source</label>
                              <SearchableDropdown 
                                value={formData.source}
                                onSelect={(opt) => handleInputChange('source', opt.label)}
                                options={DEPOP_SOURCES.map(s => ({ id: s.id, label: s.label }))}
                                placeholder="Select source..."
                              />
                            </div>
                          )}
                          {activeAttributes.includes("body-fit") && (
                            <div>
                              <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider block mb-1">Body Fit</label>
                              <SearchableDropdown 
                                value={formData.bodyFit}
                                onSelect={(opt) => handleInputChange('bodyFit', opt.label)}
                                options={DEPOP_BODY_FITS.map(bf => ({ id: bf.id, label: bf.label }))}
                                placeholder="Select body fit..."
                              />
                            </div>
                          )}
                          {activeAttributes.includes("occasion") && (
                            <div>
                              <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider block mb-1">Occasion</label>
                              <SearchableDropdown 
                                value={formData.occasion}
                                onSelect={(opt) => handleInputChange('occasion', opt.label)}
                                options={DEPOP_OCCASIONS.map(o => ({ id: o.id, label: o.label }))}
                                placeholder="Select occasion..."
                              />
                            </div>
                          )}
                          {activeTypeAttribute && (
                            <div>
                              <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider block mb-1">{typeFieldLabel}</label>
                              <SearchableDropdown 
                                value={formData.depopType}
                                onSelect={(opt) => handleInputChange('depopType', opt.label)}
                                options={
                                  (DEPOP_ATTRIBUTE_OPTIONS[activeTypeAttribute] || []).map(optVal => typeof optVal === 'object' && optVal !== null ? optVal : { id: optVal, label: optVal })
                                }
                                placeholder={`Select ${typeFieldLabel.toLowerCase()}...`}
                              />
                            </div>
                          )}
                          {activeAttributes.includes("fastening") && (
                            <div>
                              <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider block mb-1">Fastening</label>
                              <SearchableDropdown 
                                value={formData.fastening}
                                onSelect={(opt) => handleInputChange('fastening', opt.label)}
                                options={DEPOP_FASTENINGS.map(f => ({ id: f.id, label: f.label }))}
                                placeholder="Select fastening..."
                              />
                            </div>
                          )}
                          {activeFitAttribute && (
                            <div>
                              <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider block mb-1">{fitFieldLabel}</label>
                              <SearchableDropdown 
                                value={formData.fit}
                                onSelect={(opt) => handleInputChange('fit', opt.label)}
                                options={
                                  (DEPOP_ATTRIBUTE_OPTIONS[activeFitAttribute] || []).map(optVal => typeof optVal === 'object' && optVal !== null ? optVal : { id: optVal, label: optVal })
                                }
                                placeholder={`Select ${fitFieldLabel.toLowerCase()}...`}
                              />
                            </div>
                          )}
                          <div>
                            <label className="text-[9px] font-black text-slate-455 uppercase tracking-wider block mb-1">Country</label>
                            <SearchableDropdown 
                              value={formData.country}
                              onSelect={(opt) => handleInputChange('country', opt.label)}
                              options={DEPOP_COUNTRIES.map(c => ({ id: c.id, label: c.label }))}
                              placeholder="Select country..."
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-black text-slate-455 uppercase tracking-wider block mb-1">Shipping Price ($)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={formData.shippingPrice}
                              onChange={(e) => handleInputChange('shippingPrice', e.target.value)}
                              className="w-full px-4 h-12 bg-white border border-[#e2e8f0] focus:border-indigo-500 rounded-xl focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all text-xs font-bold text-slate-700"
                            />
                          </div>
                          <div className="flex items-center gap-2 pt-6">
                            <input
                              type="checkbox"
                              id="worldwideShipping"
                              checked={formData.worldwideShipping}
                              onChange={(e) => handleInputChange('worldwideShipping', e.target.checked)}
                              className="w-4 h-4 text-indigo-600 border-[#e2e8f0] rounded focus:ring-indigo-500"
                            />
                            <label htmlFor="worldwideShipping" className="text-xs font-bold text-slate-700 cursor-pointer">Worldwide Shipping Available</label>
                          </div>
                        </>
                      )}

                      {/* Etsy Specific Fields */}
                      {platform === 'etsy' && (
                        <>
                          <div>
                            <label className="text-[9px] font-black text-slate-455 uppercase tracking-wider block mb-1">Who Made It?</label>
                            <select
                              value={formData.who_made || 'i_did'}
                              onChange={(e) => handleInputChange('who_made', e.target.value)}
                              className="w-full px-3 h-12 bg-white border border-[#e2e8f0] focus:border-indigo-500 rounded-xl focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all text-xs font-bold text-slate-700 cursor-pointer h-12"
                            >
                              <option value="i_did">I did (Handmade)</option>
                              <option value="collective">A member of my shop (Handmade)</option>
                              <option value="someone_else">Another company or person (Vintage)</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-[9px] font-black text-slate-455 uppercase tracking-wider block mb-1">What Is It?</label>
                            <select
                              value={formData.is_supply || 'false'}
                              onChange={(e) => handleInputChange('is_supply', e.target.value)}
                              className="w-full px-3 h-12 bg-white border border-[#e2e8f0] focus:border-indigo-500 rounded-xl focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all text-xs font-bold text-slate-700 cursor-pointer h-12"
                            >
                              <option value="false">A finished product</option>
                              <option value="true">A supply or tool to make things</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-[9px] font-black text-slate-455 uppercase tracking-wider block mb-1">When Was It Made?</label>
                            <select
                              value={formData.when_made || '2020_2026'}
                              onChange={(e) => handleInputChange('when_made', e.target.value)}
                              className="w-full px-3 h-12 bg-white border border-[#e2e8f0] focus:border-indigo-500 rounded-xl focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all text-xs font-bold text-slate-700 cursor-pointer h-12"
                            >
                              <option value="2020_2026">2020 - 2026</option>
                              <option value="2010_2019">2010 - 2019</option>
                              <option value="2007_2009">2007 - 2009</option>
                              <option value="2000_2006">2000 - 2006</option>
                              <option value="1990s">1990s (Vintage)</option>
                              <option value="1980s">1980s (Vintage)</option>
                              <option value="1970s">1970s (Vintage)</option>
                              <option value="1960s">1960s (Vintage)</option>
                              <option value="1950s">1950s (Vintage)</option>
                              <option value="before_1950">Before 1950 (Vintage)</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-[9px] font-black text-slate-455 uppercase tracking-wider block mb-1">Renewal Options</label>
                            <select
                              value={formData.renewal || 'manual'}
                              onChange={(e) => handleInputChange('renewal', e.target.value)}
                              className="w-full px-3 h-12 bg-white border border-[#e2e8f0] focus:border-indigo-500 rounded-xl focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all text-xs font-bold text-slate-700 cursor-pointer h-12"
                            >
                              <option value="automatic">Automatic</option>
                              <option value="manual">Manual</option>
                            </select>
                          </div>

                          <div className="col-span-1 sm:col-span-2">
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[9px] font-black text-slate-455 uppercase tracking-wider block">Etsy Delivery Profile</label>
                              <button 
                                type="button" 
                                onClick={handleRefreshShippingProfiles}
                                className="text-[9px] font-extrabold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <RefreshCw className="w-3 h-3 animate-spin-hover" /> Refresh Profiles
                              </button>
                            </div>
                            <select
                              value={formData.shipping_profile_id || ''}
                              onChange={(e) => handleInputChange('shipping_profile_id', e.target.value)}
                              className="w-full px-3 h-12 bg-white border border-[#e2e8f0] focus:border-indigo-500 rounded-xl focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all text-xs font-bold text-slate-700 cursor-pointer h-12"
                            >
                              <option value="">
                                {shippingProfiles.length === 0 
                                  ? "-- No Shipping Profiles Found (Refresh or Create on Etsy) --" 
                                  : "-- Select Shipping Profile --"}
                              </option>
                              {shippingProfiles.map(profile => (
                                <option key={profile.shipping_profile_id} value={profile.shipping_profile_id}>
                                  {profile.title} ({profile.processing_days_display_label || 'Calculated shipping'})
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Etsy Dynamic Category Properties */}
                          {etsyProperties.length > 0 && (
                            <div className="col-span-1 sm:col-span-2 border-t border-[#f1f5f9] pt-4 mt-2 space-y-4">
                              <h4 className="text-xs font-black text-indigo-900 uppercase tracking-wider flex items-center justify-between pb-2 border-b border-slate-100">
                                <span>5. Etsy Category Attributes</span>
                                <span className="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg font-extrabold">Taxonomy: {formData.categoryId || '-'}</span>
                              </h4>
                              
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-2 border border-[#f1f3f9] p-4 rounded-2xl bg-slate-50/20 font-sans">
                                {etsyProperties
                                  .filter(prop => {
                                    const isCustom = (prop.display_name || prop.name || '').toLowerCase().includes('custom property');
                                    return !isCustom;
                                  })
                                  .map((prop) => {
                                  const propertyId = prop.property_id;
                                  const name = prop.display_name || prop.name;
                                  const isRequired = prop.is_required === true;
                                  
                                  const valOptions = [];
                                  if (prop.possible_values && prop.possible_values.length > 0) {
                                    prop.possible_values.forEach(v => {
                                      valOptions.push({ id: String(v.value_id), label: v.name });
                                    });
                                  }
                                  if (prop.scales && prop.scales.length > 0) {
                                    prop.scales.forEach(scale => {
                                      if (scale.values && scale.values.length > 0) {
                                        scale.values.forEach(v => {
                                          valOptions.push({ id: String(v.value_id), label: v.name });
                                        });
                                      }
                                    });
                                  }

                                  const currentValArray = formData.etsyAttributes?.[propertyId] || [];
                                  const currentVal = currentValArray[0] || '';
                                  const currentOpt = valOptions.find(opt => opt.id === String(currentVal));
                                  const displayVal = currentOpt ? currentOpt.label : currentVal;

                                  const hasError = false;

                                  return (
                                    <div key={propertyId}>
                                      <label className="text-[9px] font-black uppercase tracking-wider block mb-1 text-slate-455">
                                        {name} {isRequired && <span className="text-rose-500">*</span>}
                                      </label>
                                      {valOptions.length > 0 ? (
                                        <SearchableDropdown
                                          value={displayVal}
                                          onSelect={(opt) => {
                                            setFormData(prev => ({
                                              ...prev,
                                              etsyAttributes: {
                                                ...prev.etsyAttributes,
                                                [propertyId]: [opt.id]
                                              }
                                            }));
                                          }}
                                          options={valOptions}
                                          placeholder={`Select ${name}...`}
                                          error={hasError}
                                        />
                                      ) : (
                                        <input
                                          type="text"
                                          value={currentVal}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            setFormData(prev => ({
                                              ...prev,
                                              etsyAttributes: {
                                                ...prev.etsyAttributes,
                                                [propertyId]: [val]
                                              }
                                            }));
                                          }}
                                          className="w-full px-4 h-12 bg-white border border-[#e2e8f0] focus:border-indigo-500 rounded-xl outline-none text-xs font-bold text-slate-700"
                                          placeholder={`Enter ${name}...`}
                                        />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {/* Product Condition & Condition Note (Synced) */}
                      {platform === 'etsy' ? (
                        <div className="grid grid-cols-1 gap-4 mb-4">
                          <div>
                            <label className="text-[9px] font-black text-slate-455 uppercase tracking-wider block mb-1">Product Condition</label>
                            <div className="relative">
                              <select
                                value={selectedCondition}
                                onChange={handleConditionChange}
                                className="w-full pl-3 pr-9 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 cursor-pointer appearance-none h-12 transition-all font-sans"
                              >
                                {getConditions().map(c => (
                                    <option key={c.id} value={c.label}>{c.label}</option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[9px] font-black text-slate-455 uppercase tracking-wider block mb-1">Product Condition</label>
                            <div className="relative">
                              <select
                                value={selectedCondition}
                                onChange={handleConditionChange}
                                className="w-full pl-3 pr-9 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 cursor-pointer appearance-none h-12 transition-all font-sans"
                              >
                                {getConditions().map(c => (
                                    <option key={c.id} value={c.label}>{c.label}</option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                          </div>
                          {platform !== 'poshmark' ? (
                            <div>
                              <label className="text-[9px] font-black text-slate-455 uppercase tracking-wider block mb-1">Condition Description / Note</label>
                              <input
                                type="text"
                                value={formData.conditionNote}
                                onChange={(e) => handleInputChange('conditionNote', e.target.value)}
                                placeholder="Note down condition details..."
                                className="w-full px-4 h-12 bg-white border border-[#e2e8f0] focus:border-indigo-500 rounded-xl focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all text-xs font-bold text-slate-700"
                              />
                            </div>
                          ) : (
                            <div className="flex items-center justify-center text-[10px] text-slate-400 font-bold italic pt-4">
                              Poshmark only supports Condition (NWT / Lightly Used).
                            </div>
                          )}
                        </div>
                      )}

                      {/* Description for non-ebay platforms */}
                      <div className="sm:col-span-2">
                        <label className="text-[9px] font-black text-slate-455 uppercase tracking-wider block mb-1">Product Description</label>
                        <textarea
                          rows="4"
                          value={formData.description}
                          onChange={(e) => handleInputChange('description', e.target.value)}
                          placeholder="Attributes generated will load here..."
                          className="w-full p-4 bg-white border border-[#e2e8f0] focus:border-indigo-500 rounded-xl focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all text-xs font-bold text-slate-700"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Bottom Actions */}
                {/* Bottom Actions */}
                <div className="flex items-center justify-end gap-3 shrink-0 flex-wrap">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-3 border border-[#e2e8f0] hover:bg-slate-50 rounded-2xl text-xs font-extrabold text-slate-600 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  
                  {!isAlreadyPublished && !isEditMode && (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={(e) => handlePublish(e, 'draft')}
                      className="px-6 py-3 border border-indigo-200 hover:bg-indigo-50/50 rounded-2xl text-xs font-extrabold text-indigo-750 transition-all cursor-pointer"
                    >
                      Save Draft
                    </button>
                  )}

                  {!isEditMode && (platform === 'poshmark' || platform === 'depop') ? (
                    <>
                      {!isAlreadyPublished && (
                        <button
                          type="button"
                          disabled={loading}
                          onClick={(e) => handlePublish(e, 'extension')}
                          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold rounded-2xl text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-98 cursor-pointer shadow-indigo-100 font-sans"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          List to {platform === 'poshmark' ? 'Poshmark' : 'Depop'} (Extension)
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={loading}
                        onClick={(e) => handlePublish(e, 'api')}
                        className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold rounded-2xl text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-98 cursor-pointer shadow-emerald-100 font-sans"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        {isAlreadyPublished ? `Update on ${platform === 'poshmark' ? 'Poshmark' : 'Depop'}` : `List to ${platform === 'poshmark' ? 'Poshmark' : 'Depop'} (Direct API)`}
                      </button>
                    </>
                  ) : (
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-7 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold rounded-2xl text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-98 cursor-pointer shadow-indigo-100"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          {isEditMode ? 'Saving Changes...' : (isAlreadyPublished ? `Updating on ${platform === 'ebay' ? 'eBay' : platform.charAt(0).toUpperCase() + platform.slice(1)}...` : `Publishing to ${platform === 'ebay' ? 'eBay' : platform.charAt(0).toUpperCase() + platform.slice(1)}...`)}
                        </>
                      ) : (
                        <>
                          <ShoppingBag className="w-3.5 h-3.5" />
                          {isEditMode ? 'Save Changes' : (isAlreadyPublished ? `Update on ${platform === 'ebay' ? 'eBay' : platform.charAt(0).toUpperCase() + platform.slice(1)}` : `Save & List on ${platform === 'ebay' ? 'eBay' : platform.charAt(0).toUpperCase() + platform.slice(1)}`)}
                        </>
                      )}
                    </button>
                  )}
                </div>

              </form>
            </div>
          )}
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes laser-scan {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }
        .animate-laser-scan {
          animation: laser-scan 2.5s linear infinite;
        }
        @keyframes infinite-loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
        .animate-infinite-loading {
          animation: infinite-loading 1.5s infinite linear;
        }
      `}</style>
    </div>
  );
};

export default CrosslistingModal;
