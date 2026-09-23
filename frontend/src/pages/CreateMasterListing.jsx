import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Upload, 
  ChevronLeft,
  ImageIcon, 
  DollarSign, 
  Zap, 
  Sparkles, 
  Loader2, 
  X, 
  Tag, 
  Eye, 
  Trash2, 
  ArrowLeft, 
  ArrowRight, 
  ShoppingBag, 
  RefreshCw, 
  Check, 
  ChevronDown, 
  Layers, 
  Globe, 
  Package, 
  Plus, 
  Code, 
  FileText, 
  Truck, 
  ShieldCheck, 
  Box, 
  Palette, 
  Info,
  Heart,
  TrendingUp
} from 'lucide-react';
import { 
  ruleService, 
  aiService, 
  listingService, 
  ebayService, 
  etsyService, 
  mercariService, 
  poshmarkService, 
  amazonService,
  externalImportService 
} from '../services/api';
import CategorySearchDropdown from '../components/CategorySearchDropdown';
import { useNotification } from '../context/NotificationContext';
import { compressImage } from '../utils/imageCompressor';
import Button from '../components/ui/Button';
import IconButton from '../components/ui/IconButton';
import { Badge } from '../components/ui/Badge';
import { POSHMARK_CONDITIONS } from '../constants/poshmarkConditions';
import { MERCARI_SIZES_BY_GROUP } from '../constants/mercariSizesTaxonomy';
import { MERCARI_CATEGORY_TREE } from '../constants/mercariTaxonomy';
import { 
  resolveMercariCategory, 
  resolvePoshmarkCategory, 
  resolveEbayCategoryFallback, 
  resolveEtsyCategoryFallback 
} from '../utils/categoryResolver';

const POPULAR_BRANDS = [
  { id: 4578, name: "Nike" },
  { id: 54, name: "Adidas" },
  { id: 3370, name: "Jordan" },
  { id: 115, name: "Air Jordan" },
  { id: 3778, name: "Levi's" },
  { id: 5487, name: "ROCKMOUNT" },
  { id: 27436, name: "Rockmount Ranchwear" },
  { id: 969, name: "Carhartt" },
  { id: 4867, name: "Patagonia" },
  { id: 5212, name: "Polo Ralph Lauren" },
  { id: 5971, name: "The North Face" },
  { id: 6223, name: "Under Armour" }
];

const PLATFORMS_CONFIG = [
  { id: 'ebay', name: 'eBay', logo: '/ebay.png' },
  { id: 'poshmark', name: 'Poshmark', logo: '/poshmark.png' },
  { id: 'mercari', name: 'Mercari', logo: '/mercari.png' },
  { id: 'etsy', name: 'Etsy', logo: '/etsy.png' },
  { id: 'amazon', name: 'Amazon', logo: '/amazon.png' }
];

const MASTER_CONDITIONS = [
  { id: "new", label: "New (with tags / box)", description: "Brand new, unused, unopened with tags/original packaging." },
  { id: "like_new", label: "Like New (Mint)", description: "Mint condition pre-owned, looks and feels brand new." },
  { id: "good", label: "Good (Gently Used)", description: "Gently used, minor signs of wear but in great shape." },
  { id: "fair", label: "Fair (Visible Wear)", description: "Noticeable wear, cosmetic marks or blemishes." }
];

const MERCARI_CONDITIONS = [
  { id: "new", label: "New (with tags)" },
  { id: "like_new", label: "Like New" },
  { id: "good", label: "Good" },
  { id: "fair", label: "Fair" },
  { id: "poor", label: "Poor" }
];

const POSHMARK_COLORS = [
  'Red', 'Pink', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple', 'Gold', 'Silver', 'Black', 'Gray', 'White', 'Cream', 'Brown', 'Tan'
];

const POSHMARK_DEPARTMENTS = [
  { id: 'Women', label: 'Women' },
  { id: 'Men', label: 'Men' },
  { id: 'Kids', label: 'Kids' },
  { id: 'Home', label: 'Home' },
  { id: 'Pets', label: 'Pets' }
];

const POSHMARK_SHIPPING_DISCOUNTS = [
  { id: '', label: 'No discount (Buyer pays $7.97)' },
  { id: '5.95', label: '$5.95 (You cover $2.02)' },
  { id: '4.99', label: '$4.99 (You cover $2.98)' },
  { id: '0.00', label: 'Free shipping (You cover $7.97)' }
];

const AMAZON_PRODUCT_TYPES = [
  { id: 'SHIRT', name: 'Shirts & Tops' },
  { id: 'PANTS', name: 'Pants & Trousers' },
  { id: 'DRESS', name: 'Dresses' },
  { id: 'SHOES', name: 'Shoes & Footwear' },
  { id: 'OUTERWEAR', name: 'Jackets & Coats' },
  { id: 'SWEATER', name: 'Sweaters & Cardigans' },
  { id: 'SHORTS', name: 'Shorts' },
  { id: 'SKIRT', name: 'Skirts' },
  { id: 'HANDBAG', name: 'Handbags & Wallets' },
  { id: 'JEWELRY', name: 'Jewelry & Accessories' },
  { id: 'WATCH', name: 'Watches' },
  { id: 'HOME', name: 'Home & Kitchen' },
  { id: 'BEAUTY', name: 'Beauty & Personal Care' },
  { id: 'TOYS_AND_GAMES', name: 'Toys & Games' },
  { id: 'SPORTING_GOODS', name: 'Sports & Outdoors' },
  { id: 'ELECTRONICS', name: 'Electronics' },
  { id: 'BOOK', name: 'Books' },
  { id: 'PRODUCT', name: 'General Product' }
];

const SearchableDropdown = ({ value, onSelect, options = [], placeholder = 'Select...', disabled = false, error = false, className = '' }) => {
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

  const getInitialSearchTerm = (val) => {
    if (!val) return '';
    const hasChildren = options.some(o => o.label && o.label.startsWith(val + ' > '));
    if (hasChildren) return val + ' > ';
    const lastIndex = val.lastIndexOf(' > ');
    if (lastIndex !== -1) return val.substring(0, lastIndex) + ' > ';
    return '';
  };

  const handleToggle = () => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) setSearchTerm(getInitialSearchTerm(value));
      return next;
    });
  };

  const filteredOptions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) {
      return options.filter(opt => opt.level === undefined || opt.level === 0);
    }
    const hasArrow = q.includes('>');
    if (hasArrow) {
      const normalizedQ = q.replace(/\s*>\s*/g, ' > ');
      return options.filter(opt => {
        const normalizedLabel = (opt.label || '').toLowerCase().replace(/\s*>\s*/g, ' > ');
        return normalizedLabel.startsWith(normalizedQ) || normalizedLabel.includes(normalizedQ);
      });
    }
    return options.filter((opt) => {
      const label = String(opt?.label || opt?.name || '').toLowerCase();
      const desc = String(opt?.description || '').toLowerCase();
      return label.includes(q) || desc.includes(q);
    });
  }, [options, searchTerm]);

  return (
    <div className={`relative w-full ${className}`} ref={wrapperRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className={`w-full h-10 px-3 bg-white border ${
          error ? 'border-rose-500 ring-2 ring-rose-500/10' : 'border-slate-200 hover:border-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/5'
        } rounded-xl text-left flex items-center justify-between text-xs font-bold text-slate-800 disabled:opacity-60 transition-all`}
      >
        <span className="truncate pr-2">{value || placeholder}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {value && !disabled && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onSelect({ id: '', label: '', name: '' });
                setSearchTerm('');
              }}
              className="p-1 hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {isOpen && !disabled && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-[9999] overflow-hidden animate-in fade-in duration-150">
          <div className="p-2 bg-slate-50 border-b border-slate-100">
            <input
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
              className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs font-medium outline-none focus:border-slate-800"
            />
          </div>
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-50">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => (
                <button
                  key={opt.id || opt.label || opt.name}
                  type="button"
                  onClick={() => {
                    const hasChildren = options.some(o => o.label && o.label.startsWith(opt.label + ' > '));
                    if (hasChildren) {
                      setSearchTerm(opt.label + ' > ');
                    } else {
                      onSelect(opt);
                      setIsOpen(false);
                      setSearchTerm('');
                    }
                  }}
                  className={`w-full text-left px-3.5 py-2 hover:bg-slate-100 text-slate-700 hover:text-slate-900 transition-colors flex items-center justify-between text-xs font-semibold ${
                    value === (opt.label || opt.name) ? 'bg-slate-100 font-bold text-slate-900' : ''
                  }`}
                >
                  <div className="truncate pr-2">
                    <div>{opt.label || opt.name}</div>
                    {opt.description && <div className="text-[10px] text-slate-400 font-normal">{opt.description}</div>}
                  </div>
                  {value === (opt.label || opt.name) && <Check className="w-3.5 h-3.5 text-slate-900 shrink-0" />}
                </button>
              ))
            ) : (
              <div className="p-4 text-xs text-slate-400 text-center">No options found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const POSHMARK_STYLE_TAGS = [
  "70s", "80s", "90s", "Activewear", "Animal Print", "Athleisure", "Avant Garde", "Baggy", 
  "Balletcore", "Beach", "Beaded", "Bikercore", "Blokecore", "Bodycon", "Bohemian", "Bow", 
  "Bridal", "Bridesmaid", "Business Casual", "Cable Knit", "Cashmere", "Casual", "Chunky", 
  "Collegiate", "Colorblock", "Colorful", "Contemporary", "Coord Sets", "Coquette Girl", 
  "Corduroy", "Cottagecore", "Cozy", "Crochet", "Cropped", "Cruelty-Free", "Cut Out", 
  "Denim", "Distressed", "DIY", "Drop Waist", "Eclectic Grandpa", "Embroidered", "Fall", 
  "Faux Fur", "Feminine", "Festival", "Festive", "Flannel", "Flare", "Floral", "Formal", 
  "Fringe", "Gingham", "Girlhoodcore", "Gorpcore", "Goth", "Grunge", "Hand Knit", 
  "Handmade", "Herringbone", "Houndstooth", "Indie Sleeze", "Knit", "Lace", "Leather", 
  "Leopard Print", "Lightweight", "Linen", "Luxury", "Maximalism", "Mesh", "Metallic", 
  "Minimalist", "Monochrome", "Monogram", "Moto", "Neon", "Neutral", "Nylon", "Office", 
  "Oversized", "Paisley", "Party", "Pastel", "Patchwork", "Peplum", "Plaid", "Platform", 
  "Pleated", "Polka Dot", "Preppy", "Punk", "Quiet Luxury", "Quilted", "Relaxed Fit", 
  "Resortwear", "Retro", "Rosette", "Ruffle", "Satin", "Sequins", "Sheer", "Sherpa", 
  "Silk", "Sporty", "Strapless", "Streetwear", "Stripes", "Suede", "Tailored", 
  "Tennis Prep", "Travel", "Tropical", "Tweed", "Two-Tone", "Unisex", "Upcycled", 
  "Utility", "Vacation", "Vegan", "Velour", "Vintage", "Waterproof", "Wedding", 
  "Western", "Whimsigoth", "Winter", "Wool", "Woven", "Y2K"
];

const POPULAR_POSH_BRANDS = [
  "Nike", "Lululemon", "Zara", "Free People", "Anthropologie", "Madewell", "Torrid", 
  "Coach", "Kate Spade", "Michael Kors", "Tory Burch", "Gucci", "Louis Vuitton", 
  "Patagonia", "The North Face", "Carhartt", "Levi's", "Adidas", "Jordan", 
  "Aritzia", "Urban Outfitters", "ASOS", "Abercrombie & Fitch", "American Eagle", 
  "H&M", "Gymshark", "Spanx", "Reformation", "Brandy Melville", "Under Armour", "J. Crew"
];

const POSHMARK_SIZES_BY_DEPT = {
  Women: ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '1X', '2X', '3X', '00', '0', '2', '4', '6', '8', '10', '12', '14', '16', '18', '20', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34', '5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '11.5', '12', 'One Size'],
  Men: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '28', '29', '30', '31', '32', '33', '34', '36', '38', '40', '42', '7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '11.5', '12', '13', '14', 'One Size'],
  Kids: ['0-3M', '3-6M', '6-9M', '9-12M', '12-18M', '18-24M', '2T', '3T', '4T', '5T', '4', '5', '6', '7', '8', '10', '12', '14', '16', 'One Size'],
  Home: ['One Size', 'Twin', 'Full', 'Queen', 'King', 'Standard'],
  Pets: ['One Size', 'XS', 'S', 'M', 'L', 'XL']
};

