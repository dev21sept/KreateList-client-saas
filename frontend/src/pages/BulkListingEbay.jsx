import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  Plus, 
  Trash2, 
  Edit3, 
  Sparkles, 
  Save, 
  Send, 
  Info, 
  Loader2, 
  Check, 
  ChevronDown, 
  X, 
  Search, 
  Tag, 
  AlertCircle,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { ruleService, aiService, ebayService, bulkListingEbayService, listingService } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { EBAY_CONDITIONS } from '../constants/ebayConditions';
import { compressImage } from '../utils/imageCompressor';

// Helper Dropdown for Rules & Models
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
        className={`w-full h-11 px-4 bg-white border ${
          error ? 'border-rose-500 focus:ring-rose-500/10' : 'border-slate-200 hover:border-indigo-300 focus:ring-indigo-500/10'
        } rounded-2xl text-left flex items-center justify-between text-xs font-bold text-slate-700 disabled:opacity-60 transition-all focus:ring-2`}
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
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {isOpen && !disabled && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl z-[999] overflow-hidden">
          <div className="p-2 bg-slate-50 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                autoFocus
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                className="w-full h-8 pl-8 pr-3 rounded-lg border border-slate-200 text-xs font-semibold outline-none focus:border-indigo-500"
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.length > 0 ? filteredOptions.map((opt) => (
              <button
                key={opt.id || opt.label}
                type="button"
                onClick={() => {
                  onSelect(opt);
                  setIsOpen(false);
                  setSearchTerm('');
                }}
                className={`w-full text-left px-3 py-2 border-b border-slate-50 last:border-b-0 hover:bg-indigo-600 hover:text-white transition-colors ${value === opt.label ? 'bg-indigo-50 text-indigo-600' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold">{opt.label}</span>
                  {value === opt.label && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                </div>
                {opt.description && (
                  <p className="text-[9px] mt-0.5 text-slate-400 line-clamp-1">{opt.description}</p>
                )}
              </button>
            )) : (
              <div className="p-3 text-xs text-slate-400 text-center">No results found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Category Suggestion Selector
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
        <Tag size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-500 z-10" />
        <input 
          className="w-full pl-8 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all shadow-sm"
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
          className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 cursor-pointer" 
          onClick={() => {
            setIsOpen(!isOpen);
            if (!isOpen) {
              setSearchTerm(value || '');
            }
          }}
        />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-[999] max-h-48 overflow-y-auto">
          {loading && (
            <div className="p-3 text-[10px] font-semibold text-slate-400 text-center">Searching...</div>
          )}
          {!loading && suggestions.length === 0 && searchTerm.trim() && (
            <div className="p-3 text-[10px] font-semibold text-slate-400 text-center">No categories found</div>
          )}
          {!loading && suggestions.length === 0 && !searchTerm.trim() && (
            <div className="p-3 text-[10px] font-semibold text-slate-400 text-center">Type to search...</div>
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
              className="w-full text-left px-3 py-2 border-b border-slate-50 last:border-b-0 hover:bg-indigo-600 hover:text-white transition-colors"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-slate-700 hover:text-inherit">{opt.label}</span>
                <span className="text-[8px] opacity-75">ID: {opt.id}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const BulkListingEbay = () => {
  const navigate = useNavigate();
  const { toast } = useNotification();

  // Configuration Setup State
  const [globalModel, setGlobalModel] = useState('gpt-4o-mini');
  const [globalRule, setGlobalRule] = useState('');
  const [globalCondition, setGlobalCondition] = useState('Pre-owned - Excellent');

  const [rules, setRules] = useState([]);
  const [ebayPolicies, setEbayPolicies] = useState({ fulfillment: [], payment: [], returns: [], locations: [] });
  
  const [fetchingDetails, setFetchingDetails] = useState(false);
  
  // Table queue state
  const [items, setItems] = useState([
    {
      id: 'item-1',
      images: [],
      title: '',
      sku: '',
      price: '',
      category: '',
      categoryId: '',
      description: '',
      selectedAspects: {},
      conditionNote: '',
      selectedCondition: '',
      conditionId: '',
      status: 'pending', // 'pending', 'analyzing', 'analyzed', 'saving', 'saved', 'publishing', 'published', 'failed'
      error: '',
      ebayUrl: '',
      ebayListingId: '',
      aspects: [],
      packageWeight: { lbs: '', oz: '' },
      packageDimensions: { length: '', width: '', height: '' },
      fulfillmentPolicyId: '',
      paymentPolicyId: '',
      returnPolicyId: '',
      locationKey: '',
      selected: true
    }
  ]);

  // Drawer / modal edit state
  const [activeEditItemId, setActiveEditItemId] = useState(null);
  
  // Scanning Pool State
  const [sourcePhotos, setSourcePhotos] = useState([]);
  const [isBatchAnalyzing, setIsBatchAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const modelOptions = useMemo(() => [
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini (OpenAI)', description: 'Fast, cost-efficient OpenAI model' },
    { id: 'gpt-4o', label: 'GPT-4o (OpenAI)', description: 'High-accuracy OpenAI model' },
    { id: 'gemini-1.5-flash', label: '1.5 Flash (AI Studio)', description: 'Fast Google AI Studio model' },
    { id: 'gemini-1.5-pro', label: '1.5 Pro (AI Studio)', description: 'Highly intelligent Google AI Studio model' },
    { id: 'gemini-2.0-flash', label: '2.0 Flash (AI Studio)', description: 'Latest ultra-fast Google AI Studio model' }
  ], []);

  const conditionOptions = useMemo(() => EBAY_CONDITIONS.map(c => ({
    id: c.id,
    label: c.label,
    description: c.description
  })), []);

  const ruleOptions = useMemo(() => rules.map(rule => ({
    id: rule._id || rule.id,
    label: rule.name,
    description: (rule.title_sequence || []).join(' | ')
  })), [rules]);

  // Load rules & policies
  useEffect(() => {
    const fetchRules = async () => {
      try {
        const response = await ruleService.getAll();
        if (response.data.success) {
          setRules(response.data.data);
          const defaultRule = response.data.data.find(r => r.isDefault) || response.data.data[0];
          if (defaultRule) {
            setGlobalRule(defaultRule._id || defaultRule.id);
          }
        }
      } catch (error) {
        console.error("Error fetching rules:", error);
      }
    };

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
        console.error("Error fetching eBay policies:", error);
      }
    };

    fetchRules();
    fetchEbayPolicies();
  }, []);

  // Load preselected bulk listings from Listings page session storage
  useEffect(() => {
    const queueIdsStr = sessionStorage.getItem('elister_ebay_bulk_ids');
    const queueStr = sessionStorage.getItem('elister_ebay_bulk_queue');

    const loadFromIds = async (ids) => {
      setFetchingDetails(true);
      try {
        const responses = await Promise.all(
          ids.map(id => listingService.getOne(id))
        );
        const fullListings = responses
          .map(res => res.data?.success ? res.data.data : null)
          .filter(Boolean);

        if (fullListings.length > 0) {
          const mappedItems = fullListings.map((listing, index) => {
            return {
              id: listing._id || listing.id || `item-bulk-${index}-${Date.now()}`,
              _id: listing._id || listing.id,
              images: listing.images || [],
              title: listing.title || '',
              sku: listing.sku || '',
              price: listing.price || '',
              category: listing.category || '',
              categoryId: listing.categoryId || '',
              description: listing.description || '',
              selectedAspects: listing.itemSpecifics || {},
              conditionNote: listing.conditionNote || '',
              selectedCondition: listing.selectedCondition || '',
              conditionId: listing.conditionId || '',
              status: 'analyzed',
              error: '',
              ebayUrl: listing.ebayUrl || '',
              ebayListingId: listing.ebayListingId || '',
              aspects: [],
              packageWeight: listing.packageWeight || { lbs: '', oz: '' },
              packageDimensions: listing.packageDimensions || { length: '', width: '', height: '' },
              fulfillmentPolicyId: listing.fulfillmentPolicyId || '',
              paymentPolicyId: listing.paymentPolicyId || '',
              returnPolicyId: listing.returnPolicyId || '',
              locationKey: listing.locationKey || '',
              selected: true
            };
          });
          setItems(mappedItems);
        }
      } catch (err) {
        console.error("Error fetching bulk details from IDs:", err);
      } finally {
        setFetchingDetails(false);
        sessionStorage.removeItem('elister_ebay_bulk_ids');
      }
    };

    if (queueIdsStr) {
      try {
        const ids = JSON.parse(queueIdsStr);
        if (Array.isArray(ids) && ids.length > 0) {
          loadFromIds(ids);
          return;
        }
      } catch (err) {
        console.error("Error parsing bulk IDs from session storage:", err);
        sessionStorage.removeItem('elister_ebay_bulk_ids');
      }
    }

    if (queueStr) {
      try {
        const parsed = JSON.parse(queueStr);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const mappedItems = parsed.map((listing, index) => {
            return {
              id: listing._id || listing.id || `item-bulk-${index}-${Date.now()}`,
              _id: listing._id || listing.id,
              images: listing.images || [],
              title: listing.title || '',
              sku: listing.sku || '',
              price: listing.price || '',
              category: listing.category || '',
              categoryId: listing.categoryId || '',
              description: listing.description || '',
              selectedAspects: listing.itemSpecifics || {},
              conditionNote: listing.conditionNote || '',
              selectedCondition: listing.selectedCondition || '',
              conditionId: listing.conditionId || '',
              status: 'analyzed',
              error: '',
              ebayUrl: listing.ebayUrl || '',
              ebayListingId: listing.ebayListingId || '',
              aspects: [],
              packageWeight: listing.packageWeight || { lbs: '', oz: '' },
              packageDimensions: listing.packageDimensions || { length: '', width: '', height: '' },
              fulfillmentPolicyId: listing.fulfillmentPolicyId || '',
              paymentPolicyId: listing.paymentPolicyId || '',
              returnPolicyId: listing.returnPolicyId || '',
              locationKey: listing.locationKey || '',
              selected: true
            };
          });
          setItems(mappedItems);
        }
      } catch (err) {
        console.error("Error parsing bulk queue from session storage:", err);
      } finally {
        sessionStorage.removeItem('elister_ebay_bulk_queue');
      }
    }
  }, []);

  // Fetch aspects for active item if category is selected but aspects are empty
  useEffect(() => {
    if (!activeEditItemId) return;
    const it = items.find(i => i.id === activeEditItemId);
    if (!it || !it.categoryId || (it.aspects && it.aspects.length > 0)) return;

    const fetchAspects = async () => {
      try {
        const response = await ebayService.getCategoryAspects(it.categoryId);
        if (response.data.success) {
          setItems(prev => prev.map(item => item.id === activeEditItemId ? { ...item, aspects: response.data.data || [] } : item));
        }
      } catch (err) {
        console.error("Error loading aspects for active item:", err);
      }
    };
    fetchAspects();
  }, [activeEditItemId, items]);

  // Update default policies on items when global rule changes
  useEffect(() => {
    if (!globalRule) return;
    const ruleObj = rules.find(r => (r._id || r.id) === globalRule);
    if (!ruleObj) return;

    setItems(prev => prev.map(item => {
      // If item is already analyzed, don't clear AI results, just overlay policies if they are empty
      return {
        ...item,
        fulfillmentPolicyId: item.fulfillmentPolicyId || ruleObj.fulfillmentPolicyId || '',
        paymentPolicyId: item.paymentPolicyId || ruleObj.paymentPolicyId || '',
        returnPolicyId: item.returnPolicyId || ruleObj.returnPolicyId || '',
        locationKey: item.locationKey || ruleObj.locationKey || '',
        packageWeight: item.packageWeight?.lbs || item.packageWeight?.oz ? item.packageWeight : (ruleObj.packageWeight || { lbs: '', oz: '' }),
        packageDimensions: item.packageDimensions?.length || item.packageDimensions?.width ? item.packageDimensions : (ruleObj.packageDimensions || { length: '', width: '', height: '' })
      };
    }));
  }, [globalRule, rules]);

  // Image uploader & base64 helper
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 1024;

          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to base64 jpeg with 0.8 quality compression
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          resolve(dataUrl);
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleImageChange = async (itemId, e) => {
    const uploadedFiles = Array.from(e.target.files);
    if (uploadedFiles.length === 0) return;

    // Set uploading state locally
    setItems(prev => prev.map(it => it.id === itemId ? { ...it, status: 'uploading' } : it));

    try {
      // Compress each image using the utility
      const base64Images = await Promise.all(
        uploadedFiles.map(file => compressImage(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.8 }))
      );
      setItems(prev => prev.map(it => {
        if (it.id === itemId) {
          return {
            ...it,
            images: [...it.images, ...base64Images],
            status: it.status === 'uploading' ? 'pending' : it.status
          };
        }
        return it;
      }));
    } catch (err) {
      toast.error("Failed to compress image files.");
      setItems(prev => prev.map(it => it.id === itemId ? { ...it, status: 'pending' } : it));
    }
  };

  const removeImage = (itemId, imgIdx) => {
    setItems(prev => prev.map(it => {
      if (it.id === itemId) {
        return {
          ...it,
          images: it.images.filter((_, idx) => idx !== imgIdx)
        };
      }
      return it;
    }));
  };

  const handleBatchPhotoSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    toast.info(`Uploading & compressing ${files.length} photos...`);
    try {
      // Compress each image using the utility
      const base64s = await Promise.all(
        files.map(f => compressImage(f, { maxWidth: 1200, maxHeight: 1200, quality: 0.8 }))
      );
      setSourcePhotos(prev => [...prev, ...base64s]);
      toast.success(`Uploaded and compressed ${files.length} photos to the scanning pool.`);
    } catch (err) {
      toast.error("Failed to process uploaded photos.");
    }
  };

  const removeSourcePhoto = (idx) => {
    setSourcePhotos(prev => prev.filter((_, i) => i !== idx));
  };

  const clearSourcePhotos = () => {
    setSourcePhotos([]);
  };

  const runBatchGroupingAndScan = async () => {
    if (sourcePhotos.length === 0) {
      toast.warning("Please upload some photos to scan.");
      return;
    }

    setIsBatchAnalyzing(true);
    toast.info("Running AI grouping and listing analysis. Please wait...");

    const selectedRuleObj = rules.find(r => (r._id || r.id) === globalRule);

    try {
      const existingSkus = items.map(it => it.sku).filter(Boolean);

      const res = await bulkListingEbayService.analyze({
        images: sourcePhotos,
        title_sequence: selectedRuleObj?.title_sequence || [],
        description_prompt: selectedRuleObj?.description_prompt || '',
        description_template: selectedRuleObj?.description_template || '',
        condition_name: globalCondition,
        model: globalModel,
        existing_skus: existingSkus
      });

      if (res.data.success) {
        const groupedProducts = res.data.data;
        setItems(prev => {
          const isFirstSlotEmpty = prev.length === 1 && prev[0].images.length === 0 && !prev[0].title;
          const mappedItems = groupedProducts.map(gp => ({
            ...gp,
            selected: true,
            packageWeight: selectedRuleObj?.packageWeight || { lbs: '', oz: '' },
            packageDimensions: selectedRuleObj?.packageDimensions || { length: '', width: '', height: '' },
            fulfillmentPolicyId: selectedRuleObj?.fulfillmentPolicyId || '',
            paymentPolicyId: selectedRuleObj?.paymentPolicyId || '',
            returnPolicyId: selectedRuleObj?.returnPolicyId || '',
            locationKey: selectedRuleObj?.locationKey || ''
          }));
          return isFirstSlotEmpty ? mappedItems : [...prev, ...mappedItems];
        });

        setSourcePhotos([]);
        toast.success(`Successfully analyzed! Grouped photos into ${groupedProducts.length} unique products.`);
      } else {
        throw new Error(res.data.message || 'AI Grouping failed');
      }
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || err.message || "Grouping failed";
      toast.error(`Analysis failed: ${msg}`);
    } finally {
      setIsBatchAnalyzing(false);
    }
  };

  // Item management actions
  const addSlot = () => {
    const newId = `item-${Date.now()}`;
    const ruleObj = rules.find(r => (r._id || r.id) === globalRule);
    
    setItems(prev => [
      ...prev,
      {
        id: newId,
        images: [],
        title: '',
        sku: '',
        price: '',
        category: '',
        categoryId: '',
        description: '',
        selectedAspects: {},
        conditionNote: '',
        selectedCondition: '',
        conditionId: '',
        status: 'pending',
        error: '',
        ebayUrl: '',
        ebayListingId: '',
        aspects: [],
        packageWeight: ruleObj?.packageWeight || { lbs: '', oz: '' },
        packageDimensions: ruleObj?.packageDimensions || { length: '', width: '', height: '' },
        fulfillmentPolicyId: ruleObj?.fulfillmentPolicyId || '',
        paymentPolicyId: ruleObj?.paymentPolicyId || '',
        returnPolicyId: ruleObj?.returnPolicyId || '',
        locationKey: ruleObj?.locationKey || '',
        selected: true
      }
    ]);
  };

  const removeSlot = (itemId) => {
    if (items.length === 1) {
      toast.warning("You must keep at least one listing slot.");
      return;
    }
    setItems(prev => prev.filter(it => it.id !== itemId));
    if (activeEditItemId === itemId) {
      setActiveEditItemId(null);
    }
  };

  const toggleSelect = (itemId) => {
    setItems(prev => prev.map(it => it.id === itemId ? { ...it, selected: !it.selected } : it));
  };

  const toggleSelectAll = (e) => {
    const checked = e.target.checked;
    setItems(prev => prev.map(it => ({ ...it, selected: checked })));
  };

  // Perform AI analysis on a single item
  const analyzeSingleItem = async (itemId) => {
    const item = items.find(it => it.id === itemId);
    if (!item) return;

    if (item.images.length === 0) {
      toast.warning("Please upload at least one image to scan.");
      return;
    }

    setItems(prev => prev.map(it => it.id === itemId ? { ...it, status: 'analyzing', error: '' } : it));

    const selectedRuleObj = rules.find(r => (r._id || r.id) === globalRule);
    
    try {
      const response = await aiService.analyze({
        images: item.images,
        platform: 'ebay',
        title_sequence: selectedRuleObj?.title_sequence || [],
        description_prompt: selectedRuleObj?.description_prompt || '',
        condition_note: selectedRuleObj?.condition_note || '',
        condition_name: globalCondition,
        model: globalModel
      });

      if (response.data.success) {
        const result = response.data.data;
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

        setItems(prev => prev.map(it => {
          if (it.id === itemId) {
            return {
              ...it,
              title: result.title || '',
              price: result.price || '',
              description: result.description || '',
              conditionNote: selectedRuleObj?.condition_note || '',
              category: result.category_name || result.category || '',
              categoryId: result.category_id || '',
              selectedAspects: initialAspects,
              sku: result.sku || '',
              aspects: result.aspects || [],
              status: 'analyzed'
            };
          }
          return it;
        }));
      } else {
        throw new Error(response.data.message || 'AI Scan failed');
      }
    } catch (error) {
      console.error("Analysis failed:", error);
      const errMsg = error.response?.data?.error || error.response?.data?.message || error.message || "Failed to analyze";
      setItems(prev => prev.map(it => it.id === itemId ? { ...it, status: 'failed', error: errMsg } : it));
      toast.error(`Scan failed for slot: ${errMsg}`);
    }
  };

  // Run AI scans for all selected pending items
  const analyzeSelected = async () => {
    const selectedItems = items.filter(it => it.selected && it.images.length > 0 && (it.status === 'pending' || it.status === 'failed'));
    if (selectedItems.length === 0) {
      toast.warning("No pending, selected items with images were found to analyze.");
      return;
    }

    toast.info(`Starting batch AI analysis for ${selectedItems.length} items...`);
    // Run sequentially to avoid aggressive server bursts
    for (const item of selectedItems) {
      await analyzeSingleItem(item.id);
    }
    toast.success("Batch AI analysis completed.");
  };

  // Inline table edits
  const handleFieldChange = (itemId, field, value) => {
    setItems(prev => prev.map(it => it.id === itemId ? { ...it, [field]: value } : it));
  };

  // Handles custom Category Selection
  const handleCategorySelect = async (itemId, catOpt) => {
    setItems(prev => prev.map(it => it.id === itemId ? { ...it, category: catOpt.label, categoryId: catOpt.id, aspects: [] } : it));
    
    try {
      const response = await ebayService.getCategoryAspects(catOpt.id);
      if (response.data.success) {
        setItems(prev => prev.map(it => it.id === itemId ? { ...it, aspects: response.data.data || [] } : it));
      }
    } catch (err) {
      console.error("Error fetching aspects:", err);
    }
  };

  // Active Edit Item Drawer helpers
  const activeItem = useMemo(() => items.find(it => it.id === activeEditItemId), [items, activeEditItemId]);

  const handleAspectChange = (aspectName, aspectValue) => {
    if (!activeEditItemId) return;
    setItems(prev => prev.map(it => {
      if (it.id === activeEditItemId) {
        return {
          ...it,
          selectedAspects: {
            ...it.selectedAspects,
            [aspectName]: [aspectValue]
          }
        };
      }
      return it;
    }));
  };

  // Batch operations: Bulk Save Drafts
  const saveSelectedDrafts = async () => {
    if (isSaving || isPublishing || isBatchAnalyzing) return;
    const selectedToSave = items.filter(it => it.selected && it.images.length > 0 && it.title);
    if (selectedToSave.length === 0) {
      toast.warning("Please select analyzed/populated listings to save.");
      return;
    }

    setIsSaving(true);
    // Update statuses to 'saving'
    setItems(prev => prev.map(it => it.selected ? { ...it, status: 'saving', error: '' } : it));

    try {
      const payload = selectedToSave.map(it => {
        const itemCondition = it.selectedCondition || globalCondition;
        const resolvedConditionObj = EBAY_CONDITIONS.find(c => c.label === itemCondition) || EBAY_CONDITIONS[0];
        
        return {
          _id: it._id || (it.id && !it.id.startsWith('item-') ? it.id : (it.ebayListingId && it.ebayListingId.length === 24 ? it.ebayListingId : undefined)),
          title: it.title,
          description: it.description,
          price: it.price,
          sku: it.sku,
          category: it.category,
          categoryId: it.categoryId,
          images: it.images,
          itemSpecifics: it.selectedAspects,
          conditionNote: it.conditionNote || '',
          selectedRule: globalRule,
          selectedCondition: itemCondition,
          conditionId: it.conditionId || resolvedConditionObj.id,
          selectedModel: globalModel,
          packageWeight: it.packageWeight,
          packageDimensions: it.packageDimensions,
          fulfillmentPolicyId: it.fulfillmentPolicyId,
          paymentPolicyId: it.paymentPolicyId,
          returnPolicyId: it.returnPolicyId,
          locationKey: it.locationKey,
          status: 'draft',
          platform: 'ebay'
        };
      });

      const res = await bulkListingEbayService.saveDrafts({ listings: payload });
      
      if (res.data.success) {
        const results = res.data.data;
        let successCount = 0;
        
        setItems(prev => prev.map((it, idx) => {
          if (it.selected) {
            const batchRes = results.find((r, rIdx) => {
              // Match by index or title
              return rIdx === idx || r.itemTitle === it.title;
            });

            if (batchRes && batchRes.success) {
              successCount++;
              return {
                ...it,
                id: batchRes.listing?._id || batchRes.listing?.id || it.id,
                _id: batchRes.listing?._id || batchRes.listing?.id || it._id,
                status: 'saved',
                error: ''
              };
            } else {
              return {
                ...it,
                status: 'failed',
                error: batchRes?.error || 'Failed to save draft'
              };
            }
          }
          return it;
        }));

        toast.success(`Successfully saved ${successCount} drafts!`);
      } else {
        throw new Error(res.data.message || 'Bulk Save operation failed');
      }
    } catch (err) {
      console.error("Bulk save drafts failed:", err);
      toast.error("Failed to save drafts: " + err.message);
      setItems(prev => prev.map(it => it.selected ? { ...it, status: 'failed', error: err.message } : it));
    } finally {
      setIsSaving(false);
    }
  };

  // Batch operations: Bulk Publish Listings
  const publishSelectedListings = async () => {
    if (isSaving || isPublishing || isBatchAnalyzing) return;
    const selectedToPublish = items.filter(it => it.selected && it.images.length > 0 && it.title);
    if (selectedToPublish.length === 0) {
      toast.warning("Please select analyzed/populated listings to publish.");
      return;
    }

    setIsPublishing(true);
    // Update status to 'publishing'
    setItems(prev => prev.map(it => it.selected ? { ...it, status: 'publishing', error: '' } : it));

    try {
      const payload = selectedToPublish.map(it => {
        const itemCondition = it.selectedCondition || globalCondition;
        const resolvedConditionObj = EBAY_CONDITIONS.find(c => c.label === itemCondition) || EBAY_CONDITIONS[0];

        return {
          _id: it._id || (it.id && !it.id.startsWith('item-') ? it.id : (it.ebayListingId && it.ebayListingId.length === 24 ? it.ebayListingId : undefined)),
          title: it.title,
          description: it.description,
          price: it.price,
          sku: it.sku,
          category: it.category,
          categoryId: it.categoryId,
          images: it.images,
          itemSpecifics: it.selectedAspects,
          conditionNote: it.conditionNote || '',
          selectedRule: globalRule,
          selectedCondition: itemCondition,
          conditionId: it.conditionId || resolvedConditionObj.id,
          selectedModel: globalModel,
          packageWeight: it.packageWeight,
          packageDimensions: it.packageDimensions,
          fulfillmentPolicyId: it.fulfillmentPolicyId,
          paymentPolicyId: it.paymentPolicyId,
          returnPolicyId: it.returnPolicyId,
          locationKey: it.locationKey,
          platform: 'ebay'
        };
      });

      const res = await bulkListingEbayService.publish({ listings: payload });

      if (res.data.success) {
        const results = res.data.data;
        let successCount = 0;

        setItems(prev => prev.map((it, idx) => {
          if (it.selected) {
            const batchRes = results.find(r => r.listingId === it.ebayListingId || r.title === it.title);

            if (batchRes && batchRes.success) {
              successCount++;
              return {
                ...it,
                status: 'published',
                ebayListingId: batchRes.ebayListingId,
                ebayUrl: batchRes.ebayUrl,
                error: ''
              };
            } else {
              return {
                ...it,
                status: 'failed',
                error: batchRes?.error || 'Failed to publish to eBay'
              };
            }
          }
          return it;
        }));

        if (successCount === selectedToPublish.length) {
          toast.success("All selected listings successfully published to eBay!");
        } else {
          toast.warning(`Published ${successCount}/${selectedToPublish.length} successfully. Check errors for details.`);
        }
      } else {
        throw new Error(res.data.message || 'Bulk Publish operation failed');
      }
    } catch (err) {
      console.error("Bulk publish failed:", err);
      toast.error("Failed to publish: " + err.message);
      setItems(prev => prev.map(it => it.selected ? { ...it, status: 'failed', error: err.message } : it));
    } finally {
      setIsPublishing(false);
    }
  };

  const isAllSelected = useMemo(() => items.every(it => it.selected), [items]);

  return (
    <div className="max-w-[98%] mx-auto space-y-8 px-2 relative min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-end border-b border-slate-100 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center">
            <Sparkles className="mr-2.5 text-indigo-600 animate-pulse" /> Create eBay Bulk Listings
          </h1>
          <p className="text-slate-500 text-xs mt-1">
            Setup parameters, upload image queues, scan with AI, and publish to eBay in bulk.
          </p>
        </div>
      </div>

      {/* Global AI & Policy Setup Card */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
        <h3 className="text-xs font-black text-indigo-950 uppercase tracking-[0.2em] flex items-center">
          <Info size={14} className="mr-2 text-indigo-500" /> Global AI & Policy Defaults
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">AI Model</label>
            <SearchableDropdown 
              value={modelOptions.find(m => m.id === globalModel)?.label || 'GPT-4o Mini'}
              onSelect={(opt) => setGlobalModel(opt.id)}
              options={modelOptions}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Listing Rule</label>
            <SearchableDropdown 
              value={rules.find(r => (r._id || r.id) === globalRule)?.name || ''}
              onSelect={(opt) => setGlobalRule(opt.id)}
              options={ruleOptions}
              placeholder="Select custom rule..."
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Product Condition</label>
            <SearchableDropdown 
              value={conditionOptions.find(c => c.label === globalCondition)?.label || 'Pre-owned'}
              onSelect={(opt) => setGlobalCondition(opt.label)}
              options={conditionOptions}
            />
          </div>
        </div>

        <div className="border-t border-slate-100 pt-6 space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wider flex items-center">
                <Upload size={14} className="mr-2 text-indigo-500 animate-bounce" /> Photo Scanning Pool
              </h4>
              <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                Upload all product photos here first. The AI will group matching photos of the same item into one listing, and split different items into separate rows automatically.
              </p>
            </div>
            
            <div className="flex items-center gap-3 shrink-0">
              {sourcePhotos.length > 0 && (
                <button
                  onClick={clearSourcePhotos}
                  type="button"
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Clear Pool
                </button>
              )}
              <label className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-750 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-lg shadow-indigo-500/10">
                <Upload size={14} /> Upload Photos
                <input 
                  type="file" 
                  multiple 
                  accept="image/*"
                  onChange={handleBatchPhotoSelect}
                  className="hidden" 
                />
              </label>
            </div>
          </div>

          {sourcePhotos.length > 0 && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
              <div className="flex flex-wrap gap-2.5 max-h-40 overflow-y-auto pr-2">
                {sourcePhotos.map((img, idx) => (
                  <div key={idx} className="relative w-14 h-14 rounded-xl overflow-hidden border border-slate-200 shadow-sm shrink-0 bg-white group">
                    <img src={img} alt={`Source ${idx}`} className="w-full h-full object-cover" />
                    <button 
                      onClick={() => removeSourcePhoto(idx)}
                      type="button"
                      className="absolute top-0 right-0 p-1 bg-rose-500 text-white rounded-bl hover:bg-rose-600 opacity-90 transition-opacity"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <button
                  disabled={isBatchAnalyzing}
                  onClick={runBatchGroupingAndScan}
                  type="button"
                  className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-750 text-white rounded-2xl text-xs font-black transition-all cursor-pointer shadow-lg shadow-indigo-500/15 disabled:opacity-50"
                >
                  {isBatchAnalyzing ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Grouping & Scanning with AI...
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} className="text-indigo-200 animate-pulse" /> Group & Scan with AI
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Table/Queue of items */}
      <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                <th className="py-4 px-6 w-12 text-center">
                  <input 
                    type="checkbox" 
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20 accent-indigo-600"
                  />
                </th>
                <th className="py-4 px-3 w-40">Images</th>
                <th className="py-4 px-3 min-w-[200px]">Title</th>
                <th className="py-4 px-3 w-32">SKU</th>
                <th className="py-4 px-3 w-28">Price ($)</th>
                <th className="py-4 px-3 min-w-[220px]">eBay Category</th>
                <th className="py-4 px-3 w-36 text-center">AI Status</th>
                <th className="py-4 px-6 w-32 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fetchingDetails ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 font-semibold">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Loader2 size={24} className="animate-spin text-indigo-600" />
                      <span>Fetching full details for selected listings...</span>
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-xs font-semibold">
                    No items in queue. Upload images or select drafts to get started.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const isUploading = item.status === 'uploading';
                const isAnalyzing = item.status === 'analyzing';
                const isSaving = item.status === 'saving';
                const isPublishing = item.status === 'publishing';
                const isBusy = isUploading || isAnalyzing || isSaving || isPublishing;

                return (
                  <tr 
                    key={item.id} 
                    className={`transition-colors hover:bg-slate-50/50 ${item.selected ? 'bg-indigo-50/5' : ''}`}
                  >
                    {/* Checkbox */}
                    <td className="py-4 px-6 text-center">
                      <input 
                        type="checkbox" 
                        checked={item.selected}
                        disabled={isBusy}
                        onChange={() => toggleSelect(item.id)}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20 accent-indigo-600 disabled:opacity-50"
                      />
                    </td>

                    {/* Images Column */}
                    <td className="py-4 px-3">
                      <div className="flex flex-wrap items-center gap-1.5 max-w-[180px]">
                        {item.images.slice(0, 3).map((img, idx) => (
                          <div key={idx} className="relative w-8 h-8 rounded-lg overflow-hidden border border-slate-100 shrink-0">
                            <img src={img} alt="Thumb" className="w-full h-full object-cover" />
                            <button 
                              onClick={() => removeImage(item.id, idx)}
                              className="absolute top-0 right-0 p-0.5 bg-rose-500 text-white rounded-bl hover:bg-rose-600"
                            >
                              <X size={8} />
                            </button>
                          </div>
                        ))}
                        {item.images.length > 3 && (
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 border border-slate-200">
                            +{item.images.length - 3}
                          </div>
                        )}
                        
                        <label className="w-8 h-8 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50/30 cursor-pointer transition-all shrink-0">
                          <Plus size={14} />
                          <input 
                            type="file" 
                            multiple 
                            accept="image/*"
                            onChange={(e) => handleImageChange(item.id, e)}
                            className="hidden" 
                          />
                        </label>
                      </div>
                    </td>

                    {/* Title */}
                    <td className="py-4 px-3">
                      <input 
                        type="text" 
                        placeholder={isAnalyzing ? "Generating title..." : "No title yet"}
                        value={item.title}
                        disabled={isBusy || item.status === 'published'}
                        onChange={(e) => handleFieldChange(item.id, 'title', e.target.value)}
                        className="w-full h-8 px-2 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-indigo-500 disabled:bg-slate-50"
                      />
                    </td>

                    {/* SKU */}
                    <td className="py-4 px-3">
                      <input 
                        type="text" 
                        placeholder="Autogen"
                        value={item.sku}
                        disabled={isBusy || item.status === 'published'}
                        onChange={(e) => handleFieldChange(item.id, 'sku', e.target.value)}
                        className="w-full h-8 px-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 outline-none focus:border-indigo-500 disabled:bg-slate-50"
                      />
                    </td>

                    {/* Price */}
                    <td className="py-4 px-3">
                      <input 
                        type="text" 
                        placeholder="0.00"
                        value={item.price}
                        disabled={isBusy || item.status === 'published'}
                        onChange={(e) => handleFieldChange(item.id, 'price', e.target.value)}
                        className="w-full h-8 px-2 border border-slate-200 rounded-lg text-xs font-extrabold text-slate-800 outline-none focus:border-indigo-500 disabled:bg-slate-50"
                      />
                    </td>

                    {/* Category Searchable Dropdown */}
                    <td className="py-4 px-3">
                      <CategorySearchDropdown 
                        value={item.category}
                        onSelect={(cat) => handleCategorySelect(item.id, cat)}
                        placeholder="Search categories..."
                      />
                    </td>

                    {/* Status badge */}
                    <td className="py-4 px-3 text-center">
                      {isUploading && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-600 border border-amber-100">
                          <Loader2 size={10} className="animate-spin mr-1" /> Uploading
                        </span>
                      )}
                      {isAnalyzing && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100">
                          <Loader2 size={10} className="animate-spin mr-1" /> Scanning
                        </span>
                      )}
                      {isSaving && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-blue-600 border border-blue-100 animate-pulse">
                          Saving...
                        </span>
                      )}
                      {isPublishing && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 animate-pulse">
                          Publishing...
                        </span>
                      )}
                      {!isBusy && item.status === 'pending' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                          Pending Setup
                        </span>
                      )}
                      {!isBusy && item.status === 'analyzed' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
                          AI Scanned
                        </span>
                      )}
                      {!isBusy && item.status === 'saved' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                          Draft Saved
                        </span>
                      )}
                      {!isBusy && item.status === 'published' && (
                        <a 
                          href={item.ebayUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-700 hover:underline border border-emerald-200"
                        >
                          Live <ExternalLink size={8} className="ml-1" />
                        </a>
                      )}
                      {!isBusy && item.status === 'failed' && (
                        <div className="relative group inline-block">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 text-rose-600 border border-rose-100 cursor-pointer">
                            <AlertCircle size={10} className="mr-1" /> Error
                          </span>
                          {item.error && (
                            <div className="absolute z-[1000] bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-slate-900 text-white text-[9px] font-bold rounded-lg p-2 max-w-[200px] shadow-xl text-center">
                              {item.error}
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Action Buttons */}
                    <td className="py-4 px-6 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {item.images.length > 0 && item.status === 'pending' && (
                          <button 
                            onClick={() => analyzeSingleItem(item.id)}
                            className="p-1.5 hover:bg-indigo-50 rounded-lg text-indigo-600 transition-colors"
                            title="Analyze item with AI"
                          >
                            <Sparkles size={14} />
                          </button>
                        )}
                        <button 
                          onClick={() => setActiveEditItemId(item.id)}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
                          title="Edit advanced details"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button 
                          onClick={() => removeSlot(item.id)}
                          disabled={isBusy}
                          className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-500 transition-colors disabled:opacity-50"
                          title="Delete slot"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>

        {/* Footer actions inside table card */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <button 
            onClick={addSlot}
            className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 hover:border-indigo-300 bg-white rounded-xl text-xs font-bold text-slate-700 hover:text-indigo-600 transition-all cursor-pointer shadow-sm"
          >
            <Plus size={14} /> Add Listing Slot
          </button>
          
          <div className="flex items-center gap-3">
            <button
              onClick={analyzeSelected}
              disabled={isSaving || isPublishing || isBatchAnalyzing || fetchingDetails}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-xl text-xs font-bold text-indigo-600 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles size={14} /> Scan Selected with AI
            </button>
            <button
              onClick={saveSelectedDrafts}
              disabled={isSaving || isPublishing || isBatchAnalyzing || fetchingDetails}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-lg shadow-blue-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-1" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={14} /> Save Selected Drafts
                </>
              )}
            </button>
            <button
              onClick={publishSelectedListings}
              disabled={isSaving || isPublishing || isBatchAnalyzing || fetchingDetails}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-lg shadow-emerald-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPublishing ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-1" />
                  Publishing...
                </>
              ) : (
                <>
                  <Send size={14} /> Publish Selected to eBay
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Advanced Details Editing Sliding Drawer */}
      <AnimatePresence>
        {activeEditItemId && activeItem && (
          <>
            {/* Overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.3 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveEditItemId(null)}
              className="fixed inset-0 bg-slate-900 z-[999]"
            />
            {/* Drawer Container */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-full md:w-[600px] bg-white shadow-2xl z-[1000] border-l border-slate-100 flex flex-col"
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h2 className="text-sm font-black text-slate-800 truncate max-w-[400px]">
                    Editing: {activeItem.title || 'Untitled Listing Slot'}
                  </h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                    Configure item specifics, policies & description
                  </p>
                </div>
                <button 
                  onClick={() => setActiveEditItemId(null)}
                  className="p-2 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-700 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Product Description */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-0.5">Description (HTML Supported)</label>
                  <textarea
                    rows={8}
                    value={activeItem.description || ''}
                    onChange={(e) => handleFieldChange(activeEditItemId, 'description', e.target.value)}
                    placeholder="Provide a detailed product description. Markdown or HTML is allowed."
                    className="w-full p-4 bg-slate-50 border border-slate-100 hover:border-slate-200 focus:border-indigo-500 rounded-2xl text-xs font-semibold outline-none transition-all focus:bg-white resize-y"
                  />
                </div>

                {/* Condition and Condition Note Section */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] border-b border-slate-50 pb-2">Product Condition & Details</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Condition</label>
                      <SearchableDropdown 
                        value={activeItem.selectedCondition || globalCondition}
                        onSelect={(opt) => {
                          handleFieldChange(activeEditItemId, 'selectedCondition', opt.label);
                          handleFieldChange(activeEditItemId, 'conditionId', opt.id);
                        }}
                        options={conditionOptions}
                        placeholder="Global Default"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Condition Note</label>
                      <input 
                        type="text"
                        value={activeItem.conditionNote || ''}
                        onChange={(e) => handleFieldChange(activeEditItemId, 'conditionNote', e.target.value)}
                        placeholder="Condition details..."
                        className="w-full h-11 px-4 bg-white border border-slate-200 rounded-2xl text-xs font-semibold outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Policies Selector */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] border-b border-slate-50 pb-2">Business Policies (Overrides)</h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Fulfillment Policy</label>
                      <SearchableDropdown 
                        value={ebayPolicies.fulfillment.find(p => p.id === activeItem.fulfillmentPolicyId)?.label || ''}
                        onSelect={(opt) => handleFieldChange(activeEditItemId, 'fulfillmentPolicyId', opt.id)}
                        options={ebayPolicies.fulfillment}
                        placeholder="Rule Default"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Payment Policy</label>
                      <SearchableDropdown 
                        value={ebayPolicies.payment.find(p => p.id === activeItem.paymentPolicyId)?.label || ''}
                        onSelect={(opt) => handleFieldChange(activeEditItemId, 'paymentPolicyId', opt.id)}
                        options={ebayPolicies.payment}
                        placeholder="Rule Default"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Return Policy</label>
                      <SearchableDropdown 
                        value={ebayPolicies.returns.find(p => p.id === activeItem.returnPolicyId)?.label || ''}
                        onSelect={(opt) => handleFieldChange(activeEditItemId, 'returnPolicyId', opt.id)}
                        options={ebayPolicies.returns}
                        placeholder="Rule Default"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Merchant Location</label>
                      <SearchableDropdown 
                        value={ebayPolicies.locations.find(l => l.id === activeItem.locationKey)?.label || ''}
                        onSelect={(opt) => handleFieldChange(activeEditItemId, 'locationKey', opt.id)}
                        options={ebayPolicies.locations}
                        placeholder="Rule Default"
                      />
                    </div>
                  </div>
                </div>

                {/* Shipping Weights & Dimensions */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] border-b border-slate-50 pb-2">Package Weight & Dimensions</h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Weight (lbs & oz)</label>
                      <div className="flex gap-2">
                        <input 
                          type="number" 
                          placeholder="lbs"
                          value={activeItem.packageWeight?.lbs || ''}
                          onChange={(e) => handleFieldChange(activeEditItemId, 'packageWeight', { ...activeItem.packageWeight, lbs: Number(e.target.value) })}
                          className="w-full h-10 px-3 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500 font-bold"
                        />
                        <input 
                          type="number" 
                          placeholder="oz"
                          value={activeItem.packageWeight?.oz || ''}
                          onChange={(e) => handleFieldChange(activeEditItemId, 'packageWeight', { ...activeItem.packageWeight, oz: Number(e.target.value) })}
                          className="w-full h-10 px-3 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500 font-bold"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Dimensions (L x W x H inches)</label>
                      <div className="flex gap-1.5">
                        <input 
                          type="number" 
                          placeholder="L"
                          value={activeItem.packageDimensions?.length || ''}
                          onChange={(e) => handleFieldChange(activeEditItemId, 'packageDimensions', { ...activeItem.packageDimensions, length: Number(e.target.value) })}
                          className="w-full h-10 px-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500 font-bold text-center"
                        />
                        <input 
                          type="number" 
                          placeholder="W"
                          value={activeItem.packageDimensions?.width || ''}
                          onChange={(e) => handleFieldChange(activeEditItemId, 'packageDimensions', { ...activeItem.packageDimensions, width: Number(e.target.value) })}
                          className="w-full h-10 px-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500 font-bold text-center"
                        />
                        <input 
                          type="number" 
                          placeholder="H"
                          value={activeItem.packageDimensions?.height || ''}
                          onChange={(e) => handleFieldChange(activeEditItemId, 'packageDimensions', { ...activeItem.packageDimensions, height: Number(e.target.value) })}
                          className="w-full h-10 px-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500 font-bold text-center"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Category Aspects */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] border-b border-slate-50 pb-2">Item Specifics / Aspects</h4>
                  
                  {activeItem.aspects && activeItem.aspects.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {activeItem.aspects.map((aspect) => {
                        const name = aspect.localizedAspectName;
                        const isRequired = aspect.aspectConstraint?.aspectRequired === true || aspect.aspectConstraint?.aspectUsage === 'REQUIRED';
                        const isRecommended = aspect.aspectConstraint?.aspectUsage === 'RECOMMENDED';
                        const values = aspect.aspectValues || aspect.values || [];
                        const currentVal = activeItem.selectedAspects[name]?.[0] || '';

                        const optionsList = values.map(v => ({
                          id: typeof v === 'object' && v !== null ? (v.localizedValue || v.label || v.value || '') : String(v),
                          label: typeof v === 'object' && v !== null ? (v.localizedValue || v.label || v.value || '') : String(v),
                        }));

                        return (
                          <div key={name} className="space-y-1">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider flex items-center">
                              {name} 
                              {isRequired && <span className="text-rose-500 ml-1 font-bold">*</span>}
                              {isRecommended && <span className="text-indigo-400 ml-1 font-medium">(Rec)</span>}
                            </label>
                            {optionsList.length > 0 ? (
                              <SearchableDropdown
                                value={currentVal}
                                onSelect={(opt) => handleAspectChange(name, opt.label)}
                                options={optionsList}
                                placeholder="Select value..."
                              />
                            ) : (
                              <input 
                                type="text"
                                value={currentVal}
                                onChange={(e) => handleAspectChange(name, e.target.value)}
                                placeholder={`Enter ${name}...`}
                                className="w-full h-11 px-4 bg-white border border-slate-200 rounded-2xl text-xs font-semibold outline-none focus:border-indigo-500"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-6 bg-slate-50 rounded-2xl text-center text-xs text-slate-400 font-bold">
                      Scan product images with AI first to resolve category-specific details.
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                <button 
                  onClick={() => setActiveEditItemId(null)}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-750 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/10 transition-all cursor-pointer"
                >
                  Save & Return
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BulkListingEbay;
