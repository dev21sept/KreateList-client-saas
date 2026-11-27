import React, { useState, useEffect, useCallback } from 'react';
import { useNotification } from '../context/NotificationContext';
import { Plug, Plus, Copy, Trash2, Key } from 'lucide-react';
import { connectService } from '../services/api';
import Button from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { LoadingState } from '../components/ui/LoadingState';
import EmptyState from '../components/ui/EmptyState';

const ALL_SCOPES = ['listings:write', 'inventory:read', 'inventory:write', 'orders:read', 'webhooks:manage'];

export default function Connect() {
  const { toast } = useNotification();
  const [loading, setLoading] = useState(true);
  const [credentials, setCredentials] = useState([]);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState(['inventory:read', 'orders:read']);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState(null);
  const [actingOn, setActingOn] = useState(null);

  const loadCredentials = useCallback(async () => {
    try {
      const res = await connectService.listCredentials();
      setCredentials(res.data?.credentials || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load API credentials.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCredentials(); }, [loadCredentials]);

  const toggleScope = (scope) => {
    setScopes(prev => prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]);
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await connectService.createCredential(name.trim() || 'Default key', scopes);
      setNewKey(res.data?.apiKey);
      setName('');
      await loadCredentials();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create API key.');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id) => {
    setActingOn(id);
    try {
      await connectService.revokeCredential(id);
      toast.success('API key revoked.');
      await loadCredentials();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to revoke key.');
    } finally {
      setActingOn(null);
    }
  };

  const copyKey = (key) => {
    navigator.clipboard.writeText(key);
    toast.success('Copied to clipboard.');
  };

  if (loading) return <LoadingState label="Loading eLister Connect..." />;

  return (
    <div className="space-y-6">
      <p className="text-xs font-semibold text-slate-500 max-w-2xl">
        eLister Connect lets an external system (your own script, a custom integration)
        read and write your listings/inventory/orders via a scoped API key, and
        receive signed webhooks on status changes. Base URL: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-bold">/api/connect/v1</code>
      </p>

      {newKey && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-black text-amber-700 uppercase tracking-wide">New API Key - copy it now, it won't be shown again</p>
            <code className="text-xs font-bold text-amber-900">{newKey}</code>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="secondary" icon={<Copy size={13} />} onClick={() => copyKey(newKey)}>Copy</Button>
            <Button size="sm" variant="ghost" onClick={() => setNewKey(null)}>Dismiss</Button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-border p-5">
        <h3 className="text-xs font-black text-slate-700 uppercase tracking-wide mb-3">Create API Key</h3>
        <div className="space-y-3">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Key name (e.g. Inventory bot)"
            className="w-full rounded-xl border border-border px-3.5 py-2.5 text-xs font-semibold outline-none focus:border-indigo-400"
          />
          <div className="flex items-center gap-2 flex-wrap">
            {ALL_SCOPES.map(scope => (
              <button
                key={scope}
                type="button"
                onClick={() => toggleScope(scope)}
                className={`px-3 h-7 rounded-lg text-[11px] font-bold transition-colors ${
                  scopes.includes(scope) ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {scope}
              </button>
            ))}
          </div>
          <Button size="md" icon={<Plus size={14} />} loading={creating} onClick={handleCreate}>
            Generate Key
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border p-5">
        <h3 className="text-xs font-black text-slate-700 uppercase tracking-wide mb-3">Your API Keys</h3>
        {credentials.length === 0 ? (
          <EmptyState icon={<Key size={20} />} title="No API keys yet" description="Generate one above to start calling the Connect API." />
        ) : (
          <div className="space-y-2">
            {credentials.map(cred => (
              <div key={cred._id} className="rounded-xl border border-border p-3.5 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-800">{cred.name}</span>
                    {cred.revokedAt ? <Badge variant="danger">Revoked</Badge> : <Badge variant="success">Active</Badge>}
                  </div>
                  <p className="text-[10px] font-semibold text-slate-400 mt-1">{cred.keyPrefix}... · {(cred.scopes || []).join(', ')}</p>
                </div>
                {!cred.revokedAt && (
                  <Button size="sm" variant="ghost" icon={<Trash2 size={13} />} loading={actingOn === cred._id} onClick={() => handleRevoke(cred._id)}>
                    Revoke
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
