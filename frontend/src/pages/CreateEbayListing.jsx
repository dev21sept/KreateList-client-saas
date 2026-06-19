import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { 
  Upload, 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2, 
  Image as ImageIcon,
  DollarSign,
  Info,
  Zap,
  Sparkles,
  Loader2,
  X,
  Search,
  ChevronDown,
  Check,
  Tag,
  List,
  Eye,
  Code,
  Trash2,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';
import { ruleService, aiService, ebayService, listingService } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { EBAY_CONDITIONS } from '../constants/ebayConditions';
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                autoFocus
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 text-sm font-semibold outline-none focus:border-indigo-500"
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

const CategorySearchDropdown = ({ value, onSelect, placeholder = 'Search category...' }) => {
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
        const response = await ebayService.suggestCategories(searchTerm);
        if (response.data.success) {
          setSuggestions(response.data.data);
        }
      } catch (err) {
        console.error("Error fetching category suggestions:", err);
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounce);
  }, [searchTerm]);

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div className="relative">
        <Tag size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500 z-10" />
        <input 
          className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all shadow-sm"
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
            <div className="p-4 text-xs font-semibold text-slate-400 text-center">Searching eBay Categories...</div>
          )}
          {!loading && suggestions.length === 0 && searchTerm.trim() && (
            <div className="p-4 text-xs font-semibold text-slate-400 text-center">No categories found</div>
          )}
          {!loading && suggestions.length === 0 && !searchTerm.trim() && (
            <div className="p-4 text-xs font-semibold text-slate-400 text-center">Type to search eBay categories...</div>
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
                <span className="text-xs font-bold text-slate-700 hover:text-inherit">{opt.label}</span>
                <span className="text-[9px] opacity-75">ID: {opt.id}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const CreateEbayListing = () => {
  const navigate = useNavigate();
  const { toast } = useNotification();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const platform = 'ebay';
  const [step, setStep] = useState(editId ? 2 : 1);
  const [loading, setLoading] = useState(false);
  const [descriptionMode, setDescriptionMode] = useState('preview'); // 'edit' or 'preview'
  const [rules, setRules] = useState([]);
  const [files, setFiles] = useState([]);
  const [aspects, setAspects] = useState([]);
  const [ebayPolicies, setEbayPolicies] = useState({ fulfillment: [], payment: [], returns: [], locations: [] });
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
    selectedAspects: {},
    sku: '',
    selectedModel: 'gpt-4o-mini',
    packageWeight: { lbs: '', oz: '' },
    returnPolicyId: '',
    locationKey: ''
  });
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

  useEffect(() => {
    const fetchEbayPolicies = async () => {
      try {
        const response = await ebayService.getPolicies();
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
      } catch (error) {
        console.error("Error fetching eBay policies in CreateEbayListing:", error);
      }
    };
    fetchEbayPolicies();
  }, []);

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
              category: listing.category || '',
              categoryId: listing.categoryId || '',
              price: listing.price || '',
              description: listing.description || '',
              conditionNote: listing.conditionNote || '',
              selectedAspects: listing.itemSpecifics || {},
              sku: listing.sku || '',
              selectedModel: listing.selectedModel || 'gpt-4o-mini',
              packageWeight: listing.packageWeight || { lbs: '', oz: '' },
              packageDimensions: listing.packageDimensions || { length: '', width: '', height: '' },
              fulfillmentPolicyId: listing.fulfillmentPolicyId || '',
              paymentPolicyId: listing.paymentPolicyId || '',
              returnPolicyId: listing.returnPolicyId || '',
              locationKey: listing.locationKey || ''
            });

            if (listing.categoryId) {
              try {
                const aspectsRes = await ebayService.getCategoryAspects(listing.categoryId);
                if (aspectsRes.data.success) {
                  setAspects(aspectsRes.data.data);
                }
              } catch (err) {
                console.error("Error fetching aspects in edit mode:", err);
              }
            }
            
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
        platform
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
      const response = await aiService.analyze({
        images: formData.images, 
        platform,
        title_sequence: selectedRuleObj?.title_sequence || [],
        description_prompt: selectedRuleObj?.description_prompt || '',
        condition_note: selectedRuleObj?.condition_note || '',
        condition_name: formData.selectedCondition,
        model: formData.selectedModel || 'gpt-4o-mini'
      });

      if (response.data.success) {
        const result = response.data.data;
        setAspects(result.aspects || []);
        
        const initialAspects = {};
        if (result.aspects) {
          result.aspects.forEach(aspect => {
            const name = aspect.localizedAspectName;
            if (result.item_specifics && result.item_specifics[name]) {
              initialAspects[name] = [result.item_specifics[name]];
            } 
            else if (result.title_parts && result.title_parts[name]) {
              initialAspects[name] = [result.title_parts[name]];
            }
          });
        }

        setFormData(prev => ({
          ...prev,
          title: result.title,
          price: result.price,
          description: result.description,
          conditionNote: selectedRuleObj?.condition_note || '',
          category: result.category_name || result.category,
          categoryId: result.category_id,
          selectedAspects: initialAspects,
          sku: result.sku || '',
          packageWeight: selectedRuleObj?.packageWeight || { lbs: '', oz: '' },
          packageDimensions: selectedRuleObj?.packageDimensions || { length: '', width: '', height: '' }
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

  const conditionOptions = useMemo(() => EBAY_CONDITIONS.map(c => ({
    id: c.id,
    label: c.label,
    description: c.description
  })), []);

  const selectedFulfillmentLabel = useMemo(() => {
    const selectedRuleObj = rules.find(r => (r._id || r.id) === formData.selectedRule);
    const policyId = formData.fulfillmentPolicyId || selectedRuleObj?.fulfillmentPolicyId || '';
    return ebayPolicies.fulfillment.find(p => p.id === policyId)?.label || policyId || 'Default';
  }, [formData.fulfillmentPolicyId, formData.selectedRule, rules, ebayPolicies.fulfillment]);

  const selectedPaymentLabel = useMemo(() => {
    const selectedRuleObj = rules.find(r => (r._id || r.id) === formData.selectedRule);
    const policyId = formData.paymentPolicyId || selectedRuleObj?.paymentPolicyId || '';
    return ebayPolicies.payment.find(p => p.id === policyId)?.label || policyId || 'Default';
  }, [formData.paymentPolicyId, formData.selectedRule, rules, ebayPolicies.payment]);

  const selectedReturnLabel = useMemo(() => {
    const selectedRuleObj = rules.find(r => (r._id || r.id) === formData.selectedRule);
    const policyId = formData.returnPolicyId || selectedRuleObj?.returnPolicyId || '';
    return ebayPolicies.returns.find(p => p.id === policyId)?.label || policyId || 'Default';
  }, [formData.returnPolicyId, formData.selectedRule, rules, ebayPolicies.returns]);

  const selectedLocationLabel = useMemo(() => {
    const selectedRuleObj = rules.find(r => (r._id || r.id) === formData.selectedRule);
    const locId = formData.locationKey || selectedRuleObj?.locationKey || '';
    return ebayPolicies.locations.find(l => l.id === locId)?.label || locId || 'None';
  }, [formData.locationKey, formData.selectedRule, rules, ebayPolicies.locations]);

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

  const handleAspectChange = (aspectName, value) => {
    setFormData(prev => ({
      ...prev,
      selectedAspects: {
        ...prev.selectedAspects,
        [aspectName]: [value]
      }
    }));
  };

  const handleCategoryChange = async (categoryOption) => {
    setFormData(prev => ({
      ...prev,
      category: categoryOption.label,
      categoryId: categoryOption.id,
      selectedAspects: {}
    }));

    setLoading(true);
    try {
      const response = await ebayService.getCategoryAspects(categoryOption.id);
      if (response.data.success) {
        setAspects(response.data.data || []);
      }
    } catch (err) {
      console.error("Error fetching aspects for new category:", err);
    } finally {
      setLoading(false);
    }
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
      itemSpecifics: formData.selectedAspects,
      conditionNote: formData.conditionNote,
      selectedRule: formData.selectedRule,
      selectedCondition: formData.selectedCondition,
      conditionId: formData.conditionId,
      selectedModel: formData.selectedModel || 'gpt-4o-mini',
      packageWeight: formData.packageWeight || { lbs: 0, oz: 0 },
      packageDimensions: formData.packageDimensions || { length: 0, width: 0, height: 0 },
      fulfillmentPolicyId: formData.fulfillmentPolicyId,
      paymentPolicyId: formData.paymentPolicyId,
      returnPolicyId: formData.returnPolicyId,
      locationKey: formData.locationKey,
      status: 'draft',
      platform
    };

    try {
      const response = editId
        ? await listingService.update(editId, listingData)
        : await listingService.create(listingData);
      if (response.data.success) {
        toast.success(editId ? 'Listing updated successfully!' : 'Listing saved as Draft successfully!');
        navigate('/listings');
      }
    } catch (error) {
      console.error("Error saving draft:", error);
      toast.error(error.response?.data?.message || "Failed to save draft.");
    } finally {
      setLoading(false);
    }
  };
 
  const handlePublishListing = async () => {
    setLoading(true);
    
    const listingData = {
      title: formData.title,
      description: formData.description,
      price: formData.price,
      sku: formData.sku,
      category: formData.category,
      categoryId: formData.categoryId,
      images: formData.images,
      itemSpecifics: formData.selectedAspects,
      conditionNote: formData.conditionNote,
      selectedRule: formData.selectedRule,
      selectedCondition: formData.selectedCondition,
      conditionId: formData.conditionId,
      selectedModel: formData.selectedModel || 'gpt-4o-mini',
      packageWeight: formData.packageWeight || { lbs: 0, oz: 0 },
      packageDimensions: formData.packageDimensions || { length: 0, width: 0, height: 0 },
      fulfillmentPolicyId: formData.fulfillmentPolicyId,
      paymentPolicyId: formData.paymentPolicyId,
      returnPolicyId: formData.returnPolicyId,
      locationKey: formData.locationKey,
      status: 'draft',
      platform
    };

    try {
      const createResponse = editId
        ? await listingService.update(editId, listingData)
        : await listingService.create(listingData);
      if (createResponse.data.success) {
        const listingId = editId || createResponse.data.data._id || createResponse.data.data.id;
        const publishResponse = await listingService.publish(listingId);
        if (publishResponse.data.success) {
          toast.success('Listing published to eBay successfully!');
          navigate('/listings');
        } else {
          toast.warning('Listing saved, but failed to publish to eBay: ' + (publishResponse.data.message || 'Unknown error'));
          navigate('/listings');
        }
      }
    } catch (error) {
      console.error("Error publishing listing:", error);
      toast.error(error.response?.data?.message || "Failed to publish listing.");
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (step === 1) {
      startAIFetch();
    } else if (step === 3) {
      const invalidAspects = [];
      aspects.forEach(aspect => {
        const isRequired = aspect.aspectConstraint?.aspectRequired === true || aspect.aspectConstraint?.aspectUsage === 'REQUIRED';
        const isRecommended = aspect.aspectConstraint?.aspectUsage === 'RECOMMENDED';
        if (isRequired || isRecommended) {
          const vals = aspect.aspectValues || aspect.values || [];
          if (vals.length > 0) {
            const currentVal = formData.selectedAspects[aspect.localizedAspectName]?.[0] || '';
            if (currentVal) {
              const matchesDropdown = vals.some(v => {
                const valText = typeof v === 'object' && v !== null ? (v.localizedValue || v.label || v.value || '') : String(v);
                return valText.trim().toLowerCase() === currentVal.trim().toLowerCase();
              });
              if (!matchesDropdown) {
                invalidAspects.push(aspect.localizedAspectName);
              }
            }
          }
        }
      });

      if (invalidAspects.length > 0) {
        toast.warning(`Value is not from the Dropdown for: ${invalidAspects.join(', ')}`);
        return;
      }
      setStep(step + 1);
    } else if (step === 4) {
      handlePublishListing();
    } else {
      setStep(step + 1);
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
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {editId ? 'Edit eBay Listing' : 'Create New eBay Listing'}
          </h1>
          <p className="text-slate-500">
            {step === 1 && "Step 1: Input Requirements"}
            {step === 2 && "Step 2: AI Generated Content"}
            {step === 3 && "Step 3: Item Specifics"}
            {step === 4 && "Step 4: Preview & Publish"}
          </p>
        </div>
        <div className="flex gap-2 mb-1">
          {[1, 2, 3, 4].map(i => (
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
              transition={{ duration: 0.2 }}
              className="space-y-10 flex-1"
            >
              {/* Selection Section */}
              <div className="bg-slate-50/50 p-8 rounded-[2.5rem] border border-slate-100 space-y-8">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-black text-indigo-900 uppercase tracking-[0.2em] flex items-center">
                      <Sparkles size={16} className="mr-2 text-indigo-500" /> AI Configuration Setup
                    </h3>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{rules.length} Rules Available</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-505 uppercase tracking-widest ml-1 flex items-center">
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
                    <label className="text-[10px] font-black text-slate-505 uppercase tracking-widest ml-1 flex items-center">
                      <Zap size={14} className="mr-1.5 text-indigo-600" /> Select AI Listing Rule
                    </label>
                    <SearchableDropdown 
                      value={rules.find(r => (r._id || r.id) === formData.selectedRule)?.name || ''}
                      onSelect={(opt) => {
                        const rule = rules.find(r => (r._id || r.id) === opt.id);
                        setFormData({
                          ...formData,
                          selectedRule: opt.id,
                          packageWeight: rule?.packageWeight || { lbs: '', oz: '' },
                          packageDimensions: rule?.packageDimensions || { length: '', width: '', height: '' },
                          fulfillmentPolicyId: rule?.fulfillmentPolicyId || '',
                          paymentPolicyId: rule?.paymentPolicyId || '',
                          returnPolicyId: rule?.returnPolicyId || '',
                          locationKey: rule?.locationKey || ''
                        });
                      }}
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
                          onClick={() => {
                            setFormData({...formData, images: formData.images.filter((_, idx) => idx !== i)});
                            setFiles(files.filter((_, idx) => idx !== i));
                          }}
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
              transition={{ duration: 0.2 }}
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
                    <p className="text-xs text-slate-400 mt-1">Fetching perfect category and generating details</p>
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
                    <div className="p-5 bg-indigo-50/30 rounded-[2rem] border border-indigo-100/50 space-y-5">
                      <div className="flex items-center gap-2 pb-1 border-b border-indigo-100/40">
                        <Sparkles size={16} className="text-indigo-600 animate-pulse" />
                        <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wider">AI Settings & Regeneration</h4>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider block">AI Model</label>
                          <SearchableDropdown 
                            value={modelOptions.find(m => m.id === formData.selectedModel)?.label || 'GPT-4o Mini'}
                            onSelect={(opt) => setFormData({...formData, selectedModel: opt.id})}
                            options={modelOptions}
                            placeholder="Select model..."
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider block">AI Rule</label>
                          <SearchableDropdown 
                            value={rules.find(r => (r._id || r.id) === formData.selectedRule)?.name || ''}
                            onSelect={(opt) => setFormData({...formData, selectedRule: opt.id})}
                            options={ruleOptions}
                            placeholder={rules.length ? 'Choose a rule...' : 'No rules found'}
                            disabled={rules.length === 0}
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider block">Condition</label>
                          <SearchableDropdown 
                            value={formData.selectedCondition}
                            onSelect={(opt) => setFormData({...formData, selectedCondition: opt.label, conditionId: opt.id})}
                            options={conditionOptions}
                            placeholder="Select condition..."
                          />
                        </div>

                        <button
                          type="button"
                          onClick={startAIFetch}
                          disabled={loading || !formData.selectedRule || !formData.selectedCondition || formData.images.length === 0}
                          className="w-full flex items-center justify-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-xs transition-all shadow-md shadow-indigo-100 disabled:opacity-50 mt-2 cursor-pointer"
                        >
                          {loading ? (
                            <>
                              <Loader2 size={12} className="animate-spin" />
                              Regenerating...
                            </>
                          ) : (
                            <>
                              <Sparkles size={12} />
                              Regenerate AI Content
                            </>
                          )}
                        </button>
                      </div>
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
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">eBay Category</label>
                        <CategorySearchDropdown 
                          value={formData.category}
                          onSelect={handleCategoryChange}
                          placeholder="Search and edit category..."
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Suggested Price</label>
                        <div className="relative">
                          <DollarSign size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" />
                          <input 
                            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 transition-all"
                            value={formData.price}
                            onChange={(e) => setFormData({...formData, price: e.target.value})}
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">SKU</label>
                        <input 
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all uppercase"
                          value={formData.sku}
                          onChange={(e) => setFormData({...formData, sku: e.target.value})}
                          placeholder="Enter SKU..."
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
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
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Condition Note</label>
                        <input 
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-semibold outline-none focus:border-indigo-500 transition-all"
                          value={formData.conditionNote}
                          onChange={(e) => setFormData({...formData, conditionNote: e.target.value})}
                          placeholder="Condition details..."
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Package Weight */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Package Weight</label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <input 
                              type="number"
                              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all"
                              value={formData.packageWeight?.lbs || ''}
                              onChange={(e) => setFormData({
                                ...formData,
                                packageWeight: { ...formData.packageWeight, lbs: parseFloat(e.target.value) || 0 }
                              })}
                              placeholder="lbs"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">lbs</span>
                          </div>
                          <div className="relative flex-1">
                            <input 
                              type="number"
                              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all"
                              value={formData.packageWeight?.oz || ''}
                              onChange={(e) => setFormData({
                                ...formData,
                                packageWeight: { ...formData.packageWeight, oz: parseFloat(e.target.value) || 0 }
                              })}
                              placeholder="oz"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">oz</span>
                          </div>
                        </div>
                      </div>

                      {/* Package Dimensions */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Dimensions (L x W x H)</label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <input 
                              type="number"
                              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all"
                              value={formData.packageDimensions?.length || ''}
                              onChange={(e) => setFormData({
                                ...formData,
                                packageDimensions: { ...formData.packageDimensions, length: parseFloat(e.target.value) || 0 }
                              })}
                              placeholder="L"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">in</span>
                          </div>
                          <div className="relative flex-1">
                            <input 
                              type="number"
                              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all"
                              value={formData.packageDimensions?.width || ''}
                              onChange={(e) => setFormData({
                                ...formData,
                                packageDimensions: { ...formData.packageDimensions, width: parseFloat(e.target.value) || 0 }
                              })}
                              placeholder="W"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">in</span>
                          </div>
                          <div className="relative flex-1">
                            <input 
                              type="number"
                              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all"
                              value={formData.packageDimensions?.height || ''}
                              onChange={(e) => setFormData({
                                ...formData,
                                packageDimensions: { ...formData.packageDimensions, height: parseFloat(e.target.value) || 0 }
                              })}
                              placeholder="H"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">in</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Listing Description</label>
                        <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                          <button 
                            onClick={() => setDescriptionMode('preview')}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${descriptionMode === 'preview' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                            <Eye size={12} /> Preview
                          </button>
                          <button 
                            onClick={() => setDescriptionMode('edit')}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${descriptionMode === 'edit' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                            <Code size={12} /> HTML
                          </button>
                        </div>
                      </div>

                      {descriptionMode === 'edit' ? (
                        <textarea 
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-[11px] font-mono leading-relaxed min-h-[300px] outline-none focus:border-indigo-500 transition-all shadow-inner"
                          value={formData.description}
                          onChange={(e) => setFormData({...formData, description: e.target.value})}
                          placeholder="Enter raw HTML description..."
                        />
                      ) : (
                        <div 
                          className="w-full px-6 py-6 bg-slate-50/50 border border-slate-100 rounded-2xl text-[13px] font-medium leading-relaxed min-h-[300px] overflow-y-auto max-h-[500px] shadow-inner overscroll-contain transform-gpu [scrollbar-width:thin] [scrollbar-color:theme(colors.slate.200)_transparent]"
                          dangerouslySetInnerHTML={{ __html: formData.description }}
                          style={{ wordBreak: 'break-word' }}
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
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8 flex-1"
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Item Specifics</h3>
                  <p className="text-xs text-slate-500">Fine-tune your listing details for better search visibility on eBay.</p>
                </div>
                <div className="px-4 py-2 bg-indigo-50 rounded-xl border border-indigo-100 text-[10px] font-black text-indigo-700 uppercase tracking-widest">
                  Category ID: {formData.categoryId}
                </div>
              </div>

              {aspects.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200 text-slate-400">
                  <List size={40} className="mb-4 opacity-20" />
                  <p className="text-sm font-medium">No item specifics required for this category.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6 bg-slate-50/50 p-8 rounded-[2.5rem] border border-slate-100 overflow-y-auto max-h-[400px] pr-4">
                  {aspects.map((aspect) => {
                    const vals = aspect.aspectValues || aspect.values || [];
                    const isRequired = aspect.aspectConstraint?.aspectRequired === true || aspect.aspectConstraint?.aspectUsage === 'REQUIRED';
                    const isRecommended = aspect.aspectConstraint?.aspectUsage === 'RECOMMENDED';
                    const currentVal = formData.selectedAspects[aspect.localizedAspectName]?.[0] || '';
                    
                    let hasDropdownError = false;
                    if ((isRequired || isRecommended) && vals.length > 0 && currentVal) {
                      const matchesDropdown = vals.some(v => {
                        const valText = typeof v === 'object' && v !== null ? (v.localizedValue || v.label || v.value || '') : String(v);
                        return valText.trim().toLowerCase() === currentVal.trim().toLowerCase();
                      });
                      if (!matchesDropdown) {
                        hasDropdownError = true;
                      }
                    }

                    return (
                      <div key={aspect.localizedAspectName} className="space-y-2">
                        <div className="flex items-center justify-between ml-1">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                            {aspect.localizedAspectName}
                            {isRequired && <span className="text-rose-500">*</span>}
                            {isRecommended && <span className="text-[9px] font-bold text-slate-400 normal-case">(Recommended)</span>}
                          </label>
                        </div>
                        
                        {(() => {
                          if (vals.length > 0) {
                            const options = vals.map(v => {
                              const valText = typeof v === 'object' && v !== null ? (v.localizedValue || v.label || '') : String(v);
                              return { id: valText, label: valText };
                            });
                            return (
                              <div>
                                <SearchableDropdown 
                                  value={currentVal}
                                  onSelect={(opt) => handleAspectChange(aspect.localizedAspectName, opt.label)}
                                  options={options}
                                  placeholder={`Select ${aspect.localizedAspectName}...`}
                                  error={hasDropdownError}
                                />
                                {hasDropdownError && (
                                  <p className="text-[11px] font-semibold text-rose-500 mt-1.5 animate-pulse">
                                    Value is not from the Dropdown
                                  </p>
                                )}
                              </div>
                            );
                          } else {
                            return (
                              <input 
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-semibold outline-none focus:border-indigo-500 transition-all shadow-sm"
                                value={currentVal}
                                onChange={(e) => handleAspectChange(aspect.localizedAspectName, e.target.value)}
                                placeholder={`Enter ${aspect.localizedAspectName}...`}
                              />
                            );
                          }
                        })()}
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {step === 4 && (
            <motion.div 
              key="step4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-10 flex-1"
            >
              <div className="lg:col-span-4 space-y-6">
                <div className="bg-emerald-50/50 border border-emerald-100 p-6 rounded-3xl space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shrink-0">
                      <CheckCircle2 size={24} />
                    </div>
                    <div>
                      <h3 className="font-bold text-emerald-900">Ready to Publish</h3>
                      <p className="text-[10px] text-emerald-700 font-bold uppercase tracking-widest">Final Review Mode</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-slate-50 border border-slate-100 rounded-3xl space-y-4">
                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Applied eBay Policies</h4>
                   <div className="space-y-4 text-left">
                     <div className="space-y-1">
                        <span className="text-[9px] font-bold text-slate-400 uppercase ml-1">Shipping Policy</span>
                        <SearchableDropdown
                          value={selectedFulfillmentLabel}
                          onSelect={(opt) => setFormData({ ...formData, fulfillmentPolicyId: opt.id })}
                          options={ebayPolicies.fulfillment}
                          placeholder="Select Shipping Policy..."
                        />
                     </div>
                     <div className="space-y-1">
                        <span className="text-[9px] font-bold text-slate-400 uppercase ml-1">Payment Policy</span>
                        <SearchableDropdown
                          value={selectedPaymentLabel}
                          onSelect={(opt) => setFormData({ ...formData, paymentPolicyId: opt.id })}
                          options={ebayPolicies.payment}
                          placeholder="Select Payment Policy..."
                        />
                     </div>
                     <div className="space-y-1">
                        <span className="text-[9px] font-bold text-slate-400 uppercase ml-1">Return Policy</span>
                        <SearchableDropdown
                          value={selectedReturnLabel}
                          onSelect={(opt) => setFormData({ ...formData, returnPolicyId: opt.id })}
                          options={ebayPolicies.returns}
                          placeholder="Select Return Policy..."
                        />
                     </div>
                     <div className="space-y-1">
                        <span className="text-[9px] font-bold text-slate-400 uppercase ml-1">Item Location</span>
                        <SearchableDropdown
                          value={selectedLocationLabel}
                          onSelect={(opt) => setFormData({ ...formData, locationKey: opt.id })}
                          options={ebayPolicies.locations}
                          placeholder="Select Item Location..."
                        />
                     </div>
                   </div>
                </div>

                <div className="p-6 bg-slate-50 border border-slate-100 rounded-3xl space-y-4">
                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Weight & Dimensions</h4>
                   
                   <div className="space-y-1.5 text-left">
                     <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Weight</label>
                     <div className="flex gap-2">
                       <div className="relative flex-1">
                         <input 
                           type="number"
                           className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all"
                           value={formData.packageWeight?.lbs ?? ''}
                           onChange={(e) => setFormData({
                             ...formData,
                             packageWeight: { ...formData.packageWeight, lbs: parseFloat(e.target.value) || 0 }
                           })}
                           placeholder="lbs"
                         />
                         <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">lbs</span>
                       </div>
                       <div className="relative flex-1">
                         <input 
                           type="number"
                           className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all"
                           value={formData.packageWeight?.oz ?? ''}
                           onChange={(e) => setFormData({
                             ...formData,
                             packageWeight: { ...formData.packageWeight, oz: parseFloat(e.target.value) || 0 }
                           })}
                           placeholder="oz"
                         />
                         <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">oz</span>
                       </div>
                     </div>
                   </div>

                   <div className="space-y-1.5 text-left">
                     <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Dimensions (L x W x H)</label>
                     <div className="flex gap-2">
                       <div className="relative flex-1">
                         <input 
                           type="number"
                           className="w-full px-2 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all"
                           value={formData.packageDimensions?.length ?? ''}
                           onChange={(e) => setFormData({
                             ...formData,
                             packageDimensions: { ...formData.packageDimensions, length: parseFloat(e.target.value) || 0 }
                           })}
                           placeholder="L"
                         />
                       </div>
                       <div className="relative flex-1">
                         <input 
                           type="number"
                           className="w-full px-2 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all"
                           value={formData.packageDimensions?.width ?? ''}
                           onChange={(e) => setFormData({
                             ...formData,
                             packageDimensions: { ...formData.packageDimensions, width: parseFloat(e.target.value) || 0 }
                           })}
                           placeholder="W"
                         />
                       </div>
                       <div className="relative flex-1">
                         <input 
                           type="number"
                           className="w-full px-2 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all"
                           value={formData.packageDimensions?.height ?? ''}
                           onChange={(e) => setFormData({
                             ...formData,
                             packageDimensions: { ...formData.packageDimensions, height: parseFloat(e.target.value) || 0 }
                           })}
                           placeholder="H"
                         />
                       </div>
                     </div>
                   </div>
                </div>

                <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                  <p className="text-[10px] text-indigo-700 font-bold leading-relaxed">
                    All eBay listing fees will be calculated upon submission. Ensure your business policies are correctly set in settings.
                  </p>
                </div>
              </div>

              <div className="lg:col-span-8 space-y-8 overflow-y-auto max-h-[700px] pr-4 custom-scrollbar">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.1em]">Manage Image Order</h3>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{formData.images.length} Photos</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {formData.images.map((img, i) => (
                      <div 
                        key={img.substring(0, 100) + '-' + i} 
                        className="aspect-square bg-slate-100 rounded-2xl relative group overflow-hidden border border-slate-200 flex flex-col shadow-sm"
                      >
                        <img src={img} className="w-full h-full object-cover" alt={`Product ${i + 1}`} />
                        
                        {/* Control overlay */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex flex-col justify-between p-3 z-10">
                          <div className="flex justify-between items-start">
                            <span className="bg-black/60 backdrop-blur-sm text-white px-2 py-0.5 rounded-md text-[9px] font-bold">
                              {i === 0 ? 'Cover' : `#${i + 1}`}
                            </span>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteImage(i);
                              }}
                              className="p-1.5 bg-red-600/80 backdrop-blur-sm rounded-xl text-white hover:bg-red-600 transition-colors shadow-sm"
                              title="Delete Image"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                          
                          <div className="flex justify-center gap-2">
                            <button
                              disabled={i === 0}
                              onClick={(e) => {
                                e.stopPropagation();
                                moveImage(i, 'left');
                              }}
                              className={`p-2 rounded-xl backdrop-blur-sm text-white transition-all ${
                                i === 0 
                                  ? 'bg-white/10 text-white/40 cursor-not-allowed' 
                                  : 'bg-white/25 hover:bg-white/45 active:scale-95'
                              }`}
                              title="Move Left"
                            >
                              <ArrowLeft size={14} />
                            </button>
                            <button
                              disabled={i === formData.images.length - 1}
                              onClick={(e) => {
                                e.stopPropagation();
                                moveImage(i, 'right');
                              }}
                              className={`p-2 rounded-xl backdrop-blur-sm text-white transition-all ${
                                i === formData.images.length - 1 
                                  ? 'bg-white/10 text-white/40 cursor-not-allowed' 
                                  : 'bg-white/25 hover:bg-white/45 active:scale-95'
                              }`}
                              title="Move Right"
                            >
                              <ArrowRight size={14} />
                            </button>
                          </div>
                        </div>
                        {i === 0 && (
                          <div className="absolute top-2 left-2 px-2 py-0.5 bg-indigo-600 text-white text-[8px] font-black uppercase rounded-md shadow-lg pointer-events-none">Main</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-sm p-8 space-y-8">
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Listing Title</label>
                      <p className="text-sm font-bold text-slate-900 leading-snug">{formData.title}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Target Category</label>
                      <p className="text-sm font-bold text-indigo-600">{formData.category}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-6 pt-4 border-t border-slate-50">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Price</label>
                      <p className="text-lg font-black text-slate-900">${formData.price}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Condition</label>
                      <p className="text-xs font-bold text-slate-700">{formData.selectedCondition}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SKU</label>
                      <p className="text-xs font-mono font-bold text-slate-500 uppercase">Auto-Generated</p>
                    </div>
                  </div>

                  {formData.conditionNote && (
                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 space-y-1">
                      <label className="text-[9px] font-black text-amber-900 uppercase tracking-widest">Condition Note</label>
                      <p className="text-[11px] text-amber-800 font-medium">{formData.conditionNote}</p>
                    </div>
                  )}

                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                      <Tag size={14} className="text-indigo-500" /> Item Specifics Review
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {Object.entries(formData.selectedAspects).map(([key, val]) => (
                        <div key={key} className="px-4 py-3 bg-slate-50 rounded-xl border border-slate-100">
                          <label className="text-[9px] font-bold text-slate-400 uppercase block mb-0.5">{key}</label>
                          <span className="text-[11px] font-bold text-slate-700">{val[0] || 'N/A'}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3 pt-6 border-t border-slate-50">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Description Preview</label>
                    <div 
                      className="text-[11px] text-slate-600 leading-relaxed max-h-[300px] overflow-y-auto pr-2 custom-scrollbar opacity-80"
                      dangerouslySetInnerHTML={{ __html: formData.description }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer Navigation */}
        <div className="mt-auto pt-8 flex justify-between items-center border-t border-slate-50">
          <button 
            onClick={prevStep}
            disabled={step === 1 || loading}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all ${
              step === 1 || loading ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <ChevronLeft size={20} /> Back
          </button>
          
          <div className="flex items-center gap-4">
            {(isConvertingImages || !allImagesLoaded) && (
              <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-xl shadow-sm animate-pulse mr-2">
                <Loader2 size={12} className="animate-spin text-indigo-500" />
                {isConvertingImages ? 'Converting images...' : `Loading images (${Object.keys(loadedImages).length}/${formData.images.length})...`}
              </span>
            )}
            {step === 4 && (
              <button 
                onClick={handleSaveDraft}
                disabled={loading || isConvertingImages || !allImagesLoaded}
                className="px-8 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
              >
                Save as Draft
              </button>
            )}

            <button 
              onClick={nextStep}
              disabled={loading || isConvertingImages || !allImagesLoaded || (step === 1 && (!formData.selectedRule || !formData.selectedCondition || formData.images.length === 0))}
              className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
            >
              {loading ? (
                <>Working...</>
              ) : step === 4 ? (
                <>Publish to eBay</>
              ) : (
                <>Continue</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateEbayListing;
