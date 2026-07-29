import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Upload, 
  ImageIcon,
  DollarSign,
  Info,
  Zap,
  Sparkles,
  Loader2,
  X,
  Tag,
  List,
  Eye,
  Trash2,
  ArrowLeft,
  ArrowRight,
  ShoppingBag,
  RefreshCw
} from 'lucide-react';
import { ruleService, aiService, listingService, etsyService } from '../services/api';
import CategorySearchDropdown from '../components/CategorySearchDropdown';
import { useNotification } from '../context/NotificationContext';
import { compressImage } from '../utils/imageCompressor';

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
        <span className="flex items-center gap-1.5 shrink-0">
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
        </span>
      </button>

      {isOpen && !disabled && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[500] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-3 bg-slate-50 border-b border-slate-100">
            <input
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
              className="w-full h-10 px-4 rounded-xl border border-slate-200 text-sm font-semibold outline-none focus:border-indigo-500"
            />
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
                className="w-full text-left px-4 py-3 border-b border-slate-50 last:border-b-0 hover:bg-indigo-600 hover:text-white transition-colors text-xs font-bold text-slate-700"
              >
                {opt.label}
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

const ChevronDown = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const MASTER_CONDITIONS = [
  { id: "new", label: "New", description: "Brand new, unused, unopened, or with original tags." },
  { id: "like_new", label: "Like New", description: "Mint condition pre-owned, no visible signs of wear." },
  { id: "good", label: "Good", description: "Gently used, shows minor signs of wear but still in good shape." },
  { id: "fair", label: "Fair", description: "Obvious wear or minor blemishes." }
];

const CreateMasterListing = ({ platform = 'ebay' }) => {
  const navigate = useNavigate();
  const { toast } = useNotification();
  const [targetPlatform, setTargetPlatform] = useState(platform);
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const [hasScanned, setHasScanned] = useState(editId ? true : false);
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState([]);
  const [files, setFiles] = useState([]);
  const [formData, setFormData] = useState({
    images: [],
    selectedRule: '',
    selectedCondition: '',
    conditionId: '',
    title: '',
    category: '',
    categoryId: '',
    price: '',
    description: '',
    conditionNote: '',
    sku: '',
    brand: '',
    size: '',
    color: '',
    selectedModel: 'gpt-4o-mini',
    packageWeight: { lbs: '', oz: '' },
    who_made: 'i_did',
    when_made: '2020_2026',
    is_supply: 'false',
    renewal: 'manual',
    styleTag: '',
    material: '',
    quantity: '1',
    shipping_profile_id: '',
    etsyAttributes: {},
  });
  const [shippingProfiles, setShippingProfiles] = useState([]);
  const [etsyProperties, setEtsyProperties] = useState([]);
  const [isConvertingImages, setIsConvertingImages] = useState(false);
  const [loadedImages, setLoadedImages] = useState({});
  const [etsyUrlInput, setEtsyUrlInput] = useState('');

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
          setRules(response.data.data);
          const defaultRule = response.data.data.find(r => r.isDefault) || response.data.data[0];
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
    const fetchShippingProfiles = async () => {
      try {
        const response = await etsyService.getShippingProfiles();
        if (response.data?.success) {
          setShippingProfiles(response.data.data);
        }
      } catch (err) {
        console.error("Failed to fetch Etsy shipping profiles:", err);
      }
    };
    fetchShippingProfiles();
  }, []);

  // Clear or re-resolve category ID on platform switch
  useEffect(() => {
    if (formData.category) {
      setFormData(prev => ({ ...prev, categoryId: '' }));
    }
  }, [targetPlatform]);

  // Auto-resolve Etsy category ID from text
  useEffect(() => {
    if (targetPlatform === 'etsy' && formData.category && !formData.categoryId) {
      console.log("Auto-resolving Etsy category ID for path:", formData.category);
      toast.info("Auto-resolving category ID for " + formData.category);
      etsyService.resolveCategory(formData.category)
        .then(res => {
          if (res.data?.success && res.data.data) {
            console.log("Auto-resolved category successfully:", res.data.data);
            toast.success("Category resolved: " + res.data.data.fullName + " (ID: " + res.data.data.id + ")");
            setFormData(prev => ({
              ...prev,
              categoryId: res.data.data.id
            }));
          } else {
            toast.warning("Failed to resolve category ID: " + (res.data?.message || 'No match found'));
          }
        })
        .catch(err => {
          console.error("Error auto-resolving Etsy category:", err);
          toast.error("Auto-resolve error: " + (err.response?.data?.message || err.message));
        });
    }
  }, [targetPlatform, formData.category, formData.categoryId]);

  // Fetch Etsy category properties
  useEffect(() => {
    if (targetPlatform === 'etsy' && formData.categoryId) {
      console.log("Fetching Etsy properties for category:", formData.categoryId);
      toast.info("Fetching Etsy properties for category " + formData.categoryId);
      etsyService.getCategoryProperties(formData.categoryId)
        .then(res => {
          if (res.data?.success) {
            console.log("Etsy properties fetched successfully:", res.data.data?.length, "properties");
            toast.success("Loaded " + (res.data.data?.length || 0) + " Etsy properties!");
            setEtsyProperties(res.data.data || []);
          } else {
            toast.warning("Failed to fetch Etsy properties: " + (res.data?.message || 'Unknown response'));
          }
        })
        .catch(err => {
          console.error("Error fetching Etsy properties:", err);
          toast.error("Fetch properties error: " + (err.response?.data?.message || err.message));
        });
    } else {
      setEtsyProperties([]);
    }
  }, [targetPlatform, formData.categoryId]);

  // Synchronize standard fields (color, size, material) into etsyAttributes map
  useEffect(() => {
    if (targetPlatform === 'etsy' && etsyProperties.length > 0) {
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
  }, [targetPlatform, etsyProperties, formData.color, formData.size, formData.material]);

  useEffect(() => {
    if (editId) {
      const fetchListing = async () => {
        try {
          setLoading(true);
          const response = await listingService.getOne(editId);
          if (response.data.success) {
            const listing = response.data.data;
            setTargetPlatform(listing.platform || platform);
            setFormData({
              images: (listing.images || []).filter(img => typeof img === 'string' && !img.startsWith('blob:')),
              selectedRule: listing.selectedRule || '',
              selectedCondition: listing.selectedCondition || '',
              conditionId: listing.conditionId || '',
              title: listing.title || '',
              category: listing.category || '',
              categoryId: listing.categoryId || '',
              price: listing.price || '',
              description: listing.description || '',
              conditionNote: listing.conditionNote || '',
              sku: listing.sku || '',
              brand: listing.brand || '',
              size: listing.size || '',
              color: listing.color || '',
              selectedModel: listing.selectedModel || 'gpt-4o-mini',
              packageWeight: listing.packageWeight || { lbs: '', oz: '' },
              who_made: listing.etsyWhoMade || 'i_did',
              when_made: listing.etsyWhenMade || '2020_2026',
              is_supply: String(listing.etsyIsSupply !== undefined ? listing.etsyIsSupply : 'false'),
              renewal: listing.etsyRenewal || 'manual',
              styleTag: listing.styleTag || '',
              material: listing.material || '',
              quantity: String(listing.quantity || '1'),
              shipping_profile_id: listing.etsyShippingProfileId || '',
              etsyAttributes: listing.etsyAttributes || {},
            });
            setHasScanned(true);
          }
        } catch (error) {
          console.error("Error fetching listing:", error);
          toast.error("Failed to load listing details.");
        } finally {
          setLoading(false);
        }
      };
      fetchListing();
    }
  }, [editId]);

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
      console.error("Error processing images:", err);
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
      toast.warning("Please select an AI Rule.");
      return;
    }
    if (!formData.selectedCondition) {
      toast.warning("Please select a Condition.");
      return;
    }

    setLoading(true);
    setHasScanned(true);

    const selectedRuleObj = rules.find(r => (r._id || r.id) === formData.selectedRule);

    try {
      const response = targetPlatform === 'etsy'
        ? await aiService.etsyAnalyze({
            images: formData.images,
            title_sequence: selectedRuleObj?.title_sequence || [],
            description_prompt: selectedRuleObj?.description_prompt || '',
            description_template: selectedRuleObj?.description_template || '',
            condition_name: formData.selectedCondition,
            model: formData.selectedModel || 'gpt-4o-mini'
          })
        : await aiService.analyze({
            images: formData.images,
            platform: 'ebay',
            title_sequence: selectedRuleObj?.title_sequence || [],
            description_prompt: selectedRuleObj?.description_prompt || '',
            description_template: selectedRuleObj?.description_template || '',
            condition_note: selectedRuleObj?.condition_note || '',
            condition_name: formData.selectedCondition,
            model: formData.selectedModel || 'gpt-4o-mini'
          });

      if (response.data.success) {
        const result = response.data.data;
        if (targetPlatform === 'etsy') {
          setFormData(prev => ({
            ...prev,
            title: result.title,
            price: result.price,
            description: result.description,
            conditionNote: selectedRuleObj?.condition_note || '',
            category: result.category,
            categoryId: result.categoryId,
            sku: result.sku || '',
            brand: result.brand || '',
            size: result.size || '',
            color: result.color || '',
            images: result.images || prev.images,
            who_made: result.who_made || 'i_did',
            when_made: result.when_made || '2020_2026',
            is_supply: String(result.is_supply !== undefined ? result.is_supply : 'false'),
            renewal: result.renewal || 'manual',
            styleTag: result.styleTag || '',
            material: result.material || '',
            quantity: String(result.quantity || '1'),
          }));
        } else {
          setFormData(prev => ({
            ...prev,
            title: result.title,
            price: result.price,
            description: result.description,
            conditionNote: selectedRuleObj?.condition_note || '',
            category: result.category_name || result.category,
            categoryId: result.category_id,
            sku: result.sku || '',
            brand: result.brand || '',
            size: result.size || '',
            color: result.color || '',
            images: result.images || prev.images,
            packageWeight: selectedRuleObj?.packageWeight || { lbs: '', oz: '' },
            who_made: result.who_made || 'i_did',
            when_made: result.when_made || '2020_2026',
            is_supply: String(result.is_supply !== undefined ? result.is_supply : 'false'),
            renewal: result.renewal || 'manual',
          }));
        }
        toast.success("AI Scan complete! Preview or save listing below.");
      }
    } catch (error) {
      console.error("AI Scan Error:", error);
      toast.error("Failed to analyze image with AI.");
    } finally {
      setLoading(false);
    }
  };

  const handleEtsyFetch = async () => {
    if (!etsyUrlInput) {
      toast.warning("Please enter an Etsy listing URL.");
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
      const response = await aiService.etsyFetch({
        url: etsyUrlInput,
        title_sequence: selectedRuleObj?.title_sequence || [],
        description_prompt: selectedRuleObj?.description_prompt || '',
        description_template: selectedRuleObj?.description_template || '',
        condition_name: formData.selectedCondition || 'Pre-owned',
        model: formData.selectedModel || 'gpt-4o-mini',
        platform: targetPlatform,
        gender: 'Unisex'
      });

      if (response.data.success) {
        const result = response.data.data;
        setFormData(prev => ({
          ...prev,
          title: result.title,
          price: result.price,
          description: result.description,
          conditionNote: selectedRuleObj?.condition_note || '',
          category: result.category,
          sku: result.sku || '',
          brand: result.brand || '',
          size: result.size || '',
          color: result.color || '',
          images: result.images || [],
          who_made: result.who_made || 'i_did',
          when_made: result.when_made || '2020_2026',
          is_supply: String(result.is_supply !== undefined ? result.is_supply : 'false'),
          renewal: result.renewal || 'manual',
          styleTag: result.styleTag || '',
          material: result.material || '',
          quantity: String(result.quantity || '1'),
        }));
        toast.success("Etsy AI Fetch complete! Preview or save listing below.");
      }
    } catch (error) {
      console.error("Etsy AI Fetch Error:", error);
      toast.error(error.response?.data?.error || "Failed to fetch Etsy listing using AI.");
    } finally {
      setLoading(false);
    }
  };

  const ruleOptions = useMemo(() => rules.map(rule => ({
    id: rule._id || rule.id,
    label: rule.name
  })), [rules]);

  const conditionOptions = useMemo(() => MASTER_CONDITIONS.map(c => ({
    id: c.id,
    label: c.label
  })), []);

  const deleteImage = (index) => {
    const newImages = formData.images.filter((_, idx) => idx !== index);
    const newFiles = files.filter((_, idx) => idx !== index);
    setFormData(prev => ({ ...prev, images: newImages }));
    setFiles(newFiles);
  };

  const moveImage = (index, direction) => {
    const newImages = [...formData.images];
    if (direction === 'left' && index > 0) {
      const temp = newImages[index];
      newImages[index] = newImages[index - 1];
      newImages[index - 1] = temp;
    } else if (direction === 'right' && index < newImages.length - 1) {
      const temp = newImages[index];
      newImages[index] = newImages[index + 1];
      newImages[index + 1] = temp;
    }
    setFormData(prev => ({ ...prev, images: newImages }));
  };

  const handleSaveDraft = async () => {
    setLoading(true);
    const listingData = {
      title: formData.title,
      description: formData.description,
      price: formData.price,
      sku: formData.sku,
      category: formData.category,
      categoryId: formData.categoryId,
      images: formData.images,
      selectedRule: formData.selectedRule,
      selectedCondition: formData.selectedCondition,
      conditionId: formData.conditionId,
      selectedModel: formData.selectedModel || 'gpt-4o-mini',
      packageWeight: formData.packageWeight || { lbs: 0, oz: 0 },
      brand: formData.brand,
      size: formData.size,
      color: formData.color,
      status: 'draft',
      platform: targetPlatform,
      etsyWhoMade: formData.who_made,
      etsyWhenMade: formData.when_made,
      etsyIsSupply: formData.is_supply === 'true' || formData.is_supply === true,
      etsyRenewal: formData.renewal,
      etsyShippingProfileId: formData.shipping_profile_id,
      etsyAttributes: formData.etsyAttributes,
      styleTag: formData.styleTag,
      material: formData.material,
      quantity: parseInt(formData.quantity) || 1
    };

    try {
      const response = editId
        ? await listingService.update(editId, listingData)
        : await listingService.create(listingData);
      if (response.data.success) {
        toast.success(editId ? 'Listing updated successfully!' : 'Listing saved successfully!');
        navigate('/listings');
      }
    } catch (error) {
      console.error("Error saving listing:", error);
      toast.error(error.response?.data?.message || "Failed to save listing.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndPublish = async () => {
    if (targetPlatform === 'etsy' && !formData.shipping_profile_id) {
      toast.error("Please select an Etsy Delivery Profile before listing.");
      return;
    }
    setLoading(true);
    const listingData = {
      title: formData.title,
      description: formData.description,
      price: formData.price,
      sku: formData.sku,
      category: formData.category,
      categoryId: formData.categoryId,
      images: formData.images,
      selectedRule: formData.selectedRule,
      selectedCondition: formData.selectedCondition,
      conditionId: formData.conditionId,
      selectedModel: formData.selectedModel || 'gpt-4o-mini',
      packageWeight: formData.packageWeight || { lbs: 0, oz: 0 },
      brand: formData.brand,
      size: formData.size,
      color: formData.color,
      status: 'draft',
      platform: targetPlatform,
      etsyWhoMade: formData.who_made,
      etsyWhenMade: formData.when_made,
      etsyIsSupply: formData.is_supply === 'true' || formData.is_supply === true,
      etsyRenewal: formData.renewal,
      etsyShippingProfileId: formData.shipping_profile_id,
      etsyAttributes: formData.etsyAttributes,
      styleTag: formData.styleTag,
      material: formData.material,
      quantity: parseInt(formData.quantity) || 1
    };

    try {
      const response = editId
        ? await listingService.update(editId, listingData)
        : await listingService.create(listingData);
      
      if (response.data.success) {
        const createdListing = response.data.data;
        const activeListingId = editId || createdListing._id || createdListing.id;
        
        toast.info(`Saved locally. Publishing to ${targetPlatform}...`);
        
        if (targetPlatform === 'etsy') {
          const publishRes = await etsyService.publish(activeListingId);
          if (publishRes.data?.success) {
            toast.success('Listing successfully published to Etsy!');
          }
        }
        
        navigate('/listings');
      }
    } catch (error) {
      console.error("Error saving and listing:", error);
      toast.error(error.response?.data?.message || "Failed to save or list.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[95%] mx-auto space-y-8 px-4 py-6">
      <div style={{ display: 'none' }}>
        {formData.images.map((img, idx) => (
          <img 
            key={`preload-${idx}`}
            src={img}
            onLoad={() => setLoadedImages(prev => ({ ...prev, [idx]: true }))}
          />
        ))}
      </div>

      <div className="flex justify-between items-end border-b border-slate-100 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">
            {editId ? 'Edit Product Listing' : targetPlatform === 'etsy' ? 'Create Etsy Product Listing' : 'Create Master Product Listing'}
          </h1>
          <p className="text-slate-500 text-xs font-semibold mt-1">
            {targetPlatform === 'etsy' ? 'Prefill Etsy Listing Details and Images using AI Scan' : 'Prefill All Marketplace Listings from Image Scan'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5 space-y-6">

          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <ImageIcon className="text-indigo-500" size={16} /> Product Images
            </h2>

            <div className="grid grid-cols-3 gap-3">
              {formData.images.map((img, idx) => (
                <div key={idx} className="relative aspect-square border border-slate-100 rounded-2xl overflow-hidden group">
                  <img src={img} className="w-full h-full object-cover" alt="" />
                  
                  {/* Hover Actions */}
                  <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => moveImage(idx, 'left')}
                        className="p-1.5 bg-slate-900/80 hover:bg-indigo-600 rounded-lg text-white transition-colors cursor-pointer text-xs"
                        title="Move left"
                      >
                        <ArrowLeft size={12} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteImage(idx)}
                      className="p-1.5 bg-slate-900/80 hover:bg-rose-600 rounded-lg text-white transition-colors cursor-pointer text-xs"
                      title="Delete"
                    >
                      <Trash2 size={12} />
                    </button>
                    {idx < formData.images.length - 1 && (
                      <button
                        type="button"
                        onClick={() => moveImage(idx, 'right')}
                        className="p-1.5 bg-slate-900/80 hover:bg-indigo-600 rounded-lg text-white transition-colors cursor-pointer text-xs"
                        title="Move right"
                      >
                        <ArrowRight size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {formData.images.length < 12 && (
                <label className="aspect-square border border-dashed border-slate-200 hover:border-indigo-500 rounded-2xl flex flex-col items-center justify-center gap-1.5 cursor-pointer bg-slate-50/50 hover:bg-indigo-50/10 transition-all">
                  <Upload size={16} className="text-slate-400" />
                  <span className="text-[10px] font-bold text-slate-500">Upload</span>
                  <input type="file" multiple onChange={handleImageUpload} className="hidden" />
                </label>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-6">
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Zap className="text-indigo-500" size={16} /> Scanning Parameters
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">AI Scan Rule</label>
                <SearchableDropdown
                  value={rules.find(r => (r._id || r.id) === formData.selectedRule)?.name || ''}
                  options={ruleOptions}
                  onSelect={(opt) => setFormData(prev => ({ ...prev, selectedRule: opt.id }))}
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Condition</label>
                <SearchableDropdown
                  value={formData.selectedCondition}
                  options={conditionOptions}
                  onSelect={(opt) => setFormData(prev => ({ ...prev, selectedCondition: opt.label, conditionId: opt.id }))}
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">AI Model</label>
                <SearchableDropdown
                  value={modelOptions.find(m => m.id === formData.selectedModel)?.label || ''}
                  options={modelOptions}
                  onSelect={(opt) => setFormData(prev => ({ ...prev, selectedModel: opt.id }))}
                />
              </div>

              <button
                onClick={startAIFetch}
                disabled={loading || isConvertingImages}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {loading ? 'AI Scanning Product...' : 'Scan Image with AI'}
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 space-y-6">
          {hasScanned ? (
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-6">
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2 border-b border-slate-50 pb-4">
                <List className="text-indigo-500" size={16} /> Listing Details
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Listing Title</label>
                  <input
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:border-indigo-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Price ($)</label>
                    <div className="relative">
                      <DollarSign size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        value={formData.price}
                        onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                        className="w-full pl-9 pr-4 py-3 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:border-indigo-500 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">SKU / Custom Label</label>
                    <input
                      value={formData.sku}
                      onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                      className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">AI Suggest Category Path</label>
                  <CategorySearchDropdown
                    value={formData.category}
                    platform={targetPlatform}
                    onSelect={(opt) => {
                      setFormData(prev => ({
                        ...prev,
                        category: opt.fullName || opt.label,
                        categoryId: opt.id
                      }));
                    }}
                    placeholder="Search category path..."
                  />
                </div>

                {targetPlatform !== 'etsy' ? (
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Brand</label>
                      <input
                        value={formData.brand}
                        onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                        className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:border-indigo-500 outline-none"
                        placeholder="Brand..."
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-455 uppercase tracking-widest block mb-2">Size</label>
                      <input
                        value={formData.size}
                        onChange={(e) => setFormData(prev => ({ ...prev, size: e.target.value }))}
                        className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:border-indigo-500 outline-none"
                        placeholder="Size..."
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-455 uppercase tracking-widest block mb-2">Color</label>
                      <input
                        value={formData.color}
                        onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                        className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:border-indigo-500 outline-none"
                        placeholder="Color..."
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-455 uppercase tracking-widest block mb-2">Size</label>
                      {etsyProperties.find(p => p.property_id === 100 || p.name === 'TeeShirtSize' || p.display_name === 'Size') ? (
                        (() => {
                          const prop = etsyProperties.find(p => p.property_id === 100 || p.name === 'TeeShirtSize' || p.display_name === 'Size');
                          const valOptions = (prop.possible_values || []).map(v => ({ id: String(v.value_id), label: v.name }));
                          return (
                            <SearchableDropdown
                              value={formData.size}
                              onSelect={(opt) => setFormData(prev => ({ ...prev, size: opt.label }))}
                              options={valOptions}
                              placeholder="Select Size..."
                            />
                          );
                        })()
                      ) : (
                        <input
                          value={formData.size}
                          onChange={(e) => setFormData(prev => ({ ...prev, size: e.target.value }))}
                          className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:border-indigo-500 outline-none"
                          placeholder="Size..."
                        />
                      )}
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-455 uppercase tracking-widest block mb-2">Color</label>
                      {etsyProperties.find(p => p.property_id === 200 || p.name === 'Primary color') ? (
                        (() => {
                          const prop = etsyProperties.find(p => p.property_id === 200 || p.name === 'Primary color');
                          const valOptions = (prop.possible_values || []).map(v => ({ id: String(v.value_id), label: v.name }));
                          return (
                            <SearchableDropdown
                              value={formData.color}
                              onSelect={(opt) => setFormData(prev => ({ ...prev, color: opt.label }))}
                              options={valOptions}
                              placeholder="Select Color..."
                            />
                          );
                        })()
                      ) : (
                        <input
                          value={formData.color}
                          onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                          className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:border-indigo-500 outline-none"
                          placeholder="Color..."
                        />
                      )}
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-455 uppercase tracking-widest block mb-2">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={formData.quantity}
                        onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                        className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:border-indigo-500 outline-none"
                        placeholder="1"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-455 uppercase tracking-widest block mb-2">Materials</label>
                    {etsyProperties.find(p => p.property_id === 148789511893 || p.display_name === 'Materials' || p.name === 'Material multi') ? (
                      (() => {
                        const prop = etsyProperties.find(p => p.property_id === 148789511893 || p.display_name === 'Materials' || p.name === 'Material multi');
                        const valOptions = (prop.possible_values || []).map(v => ({ id: String(v.value_id), label: v.name }));
                        return (
                          <SearchableDropdown
                            value={formData.material}
                            onSelect={(opt) => setFormData(prev => ({ ...prev, material: opt.label }))}
                            options={valOptions}
                            placeholder="Select Material..."
                          />
                        );
                      })()
                    ) : (
                      <input
                        value={formData.material}
                        onChange={(e) => setFormData(prev => ({ ...prev, material: e.target.value }))}
                        className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:border-indigo-500 outline-none"
                        placeholder="e.g. Chenille, Cotton (up to 4)"
                      />
                    )}
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-455 uppercase tracking-widest block mb-2">Style Tags (Up to 13)</label>
                    <input
                      value={formData.styleTag}
                      onChange={(e) => setFormData(prev => ({ ...prev, styleTag: e.target.value }))}
                      className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:border-indigo-500 outline-none"
                      placeholder="e.g. vintage, cottagecore"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-455 uppercase tracking-widest block mb-2">Who Made It?</label>
                    <select
                      value={formData.who_made || 'i_did'}
                      onChange={(e) => setFormData(prev => ({ ...prev, who_made: e.target.value }))}
                      className="w-full px-3 py-3 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:border-indigo-500 outline-none bg-white cursor-pointer h-12"
                    >
                      <option value="i_did">I did (Handmade)</option>
                      <option value="collective">A member of my shop (Handmade)</option>
                      <option value="someone_else">Another company or person (Vintage)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-455 uppercase tracking-widest block mb-2">What Is It?</label>
                    <select
                      value={formData.is_supply || 'false'}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_supply: e.target.value }))}
                      className="w-full px-3 py-3 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:border-indigo-500 outline-none bg-white cursor-pointer h-12"
                    >
                      <option value="false">A finished product</option>
                      <option value="true">A supply or tool to make things</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-455 uppercase tracking-widest block mb-2">When Was It Made?</label>
                    <select
                      value={formData.when_made || '2020_2026'}
                      onChange={(e) => setFormData(prev => ({ ...prev, when_made: e.target.value }))}
                      className="w-full px-3 py-3 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:border-indigo-500 outline-none bg-white cursor-pointer h-12"
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
                    <label className="text-[10px] font-black text-slate-455 uppercase tracking-widest block mb-2">Renewal Options</label>
                    <select
                      value={formData.renewal || 'manual'}
                      onChange={(e) => setFormData(prev => ({ ...prev, renewal: e.target.value }))}
                      className="w-full px-3 py-3 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:border-indigo-500 outline-none bg-white cursor-pointer h-12"
                    >
                      <option value="automatic">Automatic</option>
                      <option value="manual">Manual</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 mb-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[10px] font-black text-slate-455 uppercase tracking-widest block">Etsy Delivery Profile</label>
                      <button 
                        type="button" 
                        onClick={handleRefreshShippingProfiles}
                        className="text-[10px] font-extrabold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3 animate-spin-hover" /> Refresh Profiles
                      </button>
                    </div>
                    <select
                      value={formData.shipping_profile_id || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, shipping_profile_id: e.target.value }))}
                      className="w-full px-3 py-3 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:border-indigo-500 outline-none bg-white cursor-pointer h-12"
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
                </div>

                {/* Etsy Dynamic Category Properties */}
                {targetPlatform === 'etsy' && etsyProperties.length > 0 && (
                  <div className="border border-slate-200 p-6 rounded-3xl bg-slate-50/20 mb-4 space-y-4">
                    <h4 className="text-xs font-black text-indigo-900 uppercase tracking-widest flex items-center justify-between pb-2 border-b border-slate-100">
                      <span>Etsy Category Attributes</span>
                      <span className="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg font-extrabold">Taxonomy: {formData.categoryId || '-'}</span>
                    </h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-2">
                      {etsyProperties
                        .filter(prop => {
                          const isColor = prop.property_id === 200 || prop.name === 'Primary color';
                          const isSize = prop.property_id === 100 || prop.name === 'TeeShirtSize' || prop.display_name === 'Size';
                          const isMaterial = prop.property_id === 148789511893 || prop.display_name === 'Materials' || prop.name === 'Material multi';
                          return !isColor && !isSize && !isMaterial;
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
                                className="w-full px-3 py-3 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:border-indigo-500 outline-none bg-white h-12"
                                placeholder={`Enter ${name}...`}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Description</label>
                  <textarea
                    rows={8}
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:border-indigo-500 outline-none font-mono"
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    onClick={handleSaveDraft}
                    disabled={loading}
                    className="flex-1 py-3.5 bg-slate-900 hover:bg-slate-950 text-white rounded-2xl font-black text-xs transition-all shadow-lg flex items-center justify-center gap-1.5"
                  >
                    Save Master Listing
                  </button>
                  {targetPlatform === 'etsy' && (
                    <button
                      onClick={handleSaveAndPublish}
                      disabled={loading}
                      className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-2xl font-black text-xs transition-all shadow-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-indigo-100"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Publishing to Etsy...
                        </>
                      ) : (
                        <>
                          <ShoppingBag className="w-3.5 h-3.5" />
                          Save & List on Etsy
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50/50 border border-slate-100 rounded-3xl p-12 text-center flex flex-col items-center justify-center h-full min-h-[400px]">
              <Sparkles className="w-10 h-10 text-slate-300 mb-4 animate-pulse" />
              <h3 className="text-slate-700 font-bold text-sm">Waiting for Scan</h3>
              <p className="text-slate-400 text-xs mt-2 max-w-sm">
                Upload your product photos, choose a scanning parameter rule on the left, and trigger AI Scan to fill this page.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateMasterListing;
