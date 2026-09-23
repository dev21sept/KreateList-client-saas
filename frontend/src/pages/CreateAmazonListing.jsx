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
  List,
  Layers,
  Key,
  Plus,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';
import { ruleService, aiService, listingService, externalImportService, amazonService } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { compressImage } from '../utils/imageCompressor';
import Button from '../components/ui/Button';
import IconButton from '../components/ui/IconButton';
import { Badge } from '../components/ui/Badge';

const AMAZON_CONDITIONS = [
  { id: 'New', label: 'New', description: 'Brand-new, unused, unopened item in original packaging with all original materials.' },
  { id: 'Used - Like New', label: 'Used - Like New', description: 'In perfect condition with no imperfections or signs of wear.' },
  { id: 'Used - Very Good', label: 'Used - Very Good', description: 'A well-cared-for item that has seen limited use and remains in great condition.' },
  { id: 'Used - Good', label: 'Used - Good', description: 'Shows wear from consistent use, but remains in good condition and functions properly.' },
  { id: 'Used - Acceptable', label: 'Used - Acceptable', description: 'Fairly worn but continues to function properly. Signs of wear can include scratches or dents.' }
];

const AMAZON_PRODUCT_TYPES = [
  { id: 'SHIRT', name: 'Shirts & Tops', category: 'Clothing, Shoes & Jewelry > Tops & Tees' },
  { id: 'PANTS', name: 'Pants & Trousers', category: 'Clothing, Shoes & Jewelry > Bottoms > Pants' },
  { id: 'DRESS', name: 'Dresses', category: 'Clothing, Shoes & Jewelry > Women > Dresses' },
  { id: 'SHOES', name: 'Shoes & Footwear', category: 'Clothing, Shoes & Jewelry > Shoes' },
  { id: 'OUTERWEAR', name: 'Jackets & Coats', category: 'Clothing, Shoes & Jewelry > Outerwear' },
  { id: 'SWEATER', name: 'Sweaters & Cardigans', category: 'Clothing, Shoes & Jewelry > Sweaters' },
  { id: 'SHORTS', name: 'Shorts', category: 'Clothing, Shoes & Jewelry > Bottoms > Shorts' },
  { id: 'SKIRT', name: 'Skirts', category: 'Clothing, Shoes & Jewelry > Women > Skirts' },
  { id: 'HANDBAG', name: 'Handbags & Wallets', category: 'Clothing, Shoes & Jewelry > Handbags & Wallets' },
  { id: 'JEWELRY', name: 'Jewelry & Accessories', category: 'Clothing, Shoes & Jewelry > Accessories > Jewelry' },
  { id: 'WATCH', name: 'Watches', category: 'Clothing, Shoes & Jewelry > Watches' },
  { id: 'HOME', name: 'Home & Kitchen', category: 'Home & Kitchen' },
  { id: 'BEAUTY', name: 'Beauty & Personal Care', category: 'Beauty & Personal Care' },
  { id: 'TOYS_AND_GAMES', name: 'Toys & Games', category: 'Toys & Games' },
  { id: 'SPORTING_GOODS', name: 'Sports & Outdoors', category: 'Sports & Outdoors' },
  { id: 'ELECTRONICS', name: 'Electronics', category: 'Electronics' },
  { id: 'BOOK', name: 'Books', category: 'Books' },
  { id: 'PRODUCT', name: 'General Product', category: 'Everything Else' }
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
      const desc = String(opt?.description || opt?.category || '').toLowerCase();
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
                className={`w-full text-left px-3.5 py-2.5 hover:bg-slate-100 text-slate-700 hover:text-slate-900 transition-colors flex items-center justify-between text-xs font-semibold ${value === (opt.label || opt.name) ? 'bg-slate-100 font-bold text-slate-900' : ''}`}
              >
                <div className="truncate pr-2">
                  <div>{opt.label || opt.name}</div>
                  {(opt.description || opt.category) && <div className="text-[10px] text-slate-400 font-normal">{opt.description || opt.category}</div>}
                </div>
                {value === (opt.label || opt.name) && <Check className="w-3.5 h-3.5 text-slate-900 shrink-0" />}
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

const CreateAmazonListing = ({ isModal = false, editId: propEditId = null, initialListing = null, onClose = null }) => {
  const navigate = useNavigate();
  const { toast } = useNotification();
  const [searchParams] = useSearchParams();
  const editId = propEditId || searchParams.get('edit');
  const platform = 'amazon';

  const [loading, setLoading] = useState(false);
  const [descriptionMode, setDescriptionMode] = useState('edit');
  const [rules, setRules] = useState([]);
  const [isConvertingImages, setIsConvertingImages] = useState(false);

  const [formData, setFormData] = useState({
    images: [],
    selectedRule: '',
    selectedCondition: 'Used - Good',
    title: '',
    brand: '',
    manufacturer: '',
    modelNumber: '',
    productType: 'PRODUCT',
    category: 'Everything Else',
    price: '',
    quantity: '1',
    sku: '',
    conditionNote: '',
    asin: '',
    standardProductId: { idType: 'UPC', value: '' },
    bulletPoints: ['', '', '', ''],
    keywords: '',
    fulfillmentLatency: '2',
    description: '',
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
        const aData = initialListing.platformData?.amazon || (initialListing.platform === 'amazon' ? initialListing : {});
        setFormData(prev => ({
          ...prev,
          images: initialListing.images || [],
          title: aData.title || initialListing.title || '',
          brand: aData.brand || initialListing.brand || '',
          price: aData.price !== undefined ? aData.price : (initialListing.price || ''),
          description: aData.description || initialListing.description || '',
          productType: aData.productType || 'PRODUCT',
          category: aData.category || (initialListing.platform === 'amazon' ? initialListing.category : '') || 'Everything Else',
          asin: aData.asin || '',
          standardProductId: aData.standardProductId || { idType: 'UPC', value: '' },
          bulletPoints: Array.isArray(aData.bulletPoints) ? aData.bulletPoints : ['', '', '', ''],
          keywords: aData.keywords || '',
          sku: aData.sku || initialListing.sku || '',
          selectedCondition: aData.selectedCondition || aData.condition || 'Used - Good'
        }));
      }

      const targetDbId = editId || initialListing?._id || initialListing?.id;
      if (targetDbId && !String(targetDbId).startsWith('mock-')) {
        setLoading(true);
        try {
          const res = await listingService.getOne(targetDbId);
          if (res.data?.success && res.data?.data) {
            const raw = res.data.data;
            const aData = raw.platformData?.amazon || (raw.platform === 'amazon' ? raw : {});
            setFormData(prev => ({
              ...prev,
              images: (raw.images && raw.images.length > 0) ? raw.images : (aData.images || []),
              title: aData.title || raw.title || prev.title,
              brand: aData.brand || raw.brand || prev.brand,
              price: aData.price !== undefined ? aData.price : (raw.price || prev.price),
              description: aData.description || raw.description || prev.description,
              productType: aData.productType || prev.productType,
              category: aData.category || (raw.platform === 'amazon' ? raw.category : '') || prev.category,
              asin: aData.asin || prev.asin,
              standardProductId: aData.standardProductId || prev.standardProductId,
              bulletPoints: Array.isArray(aData.bulletPoints) ? aData.bulletPoints : prev.bulletPoints,
              keywords: aData.keywords || prev.keywords,
              sku: aData.sku || raw.sku || prev.sku,
              selectedCondition: aData.selectedCondition || aData.condition || raw.condition || prev.selectedCondition
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
      const response = await aiService.amazonAnalyze({
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
          description: result.description || prev.description,
          productType: result.productType || prev.productType,
          category: result.category || prev.category,
          bulletPoints: Array.isArray(result.bulletPoints) ? result.bulletPoints : (result.bullets || prev.bulletPoints),
          keywords: result.keywords || result.searchTerms || prev.keywords,
          sku: result.sku || prev.sku
        }));
        toast.success("AI scanning complete! Amazon details prefilled.");
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

  const updateBulletPoint = (index, value) => {
    const newBullets = [...formData.bulletPoints];
    newBullets[index] = value;
    setFormData(prev => ({ ...prev, bulletPoints: newBullets }));
  };

  const addBulletPoint = () => {
    if (formData.bulletPoints.length >= 5) return;
    setFormData(prev => ({ ...prev, bulletPoints: [...prev.bulletPoints, ''] }));
  };

  const removeBulletPoint = (index) => {
    setFormData(prev => ({ ...prev, bulletPoints: prev.bulletPoints.filter((_, idx) => idx !== index) }));
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
        platform: 'amazon',
        images: formData.images,
        selectedRule: formData.selectedRule,
        title: formData.title,
        brand: formData.brand,
        manufacturer: formData.manufacturer,
        modelNumber: formData.modelNumber,
        productType: formData.productType,
        category: formData.category,
        price: formData.price,
        quantity: formData.quantity,
        sku: formData.sku,
        conditionNote: formData.conditionNote,
        asin: formData.asin,
        standardProductId: formData.standardProductId,
        bulletPoints: formData.bulletPoints.filter(b => b.trim().length > 0),
        keywords: formData.keywords,
        fulfillmentLatency: formData.fulfillmentLatency,
        description: formData.description,
        selectedCondition: formData.selectedCondition,
        platformData: {
          amazon: {
            title: formData.title,
            brand: formData.brand,
            productType: formData.productType,
            category: formData.category,
            price: formData.price,
            quantity: formData.quantity,
            sku: formData.sku,
            asin: formData.asin,
            standardProductId: formData.standardProductId,
            bulletPoints: formData.bulletPoints.filter(b => b.trim().length > 0),
            keywords: formData.keywords,
            selectedCondition: formData.selectedCondition,
            description: formData.description
          }
        }
      };

      let listingIdResult = editId;

      if (editId) {
        await listingService.update(editId, payload);
        toast.success("Amazon listing updated successfully!");
      } else {
        const res = await listingService.create(payload);
        listingIdResult = res.data?.data?._id;
        toast.success("Saved as draft successfully!");
      }

      if (publishMode === 'direct') {
        toast.info("Listing to Amazon...");
        const pubRes = await externalImportService.publish(listingIdResult, { platform: 'amazon' });
        if (pubRes.data?.success) {
          toast.success("Successfully published to Amazon!");
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
            <img src="/amazon.png" className="w-6 h-6 object-contain" alt="Amazon" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">
                {editId ? 'Edit Amazon Listing' : 'Create Amazon Listing'}
              </h1>
              <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-bold rounded-md uppercase">
                Amazon
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Configure product type, standard product ID, bullet points, search keywords, and pricing
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
            {editId ? 'Update & List' : 'List on Amazon'}
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
                    value={formData.selectedCondition}
                    onSelect={(opt) => setFormData(prev => ({ ...prev, selectedCondition: opt.id }))}
                    options={AMAZON_CONDITIONS}
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

        {/* RIGHT COLUMN: Amazon Form Details */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Section 1: Listing Details */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              Amazon Listing Details
            </h2>

            {/* Title */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-slate-700">Listing Title *</label>
                <span className="text-[10px] text-slate-400">{formData.title.length}/200</span>
              </div>
              <input 
                type="text"
                className="w-full px-3 h-10 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-slate-800"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value.substring(0, 200) }))}
                placeholder="Product title (Brand, model, color, size, features)..."
                maxLength={200}
              />
            </div>

            {/* Product Type & Brand */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Product Type *</label>
                <SearchableDropdown 
                  value={AMAZON_PRODUCT_TYPES.find(p => p.id === formData.productType)?.name || formData.productType}
                  onSelect={(opt) => setFormData(prev => ({ ...prev, productType: opt.id, category: opt.category || prev.category }))}
                  options={AMAZON_PRODUCT_TYPES}
                  placeholder="Select product type..."
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Brand Name *</label>
                <input 
                  type="text"
                  className="w-full px-3 h-10 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-slate-800"
                  value={formData.brand}
                  onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                  placeholder="e.g. Sony, Nike, Generic..."
                />
              </div>
            </div>

            {/* Price, Quantity, SKU */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Merchant SKU</label>
                <input 
                  type="text"
                  className="w-full px-3 h-10 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-slate-800"
                  value={formData.sku}
                  onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                  placeholder="Optional SKU"
                />
              </div>
            </div>

            {/* Standard Product ID (UPC/EAN/ASIN) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Product ID Type</label>
                <SearchableDropdown 
                  value={formData.standardProductId?.idType || 'UPC'}
                  onSelect={(opt) => setFormData(prev => ({ ...prev, standardProductId: { ...prev.standardProductId, idType: opt.id } }))}
                  options={[
                    { id: 'UPC', label: 'UPC (12 digits)' },
                    { id: 'EAN', label: 'EAN (13 digits)' },
                    { id: 'ASIN', label: 'ASIN (Amazon ID)' },
                    { id: 'GTIN', label: 'GTIN (14 digits)' }
                  ]}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Standard Product ID / Barcode</label>
                <input 
                  type="text"
                  className="w-full px-3 h-10 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-slate-800"
                  value={formData.standardProductId?.value || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, standardProductId: { ...prev.standardProductId, value: e.target.value } }))}
                  placeholder="Enter barcode / UPC / ASIN value..."
                />
              </div>
            </div>
          </div>

          {/* Section 2: Bullet Points (Features) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h2 className="text-sm font-bold text-slate-900">Key Product Features (Bullet Points)</h2>
              {formData.bulletPoints.length < 5 && (
                <button
                  type="button"
                  onClick={addBulletPoint}
                  className="text-xs font-bold text-slate-700 hover:text-slate-900 flex items-center gap-1 underline"
                >
                  <Plus size={13} /> Add Bullet
                </button>
              )}
            </div>

            <div className="space-y-2">
              {formData.bulletPoints.map((bullet, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-400 w-4">{idx + 1}.</span>
                  <input 
                    type="text"
                    className="flex-1 px-3 h-9 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-slate-800"
                    value={bullet}
                    onChange={(e) => updateBulletPoint(idx, e.target.value)}
                    placeholder={`Bullet point ${idx + 1}...`}
                  />
                  {formData.bulletPoints.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeBulletPoint(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Generic Keywords */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              Generic Keywords / Search Terms
            </h2>
            <textarea 
              rows={3}
              className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-slate-800 leading-relaxed"
              value={formData.keywords}
              onChange={(e) => setFormData(prev => ({ ...prev, keywords: e.target.value }))}
              placeholder="Space-separated search terms (e.g. vintage casual summer lightweight breathable outdoor)..."
            />
          </div>

          {/* Section 4: Description */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h2 className="text-sm font-bold text-slate-900">Product Description</h2>
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
                placeholder="Full product description..."
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
              {editId ? 'Update Amazon Listing' : 'List on Amazon'}
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default CreateAmazonListing;
