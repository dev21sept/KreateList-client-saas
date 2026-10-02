import React, { useState } from 'react';
import { 
  TrendingUp, 
  Sparkles, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  AlertCircle, 
  ExternalLink, 
  RefreshCw, 
  ShieldCheck, 
  Tag,
  Zap
} from 'lucide-react';
import { pricingService } from '../../services/api';

/**
 * PriceRecommendationCard
 * Displays evidence-grounded eBay pricing recommendations, range,
 * confidence score, objective toggles, and comparable listings.
 */
export default function PriceRecommendationCard({
  itemData = {},
  currentPrice = '',
  onApplyPrice,
  marketplace = 'EBAY_US',
  compact = false
}) {
  const [loading, setLoading] = useState(false);
  const [recommendationData, setRecommendationData] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [selectedObjective, setSelectedObjective] = useState('MARKET_MATCHED');
  const [showComps, setShowComps] = useState(false);
  const [applied, setApplied] = useState(false);

  // Fetch recommendation from pricing engine
  const fetchPriceRecommendation = async (objective = selectedObjective) => {
    setLoading(true);
    setErrorMsg(null);
    setApplied(false);

    try {
      const payload = {
        item: {
          title: itemData.title || '',
          brand: itemData.brand || '',
          model: itemData.model || itemData.mpn || '',
          upc: itemData.upc || null,
          condition: itemData.condition || 'USED',
          category_hint: itemData.category || itemData.category_name || null
        },
        marketplace,
        objective
      };

      const res = await pricingService.getRecommendation(payload);
      const data = res.data || res;

      if (data.status === 'ok') {
        setRecommendationData(data);
      } else {
        setRecommendationData(null);
        setErrorMsg(data.message || 'Not enough comparable data found on eBay.');
      }
    } catch (err) {
      console.error('Pricing recommendation error:', err);
      setErrorMsg(err.response?.data?.message || 'Unable to fetch pricing data at this moment.');
      setRecommendationData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleObjectiveChange = (newObjective) => {
    setSelectedObjective(newObjective);
    fetchPriceRecommendation(newObjective);
  };

  const handleApply = (price) => {
    if (onApplyPrice && price) {
      onApplyPrice(price);
      setApplied(true);
      setTimeout(() => setApplied(false), 2500);

      // Record feedback
      if (recommendationData?.request_id) {
        pricingService.submitFeedback({
          request_id: recommendationData.request_id,
          item_title: itemData.title,
          suggested_price: price,
          accepted: true
        }).catch(() => {});
      }
    }
  };

  // Helper for confidence badge colors
  const getConfidenceBadge = (confidence) => {
    if (!confidence) return null;
    const label = confidence.label || 'LOW';
    const score = confidence.score || 0;

    if (label === 'HIGH') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          High Confidence · {score}/100
        </span>
      );
    }
    if (label === 'MEDIUM') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          Medium Confidence · {score}/100
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
        <AlertCircle className="w-3.5 h-3.5 text-slate-500" />
        Low Confidence · {score}/100
      </span>
    );
  };

  // Initial trigger button view when no data fetched yet
  if (!recommendationData && !loading && !errorMsg) {
    return (
      <button
        type="button"
        onClick={() => fetchPriceRecommendation()}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm transition-all duration-150 hover:shadow"
      >
        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
        <span>Suggest Market Price</span>
      </button>
    );
  }

  return (
    <div className="w-full bg-slate-50 dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs transition-all my-2">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              eBay Market Pricing Engine
              <span className="text-[10px] text-slate-400 font-normal">v1.0</span>
            </h4>
          </div>
        </div>

        <button
          type="button"
          onClick={() => fetchPriceRecommendation()}
          disabled={loading}
          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          title="Refresh pricing analysis"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="py-6 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 gap-2">
          <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
          <p className="text-xs">Analyzing eBay competitor listings & market comps...</p>
        </div>
      )}

      {/* Error / Insufficient Evidence State */}
      {!loading && errorMsg && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-lg text-amber-800 dark:text-amber-200 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Insufficient Comparable Evidence</p>
            <p className="mt-0.5 text-amber-700 dark:text-amber-300">{errorMsg}</p>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Tip: Provide an exact Brand, Model Number, or UPC barcode to find matching listings.
            </p>
          </div>
        </div>
      )}

      {/* Success Recommendation State */}
      {!loading && recommendationData && recommendationData.recommendation && (
        <div>
          {/* Main Price & Confidence Display */}
          <div className="flex flex-wrap items-baseline justify-between gap-3 p-3 bg-white dark:bg-slate-800/90 rounded-lg border border-slate-200/80 dark:border-slate-700/80">
            <div>
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Suggested List Price
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  ${recommendationData.recommendation.suggested_price}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Range: ${recommendationData.recommendation.expected_range?.low} – ${recommendationData.recommendation.expected_range?.high}
                </span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1.5">
              {getConfidenceBadge(recommendationData.recommendation.confidence)}
              <button
                type="button"
                onClick={() => handleApply(recommendationData.recommendation.suggested_price)}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  applied 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                }`}
              >
                {applied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Applied!</span>
                  </>
                ) : (
                  <>
                    <Tag className="w-3.5 h-3.5" />
                    <span>Apply Price</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Basis & Strategy Selection */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="text-slate-600 dark:text-slate-300 text-[11px]">
              <span className="font-semibold text-slate-700 dark:text-slate-200">Evidence: </span>
              Based on {recommendationData.recommendation.sample_counts?.active || 0} active listings
              {recommendationData.recommendation.sample_counts?.sold > 0 
                ? ` & ${recommendationData.recommendation.sample_counts.sold} verified sold records` 
                : ' (current asking prices)'}.
            </div>

            {/* Seller Objective Pills */}
            <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-slate-800 p-0.5 rounded-md">
              <button
                type="button"
                onClick={() => handleObjectiveChange('SELL_FASTER')}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                  selectedObjective === 'SELL_FASTER'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Sell Faster
              </button>
              <button
                type="button"
                onClick={() => handleObjectiveChange('MARKET_MATCHED')}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                  selectedObjective === 'MARKET_MATCHED'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Market Match
              </button>
              <button
                type="button"
                onClick={() => handleObjectiveChange('LEAVE_ROOM_FOR_OFFERS')}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                  selectedObjective === 'LEAVE_ROOM_FOR_OFFERS'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Room for Offers
              </button>
            </div>
          </div>

          {/* Caveats */}
          {recommendationData.recommendation.caveats && recommendationData.recommendation.caveats.length > 0 && (
            <div className="mt-2 text-[11px] text-amber-700 dark:text-amber-300/90 bg-amber-50/70 dark:bg-amber-950/20 p-2 rounded border border-amber-200/50 dark:border-amber-900/30">
              {recommendationData.recommendation.caveats.map((c, idx) => (
                <div key={idx} className="flex items-start gap-1">
                  <span>•</span>
                  <span>{c}</span>
                </div>
              ))}
            </div>
          )}

          {/* Expandable Representative Comparables */}
          {recommendationData.evidence && recommendationData.evidence.length > 0 && (
            <div className="mt-3 border-t border-slate-200 dark:border-slate-800 pt-2">
              <button
                type="button"
                onClick={() => setShowComps(!showComps)}
                className="w-full flex items-center justify-between text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 py-1 transition-colors"
              >
                <span>View {recommendationData.evidence.length} Matched Competitor Listings</span>
                {showComps ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showComps && (
                <div className="mt-2 space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {recommendationData.evidence.map((comp, idx) => (
                    <div 
                      key={comp.item_id || idx}
                      className="flex items-center justify-between gap-2 p-2 bg-white dark:bg-slate-800/60 rounded-md border border-slate-200/60 dark:border-slate-700/60 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {comp.thumbnail_url ? (
                          <img 
                            src={comp.thumbnail_url} 
                            alt={comp.title} 
                            className="w-8 h-8 object-cover rounded shrink-0 border border-slate-200 dark:border-slate-700" 
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0 text-slate-400 text-[10px]">
                            eBay
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-slate-800 dark:text-slate-200 font-medium truncate text-[11px]">
                            {comp.title}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400">
                            <span className="capitalize">{comp.condition}</span>
                            <span>•</span>
                            <span className="text-emerald-600 dark:text-emerald-400">
                              Match: {comp.match_score}/100
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 flex items-center gap-2">
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white text-xs">
                            ${comp.total_price?.toFixed(2) || comp.price?.toFixed(2)}
                          </div>
                          {comp.shipping > 0 && (
                            <div className="text-[9px] text-slate-400">
                              +${comp.shipping} ship
                            </div>
                          )}
                        </div>
                        {comp.item_url && (
                          <a
                            href={comp.item_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-400 hover:text-blue-600 p-1"
                            title="View on eBay"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
