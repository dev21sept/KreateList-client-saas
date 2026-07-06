import React, { useState, useEffect } from 'react';
import { X, Sparkles, Loader2, CheckCircle2, ShieldCheck, ChevronDown, Check } from 'lucide-react';
import { aiService, listingService, ruleService, externalImportService } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { EBAY_CONDITIONS } from '../constants/ebayConditions';
import { POSHMARK_CONDITIONS } from '../constants/poshmarkConditions';
import { DEPOP_CONDITIONS } from '../constants/depopConditions';
import { VINTED_CONDITIONS } from '../constants/vintedConditions';

const CrosslistingModal = ({ isOpen, onClose, listing, platform, onSyncSuccess }) => {
  const { toast } = useNotification();

  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [activeImage, setActiveImage] = useState('');
  
  // Rules and Options lists
  const [rules, setRules] = useState([]);
  const [selectedRule, setSelectedRule] = useState('');
  const [selectedCondition, setSelectedCondition] = useState('');
  const [selectedConditionId, setSelectedConditionId] = useState('');
  const [selectedModel, setSelectedModel] = useState('gpt-4o-mini');

  // Form Fields State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    originalPrice: '',
    brand: '',
    size: '',
    color: '',
    sku: '',
    category: '',
    material: '',
    quantity: '1',
    age: '',
    source: '',
    bodyFit: '',
    occasion: '',
    shippingPrice: '0.00',
    worldwideShipping: false,
    country: 'US',
  });

  // Get condition list based on platform
  const getConditions = () => {
    switch (platform) {
      case 'ebay': return EBAY_CONDITIONS;
      case 'poshmark': return POSHMARK_CONDITIONS;
      case 'depop': return DEPOP_CONDITIONS;
      case 'vinted': return VINTED_CONDITIONS;
      default: return [];
    }
  };

  // Fetch rules from backend
  useEffect(() => {
    if (isOpen) {
      ruleService.getAll()
        .then(res => {
          if (res.data?.success) {
            setRules(res.data.data);
            const defaultRule = res.data.data.find(r => r.isDefault) || res.data.data[0];
            if (defaultRule) {
              setSelectedRule(defaultRule._id || defaultRule.id);
            }
          }
        })
        .catch(err => console.error('Error fetching rules:', err));
    }
  }, [isOpen]);

  useEffect(() => {
    if (listing) {
      setFormData({
        title: listing.title || '',
        description: listing.description ? listing.description.replace(/<[^>]*>/g, '') : '',
        price: listing.price || '',
        originalPrice: listing.originalPrice || '',
        brand: listing.brand || '',
        size: listing.size || '',
        color: listing.color || '',
        sku: listing.sku || '',
        category: listing.category || '',
        material: listing.material || '',
        quantity: String(listing.quantity || '1'),
        age: listing.age || '',
        source: listing.source || '',
        bodyFit: listing.bodyFit || '',
        occasion: listing.occasion || '',
        shippingPrice: listing.shippingPrice || '0.00',
        worldwideShipping: !!listing.worldwideShipping,
        country: listing.country || 'US',
      });
      
      if (listing.images && listing.images.length > 0) {
        setActiveImage(listing.images[0]);
      } else {
        setActiveImage(listing.thumbnail || '');
      }

      // Pre-select first condition matching list
      const condList = getConditions();
      if (condList.length > 0) {
        setSelectedCondition(condList[0].label);
        setSelectedConditionId(condList[0].id);
      }
      setHasScanned(false);
      setScanning(false);
    }
  }, [listing, platform]);

  if (!isOpen || !listing) return null;

  // Handle condition select dropdown changes
  const handleConditionChange = (e) => {
    const label = e.target.value;
    setSelectedCondition(label);
    const condList = getConditions();
    const found = condList.find(c => c.label === label);
    if (found) {
      setSelectedConditionId(found.id);
    }
  };

  // Run AI analysis to fetch listing attributes using selected condition and rule
  const triggerAIScan = async () => {
    setScanning(true);
    toast.info(`✨ AI is scanning listing image for ${platform} using selected rule parameters...`);
    
    try {
      const selectedRuleObj = rules.find(r => (r._id || r.id) === selectedRule);
      const payload = {
        images: listing.images && listing.images.length > 0 ? listing.images : [listing.thumbnail],
        title_sequence: selectedRuleObj?.title_sequence || [],
        description_prompt: selectedRuleObj?.description_prompt || '',
        description_template: selectedRuleObj?.description_template || '',
        condition_note: selectedRuleObj?.condition_note || '',
        condition_name: selectedCondition,
        model: selectedModel || 'gpt-4o-mini',
      };

      let response;
      if (platform === 'ebay') {
        response = await aiService.analyze(payload);
      } else if (platform === 'poshmark') {
        response = await aiService.poshmarkAnalyze(payload);
      } else if (platform === 'vinted') {
        response = await aiService.vintedAnalyze(payload);
      } else if (platform === 'depop') {
        response = await aiService.depopAnalyze(payload);
      }

      if (response && response.data?.success) {
        const result = response.data.data;
        setFormData(prev => ({
          ...prev,
          title: result.title || prev.title,
          price: result.price || prev.price,
          description: result.description || prev.description,
          brand: result.brand || prev.brand,
          size: result.size || prev.size,
          color: result.color || prev.color,
          sku: result.sku || prev.sku,
          category: result.category_name || result.category || prev.category,
          material: result.material || prev.material,
        }));
        setHasScanned(true);
        toast.success('✨ AI scan completed successfully! Form loaded below.');
      } else {
        toast.error('AI Scan returned unsuccessful response.');
      }
    } catch (err) {
      console.error('AI scan error:', err);
      toast.error('Failed to fetch data using AI. Ensure API key is configured.');
    } finally {
      setScanning(false);
    }
  };

  const handleInputChange = (field, val) => {
    setFormData(prev => ({
      ...prev,
      [field]: val
    }));
  };

  const handlePublish = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const selectedRuleObj = rules.find(r => (r._id || r.id) === selectedRule);
      const updatedFields = {
        title: formData.title,
        description: formData.description,
        price: formData.price,
        originalPrice: formData.originalPrice,
        brand: formData.brand,
        size: formData.size,
        color: formData.color,
        sku: formData.sku,
        category: formData.category,
        material: formData.material,
        quantity: parseInt(formData.quantity) || 1,
        age: formData.age,
        source: formData.source,
        bodyFit: formData.bodyFit,
        occasion: formData.occasion,
        shippingPrice: formData.shippingPrice,
        worldwideShipping: formData.worldwideShipping,
        country: formData.country,
        selectedRule,
        selectedCondition,
        conditionId: selectedConditionId,
        selectedModel,
        status: 'draft',
        platform
      };

      // Save updating attributes
      await listingService.update(listing._id, updatedFields);

      // Trigger cross-list publish API
      if (platform === 'ebay') {
        const publishRes = await listingService.publish(listing._id);
        if (publishRes.data?.success) {
          toast.success('Listing published on eBay!');
        }
      } else if (platform === 'poshmark') {
        const publishRes = await externalImportService.publish(listing._id, { platform: 'poshmark' });
        if (publishRes.data?.success) {
          toast.success('Listing published on Poshmark!');
        }
      } else if (platform === 'depop') {
        const publishRes = await externalImportService.publish(listing._id, { platform: 'depop' });
        if (publishRes.data?.success) {
          toast.success('Listing published on Depop!');
        }
      } else if (platform === 'vinted') {
        const isExtensionInstalled = document.body.dataset.elisterVintedExtensionInstalled === "true";
        if (!isExtensionInstalled) {
          toast.warning("Install and reload the Vinted extension to list automatically!");
          setLoading(false);
          return;
        }
        const plainDesc = formData.description;
        const token = localStorage.getItem('token');
        const backendUrl = import.meta.env.MODE === 'production'
          ? (import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : 'https://api.elister.ai/api')
          : 'http://localhost:5000/api';

        window.postMessage({
          action: 'ELISTER_VINTED_LIST_ITEM_TRIGGER',
          data: {
            listingId: listing._id,
            token,
            backendUrl,
            title: formData.title,
            description: plainDesc,
            brand: formData.brand || "",
            price: parseFloat(formData.price) || 0.0,
            originalPrice: parseFloat(formData.originalPrice) || 0.0,
            size: formData.size || "",
            color: formData.color || "",
            material: formData.material || "",
            conditionId: selectedConditionId || "very_good",
            categoryId: "1807",
            images: listing.images || []
          }
        }, "*");
        toast.success("Vinted publisher queue launched!");
      }

      onSyncSuccess();
      onClose();
    } catch (err) {
      console.error(`Error crosslisting to ${platform}:`, err);
      toast.error(err.response?.data?.message || `Failed to crosslist to ${platform}.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0f172a]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200 border border-[#e2e8f0]">
        
        {/* Header */}
        <div className="px-8 py-5 border-b border-[#f1f5f9] flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-50 p-2.5 rounded-2xl text-indigo-600">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Crosslisting Suite</span>
              <h3 className="text-lg font-black text-slate-900 capitalize flex items-center gap-2">
                Cross-list on {platform}
              </h3>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-50 border border-slate-100 rounded-2xl text-slate-400 hover:text-slate-650 transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body Container */}
        <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-8">
          
          {/* Top Section: Image Preview & Setup Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start shrink-0">
            {/* Visual scan frame */}
            <div className="md:col-span-5 relative aspect-[4/3] bg-slate-50 border border-[#e2e8f0] rounded-3xl overflow-hidden flex items-center justify-center shadow-inner select-none">
              {activeImage ? (
                <img 
                  src={activeImage} 
                  alt="Listing Preview" 
                  className={`max-w-full max-h-full object-contain transition-all duration-700 ${scanning ? 'blur-[3px] brightness-75 scale-102' : ''}`}
                />
              ) : (
                <div className="text-slate-350 text-xs font-bold">No product image detected</div>
              )}

              {/* Scanning visual overlay */}
              {scanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-[#0f172af0]/40 gap-3">
                  <div className="relative w-full max-w-[180px]">
                    <div className="h-1 bg-indigo-500 rounded-full overflow-hidden">
                      <div className="h-full bg-white animate-infinite-loading w-1/3"></div>
                    </div>
                  </div>
                  <span className="text-[10px] font-black tracking-widest uppercase animate-pulse text-white">Scanning visual metrics...</span>
                  <div className="absolute inset-x-0 h-0.5 bg-indigo-400 shadow-[0_0_8px_#6366f1] animate-laser-scan"></div>
                </div>
              )}
            </div>

            {/* AI Setup Config Panel (Exactly 3 fields and 1 button) */}
            <div className="md:col-span-7 bg-white border border-[#e2e8f0] rounded-3xl p-6 space-y-5 shadow-sm">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-[#f1f5f9] pb-3">
                <Sparkles size={14} className="text-indigo-650" />
                AI Vision Scanner Settings
              </h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* 1. Rule selection */}
                <div>
                  <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider block mb-1.5">AI Listing Rule</label>
                  <div className="relative">
                    <select
                      value={selectedRule}
                      onChange={(e) => setSelectedRule(e.target.value)}
                      className="w-full pl-3 pr-9 py-2.5 bg-slate-50 hover:bg-white border border-[#e2e8f0] rounded-xl text-xs font-bold text-slate-750 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 cursor-pointer appearance-none transition-all"
                    >
                      {rules.map(r => (
                        <option key={r._id || r.id} value={r._id || r.id}>{r.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-405 pointer-events-none" />
                  </div>
                </div>

                {/* 2. Condition selection */}
                <div>
                  <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider block mb-1.5">Product Condition</label>
                  <div className="relative">
                    <select
                      value={selectedCondition}
                      onChange={handleConditionChange}
                      className="w-full pl-3 pr-9 py-2.5 bg-slate-50 hover:bg-white border border-[#e2e8f0] rounded-xl text-xs font-bold text-slate-750 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 cursor-pointer appearance-none transition-all"
                    >
                      {getConditions().map(c => (
                        <option key={c.id} value={c.label}>{c.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-455 pointer-events-none" />
                  </div>
                </div>

                {/* 3. Model selection */}
                <div>
                  <label className="text-[9px] font-black text-slate-455 uppercase tracking-wider block mb-1.5">AI Vision Model</label>
                  <div className="relative">
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="w-full pl-3 pr-9 py-2.5 bg-slate-50 hover:bg-white border border-[#e2e8f0] rounded-xl text-xs font-bold text-slate-750 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 cursor-pointer appearance-none transition-all"
                    >
                      <option value="gpt-4o-mini">GPT-4o Mini (Default)</option>
                      <option value="gpt-4o">GPT-4o Premium (High Accuracy)</option>
                      <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                      <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-455 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Submit AI Fetch Button */}
              <button
                type="button"
                disabled={scanning}
                onClick={triggerAIScan}
                className="w-full py-3 bg-[#0f172a] hover:bg-black text-white font-extrabold rounded-2xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-98 cursor-pointer disabled:opacity-50"
              >
                {scanning ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                    Scanning & Analyzing Image...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    ✨ Populate Form with AI
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Bottom Section: Netlify Style Attribute Form (Only visible once scanned) */}
          {hasScanned && (
            <div className="animate-in fade-in slide-in-from-top-4 duration-300">
              <form onSubmit={handlePublish} className="space-y-6">
                
                <div className="bg-white border border-[#e2e8f0] rounded-3xl p-6 shadow-sm space-y-5">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-[#f1f5f9] pb-3">
                    <ShieldCheck size={16} className="text-emerald-500" />
                    Listing Metadata Fields (AI Generated)
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Title */}
                    <div className="sm:col-span-2">
                      <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider block mb-1">Product Title</label>
                      <input
                        type="text"
                        required
                        value={formData.title}
                        onChange={(e) => handleInputChange('title', e.target.value)}
                        placeholder="Title details..."
                        className="w-full px-4 h-12 bg-white border border-[#e2e8f0] focus:border-indigo-500 rounded-xl focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all text-xs font-bold text-slate-700"
                      />
                    </div>

                    {/* Price */}
                    <div>
                      <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider block mb-1">Price ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={formData.price}
                        onChange={(e) => handleInputChange('price', e.target.value)}
                        placeholder="0.00"
                        className="w-full px-4 h-12 bg-white border border-[#e2e8f0] focus:border-indigo-500 rounded-xl focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all text-xs font-bold text-slate-700"
                      />
                    </div>

                    {/* Original Price */}
                    {(platform === 'poshmark' || platform === 'depop') && (
                      <div>
                        <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider block mb-1">Original Price ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.originalPrice}
                          onChange={(e) => handleInputChange('originalPrice', e.target.value)}
                          placeholder="0.00"
                          className="w-full px-4 h-12 bg-white border border-[#e2e8f0] focus:border-indigo-500 rounded-xl focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all text-xs font-bold text-slate-700"
                        />
                      </div>
                    )}

                    {/* SKU */}
                    {platform === 'ebay' && (
                      <div>
                        <label className="text-[9px] font-black text-slate-455 uppercase tracking-wider block mb-1">SKU</label>
                        <input
                          type="text"
                          value={formData.sku}
                          onChange={(e) => handleInputChange('sku', e.target.value)}
                          className="w-full px-4 h-12 bg-white border border-[#e2e8f0] focus:border-indigo-500 rounded-xl focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all text-xs font-bold text-slate-700"
                        />
                      </div>
                    )}

                    {/* Brand */}
                    <div>
                      <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider block mb-1">Brand</label>
                      <input
                        type="text"
                        value={formData.brand}
                        onChange={(e) => handleInputChange('brand', e.target.value)}
                        className="w-full px-4 h-12 bg-white border border-[#e2e8f0] focus:border-indigo-500 rounded-xl focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all text-xs font-bold text-slate-700"
                      />
                    </div>

                    {/* Size */}
                    <div>
                      <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider block mb-1">Size</label>
                      <input
                        type="text"
                        value={formData.size}
                        onChange={(e) => handleInputChange('size', e.target.value)}
                        className="w-full px-4 h-12 bg-white border border-[#e2e8f0] focus:border-indigo-500 rounded-xl focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all text-xs font-bold text-slate-700"
                      />
                    </div>

                    {/* Color */}
                    <div>
                      <label className="text-[9px] font-black text-slate-455 uppercase tracking-wider block mb-1">Color</label>
                      <input
                        type="text"
                        value={formData.color}
                        onChange={(e) => handleInputChange('color', e.target.value)}
                        className="w-full px-4 h-12 bg-white border border-[#e2e8f0] focus:border-indigo-500 rounded-xl focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all text-xs font-bold text-slate-700"
                      />
                    </div>

                    {/* Material */}
                    {(platform === 'vinted' || platform === 'depop') && (
                      <div>
                        <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider block mb-1">Material</label>
                        <input
                          type="text"
                          value={formData.material}
                          onChange={(e) => handleInputChange('material', e.target.value)}
                          className="w-full px-4 h-12 bg-white border border-[#e2e8f0] focus:border-indigo-500 rounded-xl focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all text-xs font-bold text-slate-700"
                        />
                      </div>
                    )}

                    {/* Age & Source */}
                    {platform === 'depop' && (
                      <>
                        <div>
                          <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider block mb-1">Age / Era</label>
                          <input
                            type="text"
                            value={formData.age}
                            onChange={(e) => handleInputChange('age', e.target.value)}
                            className="w-full px-4 h-12 bg-white border border-[#e2e8f0] focus:border-indigo-500 rounded-xl focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all text-xs font-bold text-slate-700"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-black text-slate-455 uppercase tracking-wider block mb-1">Source</label>
                          <input
                            type="text"
                            value={formData.source}
                            onChange={(e) => handleInputChange('source', e.target.value)}
                            className="w-full px-4 h-12 bg-white border border-[#e2e8f0] focus:border-indigo-500 rounded-xl focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all text-xs font-bold text-slate-700"
                          />
                        </div>
                      </>
                    )}

                    {/* Description */}
                    <div className="sm:col-span-2">
                      <label className="text-[9px] font-black text-slate-455 uppercase tracking-wider block mb-1">Product Description</label>
                      <textarea
                        rows="4"
                        value={formData.description}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        placeholder="Attributes generated will load here..."
                        className="w-full p-4 bg-white border border-[#e2e8f0] focus:border-indigo-500 rounded-xl focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all text-xs font-bold text-slate-700"
                      />
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="flex items-center justify-end gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-3 border border-[#e2e8f0] hover:bg-slate-50 rounded-2xl text-xs font-extrabold text-slate-655 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-7 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold rounded-2xl text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-98 cursor-pointer shadow-indigo-100"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Publishing to {platform}...
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="w-3.5 h-3.5" />
                        Save & List on {platform}
                      </>
                    )}
                  </button>
                </div>

              </form>
            </div>
          )}

        </div>
      </div>

      <style>{`
        @keyframes laser-scan {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }
        .animate-laser-scan {
          animation: laser-scan 2.5s linear infinite;
        }
        @keyframes infinite-loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
        .animate-infinite-loading {
          animation: infinite-loading 1.5s infinite linear;
        }
      `}</style>
    </div>
  );
};

export default CrosslistingModal;
