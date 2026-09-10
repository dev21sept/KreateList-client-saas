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
  ShoppingBag,
  RefreshCw,
  CheckCircle2,
  Plus,
  Layers,
  Key,
  ShieldCheck,
  ChevronDown
} from 'lucide-react';
import { ruleService, aiService, listingService, amazonService } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { compressImage } from '../utils/imageCompressor';
import Button from '../components/ui/Button';
import IconButton from '../components/ui/IconButton';
import { Badge } from '../components/ui/Badge';

const AMAZON_CONDITIONS = [
  { id: 'New', label: 'New', description: 'Brand-new, unused, unopened item in original packaging with all original materials.' },
  { id: 'Used - Like New', label: 'Used - Like New', description: 'In perfect condition with no imperfections or signs of wear.' },
  { id: 'Used - Very Good', label: 'Used - Very Good', description: 'A well-cared-for item that has seen limited use and remains in great condition.' },
  { id: 'Used - Good', label: 'Used - Good', description: 'Shows wear from consistent use, but remains in good condition and functions properly.' },
  { id: 'Used - Acceptable', label: 'Used - Acceptable', description: 'Fairly worn but continues to function properly. Signs of wear can include scratches or dents.' }
];

const AMAZON_PRODUCT_TYPES = [
  { id: 'SHIRT', name: 'Shirts & Tops', category: 'Clothing, Shoes & Jewelry > Tops & Tees' },
  { id: 'PANTS', name: 'Pants & Trousers', category: 'Clothing, Shoes & Jewelry > Bottoms > Pants' },
  { id: 'DRESS', name: 'Dresses', category: 'Clothing, Shoes & Jewelry > Women > Dresses' },
  { id: 'SHOES', name: 'Shoes & Footwear', category: 'Clothing, Shoes & Jewelry > Shoes' },
  { id: 'OUTERWEAR', name: 'Jackets & Coats', category: 'Clothing, Shoes & Jewelry > Outerwear' },
  { id: 'SWEATER', name: 'Sweaters & Cardigans', category: 'Clothing, Shoes & Jewelry > Sweaters' },
  { id: 'SHORTS', name: 'Shorts', category: 'Clothing, Shoes & Jewelry > Bottoms > Shorts' },
  { id: 'SKIRT', name: 'Skirts', category: 'Clothing, Shoes & Jewelry > Women > Skirts' },
  { id: 'HANDBAG', name: 'Handbags & Wallets', category: 'Clothing, Shoes & Jewelry > Handbags & Wallets' },
  { id: 'JEWELRY', name: 'Jewelry & Accessories', category: 'Clothing, Shoes & Jewelry > Accessories > Jewelry' },
  { id: 'WATCH', name: 'Watches', category: 'Clothing, Shoes & Jewelry > Watches' },
  { id: 'HOME', name: 'Home & Kitchen', category: 'Home & Kitchen' },
  { id: 'BEAUTY', name: 'Beauty & Personal Care', category: 'Beauty & Personal Care' },
  { id: 'TOYS_AND_GAMES', name: 'Toys & Games', category: 'Toys & Games' },
  { id: 'SPORTING_GOODS', name: 'Sports & Outdoors', category: 'Sports & Outdoors' },
  { id: 'ELECTRONICS', name: 'Electronics', category: 'Electronics' },
  { id: 'BOOK', name: 'Books', category: 'Books' },
  { id: 'PRODUCT', name: 'General Product', category: 'Everything Else' }
];

