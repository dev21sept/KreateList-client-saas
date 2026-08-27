import React from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '../../utils/cn';

export default function EmptyState({ icon, title = 'Nothing here yet', description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-16 px-6', className)}>
      <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-border flex items-center justify-center text-slate-300 mb-4">
        {icon || <Inbox size={20} />}
      </div>
      <h3 className="text-xs font-black text-slate-700">{title}</h3>
      {description && (
        <p className="text-[11px] font-semibold text-text-dim mt-1.5 max-w-xs">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
