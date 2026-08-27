import React from 'react';
import { cn } from '../../utils/cn';

export default function Card({ as: As = 'div', className, children, hover = false, ...props }) {
  return (
    <As
      className={cn(
        'bg-card-bg border border-border rounded-3xl shadow-card',
        hover && 'transition-all hover:border-border-strong hover:shadow-card-hover',
        className
      )}
      {...props}
    >
      {children}
    </As>
  );
}
