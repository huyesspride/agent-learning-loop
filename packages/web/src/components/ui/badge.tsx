import * as React from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
        {
          'default': 'bg-blue-600 text-white',
          'secondary': 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100',
          'destructive': 'bg-red-600 text-white',
          'outline': 'border border-gray-300 dark:border-gray-500 text-gray-700 dark:text-gray-200',
        }[variant],
        className
      )}
      {...props}
    />
  );
}
