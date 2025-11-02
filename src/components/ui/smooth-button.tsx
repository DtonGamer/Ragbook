import { forwardRef, ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface SmoothButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
}

/**
 * SmoothButton Component
 * 
 * A button with calm, tactile micro-interactions.
 * 
 * Features:
 * - Subtle scale on hover (102%)
 * - Gentle press effect on click (98%)
 * - Smooth shadow transitions
 * - Touch-optimized for mobile
 * - Accessible focus states
 */
export const SmoothButton = forwardRef<HTMLButtonElement, SmoothButtonProps>(
  ({ className, variant = 'default', size = 'default', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          // Base styles
          'inline-flex items-center justify-center rounded-lg font-medium',
          'transition-all duration-200 ease-out',
          'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2',
          'disabled:opacity-50 disabled:pointer-events-none',
          'touch-manipulation',
          
          // Hover and active states
          'hover:scale-102 active:scale-98',
          
          // Variant styles
          variant === 'default' && 'bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-lg',
          variant === 'secondary' && 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
          variant === 'outline' && 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
          variant === 'ghost' && 'hover:bg-accent hover:text-accent-foreground',
          
          // Size variants
          size === 'default' && 'h-10 px-4 py-2 text-sm',
          size === 'sm' && 'h-8 px-3 py-1 text-xs',
          size === 'lg' && 'h-12 px-6 py-3 text-base',
          
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

SmoothButton.displayName = 'SmoothButton';

