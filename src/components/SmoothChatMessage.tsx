import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface SmoothChatMessageProps {
  message: string;
  isUser: boolean;
  isNew?: boolean;
  isStreaming?: boolean;
  className?: string;
}

/**
 * SmoothChatMessage Component
 * 
 * Displays a single chat message with smooth entrance animations.
 * 
 * Features:
 * - Gentle slide-up and fade-in for new messages
 * - Different styling for user vs assistant messages
 * - Streaming indicator for messages being generated
 * - Responsive width that adapts to screen size
 * - Smooth scroll into view when appearing
 */
export function SmoothChatMessage({ 
  message, 
  isUser, 
  isNew = false,
  isStreaming = false,
  className 
}: SmoothChatMessageProps) {
  const [isVisible, setIsVisible] = useState(!isNew);
  const messageRef = useRef<HTMLDivElement>(null);

  /**
   * Trigger entrance animation for new messages.
   * We use requestAnimationFrame to ensure the DOM has settled
   * before starting the animation, preventing layout thrashing.
   */
  useEffect(() => {
    if (isNew && !isVisible) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    }
  }, [isNew, isVisible]);

  /**
   * Smoothly scroll new messages into view.
   * This ensures users always see the latest message without
   * jarring jumps.
   */
  useEffect(() => {
    if (isNew && isVisible && messageRef.current) {
      messageRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
      });
    }
  }, [isNew, isVisible]);

  return (
    <div
      ref={messageRef}
      className={cn(
        'flex w-full mb-4',
        isUser ? 'justify-end' : 'justify-start',
        className
      )}
    >
      <div
        className={cn(
          // Base styles
          'px-4 py-3 rounded-2xl max-w-[85%] md:max-w-[70%] lg:max-w-[60%]',
          // Animation styles
          'transform transition-all duration-400',
          isVisible
            ? 'translate-y-0 opacity-100'
            : 'translate-y-4 opacity-0',
          // User vs assistant styling
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-muted text-foreground rounded-bl-sm',
          // Streaming indicator
          isStreaming && 'animate-pulse'
        )}
        style={{
          // Custom spring easing for a gentle bounce effect
          transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        <p className="text-sm md:text-base leading-relaxed whitespace-pre-wrap break-words">
          {message}
        </p>
        
        {/* Streaming indicator dots */}
        {isStreaming && (
          <div className="flex gap-1 mt-2">
            <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        )}
      </div>
    </div>
  );
}

