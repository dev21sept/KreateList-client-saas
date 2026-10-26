import React, { useState, useEffect, useCallback } from 'react';
import { useNotification } from '../context/NotificationContext';
import {
  Zap,
  Users,
  RefreshCw,
  Tag,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  ChevronDown,
  ChevronRight,
  Activity as ActivityIcon,
  Lock
} from 'lucide-react';
import { automationService } from '../services/api';
import Button from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { LoadingState } from '../components/ui/LoadingState';
import EmptyState from '../components/ui/EmptyState';

const PLATFORM_META = {
  poshmark: { label: 'Poshmark' },
  ebay: { label: 'eBay' },
  mercari: { label: 'Mercari' },
  etsy: { label: 'Etsy' },
  amazon: { label: 'Amazon' }
};
const PLATFORMS = Object.keys(PLATFORM_META);

const FEATURE_META = {
  share_closet: { label: 'Share Closet', icon: Zap, description: 'Shares eligible listings to your followers once a day.' },
  follow_users: { label: 'Follow Users', icon: Users, description: 'Follows targets from an allowed source.' },
  relist: { label: 'Relist', icon: RefreshCw, description: 'Relists aging listings with duplicate protection.' },
  offers_to_likers: { label: 'Offers to Likers', icon: Tag, description: 'Sends approved offers to people who liked a listing.' }
};
const FEATURES = Object.keys(FEATURE_META);

const STATUS_BADGE = {
  queued: { variant: 'neutral', label: 'Queued' },
  running: { variant: 'info', label: 'Running' },
  awaiting_approval: { variant: 'warning', label: 'Awaiting Approval' },
  completed: { variant: 'success', label: 'Completed' },
  partially_completed: { variant: 'warning', label: 'Partially Completed' },
  failed: { variant: 'danger', label: 'Failed' },
  cancelled: { variant: 'neutral', label: 'Cancelled' },
  blocked: { variant: 'danger', label: 'Blocked' }
};

