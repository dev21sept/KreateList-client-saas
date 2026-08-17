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
  Code,
  Trash2,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';
import { ruleService, aiService, listingService, externalImportService, mercariService } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { compressImage } from '../utils/imageCompressor';
import mercariTaxonomy from '../../../backend/constants/mercariCategoryTaxonomy.json';
import { MERCARI_SIZES_BY_GROUP } from '../constants/mercariSizesTaxonomy';
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


const MERCARI_CONDITIONS = [
  { id: "new", label: "New (with tags)", description: "Brand new, never used, with original tags/packaging." },
  { id: "like_new", label: "Like New", description: "Excellent condition, no tags but looks and feels brand new." },
  { id: "good", label: "Good", description: "Gently used, minor signs of wear but still in great shape." },
  { id: "fair", label: "Fair", description: "Obvious wear or minor blemishes." },
  { id: "poor", label: "Poor", description: "Heavy wear, obvious flaws or functionality issues." }
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

  const getInitialSearchTerm = (val) => {
    if (!val) return '';
    const hasChildren = options.some(o => o.label.startsWith(val + ' > '));
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
      // By default, show level 0 categories and any options that don't have a level property (like Rules, Condition, Model)
      return options.filter(opt => opt.level === undefined || opt.level === 0);
    }

    const hasArrow = q.includes('>');
    if (hasArrow) {
      // Normalize spacing around '>' for accurate prefix matching
      const normalizedQ = q.replace(/\s*>\s*/g, ' > ');
      return options.filter((opt) => {
        const label = String(opt?.label || '').toLowerCase().replace(/\s*>\s*/g, ' > ');
        return label.startsWith(normalizedQ);
      }).slice(0, 100);
    }

    const queryWords = q.split(/\s+/).filter(Boolean);
    const matched = options.filter((opt) => {
      const label = String(opt?.label || '').toLowerCase();
      const desc = String(opt?.description || '').toLowerCase();
      
      const labelWords = label.split(/[^a-z0-9&]+/i).filter(Boolean);
      const descWords = desc.split(/[^a-z0-9&]+/i).filter(Boolean);
      
      return queryWords.every(qWord => 
        labelWords.some(lWord => lWord.startsWith(qWord)) || 
        descWords.some(dWord => dWord.startsWith(qWord))
      );
    });
    // Limit to 100 items to keep list rendering smooth and fast
    return matched.slice(0, 100);
  }, [searchTerm, options]);

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={handleToggle}
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
                  // Check if this option has child subcategories in the options array
                  const hasChildren = options.some(o => o.label.startsWith(opt.label + ' > '));
                  if (hasChildren) {
                    setSearchTerm(opt.label + ' > ');
                  } else {
                    onSelect(opt);
                    setIsOpen(false);
                    setSearchTerm('');
                  }
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

