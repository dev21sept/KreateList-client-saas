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
  Palette,
  Package,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';
import { ruleService, aiService, listingService, externalImportService } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { compressImage } from '../utils/imageCompressor';
import Button from '../components/ui/Button';
import IconButton from '../components/ui/IconButton';
import { Badge } from '../components/ui/Badge';
import { POSHMARK_CONDITIONS } from '../constants/poshmarkConditions';

const POSHMARK_COLORS = [
  'Red', 'Pink', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple', 'Gold', 'Silver', 'Black', 'Gray', 'White', 'Cream', 'Brown', 'Tan'
];

const POSHMARK_DEPARTMENTS = [
  { id: 'Women', label: 'Women' },
  { id: 'Men', label: 'Men' },
  { id: 'Kids', label: 'Kids' },
  { id: 'Home', label: 'Home' },
  { id: 'Pets', label: 'Pets' }
];

const POSHMARK_SHIPPING_DISCOUNTS = [
  { id: '', label: 'No discount (Buyer pays $7.97)' },
  { id: '5.95', label: '$5.95 (You cover $2.02)' },
  { id: '4.99', label: '$4.99 (You cover $2.98)' },
  { id: '0.00', label: 'Free shipping (You cover $7.97)' }
];

const POPULAR_BRANDS = [
  { id: 4578, name: "Nike" },
  { id: 54, name: "Adidas" },
  { id: 3370, name: "Jordan" },
  { id: 115, name: "Air Jordan" },
  { id: 3778, name: "Levi's" },
  { id: 969, name: "Carhartt" },
  { id: 4867, name: "Patagonia" },
  { id: 5212, name: "Polo Ralph Lauren" },
  { id: 5971, name: "The North Face" },
  { id: 6223, name: "Under Armour" },
  { id: 7777, name: "Lululemon" },
  { id: 8888, name: "Zara" }
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

const CreatePoshmarkListing = ({ isModal = false, editId: propEditId = null, initialListing = null, onClose = null }) => {
  const navigate = useNavigate();
  const { toast } = useNotification();
  const [searchParams] = useSearchParams();
  const editId = propEditId || searchParams.get('edit');
  const platform = 'poshmark';

  const [loading, setLoading] = useState(false);
  const [descriptionMode, setDescriptionMode] = useState('edit');
  const [rules, setRules] = useState([]);
  const [isConvertingImages, setIsConvertingImages] = useState(false);

  // Brand autocomplete
  const [brandSuggestions, setBrandSuggestions] = useState([]);
  const [isBrandOpen, setIsBrandOpen] = useState(false);
  const brandDropdownRef = useRef(null);

  // Style tags chip input
  const [tagInput, setTagInput] = useState('');

  const [formData, setFormData] = useState({
    images: [],
    selectedRule: '',
    selectedCondition: 'Good',
    title: '',
    department: 'Women',
    category: '',
    subcategory: '',
    brand: '',
    size: '',
    colors: [],
    styleTags: [],
    originalPrice: '',
    price: '',
    shippingDiscount: '',
    description: '',
    sku: '',
    quantity: '1',
    selectedModel: 'gpt-4o-mini'
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
        const rulesRes = await ruleService.getAll();
        if (rulesRes.data?.success) {
          const rulesData = rulesRes.data.data;
          setRules(rulesData);
          if (rulesData.length > 0 && !formData.selectedRule) {
            setFormData(prev => ({ ...prev, selectedRule: rulesData[0]._id || rulesData[0].id }));
          }
        }
      } catch (err) {
        console.error("Failed to load rules:", err);
      }

      if (initialListing) {
        const pData = initialListing.platformData?.poshmark || (initialListing.platform === 'poshmark' ? initialListing : {});
        setFormData(prev => ({
          ...prev,
          images: initialListing.images || [],
          title: pData.title || initialListing.title || '',
          price: pData.price !== undefined ? pData.price : (initialListing.price || ''),
          originalPrice: pData.originalPrice || initialListing.originalPrice || '',
          description: pData.description || initialListing.description || '',
          category: pData.category || (initialListing.platform === 'poshmark' ? initialListing.category : '') || '',
          subcategory: pData.subcategory || '',
          department: pData.department || 'Women',
          brand: pData.brand || initialListing.brand || '',
          size: pData.size || initialListing.size || '',
          colors: Array.isArray(pData.colors) ? pData.colors : (pData.color ? [pData.color] : []),
          styleTags: Array.isArray(pData.styleTags) ? pData.styleTags : (pData.styleTag ? [pData.styleTag] : []),
          shippingDiscount: pData.shippingDiscount || '',
          selectedCondition: pData.selectedCondition || pData.condition || 'Good',
          sku: pData.sku || initialListing.sku || ''
        }));
      }

      const targetDbId = editId || initialListing?._id || initialListing?.id;
      if (targetDbId && !String(targetDbId).startsWith('mock-')) {
        setLoading(true);
        try {
          const res = await listingService.getOne(targetDbId);
          if (res.data?.success && res.data?.data) {
            const raw = res.data.data;
            const pData = raw.platformData?.poshmark || (raw.platform === 'poshmark' ? raw : {});
            setFormData(prev => ({
              ...prev,
              images: (raw.images && raw.images.length > 0) ? raw.images : (pData.images || []),
              title: pData.title || raw.title || prev.title,
              price: pData.price !== undefined ? pData.price : (raw.price || prev.price),
              originalPrice: pData.originalPrice || raw.originalPrice || prev.originalPrice,
              description: pData.description || raw.description || prev.description,
              category: pData.category || (raw.platform === 'poshmark' ? raw.category : '') || prev.category,
              subcategory: pData.subcategory || prev.subcategory,
              department: pData.department || prev.department,
              brand: pData.brand || raw.brand || prev.brand,
              size: pData.size || raw.size || prev.size,
              colors: Array.isArray(pData.colors) ? pData.colors : (pData.color ? [pData.color] : prev.colors),
              styleTags: Array.isArray(pData.styleTags) ? pData.styleTags : (pData.styleTag ? [pData.styleTag] : prev.styleTags),
              shippingDiscount: pData.shippingDiscount || prev.shippingDiscount,
              selectedCondition: pData.selectedCondition || pData.condition || raw.condition || prev.selectedCondition,
              sku: pData.sku || raw.sku || prev.sku
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

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (brandDropdownRef.current && !brandDropdownRef.current.contains(e.target)) {
        setIsBrandOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const triggerBrandSearch = (value) => {
    setIsBrandOpen(true);
    if (!value.trim()) {
      setBrandSuggestions(POPULAR_BRANDS);
      return;
    }
    const filtered = POPULAR_BRANDS.filter(b => b.name.toLowerCase().includes(value.toLowerCase()));
    setBrandSuggestions(filtered);
  };

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
      const response = await aiService.poshmarkAnalyze({
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
        setFormData(prev => ({
          ...prev,
          title: result.title || prev.title,
          brand: result.brand || prev.brand,
          price: result.price || prev.price,
          originalPrice: result.originalPrice || prev.originalPrice,
          description: result.description || prev.description,
          category: result.category_name || result.category || prev.category,
          subcategory: result.subcategory || prev.subcategory,
          department: result.department || prev.department,
          size: result.size || prev.size,
          colors: Array.isArray(result.colors) ? result.colors : (result.color ? [result.color] : prev.colors),
          styleTags: Array.isArray(result.style_tags) ? result.style_tags : (result.styleTag ? [result.styleTag] : prev.styleTags),
          sku: result.sku || prev.sku
        }));
        toast.success("AI scanning complete! Poshmark details prefilled.");
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

  const toggleColor = (color) => {
    setFormData(prev => {
      const current = prev.colors || [];
      if (current.includes(color)) {
        return { ...prev, colors: current.filter(c => c !== color) };
      }
      if (current.length >= 2) {
        toast.warning("Poshmark allows a maximum of 2 colors.");
        return prev;
      }
      return { ...prev, colors: [...current, color] };
    });
  };

  const addStyleTag = (tag) => {
    const cleanTag = tag.trim();
    if (!cleanTag) return;
    setFormData(prev => {
      const current = prev.styleTags || [];
      if (current.includes(cleanTag)) return prev;
      if (current.length >= 3) {
        toast.warning("Poshmark allows a maximum of 3 style tags.");
        return prev;
      }
      return { ...prev, styleTags: [...current, cleanTag] };
    });
    setTagInput('');
  };

  const removeStyleTag = (tag) => {
    setFormData(prev => ({
      ...prev,
      styleTags: (prev.styleTags || []).filter(t => t !== tag)
    }));
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
        platform: 'poshmark',
        images: formData.images,
        selectedRule: formData.selectedRule,
        title: formData.title,
        department: formData.department,
        category: formData.category,
        subcategory: formData.subcategory,
        brand: formData.brand,
        size: formData.size,
        colors: formData.colors,
        styleTags: formData.styleTags,
        originalPrice: formData.originalPrice,
        price: formData.price,
        shippingDiscount: formData.shippingDiscount,
        description: formData.description,
        selectedCondition: formData.selectedCondition,
        condition: formData.selectedCondition,
        sku: formData.sku,
        platformData: {
          poshmark: {
            title: formData.title,
            department: formData.department,
            category: formData.category,
            subcategory: formData.subcategory,
            brand: formData.brand,
            size: formData.size,
            colors: formData.colors,
            styleTags: formData.styleTags,
            originalPrice: formData.originalPrice,
            price: formData.price,
            shippingDiscount: formData.shippingDiscount,
            selectedCondition: formData.selectedCondition,
            sku: formData.sku,
            description: formData.description
          }
        }
      };

      let listingIdResult = editId;

      if (editId) {
        await listingService.update(editId, payload);
        toast.success("Poshmark listing updated successfully!");
      } else {
        const res = await listingService.create(payload);
        listingIdResult = res.data?.data?._id;
        toast.success("Saved as draft successfully!");
      }

      if (publishMode === 'direct') {
        toast.info("Listing to Poshmark...");
        const pubRes = await externalImportService.publish(listingIdResult, { platform: 'poshmark' });
        if (pubRes.data?.success) {
          toast.success("Successfully published to Poshmark!");
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

  // Fee calculation (Poshmark: $2.95 under $15, 20% for $15 and above)
  const numPrice = parseFloat(formData.price) || 0;
  const poshmarkFee = numPrice < 15 ? (numPrice > 0 ? 2.95 : 0) : numPrice * 0.20;
  const shippingDiscountDeduction = parseFloat(formData.shippingDiscount) === 5.95 ? 2.02 : (parseFloat(formData.shippingDiscount) === 4.99 ? 2.98 : (formData.shippingDiscount === '0.00' ? 7.97 : 0));
  const netEarnings = Math.max(0, numPrice - poshmarkFee - shippingDiscountDeduction);

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
            <img src="/poshmark.png" className="w-6 h-6 object-contain" alt="Poshmark" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">
                {editId ? 'Edit Poshmark Listing' : 'Create Poshmark Listing'}
              </h1>
              <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-bold rounded-md uppercase">
                Poshmark
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Configure department, category, colors, style tags, pricing, and shipping discounts
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
            {editId ? 'Update & List' : 'List on Poshmark'}
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
                          className="px-1 py-0.5 bg-white/30 hover:bg-white/50 text-white rounded text-[9px] font-bold disabled:opacity-30"
                        >
                          ?
                        </button>
                        <button 
                          type="button" 
                          disabled={idx === formData.images.length - 1}
                          onClick={() => moveImage(idx, 'right')}
                          className="px-1 py-0.5 bg-white/30 hover:bg-white/50 text-white rounded text-[9px] font-bold disabled:opacity-30"
                        >
                          ?
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
                    value={formData.selectedCondition}
                    onSelect={(opt) => setFormData(prev => ({ ...prev, selectedCondition: opt.label || opt.id }))}
                    options={POSHMARK_CONDITIONS.map(c => ({ id: c.name || c.id, label: c.name || c.label }))}
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

        {/* RIGHT COLUMN: Poshmark Form Details */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Section 1: Listing Details */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              Poshmark Listing Details
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

            {/* Department & Category */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Department *</label>
                <SearchableDropdown 
                  value={formData.department}
                  onSelect={(opt) => setFormData(prev => ({ ...prev, department: opt.id }))}
                  options={POSHMARK_DEPARTMENTS}
                  placeholder="Select department..."
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Category *</label>
                <input 
                  type="text"
                  className="w-full px-3 h-10 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-slate-800"
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  placeholder="e.g. Dresses, Tops, Shoes..."
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Subcategory</label>
                <input 
                  type="text"
                  className="w-full px-3 h-10 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-slate-800"
                  value={formData.subcategory}
                  onChange={(e) => setFormData(prev => ({ ...prev, subcategory: e.target.value }))}
                  placeholder="e.g. Maxi, Mini, Casual..."
                />
              </div>
            </div>

            {/* Size & Brand */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Size *</label>
                <input 
                  type="text"
                  className="w-full px-3 h-10 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-slate-800"
                  value={formData.size}
                  onChange={(e) => setFormData(prev => ({ ...prev, size: e.target.value }))}
                  placeholder="e.g. S, M, L, 8, 10, One Size..."
                />
              </div>

              {/* Brand Autocomplete */}
              <div className="relative" ref={brandDropdownRef}>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Brand</label>
                <input 
                  type="text"
                  className="w-full px-3 h-10 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-slate-800"
                  value={formData.brand}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, brand: e.target.value }));
                    triggerBrandSearch(e.target.value);
                  }}
                  onFocus={() => triggerBrandSearch(formData.brand)}
                  placeholder="e.g. Lululemon, Nike, Zara..."
                />
                {isBrandOpen && brandSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 shadow-xl rounded-xl z-[9999] py-1 text-xs">
                    {brandSuggestions.map((b) => (
                      <button
                        key={b.id || b.name}
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, brand: b.name }));
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
            </div>

            {/* Colors Selector (Max 2) */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <label className="block text-[11px] font-bold text-slate-700">
                Colors (Select up to 2)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {POSHMARK_COLORS.map((col) => {
                  const isSelected = formData.colors?.includes(col);
                  return (
                    <button
                      key={col}
                      type="button"
                      onClick={() => toggleColor(col)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all border ${
                        isSelected 
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs' 
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {col} {isSelected && '?'}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Style Tags (Max 3) */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold text-slate-700">
                  Style Tags (Up to 3)
                </label>
                <span className="text-[10px] text-slate-400">{(formData.styleTags || []).length}/3 tags</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {(formData.styleTags || []).map((tag) => (
                  <span 
                    key={tag} 
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg text-xs font-semibold border border-slate-200"
                  >
                    #{tag}
                    <button type="button" onClick={() => removeStyleTag(tag)} className="hover:text-rose-500">
                      <X size={12} />
                    </button>
                  </span>
                ))}
                {(formData.styleTags || []).length < 3 && (
                  <div className="flex items-center gap-1">
                    <input 
                      type="text"
                      placeholder="Add tag (e.g. Boho, Y2K)..."
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addStyleTag(tagInput);
                        }
                      }}
                      className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-slate-800 w-44"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={() => addStyleTag(tagInput)}>
                      Add
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Price, Original Price & Shipping Discount */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
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
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Original Price ($)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">$</span>
                  <input 
                    type="number"
                    step="0.01"
                    className="w-full pl-7 pr-3 h-10 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-slate-800"
                    value={formData.originalPrice}
                    onChange={(e) => setFormData(prev => ({ ...prev, originalPrice: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Shipping Discount</label>
                <SearchableDropdown 
                  value={POSHMARK_SHIPPING_DISCOUNTS.find(d => d.id === formData.shippingDiscount)?.label}
                  onSelect={(opt) => setFormData(prev => ({ ...prev, shippingDiscount: opt.id }))}
                  options={POSHMARK_SHIPPING_DISCOUNTS}
                  placeholder="Select discount..."
                />
              </div>
            </div>

            {/* Poshmark Earnings Calculator */}
            {numPrice > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between text-xs font-medium text-slate-600 gap-2">
                <div>Listing: <span className="font-bold text-slate-900">${numPrice.toFixed(2)}</span></div>
                <div>Poshmark Fee: <span className="font-bold text-slate-900">-${poshmarkFee.toFixed(2)}</span></div>
                {shippingDiscountDeduction > 0 && (
                  <div>Shipping Discount: <span className="font-bold text-slate-900">-${shippingDiscountDeduction.toFixed(2)}</span></div>
                )}
                <div className="border-l border-slate-200 pl-3">
                  Net Earnings: <span className="font-extrabold text-slate-900 text-sm">${netEarnings.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Description */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h2 className="text-sm font-bold text-slate-900">Description</h2>
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
                placeholder="Describe fit, fabric, flaws, style notes..."
              />
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 whitespace-pre-wrap min-h-[140px] leading-relaxed">
                {formData.description || <span className="text-slate-400 italic">No description entered</span>}
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
              {editId ? 'Update Poshmark Listing' : 'List on Poshmark'}
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default CreatePoshmarkListing;
