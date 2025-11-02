import { forwardRef, InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface MobileInputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

/**
 * MobileInput Component
 * 
 * Input field optimized for mobile devices.
 * 
 * Features:
 * - Smooth focus transitions with border color and shadow
 * - 16px font size on mobile to prevent iOS zoom
 * - Touch-optimized height for easier tapping
 * - Smooth error state transitions
 * - Proper mobile keyboard handling
 */
export const MobileInput = forwardRef<HTMLInputElement, MobileInputProps>(
  ({ className, type = 'text', error = false, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          // Base styles
          'w-full rounded-lg border bg-background px-4 py-3',
          'transition-all duration-300 ease-out',
          'focus:outline-none focus:ring-2 focus:ring-primary/50',
          
          // Mobile optimizations
          'text-base md:text-sm', // 16px on mobile prevents zoom on iOS
          'min-h-[44px]', // Apple's recommended touch target size
          
          // Error state
          error
            ? 'border-destructive focus:ring-destructive/50'
            : 'border-input focus:border-primary',
          
          // Placeholder styling
          'placeholder:text-muted-foreground',
          
          // Disabled state
          'disabled:opacity-50 disabled:cursor-not-allowed',
          
          className
        )}
        {...props}
      />
    );
  }
);

MobileInput.displayName = 'MobileInput';

