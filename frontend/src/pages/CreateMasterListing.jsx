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
  ArrowRight
} from 'lucide-react';
import { ruleService, aiService, listingService } from '../services/api';
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

const CreateMasterListing = () => {
  const navigate = useNavigate();
  const { toast } = useNotification();
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
  });
  const [isConvertingImages, setIsConvertingImages] = useState(false);
  const [loadedImages, setLoadedImages] = useState({});

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
              sku: listing.sku || '',
              brand: listing.brand || '',
              size: listing.size || '',
              color: listing.color || '',
              selectedModel: listing.selectedModel || 'gpt-4o-mini',
              packageWeight: listing.packageWeight || { lbs: '', oz: '' },
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
      const response = await aiService.analyze({
        images: formData.images,
        platform: 'ebay', // ebay/general fallback
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
          price: result.price,
          description: result.description,
          conditionNote: selectedRuleObj?.condition_note || '',
          category: result.category_name || result.category,
          categoryId: result.category_id,
          sku: result.sku || '',
          brand: result.brand || '',
          size: result.size || '',
          color: result.color || '',
          packageWeight: selectedRuleObj?.packageWeight || { lbs: '', oz: '' }
        }));
        toast.success("AI Scan complete! Preview or save listing below.");
      }
    } catch (error) {
      console.error("AI Scan Error:", error);
      toast.error("Failed to analyze image with AI.");
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
      platform: 'ebay' // fallback platform
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
            {editId ? 'Edit Product Listing' : 'Create Master Product Listing'}
          </h1>
          <p className="text-slate-500 text-xs font-semibold mt-1">
            Single Image Scan to Prefill All Marketplace Listings
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
                  <button
                    onClick={() => deleteImage(idx)}
                    className="absolute top-1.5 right-1.5 p-1 bg-slate-900/60 hover:bg-rose-600 rounded-lg text-white transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
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
                  <input
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:border-indigo-500 outline-none"
                  />
                </div>

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
