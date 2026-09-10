import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AnimatePresence, Reorder } from 'framer-motion';
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
  Pencil,
  ChevronDown,
  Check,
  Truck,
  CreditCard,
  RotateCcw,
  MapPin,
  Box,
  Weight,
  Eye,
  Copy,
  Sliders,
  Tag,
  AlertTriangle,
  CheckCheck,
  Wand2
} from 'lucide-react';
import { ruleService, ebayService } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import Button from '../components/ui/Button';
import IconButton from '../components/ui/IconButton';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import { LoadingState } from '../components/ui/LoadingState';
import { Badge } from '../components/ui/Badge';

// Sample datasets for real-time live preview simulation
const SAMPLE_PRODUCTS = [
  {
    id: 'pants',
    name: "Women's Corduroy Pants",
    badge: "Pants / Bottoms",
    data: {
      'Brand': 'Talbots',
      'Gender / Department': 'Womens',
      'Gender': 'Womens',
      'Color': 'Brown',
      'SEO Keywords': 'Comfort Casual',
      'Key Features': 'Comfort Stretch Waist',
      'Product Style': 'High Rise Comfort Corduroy',
      'Product Type': 'Straight Leg Pants',
      'Item Type': 'Straight Leg Pants',
      'Model / Series': 'Heritage Fit',
      'Material': 'Corduroy Cotton Blend',
      'Pattern': 'Solid',
      'Condition': 'Pre-Owned Excellent',
      'Size word with Size': 'Size 12P',
      'Size': '12P'
    }
  },
  {
    id: 'shirt',
    name: "Men's Button Down Shirt",
    badge: "Shirt / Tops",
    data: {
      'Brand': 'Vineyard Vines',
      'Gender / Department': 'Mens',
      'Gender': 'Mens',
      'Color': 'Pink Blue',
      'SEO Keywords': 'Summer Performance',
      'Key Features': 'Moisture Wicking Quick Dry',
      'Product Style': 'Gingham On-The-Go',
      'Product Type': 'Button Down Shirt',
      'Item Type': 'Button Down Shirt',
      'Model / Series': 'Classic Fit',
      'Material': 'Cotton Spandex Blend',
      'Pattern': 'Gingham Check',
      'Condition': 'Pre-Owned Like New',
      'Size word with Size': 'Size M',
      'Size': 'M'
    }
  },
  {
    id: 'sneakers',
    name: "Men's Athletic Running Shoes",
    badge: "Shoes / Athletic",
    data: {
      'Brand': 'Nike',
      'Gender / Department': 'Mens',
      'Gender': 'Mens',
      'Color': 'Black White',
      'SEO Keywords': 'Athletic Running',
      'Key Features': 'Air High Performance',
      'Product Style': 'Air Max Retro',
      'Product Type': 'Sneakers',
      'Item Type': 'Running Shoes',
      'Model / Series': 'Air Max 90',
      'Material': 'Mesh Leather Upper',
      'Pattern': 'Colorblock',
      'Condition': 'New With Box',
      'Size word with Size': 'Size 10.5',
      'Size': '10.5'
    }
  },
  {
    id: 'jacket',
    name: "Women's Fleece Jacket",
    badge: "Outerwear / Jacket",
    data: {
      'Brand': 'The North Face',
      'Gender / Department': 'Womens',
      'Gender': 'Womens',
      'Color': 'Heather Gray',
      'SEO Keywords': 'Warm Outdoor Hiking',
      'Key Features': 'Full Zip Insulated Pockets',
      'Product Style': 'Osito Plush Fleece',
      'Product Type': 'Fleece Jacket',
      'Item Type': 'Zip Up Jacket',
      'Model / Series': 'Osito 2',
      'Material': 'High-Pile Silken Fleece',
      'Pattern': 'Solid',
      'Condition': 'Pre-Owned Excellent',
      'Size word with Size': 'Size L',
      'Size': 'L'
    }
  }
];

