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
import Button from '../components/ui/Button';
import IconButton from '../components/ui/IconButton';
import { Badge } from '../components/ui/Badge';
import { LoadingState } from '../components/ui/LoadingState';

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

const CreateEbayListing = ({ isModal = false, editId: propEditId = null, onClose = null }) => {
  const navigate = useNavigate();
  const { toast } = useNotification();
  const [searchParams] = useSearchParams();
  const editId = propEditId || searchParams.get('edit');
  const platform = 'ebay';
  const [hasScanned, setHasScanned] = useState(editId ? true : false);
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

    setHasScanned(true);
    
    const selectedRuleObj = rules.find(r => (r._id || r.id) === formData.selectedRule);
    
    try {
      const response = await aiService.analyze({
        images: formData.images, 
        platform,
        title_sequence: selectedRuleObj?.title_sequence || [],
        description_prompt: selectedRuleObj?.description_prompt || '',
        description_template: selectedRuleObj?.description_template || '',
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
        window.dispatchEvent(new Event('elister-listings-update'));
        toast.success(editId ? 'Listing updated successfully!' : 'Listing saved as Draft successfully!');
        if (isModal && onClose) {
          onClose();
        } else {
          navigate('/listings');
        }
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
          window.dispatchEvent(new Event('elister-listings-update'));
          toast.success('Listing published to eBay successfully!');
          if (isModal && onClose) {
            onClose();
          } else {
            navigate('/listings');
          }
        } else {
          window.dispatchEvent(new Event('elister-listings-update'));
          toast.warning('Listing saved, but failed to publish to eBay: ' + (publishResponse.data.message || 'Unknown error'));
          if (isModal && onClose) {
            onClose();
          } else {
            navigate('/listings');
          }
        }
      }
    } catch (error) {
      console.error("Error publishing listing:", error);
      toast.error(error.response?.data?.message || "Failed to publish listing.");
    } finally {
      setLoading(false);
    }
  };

  // We can validate aspects on publish
  const validateAspects = () => {
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
      return false;
    }
    return true;
  };

  const handlePublishClick = () => {
    if (validateAspects()) {
      handlePublishListing();
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
            {editId ? 'Edit eBay Listing' : 'Create New eBay Listing'}
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
              <div key={i} className="aspect-square bg-slate-100 rounded-2xl relative group overflow-hidden border border-slate-100 shadow-sm">
                <img src={img} className="w-full h-full object-cover" alt="Product" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                   <button
                    onClick={() => {
                      setFormData({...formData, images: formData.images.filter((_, idx) => idx !== i)});
                      setFiles(files.filter((_, idx) => idx !== i));
                    }}
                    className="p-1.5 bg-rose-600 rounded-lg text-white hover:bg-rose-700 cursor-pointer transition-colors"
                    title="Delete Image"
                   >
                    <Trash2 size={14} />
                   </button>
                   <button
                    disabled={i === 0}
                    onClick={() => moveImage(i, 'left')}
                    className="p-1.5 bg-white/20 hover:bg-white/40 text-white rounded-lg disabled:opacity-40 cursor-pointer transition-colors"
                    title="Move Left"
                   >
                    <ArrowLeft size={14} />
                   </button>
                   <button
                    disabled={i === formData.images.length - 1}
                    onClick={() => moveImage(i, 'right')}
                    className="p-1.5 bg-white/20 hover:bg-white/40 text-white rounded-lg disabled:opacity-40 cursor-pointer transition-colors"
                    title="Move Right"
                   >
                    <ArrowRight size={14} />
                   </button>
                </div>
                {i === 0 && (
                  <span className="absolute top-2 left-2 px-2 py-0.5 bg-indigo-600 text-white text-[8px] font-black uppercase rounded-md shadow-sm tracking-wider">Cover</span>
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
                  {/* Category */}
                  <div className="space-y-1.5 sm:col-span-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">eBay Category</label>
                    <CategorySearchDropdown 
                      value={formData.category}
                      onSelect={handleCategoryChange}
                      placeholder="Category..."
                    />
                  </div>
                  {/* Price */}
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Condition selector */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Condition</label>
                    <SearchableDropdown 
                      value={formData.selectedCondition}
                      onSelect={(opt) => setFormData({...formData, selectedCondition: opt.label, conditionId: opt.id})}
                      options={conditionOptions}
                      placeholder="Select Condition..."
                    />
                  </div>
                  {/* Condition Note */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Condition Note</label>
                    <input 
                      className="w-full px-4 h-12 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all focus:ring-2 focus:ring-indigo-500/10"
                      value={formData.conditionNote}
                      onChange={(e) => setFormData({...formData, conditionNote: e.target.value})}
                      placeholder="Note..."
                    />
                  </div>
                </div>

                {/* Description */}
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
                        <Code size={11} /> HTML
                      </button>
                    </div>
                  </div>

                  {descriptionMode === 'edit' ? (
                    <textarea 
                      className="w-full p-4 bg-white border border-slate-200 rounded-xl text-[11px] font-mono leading-relaxed min-h-[250px] outline-none focus:border-indigo-500 transition-all shadow-inner focus:ring-2 focus:ring-indigo-500/10"
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      placeholder="Enter raw HTML description..."
                    />
                  ) : (
                    <div 
                      className="w-full p-4 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-semibold leading-relaxed min-h-[250px] overflow-y-auto max-h-[400px] shadow-inner"
                      dangerouslySetInnerHTML={{ __html: formData.description }}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Right Side: Aspects & Policies */}
            <div className="lg:col-span-6 space-y-6">
              
              {/* Specifics Header */}
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 text-[11px] font-black flex items-center justify-center shrink-0">4</span>
                    <h3 className="text-sm font-black text-slate-900">Item Specifics (Aspects)</h3>
                  </div>
                  {formData.categoryId && <Badge variant="neutral">Category: {formData.categoryId}</Badge>}
                </div>

                {aspects.length === 0 ? (
                  <p className="text-xs text-slate-400 font-semibold p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center">No aspects required for this category.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-2 border border-slate-100 p-4 rounded-2xl bg-slate-50/30">
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
                        <div key={aspect.localizedAspectName} className="space-y-1">
                          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1">
                            {aspect.localizedAspectName}
                            {isRequired && <span className="text-rose-500">*</span>}
                            {isRecommended && <span className="text-[8px] text-slate-400 normal-case font-bold">(Rec)</span>}
                          </label>
                          
                          {vals.length > 0 ? (
                            <div>
                              <SearchableDropdown 
                                value={currentVal}
                                onSelect={(opt) => handleAspectChange(aspect.localizedAspectName, opt.label)}
                                options={vals.map(v => {
                                  const text = typeof v === 'object' && v !== null ? (v.localizedValue || v.label || '') : String(v);
                                  return { id: text, label: text };
                                })}
                                placeholder={`Select...`}
                                error={hasDropdownError}
                              />
                            </div>
                          ) : (
                            <input 
                              className="w-full px-4 h-12 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all focus:ring-2 focus:ring-indigo-500/10"
                              value={currentVal}
                              onChange={(e) => handleAspectChange(aspect.localizedAspectName, e.target.value)}
                              placeholder={`Enter...`}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Policies Header */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                  <span className="w-7 h-7 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 text-[11px] font-black flex items-center justify-center shrink-0">5</span>
                  <h3 className="text-sm font-black text-slate-900">eBay Policies &amp; Shipping</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Fulfillment Policy */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase ml-1">Shipping Policy</label>
                    <SearchableDropdown
                      value={selectedFulfillmentLabel}
                      onSelect={(opt) => setFormData({ ...formData, fulfillmentPolicyId: opt.id })}
                      options={ebayPolicies.fulfillment}
                      placeholder="Select Shipping Policy..."
                    />
                  </div>
                  {/* Payment Policy */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase ml-1">Payment Policy</label>
                    <SearchableDropdown
                      value={selectedPaymentLabel}
                      onSelect={(opt) => setFormData({ ...formData, paymentPolicyId: opt.id })}
                      options={ebayPolicies.payment}
                      placeholder="Select Payment Policy..."
                    />
                  </div>
                  {/* Return Policy */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase ml-1">Return Policy</label>
                    <SearchableDropdown
                      value={selectedReturnLabel}
                      onSelect={(opt) => setFormData({ ...formData, returnPolicyId: opt.id })}
                      options={ebayPolicies.returns}
                      placeholder="Select Return Policy..."
                    />
                  </div>
                  {/* Location Key */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase ml-1">Item Location</label>
                    <SearchableDropdown
                      value={selectedLocationLabel}
                      onSelect={(opt) => setFormData({ ...formData, locationKey: opt.id })}
                      options={ebayPolicies.locations}
                      placeholder="Select Location..."
                    />
                  </div>
                </div>

                {/* Weight & Dimensions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-500 uppercase ml-1">Package Weight</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input 
                          type="number"
                          className="w-full px-4 h-12 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all focus:ring-2 focus:ring-indigo-500/10"
                          value={formData.packageWeight?.lbs ?? ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            packageWeight: { ...formData.packageWeight, lbs: parseFloat(e.target.value) || 0 }
                          })}
                          placeholder="lbs"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-black">LBS</span>
                      </div>
                      <div className="relative flex-1">
                        <input 
                          type="number"
                          className="w-full px-4 h-12 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all focus:ring-2 focus:ring-indigo-500/10"
                          value={formData.packageWeight?.oz ?? ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            packageWeight: { ...formData.packageWeight, oz: parseFloat(e.target.value) || 0 }
                          })}
                          placeholder="oz"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-black">OZ</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-500 uppercase ml-1">Dimensions (L x W x H)</label>
                    <div className="flex gap-2">
                      <input 
                        type="number"
                        className="w-full px-2 h-12 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all focus:ring-2 focus:ring-indigo-500/10"
                        value={formData.packageDimensions?.length ?? ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          packageDimensions: { ...formData.packageDimensions, length: parseFloat(e.target.value) || 0 }
                        })}
                        placeholder="L"
                      />
                      <input 
                        type="number"
                        className="w-full px-2 h-12 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all focus:ring-2 focus:ring-indigo-500/10"
                        value={formData.packageDimensions?.width ?? ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          packageDimensions: { ...formData.packageDimensions, width: parseFloat(e.target.value) || 0 }
                        })}
                        placeholder="W"
                      />
                      <input 
                        type="number"
                        className="w-full px-2 h-12 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all focus:ring-2 focus:ring-indigo-500/10"
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

            </div>

          </div>
        )}

        {/* Form Bottom Submission Control (Only visible when scanned) */}
        {hasScanned && !loading && (
          <div className="mt-8 pt-6 flex justify-end items-center gap-3 border-t border-slate-100 animate-in fade-in duration-300">
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate('/listings')}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveDraft}
              loading={loading}
              disabled={loading || isConvertingImages || !allImagesLoaded}
            >
              Save as Draft
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handlePublishClick}
              loading={loading}
              disabled={loading || isConvertingImages || !allImagesLoaded}
            >
              Publish to eBay
            </Button>
          </div>
        )}

      </div>
    </div>
  );
};

export default CreateEbayListing;