const CreateAmazonListing = ({ isModal = false, editId: propEditId = null, initialListing = null, onClose = null }) => {
  const navigate = useNavigate();
  const { toast } = useNotification();
  const [searchParams] = useSearchParams();
  const editId = propEditId || searchParams.get('edit');

  const [hasScanned, setHasScanned] = useState(Boolean(editId || initialListing));
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [files, setFiles] = useState([]);
  const [draggedImgIdx, setDraggedImgIdx] = useState(null);
  const [dragOverImgIdx, setDragOverImgIdx] = useState(null);
  const [keywordInput, setKeywordInput] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '29.99',
    sku: '',
    brand: 'Generic',
    color: '',
    size: '',
    category: 'Clothing, Shoes & Jewelry > Tops & Tees',
    amazonProductType: 'SHIRT',
    amazonCondition: 'New',
    amazonBulletPoints: [
      '[PREMIUM QUALITY MATERIAL] - Crafted with high-grade fabric offering exceptional durability and lasting comfort.',
      '[ERGONOMIC & COMFORT FIT] - Designed for all-day ease with tailored lines suitable for daily activities.',
      '[TIMELESS MODERN AESTHETIC] - Clean profile and refined details elevate any casual or smart-casual look.',
      '[VERSATILE OCCASIONS] - Perfect for casual outings, work, travel, and seasonal layering.',
      '[EASY CARE & MAINTENANCE] - Machine washable with durable color retention and minimal shrinkage.'
    ],
    amazonGenericKeywords: ['apparel', 'fashion', 'casual wear', 'top quality', 'comfortable'],
    amazonStandardProductId: {
      idType: 'UPC',
      value: ''
    },
    hasGtinExemption: true,
    images: [],
    quantity: 1
  });

  // Populate initial listing if editing or crosslisting
  useEffect(() => {
    if (initialListing) {
      const pData = initialListing.platformData?.amazon || initialListing.listingsMap?.amazon || {};
      const bullets = pData.bulletPoints || initialListing.amazonBulletPoints || (initialListing.itemSpecifics ? Object.entries(initialListing.itemSpecifics).map(([k, v]) => `[${k.toUpperCase()}] - ${Array.isArray(v) ? v.join(', ') : v}`) : null);

      setFormData(prev => ({
        ...prev,
        title: pData.title || initialListing.title || prev.title,
        description: pData.description || initialListing.description || prev.description,
        price: pData.price || initialListing.price || prev.price,
        sku: pData.sku || initialListing.sku || `AMZ-${Date.now().toString().slice(-6)}`,
        brand: pData.brand || initialListing.brand || prev.brand,
        color: pData.color || initialListing.color || prev.color,
        size: pData.size || initialListing.size || prev.size,
        category: pData.category || initialListing.category || prev.category,
        amazonProductType: pData.productType || initialListing.amazonProductType || prev.amazonProductType,
        amazonCondition: pData.condition || initialListing.amazonCondition || initialListing.selectedCondition || 'New',
        amazonBulletPoints: Array.isArray(bullets) && bullets.length > 0 ? bullets.slice(0, 5) : prev.amazonBulletPoints,
        amazonGenericKeywords: pData.genericKeywords || initialListing.amazonGenericKeywords || prev.amazonGenericKeywords,
        images: initialListing.images || (initialListing.thumbnail ? [initialListing.thumbnail] : []),
        quantity: initialListing.quantity || 1
      }));
      setHasScanned(true);
    } else if (editId) {
      setLoading(true);
      listingService.getById(editId)
        .then(res => {
          if (res.data?.success && res.data?.data) {
            const l = res.data.data;
            const pData = l.platformData?.amazon || {};
            setFormData(prev => ({
              ...prev,
              title: pData.title || l.title || prev.title,
              description: pData.description || l.description || prev.description,
              price: pData.price || l.price || prev.price,
              sku: pData.sku || l.sku || `AMZ-${l._id?.slice(-6)}`,
              brand: pData.brand || l.brand || prev.brand,
              color: pData.color || l.color || prev.color,
              size: pData.size || l.size || prev.size,
              category: pData.category || l.category || prev.category,
              amazonProductType: pData.productType || l.amazonProductType || prev.amazonProductType,
              amazonCondition: pData.condition || l.amazonCondition || l.selectedCondition || 'New',
              amazonBulletPoints: l.amazonBulletPoints || prev.amazonBulletPoints,
              amazonGenericKeywords: l.amazonGenericKeywords || prev.amazonGenericKeywords,
              images: l.images || [],
              quantity: l.quantity || 1
            }));
            setHasScanned(true);
          }
        })
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [editId, initialListing]);

  // Handle Image Upload
  const handleImageChange = async (e) => {
    const uploadedFiles = Array.from(e.target.files);
    if (!uploadedFiles.length) return;

    try {
      const base64Images = await Promise.all(
        uploadedFiles.map(file => compressImage(file, { maxWidth: 1600, maxHeight: 1600, quality: 0.85 }))
      );

      setFormData(prev => ({
        ...prev,
        images: [...prev.images, ...base64Images]
      }));
      setFiles(prev => [...prev, ...uploadedFiles]);
    } catch (err) {
      console.error(err);
      toast.error('Failed to process uploaded images.');
    }
  };

  const removeImage = (indexToRemove) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, idx) => idx !== indexToRemove)
    }));
  };

  // AI Vision Scan for Amazon
  const handleAiScan = async () => {
    if (!formData.images.length && !formData.title) {
      toast.warning('Please upload at least 1 image or enter a title to scan.');
      return;
    }

    try {
      setAnalyzing(true);
      toast.info('Analyzing product for Amazon SP-API guidelines...');

      const payload = {
        images: formData.images.slice(0, 4),
        existingTitle: formData.title,
        existingDescription: formData.description,
        brand: formData.brand,
        price: formData.price,
        category: formData.category,
        condition: formData.amazonCondition,
        color: formData.color,
        size: formData.size,
        sku: formData.sku
      };

      const res = await aiService.amazonAnalyze(payload);

      if (res.data?.success && res.data?.data) {
        const ai = res.data.data;
        setFormData(prev => ({
          ...prev,
          title: ai.title || prev.title,
          description: ai.description || prev.description,
          amazonBulletPoints: ai.bulletPoints || prev.amazonBulletPoints,
          amazonGenericKeywords: ai.genericKeywords || prev.amazonGenericKeywords,
          amazonProductType: ai.productType || prev.amazonProductType,
          category: ai.category || prev.category,
          brand: ai.brand || prev.brand,
          color: ai.color || prev.color,
          size: ai.size || prev.size,
          price: ai.price || prev.price,
          amazonCondition: ai.condition || prev.amazonCondition,
          sku: ai.sku || prev.sku
        }));
        setHasScanned(true);
        toast.success('Amazon listing details generated by AI successfully!');
      } else {
        toast.error('Failed to generate Amazon details.');
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Error during AI generation.');
    } finally {
      setAnalyzing(false);
    }
  };

  // Bullet points handlers
  const handleBulletChange = (idx, val) => {
    const updated = [...formData.amazonBulletPoints];
    updated[idx] = val;
    setFormData(prev => ({ ...prev, amazonBulletPoints: updated }));
  };

  const addBulletPoint = () => {
    if (formData.amazonBulletPoints.length >= 5) {
      toast.warning('Amazon standard supports up to 5 main bullet points.');
      return;
    }
    setFormData(prev => ({
      ...prev,
      amazonBulletPoints: [...prev.amazonBulletPoints, '[FEATURE] - ']
    }));
  };

  const removeBulletPoint = (idx) => {
    setFormData(prev => ({
      ...prev,
      amazonBulletPoints: prev.amazonBulletPoints.filter((_, i) => i !== idx)
    }));
  };

  // Keywords handlers
  const addKeyword = () => {
    if (!keywordInput.trim()) return;
    const clean = keywordInput.trim().toLowerCase();
    if (!formData.amazonGenericKeywords.includes(clean)) {
      setFormData(prev => ({
        ...prev,
        amazonGenericKeywords: [...prev.amazonGenericKeywords, clean]
      }));
    }
    setKeywordInput('');
  };

  const removeKeyword = (kwToRemove) => {
    setFormData(prev => ({
      ...prev,
      amazonGenericKeywords: prev.amazonGenericKeywords.filter(k => k !== kwToRemove)
    }));
  };

  // Publish / Save Handler
  const handlePublish = async (asDraft = false) => {
    if (!formData.title.trim()) {
      toast.error('Please enter an Amazon listing title.');
      return;
    }
    if (!formData.price || isNaN(Number(formData.price))) {
      toast.error('Please enter a valid price.');
      return;
    }

    try {
      setPublishing(true);
      const targetId = editId || (initialListing?._id || initialListing?.id) || 'new';

      const payload = {
        ...formData,
        platform: 'amazon',
        status: asDraft ? 'draft' : 'published',
        amazonStatus: asDraft ? 'draft' : 'published'
      };

      const res = await amazonService.publish(targetId, payload);

      if (res.data?.success) {
        toast.success(asDraft ? 'Amazon listing saved as draft!' : 'Listing published to Amazon successfully!');
        if (onClose) {
          onClose(true);
        } else {
          navigate('/listings');
        }
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || err.message || 'Failed to publish to Amazon.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className={`w-full ${isModal ? 'p-6 max-h-[85vh] overflow-y-auto' : 'max-w-6xl mx-auto py-8 px-4'}`}>
      
      {/* Header Banner */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-100 mb-6">
        <div className="flex items-center gap-3">
          {!isModal && (
            <button
              type="button"
              onClick={() => navigate('/listings')}
              className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center p-2.5 shadow-sm border border-slate-800">
            <img src="/amazon.png" alt="Amazon" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-slate-900 tracking-tight">
                {editId ? 'Edit Amazon Listing' : 'Create Amazon Listing'}
              </h1>
              <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200/60 text-[10px] font-black uppercase">
                SP-API v2021-08-01
              </span>
            </div>
            <p className="text-xs text-slate-400 font-semibold">
              Generate AI-optimized 5 bullet points, backend search terms, and compliant title
            </p>
          </div>
        </div>

        {isModal && onClose && (
          <button
            type="button"
            onClick={() => onClose(false)}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={20} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Images & AI Scan */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Image Upload Box */}
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Product Photos</span>
              <span className="text-[11px] font-bold text-slate-400">{formData.images.length} / 9 Photos</span>
            </div>

            {/* Drag Drop Area */}
            <label className="border-2 border-dashed border-slate-200 hover:border-amber-400 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer bg-slate-50/50 hover:bg-amber-50/20 transition-all group">
              <input type="file" multiple accept="image/*" onChange={handleImageChange} className="hidden" />
              <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 group-hover:border-amber-300 flex items-center justify-center text-slate-400 group-hover:text-amber-500 transition-all shadow-sm">
                <Upload size={20} />
              </div>
              <p className="text-xs font-bold text-slate-700 group-hover:text-amber-600 transition-colors">
                Click or drag photos here
              </p>
              <p className="text-[10px] text-slate-400 font-semibold">
                JPEG, PNG, WEBP (Main photo should have pure white background)
              </p>
            </label>

            {/* Thumbnail Preview Grid */}
            {formData.images.length > 0 && (
              <div className="grid grid-cols-3 gap-2.5 pt-2">
                {formData.images.map((img, idx) => (
                  <div key={idx} className="relative group rounded-xl overflow-hidden aspect-square border border-slate-200 bg-slate-100">
                    <img src={img} alt="" className="w-full h-full object-cover" />
                    {idx === 0 && (
                      <span className="absolute top-1 left-1 bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow">
                        MAIN
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute top-1 right-1 bg-rose-600/90 hover:bg-rose-600 text-white p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* AI Vision Scan Button */}
            <button
              type="button"
              onClick={handleAiScan}
              disabled={analyzing || formData.images.length === 0}
              className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-2xl text-xs font-black shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {analyzing ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>AI is Scanning & Crafting Amazon Copy...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Scan with Amazon AI Specialist</span>
                </>
              )}
            </button>
          </div>

          {/* Pricing & SKU Card */}
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <span className="text-xs font-black text-slate-700 uppercase tracking-wider block">Price & SKU</span>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">Price ($ USD)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                    className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-amber-500"
                    placeholder="29.99"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 block mb-1">Merchant SKU</label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                placeholder="e.g. AMZ-NIKE-TEE-BLK-L"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Product Type & Condition */}
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <span className="text-xs font-black text-slate-700 uppercase tracking-wider block">Amazon Classification</span>

            <div>
              <label className="text-[11px] font-bold text-slate-500 block mb-1">Product Type</label>
              <select
                value={formData.amazonProductType}
                onChange={(e) => setFormData(prev => ({ ...prev, amazonProductType: e.target.value }))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-amber-500"
              >
                {AMAZON_PRODUCT_TYPES.map(pt => (
                  <option key={pt.id} value={pt.id}>
                    {pt.name} ({pt.id})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 block mb-1">Condition</label>
              <select
                value={formData.amazonCondition}
                onChange={(e) => setFormData(prev => ({ ...prev, amazonCondition: e.target.value }))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-amber-500"
              >
                {AMAZON_CONDITIONS.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* GTIN Exemption Toggle */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-700">GTIN Exemption / Generic</p>
                <p className="text-[10px] text-slate-400 font-semibold">List without standard barcode / UPC</p>
              </div>
              <input
                type="checkbox"
                checked={formData.hasGtinExemption}
                onChange={(e) => setFormData(prev => ({ ...prev, hasGtinExemption: e.target.checked }))}
                className="w-4 h-4 text-amber-600 rounded cursor-pointer"
              />
            </div>
          </div>

        </div>

        {/* Right Column: Title, 5 Bullets, Keywords & Description */}
        <div className="lg:col-span-7 space-y-6">

          {/* Title Editor */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                Amazon Product Title
              </label>
              <span className={`text-[10px] font-bold ${formData.title.length > 200 ? 'text-rose-500' : 'text-slate-400'}`}>
                {formData.title.length} / 200 characters
              </span>
            </div>
            <textarea
              rows={3}
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="e.g. Nike Men's Dri-FIT Moisture Wicking Athletic Running T-Shirt, Black, Large"
              className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 outline-none focus:border-amber-500 transition-all leading-relaxed"
            />
            <p className="text-[10px] text-slate-400 font-medium">
              Formula: [Brand] + [Model/Line] + [Key Feature / Material] + [Product Type] + [Color] + [Size]
            </p>
          </div>

          {/* 5 Bullet Points (Key Product Features) */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                  Key Product Features (5 Bullet Points)
                </span>
                <p className="text-[10px] text-slate-400 font-semibold">
                  These 5 points appear right under the price on Amazon product page.
                </p>
              </div>
              <button
                type="button"
                onClick={addBulletPoint}
                className="text-[11px] font-extrabold text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-xl transition-colors flex items-center gap-1"
              >
                <Plus size={12} /> Add Point
              </button>
            </div>

            <div className="space-y-2.5">
              {formData.amazonBulletPoints.map((bullet, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-black flex items-center justify-center shrink-0 mt-2">
                    {idx + 1}
                  </span>
                  <input
                    type="text"
                    value={bullet}
                    onChange={(e) => handleBulletChange(idx, e.target.value)}
                    placeholder={`[FEATURE HEADER] - Description of benefit ${idx + 1}...`}
                    className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-amber-500"
                  />
                  {formData.amazonBulletPoints.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeBulletPoint(idx)}
                      className="p-2 text-slate-300 hover:text-rose-500 rounded-lg transition-colors mt-0.5"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Backend Search Terms / Generic Keywords */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-3">
            <span className="text-xs font-black text-slate-700 uppercase tracking-wider block">
              Amazon Search Terms (Backend Keywords)
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }}
                placeholder="Type keyword and press Enter..."
                className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-amber-500"
              />
              <Button size="sm" onClick={addKeyword} className="bg-amber-500! hover:bg-amber-600!">
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {formData.amazonGenericKeywords.map((kw, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200/70 rounded-lg text-xs font-bold"
                >
                  {kw}
                  <button type="button" onClick={() => removeKeyword(kw)} className="hover:text-rose-600">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Brand, Color & Size */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <span className="text-xs font-black text-slate-700 uppercase tracking-wider block">Attributes</span>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">Brand</label>
                <input
                  type="text"
                  value={formData.brand}
                  onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">Color</label>
                <input
                  type="text"
                  value={formData.color}
                  onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">Size</label>
                <input
                  type="text"
                  value={formData.size}
                  onChange={(e) => setFormData(prev => ({ ...prev, size: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Product Description */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-3">
            <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
              Product Description
            </label>
            <textarea
              rows={4}
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Detailed description of the product benefits, specs, and care..."
              className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-700 outline-none focus:border-amber-500 leading-relaxed"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <Button
              variant="secondary"
              size="md"
              onClick={() => handlePublish(true)}
              disabled={publishing}
            >
              Save as Draft
            </Button>
            <button
              type="button"
              onClick={() => handlePublish(false)}
              disabled={publishing}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-2xl text-xs font-black shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {publishing ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Publishing to Amazon SP-API...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} />
                  <span>Publish to Amazon</span>
                </>
              )}
            </button>
          </div>

        </div>

      </div>

    </div>
  );
};

export default CreateAmazonListing;
