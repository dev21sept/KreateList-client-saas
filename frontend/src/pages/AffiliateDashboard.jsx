import React, { useState, useEffect, useCallback } from 'react';
import { Copy, Users, DollarSign, Link as LinkIcon, Clock, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { affiliateService } from '../services/api';
import { useNotification } from '../context/NotificationContext';
import Button from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { LoadingState } from '../components/ui/LoadingState';
import EmptyState from '../components/ui/EmptyState';

const STATUS_META = {
  pending: { variant: 'warning', label: 'Pending Review', icon: Clock },
  approved: { variant: 'success', label: 'Approved', icon: CheckCircle2 },
  suspended: { variant: 'danger', label: 'Suspended', icon: XCircle },
  rejected: { variant: 'danger', label: 'Rejected', icon: XCircle }
};

export default function AffiliateDashboard() {
  const { toast } = useNotification();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [applying, setApplying] = useState(false);
  const [data, setData] = useState({ entries: [], pendingSignups: [], total: 0, totalReferred: 0, totalCommissionEarned: 0 });

  const load = useCallback(async () => {
    try {
      const meRes = await affiliateService.getMe();
      const me = meRes.data?.data;
      setProfile(me);
      if (me && me.status === 'approved') {
        const commRes = await affiliateService.getCommissions();
        setData(commRes.data?.data || data);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load affiliate data.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleApply = async () => {
    setApplying(true);
    try {
      await affiliateService.apply();
      toast.success('Application submitted! We will review it shortly.');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to apply.');
    } finally {
      setApplying(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`https://elister.ai/?via=${profile.code}`);
    toast.success('Tracking link copied!');
  };

  if (loading) return <LoadingState label="Loading Affiliate Program..." />;

  if (!profile) {
    return (
      <div className="max-w-2xl py-10 text-center">
        <h1 className="text-xl font-black text-slate-900">Join the eLister Affiliate Program</h1>
        <p className="text-xs font-semibold text-slate-500 mt-2 mb-6">
          Earn 10% commission on every subscription payment from people you refer.
        </p>
        <Button variant="primary" loading={applying} onClick={handleApply}>Apply Now</Button>
      </div>
    );
  }

  const meta = STATUS_META[profile.status] || STATUS_META.pending;
  const StatusIcon = meta.icon;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Badge variant={meta.variant}><StatusIcon size={11} className="inline mr-1" />{meta.label}</Badge>
      </div>

      {profile.status === 'pending' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
          <AlertTriangle size={18} className="text-amber-600 flex-shrink-0" />
          <p className="text-xs font-bold text-amber-800">Your application is awaiting admin approval. Your tracking link will activate once approved.</p>
        </div>
      )}
      {profile.status === 'suspended' && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center gap-3">
          <AlertTriangle size={18} className="text-rose-600 flex-shrink-0" />
          <p className="text-xs font-bold text-rose-800">Your affiliate account is suspended. {profile.statusReason || ''}</p>
        </div>
      )}

      {profile.status === 'approved' && (
        <>
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-2">Your Tracking Link</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 h-10 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 flex items-center overflow-x-auto">
                https://elister.ai/?via={profile.code}
              </code>
              <Button variant="secondary" size="sm" icon={<Copy size={13} />} onClick={copyLink}>Copy</Button>
            </div>
            <p className="text-[10px] font-semibold text-slate-400 mt-2">Your code: <span className="font-black text-slate-600">{profile.code}</span></p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <span className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center mb-2"><Users size={16} /></span>
              <p className="text-xl font-black text-slate-900">{profile.totalSignedUp || 0}</p>
              <p className="text-[10px] font-bold text-slate-500">Signed Up</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <span className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2"><CheckCircle2 size={16} /></span>
              <p className="text-xl font-black text-slate-900">{data.totalReferred || 0}</p>
              <p className="text-[10px] font-bold text-slate-500">Paid (Commission Earned)</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <span className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2"><DollarSign size={16} /></span>
              <p className="text-xl font-black text-slate-900">${(data.totalCommissionEarned || 0).toFixed(2)}</p>
              <p className="text-[10px] font-bold text-slate-500">Total Commission Earned</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <span className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-2"><LinkIcon size={16} /></span>
              <p className="text-xl font-black text-slate-900">10%</p>
              <p className="text-[10px] font-bold text-slate-500">Commission Rate</p>
            </div>
          </div>
          <p className="text-[10px] font-semibold text-slate-400 -mt-2">
            Commission is only credited once a referred signup actually pays for a plan - signups alone don't earn anything yet.
          </p>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 mb-3">Commission History</h2>
            {data.entries.length === 0 && (data.pendingSignups || []).length === 0 ? (
              <EmptyState title="No referrals yet" description="Share your tracking link - signups and commissions appear here." />
            ) : (
              <div className="divide-y divide-slate-100">
                {(data.pendingSignups || []).map(p => (
                  <div key={p.referredUser} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-slate-800">{p.referredUserName}</p>
                      <p className="text-[10px] text-slate-400">Signed up &middot; {new Date(p.signedUpAt).toLocaleDateString()}</p>
                    </div>
                    <Badge variant="warning">Pending - no payment yet</Badge>
                  </div>
                ))}
                {data.entries.map(e => (
                  <div key={e._id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-slate-800">{e.referredUserName}</p>
                      <p className="text-[10px] text-slate-400">{e.plan} plan &middot; {new Date(e.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span className={`font-black ${e.status === 'approved' ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {e.status === 'approved' ? '+' : '-'}${e.commissionAmount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
