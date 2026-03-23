import * as React from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
          {
            'default': 'bg-blue-600 text-white hover:bg-blue-700',
            'outline': 'border border-gray-300 bg-white hover:bg-gray-50',
            'ghost': 'hover:bg-gray-100 hover:text-gray-900',
            'destructive': 'bg-red-600 text-white hover:bg-red-700',
            'secondary': 'bg-gray-100 text-gray-900 hover:bg-gray-200',
          }[variant],
          {
            'default': 'h-10 px-4 py-2',
            'sm': 'h-8 px-3 text-xs',
            'lg': 'h-12 px-8',
            'icon': 'h-10 w-10',
          }[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