export default function Automation() {
  const { toast } = useNotification();
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState('poshmark');
  const [connected, setConnected] = useState({});
  const [settings, setSettings] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [activity, setActivity] = useState([]);
  const [expandedJobId, setExpandedJobId] = useState(null);
  const [jobDetails, setJobDetails] = useState({});
  const [runningNow, setRunningNow] = useState(false);
  const [savingFeature, setSavingFeature] = useState(null);

  const loadAll = useCallback(async () => {
    try {
      const [settingsRes, jobsRes, activityRes] = await Promise.all([
        automationService.getSettings(),
        automationService.getJobs(),
        automationService.getActivity()
      ]);
      setConnected(settingsRes.data?.data?.connected || {});
      setSettings(settingsRes.data?.data?.settings || []);
      setJobs(jobsRes.data?.data || []);
      setActivity(activityRes.data?.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load automation data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 30000);
    return () => clearInterval(interval);
  }, [loadAll]);

  const platformSettings = settings.filter(s => s.platform === platform);
  const platformJobs = jobs.filter(j => j.platform === platform);
  const shareSettings = platformSettings.find(s => s.feature === 'share_closet');
  const platformHasAnyAvailable = platformSettings.some(s => s.available);

  const handleToggleEnabled = async (feature, nextEnabled) => {
    setSavingFeature(feature);
    try {
      await automationService.updateSettings(platform, feature, { enabled: nextEnabled });
      toast.success(nextEnabled ? `${FEATURE_META[feature].label} enabled.` : `${FEATURE_META[feature].label} paused.`);
      await loadAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update settings.');
    } finally {
      setSavingFeature(null);
    }
  };

  const handleScheduleChange = async (feature, hour, minute) => {
    try {
      await automationService.updateSettings(platform, feature, { schedule: { hour, minute } });
      toast.success('Schedule updated.');
      await loadAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update schedule.');
    }
  };

  const handleRunNow = async () => {
    setRunningNow(true);
    try {
      const res = await automationService.createJob({ platform, feature: 'share_closet', mode: 'execute' });
      toast.success(res.data?.data?.message || 'Share Closet run started - it paces itself with human-like delays, so it may take a while.');
      await loadAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start run.');
    } finally {
      setRunningNow(false);
    }
  };

  const toggleJobExpand = async (jobId) => {
    if (expandedJobId === jobId) {
      setExpandedJobId(null);
      return;
    }
    setExpandedJobId(jobId);
    if (!jobDetails[jobId]) {
      try {
        const res = await automationService.getJob(jobId);
        setJobDetails(prev => ({ ...prev, [jobId]: res.data?.data }));
      } catch (_err) {
        toast.error('Failed to load job details.');
      }
    }
  };

  const handleCancelJob = async (jobId) => {
    try {
      await automationService.cancelJob(jobId);
      toast.success('Job cancelled.');
      await loadAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not cancel this job.');
    }
  };

  if (loading) {
    return <LoadingState label="Loading Automation..." />;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-black text-slate-900">Automation</h1>
        <p className="text-xs font-semibold text-slate-500 mt-1">
          Daily Share, Follow, Relist, and Offers workflows across your connected platforms.
        </p>
      </div>

      {/* Platform tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {PLATFORMS.map(p => {
          const hasAvailable = settings.some(s => s.platform === p && s.available);
          return (
            <button
              key={p}
              type="button"
              onClick={() => setPlatform(p)}
              className={`px-3.5 h-8 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
                platform === p ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {PLATFORM_META[p].label}
              {!hasAvailable && <Lock size={10} className={platform === p ? 'text-white/70' : 'text-slate-400'} />}
            </button>
          );
        })}
      </div>

      {!connected[platform] && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
          <AlertTriangle size={18} className="text-amber-600 flex-shrink-0" />
          <p className="text-xs font-bold text-amber-800">
            Your {PLATFORM_META[platform].label} account is not connected. Connect it from Integrations before enabling automation.
          </p>
        </div>
      )}

      {!platformHasAnyAvailable && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center gap-3">
          <Lock size={18} className="text-slate-400 flex-shrink-0" />
          <p className="text-xs font-bold text-slate-600">
            {PLATFORM_META[platform].label} automation is coming soon - it's wired into this module but waiting on a confirmed, working integration before any feature goes live, same as it was for Poshmark's own Follow, Relist and Offers.
          </p>
        </div>
      )}

      {/* Feature cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {FEATURES.map(feature => {
          const meta = FEATURE_META[feature];
          const s = platformSettings.find(x => x.feature === feature);
          const Icon = meta.icon;
          const available = s?.available;
          return (
            <div key={feature} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Icon size={16} />
                </span>
                {available ? (
                  <button
                    type="button"
                    disabled={!connected[platform] || savingFeature === feature}
                    onClick={() => handleToggleEnabled(feature, !s?.enabled)}
                    className={`relative w-10 h-5.5 rounded-full transition-colors ${s?.enabled ? 'bg-indigo-600' : 'bg-slate-200'} disabled:opacity-50`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform ${s?.enabled ? 'translate-x-4.5' : ''}`} />
                  </button>
                ) : (
                  <Lock size={14} className="text-slate-300" />
                )}
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-800">{meta.label}</h3>
                <p className="text-[10px] font-semibold text-slate-500 mt-0.5 leading-relaxed">{meta.description}</p>
              </div>
              {!available && (
                <p className="text-[10px] font-bold text-amber-600">
                  {s?.disabledReason || 'Required integration permission is not available.'}
                </p>
              )}
              {available && s?.enabled && (
                <p className="text-[10px] font-semibold text-slate-400">
                  Daily at {String(s.schedule?.hour ?? 10).padStart(2, '0')}:{String(s.schedule?.minute ?? 0).padStart(2, '0')} ({s.timezone})
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Share Closet settings */}
      {shareSettings?.available && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Share Closet Settings</h2>
            <Button size="sm" variant="primary" icon={<Play size={13} />} loading={runningNow} disabled={!connected[platform] || !shareSettings.enabled} onClick={handleRunNow}>
              Run Now
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Run Time (local)</label>
              <div className="flex items-center gap-2">
                <select
                  className="px-3 h-9 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none"
                  value={shareSettings.schedule?.hour ?? 10}
                  onChange={(e) => handleScheduleChange('share_closet', Number(e.target.value), shareSettings.schedule?.minute ?? 0)}
                >
                  {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}</option>)}
                </select>
                <span className="text-xs text-slate-400">:</span>
                <select
                  className="px-3 h-9 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none"
                  value={shareSettings.schedule?.minute ?? 0}
                  onChange={(e) => handleScheduleChange('share_closet', shareSettings.schedule?.hour ?? 10, Number(e.target.value))}
                >
                  {[0, 15, 30, 45].map(m => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Last Run</label>
              <p className="text-xs font-semibold text-slate-700 h-9 flex items-center">
                {shareSettings.lastRunAt ? new Date(shareSettings.lastRunAt).toLocaleString() : 'Never'}
              </p>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Daily Limit</label>
              <p className="text-xs font-semibold text-slate-700 h-9 flex items-center">80 shares / day (paced with random delays)</p>
            </div>
          </div>
        </div>
      )}

      {/* Jobs */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <ActivityIcon size={16} /> Jobs
        </h2>
        {platformJobs.length === 0 ? (
          <EmptyState title="No jobs yet" description="Enable a feature above and it will run on its schedule, or use Run Now." />
        ) : (
          <div className="divide-y divide-slate-100">
            {platformJobs.map(job => {
              const badge = STATUS_BADGE[job.status] || STATUS_BADGE.queued;
              const isExpanded = expandedJobId === job._id;
              const detail = jobDetails[job._id];
              return (
                <div key={job._id} className="py-3">
                  <button type="button" onClick={() => toggleJobExpand(job._id)} className="w-full flex items-center justify-between text-left">
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                      <div>
                        <p className="text-xs font-bold text-slate-800">{FEATURE_META[job.feature]?.label || job.feature}</p>
                        <p className="text-[10px] font-semibold text-slate-400">{new Date(job.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold text-slate-500">
                        {job.counts?.confirmed || 0} confirmed / {job.counts?.failed || 0} failed / {job.counts?.eligible || 0} eligible
                      </span>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                      {['queued', 'running'].includes(job.status) && (
                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleCancelJob(job._id); }}>Cancel</Button>
                      )}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="mt-3 ml-6 space-y-1.5 max-h-64 overflow-y-auto">
                      {!detail ? (
                        <p className="text-[10px] text-slate-400">Loading...</p>
                      ) : detail.items.length === 0 ? (
                        <p className="text-[10px] text-slate-400">No items processed yet.</p>
                      ) : detail.items.map(item => (
                        <div key={item._id} className="flex items-center gap-2 text-[10px]">
                          {item.status === 'confirmed' ? <CheckCircle2 size={12} className="text-emerald-500 flex-shrink-0" /> : <XCircle size={12} className="text-rose-500 flex-shrink-0" />}
                          <span className="font-semibold text-slate-700 truncate">{item.listing?.title || item.targetUsername || item.action}</span>
                          <span className="text-slate-400 flex-shrink-0">{item.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Activity / audit log */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Clock size={16} /> Activity (last 7 days)
        </h2>
        {activity.filter(ev => ev.platform === platform).length === 0 ? (
          <EmptyState title="No activity yet" description="Configuration changes and job runs will show up here." />
        ) : (
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {activity.filter(ev => ev.platform === platform).map(ev => (
              <div key={ev._id} className="flex items-center justify-between text-[10px] py-1.5 border-b border-slate-50 last:border-0">
                <span className="font-semibold text-slate-700">{ev.eventType}</span>
                <span className="text-slate-400">{new Date(ev.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
