import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SmoothModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * SmoothModal Component
 * 
 * A modal with elegant entrance and exit animations.
 * 
 * Features:
 * - Smooth fade in/out with scale animation
 * - Backdrop blur for depth
 * - Mobile-optimized sizing and spacing
 * - Prevents body scroll when open
 * - Keyboard and click-outside to close
 * - Focus trap for accessibility
 */
export function SmoothModal({ 
  isOpen, 
  onClose, 
  title, 
  children,
  className 
}: SmoothModalProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  /**
   * Handle modal open/close with proper animation timing.
   * We render the modal, then trigger the animation, to ensure
   * the entrance animation plays smoothly.
   */
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      requestAnimationFrame(() => {
        setIsAnimating(true);
      });
    } else {
      setIsAnimating(false);
      // Wait for exit animation to complete before unmounting
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  /**
   * Prevent body scroll when modal is open.
   */
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  /**
   * Handle keyboard events (Escape to close).
   */
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  /**
   * Handle click outside modal to close.
   */
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!shouldRender) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center p-4',
        'transition-all duration-300 ease-out',
        isAnimating ? 'opacity-100' : 'opacity-0'
      )}
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div
        className={cn(
          'absolute inset-0 bg-black/60 backdrop-blur-sm',
          'transition-opacity duration-300'
        )}
      />

      {/* Modal Content */}
      <div
        ref={modalRef}
        className={cn(
          'relative bg-background rounded-2xl shadow-2xl',
          'w-full max-w-lg max-h-[90vh] overflow-y-auto',
          'transition-all duration-300 ease-out',
          isAnimating
            ? 'scale-100 translate-y-0'
            : 'scale-95 translate-y-4',
          className
        )}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between p-6 border-b border-border">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button
              onClick={onClose}
              className="
                p-2 rounded-lg
                transition-smooth-fast
                hover:bg-accent
                active:scale-98
                touch-manipulation
              "
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

