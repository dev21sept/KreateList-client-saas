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
  Eye,
  Code,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Package,
  Truck,
  ShieldCheck,
  RefreshCw,
  Box
} from 'lucide-react';
import { ruleService, aiService, listingService, externalImportService, mercariService } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { compressImage } from '../utils/imageCompressor';
import Button from '../components/ui/Button';
import IconButton from '../components/ui/IconButton';
import { Badge } from '../components/ui/Badge';
import CategorySearchDropdown from '../components/CategorySearchDropdown';
import { MERCARI_SIZES_BY_GROUP } from '../constants/mercariSizesTaxonomy';
import { MERCARI_CATEGORY_TREE } from '../constants/mercariTaxonomy';
import { resolveMercariCategory, cleanHtmlDescription } from '../utils/categoryResolver';

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

const MERCARI_CONDITIONS = [
  { id: "new", label: "New (with tags)", description: "Brand new, never used, with original tags/packaging." },
  { id: "like_new", label: "Like New", description: "Excellent condition, no tags but looks and feels brand new." },
  { id: "good", label: "Good", description: "Gently used, minor signs of wear but still in great shape." },
  { id: "fair", label: "Fair", description: "Obvious wear or minor blemishes." },
  { id: "poor", label: "Poor", description: "Heavy wear, obvious flaws or functionality issues." }
];

const mapMercariCondition = (condition) => {
  if (!condition) return 'good';
  const c = String(condition).toLowerCase();
  if (c.includes('new with tag') || c === 'new' || c === '1000' || c === 'brand_new') return 'new';
  if (c.includes('like new') || c.includes('without tag') || c === '1500' || c === 'like_new') return 'like_new';
  if (c.includes('good') || c.includes('very good') || c.includes('pre-owned') || c.includes('preowned') || c === '3000' || c === '4000') return 'good';
  if (c.includes('fair') || c.includes('acceptable') || c === '5000' || c === '6000') return 'fair';
  if (c.includes('poor') || c.includes('flaw') || c.includes('parts') || c === '7000') return 'poor';
  if (['new', 'like_new', 'good', 'fair', 'poor'].includes(c)) return c;
  return 'good';
};

