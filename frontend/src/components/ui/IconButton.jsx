import React from 'react';
import { cn } from '../../utils/cn';

const VARIANTS = {
  default: 'text-slate-400 hover:text-indigo-600 hover:bg-slate-50 border border-border',
  active: 'text-indigo-600 bg-indigo-50 border border-indigo-100',
  ghost: 'text-slate-400 hover:text-slate-800 hover:bg-slate-50 border border-transparent',
  danger: 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent',
};

const SIZES = {
  sm: 'p-1.5',
  md: 'p-2.5',
  lg: 'p-3',
};

const IconButton = React.forwardRef(function IconButton(
  { variant = 'default', size = 'md', active = false, className, children, 'aria-label': ariaLabel, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={ariaLabel}
      className={cn(
        'relative inline-flex items-center justify-center rounded-2xl transition-all active:scale-95 cursor-pointer',
        VARIANTS[active ? 'active' : variant],
        SIZES[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});

export default IconButton;
