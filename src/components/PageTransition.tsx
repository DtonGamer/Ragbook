import { useLocation } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';

/**
 * PageTransition Component
 * 
 * Creates smooth crossfade transitions between routes.
 * Uses a two-stage process: fade out old content, then fade in new content.
 * 
 * How it works:
 * 1. When route changes, we detect it via useLocation
 * 2. We fade out the current content (still showing old route)
 * 3. After fade out completes (onTransitionEnd), we update the displayed content
 * 4. The new content automatically fades in
 * 
 * This prevents the jarring effect of instant content swaps.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [transitionStage, setTransitionStage] = useState<'fadeIn' | 'fadeOut'>('fadeIn');
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip transition on initial mount for instant first load
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // When route changes, start fade out transition
    if (location.pathname !== displayLocation.pathname) {
      setTransitionStage('fadeOut');
    }
  }, [location, displayLocation]);

  /**
   * This handler fires when the CSS transition completes.
   * We use it to update the content and trigger the fade in.
   */
  const handleTransitionEnd = () => {
    if (transitionStage === 'fadeOut') {
      // Fade out is complete, now update content and fade in
      setDisplayLocation(location);
      setTransitionStage('fadeIn');
    }
  };

  return (
    <div
      className={`
        transition-opacity duration-300 ease-out
        ${transitionStage === 'fadeOut' ? 'opacity-0' : 'opacity-100'}
      `}
      onTransitionEnd={handleTransitionEnd}
    >
      {children}
    </div>
  );
}

