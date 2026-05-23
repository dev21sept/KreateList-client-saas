import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { 
  Plus, 
  Trash2, 
  Zap,
  Sparkles,
  RefreshCw,
  Save,
  Search,
  ChevronRight,
  GripVertical,
  CheckCircle2,
  X,
  List as ListIcon,
  Edit2,
  Pencil,
  ChevronDown,
  Check,
  Truck,
  CreditCard,
  RotateCcw,
  MapPin,
  Box,
  Weight
} from 'lucide-react';
import { ruleService, ebayService } from '../services/api';

const SearchableDropdown = ({ value, onSelect, options = [], placeholder = 'Select...', disabled = false, icon: Icon }) => {
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

  const filteredOptions = options.filter((opt) => {
    const label = String(opt?.label || '').toLowerCase();
    const q = searchTerm.toLowerCase();
    return label.includes(q);
  });

  const selectedOption = options.find(opt => opt.id === value);

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-left flex items-center justify-between text-sm font-bold text-slate-700 disabled:opacity-60 transition-all hover:border-indigo-300 focus:ring-2 focus:ring-indigo-500/10 shadow-sm"
      >
        <div className="flex items-center gap-2 truncate">
          {Icon && <Icon size={16} className="text-slate-400" />}
          <span className="truncate">{selectedOption?.label || placeholder}</span>
        </div>
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
                className="w-full h-9 pl-10 pr-4 rounded-lg border border-slate-200 text-sm font-semibold outline-none focus:border-indigo-500"
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.length > 0 ? filteredOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onSelect(opt.id);
                  setIsOpen(false);
                  setSearchTerm('');
                }}
                className={`w-full text-left px-4 py-2.5 border-b border-slate-50 last:border-b-0 hover:bg-indigo-600 hover:text-white transition-colors ${value === opt.id ? 'bg-indigo-50 text-indigo-600' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold">{opt.label}</span>
                  {value === opt.id && <Check className="w-4 h-4" />}
                </div>
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

const Rules = () => {
  const [rules, setRules] = useState([]);
  const [showRuleList, setShowRuleList] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [titleSequence, setTitleSequence] = useState([]);
  const [customFieldText, setCustomFieldText] = useState('');
  const [descriptionPrompt, setDescriptionPrompt] = useState('');
  const [conditionNote, setConditionNote] = useState('');
  
  // eBay Policy State
  const [fulfillmentPolicyId, setFulfillmentPolicyId] = useState('');
  const [paymentPolicyId, setPaymentPolicyId] = useState('');
  const [returnPolicyId, setReturnPolicyId] = useState('');
  const [locationKey, setLocationKey] = useState('');
  
  // Weight & Dimensions State
  const [packageWeight, setPackageWeight] = useState({ lbs: 0, oz: 0 });
  const [packageDimensions, setPackageDimensions] = useState({ length: 0, width: 0, height: 0 });

  const [ebayPolicies, setEbayPolicies] = useState({
    fulfillment: [],
    payment: [],
    returns: [],
    locations: []
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [isEbayConnected, setIsEbayConnected] = useState(false);

  const quickFields = [
    'Brand',
    'Product Type',
    'Model / Series',
    'Size',
    'Size word with Size',
    'Color',
    'Material',
    'Style / Use Case',
    'Gender / Department'
  ];

  useEffect(() => {
    fetchRules();
    checkEbayStatus();
  }, []);

  const checkEbayStatus = async () => {
    try {
      const response = await ebayService.getStatus();
      if (response.data.success && response.data.data.connected) {
        setIsEbayConnected(true);
        fetchEbayPolicies();
      }
    } catch (error) {
      console.error("Error checking eBay status:", error);
    }
  };

  const fetchEbayPolicies = async () => {
    try {
      const response = await ebayService.getPolicies();
      if (response.data.success) {
        setEbayPolicies({
          fulfillment: response.data.data.fulfillment.map(p => ({ id: p.fulfillmentPolicyId, label: p.name })),
          payment: response.data.data.payment.map(p => ({ id: p.paymentPolicyId, label: p.name })),
          returns: response.data.data.returns.map(p => ({ id: p.returnPolicyId, label: p.name })),
          locations: response.data.data.locations.map(l => ({ id: l.merchantLocationKey, label: l.name || l.merchantLocationKey }))
        });
      }
    } catch (error) {
      console.error("Error fetching eBay policies:", error);
    }
  };

  const fetchRules = async () => {
    setIsLoading(true);
    try {
      const response = await ruleService.getAll();
      if (response.data.success) {
        setRules(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching rules:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const addFieldToSequence = (field) => {
    if (!titleSequence.includes(field)) {
      setTitleSequence([...titleSequence, field]);
    }
  };

  const removeFieldFromSequence = (field) => {
    setTitleSequence(titleSequence.filter(f => f !== field));
  };

  const handleAddCustomField = () => {
    if (customFieldText.trim()) {
      addFieldToSequence(customFieldText.trim());
      setCustomFieldText('');
    }
  };

  const resetFields = () => {
    setRuleName('');
    setTitleSequence([]);
    setDescriptionPrompt('');
    setConditionNote('');
    setFulfillmentPolicyId('');
    setPaymentPolicyId('');
    setReturnPolicyId('');
    setLocationKey('');
    setPackageWeight({ lbs: 0, oz: 0 });
    setPackageDimensions({ length: 0, width: 0, height: 0 });
    setEditingId(null);
  };

  const handleEditRule = (rule) => {
    setRuleName(rule.name);
    setTitleSequence(rule.title_sequence || []);
    setDescriptionPrompt(rule.description_prompt || '');
    setConditionNote(rule.condition_note || '');
    setFulfillmentPolicyId(rule.fulfillmentPolicyId || '');
    setPaymentPolicyId(rule.paymentPolicyId || '');
    setReturnPolicyId(rule.returnPolicyId || '');
    setLocationKey(rule.locationKey || '');
    setPackageWeight(rule.packageWeight || { lbs: 0, oz: 0 });
    setPackageDimensions(rule.packageDimensions || { length: 0, width: 0, height: 0 });
    setEditingId(rule._id || rule.id);
    setShowRuleList(false);
  };

  const handleDeleteRule = async (id) => {
    if (!window.confirm('Are you sure you want to delete this rule?')) return;
    
    try {
      await ruleService.delete(id);
      setRules(rules.filter(r => (r._id || r.id) !== id));
      if (editingId === id) resetFields();
    } catch (error) {
      alert('Failed to delete rule');
      console.error(error);
    }
  };

  const handleSaveRule = async () => {
    if (!ruleName.trim()) {
      alert('Please enter a rule name');
      return;
    }
    setIsSaving(true);
    
    const ruleData = {
      name: ruleName,
      title_sequence: titleSequence,
      description_prompt: descriptionPrompt,
      condition_note: conditionNote,
      fulfillmentPolicyId,
      paymentPolicyId,
      returnPolicyId,
      locationKey,
      packageWeight,
      packageDimensions
    };

    try {
      if (editingId) {
        const response = await ruleService.update(editingId, ruleData);
        if (response.data.success) {
          setRules(rules.map(r => (r._id || r.id) === editingId ? response.data.data : r));
          alert('Rule updated successfully!');
        }
      } else {
        const response = await ruleService.create(ruleData);
        if (response.data.success) {
          setRules([response.data.data, ...rules]);
          alert('Rule saved successfully!');
        }
      }
      resetFields();
    } catch (error) {
      alert('Failed to save rule');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Rule Configuration</h1>
          <p className="text-slate-500">Define how AI should construct your listing details.</p>
        </div>
        <button 
          onClick={() => setShowRuleList(true)}
          className="px-6 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"
        >
          <ListIcon size={18} /> Show Rule List
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Rule Name Bar */}
        <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px] relative">
            <input 
              type="text"
              placeholder="Rule Name (e.g. Vintage Nike Sneakers)"
              className="w-full h-10 px-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 text-sm"
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
            />
          </div>
          <button 
            onClick={resetFields}
            className="h-10 px-4 flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold text-sm transition-all bg-white border border-slate-200 rounded-xl hover:border-slate-300"
          >
            <RefreshCw size={16} /> Reset
          </button>
        </div>

        <div className="p-8 space-y-10">
          {/* Section 1: Title Construction */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <label className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center">
                <Zap size={16} className="mr-2 text-amber-500" /> Title Construction Sequence
              </label>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">Drag to Reorder</span>
            </div>

            <div className="min-h-[100px] p-6 bg-slate-50/50 rounded-[2rem] border-2 border-dashed border-slate-100 relative group">
              <Reorder.Group 
                axis="x" 
                values={titleSequence} 
                onReorder={setTitleSequence}
                className="flex flex-wrap gap-3"
              >
                {titleSequence.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm font-medium italic">
                    Select fields below to start building your title...
                  </div>
                )}
                <AnimatePresence>
                  {titleSequence.map((field) => (
                    <Reorder.Item
                      key={field}
                      value={field}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center gap-2 cursor-grab active:cursor-grabbing hover:border-indigo-300 transition-colors"
                    >
                      <GripVertical size={14} className="text-slate-300" />
                      <span className="text-sm font-bold text-slate-700">{field}</span>
                      <button 
                        onClick={() => removeFieldFromSequence(field)}
                        className="ml-1 p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                      >
                        <X size={14} />
                      </button>
                    </Reorder.Item>
                  ))}
                </AnimatePresence>
              </Reorder.Group>
            </div>

            <div className="space-y-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quick-Add Fields</p>
              <div className="flex flex-wrap gap-2">
                {quickFields.map((field) => (
                  <button
                    key={field}
                    onClick={() => addFieldToSequence(field)}
                    disabled={titleSequence.includes(field)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      titleSequence.includes(field)
                        ? 'bg-slate-100 text-slate-300 cursor-not-allowed grayscale'
                        : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/30'
                    }`}
                  >
                    <Plus size={14} /> {field}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100/50">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Add Custom Text / Static Field</p>
              <div className="flex items-center gap-3 max-w-md">
                <input 
                  type="text"
                  placeholder="e.g. Free Shipping, Vintage, Custom attribute name..."
                  value={customFieldText}
                  onChange={(e) => setCustomFieldText(e.target.value)}
                  className="flex-1 h-10 px-4 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all shadow-sm"
                />
                <button 
                  type="button"
                  onClick={handleAddCustomField}
                  className="h-10 px-6 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-all flex items-center gap-1.5 shadow-md"
                >
                  <Plus size={14} /> Add
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-slate-50">
            {/* Section 2: AI Description */}
            <div className="space-y-4">
              <label className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center">
                <Sparkles size={16} className="mr-2 text-indigo-500" /> AI Description Prompt
              </label>
              <textarea 
                className="w-full h-40 p-4 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none leading-relaxed text-slate-600 text-sm"
                placeholder="Instruct the AI on the tone and content of the description..."
                value={descriptionPrompt}
                onChange={(e) => setDescriptionPrompt(e.target.value)}
              />
            </div>

            {/* Section 3: Condition Note */}
            <div className="space-y-4">
              <label className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center">
                <RefreshCw size={16} className="mr-2 text-emerald-500" /> Default Condition Note
              </label>
              <textarea 
                className="w-full h-40 p-4 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none leading-relaxed text-slate-600 text-sm"
                placeholder="Standard condition information to be applied to all listings..."
                value={conditionNote}
                onChange={(e) => setConditionNote(e.target.value)}
              />
            </div>
          </div>

          {/* Section 4: eBay Policies */}
          <div className="pt-10 border-t border-slate-50 space-y-6">
            <div className="flex items-center justify-between">
              <label className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center">
                <CheckCircle2 size={16} className="mr-2 text-indigo-600" /> Default eBay Policies
              </label>
              {!isEbayConnected && (
                <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-3 py-1 rounded-full border border-rose-100 flex items-center gap-1.5">
                  <X size={12} /> Connect eBay Account to select policies
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Shipping Policy</label>
                <SearchableDropdown 
                  value={fulfillmentPolicyId}
                  onSelect={setFulfillmentPolicyId}
                  options={ebayPolicies.fulfillment}
                  placeholder="Select Shipping..."
                  disabled={!isEbayConnected}
                  icon={Truck}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Payment Policy</label>
                <SearchableDropdown 
                  value={paymentPolicyId}
                  onSelect={setPaymentPolicyId}
                  options={ebayPolicies.payment}
                  placeholder="Select Payment..."
                  disabled={!isEbayConnected}
                  icon={CreditCard}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Return Policy</label>
                <SearchableDropdown 
                  value={returnPolicyId}
                  onSelect={setReturnPolicyId}
                  options={ebayPolicies.returns}
                  placeholder="Select Returns..."
                  disabled={!isEbayConnected}
                  icon={RotateCcw}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Location</label>
                <SearchableDropdown 
                  value={locationKey}
                  onSelect={setLocationKey}
                  options={ebayPolicies.locations}
                  placeholder="Select Location..."
                  disabled={!isEbayConnected}
                  icon={MapPin}
                />
              </div>
            </div>
          </div>

          {/* Section 5: Weight & Dimensions */}
          <div className="pt-10 border-t border-slate-50 space-y-6">
            <label className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center">
              <Box size={16} className="mr-2 text-blue-500" /> Package Weight & Dimensions
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {/* Package Weight */}
              <div className="space-y-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                   <Weight size={14} className="text-slate-300" /> Package weight (lbs / oz)
                </p>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <input 
                      type="number"
                      className="w-full h-11 px-4 pr-12 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all shadow-sm"
                      value={packageWeight.lbs}
                      onChange={(e) => setPackageWeight({...packageWeight, lbs: Number(e.target.value)})}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 uppercase">lbs</span>
                  </div>
                  <div className="relative flex-1">
                    <input 
                      type="number"
                      className="w-full h-11 px-4 pr-12 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all shadow-sm"
                      value={packageWeight.oz}
                      onChange={(e) => setPackageWeight({...packageWeight, oz: Number(e.target.value)})}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 uppercase">oz</span>
                  </div>
                </div>
              </div>

              {/* Package Dimensions */}
              <div className="space-y-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                   <Box size={14} className="text-slate-300" /> Package dimensions (L x W x H)
                </p>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <input 
                      type="number"
                      className="w-full h-11 px-4 pr-10 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all shadow-sm"
                      value={packageDimensions.length}
                      onChange={(e) => setPackageDimensions({...packageDimensions, length: Number(e.target.value)})}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 uppercase">in</span>
                  </div>
                  <span className="text-slate-300 font-bold">x</span>
                  <div className="relative flex-1">
                    <input 
                      type="number"
                      className="w-full h-11 px-4 pr-10 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all shadow-sm"
                      value={packageDimensions.width}
                      onChange={(e) => setPackageDimensions({...packageDimensions, width: Number(e.target.value)})}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 uppercase">in</span>
                  </div>
                  <span className="text-slate-300 font-bold">x</span>
                  <div className="relative flex-1">
                    <input 
                      type="number"
                      className="w-full h-11 px-4 pr-10 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all shadow-sm"
                      value={packageDimensions.height}
                      onChange={(e) => setPackageDimensions({...packageDimensions, height: Number(e.target.value)})}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 uppercase">in</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Final Actions */}
          <div className="flex justify-end pt-8 border-t border-slate-50 gap-4">
            <button 
              onClick={handleSaveRule}
              disabled={isSaving || !ruleName.trim()}
              className="h-10 px-8 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/20 disabled:opacity-50"
            >
              <Save size={18} /> {isSaving ? 'Saving...' : editingId ? 'Update Rule' : 'Save Rule'}
            </button>
          </div>
        </div>
      </div>

      {/* Rule List Modal Overlay */}
      <AnimatePresence>
        {showRuleList && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRuleList(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">Saved Rules</h3>
                <button onClick={() => setShowRuleList(false)} className="p-2 text-slate-400 hover:text-slate-900 transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 overflow-y-auto flex-1 space-y-4">
                {isLoading ? (
                  <div className="text-center py-20">
                    <RefreshCw size={24} className="animate-spin text-indigo-600 mx-auto" />
                    <p className="text-slate-500 font-medium mt-4">Loading rules...</p>
                  </div>
                ) : rules.length === 0 ? (
                  <div className="text-center py-20">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <ListIcon size={24} className="text-slate-300" />
                    </div>
                    <p className="text-slate-500 font-medium">No rules created yet.</p>
                  </div>
                ) : (
                  rules.map(rule => (
                    <div key={rule._id || rule.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group hover:border-indigo-200 transition-all">
                      <div>
                        <h4 className="font-bold text-slate-900">{rule.name}</h4>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {rule.title_sequence?.map(f => (
                            <span key={f} className="text-[10px] font-bold text-indigo-600/70">{f} • </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleEditRule(rule)}
                          className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                        >
                          <Pencil size={18} />
                        </button>
                        <button 
                          onClick={() => handleDeleteRule(rule._id || rule.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Rules;
