import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Save,
  Rocket,
  X,
  Search,
  ChevronDown,
  Check,
  Tag,
  List,
  Eye,
  Code,
  ArrowLeft,
  ArrowRight,
  Trash2
} from 'lucide-react';
import { ruleService, aiService, ebayService, listingService } from '../services/api';
import { EBAY_CONDITIONS } from '../constants/ebayConditions';

const SearchableDropdown = ({ value, onSelect, options = [], placeholder = 'Select...', disabled = false }) => {
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
        className="w-full h-12 px-4 bg-white border border-slate-200 rounded-2xl text-left flex items-center justify-between text-sm font-bold text-slate-700 disabled:opacity-60 transition-all hover:border-indigo-300 focus:ring-2 focus:ring-indigo-500/10"
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
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

  // Debounced search
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
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
        />
        <ChevronDown 
          className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 cursor-pointer" 
          onClick={() => setIsOpen(!isOpen)}
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

const CreateListing = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [descriptionMode, setDescriptionMode] = useState('preview'); // 'edit' or 'preview'
  const [rules, setRules] = useState([]);
  const [files, setFiles] = useState([]);
  const [aspects, setAspects] = useState([]);
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
  });

  // Fetch rules from API
  useEffect(() => {
    const fetchRules = async () => {
      try {
        const response = await ruleService.getAll();
        if (response.data.success) {
          setRules(response.data.data);
        }
      } catch (error) {
        console.error("Error fetching rules:", error);
      }
    };
    fetchRules();
  }, []);

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleImageUpload = (e) => {
    const uploadedFiles = Array.from(e.target.files);
    setFiles([...files, ...uploadedFiles]);
    const newImagePreviews = uploadedFiles.map(file => URL.createObjectURL(file));
    setFormData({ ...formData, images: [...formData.images, ...newImagePreviews] });
  };

  const startAIFetch = async () => {
    if (!formData.selectedRule) {
      alert("Please select an AI Listing Rule");
      return;
    }
    
    if (files.length === 0) {
      alert("Please upload at least one image");
      return;
    }

    setLoading(true);
    setStep(2);
    
    const selectedRuleObj = rules.find(r => (r._id || r.id) === formData.selectedRule);
    
    try {
      // Convert all files to base64
      const base64Images = await Promise.all(files.map(file => fileToBase64(file)));
      
      const response = await aiService.analyze({
        images: base64Images, 
        title_sequence: selectedRuleObj?.title_sequence || [],
        description_prompt: selectedRuleObj?.description_prompt || '',
        condition_note: selectedRuleObj?.condition_note || '',
        condition_name: formData.selectedCondition
      });

      if (response.data.success) {
        const result = response.data.data;
        setAspects(result.aspects || []);
        
        // Pre-fill aspects that match AI identified item_specifics or title_parts
        const initialAspects = {};
        if (result.aspects) {
          result.aspects.forEach(aspect => {
            const name = aspect.localizedAspectName;
            // Priority 1: AI identified item specifics
            if (result.item_specifics && result.item_specifics[name]) {
              initialAspects[name] = [result.item_specifics[name]];
            } 
            // Priority 2: AI identified title parts (fallback)
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

  const conditionOptions = useMemo(() => EBAY_CONDITIONS.map(c => ({
    id: c.id,
    label: c.label,
    description: c.description
  })), []);

  const moveImage = (index, direction) => {
    const newImages = [...formData.images];
    const newFiles = [...files];
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newImages.length) return;
    
    // Swap images
    [newImages[index], newImages[targetIndex]] = [newImages[targetIndex], newImages[index]];
    // Swap files
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
      selectedAspects: {} // Reset aspects as category changed
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
    const selectedRuleObj = rules.find(r => (r._id || r.id) === formData.selectedRule);
    
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
      packageWeight: selectedRuleObj?.packageWeight || { lbs: 0, oz: 0 },
      packageDimensions: selectedRuleObj?.packageDimensions || { length: 0, width: 0, height: 0 },
      status: 'draft'
    };

    try {
      const response = await listingService.create(listingData);
      if (response.data.success) {
        alert('Listing saved as Draft successfully!');
        navigate('/listings');
      }
    } catch (error) {
      console.error("Error saving draft:", error);
      alert("Failed to save draft. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  const handlePublishListing = async () => {
    setLoading(true);
    const selectedRuleObj = rules.find(r => (r._id || r.id) === formData.selectedRule);
    
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
      packageWeight: selectedRuleObj?.packageWeight || { lbs: 0, oz: 0 },
      packageDimensions: selectedRuleObj?.packageDimensions || { length: 0, width: 0, height: 0 },
      status: 'draft'
    };

    try {
      const createResponse = await listingService.create(listingData);
      if (createResponse.data.success) {
        const listingId = createResponse.data.data._id || createResponse.data.data.id;
        const publishResponse = await listingService.publish(listingId);
        if (publishResponse.data.success) {
          alert('Listing published to eBay successfully!');
          navigate('/listings');
        } else {
          alert('Listing saved, but failed to publish to eBay: ' + (publishResponse.data.message || 'Unknown error'));
          navigate('/listings');
        }
      }
    } catch (error) {
      console.error("Error publishing listing:", error);
      alert("Failed to publish listing. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (step === 1) {
      startAIFetch();
    } else if (step === 4) {
      handlePublishListing();
    } else {
      setStep(step + 1);
    }
  };
  
  const prevStep = () => setStep(step - 1);

  return (
    <div className="max-w-[95%] mx-auto space-y-8 px-4">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Create New Listing</h1>
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
              {/* Image Section */}
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

              {/* Selection Section */}
              <div className="bg-slate-50/50 p-8 rounded-[2.5rem] border border-slate-100 space-y-8">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-black text-indigo-900 uppercase tracking-[0.2em] flex items-center">
                      <Sparkles size={16} className="mr-2 text-indigo-500" /> AI Configuration Setup
                    </h3>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{rules.length} Rules Available</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Rules Dropdown */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center">
                      <Zap size={14} className="mr-1.5 text-indigo-600" /> Select AI Listing Rule
                    </label>
                    <SearchableDropdown 
                      value={rules.find(r => (r._id || r.id) === formData.selectedRule)?.name || ''}
                      onSelect={(opt) => setFormData({...formData, selectedRule: opt.id})}
                      options={ruleOptions}
                      placeholder={rules.length ? 'Choose a rule...' : 'No rules found'}
                      disabled={rules.length === 0}
                    />
                  </div>

                  {/* Condition Dropdown */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center">
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
                  {/* Left Side: Images Preview */}
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
                    <div className="p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                      <h4 className="text-[10px] font-black text-indigo-900 uppercase tracking-widest mb-2">Analysis Results</h4>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Zap size={14} className="text-indigo-600" />
                          <span className="text-xs font-bold text-indigo-700">AI Generated Content</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={14} className="text-emerald-600" />
                          <span className="text-xs font-bold text-emerald-700">Sequence Followed</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Form */}
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
                          style={{
                            // Lightweight manual typography to replace missing 'prose'
                            wordBreak: 'break-word'
                          }}
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
                  {aspects.map((aspect) => (
                    <div key={aspect.localizedAspectName} className="space-y-2">
                      <div className="flex items-center justify-between ml-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                          {aspect.localizedAspectName}
                          {aspect.aspectConstraint?.aspectRequired && <span className="text-rose-500 ml-1">*</span>}
                        </label>
                      </div>
                      
                      {(() => {
                        const vals = aspect.aspectValues || aspect.values || [];
                        if (vals.length > 0) {
                          const options = vals.map(v => {
                            const valText = typeof v === 'object' && v !== null ? (v.localizedValue || v.label || '') : String(v);
                            return { id: valText, label: valText };
                          });
                          return (
                            <SearchableDropdown 
                              value={formData.selectedAspects[aspect.localizedAspectName]?.[0] || ''}
                              onSelect={(opt) => handleAspectChange(aspect.localizedAspectName, opt.label)}
                              options={options}
                              placeholder={`Select ${aspect.localizedAspectName}...`}
                            />
                          );
                        } else {
                          return (
                            <input 
                              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-semibold outline-none focus:border-indigo-500 transition-all shadow-sm"
                              value={formData.selectedAspects[aspect.localizedAspectName]?.[0] || ''}
                              onChange={(e) => handleAspectChange(aspect.localizedAspectName, e.target.value)}
                              placeholder={`Enter ${aspect.localizedAspectName}...`}
                            />
                          );
                        }
                      })()}
                    </div>
                  ))}
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
              {/* Left Column: Summary & Actions */}
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
                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Applied eBay Policies</h4>
                   <div className="space-y-3">
                     <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Shipping</span>
                        <span className="text-[10px] font-black text-indigo-600 truncate max-w-[120px]">
                          {rules.find(r => (r._id || r.id) === formData.selectedRule)?.fulfillmentPolicyId || 'Default'}
                        </span>
                     </div>
                     <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Payment</span>
                        <span className="text-[10px] font-black text-indigo-600 truncate max-w-[120px]">
                          {rules.find(r => (r._id || r.id) === formData.selectedRule)?.paymentPolicyId || 'Default'}
                        </span>
                     </div>
                     <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Return</span>
                        <span className="text-[10px] font-black text-indigo-600 truncate max-w-[120px]">
                          {rules.find(r => (r._id || r.id) === formData.selectedRule)?.returnPolicyId || 'Default'}
                        </span>
                     </div>
                     <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                        <span className="text-[10px] font-bold text-indigo-700 uppercase">Item Location</span>
                        <span className="text-[10px] font-black text-indigo-900 truncate max-w-[120px]">
                          {rules.find(r => (r._id || r.id) === formData.selectedRule)?.locationKey || 'None'}
                        </span>
                     </div>
                   </div>
                </div>

                <div className="p-6 bg-slate-50 border border-slate-100 rounded-3xl space-y-4">
                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Weight & Dimensions</h4>
                   <div className="grid grid-cols-2 gap-3">
                     <div className="p-3 bg-white rounded-xl border border-slate-200">
                        <p className="text-[8px] font-bold text-slate-400 uppercase">Weight</p>
                        <p className="text-[10px] font-black text-slate-700">
                          {rules.find(r => (r._id || r.id) === formData.selectedRule)?.packageWeight?.lbs || 0}lb {rules.find(r => (r._id || r.id) === formData.selectedRule)?.packageWeight?.oz || 0}oz
                        </p>
                     </div>
                     <div className="p-3 bg-white rounded-xl border border-slate-200">
                        <p className="text-[8px] font-bold text-slate-400 uppercase">Dimensions</p>
                        <p className="text-[10px] font-black text-slate-700">
                          {rules.find(r => (r._id || r.id) === formData.selectedRule)?.packageDimensions?.length || 0}x{rules.find(r => (r._id || r.id) === formData.selectedRule)?.packageDimensions?.width || 0}x{rules.find(r => (r._id || r.id) === formData.selectedRule)?.packageDimensions?.height || 0}
                        </p>
                     </div>
                   </div>
                </div>

                   <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                    <p className="text-[10px] text-indigo-700 font-bold leading-relaxed">
                      All eBay listing fees will be calculated upon submission. Ensure your business policies are correctly set in settings.
                    </p>
                  </div>
                </div>

              {/* Right Column: Interactive Preview */}
              <div className="lg:col-span-8 space-y-8 overflow-y-auto max-h-[700px] pr-4 custom-scrollbar">
                {/* Image Manager */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.1em]">Manage Image Order</h3>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{formData.images.length} Photos</span>
                  </div>
                  <Reorder.Group 
                    axis="x" 
                    values={formData.images} 
                    onReorder={(newOrder) => setFormData(prev => ({ ...prev, images: newOrder }))}
                    className="grid grid-cols-4 gap-4"
                  >
                    {formData.images.map((img, i) => (
                      <Reorder.Item 
                        key={img} 
                        value={img}
                        className="aspect-square bg-slate-100 rounded-2xl relative group overflow-hidden border border-slate-200 cursor-grab active:cursor-grabbing"
                      >
                        <img src={img} className="w-full h-full object-cover pointer-events-none" alt="Product" />
                        <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteImage(i);
                          }}
                          className="absolute top-2 right-2 p-1.5 bg-rose-500/90 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-600 shadow-lg z-10"
                          title="Delete Image"
                        >
                          <Trash2 size={12} />
                        </button>
                        {i === 0 && (
                          <div className="absolute top-2 left-2 px-2 py-0.5 bg-indigo-600 text-white text-[8px] font-black uppercase rounded-md shadow-lg pointer-events-none">Main</div>
                        )}
                      </Reorder.Item>
                    ))}
                  </Reorder.Group>
                </div>

                {/* Data Overview */}
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

                  {/* Item Specifics Grid */}
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

                  {/* Description Preview */}
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
            {step === 4 && (
              <button 
                onClick={handleSaveDraft}
                className="px-8 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-all shadow-sm"
              >
                Save as Draft
              </button>
            )}

            <button 
              onClick={nextStep}
              disabled={loading || (step === 1 && !formData.selectedRule) || (step === 1 && files.length === 0)}
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

export default CreateListing;
