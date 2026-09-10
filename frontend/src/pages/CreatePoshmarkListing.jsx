import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
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
  Code,
  Trash2,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';
import { ruleService, aiService, listingService, externalImportService } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { POSHMARK_CONDITIONS } from '../constants/poshmarkConditions';
import { compressImage } from '../utils/imageCompressor';
import Button from '../components/ui/Button';
import IconButton from '../components/ui/IconButton';
import { Badge } from '../components/ui/Badge';
import { LoadingState } from '../components/ui/LoadingState';

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
  const wrapperRef = React.useRef(null);

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
        } rounded-2xl text-left flex items-center justify-between text-sm font-bold text-slate-700 disabled:opacity-60 transition-all focus:ring-2`}
      >
        <span className="truncate">{value || placeholder}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {value && !disabled && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onSelect({ id: '', label: '' });
                setSearchTerm('');
              }}
              className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
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
                className="w-full h-10 px-4 rounded-xl border border-slate-200 text-sm font-semibold outline-none focus:border-indigo-500"
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
                className={`w-full text-left px-4 py-3 border-b border-slate-50 last:border-b-0 hover:bg-indigo-600 hover:text-white transition-colors ${value === opt.label ? 'bg-indigo-50' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold">{opt.label}</span>
                  {value === opt.label && <Check className="w-4 h-4" />}
                </div>
                {opt.description && (
                  <p className={`text-[10px] mt-0.5 line-clamp-1 ${value === opt.label ? 'text-indigo-200' : 'text-slate-400'}`}>{opt.description}</p>
                )}
              </button>
            )) : (
              <div className="p-4 text-sm text-slate-400 text-center">No results found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const CategorySearchDropdown = ({ value, onSelect, placeholder = 'Search Poshmark category...' }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = React.useRef(null);

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
        const response = await aiService.poshmarkSuggestCategories(searchTerm);
        if (response.data) {
          setSuggestions(response.data);
        }
      } catch (err) {
        console.error("Error fetching category suggestions:", err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchTerm]);

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div className="relative">
        <Tag size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500 z-10" />
        <input 
          className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all shadow-sm h-12"
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
          className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 cursor-pointer" 
          onClick={() => {
            setIsOpen(!isOpen);
            if (!isOpen) {
              setSearchTerm(value || '');
            }
          }}
        />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[500] max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
          {loading && (
            <div className="p-4 text-xs font-semibold text-slate-400 text-center">Searching Poshmark Categories...</div>
          )}
          {!loading && suggestions.length === 0 && searchTerm.trim() && (
            <div className="p-4 text-xs font-semibold text-slate-400 text-center">No categories found</div>
          )}
          {!loading && suggestions.length === 0 && !searchTerm.trim() && (
            <div className="p-4 text-xs font-semibold text-slate-400 text-center">Type to search Poshmark categories...</div>
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
              className="w-full text-left px-4 py-3 border-b border-slate-50 last:border-b-0 hover:bg-indigo-600 hover:text-white transition-colors"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-slate-700 hover:text-inherit">{opt.fullName}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const ColorMultiSelectDropdown = ({ value, onChange, placeholder = 'Select colors (max 2)...' }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = React.useRef(null);
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
        toast.warning("You can select a maximum of 2 colors for Poshmark.");
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
        className="w-full min-h-12 px-4 py-2 bg-white border border-slate-200 hover:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-500/10 focus-within:border-indigo-500 rounded-2xl text-left flex items-center justify-between text-sm font-bold text-slate-700 cursor-pointer transition-all"
      >
        <div className="flex flex-wrap gap-1.5 items-center flex-1 min-w-0 mr-2">
          {selected.length > 0 ? (
            selected.map((item) => (
              <span
                key={item}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 text-[11px] font-extrabold rounded-lg shadow-sm"
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
              className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[500] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 font-sans">
          <div className="p-3 bg-slate-50 border-b border-slate-100">
            <div className="relative">
              <input
                autoFocus
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search colors..."
                className="w-full h-10 px-4 rounded-xl border border-slate-200 text-sm font-semibold outline-none focus:border-indigo-500"
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

          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-[10px] font-bold text-slate-400">
            <span>Limit: 1 - 2 colors</span>
            <span className={selected.length < 1 || selected.length > 2 ? 'text-rose-500 font-extrabold' : 'text-indigo-600 font-extrabold'}>
              {selected.length}/2 Selected
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

const CreatePoshmarkListing = ({ isModal = false, editId: propEditId = null, initialListing = null, onClose = null }) => {
  const navigate = useNavigate();
  const { toast } = useNotification();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const editId = propEditId || searchParams.get('edit');
  const platform = 'poshmark';
  const [hasScanned, setHasScanned] = useState((editId || initialListing) ? true : false);
  const [loading, setLoading] = useState(false);
  const [descriptionMode, setDescriptionMode] = useState('preview'); // 'edit' or 'preview'
  const [rules, setRules] = useState([]);
  const [files, setFiles] = useState([]);
  const [formData, setFormData] = useState({
    images: [],
    selectedRule: '',
    selectedCondition: '',
    conditionId: '',
    title: '',
    brand: '',
    originalPrice: '',
    color: '',
    styleTag: '',
    quantity: 1,
    size: '',
    category: '',
    categoryId: '',
    departmentId: '',
    subcategoryIds: [],
    price: '',
    description: '',
    conditionNote: '',
  });
  const [draggedImgIdx, setDraggedImgIdx] = useState(null);
  const [dragOverImgIdx, setDragOverImgIdx] = useState(null);
  const [isConvertingImages, setIsConvertingImages] = useState(false);
  const [loadedImages, setLoadedImages] = useState({});

  const allImagesLoaded = useMemo(() => {
    if (!formData.images || formData.images.length === 0) return true;
    return formData.images.every((_, idx) => loadedImages[idx] !== undefined);
  }, [formData.images, loadedImages]);

  useEffect(() => {
    setLoadedImages(prev => {
      const next = {};
      formData.images.forEach((_, idx) => {
        if (prev[idx] !== undefined) {
          next[idx] = prev[idx];
        }
      });
      return next;
    });
  }, [formData.images]);

  const modelOptions = useMemo(() => [
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini (OpenAI)', description: 'Fast, cost-efficient OpenAI model' },
    { id: 'gpt-4o', label: 'GPT-4o (OpenAI)', description: 'High-accuracy, multi-modal OpenAI model' },
    { id: 'gpt-4-turbo', label: 'GPT-4 Turbo (OpenAI)', description: 'Legacy high-performance OpenAI model' },
    { id: 'gemini-1.5-flash', label: '1.5 Flash (AI Studio)', description: 'Vibrant, fast Google AI Studio model' },
    { id: 'gemini-1.5-pro', label: '1.5 Pro (AI Studio)', description: 'Highly intelligent Google AI Studio model' },
    { id: 'gemini-2.0-flash', label: '2.0 Flash (AI Studio)', description: 'Latest ultra-fast Google AI Studio model' }
  ], []);

  useEffect(() => {
    const fetchRules = async () => {
      try {
        const response = await ruleService.getAll();
        if (response.data.success) {
          const rulesData = response.data.data;
          setRules(rulesData);
          const defaultRule = rulesData.find(r => r.isDefault) || rulesData[0];
          if (defaultRule && !editId) {
            setFormData(prev => ({
              ...prev,
              selectedRule: defaultRule._id || defaultRule.id
            }));
          }
        }
      } catch (error) {
        console.error("Error fetching rules:", error);
      }
    };
    fetchRules();
  }, [editId]);

  const mapPoshmarkCondition = (raw) => {
    if (!raw) return 'Good';
    const match = POSHMARK_CONDITIONS.find(
      c => c.id.toLowerCase() === String(raw).toLowerCase() || c.label.toLowerCase() === String(raw).toLowerCase()
    );
    if (match) return match.label;
    const str = String(raw).toLowerCase();
    if (str.includes('nwt') || str.includes('new with tag') || str.includes('brand new') || str === 'new' || str === '1000') {
      return 'NWT (New With Tags)';
    }
    if (str.includes('like new') || str.includes('excellent') || str.includes('mint') || str === '2750' || str === '3000') {
      return 'Like New';
    }
    if (str.includes('fair') || str.includes('poor') || str.includes('flaw') || str === '6000' || str === '7000') {
      return 'Fair';
    }
    return 'Good';
  };

  const cleanPoshmarkText = (text) => {
    if (!text) return '';
    if (!/<[a-z][\s\S]*>/i.test(text)) return text;
    let clean = text
      .replace(/<br\s*[\/]?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    return clean.replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
  };

  const resolvePoshmarkAttributes = (rawListing, pData) => {
    const allImgs = (rawListing.images && rawListing.images.length >= (pData.images?.length || 0))
      ? rawListing.images
      : (pData.images && pData.images.length > 0 ? pData.images : (rawListing.images || []));

    let resolvedColor = pData.color || rawListing.color || '';
    if (!resolvedColor && rawListing.itemSpecifics) {
      const cVal = rawListing.itemSpecifics.Color || rawListing.itemSpecifics.color || rawListing.itemSpecifics['Colour'];
      if (cVal) resolvedColor = Array.isArray(cVal) ? cVal.join(', ') : String(cVal);
    }
    if (resolvedColor) {
      const colorTokens = resolvedColor.split(/[\s,+/]+/).filter(Boolean);
      const matchedPoshColors = [];
      for (const token of colorTokens) {
        const found = POSHMARK_COLORS.find(c => c.toLowerCase() === token.toLowerCase());
        if (found && !matchedPoshColors.includes(found)) {
          matchedPoshColors.push(found);
        }
      }
      if (matchedPoshColors.length > 0) {
        resolvedColor = matchedPoshColors.slice(0, 2).join(', ');
      }
    }

    let resolvedCategory = pData.category || '';
    let resolvedCategoryId = pData.categoryId || '';
    let resolvedDepartmentId = pData.departmentId || '';
    let resolvedSubcategoryIds = pData.subcategoryIds || [];

    if (!resolvedCategory && rawListing.category && rawListing.category.includes(' > ')) {
      resolvedCategory = rawListing.category;
      resolvedCategoryId = rawListing.categoryId || '';
      resolvedDepartmentId = rawListing.departmentId || '';
    }

    if (!resolvedCategory) {
      const textToMatch = `${rawListing.title || ''} ${rawListing.category || ''}`;
      if (/pullover|hoodie|sweatshirt/i.test(textToMatch)) {
        resolvedCategory = /women/i.test(textToMatch) ? "Women > Sweaters > Crew & Scoop Necks" : "Men > Shirts > Sweatshirts & Hoodies";
      } else if (/t-shirt|tee|graphic tee/i.test(textToMatch)) {
        resolvedCategory = /women/i.test(textToMatch) ? "Women > Tops > Tees - Short Sleeve" : "Men > Shirts > Tees - Short Sleeve";
      } else if (/button down|button-down/i.test(textToMatch)) {
        resolvedCategory = /women/i.test(textToMatch) ? "Women > Tops > Button Down Shirts" : "Men > Shirts > Casual Button Down Shirts";
      } else if (/polo/i.test(textToMatch)) {
        resolvedCategory = /women/i.test(textToMatch) ? "Women > Tops > Polos" : "Men > Shirts > Polos";
      } else if (/jeans|denim/i.test(textToMatch)) {
        resolvedCategory = /women/i.test(textToMatch) ? "Women > Jeans > Bootcut" : "Men > Jeans > Bootcut";
      } else if (/jacket|coat|outerwear/i.test(textToMatch)) {
        resolvedCategory = /women/i.test(textToMatch) ? "Women > Jackets & Coats > Other" : "Men > Jackets & Coats > Other";
      } else if (/shoes|sneakers|boots/i.test(textToMatch)) {
        resolvedCategory = /women/i.test(textToMatch) ? "Women > Shoes > Sneakers" : "Men > Shoes > Sneakers";
      } else if (/sunglasses|glasses/i.test(textToMatch)) {
        resolvedCategory = /women/i.test(textToMatch) ? "Women > Accessories > Sunglasses" : "Men > Accessories > Sunglasses";
      }
    }

    let resolvedStyleTag = pData.styleTag || pData.styleTags || rawListing.styleTag || rawListing.styleTags || '';
    if (!resolvedStyleTag && rawListing.itemSpecifics) {
      const sVal = rawListing.itemSpecifics.Style || rawListing.itemSpecifics.Theme || rawListing.itemSpecifics.Occasion || rawListing.itemSpecifics.Features;
      if (sVal) {
        const tags = Array.isArray(sVal) ? sVal : [String(sVal)];
        const matchedTags = [];
        for (const t of tags) {
          const found = POSHMARK_STYLE_TAGS.find(st => st.toLowerCase() === t.toLowerCase());
          if (found && !matchedTags.includes(found)) matchedTags.push(found);
        }
        if (matchedTags.length > 0) resolvedStyleTag = matchedTags.slice(0, 3).join(', ');
      }
    }

    const resolvedBrand = pData.brand || rawListing.brand || rawListing.itemSpecifics?.Brand?.[0] || '';
    const resolvedSize = pData.size || rawListing.size || rawListing.itemSpecifics?.Size?.[0] || '';
    const resolvedOrigPrice = pData.originalPrice || rawListing.originalPrice || '';
    const cond = pData.selectedCondition || pData.condition || rawListing.selectedCondition || rawListing.condition || '';
    const mappedCond = mapPoshmarkCondition(cond);
    const desc = cleanPoshmarkText(pData.description || rawListing.description || '');

    return {
      images: (allImgs || []).filter(img => typeof img === 'string' && !img.startsWith('blob:')),
      selectedRule: pData.selectedRule || rawListing.selectedRule || '',
      selectedCondition: mappedCond,
      conditionId: pData.conditionId || rawListing.conditionId || (POSHMARK_CONDITIONS.find(c => c.label === mappedCond)?.id || 'good'),
      title: pData.title || rawListing.title || '',
      brand: resolvedBrand,
      originalPrice: resolvedOrigPrice,
      color: resolvedColor,
      styleTag: resolvedStyleTag,
      quantity: pData.quantity || rawListing.quantity || 1,
      size: resolvedSize,
      category: resolvedCategory,
      categoryId: resolvedCategoryId,
      departmentId: resolvedDepartmentId,
      subcategoryIds: resolvedSubcategoryIds,
      price: pData.price !== undefined && pData.price !== '' ? pData.price : (rawListing.price !== undefined ? rawListing.price : (rawListing.selling_price || '')),
      description: desc,
      conditionNote: pData.conditionNote || rawListing.conditionNote || '',
      selectedAspects: {},
      sku: pData.sku || rawListing.sku || '',
      selectedModel: pData.selectedModel || rawListing.selectedModel || 'gpt-4o-mini',
    };
  };

  useEffect(() => {
    if (initialListing) {
      const pData = initialListing.platformData?.poshmark || (initialListing.platform === 'poshmark' ? initialListing : {});
      const resolved = resolvePoshmarkAttributes(initialListing, pData);
      setFormData(prev => ({
        ...prev,
        ...resolved,
        title: resolved.title || prev.title,
        brand: resolved.brand || prev.brand,
        color: resolved.color || prev.color,
        styleTag: resolved.styleTag || prev.styleTag,
        size: resolved.size || prev.size,
        category: resolved.category || prev.category,
        sku: resolved.sku || prev.sku
      }));
      setHasScanned(true);
    }
  }, [initialListing]);

  useEffect(() => {
    if (editId) {
      const fetchListing = async () => {
        try {
          setLoading(true);
          const response = await listingService.getOne(editId);
          if (response.data.success) {
            const rawListing = response.data.data;
            const pData = rawListing.platformData?.poshmark || (rawListing.platform === 'poshmark' ? rawListing : {});
            const resolved = resolvePoshmarkAttributes(rawListing, pData);
            setFormData(prev => ({
              ...prev,
              ...resolved,
              title: resolved.title || prev.title || '',
              brand: resolved.brand || prev.brand || '',
              color: resolved.color || prev.color || '',
              styleTag: resolved.styleTag || prev.styleTag || '',
              size: resolved.size || prev.size || '',
              category: resolved.category || prev.category || '',
              sku: resolved.sku || prev.sku || ''
            }));
            setHasScanned(true);
          }
        } catch (error) {
          console.error("Error fetching listing for edit:", error);
          toast.error("Failed to load listing for editing.");
        } finally {
          setLoading(false);
        }
      };
      fetchListing();
    }
  }, [editId]);

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleImageUpload = async (e) => {
    const uploadedFiles = Array.from(e.target.files);
    setFiles([...files, ...uploadedFiles]);
    setIsConvertingImages(true);
    try {
      // Compress each image using the utility
      const base64Images = await Promise.all(
        uploadedFiles.map(file => compressImage(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.8 }))
      );
      setFormData(prev => ({ ...prev, images: [...prev.images, ...base64Images] }));
    } catch (err) {
      console.error("Error compressing and converting images:", err);
      toast.error("Failed to process some images.");
    } finally {
      setIsConvertingImages(false);
    }
  };

  const startAIFetch = async () => {
    if (formData.images.length === 0) {
      toast.warning("Please upload at least one product image.");
      return;
    }
    if (!formData.selectedRule) {
      toast.warning("Please select an AI Listing Rule.");
      return;
    }
    if (!formData.selectedCondition) {
      toast.warning("Please select a Product Condition.");
      return;
    }

    setLoading(true);
    
    // Check for duplicates first before transitioning step or querying OpenAI
    try {
      const dupRes = await listingService.checkDuplicate({
        image: formData.images[0],
        platform: 'poshmark'
      });
      if (dupRes.data?.success && dupRes.data?.isDuplicate) {
        toast.warning(`Product already exists: "${dupRes.data.title || 'Untitled'}". Redirecting...`);
        setTimeout(() => {
          navigate(`/listings?highlight=${dupRes.data.listingId}`);
        }, 1500);
        setLoading(false);
        return;
      }
    } catch (dupErr) {
      console.warn("Duplicate check failed, proceeding to scan:", dupErr);
    }

    setHasScanned(true);
    
    const selectedRuleObj = rules.find(r => (r._id || r.id) === formData.selectedRule);
    
    try {
      const response = await aiService.poshmarkAnalyze({
        images: formData.images, 
        title_sequence: selectedRuleObj?.title_sequence || [],
        description_prompt: selectedRuleObj?.description_prompt || '',
        description_template: selectedRuleObj?.description_template || '',
        condition_note: selectedRuleObj?.condition_note || '',
        condition_name: formData.selectedCondition,
        model: formData.selectedModel || 'gpt-4o-mini',
        existing_title: formData.title || initialListing?.title || ''
      });

      if (response.data.success) {
        const result = response.data.data;
        setFormData(prev => ({
          ...prev,
          title: prev.title || initialListing?.title || result.title,
          brand: result.brand || '',
          originalPrice: result.originalPrice || '',
          color: result.color || '',
          styleTag: result.styleTag || '',
          quantity: 1,
          size: result.size || '',
          price: result.price,
          description: result.description,
          conditionNote: selectedRuleObj?.condition_note || '',
          category: result.category_name || result.category || '',
          categoryId: result.categoryId || '',
          departmentId: result.departmentId || '',
          subcategoryIds: result.subcategoryIds || [],
          sku: result.sku || ''
        }));
      }
    } catch (error) {
      console.error("AI Analysis Error:", error);
      if (error.response?.status === 409 && error.response.data?.isDuplicate) {
        toast.warning(`Product already exists: "${error.response.data.title || 'Untitled'}". Redirecting...`);
        setTimeout(() => {
          navigate(`/listings?highlight=${error.response.data.listingId}`);
        }, 1500);
      } else {
        toast.error("Failed to analyze listing with AI. Check console for details.");
      }
    } finally {
      setLoading(false);
    }
  };

  const ruleOptions = useMemo(() => rules.map(rule => ({
    id: rule._id || rule.id,
    label: rule.name,
    description: (rule.title_sequence || []).join(' | ')
  })), [rules]);

  const conditionOptions = useMemo(() => POSHMARK_CONDITIONS.map(c => ({
    id: c.id,
    label: c.label,
    description: c.description
  })), []);

  const handleReorderImages = (sourceIndex, targetIndex) => {
    if (sourceIndex === null || targetIndex === null || sourceIndex === targetIndex) return;
    const newImages = [...formData.images];
    const [movedImg] = newImages.splice(sourceIndex, 1);
    newImages.splice(targetIndex, 0, movedImg);

    if (Array.isArray(files) && files.length === formData.images.length) {
      const newFiles = [...files];
      const [movedFile] = newFiles.splice(sourceIndex, 1);
      newFiles.splice(targetIndex, 0, movedFile);
      setFiles(newFiles);
    }

    setFormData(prev => ({ ...prev, images: newImages }));
    setDraggedImgIdx(null);
    setDragOverImgIdx(null);
  };

  const moveImage = (index, direction) => {
    const newImages = [...formData.images];
    const newFiles = [...files];
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newImages.length) return;
    
    [newImages[index], newImages[targetIndex]] = [newImages[targetIndex], newImages[index]];
    if (newFiles.length === newImages.length) {
      [newFiles[index], newFiles[targetIndex]] = [newFiles[targetIndex], newFiles[index]];
      setFiles(newFiles);
    }
    
    setFormData(prev => ({ ...prev, images: newImages }));
  };

  const deleteImage = (index) => {
    const newImages = formData.images.filter((_, idx) => idx !== index);
    const newFiles = files.filter((_, idx) => idx !== index);
    setFormData(prev => ({ ...prev, images: newImages }));
    setFiles(newFiles);
  };

  const handleSaveListing = async (publishType = null) => {
    // publishType can be 'extension', 'direct', or null (draft)
    if (publishType === 'extension') {
      const isExtensionInstalled = document.body.dataset.elisterExtensionInstalled === "true";
      if (!isExtensionInstalled) {
        toast.warning("Please install and reload the Elister Chrome Extension to list automatically!");
        return;
      }
    } else if (publishType === 'direct') {
      if (!user?.poshmarkAccount?.connected || !user?.poshmarkAccount?.sessionCookie) {
        toast.warning("Your Poshmark account is not connected on the server. Please connect your Poshmark account first in settings.");
        return;
      }
    }

    setLoading(true);
    const selectedRuleObj = rules.find(r => (r._id || r.id) === formData.selectedRule);
    
    const listingData = {
      title: formData.title,
      brand: formData.brand,
      originalPrice: formData.originalPrice,
      color: formData.color,
      styleTag: formData.styleTag,
      quantity: formData.quantity,
      size: formData.size,
      description: formData.description,
      price: formData.price,
      sku: formData.sku,
      category: formData.category,
      categoryId: formData.categoryId,
      departmentId: formData.departmentId,
      subcategoryIds: formData.subcategoryIds,
      images: formData.images,
      conditionNote: formData.conditionNote,
      selectedRule: formData.selectedRule,
      selectedCondition: formData.selectedCondition,
      conditionId: formData.conditionId,
      selectedModel: formData.selectedModel || 'gpt-4o-mini',
      packageWeight: selectedRuleObj?.packageWeight || { lbs: 0, oz: 0 },
      packageDimensions: selectedRuleObj?.packageDimensions || { length: 0, width: 0, height: 0 },
      status: 'draft',
      platform
    };

    try {
      const response = editId
        ? await listingService.update(editId, listingData)
        : await listingService.create(listingData);
      if (response.data.success) {
        const savedListing = response.data.data;
        
        if (publishType === 'extension') {
          toast.success(editId ? 'Poshmark Listing updated!' : 'Poshmark Listing saved!');
          // Strip HTML tags for Poshmark's text-only description box
          const plainDesc = savedListing.description 
            ? savedListing.description.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '') 
            : '';

          const token = localStorage.getItem('token');
          const backendUrl = import.meta.env.MODE === 'production'
            ? (import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : 'https://api.elister.ai/api')
            : 'http://localhost:5000/api';

          sessionStorage.setItem('elister_poshmark_publishing_id', savedListing._id);

          window.postMessage({
            action: 'ELISTER_LIST_ITEM_TRIGGER',
            data: {
              listingId: savedListing._id,
              token,
              backendUrl,
              title: savedListing.title,
              description: plainDesc,
              brand: savedListing.brand || "",
              price: parseFloat(savedListing.price) || 0.0,
              originalPrice: parseFloat(savedListing.originalPrice) || 0.0,
              size: savedListing.size || "OS",
              colors: savedListing.color 
                ? savedListing.color.split(',').map(c => c.trim()).filter(Boolean).slice(0, 2) 
                : [],
              condition: savedListing.conditionId || "uln",
              styleTags: savedListing.styleTag ? savedListing.styleTag.split(',').map(t => t.trim()) : [],
              departmentId: savedListing.departmentId || "01008c10d97b4e1245005764", // Default Men
              categoryId: savedListing.categoryId || "07008c10d97b4e1245005764", // Default Shirts
              subcategoryIds: savedListing.subcategoryIds ? (Array.isArray(savedListing.subcategoryIds) ? savedListing.subcategoryIds : [savedListing.subcategoryIds]) : [],
              images: savedListing.images || []
            }
          }, "*");

          toast.success("Listing execution started in background...");
        } else if (publishType === 'direct') {
          toast.success("Listing saved. Publishing to Poshmark directly via API...");
          try {
            const publishRes = await externalImportService.publish(savedListing._id, { platform: 'poshmark' });
            if (publishRes.data.success) {
              toast.success("Listing successfully published to Poshmark via API!");
            }
          } catch (pubErr) {
            console.error("Direct publish failed:", pubErr);
            toast.error(pubErr.response?.data?.message || "Failed to publish listing to Poshmark directly.");
          }
        } else {
          toast.success(editId ? 'Poshmark Listing updated successfully!' : 'Poshmark Listing saved successfully!');
        }
        window.dispatchEvent(new Event('elister-listings-update'));
        if (isModal && onClose) {
          onClose();
        } else {
          navigate('/listings');
        }
      }
    } catch (error) {
      console.error("Error saving listing:", error);
      toast.error(error.response?.data?.message || "Failed to save listing.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[95%] mx-auto space-y-8 px-4 py-6">
      {/* Hidden image preloader to track loading status */}
      <div style={{ display: 'none' }}>
        {formData.images.map((img, idx) => (
          <img 
            key={`preload-${idx}-${img.substring(0, 50)}`}
            src={img}
            onLoad={() => setLoadedImages(prev => ({ ...prev, [idx]: true }))}
            onError={() => setLoadedImages(prev => ({ ...prev, [idx]: 'error' }))}
          />
        ))}
      </div>

      {/* Header */}
      <div className="flex justify-between items-start gap-4">
        <div>
          <Badge variant="brand" className="mb-2.5">{editId ? 'Edit Mode' : 'AI Powered'}</Badge>
          <h1 className="text-2xl font-black text-slate-900">
            {editId ? 'Edit Poshmark Listing' : 'Create New Poshmark Listing'}
          </h1>
          <p className="text-slate-400 text-xs font-semibold mt-1.5">
            Single Page AI-Powered Listing Creation
          </p>
        </div>
        {isModal && onClose && (
          <IconButton aria-label="Close" onClick={onClose}>
            <X size={18} />
          </IconButton>
        )}
      </div>

      {/* Main Single Form Body */}
      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-8 relative">
        
        {/* SECTION 1: Product Images (Repositioned to the top!) */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 text-[11px] font-black flex items-center justify-center shrink-0">1</span>
            <div>
              <h3 className="text-sm font-black text-slate-900">Product Images</h3>
              <p className="text-[10px] font-bold text-slate-400 mt-0.5">First photo is used as the cover image</p>
            </div>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
            <label className="aspect-square bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-indigo-50/40 hover:border-indigo-300 transition-all group">
              <Upload className="w-6 h-6 text-slate-400 group-hover:text-indigo-600 transition-colors" />
              <span className="text-[10px] font-black text-slate-400 group-hover:text-indigo-600 mt-2 uppercase tracking-wider transition-colors">Add Photos</span>
              <input type="file" multiple className="hidden" onChange={handleImageUpload} />
            </label>
            {formData.images.map((img, i) => (
              <div 
                key={i} 
                draggable={true}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', String(i));
                  e.dataTransfer.effectAllowed = 'move';
                  setDraggedImgIdx(i);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverImgIdx !== i) setDragOverImgIdx(i);
                }}
                onDragLeave={() => {
                  if (dragOverImgIdx === i) setDragOverImgIdx(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const sourceIdx = draggedImgIdx !== null ? draggedImgIdx : parseInt(e.dataTransfer.getData('text/plain'), 10);
                  if (!isNaN(sourceIdx)) {
                    handleReorderImages(sourceIdx, i);
                  }
                }}
                onDragEnd={() => {
                  setDraggedImgIdx(null);
                  setDragOverImgIdx(null);
                }}
                className={`aspect-square bg-slate-100 rounded-2xl relative group overflow-hidden border shadow-sm cursor-grab active:cursor-grabbing transition-all duration-150 ${
                  draggedImgIdx === i ? 'opacity-40 scale-95 ring-2 ring-indigo-400' : ''
                } ${
                  dragOverImgIdx === i ? 'ring-2 ring-indigo-600 scale-105 shadow-xl border-indigo-500 bg-indigo-50/50' : 'border-slate-100'
                }`}
                title="Drag and drop to reorder photos"
              >
                <img src={img} className="w-full h-full object-cover pointer-events-none" alt="Product" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                   <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFormData({...formData, images: formData.images.filter((_, idx) => idx !== i)});
                      setFiles(files.filter((_, idx) => idx !== i));
                    }}
                    className="p-1.5 bg-rose-600 rounded-lg text-white hover:bg-rose-700 cursor-pointer transition-colors"
                    title="Delete Image"
                   >
                    <Trash2 size={14} />
                   </button>
                   <button
                    type="button"
                    disabled={i === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      moveImage(i, 'left');
                    }}
                    className="p-1.5 bg-white/20 hover:bg-white/40 text-white rounded-lg disabled:opacity-40 cursor-pointer transition-colors"
                    title="Move Left"
                   >
                    <ArrowLeft size={14} />
                   </button>
                   <button
                    type="button"
                    disabled={i === formData.images.length - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      moveImage(i, 'right');
                    }}
                    className="p-1.5 bg-white/20 hover:bg-white/40 text-white rounded-lg disabled:opacity-40 cursor-pointer transition-colors"
                    title="Move Right"
                   >
                    <ArrowRight size={14} />
                   </button>
                </div>
                {i === 0 && (
                  <span className="absolute top-2 left-2 px-2 py-0.5 bg-indigo-600 text-white text-[8px] font-black uppercase rounded-md shadow-sm tracking-wider pointer-events-none">Cover</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 2: AI Configuration Setup */}
        <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100 space-y-5">
          <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 text-[11px] font-black flex items-center justify-center shrink-0">2</span>
                <div>
                  <h3 className="text-sm font-black text-slate-900">AI Scanner Settings</h3>
                  <p className="text-[10px] font-bold text-slate-400 mt-0.5">Choose the model and rule used to generate this listing</p>
                </div>
              </div>
              <Badge variant="neutral">{rules.length} Rules Available</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center">
                Select AI Model
              </label>
              <SearchableDropdown 
                value={modelOptions.find(m => m.id === formData.selectedModel)?.label || 'GPT-4o Mini'}
                onSelect={(opt) => setFormData({...formData, selectedModel: opt.id})}
                options={modelOptions}
                placeholder="Select model..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center">
                Select AI Listing Rule
              </label>
              <SearchableDropdown 
                value={rules.find(r => (r._id || r.id) === formData.selectedRule)?.name || ''}
                onSelect={(opt) => setFormData({...formData, selectedRule: opt.id})}
                options={ruleOptions}
                placeholder={rules.length ? 'Choose a rule...' : 'No rules found'}
                disabled={rules.length === 0}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center">
                Product Condition
              </label>
              <SearchableDropdown 
                value={formData.selectedCondition}
                onSelect={(opt) => setFormData({...formData, selectedCondition: opt.label, conditionId: opt.id})}
                options={conditionOptions}
                placeholder="Select condition..."
              />
            </div>
          </div>

          <button
            type="button"
            onClick={startAIFetch}
            disabled={loading || !formData.selectedRule || !formData.selectedCondition || formData.images.length === 0}
            className="w-full py-4 bg-slate-900 hover:bg-black text-white font-extrabold rounded-2xl text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-98 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                Scanning &amp; Extracting Image Data...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                Populate Form with AI Scan
              </>
            )}
          </button>
        </div>

        {/* LOADING SHIMMER */}
        {loading && (
          <LoadingState label="AI is analyzing product images..." className="py-20 border border-dashed border-slate-100 rounded-3xl" />
        )}

        {/* SECTION 3: Generated Form Attributes (Only rendered when hasScanned is true) */}
        {hasScanned && !loading && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 border-t border-slate-100 pt-8 animate-in fade-in slide-in-from-top-4 duration-300">
            
            {/* Left Side fields */}
            <div className="lg:col-span-6 space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                <span className="w-7 h-7 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 text-[11px] font-black flex items-center justify-center shrink-0">3</span>
                <h3 className="text-sm font-black text-slate-900">Listing Metadata Fields</h3>
              </div>

              <div className="space-y-4">
                {/* Title */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Product Title</label>
                  <input 
                    className="w-full px-4 h-12 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all focus:ring-2 focus:ring-indigo-500/10"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Brand */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Brand</label>
                    <input 
                      className="w-full px-4 h-12 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all focus:ring-2 focus:ring-indigo-500/10"
                      value={formData.brand}
                      onChange={(e) => setFormData({...formData, brand: e.target.value})}
                      placeholder="Brand..."
                    />
                  </div>
                  {/* Category */}
                  <div className="space-y-1.5 sm:col-span-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Poshmark Category</label>
                    <CategorySearchDropdown 
                      value={formData.category}
                      onSelect={(opt) => setFormData({
                        ...formData, 
                        category: opt.fullName, 
                        categoryId: opt.categoryId || opt.id,
                        departmentId: opt.departmentId || '',
                        subcategoryIds: opt.subcategoryIds || []
                      })}
                      placeholder="Category..."
                    />
                  </div>
                  {/* SKU */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">SKU</label>
                    <input 
                      className="w-full px-4 h-12 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all focus:ring-2 focus:ring-indigo-500/10 uppercase"
                      value={formData.sku}
                      onChange={(e) => setFormData({...formData, sku: e.target.value})}
                      placeholder="SKU"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Listing Price */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Price ($)</label>
                    <div className="relative">
                      <DollarSign size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        className="w-full pl-10 pr-4 h-12 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all focus:ring-2 focus:ring-indigo-500/10"
                        value={formData.price}
                        onChange={(e) => setFormData({...formData, price: e.target.value})}
                      />
                    </div>
                  </div>
                  {/* Original Price */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">MSRP / Original Price</label>
                    <div className="relative">
                      <DollarSign size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        className="w-full pl-10 pr-4 h-12 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all focus:ring-2 focus:ring-indigo-500/10"
                        value={formData.originalPrice}
                        onChange={(e) => setFormData({...formData, originalPrice: e.target.value})}
                        placeholder="MSRP"
                      />
                    </div>
                  </div>
                  {/* Condition */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Condition</label>
                    <SearchableDropdown 
                      value={formData.selectedCondition}
                      onSelect={(opt) => setFormData({...formData, selectedCondition: opt.label, conditionId: opt.id})}
                      options={conditionOptions}
                      placeholder="Select condition..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Color */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Color</label>
                    <ColorMultiSelectDropdown 
                      value={formData.color}
                      onChange={(val) => setFormData({...formData, color: val})}
                    />
                  </div>
                  {/* Size */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Size</label>
                    <input 
                      className="w-full px-4 h-12 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all focus:ring-2 focus:ring-indigo-500/10"
                      value={formData.size}
                      onChange={(e) => setFormData({...formData, size: e.target.value})}
                      placeholder="e.g. M, L..."
                    />
                  </div>
                  {/* Quantity */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Quantity</label>
                    <input 
                      type="number"
                      className="w-full px-4 h-12 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all focus:ring-2 focus:ring-indigo-500/10"
                      value={formData.quantity}
                      onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value) || 1})}
                      min="1"
                    />
                  </div>
                  {/* Style Tag */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Style Tags</label>
                    <input 
                      className="w-full px-4 h-12 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all focus:ring-2 focus:ring-indigo-500/10"
                      value={formData.styleTag}
                      onChange={(e) => setFormData({...formData, styleTag: e.target.value})}
                      placeholder="Vintage, Boho..."
                      list="poshmark-style-tags"
                    />
                    <datalist id="poshmark-style-tags">
                      {POSHMARK_STYLE_TAGS.map(tag => (
                        <option key={tag} value={tag} />
                      ))}
                    </datalist>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side: Description preview & Setup details */}
            <div className="lg:col-span-6 space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                <span className="w-7 h-7 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 text-[11px] font-black flex items-center justify-center shrink-0">4</span>
                <h3 className="text-sm font-black text-slate-900">Description &amp; Poshmark Info</h3>
              </div>

              <div className="space-y-4">
                {/* Description input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Listing Description</label>
                    <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                      <button 
                        type="button"
                        onClick={() => setDescriptionMode('preview')}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[9px] font-black transition-all ${descriptionMode === 'preview' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        <Eye size={11} /> Preview
                      </button>
                      <button 
                        type="button"
                        onClick={() => setDescriptionMode('edit')}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[9px] font-black transition-all ${descriptionMode === 'edit' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        <Code size={11} /> Edit
                      </button>
                    </div>
                  </div>

                  {descriptionMode === 'edit' ? (
                    <textarea 
                      className="w-full p-4 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 leading-relaxed min-h-[250px] outline-none focus:border-indigo-500 transition-all shadow-inner focus:ring-2 focus:ring-indigo-500/10"
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      placeholder="Enter description..."
                    />
                  ) : (
                    <div 
                      className="w-full p-4 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 leading-relaxed min-h-[250px] overflow-y-auto max-h-[300px] shadow-inner"
                      style={{ whiteSpace: 'pre-wrap' }}
                    >
                      {formData.description}
                    </div>
                  )}
                </div>

                <div className="p-5 bg-indigo-50/40 border border-indigo-100 rounded-2xl space-y-3">
                  <h4 className="text-[10px] font-black text-indigo-900 uppercase tracking-wider">eLister Listing Setup</h4>
                  <p className="text-[11px] text-indigo-700 leading-relaxed font-semibold">
                    Poshmark listings are stored as drafts in eLister. You can copy details (Title, Price, Description, Images) to Poshmark easily using the <b>Copy Details</b> feature in listings.
                  </p>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Form Bottom Submission Control (Only visible when scanned) */}
        {hasScanned && !loading && (
          <div className="mt-8 pt-6 flex flex-wrap justify-end items-center gap-3 border-t border-slate-100 animate-in fade-in duration-300">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (isModal && onClose) {
                  onClose();
                } else {
                  navigate('/listings');
                }
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSaveListing(null)}
              loading={loading}
              disabled={loading || isConvertingImages || !allImagesLoaded}
            >
              Save Draft
            </Button>
            <Button
              type="button"
              variant="primary"
              className="bg-emerald-600! hover:bg-emerald-700! shadow-emerald-500/20!"
              onClick={() => handleSaveListing('direct')}
              loading={loading}
              disabled={loading || isConvertingImages || !allImagesLoaded}
            >
              {loading ? 'Working...' : 'List via Direct API'}
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => handleSaveListing('extension')}
              loading={loading}
              disabled={loading || isConvertingImages || !allImagesLoaded}
            >
              {loading ? 'Working...' : 'List via Extension'}
            </Button>
          </div>
        )}

      </div>
    </div>
  );
};

export default CreatePoshmarkListing;
