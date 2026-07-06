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
  Code,
  Trash2,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';
import { ruleService, aiService, listingService } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { VINTED_CONDITIONS } from '../constants/vintedConditions';
import { compressImage } from '../utils/imageCompressor';
import { VINTED_MATERIALS } from '../constants/vintedMaterials';

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

const BrandSearchDropdown = ({ value, onSelect, options = [], placeholder = 'Search or enter brand...', loading = false }) => {
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

  useEffect(() => {
    setSearchTerm(value || '');
  }, [value]);

  const filteredOptions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return options;
    return options.filter(opt => {
      const label = typeof opt === 'string' ? opt : (opt?.label || opt?.title || opt?.name || '');
      return label.toLowerCase().includes(q);
    });
  }, [searchTerm, options]);

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div className="relative">
        <input 
          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-semibold outline-none focus:border-indigo-500 transition-all shadow-sm h-12"
          value={isOpen ? searchTerm : (value || '')}
          onChange={(e) => {
            const val = e.target.value;
            setSearchTerm(val);
            onSelect(val);
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
            if (!isOpen) setSearchTerm(value || '');
          }}
        />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[500] max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
          {loading && (
            <div className="p-4 text-xs font-semibold text-slate-400 text-center">Loading brands...</div>
          )}
          {!loading && filteredOptions.length === 0 && (
            <div 
              className="w-full text-left px-4 py-3 border-b border-slate-50 last:border-b-0 hover:bg-indigo-50 hover:text-indigo-600 transition-colors cursor-pointer text-xs font-bold text-slate-500"
              onClick={() => {
                onSelect(searchTerm);
                setIsOpen(false);
              }}
            >
              Use custom brand: "{searchTerm}"
            </div>
          )}
          {!loading && filteredOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                onSelect(opt.label);
                setIsOpen(false);
                setSearchTerm(opt.label);
              }}
              className="w-full text-left px-4 py-3 border-b border-slate-50 last:border-b-0 hover:bg-indigo-600 hover:text-white transition-colors"
            >
              <span className="text-xs font-bold text-slate-700 hover:text-inherit">{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const ColorSearchDropdown = ({ value, onSelect, options = [], placeholder = 'Search or enter color...', loading = false }) => {
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

  useEffect(() => {
    setSearchTerm(value || '');
  }, [value]);

  const filteredOptions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return options;
    return options.filter(opt => {
      const label = typeof opt === 'string' ? opt : (opt?.label || opt?.title || opt?.name || '');
      return label.toLowerCase().includes(q);
    });
  }, [searchTerm, options]);

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div className="relative">
        <input 
          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-semibold outline-none focus:border-indigo-500 transition-all shadow-sm h-12"
          value={isOpen ? searchTerm : (value || '')}
          onChange={(e) => {
            const val = e.target.value;
            setSearchTerm(val);
            onSelect(val);
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
            if (!isOpen) setSearchTerm(value || '');
          }}
        />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[500] max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
          {loading && (
            <div className="p-4 text-xs font-semibold text-slate-400 text-center">Loading colors...</div>
          )}
          {!loading && filteredOptions.length === 0 && (
            <div 
              className="w-full text-left px-4 py-3 border-b border-slate-50 last:border-b-0 hover:bg-indigo-50 hover:text-indigo-600 transition-colors cursor-pointer text-xs font-bold text-slate-500"
              onClick={() => {
                onSelect(searchTerm);
                setIsOpen(false);
              }}
            >
              Use custom color: "{searchTerm}"
            </div>
          )}
          {!loading && filteredOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                onSelect(opt.label);
                setIsOpen(false);
                setSearchTerm(opt.label);
              }}
              className="w-full text-left px-4 py-3 border-b border-slate-50 last:border-b-0 hover:bg-indigo-600 hover:text-white transition-colors"
            >
              <span className="text-xs font-bold text-slate-700 hover:text-inherit">{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const SizeSearchDropdown = ({ value, onSelect, options = [], placeholder = 'Search or enter size...', loading = false }) => {
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

  useEffect(() => {
    setSearchTerm(value || '');
  }, [value]);

  const filteredOptions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return options;
    return options.filter(opt => {
      const label = typeof opt === 'string' ? opt : (opt?.label || opt?.title || opt?.name || '');
      return label.toLowerCase().includes(q);
    });
  }, [searchTerm, options]);

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div className="relative">
        <input 
          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-semibold outline-none focus:border-indigo-500 transition-all shadow-sm h-12"
          value={isOpen ? searchTerm : (value || '')}
          onChange={(e) => {
            const val = e.target.value;
            setSearchTerm(val);
            onSelect(val);
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
            if (!isOpen) setSearchTerm(value || '');
          }}
        />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[500] max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
          {loading && (
            <div className="p-4 text-xs font-semibold text-slate-400 text-center">Loading sizes...</div>
          )}
          {!loading && filteredOptions.length === 0 && (
            <div 
              className="w-full text-left px-4 py-3 border-b border-slate-50 last:border-b-0 hover:bg-indigo-50 hover:text-indigo-600 transition-colors cursor-pointer text-xs font-bold text-slate-500"
              onClick={() => {
                onSelect(searchTerm);
                setIsOpen(false);
              }}
            >
              Use custom size: "{searchTerm}"
            </div>
          )}
          {!loading && filteredOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                onSelect(opt.label);
                setIsOpen(false);
                setSearchTerm(opt.label);
              }}
              className="w-full text-left px-4 py-3 border-b border-slate-50 last:border-b-0 hover:bg-indigo-600 hover:text-white transition-colors"
            >
              <span className="text-xs font-bold text-slate-700 hover:text-inherit">{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const MaterialMultiSelectDropdown = ({ value, onChange, placeholder = 'Select materials (1-3)...' }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = React.useRef(null);
  const { toast } = useNotification();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = useMemo(() => {
    return value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
  }, [value]);

  const filteredOptions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return VINTED_MATERIALS;
    return VINTED_MATERIALS.filter(m => m.toLowerCase().includes(q));
  }, [searchTerm]);

  const handleSelect = (material) => {
    if (selected.includes(material)) {
      const updated = selected.filter(item => item !== material);
      onChange(updated.join(', '));
    } else {
      if (selected.length >= 3) {
        toast.warning("You can select a maximum of 3 materials.");
        return;
      }
      const updated = [...selected, material];
      onChange(updated.join(', '));
    }
  };

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full min-h-12 px-4 py-2 bg-white border border-slate-200 hover:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-500/10 focus-within:border-indigo-500 rounded-2xl text-left flex items-center justify-between text-sm font-bold text-slate-700 cursor-pointer transition-all"
      >
        <div className="flex flex-wrap gap-1.5 items-center flex-1 min-w-0 mr-2">
          {selected.length > 0 ? (
            selected.map((item) => (
              <span
                key={item}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 text-[11px] font-extrabold rounded-lg shadow-sm"
              >
                {item}
                <button
                  type="button"
                  onClick={() => handleSelect(item)}
                  className="p-0.5 hover:bg-indigo-100 rounded-md text-indigo-400 hover:text-indigo-700 transition-all cursor-pointer flex items-center justify-center"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))
          ) : (
            <span className="text-slate-400 font-semibold">{placeholder}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {selected.length > 0 && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
                setSearchTerm('');
              }}
              className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[500] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 font-sans">
          <div className="p-3 bg-slate-50 border-b border-slate-100">
            <div className="relative">
              <input
                autoFocus
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search materials..."
                className="w-full h-10 px-4 rounded-xl border border-slate-200 text-sm font-semibold outline-none focus:border-indigo-500"
              />
            </div>
          </div>
          
          <div className="max-h-60 overflow-y-auto">
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
                    className={`w-full text-left px-4 py-3 border-b border-slate-50 last:border-b-0 transition-colors flex items-center justify-between ${
                      isSelected 
                        ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' 
                        : isLimitReached 
                          ? 'opacity-40 cursor-not-allowed bg-slate-50 text-slate-400' 
                          : 'hover:bg-indigo-600 hover:text-white text-slate-700'
                    }`}
                  >
                    <span className="text-xs font-bold">{item}</span>
                    {isSelected && <Check className="w-4 h-4 text-indigo-600" />}
                  </button>
                );
              })
            ) : (
              <div className="p-4 text-xs text-slate-400 text-center font-medium">No materials found</div>
            )}
          </div>

          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-[10px] font-bold text-slate-400">
            <span>Limit: 1 - 3 materials</span>
            <span className={selected.length < 1 || selected.length > 3 ? 'text-rose-500 font-extrabold' : 'text-indigo-600 font-extrabold'}>
              {selected.length}/3 Selected
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