const cleanMercariText = (text) => {
  if (!text) return '';
  return text.replace(/<[^>]*>?/gm, '').trim();
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

  const getInitialSearchTerm = (val) => {
    if (!val) return '';
    const hasChildren = options.some(o => o.label && o.label.startsWith(val + ' > '));
    if (hasChildren) {
      return val + ' > ';
    }
    const lastIndex = val.lastIndexOf(' > ');
    if (lastIndex !== -1) {
      return val.substring(0, lastIndex) + ' > ';
    }
    return '';
  };

  const handleToggle = () => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) {
        setSearchTerm(getInitialSearchTerm(value));
      }
      return next;
    });
  };

  const filteredOptions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) {
      return options.filter(opt => opt.level === undefined || opt.level === 0);
    }

    const hasArrow = q.includes('>');
    if (hasArrow) {
      const normalizedQ = q.replace(/\s*>\s*/g, ' > ');
      return options.filter(opt => {
        const normalizedLabel = (opt.label || '').toLowerCase().replace(/\s*>\s*/g, ' > ');
        return normalizedLabel.startsWith(normalizedQ) || normalizedLabel.includes(normalizedQ);
      });
    }

    return options.filter(opt => {
      const label = String(opt?.label || '').toLowerCase();
      const name = String(opt?.name || '').toLowerCase();
      const desc = String(opt?.description || '').toLowerCase();
      return label.includes(q) || name.includes(q) || desc.includes(q);
    });
  }, [options, searchTerm]);

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={handleToggle}
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
              placeholder="Type to filter categories..."
              className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs font-medium outline-none focus:border-slate-800"
            />
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-50">
            {filteredOptions.length > 0 ? filteredOptions.map((opt) => (
              <button
                key={opt.id || opt.label}
                type="button"
                onClick={() => {
                  const hasChildren = options.some(o => o.label && o.label.startsWith(opt.label + ' > '));
                  if (hasChildren) {
                    setSearchTerm(opt.label + ' > ');
                  } else {
                    onSelect(opt);
                    setIsOpen(false);
                    setSearchTerm('');
                  }
                }}
                className={`w-full text-left px-3.5 py-2.5 hover:bg-slate-100 text-slate-700 hover:text-slate-900 transition-colors flex items-center justify-between text-xs font-semibold ${value === opt.label ? 'bg-slate-100 font-bold text-slate-900' : ''}`}
              >
                <span className="truncate pr-2">{opt.label}</span>
                {value === opt.label && <Check className="w-3.5 h-3.5 text-slate-900 shrink-0" />}
              </button>
            )) : (
              <div className="p-4 text-xs text-slate-400 text-center">No categories found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const CreateMercariListing = ({ isModal = false, editId: propEditId = null, initialListing = null, onClose = null }) => {
  const navigate = useNavigate();
  const { toast } = useNotification();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const editId = propEditId || searchParams.get('edit');
  const platform = 'mercari';

  const [loading, setLoading] = useState(false);
  const [descriptionMode, setDescriptionMode] = useState('edit');
  const [rules, setRules] = useState([]);
  const [files, setFiles] = useState([]);
  const [brandSuggestions, setBrandSuggestions] = useState([]);
  const [isBrandOpen, setIsBrandOpen] = useState(false);
  const brandDropdownRef = useRef(null);
  const [isConvertingImages, setIsConvertingImages] = useState(false);

  const [formData, setFormData] = useState({
    images: [],
    selectedRule: '',
    selectedCondition: 'good',
    title: '',
    brand: '',
    brandId: '',
    originalPrice: '',
    shippingPayer: 'buyer',
    shippingMethod: 'prepaid',
    shippingWeightLbs: 0,
    shippingWeightOz: 8,
    shippingFitsShoebox: true,
    shippingLength: 10,
    shippingWidth: 8,
    shippingHeight: 4,
    shippingCarrier: 'USPS Ground Advantage',
    shippingPrice: '4.99',
    styleTag: '',
    quantity: 1,
    size: '',
    sizeId: '',
    category: '',
    categoryId: '',
    price: '',
    description: '',
    conditionNote: '',
    sku: '',
    selectedModel: 'gpt-4o-mini'
  });

  const categoryOptions = useMemo(() => {
    const buildPaths = (nodes, currentPath = [], acc = []) => {
      nodes.forEach(node => {
        const path = [...currentPath, node.name];
        acc.push({
          id: String(node.id),
          label: path.join(' > '),
          name: node.name,
          level: node.level,
          itemSizeGroupId: node.itemSizeGroupId || 0
        });
        if (node.children && node.children.length > 0) {
          buildPaths(node.children, path, acc);
        }
      });
      return acc;
    };
    return buildPaths(MERCARI_CATEGORY_TREE);
  }, []);

  const carrierOptions = useMemo(() => {
    const lbs = Number(formData.shippingWeightLbs) || 0;
    const oz = Number(formData.shippingWeightOz) || 0;
    const totalOz = (lbs * 16) + oz;
    
    const length = Number(formData.shippingLength) || 0;
    const width = Number(formData.shippingWidth) || 0;
    const height = Number(formData.shippingHeight) || 0;
    const isLarge = !formData.shippingFitsShoebox && (length >= 15 || width >= 15 || height >= 15 || (length * width * height) >= 3375);

    if (isLarge) {
      return [
        { carrier: 'UPS Ground', weightText: '5 lb', price: '11.50', warning: 'Large package (exceeds 15"). USPS Ground Advantage and UPS Ground Saver are restricted due to size limits. UPS Ground is recommended.' },
        { carrier: 'FedEx Ground', weightText: '5 lb', price: '11.50', warning: 'Large package (exceeds 15"). USPS Ground Advantage and UPS Ground Saver are restricted due to size limits. FedEx Ground is recommended.' }
      ];
    }

    const options = [];
    
    // USPS Ground Advantage
    if (totalOz <= 4) options.push({ carrier: 'USPS Ground Advantage', weightText: '4 oz', price: '4.30' });
    else if (totalOz <= 8) options.push({ carrier: 'USPS Ground Advantage', weightText: '8 oz', price: '4.99' });
    else if (totalOz <= 12) options.push({ carrier: 'USPS Ground Advantage', weightText: '12 oz', price: '5.40' });
    else if (totalOz <= 16) options.push({ carrier: 'USPS Ground Advantage', weightText: '1 lb', price: '7.48' });
    else if (totalOz <= 32) options.push({ carrier: 'USPS Ground Advantage', weightText: '2 lb', price: '8.50' });

    // UPS Ground Saver
    if (totalOz <= 16) options.push({ carrier: 'UPS Ground Saver', weightText: '1 lb', price: '7.20' });
    else if (totalOz <= 32) options.push({ carrier: 'UPS Ground Saver', weightText: '2 lb', price: '7.97' });

    // FedEx Ground Economy
    if (totalOz <= 48) options.push({ carrier: 'FedEx Ground Economy', weightText: '3 lb', price: '8.99' });

    // UPS Ground
    if (totalOz <= 80) options.push({ carrier: 'UPS Ground', weightText: '5 lb', price: '11.50' });
    else options.push({ carrier: 'UPS Ground', weightText: `${Math.max(5, Math.ceil(totalOz/16))} lb`, price: '15.00' });

    return options;
  }, [formData.shippingWeightLbs, formData.shippingWeightOz, formData.shippingFitsShoebox, formData.shippingLength, formData.shippingWidth, formData.shippingHeight]);

  useEffect(() => {
    if (formData.shippingPayer === 'buyer' && carrierOptions.length > 0) {
      const exists = carrierOptions.some(c => c.carrier === formData.shippingCarrier);
      if (!exists) {
        setFormData(prev => ({ 
          ...prev, 
          shippingCarrier: carrierOptions[0].carrier,
          shippingPrice: carrierOptions[0].price
        }));
      }
    }
  }, [carrierOptions, formData.shippingPayer]);

  const activeSizeOptions = useMemo(() => {
    if (formData.category) {
      const selectedCat = categoryOptions.find(opt => opt.label === formData.category || opt.name === formData.category);
      if (selectedCat && selectedCat.itemSizeGroupId && MERCARI_SIZES_BY_GROUP[selectedCat.itemSizeGroupId]?.length > 0) {
        return MERCARI_SIZES_BY_GROUP[selectedCat.itemSizeGroupId];
      }
    }
    const catLower = (formData.category || '').toLowerCase();
    if (catLower.startsWith('women')) {
      return MERCARI_SIZES_BY_GROUP['1'] || [];
    }
    if (catLower.startsWith('kids')) {
      return MERCARI_SIZES_BY_GROUP['8'] || [];
    }
    return MERCARI_SIZES_BY_GROUP['4'] || MERCARI_SIZES_BY_GROUP['1'] || [];
  }, [formData.category, categoryOptions]);

  const modelOptions = useMemo(() => [
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini (OpenAI)', description: 'Fast, cost-efficient model' },
    { id: 'gpt-4o', label: 'GPT-4o (OpenAI)', description: 'High-accuracy model' },
    { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (Google)', description: 'Fast Google AI model' },
    { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (Google)', description: 'Intelligent Google AI model' },
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (Google)', description: 'Ultra-fast Google AI model' }
  ], []);

  useEffect(() => {
    const fetchRules = async () => {
      try {
        const response = await ruleService.getAll();
        if (response.data.success) {
          const rulesData = response.data.data;
          setRules(rulesData);
          if (rulesData.length > 0 && !formData.selectedRule) {
            setFormData(prev => ({ ...prev, selectedRule: rulesData[0]._id || rulesData[0].id }));
          }
        }
      } catch (error) {
        console.error("Error fetching rules:", error);
      }
    };

    const loadData = async () => {
      await fetchRules();

      if (initialListing) {
        const mData = initialListing.platformData?.mercari || (initialListing.platform === 'mercari' ? initialListing : {});
        setFormData(prev => ({
          ...prev,
          images: initialListing.images || [],
          title: mData.title || initialListing.title || '',
          brand: mData.brand || initialListing.brand || '',
          brandId: mData.brandId || '',
          originalPrice: mData.originalPrice || initialListing.originalPrice || '',
          shippingPayer: mData.shippingPayer || 'buyer',
          shippingMethod: mData.shippingMethod || 'prepaid',
          shippingWeightLbs: mData.shippingWeightLbs !== undefined ? mData.shippingWeightLbs : 0,
          shippingWeightOz: mData.shippingWeightOz !== undefined ? mData.shippingWeightOz : 8,
          shippingFitsShoebox: mData.shippingFitsShoebox !== undefined ? mData.shippingFitsShoebox : true,
          shippingLength: mData.shippingLength || 10,
          shippingWidth: mData.shippingWidth || 8,
          shippingHeight: mData.shippingHeight || 4,
          shippingCarrier: mData.shippingCarrier || 'USPS Ground Advantage',
          shippingPrice: mData.shippingPrice || '4.99',
          styleTag: mData.styleTag || '',
          quantity: mData.quantity || 1,
          size: mData.size || initialListing.size || '',
          sizeId: mData.sizeId || '',
          category: mData.category || (initialListing.platform === 'mercari' ? initialListing.category : '') || '',
          categoryId: mData.categoryId || '',
          price: mData.price !== undefined ? mData.price : (initialListing.price || ''),
          description: cleanMercariText(mData.description || initialListing.description || ''),
          selectedCondition: mapMercariCondition(mData.selectedCondition || mData.condition || initialListing.condition),
          sku: mData.sku || initialListing.sku || ''
        }));
      }

      const targetDbId = editId || initialListing?._id || initialListing?.id;
      if (targetDbId && !String(targetDbId).startsWith('mock-')) {
        setLoading(true);
        try {
          const res = await listingService.getOne(targetDbId);
          if (res.data?.success && res.data?.data) {
            const rawListing = res.data.data;
            const mData = rawListing.platformData?.mercari || (rawListing.platform === 'mercari' ? rawListing : {});
            
            const allImages = (rawListing.images && rawListing.images.length > 0) ? rawListing.images : (mData.images || []);

            setFormData(prev => ({
              ...prev,
              images: allImages.length > 0 ? allImages : prev.images,
              selectedRule: mData.selectedRule || rawListing.selectedRule || prev.selectedRule,
              selectedCondition: mapMercariCondition(mData.selectedCondition || mData.condition || rawListing.condition || prev.selectedCondition),
              title: mData.title || rawListing.title || prev.title,
              brand: mData.brand || rawListing.brand || prev.brand,
              brandId: mData.brandId || rawListing.brandId || prev.brandId,
              originalPrice: mData.originalPrice || rawListing.originalPrice || prev.originalPrice,
              shippingPayer: mData.shippingPayer || rawListing.shippingPayer || 'buyer',
              shippingMethod: mData.shippingMethod || rawListing.shippingMethod || 'prepaid',
              shippingWeightLbs: mData.shippingWeightLbs !== undefined ? mData.shippingWeightLbs : 0,
              shippingWeightOz: mData.shippingWeightOz !== undefined ? mData.shippingWeightOz : 8,
              shippingFitsShoebox: mData.shippingFitsShoebox !== undefined ? mData.shippingFitsShoebox : true,
              shippingLength: mData.shippingLength || 10,
              shippingWidth: mData.shippingWidth || 8,
              shippingHeight: mData.shippingHeight || 4,
              shippingCarrier: mData.shippingCarrier || 'USPS Ground Advantage',
              shippingPrice: mData.shippingPrice || '4.99',
              styleTag: mData.styleTag || '',
              quantity: mData.quantity || 1,
              size: mData.size || rawListing.size || prev.size,
              sizeId: mData.sizeId || prev.sizeId,
              category: resolveMercariCategory(
                mData.category || (rawListing.platform === 'mercari' ? rawListing.category : '') || prev.category,
                rawListing.title || prev.title,
                mData.brand || rawListing.brand || prev.brand
              ).category,
              categoryId: mData.categoryId || (rawListing.platform === 'mercari' ? rawListing.categoryId : '') || resolveMercariCategory(
                mData.category || (rawListing.platform === 'mercari' ? rawListing.category : '') || prev.category,
                rawListing.title || prev.title,
                mData.brand || rawListing.brand || prev.brand
              ).categoryId,
              price: mData.price !== undefined ? mData.price : (rawListing.price || prev.price),
              description: cleanMercariText(mData.description || rawListing.description || prev.description),
              conditionNote: mData.conditionNote || rawListing.conditionNote || prev.conditionNote,
              sku: mData.sku || rawListing.sku || prev.sku
            }));
          }
        } catch (error) {
          console.error("Error fetching listing:", error);
        } finally {
          setLoading(false);
        }
      }
    };

    loadData();
  }, [editId, initialListing]);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (brandDropdownRef.current && !brandDropdownRef.current.contains(e.target)) {
        setIsBrandOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const triggerBrandSearch = async (value) => {
    setIsBrandOpen(true);
    if (!value.trim()) {
      setBrandSuggestions(POPULAR_BRANDS);
      return;
    }
    try {
      const response = await mercariService.suggestBrands(value);
      if (response.data && response.data.success && response.data.brands) {
        setBrandSuggestions(response.data.brands);
      }
    } catch (err) {
      console.warn("Backend brand autocomplete fetch failed:", err);
    }
  };

  const handleBrandChange = (e) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, brand: value }));
    triggerBrandSearch(value);
  };

  const handleImageUpload = async (e) => {
    const uploadedFiles = Array.from(e.target.files);
    setFiles(prev => [...prev, ...uploadedFiles]);
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
      toast.warning("Please upload at least one product image.");
      return;
    }
    if (!formData.selectedRule) {
      toast.warning("Please select an AI Listing Rule.");
      return;
    }

    setLoading(true);
    const selectedRuleObj = rules.find(r => (r._id || r.id) === formData.selectedRule);

    try {
      const response = await aiService.mercariAnalyze({
        images: formData.images, 
        title_sequence: selectedRuleObj?.title_sequence || [],
        description_prompt: selectedRuleObj?.description_prompt || '',
        description_template: selectedRuleObj?.description_template || '',
        condition_note: selectedRuleObj?.condition_note || '',
        condition_name: formData.selectedCondition,
        model: formData.selectedModel || 'gpt-4o-mini',
        existing_title: formData.title || ''
      });

      if (response.data.success) {
        const result = response.data.data;
        const resolvedMercari = resolveMercariCategory(
          result.mercari_category_name || result.category_name || result.category || '',
          result.title || formData.title,
          result.brand || formData.brand
        );
        setFormData(prev => ({
          ...prev,
          title: result.title || prev.title,
          brand: result.brand || prev.brand,
          brandId: result.brandId || prev.brandId,
          originalPrice: result.originalPrice || prev.originalPrice,
          styleTag: result.styleTag || prev.styleTag,
          quantity: 1,
          size: result.size || prev.size,
          price: result.price || prev.price,
          description: cleanMercariText(result.description || prev.description),
          category: result.mercari_category_name || resolvedMercari.category || result.category_name || prev.category,
          categoryId: result.mercari_category_id || result.category_id || resolvedMercari.categoryId || prev.categoryId,
          sku: result.sku || prev.sku
        }));
        toast.success("AI scanning complete! Listing details updated.");
      }
    } catch (error) {
      console.error("AI Analysis Error:", error);
      toast.error("Failed to analyze listing with AI.");
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
        platform: 'mercari',
        images: formData.images,
        selectedRule: formData.selectedRule,
        selectedCondition: formData.selectedCondition,
        title: formData.title,
        brand: formData.brand,
        brandId: formData.brandId,
        originalPrice: formData.originalPrice,
        shippingPayer: formData.shippingPayer,
        shippingMethod: formData.shippingMethod,
        shippingWeightLbs: Number(formData.shippingWeightLbs) || 0,
        shippingWeightOz: Number(formData.shippingWeightOz) || 0,
        shippingFitsShoebox: formData.shippingFitsShoebox,
        shippingLength: Number(formData.shippingLength) || 0,
        shippingWidth: Number(formData.shippingWidth) || 0,
        shippingHeight: Number(formData.shippingHeight) || 0,
        shippingCarrier: formData.shippingCarrier,
        shippingPrice: formData.shippingPrice,
        styleTag: formData.styleTag,
        quantity: formData.quantity,
        size: formData.size,
        sizeId: formData.sizeId,
        category: formData.category,
        categoryId: formData.categoryId,
        price: formData.price,
        description: formData.description,
        conditionNote: formData.conditionNote,
        sku: formData.sku,
        platformData: {
          mercari: {
            title: formData.title,
            brand: formData.brand,
            brandId: formData.brandId,
            category: formData.category,
            categoryId: formData.categoryId,
            price: formData.price,
            originalPrice: formData.originalPrice,
            size: formData.size,
            sizeId: formData.sizeId,
            selectedCondition: formData.selectedCondition,
            shippingPayer: formData.shippingPayer,
            shippingMethod: formData.shippingMethod,
            shippingWeightLbs: formData.shippingWeightLbs,
            shippingWeightOz: formData.shippingWeightOz,
            shippingFitsShoebox: formData.shippingFitsShoebox,
            shippingLength: formData.shippingLength,
            shippingWidth: formData.shippingWidth,
            shippingHeight: formData.shippingHeight,
            shippingCarrier: formData.shippingCarrier,
            shippingPrice: formData.shippingPrice,
            sku: formData.sku,
            description: formData.description
          }
        }
      };

      let listingIdResult = editId;

      if (editId) {
        await listingService.update(editId, payload);
        toast.success("Mercari listing updated successfully!");
      } else {
        const res = await listingService.create(payload);
        listingIdResult = res.data?.data?._id;
        toast.success("Saved as draft successfully!");
      }

      if (publishMode === 'direct') {
        toast.info("Listing to Mercari via Direct API...");
        const pubRes = await externalImportService.publish(listingIdResult, { platform: 'mercari' });
        if (pubRes.data?.success) {
          toast.success("Successfully published to Mercari!");
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

  // Fee calculation
  const numericPrice = parseFloat(formData.price) || 0;
  const sellingFee = numericPrice * 0.10;
  const processingFee = numericPrice > 0 ? (numericPrice * 0.029) + 0.50 : 0;
  const shippingDeduction = (formData.shippingPayer === 'seller' && formData.shippingMethod === 'prepaid') ? (parseFloat(formData.shippingPrice) || 0) : 0;
  const netEarnings = Math.max(0, numericPrice - sellingFee - processingFee - shippingDeduction);

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
            <img src="/mercari.png" className="w-6 h-6 object-contain" alt="Mercari" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">
                {editId ? 'Edit Mercari Listing' : 'Create Mercari Listing'}
              </h1>
              <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-bold rounded-md uppercase">
                Mercari
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Configure product details, category, pricing, and full Mercari shipping carrier matrix
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
            {editId ? 'Update & List' : 'List on Mercari'}
          </Button>
        </div>
      </div>

      {/* Main 2-Column Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Photos & AI Scanner (Sticky on Desktop) */}
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

            {/* Photo Upload Zone if empty */}
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
              /* Compact 4-Column Photo Grid */
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

                    {/* Hover Actions */}
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
                  placeholder="Select prefill rule..."
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Condition</label>
                  <SearchableDropdown 
                    value={MERCARI_CONDITIONS.find(c => c.id === formData.selectedCondition)?.label}
                    onSelect={(opt) => setFormData(prev => ({ ...prev, selectedCondition: opt.id }))}
                    options={MERCARI_CONDITIONS}
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

        {/* RIGHT COLUMN: Form Fields & Shipping Matrix */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Section 1: Listing Details */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              Listing Details
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

            {/* Category Full Path */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Category (Full Taxonomy Path) *</label>
              <CategorySearchDropdown 
                value={formData.category}
                platform="mercari"
                onSelect={(opt) => setFormData(prev => ({ 
                  ...prev, 
                  category: opt.fullName || opt.label || opt.name, 
                  categoryId: String(opt.id || opt.categoryId || '') 
                }))}
                placeholder="Search and select full category hierarchy (e.g. Men > Athletic apparel > Athletic T-Shirts)..."
              />
            </div>

            {/* Brand, Condition, Size */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Brand Autocomplete */}
              <div className="relative" ref={brandDropdownRef}>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Brand</label>
                <input 
                  type="text"
                  className="w-full px-3 h-10 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-slate-800"
                  value={formData.brand}
                  onChange={handleBrandChange}
                  onFocus={() => triggerBrandSearch(formData.brand)}
                  placeholder="e.g. Nike, Adidas..."
                />
                {isBrandOpen && brandSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 shadow-xl rounded-xl z-[9999] py-1 text-xs">
                    {brandSuggestions.map((b) => (
                      <button
                        key={b.id || b.name}
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, brand: b.name, brandId: String(b.id || '') }));
                          setIsBrandOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-slate-100 text-slate-700 font-semibold truncate"
                      >
                        {b.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Condition */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Condition *</label>
                <SearchableDropdown 
                  value={MERCARI_CONDITIONS.find(c => c.id === formData.selectedCondition)?.label}
                  onSelect={(opt) => setFormData(prev => ({ ...prev, selectedCondition: opt.id }))}
                  options={MERCARI_CONDITIONS}
                  placeholder="Select condition..."
                />
              </div>

              {/* Size */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Size</label>
                {activeSizeOptions.length > 0 ? (
                  <SearchableDropdown 
                    value={activeSizeOptions.find(s => String(s.id) === String(formData.sizeId) || s.name === formData.size)?.name || formData.size}
                    onSelect={(opt) => setFormData(prev => ({ ...prev, size: opt.label || opt.name, sizeId: String(opt.id || '') }))}
                    options={activeSizeOptions.map(s => ({ id: s.id, label: s.name }))}
                    placeholder="Select size..."
                  />
                ) : (
                  <input 
                    type="text"
                    className="w-full px-3 h-10 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-slate-800"
                    value={formData.size}
                    onChange={(e) => setFormData(prev => ({ ...prev, size: e.target.value }))}
                    placeholder="e.g. Medium, 10, One Size"
                  />
                )}
              </div>
            </div>

            {/* Price, Original Price & SKU */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Listing Price ($) *</label>
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
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Original Retail Price ($)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">$</span>
                  <input 
                    type="number"
                    step="0.01"
                    className="w-full pl-7 pr-3 h-10 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-slate-800"
                    value={formData.originalPrice}
                    onChange={(e) => setFormData(prev => ({ ...prev, originalPrice: e.target.value }))}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">SKU / Custom Tag</label>
                <input 
                  type="text"
                  className="w-full px-3 h-10 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-slate-800"
                  value={formData.sku}
                  onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                  placeholder="Optional SKU"
                />
              </div>
            </div>

            {/* Fee Payout Calculator Bar */}
            {numericPrice > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between text-xs font-medium text-slate-600 gap-2">
                <div>Listing: <span className="font-bold text-slate-900">${numericPrice.toFixed(2)}</span></div>
                <div>Selling Fee (10%): <span className="font-bold text-slate-900">-${sellingFee.toFixed(2)}</span></div>
                <div>Processing Fee: <span className="font-bold text-slate-900">-${processingFee.toFixed(2)}</span></div>
                {shippingDeduction > 0 && (
                  <div>Shipping: <span className="font-bold text-slate-900">-${shippingDeduction.toFixed(2)}</span></div>
                )}
                <div className="border-l border-slate-200 pl-3">
                  Est. Net Payout: <span className="font-extrabold text-slate-900 text-sm">${netEarnings.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Description */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h2 className="text-sm font-bold text-slate-900">Description</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDescriptionMode(prev => prev === 'edit' ? 'preview' : 'edit')}
                  className="text-[11px] font-bold text-slate-600 hover:text-slate-900 px-2 py-1 bg-slate-100 rounded-lg"
                >
                  {descriptionMode === 'edit' ? 'Preview' : 'Edit'}
                </button>
              </div>
            </div>

            {descriptionMode === 'edit' ? (
              <textarea 
                rows={6}
                className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-slate-800 leading-relaxed"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe your item in detail (size, condition, flaws, features)..."
              />
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 whitespace-pre-wrap min-h-[140px] leading-relaxed">
                {formData.description || <span className="text-slate-400 italic">No description entered</span>}
              </div>
            )}
          </div>

          {/* Section 3: Comprehensive Mercari Shipping Matrix */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <Truck size={16} className="text-slate-700" />
                <h2 className="text-sm font-bold text-slate-900">Mercari Shipping & Package Details</h2>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">Dynamic Carrier Calculation</span>
            </div>

            {/* Step 1: Who Pays for Shipping? */}
            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                1. Who pays for shipping?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label 
                  className={`p-3.5 rounded-xl border cursor-pointer flex items-center gap-3 transition-all ${
                    formData.shippingPayer === 'buyer' ? 'bg-slate-50 border-slate-900 ring-1 ring-slate-900' : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input 
                    type="radio" 
                    name="shippingPayer" 
                    value="buyer"
                    checked={formData.shippingPayer === 'buyer'}
                    onChange={() => setFormData(prev => ({ ...prev, shippingPayer: 'buyer' }))}
                    className="text-slate-900 focus:ring-slate-900"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-900">Buyer pays</div>
                    <div className="text-[10px] text-slate-500">Shipping cost is added to the buyer's total at checkout</div>
                  </div>
                </label>

                <label 
                  className={`p-3.5 rounded-xl border cursor-pointer flex items-center gap-3 transition-all ${
                    formData.shippingPayer === 'seller' ? 'bg-slate-50 border-slate-900 ring-1 ring-slate-900' : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input 
                    type="radio" 
                    name="shippingPayer" 
                    value="seller"
                    checked={formData.shippingPayer === 'seller'}
                    onChange={() => setFormData(prev => ({ ...prev, shippingPayer: 'seller' }))}
                    className="text-slate-900 focus:ring-slate-900"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-900">I'll pay (Free shipping)</div>
                    <div className="text-[10px] text-slate-500">Free shipping to the buyer; shipping fee is deducted from your payout</div>
                  </div>
                </label>
              </div>
            </div>

            {/* Step 2: Shipping Method */}
            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                2. Shipping Method
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label 
                  className={`p-3.5 rounded-xl border cursor-pointer flex items-center gap-3 transition-all ${
                    formData.shippingMethod === 'prepaid' ? 'bg-slate-50 border-slate-900 ring-1 ring-slate-900' : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input 
                    type="radio" 
                    name="shippingMethod" 
                    value="prepaid"
                    checked={formData.shippingMethod === 'prepaid'}
                    onChange={() => setFormData(prev => ({ ...prev, shippingMethod: 'prepaid' }))}
                    className="text-slate-900 focus:ring-slate-900"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      Mercari Prepaid Label
                      <ShieldCheck size={12} className="text-slate-700" />
                    </div>
                    <div className="text-[10px] text-slate-500">Includes tracking and up to $200 Mercari Shipping Protection</div>
                  </div>
                </label>

                <label 
                  className={`p-3.5 rounded-xl border cursor-pointer flex items-center gap-3 transition-all ${
                    formData.shippingMethod === 'ship_on_your_own' ? 'bg-slate-50 border-slate-900 ring-1 ring-slate-900' : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input 
                    type="radio" 
                    name="shippingMethod" 
                    value="ship_on_your_own"
                    checked={formData.shippingMethod === 'ship_on_your_own'}
                    onChange={() => setFormData(prev => ({ 
                      ...prev, 
                      shippingMethod: 'ship_on_your_own',
                      shippingPayer: 'seller',
                      shippingCarrier: 'Ship on your own',
                      shippingPrice: '0.00'
                    }))}
                    className="text-slate-900 focus:ring-slate-900"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-900">Ship on your own</div>
                    <div className="text-[10px] text-slate-500">You purchase your own postage. Always free shipping for buyer.</div>
                  </div>
                </label>
              </div>
            </div>

            {/* Prepaid Package Weight, Dimensions & Dynamic Carrier Cards */}
            {formData.shippingMethod === 'prepaid' && (
              <div className="space-y-4 pt-2 border-t border-slate-100">
                {/* Weight & Standard Shoebox */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Package Weight *
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="relative">
                        <input 
                          type="number"
                          min="0"
                          className="w-full px-3 pr-8 h-10 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-slate-800"
                          value={formData.shippingWeightLbs}
                          onChange={(e) => setFormData(prev => ({ ...prev, shippingWeightLbs: Math.max(0, parseInt(e.target.value) || 0) }))}
                        />
                        <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-semibold">lbs</span>
                      </div>
                      <div className="relative">
                        <input 
                          type="number"
                          min="0"
                          max="15"
                          className="w-full px-3 pr-8 h-10 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-slate-800"
                          value={formData.shippingWeightOz}
                          onChange={(e) => setFormData(prev => ({ ...prev, shippingWeightOz: Math.max(0, parseInt(e.target.value) || 0) }))}
                        />
                        <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-semibold">oz</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Package Format
                    </label>
                    <label className="flex items-center gap-2.5 h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={formData.shippingFitsShoebox}
                        onChange={(e) => setFormData(prev => ({ ...prev, shippingFitsShoebox: e.target.checked }))}
                        className="rounded text-slate-900 focus:ring-slate-900"
                      />
                      <span className="text-xs font-bold text-slate-700">Fits standard shoe box (14x10x5 in)</span>
                    </label>
                  </div>
                </div>

                {/* Custom Dimensions if not standard shoe box */}
                {!formData.shippingFitsShoebox && (
                  <div className="space-y-1.5 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <label className="block text-[10px] font-bold text-slate-600 uppercase">
                      Custom Dimensions (L x W x H in inches)
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="relative">
                        <input 
                          type="number"
                          min="1"
                          placeholder="L"
                          className="w-full px-3 pr-6 h-9 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-slate-800"
                          value={formData.shippingLength}
                          onChange={(e) => setFormData(prev => ({ ...prev, shippingLength: parseInt(e.target.value) || 0 }))}
                        />
                        <span className="absolute right-2 top-2 text-[10px] text-slate-400">in</span>
                      </div>
                      <div className="relative">
                        <input 
                          type="number"
                          min="1"
                          placeholder="W"
                          className="w-full px-3 pr-6 h-9 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-slate-800"
                          value={formData.shippingWidth}
                          onChange={(e) => setFormData(prev => ({ ...prev, shippingWidth: parseInt(e.target.value) || 0 }))}
                        />
                        <span className="absolute right-2 top-2 text-[10px] text-slate-400">in</span>
                      </div>
                      <div className="relative">
                        <input 
                          type="number"
                          min="1"
                          placeholder="H"
                          className="w-full px-3 pr-6 h-9 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-slate-800"
                          value={formData.shippingHeight}
                          onChange={(e) => setFormData(prev => ({ ...prev, shippingHeight: parseInt(e.target.value) || 0 }))}
                        />
                        <span className="absolute right-2 top-2 text-[10px] text-slate-400">in</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 4: Dynamic Carrier Selection Cards */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                      Select Shipping Carrier & Rate *
                    </label>
                    <span className="text-[10px] text-slate-500 font-semibold">
                      Weight: {((Number(formData.shippingWeightLbs) || 0) * 16) + (Number(formData.shippingWeightOz) || 0)} oz total
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {carrierOptions.map((opt) => {
                      const isSelected = formData.shippingCarrier === opt.carrier;
                      return (
                        <div 
                          key={opt.carrier}
                          onClick={() => setFormData(prev => ({ ...prev, shippingCarrier: opt.carrier, shippingPrice: opt.price }))}
                          className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between h-24 ${
                            isSelected 
                              ? 'bg-slate-50 border-slate-900 ring-1 ring-slate-900' 
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <span className="text-xs font-bold text-slate-900 leading-tight">{opt.carrier}</span>
                            {isSelected && <Check size={14} className="text-slate-900 shrink-0" />}
                          </div>
                          <div className="flex items-end justify-between mt-2">
                            <span className="text-[10px] font-semibold text-slate-500 uppercase">Up to {opt.weightText}</span>
                            <span className="text-sm font-extrabold text-slate-900">${opt.price}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Carrier Warning Alerts */}
                  {carrierOptions.some(o => o.warning && o.carrier === formData.shippingCarrier) && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-xl text-xs font-medium flex items-start gap-2">
                      <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
                      <span>{carrierOptions.find(o => o.warning && o.carrier === formData.shippingCarrier).warning}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {formData.shippingMethod === 'ship_on_your_own' && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
                <span className="font-bold text-slate-800">Note:</span> You will provide your own carrier postage label outside Mercari. The listing will be shown as Free Shipping to the buyer. Mercari shipping protection is not included.
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => handleSaveListing(null)}
              disabled={loading}
            >
              Save as Draft
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => handleSaveListing('direct')}
              loading={loading}
              icon={<Zap size={14} />}
            >
              {editId ? 'Update Mercari Listing' : 'List on Mercari'}
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default CreateMercariListing;