const ATTRIBUTE_CATEGORIES = [
  {
    category: 'Core Identity',
    fields: [
      { name: 'Brand', example: 'Talbots, Nike, Vineyard Vines' },
      { name: 'Gender / Department', example: 'Womens, Mens, Unisex' },
      { name: 'Product Type', example: 'Straight Leg Pants, Shirt, Sneakers' },
      { name: 'Model / Series', example: 'Heritage Fit, Air Max 90' }
    ]
  },
  {
    category: 'Style & Appearance',
    fields: [
      { name: 'Color', example: 'Brown, Pink Blue, Black White' },
      { name: 'Product Style', example: 'High Rise Comfort Corduroy, Gingham' },
      { name: 'Pattern', example: 'Gingham Check, Solid, Striped' },
      { name: 'Material', example: 'Corduroy Cotton, Mesh Leather' }
    ]
  },
  {
    category: 'Sizing & Condition',
    fields: [
      { name: 'Size word with Size', example: 'Size 12P, Size M, Size 10.5' },
      { name: 'Size', example: '12P, M, 10.5 (numeric/letter only)' },
      { name: 'Condition', example: 'Pre-Owned Excellent, NWT' }
    ]
  },
  {
    category: 'SEO & Highlights',
    fields: [
      { name: 'SEO Keywords', example: 'Comfort Casual, Performance, Warm' },
      { name: 'Key Features', example: 'Comfort Stretch, Moisture Wicking' }
    ]
  }
];

const PRESET_TEMPLATES = [
  {
    name: 'Best Practice Standard',
    description: 'Brand + Gender + Color + Style + Product Type + Size',
    sequence: ['Brand', 'Gender / Department', 'Color', 'Product Style', 'Product Type', 'Size word with Size']
  },
  {
    name: 'SEO & Keyword Rich',
    description: 'Brand + Gender + Color + SEO Keywords + Style + Type + Size',
    sequence: ['Brand', 'Gender / Department', 'Color', 'SEO Keywords', 'Product Style', 'Product Type', 'Size word with Size']
  },
  {
    name: 'Athletic / Model Series',
    description: 'Brand + Model + Product Type + Gender + Color + Size',
    sequence: ['Brand', 'Model / Series', 'Product Type', 'Gender / Department', 'Color', 'Size word with Size']
  },
  {
    name: 'Compact Minimal',
    description: 'Brand + Product Type + Color + Size',
    sequence: ['Brand', 'Product Type', 'Color', 'Size']
  }
];

