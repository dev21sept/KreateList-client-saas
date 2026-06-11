import React, { useState, useEffect, useMemo } from 'react';
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
  Eye,
  Trash2
} from 'lucide-react';
import { ruleService, aiService, listingService } from '../services/api';
import { useNotification } from '../context/NotificationContext';
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
import { DEPOP_ATTRIBUTE_OPTIONS } from '../constants/depopCategoryAttributes';
import { DEPOP_KIDS_APPAREL_SIZES, DEPOP_KIDS_SHOE_SIZES, DEPOP_WOMENS_TOPS_SIZES, DEPOP_WOMENS_BOTTOMS_SIZES } from '../constants/depopSizes';

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

const CategorySearchDropdown = ({ value, onSelect, placeholder = 'Search Depop category...' }) => {
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
        const response = await aiService.depopSuggestCategories(searchTerm);
        if (response.data) {
          setSuggestions(response.data);
        }
      } catch (err) {
        console.error("Error fetching Depop categories:", err);
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
            <div className="p-4 text-xs font-semibold text-slate-400 text-center">Searching Depop Categories...</div>
          )}
          {!loading && suggestions.length === 0 && searchTerm.trim() && (
            <div className="p-4 text-xs font-semibold text-slate-400 text-center">No categories found</div>
          )}
          {!loading && suggestions.length === 0 && !searchTerm.trim() && (
            <div className="p-4 text-xs font-semibold text-slate-400 text-center">Type to search Depop categories...</div>
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

const CreateDepopListing = () => {
  const navigate = useNavigate();
  const { toast } = useNotification();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const platform = 'depop';
  const [step, setStep] = useState(editId ? 2 : 1);
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
    age: '',
    source: '',
    material: '',
    bodyFit: '',
    occasion: '',
    depopType: '',
    fastening: '',
    fit: '',
    country: 'India',
    shippingPrice: '0.00',
    worldwideShipping: false,
    quantity: 1,
    size: '',
    category: '',
    categoryId: '',
    price: '',
    description: '',
    conditionNote: '',
    sku: '',
    selectedModel: 'gpt-4o-mini',
  });
  const [activeAttributesState, setActiveAttributesState] = useState([]);

  useEffect(() => {
    if (formData.categoryId) {
      aiService.depopGetCategoryDetails({ id: formData.categoryId })
        .then(res => {
          if (res.data?.success && res.data?.data) {
            setActiveAttributesState(res.data.data.attribute_ids || []);
          }
        })
        .catch(err => console.error("Error loading category details:", err));
    }
  }, [formData.categoryId]);

  const [kidsSizeScale, setKidsSizeScale] = useState('US');

  // Resolve size dataset dynamically based on category
  const activeSizeDataset = useMemo(() => {
    if (!formData.category) return null;
    
    if (formData.category.startsWith('Kids >')) {
      const isShoe = formData.category.includes('Footwear');
      return isShoe ? DEPOP_KIDS_SHOE_SIZES : DEPOP_KIDS_APPAREL_SIZES;
    }
    
    if (formData.category.startsWith('Women >')) {
      const isBottom = formData.category.includes('Bottoms') || formData.category.includes('Jeans') || formData.category.includes('Skirts');
      return isBottom ? DEPOP_WOMENS_BOTTOMS_SIZES : DEPOP_WOMENS_TOPS_SIZES;
    }
    
    return null;
  }, [formData.category]);

  // Handle empty scale selection when switching categories
  useEffect(() => {
    if (activeSizeDataset) {
      const currentScaleEmpty = (activeSizeDataset[kidsSizeScale] || []).length === 0;
      if (currentScaleEmpty) {
        // Find first non-empty scale
        for (const scale of ['US', 'UK', 'EUR', 'AU']) {
          if ((activeSizeDataset[scale] || []).length > 0) {
            setKidsSizeScale(scale);
            break;
          }
        }
      }
    }
  }, [activeSizeDataset, kidsSizeScale]);

  useEffect(() => {
    if (!activeSizeDataset || !formData.size) return;
    
    // 1. Check if composite ID format (e.g. 101.8-EUR)
    const compositeMatch = formData.size.match(/^(\d+\.\d+)-(EUR|AU|UK|US)$/);
    if (compositeMatch) {
      const scale = compositeMatch[2];
      setKidsSizeScale(scale);
      return;
    }
    
    // 2. Otherwise try to match plain name to composite_id
    const currentScaleSizes = activeSizeDataset[kidsSizeScale] || [];
    const foundInCurrent = currentScaleSizes.find(s => s.name.toLowerCase() === formData.size.toLowerCase());
    if (foundInCurrent) {
      setFormData(prev => ({ ...prev, size: foundInCurrent.composite_id }));
      return;
    }
    
    for (const scale of ['US', 'UK', 'EUR', 'AU']) {
      const found = (activeSizeDataset[scale] || []).find(s => s.name.toLowerCase() === formData.size.toLowerCase());
      if (found) {
        setKidsSizeScale(scale);
        setFormData(prev => ({ ...prev, size: found.composite_id }));
        return;
      }
    }
  }, [formData.size, activeSizeDataset, kidsSizeScale]);

  const getDisplaySize = useMemo(() => {
    const sizeValue = formData.size;
    if (!sizeValue) return 'None';
    if (activeSizeDataset) {
      for (const scale of ['US', 'UK', 'EUR', 'AU']) {
        const found = (activeSizeDataset[scale] || []).find(s => s.composite_id === sizeValue);
        if (found) {
          return `${found.name} (${scale})`;
        }
      }
    }
    return sizeValue;
  }, [formData.size, activeSizeDataset]);

  const kidsSizesOptions = useMemo(() => {
    if (!activeSizeDataset) return [];
    return (activeSizeDataset[kidsSizeScale] || []).map(s => ({
      id: s.composite_id,
      label: s.name
    }));
  }, [activeSizeDataset, kidsSizeScale]);

  const kidsSizeLabel = useMemo(() => {
    if (!formData.size || !activeSizeDataset) return '';
    const currentScaleSizes = activeSizeDataset[kidsSizeScale] || [];
    const found = currentScaleSizes.find(s => s.composite_id === formData.size);
    return found ? found.name : '';
  }, [formData.size, activeSizeDataset, kidsSizeScale]);

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
    { id: 'gemini-1.5-flash', label: '1.5 Flash (AI Studio)', description: 'Vibrant, fast Google AI Studio model' },
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

  useEffect(() => {
    if (editId) {
      const fetchListing = async () => {
        try {
          setLoading(true);
          const response = await listingService.getOne(editId);
          if (response.data.success) {
            const listing = response.data.data;
            setFormData({
              images: (listing.images || []).filter(img => typeof img === 'string' && !img.startsWith('blob:')),
              selectedRule: listing.selectedRule || '',
              selectedCondition: listing.selectedCondition || '',
              conditionId: listing.conditionId || '',
              title: listing.title || '',
              brand: listing.brand || '',
              originalPrice: listing.originalPrice || '',
              color: listing.color || '',
              styleTag: listing.styleTag || '',
              age: listing.age || '',
              source: listing.source || '',
              material: listing.material || '',
              bodyFit: listing.bodyFit || '',
              occasion: listing.occasion || '',
              depopType: listing.depopType || '',
              fastening: listing.fastening || '',
              fit: listing.fit || '',
              country: listing.country || 'India',
              shippingPrice: listing.shippingPrice || '0.00',
              worldwideShipping: listing.worldwideShipping !== undefined ? listing.worldwideShipping : false,
              quantity: listing.quantity || 1,
              size: listing.size || '',
              category: listing.category || '',
              categoryId: listing.categoryId || '',
              price: listing.price || '',
              description: listing.description || '',
              conditionNote: listing.conditionNote || '',
              sku: listing.sku || '',
              selectedModel: listing.selectedModel || 'gpt-4o-mini',
            });
            setStep(2);
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
      const base64Images = await Promise.all(uploadedFiles.map(file => fileToBase64(file)));
      setFormData(prev => ({ ...prev, images: [...prev.images, ...base64Images] }));
    } catch (err) {
      console.error("Error converting images to base64:", err);
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
        platform: 'depop'
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

    setStep(2);
    
    const selectedRuleObj = rules.find(r => (r._id || r.id) === formData.selectedRule);
    
    try {
      const response = await aiService.depopAnalyze({
        images: formData.images, 
        title_sequence: selectedRuleObj?.title_sequence || [],
        description_prompt: selectedRuleObj?.description_prompt || '',
        condition_note: selectedRuleObj?.condition_note || '',
        condition_name: formData.selectedCondition,
        model: formData.selectedModel || 'gpt-4o-mini'
      });

      if (response.data.success) {
        const result = response.data.data;
        
        // Find closest matches in our official lists
        const findClosestMatch = (val, list) => {
          if (!val) return '';
          const clean = String(val).toLowerCase().trim();
          const found = list.find(item => 
            item.label.toLowerCase() === clean || 
            item.id.toLowerCase() === clean ||
            clean.includes(item.label.toLowerCase()) ||
            clean.includes(item.id.toLowerCase())
          );
          return found ? found.label : '';
        };

        const resolvedBrand = findClosestMatch(result.brand, DEPOP_BRANDS) || result.brand || '';
        const resolvedColor = findClosestMatch(result.color, DEPOP_COLOURS) || '';
        const resolvedStyle = findClosestMatch(result.styleTag, DEPOP_STYLES) || '';
        const resolvedAge = findClosestMatch(result.age, DEPOP_AGES) || '';
        const resolvedSource = findClosestMatch(result.source, DEPOP_SOURCES) || '';
        const resolvedMaterial = findClosestMatch(result.material, DEPOP_MATERIALS) || '';
        const resolvedBodyFit = findClosestMatch(result.bodyFit, DEPOP_BODY_FITS) || '';
        const resolvedOccasion = findClosestMatch(result.occasion, DEPOP_OCCASIONS) || '';
        const resolvedFastening = findClosestMatch(result.fastening, DEPOP_FASTENINGS) || '';
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
        const resolvedFit = findClosestMatch(result.fit, allFitsList) || result.fit || '';
        const resolvedDepopType = findClosestMatch(result.depopType, allTypesList) || result.depopType || '';

        setFormData(prev => ({
          ...prev,
          title: result.title,
          brand: resolvedBrand,
          originalPrice: result.originalPrice || '',
          color: resolvedColor,
          styleTag: resolvedStyle,
          age: resolvedAge,
          source: resolvedSource,
          material: resolvedMaterial,
          bodyFit: resolvedBodyFit,
          occasion: resolvedOccasion,
          depopType: resolvedDepopType,
          fastening: resolvedFastening,
          fit: resolvedFit,
          quantity: 1,
          size: result.size || '',
          price: result.price,
          description: result.description,
          conditionNote: selectedRuleObj?.condition_note || '',
          category: result.category_name || result.category || '',
          categoryId: result.categoryId || '',
          sku: result.sku || ''
        }));
        setActiveAttributesState(result.attribute_ids || []);
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

  const conditionOptions = useMemo(() => DEPOP_CONDITIONS.map(c => ({
    id: c.id,
    label: c.label,
    description: c.description
  })), []);

  const brandOptions = useMemo(() => DEPOP_BRANDS.map(b => ({
    id: b.id,
    label: b.label
  })), []);

  const colorOptions = useMemo(() => DEPOP_COLOURS.map(c => ({
    id: c.id,
    label: c.label
  })), []);

  const styleOptions = useMemo(() => DEPOP_STYLES.map(s => ({
    id: s.id,
    label: s.label
  })), []);

  const ageOptions = useMemo(() => DEPOP_AGES.map(a => ({
    id: a.id,
    label: a.label
  })), []);

  const sourceOptions = useMemo(() => DEPOP_SOURCES.map(s => ({
    id: s.id,
    label: s.label
  })), []);

  const materialOptions = useMemo(() => DEPOP_MATERIALS.map(m => ({
    id: m.id,
    label: m.label
  })), []);

  const bodyFitOptions = useMemo(() => DEPOP_BODY_FITS.map(bf => ({
    id: bf.id,
    label: bf.label
  })), []);

  const countryOptions = useMemo(() => DEPOP_COUNTRIES.map(c => ({
    id: c.id,
    label: c.label
  })), []);

  const occasionOptions = useMemo(() => DEPOP_OCCASIONS.map(o => ({
    id: o.id,
    label: o.label
  })), []);

  const activeAttributes = useMemo(() => {
    if (activeAttributesState && activeAttributesState.length > 0) {
      return activeAttributesState;
    }
    
    // Default fallback based on category text matching
    const cat = String(formData.category || '').toLowerCase();
    const isBeauty = cat.includes('beauty') || cat.includes('skincare');
    const isFootwear = cat.includes('footwear');
    const isBottoms = cat.includes('bottoms') || cat.includes('jeans') || cat.includes('trousers');
    const isTops = cat.includes('tops') || cat.includes('hoodies') || cat.includes('sweatshirts') || cat.includes('jumpers') || cat.includes('cardigans') || cat.includes('shirts') || cat.includes('polo shirts') || cat.includes('blouses') || cat.includes('crop tops') || cat.includes('vests') || cat.includes('corsets') || cat.includes('bodysuits') || cat.includes('dresses') || cat.includes('jumpsuits') || cat.includes('playsuits') || cat.includes('suits');
    
    const attrs = [];
    if (!isBeauty) {
      attrs.push("material", "size-fit");
      if (isFootwear || isBottoms || isTops) {
        attrs.push("occasion");
      }
      if (isBottoms || isTops) {
        attrs.push("body-fit");
      }
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
  }, [activeAttributesState, formData.category]);

  const activeTypeAttribute = useMemo(() => {
    const typeAttrs = [
      "bottom-style", "dress-type", "coat-type", "jacket-type", 
      "jumpssuit-type", "dungarees-type", "trainers-type", 
      "shoe-type", "boot-type", "beauty-type",
      "hair-accesories-type", "watches-type", "gloves-and-mittens-type",
      "hat-type", "jewellery-type", "bag-type", "bra-type", 
      "panties-type"
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

  const typeOptions = useMemo(() => {
    if (!activeTypeAttribute) return [];
    if (DEPOP_ATTRIBUTE_OPTIONS[activeTypeAttribute]) {
      return DEPOP_ATTRIBUTE_OPTIONS[activeTypeAttribute];
    }
    if (activeTypeAttribute === "bottom-style") {
      return DEPOP_TYPES.bottoms;
    }
    if (activeTypeAttribute === "beauty-type") {
      return DEPOP_TYPES.beauty;
    }
    if (activeTypeAttribute === "trainers-type" || activeTypeAttribute === "shoe-type") {
      return DEPOP_TYPES.footwear;
    }
    return [];
  }, [activeTypeAttribute]);

  const fasteningOptions = useMemo(() => DEPOP_FASTENINGS.map(f => ({
    id: f.id,
    label: f.label
  })), []);

  const fitOptions = useMemo(() => {
    if (!activeFitAttribute) return [];
    if (DEPOP_ATTRIBUTE_OPTIONS[activeFitAttribute]) {
      return DEPOP_ATTRIBUTE_OPTIONS[activeFitAttribute];
    }
    if (activeFitAttribute === "bottom-fit") {
      return DEPOP_FITS.map(f => ({ id: f.id, label: f.label }));
    }
    return [];
  }, [activeFitAttribute]);

  const categoryVisibilities = useMemo(() => {
    const isBeauty = activeAttributes.includes("beauty-type");
    return {
      type: activeTypeAttribute !== null,
      fastening: activeAttributes.includes("fastening"),
      fit: activeFitAttribute !== null,
      bodyFit: activeAttributes.includes("body-fit"),
      occasion: activeAttributes.includes("occasion"),
      material: activeAttributes.includes("material"),
      size: activeAttributes.includes("size-fit"),
      enhanceAttrs: !isBeauty
    };
  }, [activeAttributes, activeTypeAttribute, activeFitAttribute]);

  const deleteImage = (index) => {
    const newImages = formData.images.filter((_, idx) => idx !== index);
    const newFiles = files.filter((_, idx) => idx !== index);
    setFormData(prev => ({ ...prev, images: newImages }));
    setFiles(newFiles);
  };

  const handleSaveListing = async (publish = false) => {
    if (publish) {
      const isExtensionInstalled = document.body.dataset.elisterDepopExtensionInstalled === "true";
      if (!isExtensionInstalled) {
        toast.warning("Please install and reload the Elister Depop Chrome Extension to list automatically!");
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
      age: formData.age,
      source: formData.source,
      material: formData.material,
      bodyFit: formData.bodyFit,
      occasion: formData.occasion,
      depopType: formData.depopType,
      fastening: formData.fastening,
      fit: formData.fit,
      country: formData.country,
      shippingPrice: formData.shippingPrice,
      worldwideShipping: formData.worldwideShipping,
      quantity: formData.quantity,
      size: formData.size,
      description: formData.description,
      price: formData.price,
      sku: formData.sku,
      category: formData.category,
      categoryId: formData.categoryId,
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
        toast.success(editId ? 'Depop Listing updated successfully!' : 'Depop Listing saved successfully!');
        
        if (publish) {
          const token = localStorage.getItem('token');
          const backendUrl = import.meta.env.MODE === 'production'
            ? (import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : 'https://api.elister.ai/api')
            : 'http://localhost:5000/api';

          const selectedTypeOption = typeOptions.find(opt => opt.label === savedListing.depopType);
          const selectedFitOption = fitOptions.find(opt => opt.label === savedListing.fit);

          window.postMessage({
            action: 'ELISTER_DEPOP_LIST_ITEM_TRIGGER',
            data: {
              listingId: savedListing._id,
              token,
              backendUrl,
              title: savedListing.title,
              description: savedListing.description,
              brand: savedListing.brand || "",
              price: parseFloat(savedListing.price) || 0.0,
              originalPrice: parseFloat(savedListing.originalPrice) || 0.0,
              size: savedListing.size || "",
              color: savedListing.color || "",
              material: savedListing.material || "",
              conditionId: savedListing.conditionId || "3000",
              categoryId: savedListing.categoryId || "",
              age: savedListing.age || "",
              source: savedListing.source || "",
              bodyFit: savedListing.bodyFit || "",
              occasion: savedListing.occasion || "",
              depopType: selectedTypeOption ? selectedTypeOption.id : (savedListing.depopType || ""),
              fastening: savedListing.fastening || "",
              fit: selectedFitOption ? selectedFitOption.id : (savedListing.fit || ""),
              activeTypeAttribute: activeTypeAttribute || "",
              activeFitAttribute: activeFitAttribute || "",
              country: savedListing.country || "US",
              shippingPrice: parseFloat(savedListing.shippingPrice) || 0.0,
              worldwideShipping: !!savedListing.worldwideShipping,
              quantity: parseInt(savedListing.quantity) || 1,
              images: savedListing.images || []
            }
          }, "*");

          toast.success("Opening Depop and launching publisher queue...");
        }
        navigate('/listings');
      }
    } catch (error) {
      console.error("Error saving listing:", error);
      toast.error(error.response?.data?.message || "Failed to save listing.");
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (step === 1) {
      startAIFetch();
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      handleSaveListing(false);
    }
  };
  
  const prevStep = () => setStep(step - 1);

  return (
    <div className="max-w-[95%] mx-auto space-y-8 px-4">
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
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {editId ? 'Edit Depop Listing' : 'Create New Depop Listing'}
          </h1>
          <p className="text-slate-500">
            {step === 1 && "Step 1: Input Requirements"}
            {step === 2 && "Step 2: AI Generated Content"}
            {step === 3 && "Step 3: Preview & Save"}
          </p>
        </div>
        <div className="flex gap-2 mb-1">
          {[1, 2, 3].map(i => (
            <div 
              key={i} 
              className={`w-12 h-1.5 rounded-full transition-all duration-500 ${step >= i ? 'bg-indigo-600' : 'bg-slate-200'}`}
            />
          ))}
        </div>
      </div>

      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm min-h-[550px] flex flex-col relative overflow-hidden">
        <AnimatePresence mode="popLayout">
          {step === 1 && (
            <motion.div 
              key="step1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-10 flex-1"
            >
              {/* Selection Section */}
              <div className="bg-slate-50/50 p-8 rounded-[2.5rem] border border-slate-100 space-y-8">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-black text-indigo-900 uppercase tracking-[0.2em] flex items-center">
                      <Sparkles size={16} className="mr-2 text-indigo-500" /> AI Configuration Setup
                    </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-550 uppercase tracking-widest ml-1 flex items-center">
                      <Sparkles size={14} className="mr-1.5 text-indigo-600" /> Select AI Model
                    </label>
                    <SearchableDropdown 
                      value={modelOptions.find(m => m.id === formData.selectedModel)?.label || 'GPT-4o Mini'}
                      onSelect={(opt) => setFormData({...formData, selectedModel: opt.id})}
                      options={modelOptions}
                      placeholder="Select model..."
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-550 uppercase tracking-widest ml-1 flex items-center">
                      <Zap size={14} className="mr-1.5 text-indigo-600" /> Select AI Listing Rule
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
                    <label className="text-[10px] font-black text-slate-550 uppercase tracking-widest ml-1 flex items-center">
                      <Info size={14} className="mr-1.5 text-indigo-600" /> Product Condition
                    </label>
                    <SearchableDropdown 
                      value={formData.selectedCondition}
                      onSelect={(opt) => setFormData({...formData, selectedCondition: opt.label, conditionId: opt.id})}
                      options={conditionOptions}
                      placeholder="Select condition..."
                    />
                  </div>
                </div>

                {formData.selectedRule && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    <span className="px-3 py-1.5 bg-white border border-indigo-100 rounded-xl text-[10px] font-bold text-indigo-700 shadow-sm flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
                      Sequence: {rules.find(r => (r._id || r.id) === formData.selectedRule)?.title_sequence.slice(0, 3).join(' | ')}
                      {rules.find(r => (r._id || r.id) === formData.selectedRule)?.title_sequence.length > 3 ? '...' : ''}
                    </span>
                    <span className="px-3 py-1.5 bg-white border border-indigo-100 rounded-xl text-[10px] font-bold text-indigo-700 shadow-sm flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                      Condition Note: {rules.find(r => (r._id || r.id) === formData.selectedRule)?.condition_note?.slice(0, 50) || 'None'}
                      {rules.find(r => (r._id || r.id) === formData.selectedRule)?.condition_note?.length > 50 ? '...' : ''}
                    </span>
                  </div>
                )}
              </div>

              {/* Image Section */}
              <div className="space-y-4">
                <label className="text-sm font-bold text-slate-700 ml-1 flex items-center">
                  <ImageIcon size={16} className="mr-2 text-indigo-600" /> Product Images
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                  <label className="aspect-square bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 transition-all group">
                    <Upload className="w-6 h-6 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                    <span className="text-[10px] font-bold text-slate-400 mt-2 uppercase">Add Photos</span>
                    <input type="file" multiple className="hidden" onChange={handleImageUpload} />
                  </label>
                  {formData.images.map((img, i) => (
                    <div key={i} className="aspect-square bg-slate-100 rounded-2xl relative group overflow-hidden border border-slate-100">
                      <img src={img} className="w-full h-full object-cover" alt="Product" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                         <button 
                          onClick={() => deleteImage(i)}
                          className="p-1.5 bg-white/20 backdrop-blur-md rounded-lg text-white hover:bg-white/40"
                         >
                          <X size={16} />
                         </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              key="step2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8 flex-1"
            >
              {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center space-y-4 py-20">
                  <div className="relative">
                    <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                    <Sparkles className="w-6 h-6 text-indigo-400 absolute -top-2 -right-2 animate-bounce" />
                  </div>
                  <div className="text-center">
                    <h3 className="font-bold text-slate-900">AI is analyzing your product...</h3>
                    <p className="text-xs text-slate-400 mt-1">Generating Depop content details</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  <div className="lg:col-span-4 space-y-4">
                    <div className="aspect-square bg-slate-50 rounded-3xl overflow-hidden border border-slate-100">
                      <img src={formData.images[0]} className="w-full h-full object-cover" alt="Main Preview" />
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {formData.images.slice(1, 5).map((img, i) => (
                        <div key={i} className="aspect-square bg-slate-50 rounded-xl overflow-hidden border border-slate-100">
                           <img src={img} className="w-full h-full object-cover" alt="Thumb" />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="lg:col-span-8 space-y-6">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Generated Title</label>
                      <input 
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-semibold outline-none focus:border-indigo-500 transition-all"
                        value={formData.title}
                        onChange={(e) => setFormData({...formData, title: e.target.value})}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Brand</label>
                        <SearchableDropdown 
                          value={formData.brand}
                          onSelect={(opt) => setFormData({...formData, brand: opt.label})}
                          options={brandOptions}
                          placeholder="Select brand..."
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Depop Category</label>
                        <CategorySearchDropdown 
                          value={formData.category}
                          onSelect={(opt) => {
                            setFormData({...formData, category: opt.fullName, categoryId: opt.id});
                            setActiveAttributesState(opt.attribute_ids || []);
                          }}
                          placeholder="Search and edit category..."
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">SKU</label>
                        <input 
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all uppercase"
                          value={formData.sku}
                          onChange={(e) => setFormData({...formData, sku: e.target.value})}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Listing Price</label>
                        <div className="relative">
                          <DollarSign size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" />
                          <input 
                            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 transition-all"
                            value={formData.price}
                            onChange={(e) => setFormData({...formData, price: e.target.value})}
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Condition</label>
                        <SearchableDropdown 
                          value={formData.selectedCondition}
                          onSelect={(opt) => setFormData({...formData, selectedCondition: opt.label, conditionId: opt.id})}
                          options={conditionOptions}
                          placeholder="Select condition..."
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Color</label>
                        <SearchableDropdown 
                          value={formData.color}
                          onSelect={(opt) => setFormData({...formData, color: opt.label})}
                          options={colorOptions}
                          placeholder="Select color..."
                        />
                      </div>
                    </div>

                    {/* Dynamic Fields Section */}
                    <AnimatePresence>
                      {/* Row: Type, Fastening, Fit */}
                      {(categoryVisibilities.type || categoryVisibilities.fastening || categoryVisibilities.fit) && (
                        <motion.div 
                          key="depop-type-fastening-fit"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="grid grid-cols-1 md:grid-cols-3 gap-4"
                        >
                          {categoryVisibilities.type && (
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{typeFieldLabel}</label>
                              <SearchableDropdown 
                                value={formData.depopType}
                                onSelect={(opt) => setFormData({...formData, depopType: opt.label})}
                                options={typeOptions}
                                placeholder={`Select ${typeFieldLabel.toLowerCase()}...`}
                              />
                            </div>
                          )}
                          {categoryVisibilities.fastening && (
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Fastening</label>
                              <SearchableDropdown 
                                value={formData.fastening}
                                onSelect={(opt) => setFormData({...formData, fastening: opt.label})}
                                options={fasteningOptions}
                                placeholder="Select fastening..."
                              />
                            </div>
                          )}
                          {categoryVisibilities.fit && (
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{fitFieldLabel}</label>
                              <SearchableDropdown 
                                value={formData.fit}
                                onSelect={(opt) => setFormData({...formData, fit: opt.label})}
                                options={fitOptions}
                                placeholder={`Select ${fitFieldLabel.toLowerCase()}...`}
                              />
                            </div>
                          )}
                        </motion.div>
                      )}

                      {/* Row: Size, Style tags */}
                      {(categoryVisibilities.size || categoryVisibilities.enhanceAttrs) && (
                        <motion.div 
                          key="depop-size-style"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="grid grid-cols-1 md:grid-cols-2 gap-4"
                        >
                          {categoryVisibilities.size && (
                            <div className="space-y-3">
                              {activeSizeDataset ? (
                                <>
                                  <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Size Region / Scale</label>
                                    <div className="flex gap-1.5 flex-wrap">
                                      {['US', 'UK', 'EUR', 'AU'].map((scale) => {
                                        const isEmpty = (activeSizeDataset[scale] || []).length === 0;
                                        if (isEmpty) return null;
                                        
                                        return (
                                          <button
                                            key={scale}
                                            type="button"
                                            onClick={() => {
                                              setKidsSizeScale(scale);
                                              const currentSizeObj = (activeSizeDataset[kidsSizeScale] || []).find(s => s.composite_id === formData.size);
                                              if (currentSizeObj) {
                                                const nextSizeObj = (activeSizeDataset[scale] || []).find(s => s.name === currentSizeObj.name);
                                                if (nextSizeObj) {
                                                  setFormData(prev => ({ ...prev, size: nextSizeObj.composite_id }));
                                                  return;
                                                }
                                              }
                                              setFormData(prev => ({ ...prev, size: '' }));
                                            }}
                                            className={`px-3.5 py-1.5 text-xs font-black rounded-xl border transition-all ${
                                              kidsSizeScale === scale
                                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/10'
                                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-100'
                                            }`}
                                          >
                                            {scale}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                  <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Size</label>
                                    <SearchableDropdown
                                      value={kidsSizeLabel}
                                      onSelect={(opt) => setFormData({...formData, size: opt.id})}
                                      options={kidsSizesOptions}
                                      placeholder="Select size..."
                                    />
                                  </div>
                                </>
                              ) : (
                                <div className="space-y-1.5">
                                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Size</label>
                                  <input 
                                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-semibold outline-none focus:border-indigo-500 transition-all h-12"
                                    value={formData.size}
                                    onChange={(e) => setFormData({...formData, size: e.target.value})}
                                    placeholder="Size..."
                                  />
                                </div>
                              )}
                            </div>
                          )}
                          {categoryVisibilities.enhanceAttrs && (
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Style Tags (aesthetic tags)</label>
                              <SearchableDropdown 
                                value={formData.styleTag}
                                onSelect={(opt) => setFormData({...formData, styleTag: opt.label})}
                                options={styleOptions}
                                placeholder="Select style..."
                              />
                            </div>
                          )}
                        </motion.div>
                      )}

                      {/* Row: Age, Source */}
                      {categoryVisibilities.enhanceAttrs && (
                        <motion.div 
                          key="depop-age-source"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="grid grid-cols-1 md:grid-cols-2 gap-4"
                        >
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Age</label>
                            <SearchableDropdown 
                              value={formData.age}
                              onSelect={(opt) => setFormData({...formData, age: opt.label})}
                              options={ageOptions}
                              placeholder="Select age..."
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Source</label>
                            <SearchableDropdown 
                              value={formData.source}
                              onSelect={(opt) => setFormData({...formData, source: opt.label})}
                              options={sourceOptions}
                              placeholder="Select source..."
                            />
                          </div>
                        </motion.div>
                      )}

                      {/* Row: Material, Body Fit, Occasion */}
                      {(categoryVisibilities.material || categoryVisibilities.bodyFit || categoryVisibilities.occasion) && (
                        <motion.div 
                          key="depop-material-bodyfit-occasion"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="grid grid-cols-1 md:grid-cols-3 gap-4"
                        >
                          {categoryVisibilities.material && (
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Material</label>
                              <SearchableDropdown 
                                value={formData.material}
                                onSelect={(opt) => setFormData({...formData, material: opt.label})}
                                options={materialOptions}
                                placeholder="Select material..."
                              />
                            </div>
                          )}
                          {categoryVisibilities.bodyFit && (
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Body Fit</label>
                              <SearchableDropdown 
                                value={formData.bodyFit}
                                onSelect={(opt) => setFormData({...formData, bodyFit: opt.label})}
                                options={bodyFitOptions}
                                placeholder="Select body fit..."
                              />
                            </div>
                          )}
                          {categoryVisibilities.occasion && (
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Occasion</label>
                              <SearchableDropdown 
                                value={formData.occasion}
                                onSelect={(opt) => setFormData({...formData, occasion: opt.label})}
                                options={occasionOptions}
                                placeholder="Select occasion..."
                              />
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100 space-y-6">
                      <h3 className="text-xs font-black text-slate-700 uppercase tracking-[0.2em]">Shipping</h3>
                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-1.5 max-w-xs">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Shipping Price</label>
                          <div className="relative">
                            <DollarSign size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                              className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all"
                              value={formData.shippingPrice}
                              onChange={(e) => setFormData({...formData, shippingPrice: e.target.value})}
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center ml-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Description</label>
                        <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                          <button 
                            type="button"
                            onClick={() => setDescriptionMode('preview')}
                            className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${descriptionMode === 'preview' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                          >
                            Preview Text
                          </button>
                          <button 
                            type="button"
                            onClick={() => setDescriptionMode('edit')}
                            className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${descriptionMode === 'edit' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                          >
                            Edit Text
                          </button>
                        </div>
                      </div>
                      
                      {descriptionMode === 'preview' ? (
                        <div className="w-full min-h-[160px] p-4 bg-slate-50 border border-slate-250 rounded-2xl text-slate-700 text-xs leading-relaxed overflow-y-auto max-h-[300px] whitespace-pre-wrap">
                          {formData.description}
                        </div>
                      ) : (
                        <textarea 
                          rows={6}
                          className="w-full px-4 py-3 bg-white border border-slate-250 rounded-2xl text-xs font-semibold outline-none focus:border-indigo-500 transition-all leading-relaxed"
                          value={formData.description}
                          onChange={(e) => setFormData({...formData, description: e.target.value})}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {step === 3 && (
            <motion.div 
              key="step3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8 flex-1"
            >
              <div className="max-w-3xl mx-auto space-y-6">
                <div className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
                  <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                  <span className="text-xs font-bold text-indigo-900">Your Depop listing is ready to be saved as a draft.</span>
                </div>

                <div className="border border-slate-200 rounded-[2rem] overflow-hidden bg-white shadow-sm">
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <div>
                       <h3 className="font-bold text-slate-900 text-sm">{formData.title}</h3>
                       <p className="text-[10px] text-indigo-600 font-bold uppercase mt-0.5 tracking-wider">{formData.category}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-black text-slate-950">${formData.price}</span>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Selling Price</p>
                    </div>
                  </div>

                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-100">Item Specifications</h4>
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <p className="text-slate-400">Brand</p>
                          <p className="font-bold text-slate-700">{formData.brand || 'None'}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Condition</p>
                          <p className="font-bold text-slate-700">{formData.selectedCondition}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Size</p>
                          <p className="font-bold text-slate-700">{getDisplaySize}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Color</p>
                          <p className="font-bold text-slate-700">{formData.color || 'None'}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Style Tags</p>
                          <p className="font-bold text-slate-700">{formData.styleTag || 'None'}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Age</p>
                          <p className="font-bold text-slate-700">{formData.age || 'None'}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Source</p>
                          <p className="font-bold text-slate-700">{formData.source || 'None'}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Material</p>
                          <p className="font-bold text-slate-700">{formData.material || 'None'}</p>
                        </div>
                        {categoryVisibilities.bodyFit && formData.bodyFit && (
                          <div>
                            <p className="text-slate-400">Body Fit</p>
                            <p className="font-bold text-slate-700">{formData.bodyFit}</p>
                          </div>
                        )}
                        {categoryVisibilities.occasion && formData.occasion && (
                          <div>
                            <p className="text-slate-400">Occasion</p>
                            <p className="font-bold text-slate-700">{formData.occasion}</p>
                          </div>
                        )}
                        {categoryVisibilities.type && formData.depopType && (
                          <div>
                            <p className="text-slate-400">{typeFieldLabel}</p>
                            <p className="font-bold text-slate-700">{formData.depopType}</p>
                          </div>
                        )}
                        {categoryVisibilities.fastening && formData.fastening && (
                          <div>
                            <p className="text-slate-400">Fastening</p>
                            <p className="font-bold text-slate-700">{formData.fastening}</p>
                          </div>
                        )}
                        {categoryVisibilities.fit && formData.fit && (
                          <div>
                            <p className="text-slate-400">{fitFieldLabel}</p>
                            <p className="font-bold text-slate-700">{formData.fit}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-100">Product Images</h4>
                        <div className="flex gap-2">
                          {formData.images.slice(0, 4).map((img, i) => (
                            <div key={i} className="w-14 h-14 rounded-lg overflow-hidden border border-slate-100">
                              <img src={img} className="w-full h-full object-cover" alt="Preview Thumbnail" />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-100">Shipping</h4>
                        <div className="grid grid-cols-1 gap-4 text-xs">
                          <div>
                            <p className="text-slate-400">Shipping Price</p>
                            <p className="font-bold text-slate-700">${formData.shippingPrice || '0.00'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-8 pt-6 border-t border-slate-100 flex justify-between items-center">
          <button
            type="button"
            disabled={loading || step === 1}
            onClick={prevStep}
            className="h-12 px-6 border border-slate-200 rounded-2xl text-xs font-bold text-slate-650 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <ChevronLeft size={16} /> Back
          </button>

          <div className="flex items-center gap-4">
            {(isConvertingImages || !allImagesLoaded) && (
              <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-xl shadow-sm animate-pulse mr-2">
                <Loader2 size={12} className="animate-spin text-indigo-500" />
                {isConvertingImages ? 'Converting images...' : `Loading images (${Object.keys(loadedImages).length}/${formData.images.length})...`}
              </span>
            )}
            {step === 3 ? (
              <>
                <button 
                  onClick={() => handleSaveListing(false)}
                  disabled={loading || isConvertingImages || !allImagesLoaded}
                  className="flex items-center gap-2 px-6 py-3 bg-slate-100 text-slate-700 rounded-2xl font-bold text-xs hover:bg-slate-200 transition-all disabled:opacity-50 cursor-pointer"
                >
                  Save Draft
                </button>
                <button 
                  onClick={() => handleSaveListing(true)}
                  disabled={loading || isConvertingImages || !allImagesLoaded}
                  className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-xs hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 disabled:opacity-50 cursor-pointer"
                >
                  {loading ? 'Working...' : 'Save & Publish to Depop'}
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={loading || isConvertingImages || !allImagesLoaded || (step === 1 && formData.images.length === 0)}
                onClick={nextStep}
                className="h-12 px-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <>
                  Next Step <ChevronLeft size={16} className="rotate-180" />
                </>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateDepopListing;
