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
  RefreshCw,
  ShoppingBag,
  Truck,
  Layers,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';
import { ruleService, aiService, listingService, externalImportService, etsyService } from '../services/api';
import CategorySearchDropdown from '../components/CategorySearchDropdown';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { compressImage } from '../utils/imageCompressor';
import Button from '../components/ui/Button';
import IconButton from '../components/ui/IconButton';
import { Badge } from '../components/ui/Badge';

const WHO_MADE_OPTIONS = [
  { id: 'i_did', label: 'I did (Handmade)' },
  { id: 'collective', label: 'A member of my shop' },
  { id: 'someone_else', label: 'Another company or person' }
];

const WHEN_MADE_OPTIONS = [
  { id: '2020_2026', label: '2020 - 2026 (Made to order / Recent)' },
  { id: '2010_2019', label: '2010 - 2019' },
  { id: '2000_2009', label: '2000 - 2009' },
  { id: 'before_2000', label: 'Before 2000 (Vintage 20+ years)' }
];

const RENEWAL_OPTIONS = [
  { id: 'automatic', label: 'Automatic ($0.20 every 4 months)' },
  { id: 'manual', label: 'Manual' }
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

const CreateEtsyListing = ({ isModal = false, editId: propEditId = null, initialListing = null, onClose = null }) => {
  const navigate = useNavigate();
  const { toast } = useNotification();
  const [searchParams] = useSearchParams();
  const editId = propEditId || searchParams.get('edit');
  const platform = 'etsy';

  const [loading, setLoading] = useState(false);
  const [descriptionMode, setDescriptionMode] = useState('edit');
  const [rules, setRules] = useState([]);
  const [shippingProfiles, setShippingProfiles] = useState([]);
  const [refreshingProfiles, setRefreshingProfiles] = useState(false);
  const [isConvertingImages, setIsConvertingImages] = useState(false);

  // Tags & Materials inputs
  const [tagInput, setTagInput] = useState('');
  const [materialInput, setMaterialInput] = useState('');

  const [formData, setFormData] = useState({
    images: [],
    selectedRule: '',
    title: '',
    category: '',
    categoryId: '',
    price: '',
    quantity: '1',
    sku: '',
    description: '',
    who_made: 'i_did',
    when_made: '2020_2026',
    is_supply: 'false',
    renewal: 'manual',
    shipping_profile_id: '',
    tags: [],
    materials: [],
    packageWeight: { lbs: 1, oz: 0 },
    packageDimensions: { length: 10, width: 8, height: 2 },
    selectedModel: 'gpt-4o-mini'
  });

  const modelOptions = useMemo(() => [
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini (OpenAI)', description: 'Fast, cost-efficient model' },
    { id: 'gpt-4o', label: 'GPT-4o (OpenAI)', description: 'High-accuracy model' },
    { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (Google)', description: 'Fast Google AI model' },
    { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (Google)', description: 'Intelligent Google AI model' },
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (Google)', description: 'Ultra-fast Google AI model' }
  ], []);

  const loadShippingProfiles = async () => {
    setRefreshingProfiles(true);
    try {
      const res = await etsyService.getShippingProfiles();
      if (res.data?.success) {
        const profs = res.data.data?.profiles || res.data.data || [];
        setShippingProfiles(profs);
        if (profs.length > 0 && !formData.shipping_profile_id) {
          setFormData(prev => ({ ...prev, shipping_profile_id: String(profs[0].shipping_profile_id || profs[0].id) }));
        }
      }
    } catch (err) {
      console.warn("Error loading Etsy shipping profiles:", err);
    } finally {
      setRefreshingProfiles(false);
    }
  };

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

      await loadShippingProfiles();

      if (initialListing) {
        const etData = initialListing.platformData?.etsy || (initialListing.platform === 'etsy' ? initialListing : {});
        setFormData(prev => ({
          ...prev,
          images: initialListing.images || [],
          title: etData.title || initialListing.title || '',
          price: etData.price !== undefined ? etData.price : (initialListing.price || ''),
          description: etData.description || initialListing.description || '',
          category: etData.category || (initialListing.platform === 'etsy' ? initialListing.category : '') || '',
          categoryId: etData.categoryId || (initialListing.platform === 'etsy' ? initialListing.categoryId : '') || '',
          who_made: etData.who_made || 'i_did',
          when_made: etData.when_made || '2020_2026',
          is_supply: etData.is_supply || 'false',
          renewal: etData.renewal || 'manual',
          shipping_profile_id: etData.shipping_profile_id || '',
          tags: Array.isArray(etData.tags) ? etData.tags : (etData.styleTag ? [etData.styleTag] : []),
          materials: Array.isArray(etData.materials) ? etData.materials : (etData.material ? [etData.material] : []),
          sku: etData.sku || initialListing.sku || '',
          quantity: etData.quantity || '1'
        }));
      }

      const targetDbId = editId || initialListing?._id || initialListing?.id;
      if (targetDbId && !String(targetDbId).startsWith('mock-')) {
        setLoading(true);
        try {
          const res = await listingService.getOne(targetDbId);
          if (res.data?.success && res.data?.data) {
            const raw = res.data.data;
            const etData = raw.platformData?.etsy || (raw.platform === 'etsy' ? raw : {});
            setFormData(prev => ({
              ...prev,
              images: (raw.images && raw.images.length > 0) ? raw.images : (etData.images || []),
              title: etData.title || raw.title || prev.title,
              price: etData.price !== undefined ? etData.price : (raw.price || prev.price),
              description: etData.description || raw.description || prev.description,
              category: etData.category || (raw.platform === 'etsy' ? raw.category : '') || prev.category,
              categoryId: etData.categoryId || (raw.platform === 'etsy' ? raw.categoryId : '') || prev.categoryId,
              who_made: etData.who_made || prev.who_made,
              when_made: etData.when_made || prev.when_made,
              is_supply: etData.is_supply || prev.is_supply,
              renewal: etData.renewal || prev.renewal,
              shipping_profile_id: etData.shipping_profile_id || prev.shipping_profile_id,
              tags: Array.isArray(etData.tags) ? etData.tags : prev.tags,
              materials: Array.isArray(etData.materials) ? etData.materials : prev.materials,
              sku: etData.sku || raw.sku || prev.sku,
              quantity: etData.quantity || prev.quantity
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
      const response = await aiService.etsyAnalyze({
        images: formData.images,
        title_sequence: selectedRuleObj?.title_sequence || [],
        description_prompt: selectedRuleObj?.description_prompt || '',
        description_template: selectedRuleObj?.description_template || '',
        condition_note: selectedRuleObj?.condition_note || '',
        model: formData.selectedModel || 'gpt-4o-mini',
        existing_title: formData.title || ''
      });

      if (response.data.success) {
        const result = response.data.data;
        setFormData(prev => ({
          ...prev,
          title: result.title || prev.title,
          price: result.price || prev.price,
          description: result.description || prev.description,
          category: result.category_name || result.category || prev.category,
          categoryId: result.category_id || prev.categoryId,
          tags: Array.isArray(result.tags) ? result.tags : (result.style_tags || prev.tags),
          materials: Array.isArray(result.materials) ? result.materials : prev.materials,
          sku: result.sku || prev.sku
        }));
        toast.success("AI scanning complete! Etsy details prefilled.");
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

  const addTag = (tag) => {
    const clean = tag.trim();
    if (!clean) return;
    setFormData(prev => {
      const current = prev.tags || [];
      if (current.includes(clean)) return prev;
      if (current.length >= 13) {
        toast.warning("Etsy allows a maximum of 13 tags.");
        return prev;
      }
      return { ...prev, tags: [...current, clean] };
    });
    setTagInput('');
  };

  const removeTag = (tag) => {
    setFormData(prev => ({ ...prev, tags: (prev.tags || []).filter(t => t !== tag) }));
  };

  const addMaterial = (mat) => {
    const clean = mat.trim();
    if (!clean) return;
    setFormData(prev => {
      const current = prev.materials || [];
      if (current.includes(clean)) return prev;
      if (current.length >= 13) {
        toast.warning("Etsy allows a maximum of 13 materials.");
        return prev;
      }
      return { ...prev, materials: [...current, clean] };
    });
    setMaterialInput('');
  };

  const removeMaterial = (mat) => {
    setFormData(prev => ({ ...prev, materials: (prev.materials || []).filter(m => m !== mat) }));
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
        platform: 'etsy',
        images: formData.images,
        selectedRule: formData.selectedRule,
        title: formData.title,
        category: formData.category,
        categoryId: formData.categoryId,
        price: formData.price,
        quantity: formData.quantity,
        sku: formData.sku,
        description: formData.description,
        who_made: formData.who_made,
        when_made: formData.when_made,
        is_supply: formData.is_supply,
        renewal: formData.renewal,
        shipping_profile_id: formData.shipping_profile_id,
        tags: formData.tags,
        materials: formData.materials,
        packageWeight: formData.packageWeight,
        packageDimensions: formData.packageDimensions,
        platformData: {
          etsy: {
            title: formData.title,
            category: formData.category,
            categoryId: formData.categoryId,
            price: formData.price,
            quantity: formData.quantity,
            sku: formData.sku,
            who_made: formData.who_made,
            when_made: formData.when_made,
            is_supply: formData.is_supply,
            renewal: formData.renewal,
            shipping_profile_id: formData.shipping_profile_id,
            tags: formData.tags,
            materials: formData.materials,
            description: formData.description
          }
        }
      };

      let listingIdResult = editId;

      if (editId) {
        await listingService.update(editId, payload);
        toast.success("Etsy listing updated successfully!");
      } else {
        const res = await listingService.create(payload);
        listingIdResult = res.data?.data?._id;
        toast.success("Saved as draft successfully!");
      }

      if (publishMode === 'direct') {
        toast.info("Listing to Etsy...");
        const pubRes = await externalImportService.publish(listingIdResult, { platform: 'etsy' });
        if (pubRes.data?.success) {
          toast.success("Successfully published to Etsy!");
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
            <img src="/etsy.png" className="w-6 h-6 object-contain" alt="Etsy" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">
                {editId ? 'Edit Etsy Listing' : 'Create Etsy Listing'}
              </h1>
              <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-bold rounded-md uppercase">
                Etsy
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Configure handmade details, taxonomy, materials, style tags, and Etsy shipping profiles
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
            {editId ? 'Update & List' : 'List on Etsy'}
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

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">AI Model</label>
                <SearchableDropdown 
                  value={modelOptions.find(m => m.id === formData.selectedModel)?.label}
                  onSelect={(opt) => setFormData(prev => ({ ...prev, selectedModel: opt.id }))}
                  options={modelOptions}
                  placeholder="Select model..."
                />
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

        {/* RIGHT COLUMN: Etsy Form Details */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Section 1: Listing Details */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              Etsy Listing Details
            </h2>

            {/* Title */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-slate-700">Listing Title *</label>
                <span className="text-[10px] text-slate-400">{formData.title.length}/140</span>
              </div>
              <input 
                type="text"
                className="w-full px-3 h-10 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-slate-800"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value.substring(0, 140) }))}
                placeholder="Descriptive title with key search phrases..."
                maxLength={140}
              />
            </div>

            {/* Category Dropdown (Etsy Full Taxonomy) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Etsy Taxonomy Category *</label>
              <CategorySearchDropdown 
                value={formData.category}
                onSelect={(opt) => setFormData(prev => ({ ...prev, category: opt.label || opt.name, categoryId: opt.id }))}
                platform="etsy"
                placeholder="Search Etsy taxonomy hierarchy..."
              />
            </div>

            {/* Who Made / When Made / Supply */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Who made it? *</label>
                <SearchableDropdown 
                  value={WHO_MADE_OPTIONS.find(o => o.id === formData.who_made)?.label}
                  onSelect={(opt) => setFormData(prev => ({ ...prev, who_made: opt.id }))}
                  options={WHO_MADE_OPTIONS}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">When was it made? *</label>
                <SearchableDropdown 
                  value={WHEN_MADE_OPTIONS.find(o => o.id === formData.when_made)?.label}
                  onSelect={(opt) => setFormData(prev => ({ ...prev, when_made: opt.id }))}
                  options={WHEN_MADE_OPTIONS}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Product Type</label>
                <SearchableDropdown 
                  value={formData.is_supply === 'true' ? 'A supply / tool to make things' : 'A finished product'}
                  onSelect={(opt) => setFormData(prev => ({ ...prev, is_supply: opt.id }))}
                  options={[
                    { id: 'false', label: 'A finished product' },
                    { id: 'true', label: 'A supply / tool to make things' }
                  ]}
                />
              </div>
            </div>

            {/* Price, Quantity, SKU */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Price ($) *</label>
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
                <label className="block text-[11px] font-bold text-slate-700 mb-1">SKU</label>
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

          {/* Section 2: Tags & Materials */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              Etsy Style Tags & Materials
            </h2>

            {/* Tags (up to 13) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold text-slate-700">
                  Search Tags (Up to 13 tags)
                </label>
                <span className="text-[10px] text-slate-400">{(formData.tags || []).length}/13 tags</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {(formData.tags || []).map((tag) => (
                  <span 
                    key={tag} 
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg text-xs font-semibold border border-slate-200"
                  >
                    #{tag}
                    <button type="button" onClick={() => removeTag(tag)} className="hover:text-rose-500">
                      <X size={12} />
                    </button>
                  </span>
                ))}
                {(formData.tags || []).length < 13 && (
                  <div className="flex items-center gap-1">
                    <input 
                      type="text"
                      placeholder="Add tag (e.g. handmade gift)..."
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addTag(tagInput);
                        }
                      }}
                      className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-slate-800 w-44"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={() => addTag(tagInput)}>
                      Add
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Materials (up to 13) */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold text-slate-700">
                  Materials (Up to 13 materials)
                </label>
                <span className="text-[10px] text-slate-400">{(formData.materials || []).length}/13 materials</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {(formData.materials || []).map((mat) => (
                  <span 
                    key={mat} 
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg text-xs font-semibold border border-slate-200"
                  >
                    {mat}
                    <button type="button" onClick={() => removeMaterial(mat)} className="hover:text-rose-500">
                      <X size={12} />
                    </button>
                  </span>
                ))}
                {(formData.materials || []).length < 13 && (
                  <div className="flex items-center gap-1">
                    <input 
                      type="text"
                      placeholder="Add material (e.g. 100% Cotton, Brass)..."
                      value={materialInput}
                      onChange={(e) => setMaterialInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addMaterial(materialInput);
                        }
                      }}
                      className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-slate-800 w-44"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={() => addMaterial(materialInput)}>
                      Add
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Shipping Profile */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <Truck size={16} className="text-slate-700" />
                <h2 className="text-sm font-bold text-slate-900">Etsy Shipping Profile</h2>
              </div>
              <button
                type="button"
                onClick={loadShippingProfiles}
                disabled={refreshingProfiles}
                className="text-xs font-bold text-slate-700 hover:text-slate-900 flex items-center gap-1 underline"
              >
                <RefreshCw size={12} className={refreshingProfiles ? 'animate-spin' : ''} /> Refresh Profiles
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Shipping Profile *</label>
              <SearchableDropdown 
                value={shippingProfiles.find(p => String(p.shipping_profile_id || p.id) === String(formData.shipping_profile_id))?.title || shippingProfiles.find(p => String(p.shipping_profile_id || p.id) === String(formData.shipping_profile_id))?.name}
                onSelect={(opt) => setFormData(prev => ({ ...prev, shipping_profile_id: String(opt.id) }))}
                options={shippingProfiles.map(p => ({ id: String(p.shipping_profile_id || p.id), label: p.title || p.name }))}
                placeholder="Select Etsy shipping profile..."
              />
            </div>
          </div>

          {/* Section 4: Description */}
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
                placeholder="Describe your handmade item, story, process, and sizing details..."
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
              {editId ? 'Update Etsy Listing' : 'List on Etsy'}
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default CreateEtsyListing;
