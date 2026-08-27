import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

const VARIANTS = {
  primary: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20',
  secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-700',
  ghost: 'bg-transparent hover:bg-slate-100 text-slate-500 hover:text-slate-800',
  danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-500/20',
  outline: 'bg-transparent border border-border hover:border-border-strong text-slate-700 hover:bg-slate-50',
};

const SIZES = {
  sm: 'px-3.5 py-2 text-[11px] gap-1.5 rounded-lg',
  md: 'px-5 py-2.5 text-xs gap-2 rounded-xl',
  lg: 'px-6 py-3.5 text-sm gap-2.5 rounded-2xl',
};

const Button = React.forwardRef(function Button(
  { as: As = 'button', variant = 'primary', size = 'md', loading = false, disabled = false, icon, iconRight, className, children, ...props },
  ref
) {
  return (
    <As
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-bold transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 disabled:cursor-not-allowed cursor-pointer select-none',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    >
      {loading ? (
        <Loader2 size={size === 'sm' ? 13 : size === 'lg' ? 18 : 15} className="animate-spin" />
      ) : (
        icon && <span className="shrink-0">{icon}</span>
      )}
      {children && <span>{children}</span>}
      {!loading && iconRight && <span className="shrink-0">{iconRight}</span>}
    </As>
  );
});

export default Button;
