import React from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '../../utils/cn';

export function LoadingState({ label = 'Loading...', className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-24 gap-3 text-text-dim', className)}>
      <RefreshCw className="animate-spin text-indigo-500" size={28} />
      <span className="text-[11px] font-extrabold tracking-widest uppercase">{label}</span>
    </div>
  );
}

export function Skeleton({ className }) {
  return <div className={cn('animate-pulse rounded-xl bg-card-bg-hover', className)} />;
}

export default LoadingState;