const ColorMultiSelectDropdown = ({ value, onChange, placeholder = 'Select colors (max 2)...' }) => {
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

  const selected = useMemo(() => {
    if (Array.isArray(value)) return value;
    return value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
  }, [value]);

  const filteredOptions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return POSHMARK_COLORS;
    return POSHMARK_COLORS.filter(c => c.toLowerCase().includes(q));
  }, [searchTerm]);

  const handleSelect = (color) => {
    if (selected.includes(color)) {
      const updated = selected.filter(item => item !== color);
      onChange(updated);
    } else {
      if (selected.length >= 2) return;
      const updated = [...selected, color];
      onChange(updated);
    }
  };

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full min-h-10 px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-400 focus-within:border-slate-900 rounded-xl text-left flex items-center justify-between text-xs font-semibold text-slate-800 cursor-pointer transition-all"
      >
        <div className="flex flex-wrap gap-1 items-center flex-1 min-w-0 mr-2">
          {selected.length > 0 ? (
            selected.map((item) => (
              <span
                key={item}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-900 text-[11px] font-bold rounded-md"
              >
                {item}
                <button
                  type="button"
                  onClick={() => handleSelect(item)}
                  className="p-0.5 hover:text-rose-500 rounded text-slate-400"
                >
                  <X size={10} />
                </button>
              </span>
            ))
          ) : (
            <span className="text-slate-400 font-medium">{placeholder}</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-auto">
          {selected.length > 0 && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onChange([]);
                setSearchTerm('');
              }}
              className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-[9999] overflow-hidden animate-in fade-in duration-150">
          <div className="p-2 bg-slate-50 border-b border-slate-100">
            <input
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search colors..."
              className="w-full h-8 px-2.5 rounded-lg border border-slate-200 text-xs font-medium outline-none focus:border-slate-800"
            />
          </div>
          
          <div className="max-h-52 overflow-y-auto divide-y divide-slate-50">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((item) => {
                const isSelected = selected.includes(item);
                const isLimitReached = selected.length >= 2 && !isSelected;
                return (
                  <button
                    key={item}
                    type="button"
                    disabled={isLimitReached}
                    onClick={() => handleSelect(item)}
                    className={`w-full text-left px-3 py-2 transition-colors flex items-center justify-between text-xs font-semibold ${
                      isSelected 
                        ? 'bg-slate-100 text-slate-900 font-bold' 
                        : isLimitReached 
                          ? 'opacity-40 cursor-not-allowed text-slate-400' 
                          : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span>{item}</span>
                    {isSelected && <Check size={14} className="text-slate-900" />}
                  </button>
                );
              })
            ) : (
              <div className="p-3 text-xs text-slate-400 text-center">No colors found</div>
            )}
          </div>

          <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-[10px] font-bold text-slate-400">
            <span>Select 1 - 2 colors</span>
            <span className={selected.length === 2 ? 'text-slate-900 font-extrabold' : 'text-slate-500'}>
              {selected.length}/2 Selected
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

const StyleTagMultiSelectDropdown = ({ value, onChange, placeholder = 'Select style tags (max 3)...' }) => {
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

  const selected = useMemo(() => {
    if (Array.isArray(value)) return value;
    return value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
  }, [value]);

  const filteredOptions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return POSHMARK_STYLE_TAGS;
    return POSHMARK_STYLE_TAGS.filter(t => t.toLowerCase().includes(q));
  }, [searchTerm]);

  const handleSelect = (tag) => {
    if (selected.includes(tag)) {
      const updated = selected.filter(item => item !== tag);
      onChange(updated);
    } else {
      if (selected.length >= 3) return;
      const updated = [...selected, tag];
      onChange(updated);
    }
  };

  const handleCustomAdd = () => {
    const clean = searchTerm.trim();
    if (!clean || selected.includes(clean)) return;
    if (selected.length >= 3) return;
    onChange([...selected, clean]);
    setSearchTerm('');
  };

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full min-h-10 px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-400 focus-within:border-slate-900 rounded-xl text-left flex items-center justify-between text-xs font-semibold text-slate-800 cursor-pointer transition-all"
      >
        <div className="flex flex-wrap gap-1 items-center flex-1 min-w-0 mr-2">
          {selected.length > 0 ? (
            selected.map((item) => (
              <span
                key={item}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-900 text-[11px] font-bold rounded-md"
              >
                #{item}
                <button
                  type="button"
                  onClick={() => handleSelect(item)}
                  className="p-0.5 hover:text-rose-500 rounded text-slate-400"
                >
                  <X size={10} />
                </button>
              </span>
            ))
          ) : (
            <span className="text-slate-400 font-medium">{placeholder}</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-auto">
          {selected.length > 0 && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onChange([]);
                setSearchTerm('');
              }}
              className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-[9999] overflow-hidden animate-in fade-in duration-150">
          <div className="p-2 bg-slate-50 border-b border-slate-100 flex gap-1.5">
            <input
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCustomAdd();
                }
              }}
              placeholder="Search or type custom style tag..."
              className="flex-1 h-8 px-2.5 rounded-lg border border-slate-200 text-xs font-medium outline-none focus:border-slate-800"
            />
            {searchTerm.trim() && !POSHMARK_STYLE_TAGS.some(t => t.toLowerCase() === searchTerm.trim().toLowerCase()) && (
              <button
                type="button"
                onClick={handleCustomAdd}
                className="px-2 py-1 bg-slate-900 text-white rounded-lg text-[10px] font-bold"
              >
                Add
              </button>
            )}
          </div>
          
          <div className="max-h-52 overflow-y-auto divide-y divide-slate-50">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((item) => {
                const isSelected = selected.includes(item);
                const isLimitReached = selected.length >= 3 && !isSelected;
                return (
                  <button
                    key={item}
                    type="button"
                    disabled={isLimitReached}
                    onClick={() => handleSelect(item)}
                    className={`w-full text-left px-3 py-2 transition-colors flex items-center justify-between text-xs font-semibold ${
                      isSelected 
                        ? 'bg-slate-100 text-slate-900 font-bold' 
                        : isLimitReached 
                          ? 'opacity-40 cursor-not-allowed text-slate-400' 
                          : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span>#{item}</span>
                    {isSelected && <Check size={14} className="text-slate-900" />}
                  </button>
                );
              })
            ) : (
              <div className="p-3 text-xs text-slate-400 text-center">Press Add to create "{searchTerm}"</div>
            )}
          </div>

          <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-[10px] font-bold text-slate-400">
            <span>Select up to 3 style tags</span>
            <span className={selected.length === 3 ? 'text-slate-900 font-extrabold' : 'text-slate-500'}>
              {selected.length}/3 Selected
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

const PoshmarkCategoryDropdown = ({ value, onSelect, placeholder = 'Search Poshmark category...' }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef(null);

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
        const response = await aiService.poshmarkSuggestCategories(searchTerm);
        if (response.data) {
          setSuggestions(response.data);
        }
      } catch (err) {
        console.error("Error fetching category suggestions:", err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchTerm]);

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div className="relative">
        <input 
          className="w-full px-3 h-10 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-slate-800 transition-all"
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
          className="absolute right-3 top-3 w-4 h-4 text-slate-400 cursor-pointer" 
          onClick={() => {
            setIsOpen(!isOpen);
            if (!isOpen) setSearchTerm(value || '');
          }}
        />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-[9999] max-h-60 overflow-y-auto animate-in fade-in duration-150">
          {loading && (
            <div className="p-3 text-xs font-semibold text-slate-400 text-center">Searching Poshmark Categories...</div>
          )}
          {!loading && suggestions.length === 0 && searchTerm.trim() && (
            <div className="p-3 text-xs font-semibold text-slate-400 text-center">No categories found</div>
          )}
          {suggestions.map((opt) => (
            <button
              key={opt.id || opt.fullName}
              type="button"
              onClick={() => {
                onSelect(opt);
                setIsOpen(false);
                setSearchTerm('');
              }}
              className="w-full text-left px-3.5 py-2.5 border-b border-slate-50 last:border-b-0 hover:bg-slate-100 text-slate-700 transition-colors"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-slate-800">{opt.fullName}</span>
                {opt.department && <span className="text-[10px] text-slate-400">{opt.department}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const PoshmarkBrandDropdown = ({ value, onChange, placeholder = 'Search or enter brand...' }) => {
  const [searchTerm, setSearchTerm] = useState(value || '');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    setSearchTerm(value || '');
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredBrands = useMemo(() => {
    const q = (searchTerm || '').trim().toLowerCase();
    if (!q) return POPULAR_POSH_BRANDS;
    return POPULAR_POSH_BRANDS.filter(b => b.toLowerCase().includes(q));
  }, [searchTerm]);

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <input 
        type="text"
        className="w-full px-3 h-10 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-slate-800"
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
      />
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 shadow-xl rounded-xl z-[9999] max-h-52 overflow-y-auto py-1">
          {filteredBrands.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => {
                setSearchTerm(b);
                onChange(b);
                setIsOpen(false);
              }}
              className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-slate-700 font-semibold text-xs truncate"
            >
              {b}
            </button>
          ))}
          {searchTerm.trim() && !filteredBrands.includes(searchTerm.trim()) && (
            <button
              type="button"
              onClick={() => {
                onChange(searchTerm.trim());
                setIsOpen(false);
              }}
              className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-slate-900 font-bold text-xs border-t border-slate-100"
            >
              Use "{searchTerm.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const PoshmarkSizeDropdown = ({ value, onChange, department = 'Women', placeholder = 'Select size...' }) => {
  const [searchTerm, setSearchTerm] = useState(value || '');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    setSearchTerm(value || '');
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const deptSizes = POSHMARK_SIZES_BY_DEPT[department] || POSHMARK_SIZES_BY_DEPT.Women || [];

  const filteredSizes = useMemo(() => {
    const q = (searchTerm || '').trim().toLowerCase();
    if (!q) return deptSizes;
    return deptSizes.filter(s => s.toLowerCase().includes(q));
  }, [searchTerm, deptSizes]);

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <input 
        type="text"
        className="w-full px-3 h-10 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-slate-800"
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
      />
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 shadow-xl rounded-xl z-[9999] max-h-52 overflow-y-auto py-1">
          {filteredSizes.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setSearchTerm(s);
                onChange(s);
                setIsOpen(false);
              }}
              className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-slate-700 font-semibold text-xs truncate"
            >
              {s}
            </button>
          ))}
          {searchTerm.trim() && !deptSizes.includes(searchTerm.trim()) && (
            <button
              type="button"
              onClick={() => {
                onChange(searchTerm.trim());
                setIsOpen(false);
              }}
              className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-slate-900 font-bold text-xs border-t border-slate-100"
            >
              Use "{searchTerm.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const MercariBrandDropdown = ({ value, onChange, placeholder = 'Search or enter brand...' }) => {
  const [searchTerm, setSearchTerm] = useState(value || '');
  const [suggestions, setSuggestions] = useState(POPULAR_BRANDS);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    setSearchTerm(value || '');
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const triggerBrandSearch = async (val) => {
    setSearchTerm(val);
    onChange(val, '');
    setIsOpen(true);
    if (!val.trim()) {
      setSuggestions(POPULAR_BRANDS);
      return;
    }
    try {
      const response = await mercariService.suggestBrands(val);
      if (response.data && response.data.success && response.data.brands) {
        setSuggestions(response.data.brands);
      }
    } catch (err) {
      console.warn("Backend brand autocomplete fetch failed:", err);
    }
  };

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <input 
        type="text"
        className="w-full px-3 h-10 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-slate-800"
        value={searchTerm}
        onChange={(e) => triggerBrandSearch(e.target.value)}
        onFocus={() => {
          setIsOpen(true);
          if (!searchTerm.trim()) setSuggestions(POPULAR_BRANDS);
        }}
        placeholder={placeholder}
      />
      {isOpen && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 shadow-xl rounded-xl z-[9999] max-h-52 overflow-y-auto py-1">
          {suggestions.map((b) => (
            <button
              key={b.id || b.name}
              type="button"
              onClick={() => {
                setSearchTerm(b.name);
                onChange(b.name, String(b.id || ''));
                setIsOpen(false);
              }}
              className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-slate-700 font-semibold text-xs truncate"
            >
              {b.name}
            </button>
          ))}
          {searchTerm.trim() && !suggestions.some(s => s.name.toLowerCase() === searchTerm.trim().toLowerCase()) && (
            <button
              type="button"
              onClick={() => {
                onChange(searchTerm.trim(), '');
                setIsOpen(false);
              }}
              className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-slate-900 font-bold text-xs border-t border-slate-100"
            >
              Use "{searchTerm.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const detectActivePlatforms = (listing) => {
  if (!listing) return ['ebay', 'poshmark', 'mercari', 'etsy', 'amazon'];
  
  const platforms = new Set();
  
  // 1. Direct platform field
  if (listing.platform && typeof listing.platform === 'string') {
    const p = listing.platform.toLowerCase();
    if (['ebay', 'poshmark', 'mercari', 'etsy', 'amazon'].includes(p)) {
      platforms.add(p);
    }
  }

  // 2. platformData keys
  if (listing.platformData && typeof listing.platformData === 'object') {
    Object.keys(listing.platformData).forEach(p => {
      const pLower = p.toLowerCase();
      if (['ebay', 'poshmark', 'mercari', 'etsy', 'amazon'].includes(pLower)) {
        const data = listing.platformData[p];
        if (data && typeof data === 'object' && Object.keys(data).length > 0) {
          if (data.status || data.liveId || data.price || data.title || data.category || data.sku) {
            platforms.add(pLower);
          }
        }
      }
    });
  }

  // 3. platforms map
  if (listing.platforms && typeof listing.platforms === 'object') {
    Object.keys(listing.platforms).forEach(p => {
      const pLower = p.toLowerCase();
      if (['ebay', 'poshmark', 'mercari', 'etsy', 'amazon'].includes(pLower)) {
        platforms.add(pLower);
      }
    });
  }

  // 4. listingsMap (from grouped SKU rows)
  if (listing.listingsMap && typeof listing.listingsMap === 'object') {
    Object.keys(listing.listingsMap).forEach(p => {
      const pLower = p.toLowerCase();
      if (['ebay', 'poshmark', 'mercari', 'etsy', 'amazon'].includes(pLower)) {
        platforms.add(pLower);
      }
    });
  }

  // 5. publishedPlatforms / connectedMarketplaces arrays
  if (Array.isArray(listing.publishedPlatforms)) {
    listing.publishedPlatforms.forEach(p => {
      const pLower = String(p).toLowerCase();
      if (['ebay', 'poshmark', 'mercari', 'etsy', 'amazon'].includes(pLower)) {
        platforms.add(pLower);
      }
    });
  }
  if (Array.isArray(listing.connectedMarketplaces)) {
    listing.connectedMarketplaces.forEach(p => {
      const pLower = String(p).toLowerCase();
      if (['ebay', 'poshmark', 'mercari', 'etsy', 'amazon'].includes(pLower)) {
        platforms.add(pLower);
      }
    });
  }

  // 6. Explicit channel IDs and status fields
  if (listing.ebayListingId || (listing.ebayStatus && listing.ebayStatus !== 'none')) platforms.add('ebay');
  if (listing.poshmarkListingId || (listing.poshmarkStatus && listing.poshmarkStatus !== 'none')) platforms.add('poshmark');
  if (listing.mercariListingId || (listing.mercariStatus && listing.mercariStatus !== 'none')) platforms.add('mercari');
  if (listing.etsyListingId || (listing.etsyStatus && listing.etsyStatus !== 'none')) platforms.add('etsy');
  if (listing.amazonAsin || listing.amazonListingId || (listing.amazonStatus && listing.amazonStatus !== 'none')) platforms.add('amazon');

  if (platforms.size > 0) {
    return Array.from(platforms);
  }
  return ['ebay', 'poshmark', 'mercari', 'etsy', 'amazon'];
};

const CreateMasterListing = ({
  initialListing = null,
  isModal = false,
  onClose = null,
  onSyncSuccess = null,
  initialPlatform = null,
  isSinglePlatformOnly = false,
  editId: propEditId = null,
  isEditMode: propIsEditMode = false
}) => {
  const navigate = useNavigate();
  const { toast } = useNotification();
  const [searchParams] = useSearchParams();
  const editId = propEditId || searchParams.get('edit');
  const queryPlatform = searchParams.get('platform');
  const isEditMode = propIsEditMode || Boolean(editId);

  const [selectedPlatforms, setSelectedPlatforms] = useState(() => {
    if (initialPlatform) return [initialPlatform];
    if (queryPlatform) return [queryPlatform];
    if (initialListing) {
      const detected = detectActivePlatforms(initialListing);
      if (detected.length > 0) return detected;
    }
    return ['ebay', 'poshmark', 'mercari', 'etsy', 'amazon'];
  });

  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [descriptionMode, setDescriptionMode] = useState('edit');
  const [rules, setRules] = useState([]);
  const [files, setFiles] = useState([]);
  const [isConvertingImages, setIsConvertingImages] = useState(false);

  // Platform Extra States
  const [ebayPolicies, setEbayPolicies] = useState({ fulfillment: [], payment: [], returns: [], locations: [] });
  const [ebayAspects, setEbayAspects] = useState([]);
  const [shippingProfiles, setShippingProfiles] = useState([]);
  const [refreshingProfiles, setRefreshingProfiles] = useState(false);

  // Custom Aspect Input State (for eBay)
  const [newAspectName, setNewAspectName] = useState('');
  const [newAspectValue, setNewAspectValue] = useState('');
  const [showAddAspect, setShowAddAspect] = useState(false);

  // Mercari Brand Autocomplete State
  const [mercariBrandQuery, setMercariBrandQuery] = useState('');
  const [mercariBrandSuggestions, setMercariBrandSuggestions] = useState([]);
  const [isMercariBrandOpen, setIsMercariBrandOpen] = useState(false);
  const mercariBrandRef = useRef(null);

  // Tag inputs
  const [poshTagInput, setPoshTagInput] = useState('');
  const [etsyTagInput, setEtsyTagInput] = useState('');
  const [etsyMaterialInput, setEtsyMaterialInput] = useState('');

  // Unified Form Data State
  const [formData, setFormData] = useState({
    // Master Universal
    images: [],
    selectedRule: '',
    selectedCondition: 'Good (Gently Used)',
    conditionId: 'good',
    title: '',
    price: '',
    originalPrice: '',
    sku: '',
    brand: '',
    size: '',
    color: '',
    quantity: '1',
    description: '',
    selectedModel: 'gpt-4o-mini',
    packageWeight: { lbs: 1, oz: 0 },
    packageDimensions: { length: 10, width: 8, height: 2 },

    // eBay
    ebayCategory: '',
    ebayCategoryId: '',
    ebayPrice: '',
    ebayFormat: 'Buy It Now',
    ebayYourCost: '',
    ebayCondition: 'Pre-owned - Good',
    ebayAspects: {},
    fulfillmentPolicyId: '',
    paymentPolicyId: '',
    returnPolicyId: '',
    locationKey: '',
    ebayAllowOffers: false,
    ebayMinOfferPrice: '',
    ebayAutoAcceptPrice: '',
    ebayVolumePricingEnabled: false,
    ebayVolumePricingTier2: '5',
    ebayVolumePricingTier3: '10',
    ebayVolumePricingTier4: '15',
    ebayScheduleListing: false,
    ebayScheduleDate: '',
    ebayScheduleTime: '12:00',
    ebayIrregularPackage: false,
    ebayDisplayUkSite: false,
    ebayCountryOfOrigin: 'China',
    ebayItemLocationZip: '23294',
    ebayItemLocationCity: 'Henrico, Virginia, United States',
    ebayProductDocumentsEnabled: false,
    ebayProductDocType: 'User Guide',
    ebayProductDocUrl: '',
    ebayPromotedGeneral: false,
    ebayPromotedGeneralRate: '7.5',
    ebayPromotedPriority: false,
    ebayPromotedPriorityBid: '0.45',
    ebayCharityEnabled: false,
    ebayCharityPercentage: '10',
    ebayCharityOrg: 'Direct Relief',

    // Poshmark
    poshmarkDepartment: 'Women',
    poshmarkCategory: '',
    poshmarkPrice: '',
    poshmarkOriginalPrice: '',
    poshmarkSubcategory: '',
    poshmarkSize: '',
    poshmarkCondition: 'Good',
    poshmarkColors: [],
    poshmarkStyleTags: [],
    poshmarkShippingDiscount: '',

    // Mercari
    mercariCategory: '',
    mercariCategoryId: '',
    mercariPrice: '',
    mercariBrand: '',
    mercariBrandId: '',
    mercariCondition: 'good',
    mercariSize: '',
    mercariSizeId: '',
    mercariShippingPayer: 'buyer',
    mercariShippingMethod: 'prepaid',
    mercariShippingWeightLbs: 0,
    mercariShippingWeightOz: 8,
    mercariShippingFitsShoebox: true,
    mercariShippingLength: 10,
    mercariShippingWidth: 8,
    mercariShippingHeight: 4,
    mercariShippingCarrier: 'USPS Ground Advantage',
    mercariShippingPrice: '4.99',
    mercariSku: '',

    // Etsy
    etsyCategory: '',
    etsyCategoryId: '',
    etsyPrice: '',
    who_made: 'i_did',
    when_made: '2020_2026',
    is_supply: 'false',
    renewal: 'manual',
    shipping_profile_id: '',
    etsyTags: [],
    etsyMaterials: [],

    // Amazon
    amazonAsin: '',
    amazonPrice: '',
    amazonStandardProductId: { idType: 'UPC', value: '' },
    amazonProductType: 'PRODUCT',
    amazonCondition: 'Used - Good',
    amazonBulletPoints: ['', '', '', ''],
    amazonKeywords: ''
  });

  const modelOptions = useMemo(() => [
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini (OpenAI)', description: 'Fast, cost-efficient model' },
    { id: 'gpt-4o', label: 'GPT-4o (OpenAI)', description: 'High-accuracy model' },
    { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (Google)', description: 'Fast Google AI model' },
    { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (Google)', description: 'Intelligent Google AI model' },
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (Google)', description: 'Ultra-fast Google AI model' }
  ], []);

  // Mercari Category Tree
  const mercariCategoryOptions = useMemo(() => {
    const list = [];
    const traverse = (node, path = '') => {
      if (!node) return;
      const currentPath = path ? `${path} > ${node.name}` : node.name;
      if (node.children && node.children.length > 0) {
        node.children.forEach(child => traverse(child, currentPath));
      } else {
        list.push({
          id: String(node.id),
          label: currentPath,
          name: node.name,
          itemSizeGroupId: node.itemSizeGroupId || 0
        });
      }
    };
    MERCARI_CATEGORY_TREE.forEach(rootNode => traverse(rootNode));
    return list;
  }, []);

  // Mercari Carrier Options Matrix
  const mercariCarrierOptions = useMemo(() => {
    const lbs = Number(formData.mercariShippingWeightLbs) || 0;
    const oz = Number(formData.mercariShippingWeightOz) || 0;
    const totalOz = (lbs * 16) + oz;
    
    const length = Number(formData.mercariShippingLength) || 0;
    const width = Number(formData.mercariShippingWidth) || 0;
    const height = Number(formData.mercariShippingHeight) || 0;
    const isLarge = !formData.mercariShippingFitsShoebox && (length >= 15 || width >= 15 || height >= 15 || (length * width * height) >= 3375);

    if (isLarge) {
      return [
        { carrier: 'UPS Ground', weightText: '5 lb', price: '11.50', warning: 'Large package (exceeds 15"). USPS Ground Advantage and UPS Ground Saver are restricted due to size limits. UPS Ground is recommended.' },
        { carrier: 'FedEx Ground', weightText: '5 lb', price: '11.50', warning: 'Large package (exceeds 15"). USPS Ground Advantage and UPS Ground Saver are restricted due to size limits. FedEx Ground is recommended.' }
      ];
    }

    const options = [];
    
    // USPS Ground Advantage
    if (totalOz <= 4) options.push({ carrier: 'USPS Ground Advantage', weightText: '4 oz', price: '4.30' });
    else if (totalOz <= 8) options.push({ carrier: 'USPS Ground Advantage', weightText: '8 oz', price: '4.99' });
    else if (totalOz <= 12) options.push({ carrier: 'USPS Ground Advantage', weightText: '12 oz', price: '5.40' });
    else if (totalOz <= 16) options.push({ carrier: 'USPS Ground Advantage', weightText: '1 lb', price: '7.48' });
    else if (totalOz <= 32) options.push({ carrier: 'USPS Ground Advantage', weightText: '2 lb', price: '8.50' });

    // UPS Ground Saver
    if (totalOz <= 16) options.push({ carrier: 'UPS Ground Saver', weightText: '1 lb', price: '7.20' });
    else if (totalOz <= 32) options.push({ carrier: 'UPS Ground Saver', weightText: '2 lb', price: '7.97' });

    // FedEx Ground Economy
    if (totalOz <= 48) options.push({ carrier: 'FedEx Ground Economy', weightText: '3 lb', price: '8.99' });

    // UPS Ground
    if (totalOz <= 80) options.push({ carrier: 'UPS Ground', weightText: '5 lb', price: '11.50' });
    else options.push({ carrier: 'UPS Ground', weightText: `${Math.max(5, Math.ceil(totalOz/16))} lb`, price: '15.00' });

    return options;
  }, [formData.mercariShippingWeightLbs, formData.mercariShippingWeightOz, formData.mercariShippingFitsShoebox, formData.mercariShippingLength, formData.mercariShippingWidth, formData.mercariShippingHeight]);

  const mercariActiveSizes = useMemo(() => {
    if (!formData.mercariCategory) return [];
    const match = mercariCategoryOptions.find(o => o.label === formData.mercariCategory);
    if (!match || !match.itemSizeGroupId) return [];
    return MERCARI_SIZES_BY_GROUP[match.itemSizeGroupId] || [];
  }, [formData.mercariCategory, mercariCategoryOptions]);

  // Initial Fetching
  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const [rulesRes, policiesRes] = await Promise.all([
          ruleService.getAll(),
          ebayService.getPolicies()
        ]);

        if (rulesRes.data?.success) {
          setRules(rulesRes.data.data);
          const defaultRule = rulesRes.data.data.find(r => r.isDefault) || rulesRes.data.data[0];
          if (defaultRule && !formData.selectedRule) {
            setFormData(prev => ({ ...prev, selectedRule: defaultRule._id || defaultRule.id }));
          }
        }

        if (policiesRes.data?.success) {
          const pData = policiesRes.data.data || {};
          setEbayPolicies(pData);
          setFormData(prev => ({
            ...prev,
            fulfillmentPolicyId: prev.fulfillmentPolicyId || pData.fulfillment?.[0]?.fulfillmentPolicyId || '',
            paymentPolicyId: prev.paymentPolicyId || pData.payment?.[0]?.paymentPolicyId || '',
            returnPolicyId: prev.returnPolicyId || pData.returns?.[0]?.returnPolicyId || '',
            locationKey: prev.locationKey || pData.locations?.[0]?.merchantLocationKey || ''
          }));
        }
      } catch (err) {
        console.error("Failed to load initial master listing config:", err);
      }

      try {
        const profRes = await etsyService.getShippingProfiles();
        if (profRes.data?.success) {
          const profs = profRes.data.data?.profiles || profRes.data.data || [];
          setShippingProfiles(profs);
          if (profs.length > 0 && !formData.shipping_profile_id) {
            setFormData(prev => ({ ...prev, shipping_profile_id: String(profs[0].shipping_profile_id || profs[0].id) }));
          }
        }
      } catch (err) {
        console.warn("Could not load Etsy shipping profiles:", err);
      }
    };

    fetchInitial();
  }, []);

  // Populate data when editing or initialized
  useEffect(() => {
    const populateListingData = (listing) => {
      if (!listing) return;
      const ebData = listing.platformData?.ebay || {};
      const pmData = listing.platformData?.poshmark || {};
      const mcData = listing.platformData?.mercari || {};
      const etData = listing.platformData?.etsy || {};
      const amData = listing.platformData?.amazon || {};

      let rawAspects = {};
      const srcAspects = ebData.itemSpecifics || listing.itemSpecifics || ebData.aspects || {};
      if (srcAspects && typeof srcAspects === 'object') {
        Object.entries(srcAspects).forEach(([k, v]) => {
          rawAspects[k] = Array.isArray(v) ? v : [v];
        });
      }

      // Auto-detect platforms if in edit mode or multi-platform
      if (!isSinglePlatformOnly) {
        const detected = detectActivePlatforms(listing);
        if (detected.length > 0) {
          setSelectedPlatforms(detected);
        }
      }

      const extractedBrand = listing.brand || ebData.brand || mcData.brand || pmData.brand || rawAspects['Brand']?.[0] || '';
      const extractedSize = listing.size || ebData.size || mcData.size || pmData.size || rawAspects['Size']?.[0] || '';
      const extractedColor = listing.color || ebData.color || mcData.color || (Array.isArray(pmData.colors) ? pmData.colors[0] : pmData.color) || rawAspects['Color']?.[0] || '';
      const extractedDescription = listing.description || ebData.description || pmData.description || mcData.description || etData.description || amData.description || '';

      if (extractedBrand && !rawAspects['Brand']) rawAspects['Brand'] = [extractedBrand];
      if (extractedSize && !rawAspects['Size']) rawAspects['Size'] = [extractedSize];
      if (extractedColor && !rawAspects['Color']) rawAspects['Color'] = [extractedColor];

      setFormData(prev => ({
        ...prev,
        images: (listing.images && listing.images.length > 0) ? listing.images : (ebData.images || prev.images),
        selectedRule: listing.selectedRule || prev.selectedRule,
        title: listing.title || ebData.title || pmData.title || mcData.title || prev.title,
        price: listing.price !== undefined ? String(listing.price) : (ebData.price !== undefined ? String(ebData.price) : prev.price),
        originalPrice: listing.originalPrice !== undefined ? String(listing.originalPrice) : (pmData.originalPrice !== undefined ? String(pmData.originalPrice) : prev.originalPrice),
        sku: listing.sku || ebData.sku || mcData.sku || prev.sku,
        brand: extractedBrand || prev.brand,
        size: extractedSize || prev.size,
        color: extractedColor || prev.color,
        description: extractedDescription || prev.description,

        // eBay
        ebayCategory: resolveEbayCategoryFallback(
          ebData.category || (listing.platform === 'ebay' ? listing.category : '') || prev.ebayCategory,
          listing.title || ebData.title || prev.title,
          extractedBrand || prev.brand
        ).category,
        ebayCategoryId: (ebData.categoryId && String(ebData.categoryId) !== '206') ? String(ebData.categoryId) : (resolveEbayCategoryFallback(
          ebData.category || (listing.platform === 'ebay' ? listing.category : '') || prev.ebayCategory,
          listing.title || ebData.title || prev.title,
          extractedBrand || prev.brand
        ).categoryId || prev.ebayCategoryId),
        ebayPrice: ebData.price !== undefined ? String(ebData.price) : (listing.price !== undefined ? String(listing.price) : prev.ebayPrice),
        ebayFormat: ebData.format || prev.ebayFormat,
        ebayYourCost: ebData.yourCost || prev.ebayYourCost,
        ebayCondition: ebData.selectedCondition || ebData.condition || (listing.platform === 'ebay' ? listing.selectedCondition : '') || prev.ebayCondition,
        ebayAspects: { ...prev.ebayAspects, ...rawAspects },
        fulfillmentPolicyId: ebData.fulfillmentPolicyId || listing.fulfillmentPolicyId || prev.fulfillmentPolicyId,
        paymentPolicyId: ebData.paymentPolicyId || listing.paymentPolicyId || prev.paymentPolicyId,
        returnPolicyId: ebData.returnPolicyId || listing.returnPolicyId || prev.returnPolicyId,
        locationKey: ebData.locationKey || listing.locationKey || prev.locationKey,
        ebayAllowOffers: ebData.allowOffers !== undefined ? ebData.allowOffers : prev.ebayAllowOffers,
        ebayMinOfferPrice: ebData.minOfferPrice || prev.ebayMinOfferPrice,
        ebayAutoAcceptPrice: ebData.autoAcceptPrice || prev.autoAcceptPrice,
        ebayVolumePricingEnabled: ebData.volumePricingEnabled !== undefined ? ebData.volumePricingEnabled : prev.ebayVolumePricingEnabled,
        ebayVolumePricingTier2: ebData.volumePricingTier2 || prev.ebayVolumePricingTier2,
        ebayVolumePricingTier3: ebData.volumePricingTier3 || prev.ebayVolumePricingTier3,
        ebayVolumePricingTier4: ebData.volumePricingTier4 || prev.ebayVolumePricingTier4,
        ebayScheduleListing: ebData.scheduleListing !== undefined ? ebData.scheduleListing : prev.ebayScheduleListing,
        ebayScheduleDate: ebData.scheduleDate || prev.ebayScheduleDate,
        ebayScheduleTime: ebData.scheduleTime || prev.ebayScheduleTime,
        ebayIrregularPackage: ebData.irregularPackage !== undefined ? ebData.irregularPackage : prev.ebayIrregularPackage,
        ebayDisplayUkSite: ebData.displayUkSite !== undefined ? ebData.displayUkSite : prev.displayUkSite,
        ebayCountryOfOrigin: ebData.countryOfOrigin || prev.ebayCountryOfOrigin,
        ebayItemLocationZip: ebData.itemLocationZip || prev.ebayItemLocationZip,
        ebayItemLocationCity: ebData.itemLocationCity || prev.ebayItemLocationCity,
        ebayProductDocumentsEnabled: ebData.productDocumentsEnabled !== undefined ? ebData.productDocumentsEnabled : prev.ebayProductDocumentsEnabled,
        ebayProductDocType: ebData.productDocType || prev.ebayProductDocType,
        ebayProductDocUrl: ebData.productDocUrl || prev.ebayProductDocUrl,
        ebayPromotedGeneral: ebData.promotedGeneral !== undefined ? ebData.promotedGeneral : prev.ebayPromotedGeneral,
        ebayPromotedGeneralRate: ebData.promotedGeneralRate || prev.ebayPromotedGeneralRate,
        ebayPromotedPriority: ebData.promotedPriority !== undefined ? ebData.promotedPriority : prev.ebayPromotedPriority,
        ebayPromotedPriorityBid: ebData.promotedPriorityBid || prev.ebayPromotedPriorityBid,
        ebayCharityEnabled: ebData.charityEnabled !== undefined ? ebData.charityEnabled : prev.ebayCharityEnabled,
        ebayCharityPercentage: ebData.charityPercentage || prev.ebayCharityPercentage,
        ebayCharityOrg: ebData.charityOrg || prev.ebayCharityOrg,

        // Poshmark
        poshmarkCategory: resolvePoshmarkCategory(
          pmData.category || (listing.platform === 'poshmark' ? listing.category : '') || prev.poshmarkCategory,
          listing.title || pmData.title || prev.title,
          extractedBrand || prev.brand
        ).category,
        poshmarkPrice: pmData.price !== undefined ? String(pmData.price) : (listing.price !== undefined ? String(listing.price) : prev.poshmarkPrice),
        poshmarkOriginalPrice: pmData.originalPrice !== undefined ? String(pmData.originalPrice) : (listing.originalPrice !== undefined ? String(listing.originalPrice) : prev.poshmarkOriginalPrice),
        poshmarkDepartment: pmData.departmentId || pmData.department || resolvePoshmarkCategory(
          pmData.category || (listing.platform === 'poshmark' ? listing.category : '') || prev.poshmarkCategory,
          listing.title || pmData.title || prev.title,
          extractedBrand || prev.brand
        ).department || prev.poshmarkDepartment || 'Women',
        poshmarkSize: pmData.size || listing.size || rawAspects['Size']?.[0] || prev.poshmarkSize,
        poshmarkColors: Array.isArray(pmData.colors) ? pmData.colors : (pmData.color ? [pmData.color] : (listing.color ? [listing.color] : (rawAspects['Color'] ? rawAspects['Color'] : prev.poshmarkColors))),
        poshmarkStyleTags: Array.isArray(pmData.styleTags) ? pmData.styleTags : (pmData.styleTag ? [pmData.styleTag] : (listing.styleTag ? [listing.styleTag] : prev.poshmarkStyleTags)),
        poshmarkShippingDiscount: pmData.shippingDiscount || prev.poshmarkShippingDiscount,

        // Mercari
        mercariCategory: resolveMercariCategory(
          mcData.category || (listing.platform === 'mercari' ? listing.category : '') || prev.mercariCategory,
          listing.title || ebData.title || pmData.title || mcData.title || prev.title,
          extractedBrand || prev.brand
        ).category,
        mercariCategoryId: mcData.categoryId || (listing.platform === 'mercari' ? listing.categoryId : '') || resolveMercariCategory(
          mcData.category || (listing.platform === 'mercari' ? listing.category : '') || prev.mercariCategory,
          listing.title || ebData.title || pmData.title || mcData.title || prev.title,
          extractedBrand || prev.brand
        ).categoryId,
        mercariPrice: mcData.price !== undefined ? String(mcData.price) : (listing.price !== undefined ? String(listing.price) : prev.mercariPrice),
        mercariBrand: mcData.brand || listing.brand || rawAspects['Brand']?.[0] || prev.mercariBrand,
        mercariBrandId: mcData.brandId || listing.brandId || prev.mercariBrandId,
        mercariCondition: mcData.condition || mcData.selectedCondition || (listing.platform === 'mercari' ? listing.selectedCondition : '') || prev.mercariCondition,
        mercariSize: mcData.size || listing.size || rawAspects['Size']?.[0] || prev.mercariSize,
        mercariShippingPayer: mcData.shippingPayer || listing.shippingPayer || prev.mercariShippingPayer,
        mercariShippingMethod: mcData.shippingMethod || listing.shippingMethod || prev.mercariShippingMethod,
        mercariShippingWeightLbs: mcData.shippingWeightLbs !== undefined ? mcData.shippingWeightLbs : (listing.shippingWeightLbs !== undefined ? listing.shippingWeightLbs : prev.mercariShippingWeightLbs),
        mercariShippingWeightOz: mcData.shippingWeightOz !== undefined ? mcData.shippingWeightOz : (listing.shippingWeightOz !== undefined ? listing.shippingWeightOz : prev.mercariShippingWeightOz),
        mercariShippingFitsShoebox: mcData.shippingFitsShoebox !== undefined ? mcData.shippingFitsShoebox : (listing.shippingFitsShoebox !== undefined ? listing.shippingFitsShoebox : prev.mercariShippingFitsShoebox),
        mercariShippingLength: mcData.shippingLength || listing.shippingLength || prev.mercariShippingLength,
        mercariShippingWidth: mcData.shippingWidth || listing.shippingWidth || prev.mercariShippingWidth,
        mercariShippingHeight: mcData.shippingHeight || listing.shippingHeight || prev.mercariShippingHeight,
        mercariShippingCarrier: mcData.shippingCarrier || listing.shippingCarrier || prev.mercariShippingCarrier,
        mercariShippingPrice: mcData.shippingPrice || listing.shippingPrice || prev.mercariShippingPrice,

        // Etsy
        etsyCategory: resolveEtsyCategoryFallback(
          etData.category || (listing.platform === 'etsy' ? listing.category : '') || prev.etsyCategory,
          listing.title || etData.title || prev.title,
          extractedBrand || prev.brand
        ),
        etsyCategoryId: etData.categoryId || (listing.platform === 'etsy' ? listing.categoryId : '') || prev.etsyCategoryId,
        etsyPrice: etData.price !== undefined ? String(etData.price) : (listing.price !== undefined ? String(listing.price) : prev.etsyPrice),
        who_made: etData.who_made || listing.etsyWhoMade || prev.who_made,
        when_made: etData.when_made || listing.etsyWhenMade || prev.when_made,
        is_supply: String(etData.is_supply !== undefined ? etData.is_supply : (listing.etsyIsSupply !== undefined ? listing.etsyIsSupply : prev.is_supply)),
        renewal: etData.renewal || listing.etsyRenewal || prev.renewal,
        shipping_profile_id: etData.shipping_profile_id || listing.etsyShippingProfileId || prev.shipping_profile_id,
        etsyTags: Array.isArray(etData.tags) ? etData.tags : (listing.etsyTags || prev.etsyTags),
        etsyMaterials: Array.isArray(etData.materials) ? etData.materials : (listing.etsyMaterials || prev.etsyMaterials),

        // Amazon
        amazonProductType: amData.productType || listing.amazonProductType || prev.amazonProductType,
        amazonPrice: amData.price !== undefined ? String(amData.price) : (listing.price !== undefined ? String(listing.price) : prev.amazonPrice),
        amazonStandardProductId: amData.standardProductId || listing.amazonStandardProductId || prev.amazonStandardProductId,
        amazonBulletPoints: Array.isArray(amData.bulletPoints) ? amData.bulletPoints : (listing.amazonBulletPoints || prev.amazonBulletPoints),
        amazonKeywords: amData.keywords || (Array.isArray(listing.amazonGenericKeywords) ? listing.amazonGenericKeywords.join(', ') : listing.amazonGenericKeywords) || prev.amazonKeywords
      }));
    };

    const targetDbId = editId || initialListing?._id || initialListing?.id;
    if (initialListing) {
      populateListingData(initialListing);
    }
    if (targetDbId && !String(targetDbId).startsWith('mock-')) {
      setLoading(true);
      listingService.getOne(targetDbId)
        .then(res => {
          if (res.data?.success && res.data?.data) {
            populateListingData(res.data.data);
          }
        })
        .catch(err => console.error("Failed to load edit listing:", err))
        .finally(() => setLoading(false));
    }
  }, [editId, initialListing]);

  // Load eBay Aspects when eBay Category ID changes
  useEffect(() => {
    if (formData.ebayCategoryId) {
      ebayService.getCategoryAspects(formData.ebayCategoryId)
        .then(res => {
          if (res.data?.success) {
            setEbayAspects(res.data.data?.aspects || res.data.data || []);
          }
        })
        .catch(e => console.warn("Failed to fetch eBay aspects:", e));
    }
  }, [formData.ebayCategoryId]);

  const handleImageUpload = async (e) => {
    const uploadedFiles = Array.from(e.target.files);
    setFiles(prev => [...prev, ...uploadedFiles]);
    setIsConvertingImages(true);
    try {
      const base64Images = await Promise.all(
        uploadedFiles.map(file => compressImage(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.8 }))
      );
      setFormData(prev => ({ ...prev, images: [...prev.images, ...base64Images] }));
    } catch (err) {
      console.error("Error compressing images:", err);
      toast.error("Failed to process some images.");
    } finally {
      setIsConvertingImages(false);
    }
  };

  const moveImage = (index, direction) => {
    const newImages = [...formData.images];
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newImages.length) return;
    [newImages[index], newImages[targetIndex]] = [newImages[targetIndex], newImages[index]];
    setFormData(prev => ({ ...prev, images: newImages }));
  };

  const deleteImage = (index) => {
    const newImages = formData.images.filter((_, idx) => idx !== index);
    setFormData(prev => ({ ...prev, images: newImages }));
  };

  const startAIFetch = async () => {
    if (formData.images.length === 0) {
      toast.warning("Please upload at least one image.");
      return;
    }
    if (!formData.selectedRule) {
      toast.warning("Please select an AI Listing Rule.");
      return;
    }

    setLoading(true);
    const selectedRuleObj = rules.find(r => (r._id || r.id) === formData.selectedRule);

    try {
      const response = await aiService.analyze({
        images: formData.images,
        title_sequence: selectedRuleObj?.title_sequence || [],
        description_prompt: selectedRuleObj?.description_prompt || '',
        description_template: selectedRuleObj?.description_template || '',
        condition_note: selectedRuleObj?.condition_note || '',
        condition_name: formData.selectedCondition,
        model: formData.selectedModel || 'gpt-4o-mini',
        existing_title: formData.title || ''
      });

      if (response.data?.success) {
        const res = response.data.data;
        const brandVal = res.brand || prev.brand || '';
        const sizeVal = res.size || prev.size || '';
        const colorVal = res.color || prev.color || '';
        const resolvedEbay = resolveEbayCategoryFallback(
          res.ebay_category_name || res.category_name || res.category || '',
          res.title || prev.title,
          brandVal || prev.brand
        );
        const resolvedPosh = resolvePoshmarkCategory(
          res.poshmark_category_name || res.category_name || res.category || '',
          res.title || prev.title,
          brandVal || prev.brand
        );
        const resolvedMercari = resolveMercariCategory(
          res.mercari_category_name || res.category_name || res.category || '',
          res.title || prev.title,
          brandVal || prev.brand
        );
        const resolvedEtsy = resolveEtsyCategoryFallback(
          res.etsy_category_name || res.category_name || res.category || '',
          res.title || prev.title,
          brandVal || prev.brand
        );

        setFormData(prev => ({
          ...prev,
          title: res.title || prev.title,
          price: res.price || prev.price,
          originalPrice: res.originalPrice || prev.originalPrice,
          description: res.description || prev.description,
          brand: brandVal,
          size: sizeVal,
          color: colorVal,
          sku: res.sku || prev.sku,

          // eBay
          ebayCategory: res.ebay_category_name || resolvedEbay.category || prev.ebayCategory,
          ebayCategoryId: (res.ebay_category_id && String(res.ebay_category_id) !== '206') ? String(res.ebay_category_id) : (resolvedEbay.categoryId || prev.ebayCategoryId),
          ebayPrice: prev.ebayPrice || res.price || prev.price,
          ebayAspects: { 
            ...prev.ebayAspects, 
            ...(brandVal ? { Brand: [brandVal] } : {}),
            ...(sizeVal ? { Size: [sizeVal] } : {}),
            ...(colorVal ? { Color: [colorVal] } : {}),
            ...(res.item_specifics || res.aspects || {}) 
          },

          // Poshmark
          poshmarkCategory: res.poshmark_category_name || resolvedPosh.category || prev.poshmarkCategory,
          poshmarkPrice: prev.poshmarkPrice || res.price || prev.price,
          poshmarkSize: sizeVal || prev.poshmarkSize,
          poshmarkDepartment: res.poshmark_department || resolvedPosh.department || prev.poshmarkDepartment,
          poshmarkColors: Array.isArray(res.colors) ? res.colors : (colorVal ? [colorVal] : prev.poshmarkColors),
          poshmarkStyleTags: Array.isArray(res.style_tags) ? res.style_tags : prev.poshmarkStyleTags,

          // Mercari
          mercariCategory: res.mercari_category_name || resolvedMercari.category,
          mercariCategoryId: res.mercari_category_id || resolvedMercari.categoryId,
          mercariBrand: brandVal || prev.mercariBrand,
          mercariPrice: prev.mercariPrice || res.price || prev.price,
          mercariSize: sizeVal || prev.mercariSize,

          // Etsy
          etsyCategory: res.etsy_category_name || resolvedEtsy || prev.etsyCategory,
          etsyCategoryId: res.etsy_category_id || res.category_id || prev.etsyCategoryId,
          etsyPrice: prev.etsyPrice || res.price || prev.price,
          etsyTags: Array.isArray(res.tags) ? res.tags : (res.style_tags || prev.etsyTags),
          etsyMaterials: Array.isArray(res.materials) ? res.materials : prev.etsyMaterials,

          // Amazon
          amazonPrice: prev.amazonPrice || res.price || prev.price,
          amazonBulletPoints: Array.isArray(res.bulletPoints) ? res.bulletPoints : prev.amazonBulletPoints,
          amazonKeywords: res.keywords || prev.amazonKeywords
        }));

        toast.success("AI scanning complete! Master & platform specifics populated.");
      }
    } catch (error) {
      console.error("AI Scan Error:", error);
      toast.error("Failed to analyze product with AI.");
    } finally {
      setLoading(false);
    }
  };

  const handleAspectChange = (aspectName, value) => {
    setFormData(prev => ({
      ...prev,
      ebayAspects: {
        ...prev.ebayAspects,
        [aspectName]: Array.isArray(value) ? value : [value]
      }
    }));
  };

  const handleAddCustomAspect = () => {
    if (!newAspectName.trim() || !newAspectValue.trim()) return;
    handleAspectChange(newAspectName.trim(), newAspectValue.trim());
    setNewAspectName('');
    setNewAspectValue('');
    setShowAddAspect(false);
  };

  const togglePlatform = (platId) => {
    setSelectedPlatforms(prev => {
      if (prev.includes(platId)) {
        if (prev.length === 1) {
          toast.warning("At least one platform must remain selected.");
          return prev;
        }
        return prev.filter(p => p !== platId);
      }
      return [...prev, platId];
    });
  };

  const togglePoshColor = (col) => {
    setFormData(prev => {
      const current = prev.poshmarkColors || [];
      if (current.includes(col)) return { ...prev, poshmarkColors: current.filter(c => c !== col) };
      if (current.length >= 2) {
        toast.warning("Poshmark allows a maximum of 2 colors.");
        return prev;
      }
      return { ...prev, poshmarkColors: [...current, col] };
    });
  };

  const addPoshTag = (tag) => {
    const clean = tag.trim();
    if (!clean) return;
    setFormData(prev => {
      const current = prev.poshmarkStyleTags || [];
      if (current.includes(clean)) return prev;
      if (current.length >= 3) {
        toast.warning("Poshmark allows a maximum of 3 style tags.");
        return prev;
      }
      return { ...prev, poshmarkStyleTags: [...current, clean] };
    });
    setPoshTagInput('');
  };

  const removePoshTag = (tag) => {
    setFormData(prev => ({
      ...prev,
      poshmarkStyleTags: (prev.poshmarkStyleTags || []).filter(t => t !== tag)
    }));
  };

  const addEtsyTag = (tag) => {
    const clean = tag.trim();
    if (!clean) return;
    setFormData(prev => {
      const current = prev.etsyTags || [];
      if (current.includes(clean)) return prev;
      if (current.length >= 13) {
        toast.warning("Etsy allows a maximum of 13 tags.");
        return prev;
      }
      return { ...prev, etsyTags: [...current, clean] };
    });
    setEtsyTagInput('');
  };

  const removeEtsyTag = (tag) => {
    setFormData(prev => ({ ...prev, etsyTags: (prev.etsyTags || []).filter(t => t !== tag) }));
  };

  const addEtsyMaterial = (mat) => {
    const clean = mat.trim();
    if (!clean) return;
    setFormData(prev => {
      const current = prev.etsyMaterials || [];
      if (current.includes(clean)) return prev;
      if (current.length >= 13) {
        toast.warning("Etsy allows a maximum of 13 materials.");
        return prev;
      }
      return { ...prev, etsyMaterials: [...current, clean] };
    });
    setEtsyMaterialInput('');
  };

  const removeEtsyMaterial = (mat) => {
    setFormData(prev => ({ ...prev, etsyMaterials: (prev.etsyMaterials || []).filter(m => m !== mat) }));
  };

  const buildListingPayload = (targetStatus = 'draft') => {
    const compiledAspects = { ...formData.ebayAspects };
    if (formData.brand && (!compiledAspects['Brand'] || compiledAspects['Brand'].length === 0 || !compiledAspects['Brand'][0])) {
      compiledAspects['Brand'] = [formData.brand];
    }
    if (formData.size && (!compiledAspects['Size'] || compiledAspects['Size'].length === 0 || !compiledAspects['Size'][0])) {
      compiledAspects['Size'] = [formData.size];
    }
    if (formData.color && (!compiledAspects['Color'] || compiledAspects['Color'].length === 0 || !compiledAspects['Color'][0])) {
      compiledAspects['Color'] = [formData.color];
    }

    return {
      title: formData.title || 'Untitled Product',
      description: formData.description || '',
      price: formData.price || '0.00',
      originalPrice: formData.originalPrice || '',
      sku: formData.sku || `KL${Date.now().toString().slice(-6)}`,
      brand: formData.brand || '',
      size: formData.size || '',
      color: formData.color || '',
      quantity: parseInt(formData.quantity) || 1,
      category: formData.ebayCategory || formData.mercariCategory || formData.etsyCategory || formData.poshmarkCategory || 'General',
      categoryId: formData.ebayCategoryId || formData.mercariCategoryId || formData.etsyCategoryId || '',
      images: formData.images,
      thumbnail: formData.images[0] || '',
      status: targetStatus,
      selectedRule: formData.selectedRule,
      selectedCondition: formData.selectedCondition,
      conditionId: formData.conditionId,
      selectedModel: formData.selectedModel,
      packageWeight: formData.packageWeight,
      packageDimensions: formData.packageDimensions,

      platformData: {
        ebay: {
          title: formData.title,
          price: formData.ebayPrice || formData.price || '0.00',
          yourCost: formData.ebayYourCost,
          format: formData.ebayFormat,
          description: formData.description,
          category: formData.ebayCategory,
          categoryId: formData.ebayCategoryId,
          selectedCondition: formData.ebayCondition,
          itemSpecifics: compiledAspects,
          aspects: compiledAspects,
          fulfillmentPolicyId: formData.fulfillmentPolicyId,
          paymentPolicyId: formData.paymentPolicyId,
          returnPolicyId: formData.returnPolicyId,
          locationKey: formData.locationKey,
          packageWeight: formData.packageWeight,
          packageDimensions: formData.packageDimensions,
          allowOffers: formData.ebayAllowOffers,
          minOfferPrice: formData.ebayMinOfferPrice,
          autoAcceptPrice: formData.ebayAutoAcceptPrice,
          volumePricingEnabled: formData.ebayVolumePricingEnabled,
          volumePricingTier2: formData.ebayVolumePricingTier2,
          volumePricingTier3: formData.ebayVolumePricingTier3,
          volumePricingTier4: formData.ebayVolumePricingTier4,
          scheduleListing: formData.ebayScheduleListing,
          scheduleDate: formData.ebayScheduleDate,
          scheduleTime: formData.ebayScheduleTime,
          irregularPackage: formData.ebayIrregularPackage,
          displayUkSite: formData.ebayDisplayUkSite,
          countryOfOrigin: formData.ebayCountryOfOrigin,
          itemLocationZip: formData.ebayItemLocationZip,
          itemLocationCity: formData.ebayItemLocationCity,
          productDocumentsEnabled: formData.ebayProductDocumentsEnabled,
          productDocType: formData.ebayProductDocType,
          productDocUrl: formData.ebayProductDocUrl,
          promotedGeneral: formData.ebayPromotedGeneral,
          promotedGeneralRate: formData.ebayPromotedGeneralRate,
          promotedPriority: formData.ebayPromotedPriority,
          promotedPriorityBid: formData.ebayPromotedPriorityBid,
          charityEnabled: formData.ebayCharityEnabled,
          charityPercentage: formData.ebayCharityPercentage,
          charityOrg: formData.ebayCharityOrg,
          images: formData.images,
          sku: formData.sku
        },
        poshmark: {
          title: formData.title,
          price: formData.poshmarkPrice || formData.price || '0.00',
          description: formData.description,
          originalPrice: formData.poshmarkOriginalPrice || formData.originalPrice,
          departmentId: formData.poshmarkDepartment,
          category: formData.poshmarkCategory,
          subcategoryIds: formData.poshmarkSubcategory ? [formData.poshmarkSubcategory] : [],
          size: formData.poshmarkSize || formData.size,
          colors: formData.poshmarkColors,
          condition: formData.poshmarkCondition,
          selectedCondition: formData.poshmarkCondition,
          styleTags: formData.poshmarkStyleTags,
          shippingDiscount: formData.poshmarkShippingDiscount,
          images: formData.images,
          sku: formData.sku
        },
        mercari: {
          title: formData.title,
          price: formData.mercariPrice || formData.price || '0.00',
          description: formData.description,
          category: formData.mercariCategory,
          categoryId: formData.mercariCategoryId,
          brand: formData.mercariBrand || formData.brand,
          brandId: formData.mercariBrandId,
          size: formData.mercariSize || formData.size,
          sizeId: formData.mercariSizeId,
          condition: formData.mercariCondition,
          selectedCondition: formData.mercariCondition,
          shippingPayer: formData.mercariShippingPayer,
          shippingMethod: formData.mercariShippingMethod,
          shippingWeightLbs: formData.mercariShippingWeightLbs,
          shippingWeightOz: formData.mercariShippingWeightOz,
          shippingFitsShoebox: formData.mercariShippingFitsShoebox,
          shippingLength: formData.mercariShippingLength,
          shippingWidth: formData.mercariShippingWidth,
          shippingHeight: formData.mercariShippingHeight,
          shippingCarrier: formData.mercariShippingCarrier,
          shippingPrice: formData.mercariShippingPrice,
          images: formData.images,
          sku: formData.mercariSku || formData.sku
        },
        etsy: {
          title: formData.title,
          price: formData.etsyPrice || formData.price || '0.00',
          description: formData.description,
          category: formData.etsyCategory,
          categoryId: formData.etsyCategoryId,
          who_made: formData.who_made,
          when_made: formData.when_made,
          is_supply: formData.is_supply === 'true',
          renewal: formData.renewal,
          shipping_profile_id: formData.shipping_profile_id,
          tags: formData.etsyTags,
          materials: formData.etsyMaterials,
          images: formData.images,
          sku: formData.sku
        },
        amazon: {
          title: formData.title,
          price: formData.amazonPrice || formData.price || '0.00',
          description: formData.description,
          asin: formData.amazonAsin,
          standardProductId: formData.amazonStandardProductId,
          productType: formData.amazonProductType,
          condition: formData.amazonCondition,
          bulletPoints: (formData.amazonBulletPoints || []).filter(b => b.trim().length > 0),
          keywords: formData.amazonKeywords,
          images: formData.images,
          sku: formData.sku
        }
      }
    };
  };

  const handleSaveDraft = async () => {
    if (!formData.title) {
      toast.warning("Please enter a Listing Title.");
      return;
    }
    setLoading(true);
    const payload = buildListingPayload('draft');

    try {
      const activeId = editId || initialListing?._id || initialListing?.id;
      const res = activeId 
        ? await listingService.update(activeId, payload)
        : await listingService.create(payload);

      if (res.data?.success) {
        toast.success(isEditMode ? "Listing updated successfully!" : "Listing saved as Draft!");
        if (onSyncSuccess) onSyncSuccess();
        if (isModal && onClose) onClose();
        else navigate('/listings');
      }
    } catch (err) {
      console.error("Save Draft Error:", err);
      toast.error(err.response?.data?.message || "Failed to save draft.");
    } finally {
      setLoading(false);
    }
  };

  const handlePublishOrUpdateAll = async () => {
    if (!formData.title) {
      toast.warning("Please enter a Listing Title.");
      return;
    }
    if (formData.images.length === 0) {
      toast.warning("Please upload at least one image.");
      return;
    }
    if (selectedPlatforms.length === 0) {
      toast.warning("Please select at least one target platform.");
      return;
    }

    setPublishing(true);
    const payload = buildListingPayload('published');

    try {
      const activeId = editId || initialListing?._id || initialListing?.id;
      const res = activeId 
        ? await listingService.update(activeId, payload)
        : await listingService.create(payload);

      const savedListing = res.data?.data;
      const targetListingId = activeId || savedListing?._id || savedListing?.id;

      toast.info(`Publishing to ${selectedPlatforms.map(p => p.toUpperCase()).join(', ')}...`);

      const syncResults = await Promise.allSettled(
        selectedPlatforms.map(async (plat) => {
          if (plat === 'ebay') {
            return await listingService.publish(targetListingId);
          } else if (plat === 'etsy') {
            return await etsyService.publish(targetListingId, payload.platformData.etsy);
          } else if (plat === 'poshmark') {
            return await externalImportService.publish(targetListingId, { platform: 'poshmark', ...payload.platformData.poshmark });
          } else if (plat === 'mercari') {
            return await externalImportService.publish(targetListingId, { platform: 'mercari', ...payload.platformData.mercari });
          } else if (plat === 'amazon') {
            return await amazonService.publish(targetListingId, payload.platformData.amazon);
          }
        })
      );

      let successCount = 0;
      syncResults.forEach((result, idx) => {
        const plat = selectedPlatforms[idx];
        if (result.status === 'fulfilled' && (result.value?.data?.success || result.value?.status === 200)) {
          successCount++;
          toast.success(`? Synced on ${plat.toUpperCase()}`);
        } else {
          const errMsg = result.reason?.response?.data?.message || result.value?.data?.message || "Sync error";
          toast.warning(`${plat.toUpperCase()} sync note: ${errMsg}`);
        }
      });

      if (successCount > 0) {
        toast.success(`Listing successfully published across ${successCount}/${selectedPlatforms.length} platforms!`);
      }

      if (onSyncSuccess) onSyncSuccess();
      if (isModal && onClose) onClose();
      else navigate('/listings');
    } catch (err) {
      console.error("Multi-platform publish error:", err);
      toast.error(err.response?.data?.message || "Failed to publish on platforms.");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto py-4 px-4 sm:px-6 space-y-6">
      
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <button 
            type="button" 
            onClick={() => onClose ? onClose() : navigate(-1)}
            className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 transition-colors"
            title="Go Back"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">
                {isEditMode ? 'Edit Master Listing' : 'Create Master Listing'}
              </h1>
              <span className="px-2 py-0.5 bg-slate-900 text-white text-[10px] font-bold rounded-md uppercase">
                Multi-Platform Sync
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Manage core listing data and fine-tune platform-specific parameters across all marketplaces
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSaveDraft}
            disabled={loading || publishing}
          >
            Save Draft
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handlePublishOrUpdateAll}
            loading={publishing}
            icon={<ShoppingBag size={14} />}
          >
            {isEditMode ? 'Update All Platforms' : `List on ${selectedPlatforms.length} Platforms`}
          </Button>
        </div>
      </div>

      {/* Target Platforms Toggle Bar */}
      {!isSinglePlatformOnly && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-slate-800 block">Target Marketplaces</span>
            <span className="text-[10px] text-slate-400 font-medium">Toggle platforms to enable custom category & shipping controls</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS_CONFIG.map((p) => {
              const isSelected = selectedPlatforms.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePlatform(p.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                    isSelected 
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs' 
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <img src={p.logo} className="w-4 h-4 object-contain" alt="" />
                  <span>{p.name}</span>
                  {isSelected && <Check size={12} className="text-white" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main 2-Column Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Photos & AI Scanner (Sticky on Desktop) */}
        <div className="lg:col-span-4 lg:sticky lg:top-4 space-y-4">
          
          {/* Photo Manager Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <ImageIcon size={14} className="text-slate-600" /> Photos ({formData.images.length})
              </label>
              <label className="text-[11px] font-bold text-slate-700 hover:text-slate-900 cursor-pointer underline">
                + Add Photos
                <input 
                  type="file" 
                  multiple 
                  accept="image/*" 
                  onChange={handleImageUpload} 
                  className="hidden" 
                />
              </label>
            </div>

            {formData.images.length === 0 ? (
              <label className="border-2 border-dashed border-slate-200 hover:border-slate-400 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-slate-50 hover:bg-slate-100">
                <Upload size={24} className="text-slate-400 mb-2" />
                <span className="text-xs font-bold text-slate-700">Upload Product Images</span>
                <span className="text-[10px] text-slate-400 mt-0.5">JPEG, PNG, WEBP up to 10MB</span>
                <input 
                  type="file" 
                  multiple 
                  accept="image/*" 
                  onChange={handleImageUpload} 
                  className="hidden" 
                />
              </label>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {formData.images.map((img, idx) => (
                  <div 
                    key={idx} 
                    className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shadow-xs"
                  >
                    <img 
                      src={img} 
                      alt="" 
                      className="w-full h-full object-cover" 
                    />
                    
                    {idx === 0 && (
                      <span className="absolute top-1 left-1 bg-slate-900 text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow">
                        Cover
                      </span>
                    )}

                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-1">
                      <button 
                        type="button" 
                        onClick={() => deleteImage(idx)}
                        className="self-end p-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px]"
                        title="Delete photo"
                      >
                        <Trash2 size={10} />
                      </button>
                      <div className="flex justify-between gap-1">
                        <button 
                          type="button" 
                          disabled={idx === 0}
                          onClick={() => moveImage(idx, 'left')}
                          className="px-1.5 py-0.5 bg-white/30 hover:bg-white/50 text-white rounded text-[9px] font-bold disabled:opacity-30"
                          title="Move left"
                        >
                          <ArrowLeft size={10} />
                        </button>
                        <button 
                          type="button" 
                          disabled={idx === formData.images.length - 1}
                          onClick={() => moveImage(idx, 'right')}
                          className="px-1.5 py-0.5 bg-white/30 hover:bg-white/50 text-white rounded text-[9px] font-bold disabled:opacity-30"
                          title="Move right"
                        >
                          <ArrowRight size={10} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {isConvertingImages && (
              <div className="flex items-center gap-2 text-slate-600 text-xs font-semibold animate-pulse pt-1">
                <Loader2 className="animate-spin" size={12} /> Processing images...
              </div>
            )}
          </div>

          {/* AI Listing Scanner Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Sparkles size={14} className="text-slate-700" /> AI Listing Scanner
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Auto-prefill</span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Listing Rule</label>
                <SearchableDropdown 
                  value={rules.find(r => (r._id || r.id) === formData.selectedRule)?.name}
                  onSelect={(opt) => setFormData(prev => ({ ...prev, selectedRule: opt.id }))}
                  options={rules.map(r => ({ id: r._id || r.id, label: r.name }))}
                  placeholder="Select prefill rule..."
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Condition</label>
                  <SearchableDropdown 
                    value={formData.selectedCondition}
                    onSelect={(opt) => setFormData(prev => ({ ...prev, selectedCondition: opt.label, conditionId: opt.id }))}
                    options={MASTER_CONDITIONS}
                    placeholder="Select condition..."
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">AI Model</label>
                  <SearchableDropdown 
                    value={modelOptions.find(m => m.id === formData.selectedModel)?.label}
                    onSelect={(opt) => setFormData(prev => ({ ...prev, selectedModel: opt.id }))}
                    options={modelOptions}
                    placeholder="Select model..."
                  />
                </div>
              </div>

              <Button
                type="button"
                variant="primary"
                size="md"
                className="w-full mt-2"
                onClick={startAIFetch}
                loading={loading}
                disabled={loading || formData.images.length === 0}
                icon={<Sparkles size={14} />}
              >
                Analyze Product & Prefill
              </Button>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Master Fields + Marketplace Cards */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Section 1: Master Common Fields */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              Common Product Details
            </h2>

            {/* Title */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-slate-700">Listing Title *</label>
                <span className="text-[10px] text-slate-400">{formData.title.length}/80</span>
              </div>
              <input 
                type="text"
                className="w-full px-3 h-10 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-slate-800"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value.substring(0, 80) }))}
                placeholder="Product title across marketplaces..."
                maxLength={80}
              />
            </div>

            {/* Brand, Size, Color, Price */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Brand</label>
                <input 
                  type="text"
                  className="w-full px-3 h-10 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-slate-800"
                  value={formData.brand}
                  onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                  placeholder="e.g. Nike, Adidas..."
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Size</label>
                <input 
                  type="text"
                  className="w-full px-3 h-10 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-slate-800"
                  value={formData.size}
                  onChange={(e) => setFormData(prev => ({ ...prev, size: e.target.value }))}
                  placeholder="e.g. M, 10, One Size"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Color</label>
                <input 
                  type="text"
                  className="w-full px-3 h-10 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-slate-800"
                  value={formData.color}
                  onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                  placeholder="e.g. Black, Blue"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Master Price ($) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">$</span>
                  <input 
                    type="number"
                    step="0.01"
                    className="w-full pl-7 pr-3 h-10 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-slate-800"
                    value={formData.price}
                    onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700">Master Description</label>
                <button
                  type="button"
                  onClick={() => setDescriptionMode(prev => prev === 'edit' ? 'preview' : 'edit')}
                  className="text-[11px] font-bold text-slate-600 hover:text-slate-900 px-2 py-0.5 bg-slate-100 rounded-lg"
                >
                  {descriptionMode === 'edit' ? 'Preview' : 'Edit'}
                </button>
              </div>

              {descriptionMode === 'edit' ? (
                <textarea 
                  rows={5}
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-slate-800 leading-relaxed"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Detailed master product description..."
                />
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 whitespace-pre-wrap min-h-[120px] leading-relaxed">
                  {formData.description || <span className="text-slate-400 italic">No description entered</span>}
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Marketplace Platform Cards */}

          {/* 1. eBay Marketplace Card */}
          {selectedPlatforms.includes('ebay') && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <img src="/ebay.png" className="w-5 h-5 object-contain" alt="" />
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase">eBay Platform Configuration</h3>
                    <p className="text-[10px] text-slate-500">Full category hierarchy, item specifics, business policies & selling options</p>
                  </div>
                </div>
                <Badge variant="neutral">eBay</Badge>
              </div>

              <div className="space-y-4">
                {/* Category Full Path */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">eBay Category (Full Path) *</label>
                  <CategorySearchDropdown
                    value={formData.ebayCategory}
                    platform="ebay"
                    onSelect={(opt) => setFormData(prev => ({ ...prev, ebayCategory: opt.label, ebayCategoryId: opt.id }))}
                    placeholder="Search eBay category..."
                  />
                </div>

                {/* Format, Price, Your Cost */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Format</label>
                    <select
                      value={formData.ebayFormat}
                      onChange={(e) => setFormData(prev => ({ ...prev, ebayFormat: e.target.value }))}
                      className="w-full px-2.5 h-10 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-slate-800"
                    >
                      <option value="Buy It Now">Buy It Now</option>
                      <option value="Auction">Auction</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">eBay Price ($) (Optional override)</label>
                    <input 
                      type="number"
                      step="0.01"
                      placeholder={formData.price ? `${formData.price} (Default)` : '0.00'}
                      value={formData.ebayPrice}
                      onChange={(e) => setFormData(prev => ({ ...prev, ebayPrice: e.target.value }))}
                      className="w-full px-3 h-10 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-slate-800"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-slate-700">Your Cost ($)</label>
                      <span className="text-[9px] text-slate-400 font-normal">Optional</span>
                    </div>
                    <input 
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.ebayYourCost}
                      onChange={(e) => setFormData(prev => ({ ...prev, ebayYourCost: e.target.value }))}
                      className="w-full px-3 h-10 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-slate-800"
                    />
                  </div>
                </div>

                {/* eBay Aspects Grid */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700">eBay Item Specifics (Aspects)</label>
                      <p className="text-[10px] text-slate-500">
                        {ebayAspects.length > 0 
                          ? `Showing all ${ebayAspects.length} item specifics for category` 
                          : 'All standard item specifics (select category above to load category specifics)'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddAspect(!showAddAspect)}
                      className="text-xs font-bold text-slate-700 hover:text-slate-900 underline flex items-center gap-1"
                    >
                      <Plus size={12} /> Add Specific
                    </button>
                  </div>

                  {showAddAspect && (
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex gap-2">
                      <input 
                        placeholder="Specific Name" 
                        value={newAspectName} 
                        onChange={(e) => setNewAspectName(e.target.value)} 
                        className="flex-1 px-2.5 h-8 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                      <input 
                        placeholder="Value" 
                        value={newAspectValue} 
                        onChange={(e) => setNewAspectValue(e.target.value)} 
                        className="flex-1 px-2.5 h-8 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                      <Button type="button" size="sm" variant="primary" onClick={handleAddCustomAspect}>Add</Button>
                      <button type="button" onClick={() => setShowAddAspect(false)} className="p-1 text-slate-400"><X size={14} /></button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-96 overflow-y-auto pr-1">
                    {ebayAspects.length > 0 ? (
                      ebayAspects.map((aspect) => {
                        const aspectName = aspect.localizedAspectName || aspect.aspectConstraint?.aspectName || aspect.name;
                        const currentVal = formData.ebayAspects[aspectName]?.[0] || formData.ebayAspects[aspectName] || '';
                        const isRequired = aspect.aspectConstraint?.aspectRequired || false;
                        const hasValues = aspect.aspectValues && aspect.aspectValues.length > 0;
                        const listId = `master-ebay-aspect-${aspectName.replace(/[^a-zA-Z0-9]/g, '_')}`;

                        return (
                          <div key={aspectName} className="space-y-0.5">
                            <label className="block text-[10px] font-bold text-slate-600 truncate" title={aspectName}>
                              {aspectName} {isRequired && <span className="text-rose-500">*</span>}
                            </label>
                            <input 
                              type="text"
                              list={hasValues ? listId : undefined}
                              className="w-full px-2.5 h-8 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-slate-800"
                              value={currentVal}
                              onChange={(e) => handleAspectChange(aspectName, e.target.value)}
                              placeholder={`Enter ${aspectName}...`}
                            />
                            {hasValues && (
                              <datalist id={listId}>
                                {aspect.aspectValues.map((v, i) => (
                                  <option key={i} value={v.localizedValue || v.value || v} />
                                ))}
                              </datalist>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      DEFAULT_COMMON_ASPECTS.map((name) => {
                        const currentVal = formData.ebayAspects[name]?.[0] || formData.ebayAspects[name] || '';
                        return (
                          <div key={name} className="space-y-0.5">
                            <label className="block text-[10px] font-bold text-slate-600 truncate">{name}</label>
                            <input 
                              type="text"
                              className="w-full px-2.5 h-8 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-slate-800"
                              value={currentVal}
                              onChange={(e) => handleAspectChange(name, e.target.value)}
                              placeholder={`Enter ${name}...`}
                            />
                          </div>
                        );
                      })
                    )}

                    {/* Custom user-added aspects */}
                    {Object.keys(formData.ebayAspects || {})
                      .filter(k => 
                        (ebayAspects.length > 0 
                          ? !ebayAspects.some(a => (a.localizedAspectName || a.name) === k)
                          : !DEFAULT_COMMON_ASPECTS.includes(k)
                        )
                      )
                      .map((k) => (
                        <div key={k} className="space-y-0.5 relative group">
                          <div className="flex items-center justify-between">
                            <label className="block text-[10px] font-bold text-slate-600 truncate">{k}</label>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = { ...formData.ebayAspects };
                                delete updated[k];
                                setFormData(prev => ({ ...prev, ebayAspects: updated }));
                              }}
                              className="text-rose-500 hover:text-rose-700 text-[9px]"
                            >
                              Remove
                            </button>
                          </div>
                          <input 
                            type="text"
                            className="w-full px-2.5 h-8 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-slate-800"
                            value={formData.ebayAspects[k]?.[0] || formData.ebayAspects[k] || ''}
                            onChange={(e) => handleAspectChange(k, e.target.value)}
                          />
                        </div>
                      ))}
                  </div>
                </div>

                {/* PRICING & SELLING OPTIONS */}
                <div className="pt-2 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <DollarSign size={14} className="text-slate-700" /> Pricing & Selling Options
                    </span>
                  </div>

                  {/* Payment Policy */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Payment Policy *</label>
                    <SearchableDropdown 
                      value={ebayPolicies.payment?.find(p => p.paymentPolicyId === formData.paymentPolicyId)?.name || 'Default Payment'}
                      options={(ebayPolicies.payment || []).map(p => ({ id: p.paymentPolicyId, label: p.name }))}
                      onSelect={(opt) => setFormData(prev => ({ ...prev, paymentPolicyId: opt.id }))}
                      placeholder="Select payment policy..."
                    />
                  </div>

                  {/* Sold Listings Insights Card */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800">
                      <TrendingUp size={14} className="text-emerald-600" /> Sold in last 90 days
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Recommended</span>
                        <span className="text-xs font-bold text-slate-900">${formData.ebayPrice || formData.price || '35.99'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Free shipping</span>
                        <span className="text-xs font-bold text-emerald-600">86%</span>
                      </div>
                    </div>
                  </div>

                  {/* Allow Offers Toggle */}
                  <div className="p-3 border border-slate-200 rounded-xl space-y-2 bg-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-800">Allow offers (optional)</span>
                        <p className="text-[10px] text-slate-500">Interested buyers can send an offer. You can accept, counter, or decline.</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input 
                          type="checkbox"
                          checked={formData.ebayAllowOffers}
                          onChange={(e) => setFormData(prev => ({ ...prev, ebayAllowOffers: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-slate-900"></div>
                      </label>
                    </div>

                    {formData.ebayAllowOffers && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-1">Auto-decline offers below ($)</label>
                          <input 
                            type="number"
                            step="0.01"
                            value={formData.ebayMinOfferPrice}
                            onChange={(e) => setFormData(prev => ({ ...prev, ebayMinOfferPrice: e.target.value }))}
                            placeholder="0.00"
                            className="w-full px-2.5 h-8 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-1">Auto-accept offers at or above ($)</label>
                          <input 
                            type="number"
                            step="0.01"
                            value={formData.ebayAutoAcceptPrice}
                            onChange={(e) => setFormData(prev => ({ ...prev, ebayAutoAcceptPrice: e.target.value }))}
                            placeholder="0.00"
                            className="w-full px-2.5 h-8 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-slate-800"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Volume Pricing Toggle */}
                  <div className="p-3 border border-slate-200 rounded-xl space-y-2 bg-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-800">Add volume pricing</span>
                        <p className="text-[10px] text-slate-500">Offer a discount when buyers purchase more than one item.</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input 
                          type="checkbox"
                          checked={formData.ebayVolumePricingEnabled}
                          onChange={(e) => setFormData(prev => ({ ...prev, ebayVolumePricingEnabled: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-slate-900"></div>
                      </label>
                    </div>

                    {formData.ebayVolumePricingEnabled && (
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-1">Buy 2</label>
                          <div className="relative">
                            <input 
                              type="number"
                              min="1"
                              max="99"
                              value={formData.ebayVolumePricingTier2}
                              onChange={(e) => setFormData(prev => ({ ...prev, ebayVolumePricingTier2: e.target.value }))}
                              className="w-full px-2 pr-6 h-8 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-slate-800"
                            />
                            <span className="absolute right-2 top-2 text-[10px] text-slate-400 font-bold">%</span>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-1">Buy 3</label>
                          <div className="relative">
                            <input 
                              type="number"
                              min="1"
                              max="99"
                              value={formData.ebayVolumePricingTier3}
                              onChange={(e) => setFormData(prev => ({ ...prev, ebayVolumePricingTier3: e.target.value }))}
                              className="w-full px-2 pr-6 h-8 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-slate-800"
                            />
                            <span className="absolute right-2 top-2 text-[10px] text-slate-400 font-bold">%</span>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-1">Buy 4+</label>
                          <div className="relative">
                            <input 
                              type="number"
                              min="1"
                              max="99"
                              value={formData.ebayVolumePricingTier4}
                              onChange={(e) => setFormData(prev => ({ ...prev, ebayVolumePricingTier4: e.target.value }))}
                              className="w-full px-2 pr-6 h-8 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-slate-800"
                            />
                            <span className="absolute right-2 top-2 text-[10px] text-slate-400 font-bold">%</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Schedule Listing Toggle */}
                  <div className="p-3 border border-slate-200 rounded-xl space-y-2 bg-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-800">Schedule listing</span>
                        <p className="text-[10px] text-slate-500">Go live at a selected date and time.</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input 
                          type="checkbox"
                          checked={formData.ebayScheduleListing}
                          onChange={(e) => setFormData(prev => ({ ...prev, ebayScheduleListing: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-slate-900"></div>
                      </label>
                    </div>

                    {formData.ebayScheduleListing && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-1">Date</label>
                          <input 
                            type="date"
                            value={formData.ebayScheduleDate}
                            onChange={(e) => setFormData(prev => ({ ...prev, ebayScheduleDate: e.target.value }))}
                            className="w-full px-2 h-8 bg-white border border-slate-200 rounded-lg text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-1">Time</label>
                          <input 
                            type="time"
                            value={formData.ebayScheduleTime}
                            onChange={(e) => setFormData(prev => ({ ...prev, ebayScheduleTime: e.target.value }))}
                            className="w-full px-2 h-8 bg-white border border-slate-200 rounded-lg text-xs"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* SHIPPING & PACKAGE */}
                <div className="pt-2 border-t border-slate-100 space-y-3">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Package size={14} className="text-slate-700" /> Shipping & Packaging
                  </span>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Shipping / Fulfillment Policy *</label>
                    <SearchableDropdown
                      value={ebayPolicies.fulfillment?.find(p => p.fulfillmentPolicyId === formData.fulfillmentPolicyId)?.name || 'Default Shipping'}
                      options={(ebayPolicies.fulfillment || []).map(p => ({ id: p.fulfillmentPolicyId, label: p.name }))}
                      onSelect={(opt) => setFormData(prev => ({ ...prev, fulfillmentPolicyId: opt.id }))}
                      placeholder="Select shipping policy..."
                    />
                  </div>

                  {/* Irregular Package Checkbox */}
                  <div>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={formData.ebayIrregularPackage}
                        onChange={(e) => setFormData(prev => ({ ...prev, ebayIrregularPackage: e.target.checked }))}
                        className="rounded border-slate-300 text-slate-900 focus:ring-0 mt-0.5"
                      />
                      <div className="text-xs">
                        <span className="font-bold text-slate-800">Irregular package</span>
                        <p className="text-[10px] text-slate-500">Carriers may charge extra for non-standard packages.</p>
                      </div>
                    </label>
                  </div>

                  {/* UK Site Checkbox */}
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={formData.ebayDisplayUkSite}
                        onChange={(e) => setFormData(prev => ({ ...prev, ebayDisplayUkSite: e.target.checked }))}
                        className="rounded border-slate-300 text-slate-900 focus:ring-0"
                      />
                      <span className="text-xs font-semibold text-slate-800">
                        Display listing on eBay UK site (<span className="text-slate-500 font-normal">fees apply</span>)
                      </span>
                    </label>
                  </div>
                </div>

                {/* ITEM ORIGIN */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Globe size={14} className="text-slate-700" /> Item Origin & Location
                  </span>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Country of Origin</label>
                    <SearchableDropdown 
                      value={formData.ebayCountryOfOrigin}
                      options={COUNTRIES_LIST}
                      onSelect={(opt) => setFormData(prev => ({ ...prev, ebayCountryOfOrigin: opt.label || opt.name }))}
                      placeholder="Select country..."
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Location ZIP</label>
                      <input 
                        type="text"
                        value={formData.ebayItemLocationZip}
                        onChange={(e) => setFormData(prev => ({ ...prev, ebayItemLocationZip: e.target.value }))}
                        placeholder="23294"
                        className="w-full px-2.5 h-8 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">City, State, Country</label>
                      <input 
                        type="text"
                        value={formData.ebayItemLocationCity}
                        onChange={(e) => setFormData(prev => ({ ...prev, ebayItemLocationCity: e.target.value }))}
                        placeholder="Henrico, VA, USA"
                        className="w-full px-2.5 h-8 bg-white border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-slate-800"
                      />
                    </div>
                  </div>
                </div>

                {/* RETURN SETTINGS */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-slate-700" /> Return Policy
                  </span>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Return Policy *</label>
                    <SearchableDropdown 
                      value={ebayPolicies.returns?.find(p => p.returnPolicyId === formData.returnPolicyId)?.name || 'Default Returns'}
                      options={(ebayPolicies.returns || []).map(p => ({ id: p.returnPolicyId, label: p.name }))}
                      onSelect={(opt) => setFormData(prev => ({ ...prev, returnPolicyId: opt.id }))}
                      placeholder="Select return policy..."
                    />
                  </div>
                </div>

                {/* ITEM DISCLOSURES */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800">Product documents</span>
                      <p className="text-[10px] text-slate-500">Upload user guides, certificates, manuals, etc.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input 
                        type="checkbox"
                        checked={formData.ebayProductDocumentsEnabled}
                        onChange={(e) => setFormData(prev => ({ ...prev, ebayProductDocumentsEnabled: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-slate-900"></div>
                    </label>
                  </div>

                  {formData.ebayProductDocumentsEnabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">Doc Type</label>
                        <SearchableDropdown 
                          value={formData.ebayProductDocType}
                          options={PRODUCT_DOC_TYPES}
                          onSelect={(opt) => setFormData(prev => ({ ...prev, ebayProductDocType: opt.label || opt.name }))}
                          placeholder="Select doc type..."
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">File / URL</label>
                        <input 
                          type="text"
                          value={formData.ebayProductDocUrl}
                          onChange={(e) => setFormData(prev => ({ ...prev, ebayProductDocUrl: e.target.value }))}
                          placeholder="Document link / id"
                          className="w-full px-2.5 h-8 bg-white border border-slate-200 rounded-lg text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* PROMOTE YOUR LISTING */}
                <div className="pt-2 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Promote Your Listing (Sponsored)</span>
                    <span className="text-[10px] text-blue-600 font-bold">66% promoted in category</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* General */}
                    <div className={`p-3 rounded-xl border ${formData.ebayPromotedGeneral ? 'border-slate-900 bg-slate-50/50' : 'border-slate-200 bg-white'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-900">General (+90% view)</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox"
                            checked={formData.ebayPromotedGeneral}
                            onChange={(e) => setFormData(prev => ({ ...prev, ebayPromotedGeneral: e.target.checked }))}
                            className="sr-only peer"
                          />
                          <div className="w-7 h-3.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-slate-900"></div>
                        </label>
                      </div>
                      <p className="text-[10px] text-slate-500 mb-2">Pay only when item sells</p>
                      {formData.ebayPromotedGeneral && (
                        <div className="relative">
                          <input 
                            type="number"
                            step="0.1"
                            value={formData.ebayPromotedGeneralRate}
                            onChange={(e) => setFormData(prev => ({ ...prev, ebayPromotedGeneralRate: e.target.value }))}
                            className="w-full px-2 pr-6 h-7 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                          />
                          <span className="absolute right-2 top-1.5 text-[10px] text-slate-400 font-bold">%</span>
                        </div>
                      )}
                    </div>

                    {/* Priority */}
                    <div className={`p-3 rounded-xl border ${formData.ebayPromotedPriority ? 'border-slate-900 bg-slate-50/50' : 'border-slate-200 bg-white'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-900">Priority (+170% view)</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox"
                            checked={formData.ebayPromotedPriority}
                            onChange={(e) => setFormData(prev => ({ ...prev, ebayPromotedPriority: e.target.checked }))}
                            className="sr-only peer"
                          />
                          <div className="w-7 h-3.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-slate-900"></div>
                        </label>
                      </div>
                      <p className="text-[10px] text-slate-500 mb-2">Pay per click (CPC)</p>
                      {formData.ebayPromotedPriority && (
                        <div className="relative">
                          <span className="absolute left-2 top-1.5 text-[10px] text-slate-400 font-bold">$</span>
                          <input 
                            type="number"
                            step="0.01"
                            value={formData.ebayPromotedPriorityBid}
                            onChange={(e) => setFormData(prev => ({ ...prev, ebayPromotedPriorityBid: e.target.value }))}
                            className="w-full pl-5 pr-2 h-7 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* CHARITY */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Heart size={14} className="text-rose-500" />
                      <span className="text-xs font-bold text-slate-800">Donate to charity</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input 
                        type="checkbox"
                        checked={formData.ebayCharityEnabled}
                        onChange={(e) => setFormData(prev => ({ ...prev, ebayCharityEnabled: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-slate-900"></div>
                    </label>
                  </div>

                  {formData.ebayCharityEnabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">Percentage</label>
                        <select
                          value={formData.ebayCharityPercentage}
                          onChange={(e) => setFormData(prev => ({ ...prev, ebayCharityPercentage: e.target.value }))}
                          className="w-full px-2.5 h-8 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none"
                        >
                          <option value="10">10% of sale</option>
                          <option value="15">15% of sale</option>
                          <option value="20">20% of sale</option>
                          <option value="25">25% of sale</option>
                          <option value="50">50% of sale</option>
                          <option value="100">100% of sale</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">Organization</label>
                        <SearchableDropdown 
                          value={formData.ebayCharityOrg}
                          options={CHARITY_ORGS}
                          onSelect={(opt) => setFormData(prev => ({ ...prev, ebayCharityOrg: opt.label || opt.name }))}
                          placeholder="Select charity..."
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 2. Poshmark Marketplace Card */}
          {selectedPlatforms.includes('poshmark') && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <img src="/poshmark.png" className="w-5 h-5 object-contain" alt="" />
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase">Poshmark Platform Configuration</h3>
                    <p className="text-[10px] text-slate-500">Live category search, colors, style tags, brand & size dropdowns</p>
                  </div>
                </div>
                <Badge variant="neutral">Poshmark</Badge>
              </div>

              <div className="space-y-3">
                {/* Poshmark Category & Price */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Poshmark Category (Full Hierarchy) *</label>
                    <CategorySearchDropdown
                      value={formData.poshmarkCategory}
                      platform="poshmark"
                      onSelect={(opt) => setFormData(prev => {
                        const fullCategory = opt.fullName || opt.label || opt.name || '';
                        const dept = opt.department || opt.departmentId || fullCategory.split(' > ')[0] || prev.poshmarkDepartment || 'Women';
                        return { 
                          ...prev, 
                          poshmarkCategory: fullCategory,
                          poshmarkDepartment: dept
                        };
                      })}
                      placeholder="Search Poshmark category hierarchy (e.g. Women > Tops > Blouses)..."
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Poshmark Price ($)</label>
                    <input 
                      type="number"
                      step="0.01"
                      placeholder={formData.price ? `${formData.price} (Default)` : '0.00'}
                      value={formData.poshmarkPrice}
                      onChange={(e) => setFormData(prev => ({ ...prev, poshmarkPrice: e.target.value }))}
                      className="w-full px-3 h-10 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-slate-800"
                    />
                  </div>
                </div>

                {/* Brand, Size & Shipping Discount */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Brand</label>
                    <PoshmarkBrandDropdown
                      value={formData.brand}
                      onChange={(b) => setFormData(prev => ({ ...prev, brand: b }))}
                      placeholder="Search or enter brand..."
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Size</label>
                    <PoshmarkSizeDropdown
                      value={formData.poshmarkSize || formData.size}
                      department={formData.poshmarkDepartment}
                      onChange={(s) => setFormData(prev => ({ ...prev, poshmarkSize: s }))}
                      placeholder="Select size..."
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Shipping Discount</label>
                    <SearchableDropdown
                      value={POSHMARK_SHIPPING_DISCOUNTS.find(d => d.id === formData.poshmarkShippingDiscount)?.label || 'No discount'}
                      options={POSHMARK_SHIPPING_DISCOUNTS}
                      onSelect={(opt) => setFormData(prev => ({ ...prev, poshmarkShippingDiscount: opt.id }))}
                      placeholder="Select discount..."
                    />
                  </div>
                </div>

                {/* Colors (Max 2) */}
                <div className="pt-2 border-t border-slate-100">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Colors (Max 2)</label>
                  <ColorMultiSelectDropdown
                    value={formData.poshmarkColors}
                    onChange={(cols) => setFormData(prev => ({ ...prev, poshmarkColors: cols }))}
                  />
                </div>

                {/* Style Tags (Max 3) */}
                <div className="pt-2 border-t border-slate-100">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Style Tags (Max 3)</label>
                  <StyleTagMultiSelectDropdown
                    value={formData.poshmarkStyleTags}
                    onChange={(tags) => setFormData(prev => ({ ...prev, poshmarkStyleTags: tags }))}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 3. Mercari Marketplace Card WITH FULL SHIPPING MATRIX */}
          {selectedPlatforms.includes('mercari') && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <img src="/mercari.png" className="w-5 h-5 object-contain" alt="" />
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase">Mercari Platform Configuration</h3>
                    <p className="text-[10px] text-slate-500">Category taxonomy, brand autocomplete, condition & full shipping matrix</p>
                  </div>
                </div>
                <Badge variant="neutral">Mercari</Badge>
              </div>

              <div className="space-y-4">
                {/* Category Full Path */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Mercari Category (Full Hierarchy) *</label>
                  <CategorySearchDropdown
                    value={formData.mercariCategory}
                    platform="mercari"
                    onSelect={(opt) => setFormData(prev => ({ 
                      ...prev, 
                      mercariCategory: opt.fullName || opt.label || opt.name, 
                      mercariCategoryId: String(opt.id || opt.categoryId || '') 
                    }))}
                    placeholder="Search Mercari category hierarchy (e.g. Men > Athletic apparel > Athletic T-Shirts)..."
                  />
                </div>

                {/* Brand, Condition, Size & Price */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Mercari Brand</label>
                    <MercariBrandDropdown
                      value={formData.mercariBrand || formData.brand}
                      onChange={(bName, bId) => setFormData(prev => ({ ...prev, mercariBrand: bName, mercariBrandId: bId }))}
                      placeholder="e.g. Nike, Adidas..."
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Condition</label>
                    <SearchableDropdown
                      value={MERCARI_CONDITIONS.find(c => c.id === formData.mercariCondition)?.label || 'Good'}
                      options={MERCARI_CONDITIONS}
                      onSelect={(opt) => setFormData(prev => ({ ...prev, mercariCondition: opt.id }))}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Size</label>
                    {mercariActiveSizes.length > 0 ? (
                      <SearchableDropdown 
                        value={mercariActiveSizes.find(s => String(s.id) === String(formData.mercariSizeId) || s.name === formData.mercariSize)?.name || formData.mercariSize}
                        onSelect={(opt) => setFormData(prev => ({ ...prev, mercariSize: opt.label || opt.name, mercariSizeId: String(opt.id || '') }))}
                        options={mercariActiveSizes.map(s => ({ id: s.id, label: s.name }))}
                        placeholder="Select size..."
                      />
                    ) : (
                      <input 
                        type="text"
                        className="w-full px-3 h-10 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-slate-800"
                        value={formData.mercariSize || formData.size}
                        onChange={(e) => setFormData(prev => ({ ...prev, mercariSize: e.target.value }))}
                        placeholder="Size..."
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Mercari Price ($)</label>
                    <input 
                      type="number"
                      step="0.01"
                      placeholder={formData.price ? `${formData.price} (Default)` : '0.00'}
                      value={formData.mercariPrice}
                      onChange={(e) => setFormData(prev => ({ ...prev, mercariPrice: e.target.value }))}
                      className="w-full px-3 h-10 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-slate-800"
                    />
                  </div>
                </div>

                {/* Mercari Shipping Matrix */}
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <div className="flex items-center gap-2">
                    <Truck size={14} className="text-slate-700" />
                    <label className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                      Mercari Shipping & Dynamic Carrier Rates
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className={`p-3 rounded-xl border cursor-pointer flex items-center gap-2.5 transition-all ${
                      formData.mercariShippingPayer === 'buyer' ? 'bg-slate-50 border-slate-900 ring-1 ring-slate-900' : 'bg-white border-slate-200'
                    }`}>
                      <input 
                        type="radio" 
                        name="mShippingPayer" 
                        checked={formData.mercariShippingPayer === 'buyer'}
                        onChange={() => setFormData(prev => ({ ...prev, mercariShippingPayer: 'buyer', mercariShippingMethod: 'prepaid' }))}
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-900">Buyer pays</div>
                        <div className="text-[10px] text-slate-500">Mercari prepaid label added at checkout</div>
                      </div>
                    </label>

                    <label className={`p-3 rounded-xl border cursor-pointer flex items-center gap-2.5 transition-all ${
                      formData.mercariShippingPayer === 'seller' ? 'bg-slate-50 border-slate-900 ring-1 ring-slate-900' : 'bg-white border-slate-200'
                    }`}>
                      <input 
                        type="radio" 
                        name="mShippingPayer" 
                        checked={formData.mercariShippingPayer === 'seller'}
                        onChange={() => setFormData(prev => ({ ...prev, mercariShippingPayer: 'seller' }))}
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-900">I'll pay (Free shipping)</div>
                        <div className="text-[10px] text-slate-500">Deducted from your net earnings</div>
                      </div>
                    </label>
                  </div>

                  {/* Weight & Standard Shoebox */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Package Weight</label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="relative">
                          <input 
                            type="number"
                            min="0"
                            className="w-full px-3 pr-7 h-9 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-slate-800"
                            value={formData.mercariShippingWeightLbs}
                            onChange={(e) => setFormData(prev => ({ ...prev, mercariShippingWeightLbs: Math.max(0, parseInt(e.target.value) || 0) }))}
                          />
                          <span className="absolute right-2 top-2 text-[10px] text-slate-400">lbs</span>
                        </div>
                        <div className="relative">
                          <input 
                            type="number"
                            min="0"
                            max="15"
                            className="w-full px-3 pr-7 h-9 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-slate-800"
                            value={formData.mercariShippingWeightOz}
                            onChange={(e) => setFormData(prev => ({ ...prev, mercariShippingWeightOz: Math.max(0, parseInt(e.target.value) || 0) }))}
                          />
                          <span className="absolute right-2 top-2 text-[10px] text-slate-400">oz</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Package Box</label>
                      <label className="flex items-center gap-2 h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer">
                        <input 
                          type="checkbox"
                          checked={formData.mercariShippingFitsShoebox}
                          onChange={(e) => setFormData(prev => ({ ...prev, mercariShippingFitsShoebox: e.target.checked }))}
                          className="rounded text-slate-900"
                        />
                        <span className="text-xs font-semibold text-slate-700">Fits shoe box (14x10x5)</span>
                      </label>
                    </div>
                  </div>

                  {/* Dynamic Carrier Cards */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-600 uppercase">Selected Carrier Rate</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {mercariCarrierOptions.map((opt) => {
                        const isSelected = formData.mercariShippingCarrier === opt.carrier;
                        return (
                          <div 
                            key={opt.carrier}
                            onClick={() => setFormData(prev => ({ ...prev, mercariShippingCarrier: opt.carrier, mercariShippingPrice: opt.price }))}
                            className={`p-2.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                              isSelected ? 'bg-slate-50 border-slate-900 ring-1 ring-slate-900' : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-900 truncate">{opt.carrier}</span>
                              {isSelected && <Check size={12} className="text-slate-900" />}
                            </div>
                            <div className="flex items-end justify-between mt-1">
                              <span className="text-[9px] text-slate-400">Up to {opt.weightText}</span>
                              <span className="text-xs font-extrabold text-slate-900">${opt.price}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. Etsy Marketplace Card */}
          {selectedPlatforms.includes('etsy') && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <img src="/etsy.png" className="w-5 h-5 object-contain" alt="" />
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase">Etsy Platform Configuration</h3>
                    <p className="text-[10px] text-slate-500">Taxonomy category, materials, tags & shipping profiles</p>
                  </div>
                </div>
                <Badge variant="neutral">Etsy</Badge>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Etsy Taxonomy Category</label>
                  <CategorySearchDropdown
                    value={formData.etsyCategory}
                    platform="etsy"
                    onSelect={(opt) => setFormData(prev => ({ ...prev, etsyCategory: opt.label || opt.name, etsyCategoryId: opt.id }))}
                    placeholder="Search Etsy category..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Etsy Price ($)</label>
                    <input 
                      type="number"
                      step="0.01"
                      placeholder={formData.price ? `${formData.price} (Default)` : '0.00'}
                      value={formData.etsyPrice}
                      onChange={(e) => setFormData(prev => ({ ...prev, etsyPrice: e.target.value }))}
                      className="w-full px-3 h-10 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Shipping Profile</label>
                    <SearchableDropdown
                      value={shippingProfiles.find(p => String(p.shipping_profile_id || p.id) === String(formData.shipping_profile_id))?.title || ''}
                      options={shippingProfiles.map(p => ({ id: String(p.shipping_profile_id || p.id), label: p.title || p.name }))}
                      onSelect={(opt) => setFormData(prev => ({ ...prev, shipping_profile_id: String(opt.id) }))}
                      placeholder="Select Etsy shipping profile..."
                    />
                  </div>
                </div>

                {/* Materials & Tags */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-600 uppercase">Tags (Max 13)</label>
                    <div className="flex flex-wrap gap-1">
                      {(formData.etsyTags || []).map(t => (
                        <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded text-[11px] font-semibold">
                          #{t}
                          <button type="button" onClick={() => removeEtsyTag(t)} className="hover:text-rose-500"><X size={10} /></button>
                        </span>
                      ))}
                      {(formData.etsyTags || []).length < 13 && (
                        <input 
                          type="text"
                          placeholder="+ Tag"
                          value={etsyTagInput}
                          onChange={(e) => setEtsyTagInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEtsyTag(etsyTagInput); } }}
                          className="px-2 py-0.5 bg-white border border-slate-200 rounded text-xs outline-none w-20"
                        />
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-600 uppercase">Materials (Max 13)</label>
                    <div className="flex flex-wrap gap-1">
                      {(formData.etsyMaterials || []).map(m => (
                        <span key={m} className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded text-[11px] font-semibold">
                          {m}
                          <button type="button" onClick={() => removeEtsyMaterial(m)} className="hover:text-rose-500"><X size={10} /></button>
                        </span>
                      ))}
                      {(formData.etsyMaterials || []).length < 13 && (
                        <input 
                          type="text"
                          placeholder="+ Material"
                          value={etsyMaterialInput}
                          onChange={(e) => setEtsyMaterialInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEtsyMaterial(etsyMaterialInput); } }}
                          className="px-2 py-0.5 bg-white border border-slate-200 rounded text-xs outline-none w-24"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 5. Amazon Marketplace Card */}
          {selectedPlatforms.includes('amazon') && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <img src="/amazon.png" className="w-5 h-5 object-contain" alt="" />
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase">Amazon Platform Configuration</h3>
                    <p className="text-[10px] text-slate-500">Product type, product ID & bullet points</p>
                  </div>
                </div>
                <Badge variant="neutral">Amazon</Badge>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Product Type</label>
                    <SearchableDropdown
                      value={AMAZON_PRODUCT_TYPES.find(p => p.id === formData.amazonProductType)?.name || formData.amazonProductType}
                      options={AMAZON_PRODUCT_TYPES}
                      onSelect={(opt) => setFormData(prev => ({ ...prev, amazonProductType: opt.id }))}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Amazon Price ($)</label>
                    <input 
                      type="number"
                      step="0.01"
                      placeholder={formData.price ? `${formData.price} (Default)` : '0.00'}
                      value={formData.amazonPrice}
                      onChange={(e) => setFormData(prev => ({ ...prev, amazonPrice: e.target.value }))}
                      className="w-full px-3 h-10 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-slate-800"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <label className="block text-[11px] font-bold text-slate-700">Amazon Bullet Points</label>
                  <div className="space-y-1.5">
                    {formData.amazonBulletPoints.map((bullet, idx) => (
                      <input
                        key={idx}
                        type="text"
                        value={bullet}
                        onChange={(e) => {
                          const updated = [...formData.amazonBulletPoints];
                          updated[idx] = e.target.value;
                          setFormData(prev => ({ ...prev, amazonBulletPoints: updated }));
                        }}
                        placeholder={`Feature bullet ${idx + 1}...`}
                        className="w-full px-3 h-8 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-slate-800"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={handleSaveDraft}
              disabled={loading || publishing}
            >
              Save Draft
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handlePublishOrUpdateAll}
              loading={publishing}
              icon={<ShoppingBag size={14} />}
            >
              {isEditMode ? 'Update All Platforms' : `List on ${selectedPlatforms.length} Platforms`}
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default CreateMasterListing;
