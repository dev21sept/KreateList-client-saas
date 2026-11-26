import React, { useState, useEffect, useCallback } from 'react';
import { useNotification } from '../context/NotificationContext';
import { Sparkles, RefreshCw, ThumbsUp, ThumbsDown, X, TrendingUp, AlertCircle } from 'lucide-react';
import { adaptiveAiService } from '../services/api';
import Button from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { LoadingState } from '../components/ui/LoadingState';
import EmptyState from '../components/ui/EmptyState';

const TYPE_META = {
  price_review: { label: 'Price Review', icon: TrendingUp },
  listing_quality: { label: 'Listing Quality', icon: AlertCircle },
};

const STATUS_BADGE = {
  proposed: { variant: 'info', label: 'New' },
  accepted: { variant: 'success', label: 'Accepted' },
  rejected: { variant: 'neutral', label: 'Rejected' },
  dismissed: { variant: 'neutral', label: 'Dismissed' },
  executed: { variant: 'success', label: 'Executed' },
  expired: { variant: 'neutral', label: 'Expired' },
};

export default function AiInsights() {
  const { toast } = useNotification();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [preferences, setPreferences] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [actingOn, setActingOn] = useState(null);

  const loadAll = useCallback(async () => {
    try {
      const [profileRes, recsRes] = await Promise.all([
        adaptiveAiService.getLearningProfile(),
        adaptiveAiService.getRecommendations('proposed'),
      ]);
      setPreferences(profileRes.data?.preferences || []);
      setRecommendations(recsRes.data?.recommendations || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load AI insights.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await adaptiveAiService.refresh();
      toast.success(`Generated ${res.data?.created ?? 0} new recommendation(s).`);
      await loadAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to refresh recommendations.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleFeedback = async (id, action) => {
    setActingOn(id);
    try {
      await adaptiveAiService.submitFeedback(id, action);
      toast.success(action === 'accept' ? 'Marked as accepted.' : 'Dismissed.');
      setRecommendations(prev => prev.filter(r => r._id !== id));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record feedback.');
    } finally {
      setActingOn(null);
    }
  };

  if (loading) return <LoadingState label="Loading AI Insights..." />;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <p className="text-xs font-semibold text-slate-500 max-w-2xl">
          Adaptive AI learns your selling patterns from your own listing activity and
          surfaces price-review and listing-quality recommendations. Nothing here is
          auto-applied - every suggestion needs your review.
        </p>
        <Button variant="secondary" size="sm" icon={<RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />} onClick={handleRefresh} loading={refreshing}>
          Refresh Recommendations
        </Button>
      </div>

      <div className="bg-white rounded-2xl border border-border p-5">
        <h3 className="text-xs font-black text-slate-700 uppercase tracking-wide mb-3">Your Learning Profile</h3>
        {preferences.length === 0 ? (
          <EmptyState
            icon={<Sparkles size={20} />}
            title="Not enough activity yet"
            description="List and manage a few more items and Adaptive AI will start learning your preferences."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {preferences.map(p => (
              <div key={p._id || p.key} className="rounded-xl border border-border p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-slate-700 capitalize">{p.key.replace(/_/g, ' ')}</span>
                  <Badge variant={p.source === 'explicit' ? 'brand' : 'neutral'}>{p.source}</Badge>
                </div>
                <p className="text-sm font-bold text-slate-900 mt-1.5">
                  {JSON.stringify(p.explicitValue ?? p.inferredValue ?? '—')}
                </p>
                {p.source !== 'explicit' && (
                  <p className="text-[10px] font-semibold text-slate-400 mt-1">
                    {Math.round((p.confidence || 0) * 100)}% confidence · {p.evidenceCount} events
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-border p-5">
        <h3 className="text-xs font-black text-slate-700 uppercase tracking-wide mb-3">Recommendations</h3>
        {recommendations.length === 0 ? (
          <EmptyState
            icon={<Sparkles size={20} />}
            title="No open recommendations"
            description="Click Refresh Recommendations to check for new price-review or listing-quality suggestions."
          />
        ) : (
          <div className="space-y-3">
            {recommendations.map(rec => {
              const meta = TYPE_META[rec.type] || { label: rec.type, icon: Sparkles };
              const Icon = meta.icon;
              return (
                <div key={rec._id} className="rounded-xl border border-border p-4 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                      <Icon size={16} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-800">{meta.label}</span>
                        <Badge variant={(STATUS_BADGE[rec.status] || {}).variant || 'neutral'}>
                          {(STATUS_BADGE[rec.status] || {}).label || rec.status}
                        </Badge>
                        {rec.confidence != null && (
                          <span className="text-[10px] font-semibold text-slate-400">{Math.round(rec.confidence * 100)}% confidence</span>
                        )}
                      </div>
                      <p className="text-[11px] font-semibold text-slate-500 mt-1 max-w-xl">{rec.rationale}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" variant="secondary" icon={<ThumbsUp size={13} />} disabled={actingOn === rec._id} onClick={() => handleFeedback(rec._id, 'accept')}>
                      Accept
                    </Button>
                    <Button size="sm" variant="ghost" icon={<ThumbsDown size={13} />} disabled={actingOn === rec._id} onClick={() => handleFeedback(rec._id, 'dismiss')}>
                      Dismiss
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
