import React, { useState, useEffect, useCallback } from 'react';
import { useNotification } from '../context/NotificationContext';
import { Bot, Send, ChevronDown, ChevronRight, CheckCircle2, Play, X } from 'lucide-react';
import { agentService } from '../services/api';
import Button from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { LoadingState } from '../components/ui/LoadingState';
import EmptyState from '../components/ui/EmptyState';

const STATUS_BADGE = {
  draft: { variant: 'neutral', label: 'Draft' },
  awaiting_approval: { variant: 'warning', label: 'Awaiting Approval' },
  approved: { variant: 'info', label: 'Approved' },
  queued: { variant: 'neutral', label: 'Queued' },
  running: { variant: 'info', label: 'Running' },
  verifying: { variant: 'info', label: 'Verifying' },
  completed: { variant: 'success', label: 'Completed' },
  partially_completed: { variant: 'warning', label: 'Partially Completed' },
  failed: { variant: 'danger', label: 'Failed' },
  cancelled: { variant: 'neutral', label: 'Cancelled' },
  rejected: { variant: 'danger', label: 'Rejected' },
  expired: { variant: 'neutral', label: 'Expired' },
};

export default function AiAgents() {
  const { toast } = useNotification();
  const [loading, setLoading] = useState(true);
  const [goal, setGoal] = useState('');
  const [creating, setCreating] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [taskDetails, setTaskDetails] = useState({});
  const [actingOn, setActingOn] = useState(null);

  const loadTasks = useCallback(async () => {
    try {
      const res = await agentService.listTasks();
      setTasks(res.data?.tasks || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load agent tasks.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const handleCreate = async () => {
    if (!goal.trim()) return;
    setCreating(true);
    try {
      await agentService.createTask(goal.trim());
      toast.success('Agent task created - review the draft plan before approving it.');
      setGoal('');
      await loadTasks();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create agent task.');
    } finally {
      setCreating(false);
    }
  };

  const toggleExpand = async (id) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!taskDetails[id]) {
      try {
        const res = await agentService.getTask(id);
        setTaskDetails(prev => ({ ...prev, [id]: res.data }));
      } catch (_err) {
        toast.error('Failed to load task details.');
      }
    }
  };

  const handleApprove = async (id) => {
    setActingOn(id);
    try {
      await agentService.approveTask(id);
      toast.success('Task approved.');
      setTaskDetails(prev => { const next = { ...prev }; delete next[id]; return next; });
      await loadTasks();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve task.');
    } finally {
      setActingOn(null);
    }
  };

  const handleRun = async (id) => {
    setActingOn(id);
    try {
      const res = await agentService.runTask(id);
      toast.success(res.data?.task?.resultSummary || 'Task run completed.');
      setTaskDetails(prev => { const next = { ...prev }; delete next[id]; return next; });
      await loadTasks();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to run task.');
    } finally {
      setActingOn(null);
    }
  };

  const handleCancel = async (id) => {
    setActingOn(id);
    try {
      await agentService.cancelTask(id);
      toast.success('Task cancelled.');
      await loadTasks();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel task.');
    } finally {
      setActingOn(null);
    }
  };

  if (loading) return <LoadingState label="Loading AI Agents..." />;

  return (
    <div className="space-y-6">
      <p className="text-xs font-semibold text-slate-500 max-w-2xl">
        Describe a goal and the agent proposes a draft plan from read-only tools
        (inventory lookups, price comparisons, draft updates). Nothing publishes or
        changes a live listing until you explicitly approve and run it.
      </p>

      <div className="bg-white rounded-2xl border border-border p-5">
        <h3 className="text-xs font-black text-slate-700 uppercase tracking-wide mb-3">New Task</h3>
        <div className="flex items-stretch gap-2">
          <input
            type="text"
            value={goal}
            onChange={e => setGoal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="e.g. Review pricing on my stale Nike listings"
            className="flex-1 rounded-xl border border-border px-3.5 py-2.5 text-xs font-semibold outline-none focus:border-indigo-400"
          />
          <Button size="md" icon={<Send size={14} />} loading={creating} onClick={handleCreate}>
            Create Plan
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border p-5">
        <h3 className="text-xs font-black text-slate-700 uppercase tracking-wide mb-3">Tasks</h3>
        {tasks.length === 0 ? (
          <EmptyState icon={<Bot size={20} />} title="No agent tasks yet" description="Describe a goal above to get a draft plan." />
        ) : (
          <div className="space-y-2">
            {tasks.map(task => {
              const isExpanded = expandedId === task._id;
              const details = taskDetails[task._id];
              const statusMeta = STATUS_BADGE[task.status] || { variant: 'neutral', label: task.status };
              return (
                <div key={task._id} className="rounded-xl border border-border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleExpand(task._id)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                      <span className="text-xs font-bold text-slate-700">{task.goalText}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                      {task.riskLevel && <Badge variant="neutral">{task.riskLevel} risk</Badge>}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-border bg-slate-50/50">
                      {!details ? (
                        <div className="py-4 text-center text-[11px] font-semibold text-slate-400">Loading plan...</div>
                      ) : (
                        <div className="pt-3 space-y-3">
                          {details.steps?.length > 0 && (
                            <div className="space-y-1.5">
                              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Plan Steps</p>
                              {details.steps.map((step, i) => (
                                <div key={step._id || i} className="text-[11px] font-semibold text-slate-600 flex items-start gap-2">
                                  <span className="text-slate-400">{i + 1}.</span>
                                  <span>{step.toolName}: {JSON.stringify(step.inputJson || {})}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center gap-2 pt-1">
                            {task.status === 'awaiting_approval' && (
                              <Button size="sm" icon={<CheckCircle2 size={13} />} loading={actingOn === task._id} onClick={() => handleApprove(task._id)}>
                                Approve
                              </Button>
                            )}
                            {task.status === 'approved' && (
                              <Button size="sm" icon={<Play size={13} />} loading={actingOn === task._id} onClick={() => handleRun(task._id)}>
                                Run
                              </Button>
                            )}
                            {['draft', 'awaiting_approval', 'approved'].includes(task.status) && (
                              <Button size="sm" variant="ghost" icon={<X size={13} />} loading={actingOn === task._id} onClick={() => handleCancel(task._id)}>
                                Cancel
                              </Button>
                            )}
                          </div>
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
    </div>
  );
}
