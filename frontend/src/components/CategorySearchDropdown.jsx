import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Loader2, Search } from 'lucide-react';
import { aiService, ebayService } from '../services/api';

const CategorySearchDropdown = ({ value, onSelect, platform, placeholder = 'Search category...' }) => {
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
        let response;
        if (platform === 'poshmark') {
          response = await aiService.poshmarkSuggestCategories(searchTerm);
        } else if (platform === 'ebay') {
          response = await ebayService.suggestCategories(searchTerm);
        } else if (platform === 'depop') {
          response = await aiService.depopSuggestCategories(searchTerm);
        } else if (platform === 'etsy') {
          response = await aiService.etsySuggestCategories(searchTerm);
        }

        if (response && response.data) {
          const rawData = response.data.success ? response.data.data : response.data;
          const normalised = (rawData || []).map(opt => {
            const fullPath = opt.fullName || (opt.path && opt.name ? `${opt.path} > ${opt.name}` : '') || opt.label || opt.name || '';
            return {
              id: opt.id || opt.categoryId || '',
              label: fullPath,
              fullName: fullPath,
              shortName: opt.name || opt.label || fullPath.split(' > ').pop(),
              brand_field_visibility: opt.brand_field_visibility,
              size_field_visibility: opt.size_field_visibility,
              color_field_visibility: opt.color_field_visibility,
              isbn_field_visibility: opt.isbn_field_visibility,
              author_field_visibility: opt.author_field_visibility,
              book_title_field_visibility: opt.book_title_field_visibility,
              video_game_rating_field_visibility: opt.video_game_rating_field_visibility,
            };
          });
          setSuggestions(normalised);
        }
      } catch (err) {
        console.error('Category search suggestion failed:', err);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(delayDebounce);
  }, [searchTerm, platform]);

  return (
    <div ref={wrapperRef} className="relative w-full text-left">
      <div className="relative">
        <input
          type="text"
          value={isOpen ? searchTerm : (value || '')}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            setSearchTerm(value || '');
            setIsOpen(true);
          }}
          placeholder={placeholder}
          className="w-full px-4 h-11 bg-white border border-slate-200 rounded-xl outline-none text-xs font-bold text-slate-700 focus:border-indigo-500 pl-9 pr-8 transition-all focus:ring-2 focus:ring-indigo-500/10"
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
        
        {loading ? (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-500 w-3.5 h-3.5 animate-spin" />
        ) : value ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect({ id: '', label: '', fullName: '' });
              setSearchTerm('');
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-all cursor-pointer"
            title="Clear category"
          >
            <span className="text-xs font-black">×</span>
          </button>
        ) : null}
      </div>

      {isOpen && (
        <div className="absolute z-[999] w-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-64 overflow-y-auto scrollbar-thin py-1.5 animate-in fade-in duration-150">
          {suggestions.length > 0 ? (
            suggestions.map((opt) => (
              <button
                key={opt.id || opt.label}
                type="button"
                onClick={() => {
                  onSelect(opt);
                  setIsOpen(false);
                  setSearchTerm('');
                }}
                className={`w-full text-left px-3.5 py-2.5 hover:bg-indigo-50/70 text-xs font-bold border-b border-slate-50 last:border-0 transition-colors flex items-center justify-between gap-2 ${
                  value === opt.label ? 'bg-indigo-50/90 text-indigo-700' : 'text-slate-700'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <span className="text-slate-800 font-extrabold text-xs block leading-snug break-words">{opt.label}</span>
                  {opt.id && (
                    <span className="text-[9px] text-slate-400 font-mono mt-0.5 block">ID: {opt.id}</span>
                  )}
                </div>
              </button>
            ))
          ) : (
            <div className="px-4 py-3 text-xs font-bold text-slate-400 text-center">
              {loading ? 'Searching category hierarchy...' : 'No categories found. Type to search...'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CategorySearchDropdown;