const CreateVintedListing = () => {
  const navigate = useNavigate();
  const { toast } = useNotification();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const platform = 'vinted';
  const [hasScanned, setHasScanned] = useState(editId ? true : false);
  const [loading, setLoading] = useState(false);
  const [descriptionMode, setDescriptionMode] = useState('preview'); // 'edit' or 'preview'
  const [rules, setRules] = useState([]);
  const [files, setFiles] = useState([]);
  const [categoryFields, setCategoryFields] = useState({
    brand_field_visibility: true,
    size_field_visibility: true,
    color_field_visibility: true,
    isbn_field_visibility: false,
    author_field_visibility: false,
    book_title_field_visibility: false,
    video_game_rating_field_visibility: false,
    measurements_field_visibility: false
  });
  const [categoryBrands, setCategoryBrands] = useState([]);
  const [fetchingBrands, setFetchingBrands] = useState(false);
  const [categorySizes, setCategorySizes] = useState([]);
  const [fetchingSizes, setFetchingSizes] = useState(false);
  const [vintedColors, setVintedColors] = useState([]);
  const [fetchingColors, setFetchingColors] = useState(false);
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
    isbn: '',
    author: '',
    bookTitle: '',
    material: '',
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
              isbn: listing.isbn || '',
              author: listing.author || '',
              bookTitle: listing.bookTitle || '',
              videoGameRating: listing.videoGameRating || '',
              measurements: listing.measurements || '',
              material: listing.material || '',
            });

            if (listing.category) {
              aiService.vintedGetCategoryDetails({ path: listing.category, id: listing.categoryId })
                .then(catRes => {
                  if (catRes.data.success && catRes.data.data) {
                    const cat = catRes.data.data;
                    setCategoryFields({
                      brand_field_visibility: cat.brand_field_visibility,
                      size_field_visibility: cat.size_field_visibility,
                      color_field_visibility: cat.color_field_visibility,
                      isbn_field_visibility: cat.isbn_field_visibility,
                      author_field_visibility: cat.author_field_visibility,
                      book_title_field_visibility: cat.book_title_field_visibility,
                      video_game_rating_field_visibility: cat.video_game_rating_field_visibility,
                      measurements_field_visibility: cat.measurements_field_visibility
                    });
                  }
                })
                .catch(err => {
                  console.error("Error fetching Vinted category details on edit:", err);
                });
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

  useEffect(() => {
    if (!formData.categoryId) {
      setCategoryBrands([]);
      return;
    }
    const fetchBrandsForCategory = async () => {
      setFetchingBrands(true);
      try {
        const response = await aiService.vintedGetCategoryBrands(formData.categoryId);
        if (response.data.success) {
          setCategoryBrands(response.data.data);
        }
      } catch (err) {
        console.error("Error fetching Vinted category brands:", err);
      } finally {
        setFetchingBrands(false);
      }
    };
    fetchBrandsForCategory();
  }, [formData.categoryId]);

  useEffect(() => {
    const fetchColors = async () => {
      setFetchingColors(true);
      try {
        const response = await aiService.vintedGetColors();
        if (response.data.success) {
          setVintedColors(response.data.data);
        }
      } catch (err) {
        console.error("Error fetching Vinted colors:", err);
      } finally {
        setFetchingColors(false);
      }
    };
    fetchColors();
  }, []);

  useEffect(() => {
    if (!formData.categoryId) {
      setCategorySizes([]);
      return;
    }
    const fetchSizesForCategory = async () => {
      setFetchingSizes(true);
      try {
        const response = await aiService.vintedGetCategorySizes(formData.categoryId);
        if (response.data.success) {
          setCategorySizes(response.data.data);
        }
      } catch (err) {
        console.error("Error fetching Vinted category sizes:", err);
      } finally {
        setFetchingSizes(false);
      }
    };
    fetchSizesForCategory();
  }, [formData.categoryId]);

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
        platform: 'vinted'
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
      const response = await aiService.vintedAnalyze({
        images: formData.images, 
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
          brand: result.brand || '',
          originalPrice: result.originalPrice || '',
          color: result.color || '',
          styleTag: '',
          quantity: 1,
          size: result.size || '',
          price: result.price,
          description: result.description,
          conditionNote: selectedRuleObj?.condition_note || '',
          category: result.category_name || result.category || '',
          categoryId: result.categoryId || '',
          sku: result.sku || '',
          isbn: result.isbn || '',
          author: result.author || '',
          bookTitle: result.bookTitle || '',
          videoGameRating: result.videoGameRating || '',
          measurements: result.measurements || '',
          material: result.material || ''
        }));
        if (result.categoryFields) {
          setCategoryFields({
            brand_field_visibility: result.categoryFields.brand_field_visibility,
            size_field_visibility: result.categoryFields.size_field_visibility,
            color_field_visibility: result.categoryFields.color_field_visibility,
            isbn_field_visibility: result.categoryFields.isbn_field_visibility,
            author_field_visibility: result.categoryFields.author_field_visibility,
            book_title_field_visibility: result.categoryFields.book_title_field_visibility,
            video_game_rating_field_visibility: result.categoryFields.video_game_rating_field_visibility,
            measurements_field_visibility: result.categoryFields.measurements_field_visibility
          });
        }
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

  const handleCategorySelect = (opt) => {
    setFormData(prev => ({
      ...prev,
      category: opt.fullName,
      categoryId: opt.id
    }));
    setCategoryFields({
      brand_field_visibility: opt.brand_field_visibility ?? false,
      size_field_visibility: opt.size_field_visibility ?? false,
      color_field_visibility: opt.color_field_visibility ?? false,
      isbn_field_visibility: opt.isbn_field_visibility ?? false,
      author_field_visibility: opt.author_field_visibility ?? false,
      book_title_field_visibility: opt.book_title_field_visibility ?? false,
      video_game_rating_field_visibility: opt.video_game_rating_field_visibility ?? false,
      measurements_field_visibility: opt.measurements_field_visibility ?? false
    });
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

  const handleSaveListing = async (publish = false) => {
    if (publish) {
      const isExtensionInstalled = document.body.dataset.elisterVintedExtensionInstalled === "true";
      if (!isExtensionInstalled) {
        toast.warning("Please install and reload the Elister Vinted Chrome Extension to list automatically!");
        return;
      }
    }

    setLoading(true);
    const selectedRuleObj = rules.find(r => (r._id || r.id) === formData.selectedRule);
    
    const listingData = {
      title: formData.title,
      brand: formData.brand,
      originalPrice: formData.originalPrice,
      color: formData.color,
      styleTag: '',
      quantity: 1,
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
      isbn: formData.isbn,
      author: formData.author,
      bookTitle: formData.bookTitle,
      videoGameRating: formData.videoGameRating,
      measurements: formData.measurements,
      material: formData.material,
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
        const savedListing = response.data.data;
        toast.success(editId ? 'Vinted Listing updated successfully!' : 'Vinted Listing saved successfully!');
        
        if (publish) {
          const plainDesc = savedListing.description 
            ? savedListing.description.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '') 
            : '';

          const token = localStorage.getItem('token');
          const backendUrl = import.meta.env.MODE === 'production'
            ? (import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : 'https://api.elister.ai/api')
            : 'http://localhost:5000/api';

          window.postMessage({
            action: 'ELISTER_VINTED_LIST_ITEM_TRIGGER',
            data: {
              listingId: savedListing._id,
              token,
              backendUrl,
              title: savedListing.title,
              description: plainDesc,
              brand: savedListing.brand || "",
              price: parseFloat(savedListing.price) || 0.0,
              originalPrice: parseFloat(savedListing.originalPrice) || 0.0,
              size: savedListing.size || "",
              color: savedListing.color || "",
              material: savedListing.material || "",
              conditionId: savedListing.conditionId || "very_good",
              categoryId: savedListing.categoryId || "1807",
              isbn: savedListing.isbn || "",
              author: savedListing.author || "",
              bookTitle: savedListing.bookTitle || "",
              videoGameRating: savedListing.videoGameRating || "",
              measurements: savedListing.measurements || "",
              images: savedListing.images || []
            }
          }, "*");

          toast.success("Opening Vinted and launching publisher queue...");
        }
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
      <div className="flex justify-between items-end border-b border-slate-100 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">
            {editId ? 'Edit Vinted Listing' : 'Create New Vinted Listing'}
          </h1>
          <p className="text-slate-500 text-xs font-semibold mt-1">
            Single Page AI-Powered Listing Creation
          </p>
        </div>
      </div>

      {/* Main Single Form Body */}
      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-8 relative">
        {/* SECTION 1: Product Images (Repositioned to the top!) */}
        <div className="space-y-4">
          <h3 className="text-xs font-black text-indigo-900 uppercase tracking-wider flex items-center">
            <ImageIcon size={16} className="mr-2 text-indigo-500" /> 1. Product Images
          </h3>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
            <label className="aspect-square bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 transition-all group">
              <Upload className="w-6 h-6 text-slate-400 group-hover:text-indigo-600 transition-colors" />
              <span className="text-[10px] font-bold text-slate-400 mt-2 uppercase">Add Photos</span>
              <input type="file" multiple className="hidden" onChange={handleImageUpload} />
            </label>
            {formData.images.map((img, i) => (
              <div key={i} className="aspect-square bg-slate-100 rounded-2xl relative group overflow-hidden border border-slate-100 shadow-sm">
                <img src={img} className="w-full h-full object-cover" alt="Product" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                   <button 
                    type="button"
                    onClick={() => {
                      setFormData({...formData, images: formData.images.filter((_, idx) => idx !== i)});
                      setFiles(files.filter((_, idx) => idx !== i));
                    }}
                    className="p-1.5 bg-red-655 rounded-lg text-white hover:bg-red-700"
                    title="Delete Image"
                   >
                    <Trash2 size={14} />
                   </button>
                   <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => moveImage(i, 'left')}
                    className="p-1.5 bg-white/20 hover:bg-white/40 text-white rounded-lg disabled:opacity-40"
                    title="Move Left"
                   >
                    <ArrowLeft size={14} />
                   </button>
                   <button
                    type="button"
                    disabled={i === formData.images.length - 1}
                    onClick={() => moveImage(i, 'right')}
                    className="p-1.5 bg-white/20 hover:bg-white/40 text-white rounded-lg disabled:opacity-40"
                    title="Move Right"
                   >
                    <ArrowRight size={14} />
                   </button>
                </div>
                {i === 0 && (
                  <span className="absolute top-2 left-2 px-2 py-0.5 bg-indigo-600 text-white text-[8px] font-black uppercase rounded shadow-sm">Cover</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 2: AI Configuration Setup */}
        <div className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100 space-y-5">
          <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-indigo-900 uppercase tracking-wider flex items-center">
                <Sparkles size={16} className="mr-2 text-indigo-500" /> 2. AI Scanner Settings
              </h3>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{rules.length} Rules Available</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-555 uppercase tracking-widest ml-1 flex items-center">
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
              <label className="text-[10px] font-black text-slate-555 uppercase tracking-widest ml-1 flex items-center">
                Select AI Listing Rule
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
              <label className="text-[10px] font-black text-slate-555 uppercase tracking-widest ml-1 flex items-center">
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
            className="w-full py-4 bg-[#0f172a] hover:bg-black text-white font-extrabold rounded-2xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-98 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                Scanning & Extracting Image Data...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                ✨ Populate Form with AI Scan
              </>
            )}
          </button>
        </div>

        {/* LOADING SHIMMER */}
        {loading && (
          <div className="flex flex-col items-center justify-center space-y-4 py-20 border border-dashed border-slate-100 rounded-3xl">
            <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
            <h3 className="font-bold text-slate-900">AI is analyzing product images...</h3>
          </div>
        )}

        {/* SECTION 3: Generated Form Attributes (Only rendered when hasScanned is true) */}
        {hasScanned && !loading && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 border-t border-slate-100 pt-8 animate-in fade-in slide-in-from-top-4 duration-300">
            
            {/* Left Side fields */}
            <div className="lg:col-span-6 space-y-6">
              <h3 className="text-xs font-black text-indigo-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                3. Listing Metadata Fields
              </h3>

              <div className="space-y-4">
                {/* Title */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-455 uppercase tracking-widest ml-1">Product Title</label>
                  <input 
                    className="w-full px-4 h-12 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all focus:ring-2 focus:ring-indigo-500/10"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Category */}
                  <div className="space-y-1.5 sm:col-span-1">
                    <label className="text-[10px] font-black text-slate-455 uppercase tracking-widest ml-1">Vinted Category</label>
                    <CategorySearchDropdown 
                      value={formData.category}
                      onSelect={handleCategorySelect}
                      placeholder="Category..."
                    />
                  </div>
                  {/* Listing Price */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-455 uppercase tracking-widest ml-1">Price ($)</label>
                    <div className="relative">
                      <DollarSign size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        className="w-full pl-10 pr-4 h-12 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all focus:ring-2 focus:ring-indigo-500/10"
                        value={formData.price}
                        onChange={(e) => setFormData({...formData, price: e.target.value})}
                      />
                    </div>
                  </div>
                  {/* Original Price */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-455 uppercase tracking-widest ml-1">Original Price ($)</label>
                    <div className="relative">
                      <DollarSign size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        className="w-full pl-10 pr-4 h-12 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all focus:ring-2 focus:ring-indigo-500/10"
                        value={formData.originalPrice}
                        onChange={(e) => setFormData({...formData, originalPrice: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Brand field (Conditional) */}
                  {categoryFields.brand_field_visibility && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-455 uppercase tracking-widest ml-1">Brand</label>
                      <BrandSearchDropdown 
                        value={formData.brand}
                        onSelect={(brand) => setFormData({...formData, brand})}
                        options={(categoryBrands || []).map(b => b ? { id: b.id, label: b.name || '' } : null).filter(Boolean)}
                        loading={fetchingBrands}
                        placeholder="Search brand..."
                      />
                    </div>
                  )}

                  {/* Size field (Conditional) */}
                  {categoryFields.size_field_visibility && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-455 uppercase tracking-widest ml-1">Size</label>
                      <SizeSearchDropdown 
                        value={formData.size}
                        onSelect={(size) => setFormData({...formData, size})}
                        options={(categorySizes || []).map(s => s ? { id: s.id, label: s.title || '' } : null).filter(Boolean)}
                        loading={fetchingSizes}
                        placeholder="Select size..."
                      />
                    </div>
                  )}

                  {/* Color field (Conditional) */}
                  {categoryFields.color_field_visibility && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-455 uppercase tracking-widest ml-1">Color</label>
                      <ColorSearchDropdown 
                        value={formData.color}
                        onSelect={(color) => setFormData({...formData, color})}
                        options={(vintedColors || []).map(c => c ? { id: c.id, label: c.title || '' } : null).filter(Boolean)}
                        loading={fetchingColors}
                        placeholder="Select color..."
                      />
                    </div>
                  )}

                  {/* Material selector */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-455 uppercase tracking-widest ml-1">Material (1-3 max)</label>
                    <MaterialMultiSelectDropdown 
                      value={formData.material}
                      onChange={(material) => setFormData({...formData, material})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Condition dropdown */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-455 uppercase tracking-widest ml-1">Condition</label>
                    <SearchableDropdown 
                      value={formData.selectedCondition}
                      onSelect={(opt) => setFormData({...formData, selectedCondition: opt.label, conditionId: opt.id})}
                      options={conditionOptions}
                      placeholder="Select condition..."
                    />
                  </div>
                  {/* Condition Note */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-455 uppercase tracking-widest ml-1">Condition Note</label>
                    <input 
                      className="w-full px-4 h-12 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all focus:ring-2 focus:ring-indigo-500/10"
                      value={formData.conditionNote}
                      onChange={(e) => setFormData({...formData, conditionNote: e.target.value})}
                      placeholder="Condition details..."
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-black text-slate-455 uppercase tracking-widest ml-1">Listing Description</label>
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
                        <Code size={11} /> Edit
                      </button>
                    </div>
                  </div>

                  {descriptionMode === 'edit' ? (
                    <textarea 
                      className="w-full p-4 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 leading-relaxed min-h-[200px] outline-none focus:border-indigo-500 transition-all shadow-inner focus:ring-2 focus:ring-indigo-500/10"
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      placeholder="Enter description..."
                    />
                  ) : (
                    <div 
                      className="w-full p-4 bg-slate-50/50 border border-slate-150 rounded-xl text-xs font-semibold text-slate-700 leading-relaxed min-h-[200px] overflow-y-auto max-h-[300px] shadow-inner"
                      style={{ whiteSpace: 'pre-wrap' }}
                    >
                      {formData.description}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Side: Specific Attributes & custom fields */}
            <div className="lg:col-span-6 space-y-6">
              <h3 className="text-xs font-black text-indigo-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                4. Custom Vinted Attributes & Info
              </h3>

              <div className="space-y-4">
                {/* SKU */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-455 uppercase tracking-widest ml-1">SKU</label>
                  <input 
                    className="w-full px-4 h-12 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all focus:ring-2 focus:ring-indigo-500/10 uppercase"
                    value={formData.sku}
                    onChange={(e) => setFormData({...formData, sku: e.target.value})}
                    placeholder="SKU"
                  />
                </div>

                {/* Conditional book/video game inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-50 pt-4">
                  {categoryFields.isbn_field_visibility && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-455 uppercase tracking-widest ml-1">ISBN</label>
                      <input 
                        className="w-full px-4 h-12 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all focus:ring-2 focus:ring-indigo-500/10"
                        value={formData.isbn}
                        onChange={(e) => setFormData({...formData, isbn: e.target.value})}
                        placeholder="ISBN..."
                      />
                    </div>
                  )}

                  {categoryFields.author_field_visibility && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-455 uppercase tracking-widest ml-1">Author</label>
                      <input 
                        className="w-full px-4 h-12 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all focus:ring-2 focus:ring-indigo-500/10"
                        value={formData.author}
                        onChange={(e) => setFormData({...formData, author: e.target.value})}
                        placeholder="Author name..."
                      />
                    </div>
                  )}

                  {categoryFields.book_title_field_visibility && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-455 uppercase tracking-widest ml-1">Book Title</label>
                      <input 
                        className="w-full px-4 h-12 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all focus:ring-2 focus:ring-indigo-500/10"
                        value={formData.bookTitle}
                        onChange={(e) => setFormData({...formData, bookTitle: e.target.value})}
                        placeholder="Book title..."
                      />
                    </div>
                  )}

                  {categoryFields.video_game_rating_field_visibility && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-455 uppercase tracking-widest ml-1">Video Game Rating</label>
                      <input 
                        className="w-full px-4 h-12 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all focus:ring-2 focus:ring-indigo-500/10"
                        value={formData.videoGameRating}
                        onChange={(e) => setFormData({...formData, videoGameRating: e.target.value})}
                        placeholder="Game rating..."
                      />
                    </div>
                  )}

                  {categoryFields.measurements_field_visibility && (
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-[10px] font-black text-slate-455 uppercase tracking-widest ml-1">Measurements</label>
                      <textarea 
                        className="w-full p-4 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all focus:ring-2 focus:ring-indigo-500/10 min-h-[100px]"
                        value={formData.measurements}
                        onChange={(e) => setFormData({...formData, measurements: e.target.value})}
                        placeholder="Item measurements details..."
                      />
                    </div>
                  )}
                </div>

                <div className="p-5 bg-indigo-50/40 border border-indigo-100 rounded-2xl space-y-3">
                  <h4 className="text-[10px] font-black text-indigo-900 uppercase tracking-wider">Vinted Publish Setup</h4>
                  <p className="text-[11px] text-indigo-755 leading-relaxed font-semibold">
                    Vinted listings are published using the eLister Chrome Extension. Ensure the extension is active before pushing publishing queue triggers.
                  </p>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Form Bottom Submission Control (Only visible when scanned) */}
        {hasScanned && !loading && (
          <div className="mt-8 pt-6 flex justify-end items-center gap-3 border-t border-slate-100 animate-in fade-in duration-300">
            <button 
              type="button"
              onClick={() => navigate('/listings')}
              className="px-6 py-3 border border-slate-200 hover:bg-slate-50 rounded-2xl text-xs font-extrabold text-slate-655 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="button"
              onClick={() => handleSaveListing(false)}
              disabled={loading || isConvertingImages || !allImagesLoaded}
              className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold text-xs hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50 cursor-pointer"
            >
              Save Draft
            </button>
            <button 
              type="button"
              onClick={() => {
                const selectedMats = formData.material ? formData.material.split(',').map(s => s.trim()).filter(Boolean) : [];
                if (selectedMats.length === 0) {
                  toast.warning("Please select at least 1 material.");
                  return;
                }
                handleSaveListing(true);
              }}
              disabled={loading || isConvertingImages || !allImagesLoaded}
              className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-xs hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 cursor-pointer"
            >
              Save & Publish to Vinted
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateVintedListing;
