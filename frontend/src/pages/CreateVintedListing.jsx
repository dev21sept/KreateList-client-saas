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
import { VINTED_CONDITIONS } from '../constants/vintedConditions';

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

const CategorySearchDropdown = ({ value, onSelect, placeholder = 'Search Vinted category...' }) => {
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
        const response = await aiService.vintedSuggestCategories(searchTerm);
        if (response.data) {
          setSuggestions(response.data);
        }
      } catch (err) {
        console.error("Error fetching Vinted categories:", err);
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
            <div className="p-4 text-xs font-semibold text-slate-400 text-center">Searching Vinted Categories...</div>
          )}
          {!loading && suggestions.length === 0 && searchTerm.trim() && (
            <div className="p-4 text-xs font-semibold text-slate-400 text-center">No categories found</div>
          )}
          {!loading && suggestions.length === 0 && !searchTerm.trim() && (
            <div className="p-4 text-xs font-semibold text-slate-400 text-center">Type to search Vinted categories...</div>
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

const CreateVintedListing = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const platform = 'vinted';
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
          alert("Failed to load listing for editing.");
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
    try {
      const base64Images = await Promise.all(uploadedFiles.map(file => fileToBase64(file)));
      setFormData(prev => ({ ...prev, images: [...prev.images, ...base64Images] }));
    } catch (err) {
      console.error("Error converting images to base64:", err);
    }
  };

  const startAIFetch = async () => {
    if (formData.images.length === 0) {
      alert("Please upload at least one product image.");
      return;
    }
    if (!formData.selectedRule) {
      alert("Please select an AI Listing Rule.");
      return;
    }
    if (!formData.selectedCondition) {
      alert("Please select a Product Condition.");
      return;
    }

    setLoading(true);
    setStep(2);
    
    const selectedRuleObj = rules.find(r => (r._id || r.id) === formData.selectedRule);
    
    try {
      const response = await aiService.vintedAnalyze({
        images: formData.images, 
        title_sequence: selectedRuleObj?.title_sequence || [],
        description_prompt: selectedRuleObj?.description_prompt || '',
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
          originalPrice: result.originalPrice || '',
          color: result.color || '',
          styleTag: result.styleTag || '',
          quantity: 1,
          size: result.size || '',
          price: result.price,
          description: result.description,
          conditionNote: selectedRuleObj?.condition_note || '',
          category: result.category_name || result.category || '',
          categoryId: '',
          sku: result.sku || ''
        }));
      }
    } catch (error) {
      console.error("AI Analysis Error:", error);
      alert("Failed to analyze listing with AI. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  const ruleOptions = useMemo(() => rules.map(rule => ({
    id: rule._id || rule.id,
    label: rule.name,
    description: (rule.title_sequence || []).join(' | ')
  })), [rules]);

  const conditionOptions = useMemo(() => VINTED_CONDITIONS.map(c => ({
    id: c.id,
    label: c.label,
    description: c.description
  })), []);

  const deleteImage = (index) => {
    const newImages = formData.images.filter((_, idx) => idx !== index);
    const newFiles = files.filter((_, idx) => idx !== index);
    setFormData(prev => ({ ...prev, images: newImages }));
    setFiles(newFiles);
  };

  const handleSaveListing = async () => {
    setLoading(true);
    const selectedRuleObj = rules.find(r => (r._id || r.id) === formData.selectedRule);
    
    const listingData = {
      title: formData.title,
      brand: formData.brand,
      originalPrice: formData.originalPrice,
      color: formData.color,
      styleTag: formData.styleTag,
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
        alert(editId ? 'Vinted Listing updated successfully!' : 'Vinted Listing saved successfully!');
        navigate('/listings');
      }
    } catch (error) {
      console.error("Error saving listing:", error);
      alert(error.response?.data?.message || "Failed to save listing.");
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
      handleSaveListing();
    }
  };
  
  const prevStep = () => setStep(step - 1);

  return (
    <div className="max-w-[95%] mx-auto space-y-8 px-4">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {editId ? 'Edit Vinted Listing' : 'Create New Vinted Listing'}
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
              <div className="space-y-4">
                <label className="text-sm font-bold text-slate-700 ml-1 flex items-center">
                  <ImageIcon size={16} className="mr-2 text-indigo-600" /> Product Images
                </label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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

              <div className="bg-slate-50/50 p-8 rounded-[2.5rem] border border-slate-100 space-y-8">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-black text-indigo-900 uppercase tracking-[0.2em] flex items-center">
                      <Sparkles size={16} className="mr-2 text-indigo-500" /> AI Configuration Setup
                    </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-550 uppercase tracking-widest ml-1 flex items-center">
                      <Sparkles size={14} className="mr-1.5 text-indigo-650" /> Select AI Model
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
                      <Zap size={14} className="mr-1.5 text-indigo-650" /> Select AI Listing Rule
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
                      <Info size={14} className="mr-1.5 text-indigo-650" /> Product Condition
                    </label>
                    <SearchableDropdown 
                      value={formData.selectedCondition}
                      onSelect={(opt) => setFormData({...formData, selectedCondition: opt.label, conditionId: opt.id})}
                      options={conditionOptions}
                      placeholder="Select condition..."
                    />
                  </div>
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
                    <p className="text-xs text-slate-400 mt-1">Generating Vinted content details</p>
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
                        <input 
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-semibold outline-none focus:border-indigo-500 transition-all"
                          value={formData.brand}
                          onChange={(e) => setFormData({...formData, brand: e.target.value})}
                          placeholder="Enter brand name..."
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Vinted Category</label>
                        <CategorySearchDropdown 
                          value={formData.category}
                          onSelect={(opt) => setFormData({...formData, category: opt.fullName, categoryId: opt.id})}
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
                        <input 
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-semibold outline-none focus:border-indigo-500 transition-all"
                          value={formData.color}
                          onChange={(e) => setFormData({...formData, color: e.target.value})}
                          placeholder="Color..."
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Size</label>
                        <input 
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-semibold outline-none focus:border-indigo-500 transition-all"
                          value={formData.size}
                          onChange={(e) => setFormData({...formData, size: e.target.value})}
                          placeholder="Size..."
                        />
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
                            Preview HTML
                          </button>
                          <button 
                            type="button"
                            onClick={() => setDescriptionMode('edit')}
                            className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${descriptionMode === 'edit' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                          >
                            Edit Source
                          </button>
                        </div>
                      </div>
                      
                      {descriptionMode === 'preview' ? (
                        <div 
                          className="w-full min-h-[160px] p-4 bg-slate-50 border border-slate-250 rounded-2xl text-slate-700 text-xs leading-relaxed overflow-y-auto max-h-[300px]"
                          dangerouslySetInnerHTML={{ __html: formData.description }}
                        />
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
                  <CheckCircle2 className="w-5 h-5 text-indigo-650" />
                  <span className="text-xs font-bold text-indigo-900">Your Vinted listing is ready to be saved as a draft.</span>
                </div>

                <div className="border border-slate-200 rounded-[2rem] overflow-hidden bg-white shadow-sm">
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{formData.title}</h3>
                      <p className="text-[10px] text-indigo-650 font-bold uppercase mt-0.5 tracking-wider">{formData.category}</p>
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
                          <p className="font-bold text-slate-700">{formData.size || 'None'}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Color</p>
                          <p className="font-bold text-slate-700">{formData.color || 'None'}</p>
                        </div>
                      </div>
                    </div>

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
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-8 pt-6 border-t border-slate-100 flex justify-between">
          <button
            type="button"
            disabled={loading || step === 1}
            onClick={prevStep}
            className="h-12 px-6 border border-slate-200 rounded-2xl text-xs font-bold text-slate-650 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <ChevronLeft size={16} /> Back
          </button>

          <button
            type="button"
            disabled={loading || (step === 1 && formData.images.length === 0)}
            onClick={nextStep}
            className="h-12 px-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-2 cursor-pointer"
          >
            {step === 3 ? (
              loading ? 'Saving draft...' : 'Save Draft'
            ) : (
              <>
                Next Step <ChevronLeft size={16} className="rotate-180" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateVintedListing;
