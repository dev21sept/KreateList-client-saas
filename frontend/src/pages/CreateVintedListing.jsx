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
    return options.filter(opt => opt.label.toLowerCase().includes(q));
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
    return options.filter(opt => opt.label.toLowerCase().includes(q));
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
    return options.filter(opt => opt.label.toLowerCase().includes(q));
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
  const [step, setStep] = useState(editId ? 2 : 1);
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

            setStep(2);
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
      const base64Images = await Promise.all(uploadedFiles.map(file => fileToBase64(file)));
      setFormData(prev => ({ ...prev, images: [...prev.images, ...base64Images] }));
    } catch (err) {
      console.error("Error converting images to base64:", err);
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

  const nextStep = () => {
    if (step === 1) {
      startAIFetch();
    } else if (step === 2) {
      const selectedMats = formData.material ? formData.material.split(',').map(s => s.trim()).filter(Boolean) : [];
      if (selectedMats.length === 0) {
        toast.warning("Please select at least 1 material.");
        return;
      }
      if (selectedMats.length > 3) {
        toast.warning("You can select a maximum of 3 materials.");
        return;
      }
      setStep(3);
    } else if (step === 3) {
      handleSaveListing(false);
    }
  };
  
  const prevStep = () => setStep(step - 1);

  return (
    <div className="max-w-[95%] mx-auto space-y-8 px-4">
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
              {/* Selection Section */}
              <div className="bg-slate-50/50 p-8 rounded-[2.5rem] border border-slate-100 space-y-8">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-black text-indigo-900 uppercase tracking-[0.2em] flex items-center">
                      <Sparkles size={16} className="mr-2 text-indigo-500" /> AI Configuration Setup
                    </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-550 uppercase tracking-widest ml-1 flex items-center">
                      <Sparkles size={14} className="mr-1.5 text-indigo-600" /> Select AI Model
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

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-550 uppercase tracking-widest ml-1 flex items-center">
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

              {/* Image Section */}
              <div className="space-y-4">
                <label className="text-sm font-bold text-slate-700 ml-1 flex items-center">
                  <ImageIcon size={16} className="mr-2 text-indigo-600" /> Product Images
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
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

                    {/* Row 1: Category, SKU, and Brand (if visible) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1.5 md:col-span-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Vinted Category</label>
                        <CategorySearchDropdown 
                          value={formData.category}
                          onSelect={handleCategorySelect}
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
                      {categoryFields.brand_field_visibility && (
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Brand</label>
                          <BrandSearchDropdown 
                            value={formData.brand}
                            onSelect={(val) => setFormData({...formData, brand: val})}
                            options={categoryBrands}
                            loading={fetchingBrands}
                            placeholder="Search or type brand..."
                          />
                        </div>
                      )}
                    </div>

                    {/* Row 2: Listing Price, Condition, and Color (if visible) */}
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
                      {categoryFields.color_field_visibility && (
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Color</label>
                          <ColorSearchDropdown 
                            value={formData.color}
                            onSelect={(val) => setFormData({...formData, color: val})}
                            options={vintedColors}
                            loading={fetchingColors}
                            placeholder="Search or type color..."
                          />
                        </div>
                      )}
                    </div>

                    {/* Row 3: Size (if visible) and Material (recommended) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {categoryFields.size_field_visibility && (
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Size</label>
                          <SizeSearchDropdown 
                            value={formData.size}
                            onSelect={(val) => setFormData({...formData, size: val})}
                            options={categorySizes}
                            loading={fetchingSizes}
                            placeholder="Search or type size..."
                          />
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Material (recommended)</label>
                        <MaterialMultiSelectDropdown 
                          value={formData.material || ''}
                          onChange={(val) => setFormData({...formData, material: val})}
                        />
                      </div>
                    </div>

                    {/* Category Specific Dynamic Fields (Book and Game Details) */}
                    {(categoryFields.isbn_field_visibility || 
                      categoryFields.author_field_visibility || 
                      categoryFields.book_title_field_visibility || 
                      categoryFields.video_game_rating_field_visibility || 
                      categoryFields.measurements_field_visibility) && (
                      <div className="p-6 bg-slate-50/50 border border-slate-100 rounded-[2rem] space-y-4">
                        <div className="flex items-center gap-2 pb-1 border-b border-slate-200/60">
                          <Sparkles size={14} className="text-indigo-600" />
                          <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-wider">Additional Category Fields</h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {categoryFields.book_title_field_visibility && (
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Book Title</label>
                              <input 
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-semibold outline-none focus:border-indigo-500 transition-all"
                                value={formData.bookTitle}
                                onChange={(e) => setFormData({...formData, bookTitle: e.target.value})}
                                placeholder="Book Title..."
                              />
                            </div>
                          )}
                          {categoryFields.author_field_visibility && (
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Author</label>
                              <input 
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-semibold outline-none focus:border-indigo-500 transition-all"
                                value={formData.author}
                                onChange={(e) => setFormData({...formData, author: e.target.value})}
                                placeholder="Author..."
                              />
                            </div>
                          )}
                          {categoryFields.isbn_field_visibility && (
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">ISBN</label>
                              <input 
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-semibold outline-none focus:border-indigo-500 transition-all"
                                value={formData.isbn}
                                onChange={(e) => setFormData({...formData, isbn: e.target.value})}
                                placeholder="ISBN..."
                              />
                            </div>
                          )}
                          {categoryFields.video_game_rating_field_visibility && (
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Video Game Rating</label>
                              <input 
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-semibold outline-none focus:border-indigo-500 transition-all"
                                value={formData.videoGameRating}
                                onChange={(e) => setFormData({...formData, videoGameRating: e.target.value})}
                                placeholder="Video game rating..."
                              />
                            </div>
                          )}
                          {categoryFields.measurements_field_visibility && (
                            <div className="space-y-1.5 md:col-span-2">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Measurements</label>
                              <input 
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-semibold outline-none focus:border-indigo-500 transition-all"
                                value={formData.measurements}
                                onChange={(e) => setFormData({...formData, measurements: e.target.value})}
                                placeholder="e.g. Pit to pit: 21 in, Length: 28 in..."
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Listing Description</label>
                        <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                          <button 
                            type="button"
                            onClick={() => setDescriptionMode('preview')}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${descriptionMode === 'preview' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                            <Eye size={12} /> Preview
                          </button>
                          <button 
                            type="button"
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
                          placeholder="Enter description..."
                        />
                      ) : (
                        <div 
                          className="w-full px-6 py-6 bg-slate-50/50 border border-slate-100 rounded-2xl text-[13px] font-medium leading-relaxed min-h-[300px] overflow-y-auto max-h-[500px] shadow-inner overscroll-contain transform-gpu [scrollbar-width:thin] [scrollbar-color:theme(colors.slate.200)_transparent]"
                          style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}
                        >
                          {formData.description}
                        </div>
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
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-10 flex-1"
            >
              <div className="lg:col-span-4 space-y-6">
                <div className="bg-emerald-50/50 border border-emerald-100 p-6 rounded-3xl space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shrink-0">
                      <CheckCircle2 size={24} />
                    </div>
                    <div>
                      <h3 className="font-bold text-emerald-900">Ready to Save</h3>
                      <p className="text-[10px] text-emerald-700 font-bold uppercase tracking-widest">Final Review Mode</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-slate-50 border border-slate-100 rounded-3xl space-y-4">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Vinted Platform Setup</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Vinted listings can be published directly via our high-speed API through the extension. Once saved, you can click <b>Save & Publish to Vinted</b> to publish it to your profile immediately.
                  </p>
                </div>
              </div>

              <div className="lg:col-span-8 space-y-8 overflow-y-auto max-h-[700px] pr-4 custom-scrollbar">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.1em]">Manage Image Order</h3>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{formData.images.length} Photos</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {formData.images.map((img, i) => (
                      <div 
                        key={img.substring(0, 100) + '-' + i} 
                        className="aspect-square bg-slate-100 rounded-2xl relative group overflow-hidden border border-slate-200 flex flex-col shadow-sm"
                      >
                        <img src={img} className="w-full h-full object-cover" alt={`Product ${i + 1}`} />
                        
                        {/* Control overlay */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex flex-col justify-between p-3 z-10">
                          <div className="flex justify-between items-start">
                            <span className="bg-black/60 backdrop-blur-sm text-white px-2 py-0.5 rounded-md text-[9px] font-bold">
                              {i === 0 ? 'Cover' : `#${i + 1}`}
                            </span>
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteImage(i);
                              }}
                              className="p-1.5 bg-rose-500/90 rounded-xl text-white hover:bg-rose-600 transition-colors shadow-sm"
                              title="Delete Image"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                          
                          <div className="flex justify-center gap-2">
                            <button
                              type="button"
                              disabled={i === 0}
                              onClick={(e) => {
                                e.stopPropagation();
                                moveImage(i, 'left');
                              }}
                              className={`p-2 rounded-xl backdrop-blur-sm text-white transition-all ${
                                i === 0 
                                  ? 'bg-white/10 text-white/40 cursor-not-allowed' 
                                  : 'bg-white/25 hover:bg-white/45 active:scale-95'
                              }`}
                              title="Move Left"
                            >
                              <ArrowLeft size={14} />
                            </button>
                            <button
                              type="button"
                              disabled={i === formData.images.length - 1}
                              onClick={(e) => {
                                e.stopPropagation();
                                moveImage(i, 'right');
                              }}
                              className={`p-2 rounded-xl backdrop-blur-sm text-white transition-all ${
                                i === formData.images.length - 1 
                                  ? 'bg-white/10 text-white/40 cursor-not-allowed' 
                                  : 'bg-white/25 hover:bg-white/45 active:scale-95'
                              }`}
                              title="Move Right"
                            >
                              <ArrowRight size={14} />
                            </button>
                          </div>
                        </div>
                        {i === 0 && (
                          <div className="absolute top-2 left-2 px-2 py-0.5 bg-indigo-600 text-white text-[8px] font-black uppercase rounded-md shadow-lg pointer-events-none">Main</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white border border-slate-100 rounded-[2.5rem] shadow-sm p-8 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Listing Title</label>
                      <p className="text-sm font-bold text-slate-900 leading-snug">{formData.title}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Target Category</label>
                      <p className="text-sm font-bold text-indigo-600">{formData.category}</p>
                    </div>
                    {categoryFields.brand_field_visibility && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Brand</label>
                        <p className="text-sm font-bold text-slate-700">{formData.brand || 'No Brand'}</p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-4 border-t border-slate-50">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Listing Price</label>
                      <p className="text-lg font-black text-emerald-600">${formData.price || '0.00'}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Condition</label>
                      <p className="text-xs font-bold text-slate-700">{formData.selectedCondition}</p>
                    </div>
                    {categoryFields.size_field_visibility && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Size</label>
                        <p className="text-xs font-bold text-slate-700">{formData.size || 'N/A'}</p>
                      </div>
                    )}
                    {categoryFields.color_field_visibility && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Color</label>
                        <p className="text-xs font-bold text-slate-700">{formData.color || 'N/A'}</p>
                      </div>
                    )}
                  </div>

                  {(formData.material || formData.sku || categoryFields.isbn_field_visibility || categoryFields.author_field_visibility || categoryFields.book_title_field_visibility || categoryFields.video_game_rating_field_visibility || categoryFields.measurements_field_visibility) && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-4 border-t border-slate-50">
                      {formData.material && (
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Material</label>
                          <p className="text-xs font-bold text-slate-700">{formData.material}</p>
                        </div>
                      )}
                      {formData.sku && (
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SKU</label>
                          <p className="text-xs font-mono font-bold text-slate-500 uppercase">{formData.sku}</p>
                        </div>
                      )}
                      {categoryFields.book_title_field_visibility && formData.bookTitle && (
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Book Title</label>
                          <p className="text-xs font-bold text-slate-700">{formData.bookTitle}</p>
                        </div>
                      )}
                      {categoryFields.author_field_visibility && formData.author && (
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Author</label>
                          <p className="text-xs font-bold text-slate-700">{formData.author}</p>
                        </div>
                      )}
                      {categoryFields.isbn_field_visibility && formData.isbn && (
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ISBN</label>
                          <p className="text-xs font-bold text-slate-700">{formData.isbn}</p>
                        </div>
                      )}
                      {categoryFields.video_game_rating_field_visibility && formData.videoGameRating && (
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Game Rating</label>
                          <p className="text-xs font-bold text-slate-700">{formData.videoGameRating}</p>
                        </div>
                      )}
                      {categoryFields.measurements_field_visibility && formData.measurements && (
                        <div className="col-span-2 space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Measurements</label>
                          <p className="text-xs font-bold text-slate-700">{formData.measurements}</p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-3 pt-6 border-t border-slate-50">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Description Preview</label>
                    <div 
                      className="text-xs text-slate-650 leading-relaxed max-h-[300px] overflow-y-auto pr-2 custom-scrollbar opacity-80"
                      style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}
                    >
                      {formData.description}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-8 pt-6 border-t border-slate-100 flex justify-between items-center">
          <button
            type="button"
            disabled={loading || step === 1}
            onClick={prevStep}
            className="h-12 px-6 border border-slate-200 rounded-2xl text-xs font-bold text-slate-650 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <ChevronLeft size={16} /> Back
          </button>

          <div className="flex items-center gap-4">
            {(isConvertingImages || !allImagesLoaded) && (
              <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-xl shadow-sm animate-pulse mr-2">
                <Loader2 size={12} className="animate-spin text-indigo-500" />
                {isConvertingImages ? 'Converting images...' : `Loading images (${Object.keys(loadedImages).length}/${formData.images.length})...`}
              </span>
            )}
            {step === 3 ? (
              <>
                <button 
                  onClick={() => handleSaveListing(false)}
                  disabled={loading || isConvertingImages || !allImagesLoaded}
                  className="flex items-center gap-2 px-6 py-3 bg-slate-100 text-slate-700 rounded-2xl font-bold text-xs hover:bg-slate-200 transition-all disabled:opacity-50 cursor-pointer"
                >
                  Save Draft
                </button>
                <button 
                  onClick={() => handleSaveListing(true)}
                  disabled={loading || isConvertingImages || !allImagesLoaded}
                  className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-xs hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 disabled:opacity-50 cursor-pointer"
                >
                  {loading ? 'Working...' : 'Save & Publish to Vinted'}
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={loading || isConvertingImages || !allImagesLoaded || (step === 1 && formData.images.length === 0)}
                onClick={nextStep}
                className="h-12 px-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <>
                  Next Step <ChevronLeft size={16} className="rotate-180" />
                </>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateVintedListing;