const CreateMercariListing = ({ isModal = false, editId: propEditId = null, onClose = null }) => {
  const navigate = useNavigate();
  const { toast } = useNotification();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const editId = propEditId || searchParams.get('edit');
  const platform = 'mercari';
  const [hasScanned, setHasScanned] = useState(editId ? true : false);
  const [loading, setLoading] = useState(false);
  const [descriptionMode, setDescriptionMode] = useState('preview'); // 'edit' or 'preview'
  const [rules, setRules] = useState([]);
  const [files, setFiles] = useState([]);
  const [brandSuggestions, setBrandSuggestions] = useState([]);
  const [isBrandOpen, setIsBrandOpen] = useState(false);
  const brandDropdownRef = React.useRef(null);

  const [formData, setFormData] = useState({
    images: [],
    selectedRule: '',
    selectedCondition: '',
    title: '',
    brand: '',
    brandId: '',
    originalPrice: '',
    shippingPayer: 'buyer',
    shippingWeightLbs: 0,
    shippingWeightOz: 0,
    shippingFitsShoebox: true,
    shippingLength: 0,
    shippingWidth: 0,
    shippingHeight: 0,
    shippingCarrier: '',
    shippingPrice: '',
        styleTag: '',
    quantity: 1,
    size: '',
    category: '',
    categoryId: '',
    price: '',
    description: '',
    conditionNote: '',
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
    const lbs = formData.shippingWeightLbs || 0;
    const oz = formData.shippingWeightOz || 0;
    const totalOz = (lbs * 16) + oz;
    
    const length = formData.shippingLength || 0;
    const width = formData.shippingWidth || 0;
    const height = formData.shippingHeight || 0;
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
    else options.push({ carrier: 'UPS Ground', weightText: `${Math.ceil(totalOz/16)} lb`, price: '15.00' });

    return options;
  }, [formData.shippingWeightLbs, formData.shippingWeightOz, formData.shippingFitsShoebox, formData.shippingLength, formData.shippingWidth, formData.shippingHeight]);

  // Sync shipping carrier and price with options when options change
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
    if (!formData.category) return [];
    
    // Find the category option in categoryOptions to get its size group ID
    const selectedCat = categoryOptions.find(opt => opt.label === formData.category);
    if (!selectedCat) return [];

    const groupId = selectedCat.itemSizeGroupId;
    if (!groupId || groupId === 0) return []; // No size required for this category!

    return MERCARI_SIZES_BY_GROUP[groupId] || [];
  }, [formData.category, categoryOptions]);
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
          if (rulesData.length > 0) {
            setFormData(prev => ({ ...prev, selectedRule: rulesData[0]._id || rulesData[0].id }));
          }
        }
      } catch (error) {
        console.error("Error loading rules:", error);
      }
    };
    fetchRules();
  }, []);

  useEffect(() => {
    if (editId) {
      const fetchListing = async () => {
        setLoading(true);
        try {
          const res = await listingService.getById(editId);
          if (res.data?.success && res.data?.data) {
            const l = res.data.data;
            setFormData({
              images: l.images || [],
              selectedRule: l.selectedRule || '',
              selectedCondition: l.selectedCondition || '',
              title: l.title || '',
              brand: l.brand || '',
              brandId: l.brandId || '',
              originalPrice: l.originalPrice || '',
              shippingPayer: l.shippingPayer || 'buyer',
              shippingWeightLbs: l.shippingWeightLbs || 0,
              shippingWeightOz: l.shippingWeightOz || 0,
              shippingFitsShoebox: l.shippingFitsShoebox !== undefined ? l.shippingFitsShoebox : true,
              shippingLength: l.shippingLength || 0,
              shippingWidth: l.shippingWidth || 0,
              shippingHeight: l.shippingHeight || 0,
              shippingCarrier: l.shippingCarrier || '',
              shippingPrice: l.shippingPrice || '',
                            styleTag: l.styleTag || '',
              quantity: l.quantity || 1,
              size: l.size || '',
              category: l.category || '',
              categoryId: l.categoryId || '',
              price: l.price || '',
              description: l.description || '',
              conditionNote: l.conditionNote || '',
            });
            const imageMap = {};
            (l.images || []).forEach((_, idx) => {
              imageMap[idx] = true;
            });
            setLoadedImages(imageMap);
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

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (brandDropdownRef.current && !brandDropdownRef.current.contains(e.target)) {
        setIsBrandOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    const handleMsg = (e) => {
      if (e.data && e.data.action === 'ELISTER_MERCARI_BRAND_SEARCH_RESPONSE') {
        if (e.data.success) {
          setBrandSuggestions(e.data.brands || []);
        }
      }
    };
    window.addEventListener('message', handleMsg);
    return () => window.removeEventListener('message', handleMsg);
  }, []);

  const triggerBrandSearch = async (value) => {
    setIsBrandOpen(true);
    if (!value.trim()) {
      setBrandSuggestions(POPULAR_BRANDS);
      return;
    }

    // Query local offline backend brand search in parallel
    try {
      const response = await mercariService.suggestBrands(value);
      if (response.data && response.data.success && response.data.brands) {
        setBrandSuggestions(response.data.brands);
      }
    } catch (err) {
      console.warn("Backend brand autocomplete fetch failed:", err);
    }

    // Send background query to Chrome Extension
    window.postMessage({
      action: 'ELISTER_MERCARI_BRAND_SEARCH',
      query: value
    }, '*');
  };

  const handleBrandChange = (e) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, brand: value }));
    triggerBrandSearch(value);
  };

  const handleImageUpload = async (e) => {
    const uploadedFiles = Array.from(e.target.files);
    setFiles([...files, ...uploadedFiles]);
    setIsConvertingImages(true);
    try {
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
    
    try {
      const dupRes = await listingService.checkDuplicate({
        image: formData.images[0],
        platform: 'mercari'
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
      const response = await aiService.mercariAnalyze({
        images: formData.images, 
        title_sequence: selectedRuleObj?.title_sequence || [],
        description_prompt: selectedRuleObj?.description_prompt || '',
        description_template: selectedRuleObj?.description_template || '',
        condition_note: selectedRuleObj?.condition_note || '',
        condition_name: formData.selectedCondition,
        model: formData.selectedModel || 'gpt-4o-mini'
      });

      if (response.data.success) {
        const result = response.data.data;
        setFormData(prev => ({
          ...prev,
          title: result.title,
          brand: result.brand || '',
          brandId: result.brandId || '',
          originalPrice: result.originalPrice || '',
                    styleTag: result.styleTag || '',
          quantity: 1,
          size: result.size || '',
          price: result.price,
          description: result.description,
          conditionNote: selectedRuleObj?.condition_note || '',
          category: result.category_name || result.category || '',
          categoryId: result.category_id || '',
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

  const conditionOptions = useMemo(() => MERCARI_CONDITIONS.map(c => ({
    id: c.id,
    label: c.label,
    description: c.description
  })), []);

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
    setFiles(newFiles);
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
        platform,
        images: formData.images,
        selectedRule: formData.selectedRule,
        selectedCondition: formData.selectedCondition,
        title: formData.title,
        brand: formData.brand,
        brandId: formData.brandId,
        originalPrice: formData.originalPrice,
        shippingPayer: formData.shippingPayer,
        shippingWeightLbs: formData.shippingWeightLbs,
        shippingWeightOz: formData.shippingWeightOz,
        shippingFitsShoebox: formData.shippingFitsShoebox,
        shippingLength: formData.shippingLength,
        shippingWidth: formData.shippingWidth,
        shippingHeight: formData.shippingHeight,
        shippingCarrier: recommendedShipping ? recommendedShipping.carrier : '',
        shippingPrice: recommendedShipping ? recommendedShipping.price : '',
                styleTag: formData.styleTag,
        quantity: formData.quantity,
        size: formData.size,
        category: formData.category,
        categoryId: formData.categoryId,
        price: formData.price,
        description: formData.description,
        conditionNote: formData.conditionNote,
        sku: formData.sku
      };

      let listingIdResult = editId;

      if (editId) {
        await listingService.update(editId, payload);
        toast.success("Listing updated successfully!");
      } else {
        const res = await listingService.create(payload);
        listingIdResult = res.data?.data?._id;
        toast.success("Listing saved as draft successfully!");
      }

      if (publishMode === 'direct') {
        toast.info("Listing to Mercari via Direct API...");
        const pubRes = await externalImportService.publish(listingIdResult, { platform: 'mercari' });
        if (pubRes.data?.success) {
          toast.success("Successfully published to Mercari!");
        }
      } else if (publishMode === 'extension') {
        toast.info("Sending listing details to Chrome Extension...");
        window.postMessage({
          action: 'ELISTER_LIST_ITEM',
          platform: 'mercari',
          item: {
            ...payload,
            _id: listingIdResult
          }
        }, '*');
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
    <div className="max-w-[1300px] mx-auto py-2 px-1">
      {/* Dynamic Header */}
      <div className="flex items-center gap-3.5 mb-8 border-b border-slate-100 pb-5">
        <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl shadow-xs">
          <img src="/mercari.png" className="w-9 h-9 object-contain" alt="" />
        </div>
        <div>
          <h2 className="text-lg font-black text-slate-800 tracking-tight">
            {editId ? 'Edit Mercari Listing' : 'Create Mercari Listing'}
          </h2>
          <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mt-0.5">
            Optimize, prefill, and publish your items via AI Scan
          </p>
        </div>
      </div>

      <div className="bg-white border border-[#f1f3f9] rounded-[2.5rem] shadow-xl p-8 relative min-h-[500px]">
        {loading && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-xs z-50 flex flex-col items-center justify-center rounded-[2.5rem]">
            <Loader2 className="animate-spin text-indigo-600 mb-4" size={42} />
            <span className="text-sm font-extrabold text-slate-800 animate-pulse">Running AI Scan & Processing...</span>
            <p className="text-xs font-semibold text-slate-450 mt-1 max-w-xs text-center leading-relaxed">
              We are uploading images, running visual models, and generating search-optimized listing details.
            </p>
          </div>
        )}

        {/* Step 1: Upload and initial setups (Always visible) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-6 space-y-6">
            <h3 className="text-xs font-black text-indigo-900 uppercase tracking-wider border-b border-slate-100 pb-2">
              1. Upload Photos
            </h3>
            
            {/* Image upload area */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
              <label className="aspect-square bg-slate-50 border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all hover:bg-slate-100/50 group select-none">
                <Upload className="w-6 h-6 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                <span className="text-[9px] font-black text-slate-450 uppercase tracking-wider">Add photos</span>
                <input 
                  type="file" 
                  multiple 
                  accept="image/*" 
                  onChange={handleImageUpload} 
                  className="hidden" 
                  disabled={isConvertingImages}
                />
              </label>

              {formData.images.map((img, idx) => (
                <div key={idx} className="aspect-square rounded-3xl border border-slate-150 relative overflow-hidden group shadow-inner bg-slate-100">
                  <img 
                    src={img} 
                    onLoad={() => setLoadedImages(prev => ({ ...prev, [idx]: true }))}
                    className={`w-full h-full object-cover transition-opacity duration-300 ${loadedImages[idx] ? 'opacity-100' : 'opacity-0'}`} 
                    alt="" 
                  />
                  {!loadedImages[idx] && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="animate-spin text-slate-400" size={16} />
                    </div>
                  )}

                  {/* Actions overlay */}
                  <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-all flex flex-col justify-between p-2.5">
                    <button 
                      type="button"
                      onClick={() => deleteImage(idx)}
                      className="self-end p-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg transition-all"
                    >
                      <Trash2 size={12} />
                    </button>

                    <div className="flex justify-between items-center gap-1">
                      <button 
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveImage(idx, 'left')}
                        disabledClassName="opacity-40"
                        className="flex-1 p-1 bg-white/20 hover:bg-white/40 text-white rounded-lg text-[9px] font-bold disabled:opacity-40"
                      >
                        ←
                      </button>
                      <button 
                        type="button"
                        disabled={idx === formData.images.length - 1}
                        onClick={() => moveImage(idx, 'right')}
                        disabledClassName="opacity-40"
                        className="flex-1 p-1 bg-white/20 hover:bg-white/40 text-white rounded-lg text-[9px] font-bold disabled:opacity-40"
                      >
                        →
                      </button>
                    </div>
                  </div>

                  {idx === 0 && (
                    <span className="absolute top-2 left-2 bg-indigo-600 text-white font-black text-[8px] uppercase px-2 py-0.5 rounded-lg shadow-sm">
                      Cover
                    </span>
                  )}
                </div>
              ))}
            </div>
            
            {isConvertingImages && (
              <div className="flex items-center gap-2 text-indigo-650 text-xs font-semibold animate-pulse mt-2 ml-1">
                <Loader2 className="animate-spin" size={14} /> Processing files...
              </div>
            )}
          </div>

          <div className="lg:col-span-6 space-y-6">
            <h3 className="text-xs font-black text-indigo-900 uppercase tracking-wider border-b border-slate-100 pb-2">
              2. Scan Settings
            </h3>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-455 uppercase tracking-widest ml-1">AI Listing Rule</label>
                <SearchableDropdown 
                  value={rules.find(r => (r._id || r.id) === formData.selectedRule)?.name}
                  onSelect={(opt) => setFormData({ ...formData, selectedRule: opt.id })}
                  options={ruleOptions}
                  placeholder="Select prefill rule..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-455 uppercase tracking-widest ml-1">Condition</label>
                  <SearchableDropdown 
                    value={conditionOptions.find(c => c.id === formData.selectedCondition)?.label}
                    onSelect={(opt) => setFormData({ ...formData, selectedCondition: opt.id })}
                    options={conditionOptions}
                    placeholder="Select condition..."
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-455 uppercase tracking-widest ml-1">AI Model</label>
                  <SearchableDropdown 
                    value={modelOptions.find(m => m.id === formData.selectedModel)?.label || 'GPT-4o Mini'}
                    onSelect={(opt) => setFormData({ ...formData, selectedModel: opt.id })}
                    options={modelOptions}
                    placeholder="Select model..."
                  />
                </div>
              </div>

              {!hasScanned && (
                <div className="pt-4">
                  <button 
                    type="button"
                    onClick={startAIFetch}
                    disabled={loading || isConvertingImages || formData.images.length === 0}
                    className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs transition-all active:scale-95 shadow-md shadow-indigo-150 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    <Sparkles size={14} className="animate-pulse" /> Analyze Product & Prefill Details
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Step 2: Prefilled Details Form (Only visible once scanned) */}
        {hasScanned && (<>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mt-10 pt-8 border-t border-slate-100 animate-in fade-in duration-300">
            {/* Left Column: Essential details */}
            <div className="lg:col-span-6 space-y-6">
              <h3 className="text-xs font-black text-indigo-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                3. Listing Details
              </h3>

              <div className="space-y-4">
                {/* Title */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-455 uppercase tracking-widest ml-1">Listing Title</label>
                  <input 
                    className="w-full px-4 h-12 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all focus:ring-2 focus:ring-indigo-500/10"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value.substring(0, 80)})}
                    placeholder="Enter descriptive title..."
                    maxLength="80"
                  />
                  <span className="text-[9px] font-semibold text-slate-400 block text-right pr-2">
                    {formData.title.length}/80 characters
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Brand */}
                  <div className="space-y-1.5 relative" ref={brandDropdownRef}>
                    <label className="text-[10px] font-black text-slate-455 uppercase tracking-widest ml-1">Brand</label>
                    <input 
                      className="w-full px-4 h-12 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all focus:ring-2 focus:ring-indigo-500/10"
                      value={formData.brand}
                      onChange={handleBrandChange}
                      onFocus={() => triggerBrandSearch(formData.brand)}
                      placeholder="e.g. Nike, Adidas..."
                    />
                    {isBrandOpen && brandSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 shadow-xl rounded-2xl z-[9999] py-1 animate-in fade-in slide-in-from-top-2 duration-100">
                        {brandSuggestions.map((b) => (
                          <button
                            key={b.id || b.name}
                            type="button"
                            onClick={() => {
                              setFormData(prev => ({ ...prev, brand: b.name, brandId: String(b.id || '') }));
                              setIsBrandOpen(false);
                            }}
                            className="w-full px-4 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all flex items-center justify-between cursor-pointer border-none bg-transparent"
                          >
                            <span>{b.name}</span>
                            <span className="text-[9px] font-bold text-slate-400">ID: {b.id}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* SKU */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-455 uppercase tracking-widest ml-1">SKU Code</label>
                    <input 
                      className="w-full px-4 h-12 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all focus:ring-2 focus:ring-indigo-500/10"
                      value={formData.sku}
                      onChange={(e) => setFormData({...formData, sku: e.target.value})}
                      placeholder="e.g. KL123A..."
                    />
                  </div>
                </div>

                {/* Category */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-455 uppercase tracking-widest ml-1">Category</label>
                  <SearchableDropdown 
                    value={formData.category}
                    onSelect={(opt) => setFormData({ ...formData, category: opt.label, categoryId: opt.id })}
                    options={categoryOptions}
                    placeholder="Select Mercari category..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Selling Price */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-[#059669] uppercase tracking-widest ml-1">Selling Price ($)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-600 w-4 h-4" />
                      <input 
                        type="number"
                        className="w-full pl-10 pr-4 h-12 bg-white border border-slate-200 rounded-xl text-xs font-extrabold text-emerald-700 outline-none focus:border-emerald-500 transition-all focus:ring-2 focus:ring-emerald-500/10"
                        value={formData.price}
                        onChange={(e) => setFormData({...formData, price: e.target.value})}
                        placeholder="0.00"
                        step="0.01"
                      />
                    </div>
                  </div>

  
                </div>



                {/* Size (Only render if category requires sizing) */}
                  {activeSizeOptions.length > 0 && (
                    <div className="space-y-1.5 animate-in fade-in duration-200">
                      <label className="text-[10px] font-black text-slate-455 uppercase tracking-widest ml-1">Size</label>
                      <SearchableDropdown
                        value={formData.size}
                        onSelect={(opt) => setFormData({ ...formData, size: opt.label || opt.id })}
                        options={activeSizeOptions}
                        placeholder="Select size..."
                      />
                    </div>
                  )}
              </div>
            </div>

            {/* Right Column: Description preview & Setup details */}
            <div className="lg:col-span-6 space-y-6">
              <h3 className="text-xs font-black text-indigo-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                4. Description & Details
              </h3>

              <div className="space-y-4">
                {/* Description input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-black text-slate-455 uppercase tracking-widest ml-1">Listing Description</label>
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
                      className="w-full p-4 bg-slate-50/50 border border-slate-150 rounded-xl text-xs font-semibold text-slate-700 leading-relaxed min-h-[250px] overflow-y-auto max-h-[300px] shadow-inner"
                      style={{ whiteSpace: 'pre-wrap' }}
                    >
                      {formData.description}
                    </div>
                  )}
                </div>

                <div className="p-5 bg-indigo-50/40 border border-indigo-100 rounded-2xl space-y-3">
                  <h4 className="text-[10px] font-black text-indigo-900 uppercase tracking-wider">eLister Listing Setup</h4>
                  <p className="text-[11px] text-indigo-755 leading-relaxed font-semibold">
                    Mercari listings are stored as drafts in eLister. You can copy details (Title, Price, Description, Images) to Mercari easily using the <b>Copy Details</b> feature in listings.
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* Shipping Method Section (Full Width at Bottom) */}
          <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-150 space-y-6 mt-6 animate-in fade-in duration-300">
            <h3 className="text-xs font-black text-indigo-900 uppercase tracking-wider border-b border-slate-150 pb-3">
              5. Shipping Method Details
            </h3>

            <div className="space-y-4">
              {/* Option 1: Prepaid Label */}
              <div className={`p-5 rounded-2xl border transition-all ${formData.shippingMethod === 'prepaid' ? 'bg-white border-indigo-500 shadow-sm ring-2 ring-indigo-500/5' : 'bg-transparent border-slate-200 opacity-70'}`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input 
                    type="radio" 
                    name="shippingMethod" 
                    value="prepaid"
                    checked={formData.shippingMethod === 'prepaid'}
                    onChange={() => setFormData(prev => ({ 
                      ...prev, 
                      shippingMethod: 'prepaid', 
                      shippingPayer: prev.shippingPayer === 'seller' ? 'seller' : 'buyer' 
                    }))}
                    className="mt-1"
                  />
                  <div className="space-y-1 w-full">
                    <span className="text-xs font-extrabold text-slate-800">Prepaid label</span>
                    <p className="text-[10px] font-medium text-slate-500">We'll email you a label and you'll ship the item. Includes delivery protection. Save an average of 25% off retail.</p>
                  </div>
                </label>

                {formData.shippingMethod === 'prepaid' && (
                  <div className="mt-4 pt-4 border-t border-slate-100 space-y-4 animate-in fade-in duration-200">
                    {/* Offer Free Shipping Dropdown inside Prepaid */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 p-3.5 rounded-xl border border-slate-150">
                      <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Offer buyers free shipping?</span>
                      <select 
                        className="px-3 h-9 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 cursor-pointer w-full sm:w-56"
                        value={formData.shippingPayer === 'seller' ? 'yes' : 'no'}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          shippingPayer: e.target.value === 'yes' ? 'seller' : 'buyer' 
                        }))}
                      >
                        <option value="no">No (Buyer Pays)</option>
                        <option value="yes">Yes (Seller Pays / Free for Buyer)</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Weight Inputs */}
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 space-y-2 shadow-inner">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Package Weight</span>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">lb</label>
                            <input 
                              type="number"
                              className="w-full px-3 h-9 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-indigo-500"
                              value={formData.shippingWeightLbs}
                              min="0"
                              onChange={(e) => setFormData(prev => ({ ...prev, shippingWeightLbs: Math.max(0, parseInt(e.target.value) || 0) }))}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">oz</label>
                            <input 
                              type="number"
                              className="w-full px-3 h-9 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-indigo-500"
                              value={formData.shippingWeightOz}
                              min="0"
                              max="15"
                              onChange={(e) => setFormData(prev => ({ ...prev, shippingWeightOz: Math.min(15, Math.max(0, parseInt(e.target.value) || 0)) }))}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Fits in Shoebox Question */}
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 space-y-2 flex flex-col justify-between shadow-inner">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Fits in Standard Shoebox?</span>
                        <div className="flex gap-4 pb-1">
                          <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                            <input 
                              type="radio" 
                              name="shippingFitsShoebox" 
                              checked={formData.shippingFitsShoebox === true}
                              onChange={() => setFormData(prev => ({ ...prev, shippingFitsShoebox: true }))}
                            /> Yes (under 14"x10"x5")
                          </label>
                          <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                            <input 
                              type="radio" 
                              name="shippingFitsShoebox" 
                              checked={formData.shippingFitsShoebox === false}
                              onChange={() => setFormData(prev => ({ ...prev, shippingFitsShoebox: false }))}
                            /> No (Custom size)
                          </label>
                        </div>
                      </div>

                      {/* Dimensions Inputs (only if fits shoebox is false) */}
                      <div className={`bg-slate-50 p-4 rounded-xl border border-slate-150 space-y-2 transition-opacity duration-200 shadow-inner ${formData.shippingFitsShoebox ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Dimensions (inches)</span>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Length</label>
                            <input 
                              type="number"
                              className="w-full px-2 h-9 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none"
                              value={formData.shippingFitsShoebox ? '' : formData.shippingLength}
                              disabled={formData.shippingFitsShoebox}
                              onChange={(e) => setFormData(prev => ({ ...prev, shippingLength: Math.max(0, parseInt(e.target.value) || 0) }))}
                              placeholder="L"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Width</label>
                            <input 
                              type="number"
                              className="w-full px-2 h-9 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none"
                              value={formData.shippingFitsShoebox ? '' : formData.shippingWidth}
                              disabled={formData.shippingFitsShoebox}
                              onChange={(e) => setFormData(prev => ({ ...prev, shippingWidth: Math.max(0, parseInt(e.target.value) || 0) }))}
                              placeholder="W"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Height</label>
                            <input 
                              type="number"
                              className="w-full px-2 h-9 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none"
                              value={formData.shippingFitsShoebox ? '' : formData.shippingHeight}
                              disabled={formData.shippingFitsShoebox}
                              onChange={(e) => setFormData(prev => ({ ...prev, shippingHeight: Math.max(0, parseInt(e.target.value) || 0) }))}
                              placeholder="H"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Carrier Selection Cards */}
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Select Shipping Label / Carrier Partner</span>
                        {formData.shippingPayer === 'seller' && (
                          <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded-md">
                            Seller Pays (${formData.shippingPrice} deducted from payout)
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {carrierOptions.map((opt) => {
                          const isSelected = formData.shippingCarrier === opt.carrier;
                          return (
                            <div 
                              key={opt.carrier}
                              onClick={() => setFormData(prev => ({ ...prev, shippingCarrier: opt.carrier, shippingPrice: opt.price }))}
                              className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between h-24 shadow-sm ${isSelected ? 'bg-indigo-50/50 border-indigo-500 ring-2 ring-indigo-500/15' : 'bg-white border-slate-200 hover:border-indigo-400'}`}
                            >
                              <span className="text-[10px] font-black text-slate-800 leading-tight">{opt.carrier}</span>
                              <div className="flex items-end justify-between mt-2">
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Up to {opt.weightText}</span>
                                <span className="text-sm font-black text-indigo-650">${opt.price}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {/* Warning Alerts */}
                      {carrierOptions.some(o => o.warning && o.carrier === formData.shippingCarrier) && (
                        <div className="mt-3 bg-amber-50 border border-amber-200 text-amber-800 p-3.5 rounded-2xl text-[10px] font-semibold leading-relaxed animate-in fade-in duration-200">
                          ⚠️ {carrierOptions.find(o => o.warning && o.carrier === formData.shippingCarrier).warning}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Option 2: Ship on your own */}
              <div className={`p-5 rounded-2xl border transition-all ${formData.shippingMethod === 'ship_on_your_own' ? 'bg-white border-indigo-500 shadow-sm ring-2 ring-indigo-500/5' : 'bg-transparent border-slate-200 opacity-70'}`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input 
                    type="radio" 
                    name="shippingMethod" 
                    value="ship_on_your_own"
                    checked={formData.shippingMethod === 'ship_on_your_own'}
                    onChange={() => setFormData(prev => ({ 
                      ...prev, 
                      shippingMethod: 'ship_on_your_own', 
                      shippingPayer: 'seller', // Always seller pays for ship on your own
                      shippingCarrier: 'Ship on your own',
                      shippingPrice: '0.00'
                    }))}
                    className="mt-1"
                  />
                  <div className="space-y-1 w-full">
                    <span className="text-xs font-extrabold text-slate-800">Ship on your own</span>
                    <p className="text-[10px] font-medium text-slate-500">You provide your own label and ship the item. It's not covered by shipping protection.</p>
                  </div>
                </label>

                {formData.shippingMethod === 'ship_on_your_own' && (
                  <div className="mt-4 pt-3 border-t border-slate-100 text-xs font-semibold text-slate-650 leading-relaxed bg-slate-50 p-4 rounded-xl shadow-inner border border-slate-150 animate-in fade-in duration-200">
                    ℹ️ You will manually buy a shipping label outside Mercari. Shipping is free for the buyer. Delivery protection is not included.
                  </div>
                )}
              </div>
            </div>
          </div>
          </>
        )}

        {/* Form Bottom Submission Control (Only visible when scanned) */}
        {hasScanned && !loading && (
          <div className="mt-8 pt-6 flex justify-end items-center gap-3 border-t border-slate-100 animate-in fade-in duration-300">
            <button 
              type="button"
              onClick={() => navigate('/listings')}
              className="px-6 py-3 border border-slate-200 hover:bg-slate-50 rounded-2xl text-xs font-extrabold text-slate-655 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="button"
              onClick={() => handleSaveListing(null)}
              disabled={loading || isConvertingImages || !allImagesLoaded}
              className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold text-xs hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50 cursor-pointer"
            >
              Save Draft
            </button>
            <button 
              type="button"
              onClick={() => handleSaveListing('direct')}
              disabled={loading || isConvertingImages || !allImagesLoaded}
              className="px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold text-xs hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Working...' : 'List via Direct API'}
            </button>
            <button 
              type="button"
              onClick={() => handleSaveListing('extension')}
              disabled={loading || isConvertingImages || !allImagesLoaded}
              className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-xs hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Working...' : 'List via Extension'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default CreateMercariListing;