const resolveFieldValue = (field, sampleData) => {
  if (!field) return '';
  if (sampleData[field] !== undefined) return sampleData[field];

  const lower = field.toLowerCase().trim();
  if (lower === 'brand' || lower.includes('brand')) return sampleData['Brand'] || 'Nike';
  if (lower.includes('gender') || lower.includes('department')) return sampleData['Gender / Department'] || 'Mens';
  if (lower.includes('color')) return sampleData['Color'] || 'Black';
  if (lower.includes('seo') || lower.includes('keyword')) return sampleData['SEO Keywords'] || 'Performance';
  if (lower.includes('feature')) return sampleData['Key Features'] || 'Comfort';
  if (lower.includes('style') || lower.includes('use case')) return sampleData['Product Style'] || 'Classic Fit';
  if (lower.includes('type') || lower.includes('item')) return sampleData['Product Type'] || 'Apparel';
  if (lower.includes('model') || lower.includes('series')) return sampleData['Model / Series'] || 'Pro';
  if (lower.includes('material') || lower.includes('fabric')) return sampleData['Material'] || 'Cotton';
  if (lower.includes('pattern')) return sampleData['Pattern'] || 'Solid';
  if (lower.includes('condition')) return sampleData['Condition'] || 'Pre-Owned';
  if (lower.includes('size word') || lower === 'size word with size') return sampleData['Size word with Size'] || 'Size M';
  if (lower === 'size') return sampleData['Size'] || 'M';

  // Custom static text
  return field;
};

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
        <div className="flex items-center gap-1.5 shrink-0">
          {value && !disabled && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onSelect('');
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
  const { toast, confirm } = useNotification();
  const [rules, setRules] = useState([]);
  const [showRuleList, setShowRuleList] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [titleSequence, setTitleSequence] = useState([
    'Brand',
    'Gender / Department',
    'Color',
    'Product Style',
    'Product Type',
    'Size word with Size'
  ]);
  const [customFieldText, setCustomFieldText] = useState('');
  const [descriptionPrompt, setDescriptionPrompt] = useState('');
  const [descriptionTemplate, setDescriptionTemplate] = useState('');
  const [templateType, setTemplateType] = useState('default');
  const [conditionNote, setConditionNote] = useState('');
  const [selectedSampleIndex, setSelectedSampleIndex] = useState(0);
  const [copiedTitle, setCopiedTitle] = useState(false);
  
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

  const applyPreset = (preset) => {
    setTitleSequence([...preset.sequence]);
    toast.success(`Applied "${preset.name}" preset`);
  };

  const handleAddCustomField = () => {
    if (customFieldText.trim()) {
      addFieldToSequence(customFieldText.trim());
      setCustomFieldText('');
    }
  };

  const currentSample = SAMPLE_PRODUCTS[selectedSampleIndex] || SAMPLE_PRODUCTS[0];

  // Calculate live preview title and tokens
  const { previewTokens, simulatedTitle } = useMemo(() => {
    const tokens = titleSequence.map((field) => {
      const value = resolveFieldValue(field, currentSample.data);
      return { field, value };
    });

    const titleParts = tokens.map(t => t.value).filter(Boolean);
    const combined = titleParts.join(' ').replace(/\s+/g, ' ').trim();

    return {
      previewTokens: tokens,
      simulatedTitle: combined
    };
  }, [titleSequence, currentSample]);

  const handleCopyTitle = () => {
    if (!simulatedTitle) return;
    navigator.clipboard.writeText(simulatedTitle);
    setCopiedTitle(true);
    toast.success('Simulated title copied to clipboard');
    setTimeout(() => setCopiedTitle(false), 2000);
  };

  const loadDefaultTemplate = () => {
    setDescriptionTemplate(
`<div id="ds_div" class="ebay-template-container" style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 900px; margin: 20px auto; padding: 30px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff; color: #1f2937; line-height: 1.6; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
    <div style="margin-bottom: 25px; border-bottom: 2px solid #4f46e5; padding-bottom: 15px;">
        <h2 style="margin: 0; color: #4f46e5; font-size: 24px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">{Title}</h2>
    </div>
    <div class="description-content" style="font-size: 16px;">
        <b>The Ultimate Look / Perfect Upgrade:</b> {hook}<br><br>
        <b>About the Brand:</b> {brandInfo}<br><br>
        <b>Key Features & Design:</b> {features}<br><br>
        <b>Versatility / Usage:</b> {stylingTips}<br><br>
        <b>Condition Report:</b> {conditionReport}
    </div>
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #f3f4f6; font-size: 13px; color: #6b7280; font-style: italic; display: flex; align-items: center; gap: 10px;">
        <div style="width: 8px; height: 8px; background-color: #4f46e5; border-radius: 50%;"></div>
        <span style="display: flex; align-items: center; gap: 6px;">
            This Listing is Created By 
            <img src="https://elister.ai/logo.png" alt="Elister.ai" style="height: 20px; width: auto; vertical-align: middle;" />
        </span>
    </div>
</div>`
    );
  };

  const handleTemplateTypeChange = (e) => {
    const val = e.target.value;
    setTemplateType(val);
    if (val === 'custom' && !descriptionTemplate.trim()) {
      setDescriptionTemplate(
`<div id="ds_div" class="ebay-template-container" style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 900px; margin: 20px auto; padding: 30px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff; color: #1f2937; line-height: 1.6; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
    <div style="margin-bottom: 25px; border-bottom: 2px solid #4f46e5; padding-bottom: 15px;">
        <h2 style="margin: 0; color: #4f46e5; font-size: 24px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">{Title}</h2>
    </div>
    <div class="description-content" style="font-size: 16px;">
        <b>The Ultimate Look / Perfect Upgrade:</b> {hook}<br><br>
        <b>About the Brand:</b> {brandInfo}<br><br>
        <b>Key Features & Design:</b> {features}<br><br>
        <b>Versatility / Usage:</b> {stylingTips}<br><br>
        <b>Condition Report:</b> {conditionReport}
    </div>
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #f3f4f6; font-size: 13px; color: #6b7280; font-style: italic; display: flex; align-items: center; gap: 10px;">
        <div style="width: 8px; height: 8px; background-color: #4f46e5; border-radius: 50%;"></div>
        <span style="display: flex; align-items: center; gap: 6px;">
            This Listing is Created By 
            <img src="https://elister.ai/logo.png" alt="Elister.ai" style="height: 20px; width: auto; vertical-align: middle;" />
        </span>
    </div>
</div>`
      );
    }
  };

  const resetFields = () => {
    setRuleName('');
    setTitleSequence([
      'Brand',
      'Gender / Department',
      'Color',
      'Product Style',
      'Product Type',
      'Size word with Size'
    ]);
    setDescriptionPrompt('');
    setDescriptionTemplate('');
    setTemplateType('default');
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
    setTitleSequence(rule.title_sequence || [
      'Brand',
      'Gender / Department',
      'Color',
      'Product Style',
      'Product Type',
      'Size word with Size'
    ]);
    setDescriptionPrompt(rule.description_prompt || '');
    setDescriptionTemplate(rule.description_template || '');
    setTemplateType(rule.description_template ? 'custom' : 'default');
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
    if (!(await confirm('Are you sure you want to delete this rule?', { title: 'Delete Rule', destructive: true }))) return;
    
    try {
      await ruleService.delete(id);
      setRules(rules.filter(r => (r._id || r.id) !== id));
      if (editingId === id) resetFields();
      toast.success('Rule deleted successfully!');
    } catch (error) {
      toast.error('Failed to delete rule');
      console.error(error);
    }
  };

  const handleSaveRule = async () => {
    if (!ruleName.trim()) {
      toast.warning('Please enter a rule name');
      return;
    }
    setIsSaving(true);
    
    const ruleData = {
      name: ruleName,
      title_sequence: titleSequence,
      description_prompt: descriptionPrompt,
      description_template: templateType === 'custom' ? descriptionTemplate : '',
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
          toast.success('Rule updated successfully!');
        }
      } else {
        const response = await ruleService.create(ruleData);
        if (response.data.success) {
          setRules([response.data.data, ...rules]);
          toast.success('Rule saved successfully!');
        }
      }
      resetFields();
    } catch (error) {
      toast.error('Failed to save rule');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const charLength = simulatedTitle.length;
  const isOverLimit = charLength > 80;
  const isNearLimit = charLength >= 70 && charLength <= 80;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <Sliders size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Rule Engine & Title Builder</h1>
              <p className="text-slate-400 text-xs font-bold mt-0.5">Customize AI title sequence, templates, and marketplace policies with live previews.</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" icon={<ListIcon size={16} />} onClick={() => setShowRuleList(true)}>
            Saved Rules ({rules.length})
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Rule Name Bar */}
        <div className="p-4 sm:p-5 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
          <div className="flex-1 min-w-[240px] relative">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Rule Configuration Name</label>
            <input
              type="text"
              placeholder="e.g. Vintage Apparel & Sneakers Rule"
              className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-bold text-slate-700 text-sm shadow-sm"
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2.5 pt-5 sm:pt-0">
            <Button variant="outline" icon={<RefreshCw size={15} />} onClick={resetFields}>
              Reset
            </Button>
            <Button
              icon={<Save size={16} />}
              loading={isSaving}
              disabled={!ruleName.trim()}
              onClick={handleSaveRule}
            >
              {editingId ? 'Update Rule' : 'Save Rule'}
            </Button>
          </div>
        </div>

        <div className="p-5 sm:p-8 space-y-10">
          {/* Section 1: Title Construction & Live Dynamic Preview */}
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Zap size={18} className="text-amber-500" /> Title Construction & Live Preview
                </label>
                <p className="text-slate-400 text-xs font-medium mt-0.5">
                  Drag and drop tokens to order your listing titles. See how your titles format with real product samples.
                </p>
              </div>
              <Badge variant="indigo" className="self-start sm:self-auto">Drag & Drop Enabled</Badge>
            </div>

            {/* LIVE DYNAMIC EXAMPLE PREVIEW WIDGET */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 rounded-3xl p-6 sm:p-7 text-white shadow-xl shadow-slate-900/10 border border-slate-800 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-2.5 w-2.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <span className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Eye size={14} className="text-indigo-400" /> Live Simulated Title Output
                  </span>
                </div>

                {/* Sample Product Switcher */}
                <div className="flex items-center flex-wrap gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 px-2 uppercase">Sample:</span>
                  {SAMPLE_PRODUCTS.map((prod, idx) => (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => setSelectedSampleIndex(idx)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        selectedSampleIndex === idx
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                      }`}
                    >
                      {prod.badge}
                    </button>
                  ))}
                </div>
              </div>

              {/* Main Simulated Title Output */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 relative group">
                {titleSequence.length === 0 ? (
                  <div className="py-4 text-center text-slate-500 text-sm font-medium italic">
                    Select attributes below to generate the live example title...
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-base sm:text-lg font-bold text-slate-100 tracking-tight leading-relaxed select-all">
                      {simulatedTitle}
                    </div>
                    
                    {/* Token Breakdown Pills */}
                    <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-800/60">
                      {previewTokens.map((t, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700/60 text-[11px] font-semibold text-slate-300"
                        >
                          <span className="text-slate-400 text-[10px] uppercase font-bold">{t.field}:</span>
                          <span className="text-indigo-300 font-bold">{t.value}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {simulatedTitle && (
                  <button
                    type="button"
                    onClick={handleCopyTitle}
                    className="absolute top-4 right-4 p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-all opacity-80 group-hover:opacity-100"
                    title="Copy simulated title"
                  >
                    {copiedTitle ? <CheckCheck size={15} className="text-emerald-400" /> : <Copy size={15} />}
                  </button>
                )}
              </div>

              {/* Title Character Count & Marketplace Indicator */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-medium">Character Length:</span>
                  <span className={`font-black px-2 py-0.5 rounded-md ${
                    isOverLimit
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : isNearLimit
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  }`}>
                    {charLength} / 80 Chars
                  </span>
                  {isOverLimit && (
                    <span className="text-rose-400 text-[11px] font-bold flex items-center gap-1">
                      <AlertTriangle size={13} /> Exceeds 80 char eBay / Poshmark limit
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-slate-400 font-medium">
                  Testing with: <strong className="text-slate-200">{currentSample.name}</strong> ({currentSample.data.Brand})
                </div>
              </div>
            </div>

            {/* Drag and Drop Active Sequence Area */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black text-slate-500 uppercase tracking-wider">
                  Active Sequence (Drag to Reorder)
                </p>
                <span className="text-[11px] text-slate-400 font-semibold">
                  {titleSequence.length} attributes active
                </span>
              </div>

              <div className="min-h-[90px] p-5 bg-slate-50/70 rounded-2xl border-2 border-dashed border-slate-200 relative">
                <Reorder.Group 
                  axis="x" 
                  values={titleSequence} 
                  onReorder={setTitleSequence}
                  className="flex flex-wrap gap-2.5"
                >
                  {titleSequence.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs font-semibold italic">
                      Click any attribute button below to start assembling your title sequence...
                    </div>
                  )}
                  <AnimatePresence>
                    {titleSequence.map((field, idx) => (
                      <Reorder.Item
                        key={field}
                        value={field}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center gap-2 cursor-grab active:cursor-grabbing hover:border-indigo-400 hover:shadow-md transition-all group"
                      >
                        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-black flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <GripVertical size={14} className="text-slate-300 group-hover:text-slate-500" />
                        <span className="text-xs font-black text-slate-700">{field}</span>
                        <button
                          type="button"
                          onClick={() => removeFieldFromSequence(field)}
                          className="ml-1 p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                          title="Remove from sequence"
                        >
                          <X size={13} />
                        </button>
                      </Reorder.Item>
                    ))}
                  </AnimatePresence>
                </Reorder.Group>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="space-y-2.5 pt-2">
              <div className="flex items-center gap-2">
                <Wand2 size={15} className="text-indigo-600" />
                <p className="text-xs font-black text-slate-700 uppercase tracking-wider">
                  One-Click Title Presets
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {PRESET_TEMPLATES.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className="p-3 bg-slate-50 hover:bg-indigo-50/60 border border-slate-200 hover:border-indigo-300 rounded-xl text-left transition-all group"
                  >
                    <div className="font-bold text-xs text-slate-800 group-hover:text-indigo-600">
                      {preset.name}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1 line-clamp-1">
                      {preset.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Categorized Attribute Library */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <p className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <Tag size={15} className="text-indigo-600" />
                Add Attributes to Sequence
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {ATTRIBUTE_CATEGORIES.map((cat) => (
                  <div key={cat.category} className="bg-slate-50/60 rounded-2xl p-4 border border-slate-100 space-y-2.5">
                    <div className="text-[11px] font-black text-slate-600 uppercase tracking-wider">
                      {cat.category}
                    </div>
                    <div className="space-y-1.5">
                      {cat.fields.map((f) => {
                        const isSelected = titleSequence.includes(f.name);
                        return (
                          <button
                            key={f.name}
                            type="button"
                            onClick={() => addFieldToSequence(f.name)}
                            disabled={isSelected}
                            className={`w-full text-left p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-between gap-2 ${
                              isSelected
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 opacity-60 cursor-not-allowed'
                                : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-400 hover:text-indigo-600 hover:shadow-sm'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="truncate">{f.name}</div>
                              <div className="text-[9px] font-normal text-slate-400 truncate">{f.example}</div>
                            </div>
                            <span className="shrink-0">
                              {isSelected ? <Check size={14} className="text-indigo-600" /> : <Plus size={14} />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Custom Static Text / Custom Attribute */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <p className="text-xs font-black text-slate-700 uppercase tracking-wider">
                Add Custom Static Text / Special Tag
              </p>
              <div className="flex items-center gap-3 max-w-lg">
                <input 
                  type="text"
                  placeholder="e.g. Free Shipping, Vintage, Retro, Custom keyword..."
                  value={customFieldText}
                  onChange={(e) => setCustomFieldText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomField();
                    }
                  }}
                  className="flex-1 h-11 px-4 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all shadow-sm"
                />
                <button 
                  type="button"
                  onClick={handleAddCustomField}
                  className="h-11 px-6 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-all flex items-center gap-1.5 shadow-md shrink-0"
                >
                  <Plus size={14} /> Add Tag
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-slate-100">
            {/* Section 2: AI Description */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center">
                  <Sparkles size={16} className="mr-2 text-indigo-600" /> AI Description Prompt
                </label>
                <select
                  value={templateType}
                  onChange={handleTemplateTypeChange}
                  className="h-8 px-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-600 outline-none focus:border-indigo-500 transition-all cursor-pointer shadow-sm"
                >
                  <option value="default">Default Template</option>
                  <option value="custom">Custom HTML Template</option>
                </select>
              </div>
              <textarea 
                className="w-full h-40 p-4 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none leading-relaxed text-slate-600 text-sm font-medium"
                placeholder="Instruct the AI on the tone, formatting, and key points for listing descriptions..."
                value={descriptionPrompt}
                onChange={(e) => setDescriptionPrompt(e.target.value)}
              />
            </div>

            {/* Section 3: Condition Note */}
            <div className="space-y-4">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center">
                <RefreshCw size={16} className="mr-2 text-emerald-600" /> Default Condition Note
              </label>
              <textarea 
                className="w-full h-40 p-4 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none leading-relaxed text-slate-600 text-sm font-medium"
                placeholder="Standard condition information to be applied across listings (e.g. Excellent pre-owned condition with no stains or tears)..."
                value={conditionNote}
                onChange={(e) => setConditionNote(e.target.value)}
              />
            </div>
          </div>

          {/* HTML Description Template */}
          {templateType === 'custom' && (
            <div className="pt-6 border-t border-slate-100 space-y-4 animate-in fade-in duration-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center">
                  <Box size={16} className="mr-2 text-indigo-600" /> Custom HTML Description Template
                </label>
                <button
                  type="button"
                  onClick={loadDefaultTemplate}
                  className="self-start sm:self-auto px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-800 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <Sparkles size={12} className="text-indigo-500" /> Load Default Template
                </button>
              </div>
              <textarea
                className="w-full h-48 p-4 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none leading-relaxed text-slate-700 text-xs font-mono"
                placeholder="Enter custom HTML description template. E.g. <b>Brand:</b> {Brand}<br><b>Size:</b> {Size}<br><br>{hook}"
                value={descriptionTemplate}
                onChange={(e) => setDescriptionTemplate(e.target.value)}
              />
              <p className="text-[11px] text-slate-400 font-medium">
                Placeholders like <code>&#123;hook&#125;</code>, <code>&#123;brandInfo&#125;</code>, <code>&#123;features&#125;</code>, <code>&#123;stylingTips&#125;</code>, <code>&#123;conditionReport&#125;</code> or attributes like <code>&#123;Brand&#125;</code>, <code>&#123;Size&#125;</code> will be populated by AI analysis.
              </p>
            </div>
          )}

          {/* Section 4: eBay Policies */}
          <div className="pt-8 border-t border-slate-100 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center">
                <CheckCircle2 size={16} className="mr-2 text-indigo-600 shrink-0" /> Default eBay Business Policies
              </label>
              {!isEbayConnected && (
                <Badge variant="danger" className="self-start sm:self-auto">
                  <X size={12} /> Connect eBay Account to select policies
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Shipping Policy</label>
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
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Payment Policy</label>
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
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Return Policy</label>
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
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Location</label>
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
          <div className="pt-8 border-t border-slate-100 space-y-6">
            <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center">
              <Box size={16} className="mr-2 text-blue-500" /> Package Weight & Dimensions Defaults
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Package Weight */}
              <div className="space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-2">
                   <Weight size={14} className="text-slate-300" /> Package Weight (lbs / oz)
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
              <div className="space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-2">
                   <Box size={14} className="text-slate-300" /> Package Dimensions (L x W x H)
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
          <div className="flex justify-end pt-6 border-t border-slate-100 gap-3">
            <Button
              size="lg"
              icon={<Save size={18} />}
              loading={isSaving}
              disabled={!ruleName.trim()}
              onClick={handleSaveRule}
            >
              {editingId ? 'Update Rule' : 'Save Rule'}
            </Button>
          </div>
        </div>
      </div>

      {/* Rule List Modal */}
      <Modal open={showRuleList} onClose={() => setShowRuleList(false)} size="lg" showCloseButton>
        <div className="flex flex-col max-h-[80vh]">
          <div className="p-6 border-b border-slate-100">
            <h3 className="text-lg font-black text-slate-900">Saved Rules</h3>
            <p className="text-[11px] font-bold text-slate-400 mt-0.5">Switch between your saved AI listing templates</p>
          </div>
          <div className="p-6 overflow-y-auto flex-1 space-y-3">
            {isLoading ? (
              <LoadingState label="Loading rules..." />
            ) : rules.length === 0 ? (
              <EmptyState
                icon={<ListIcon size={20} />}
                title="No rules created yet"
                description="Build your first AI listing rule using the form on the left."
              />
            ) : (
              rules.map(rule => (
                <div key={rule._id || rule.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between gap-3 group hover:border-indigo-200 transition-all">
                  <div className="min-w-0">
                    <h4 className="font-black text-slate-900 text-sm truncate">{rule.name}</h4>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {rule.title_sequence?.map(f => (
                        <span key={f} className="text-[10px] font-bold text-indigo-600 bg-indigo-50/80 px-2 py-0.5 rounded-md">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <IconButton aria-label="Edit rule" onClick={() => handleEditRule(rule)}>
                      <Pencil size={16} />
                    </IconButton>
                    <IconButton aria-label="Delete rule" variant="danger" onClick={() => handleDeleteRule(rule._id || rule.id)}>
                      <Trash2 size={16} />
                    </IconButton>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Rules;
