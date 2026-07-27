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
          const normalised = (rawData || []).map(opt => ({
            id: opt.id || opt.categoryId || '',
            label: opt.label || opt.name || opt.fullName || '',
            fullName: opt.fullName || opt.label || opt.name || '',
            brand_field_visibility: opt.brand_field_visibility,
            size_field_visibility: opt.size_field_visibility,
            color_field_visibility: opt.color_field_visibility,
            isbn_field_visibility: opt.isbn_field_visibility,
            author_field_visibility: opt.author_field_visibility,
            book_title_field_visibility: opt.book_title_field_visibility,
            video_game_rating_field_visibility: opt.video_game_rating_field_visibility,
          }));
          setSuggestions(normalised);
        }
      } catch (err) {
        console.error('Category search suggestion failed:', err);
      } finally {
        setLoading(false);
      }
    }, 400);

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
          className="w-full px-4 h-12 bg-white border border-slate-200 rounded-2xl outline-none text-xs font-bold text-slate-700 focus:border-indigo-500 pl-10"
        />
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
        {loading && (
          <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 text-indigo-500 w-4 h-4 animate-spin" />
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1.5 bg-white border border-slate-100 rounded-2xl shadow-xl max-h-60 overflow-y-auto scrollbar-thin py-2">
          {suggestions.length > 0 ? (
            suggestions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onSelect(opt);
                  setIsOpen(false);
                }}
                className="w-full text-left px-4 py-3 hover:bg-slate-50 text-xs font-bold text-slate-700 flex flex-col gap-0.5 border-b border-slate-50 last:border-0 transition-colors"
              >
                <span className="text-slate-800 font-extrabold">{opt.label}</span>
                {opt.fullName && opt.fullName !== opt.label && (
                  <span className="text-slate-400 text-[10px] font-semibold">{opt.fullName}</span>
                )}
              </button>
            ))
          ) : (
            <div className="px-4 py-3 text-xs font-bold text-slate-400 text-center">
              {loading ? 'Searching categories...' : 'No categories found. Start typing...'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CategorySearchDropdown;
