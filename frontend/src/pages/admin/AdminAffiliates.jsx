import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, Ban, RotateCcw, Users, DollarSign } from 'lucide-react';
import { adminAffiliateService } from '../../services/api';
import { useNotification } from '../../context/NotificationContext';
import Button from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { LoadingState } from '../../components/ui/LoadingState';
import EmptyState from '../../components/ui/EmptyState';

const STATUS_VARIANT = { pending: 'warning', approved: 'success', suspended: 'danger', rejected: 'danger' };

export default function AdminAffiliates() {
  const { toast } = useNotification();
  const [loading, setLoading] = useState(true);
  const [affiliates, setAffiliates] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [details, setDetails] = useState({});
  const [acting, setActing] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await adminAffiliateService.list();
      setAffiliates(res.data?.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load affiliates.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleExpand = async (id) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!details[id]) {
      try {
        const res = await adminAffiliateService.get(id);
        setDetails(prev => ({ ...prev, [id]: res.data?.data }));
      } catch (err) {
        toast.error('Failed to load affiliate details.');
      }
    }
  };

  const runAction = async (id, action, label, reason) => {
    setActing(id);
    try {
      await adminAffiliateService[action](id, reason);
      toast.success(`Affiliate ${label}.`);
      await load();
      setDetails(prev => { const next = { ...prev }; delete next[id]; return next; });
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to ${label.toLowerCase()} affiliate.`);
    } finally {
      setActing(null);
    }
  };

  if (loading) return <LoadingState label="Loading affiliates..." />;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      <h1 className="text-xl font-black text-slate-900">Affiliates</h1>

      {affiliates.length === 0 ? (
        <EmptyState title="No affiliates yet" description="Affiliate applications will show up here." />
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm divide-y divide-slate-100">
          {affiliates.map(aff => {
            const detail = details[aff._id];
            const isExpanded = expandedId === aff._id;
            return (
              <div key={aff._id}>
                <button type="button" onClick={() => toggleExpand(aff._id)} className="w-full flex items-center justify-between px-5 py-3.5 text-left">
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                    <div>
                      <p className="text-xs font-black text-slate-800">
                        {aff.user?.firstName} {aff.user?.lastName} <span className="text-slate-400 font-semibold">({aff.code})</span>
                      </p>
                      <p className="text-[10px] font-semibold text-slate-400">{aff.user?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1" title="Signed up / Paid">
                      <Users size={11} /> {aff.totalSignedUp || 0} signed up ({aff.totalReferred || 0} paid)
                    </span>
                    <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1"><DollarSign size={11} /> {(aff.totalCommissionEarned || 0).toFixed(2)}</span>
                    <Badge variant={STATUS_VARIANT[aff.status]}>{aff.status}</Badge>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-5 pb-4">
                    <div className="flex flex-wrap gap-2 mb-3">
                      {aff.status === 'pending' && (
                        <>
                          <Button size="sm" variant="primary" icon={<CheckCircle2 size={13} />} loading={acting === aff._id} onClick={() => runAction(aff._id, 'approve', 'Approved')}>Approve</Button>
                          <Button size="sm" variant="danger" icon={<XCircle size={13} />} loading={acting === aff._id} onClick={() => runAction(aff._id, 'reject', 'Rejected')}>Reject</Button>
                        </>
                      )}
                      {aff.status === 'approved' && (
                        <Button size="sm" variant="danger" icon={<Ban size={13} />} loading={acting === aff._id} onClick={() => runAction(aff._id, 'terminate', 'Terminated')}>Terminate</Button>
                      )}
                      {aff.status === 'suspended' && (
                        <Button size="sm" variant="primary" icon={<RotateCcw size={13} />} loading={acting === aff._id} onClick={() => runAction(aff._id, 'reactivate', 'Reactivated')}>Reactivate</Button>
                      )}
                    </div>

                    {!detail ? (
                      <p className="text-[10px] text-slate-400">Loading...</p>
                    ) : detail.referredUsers.length === 0 ? (
                      <p className="text-[10px] text-slate-400">No referred users yet.</p>
                    ) : (
                      <div className="bg-slate-50 rounded-xl overflow-hidden">
                        <table className="w-full text-[10px]">
                          <thead>
                            <tr className="text-left text-slate-500 font-bold uppercase">
                              <th className="px-3 py-2">Name</th>
                              <th className="px-3 py-2">Email</th>
                              <th className="px-3 py-2">Plan</th>
                              <th className="px-3 py-2">Signed Up</th>
                              <th className="px-3 py-2 text-right">Commission</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detail.referredUsers.map(u => (
                              <tr key={u.referredUser} className="border-t border-slate-200">
                                <td className="px-3 py-2 font-bold text-slate-800">{u.name}</td>
                                <td className="px-3 py-2 text-slate-500">{u.email}</td>
                                <td className="px-3 py-2">
                                  {u.paid ? <Badge variant="info">{u.plan}</Badge> : <Badge variant="warning">Pending - no payment yet</Badge>}
                                </td>
                                <td className="px-3 py-2 text-slate-500">
                                  {new Date(u.paid ? u.firstPaymentAt : u.signedUpAt).toLocaleDateString()}
                                </td>
                                <td className="px-3 py-2 text-right font-black text-emerald-600">
                                  {u.paid ? `$${u.totalCommission.toFixed(2)}` : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
