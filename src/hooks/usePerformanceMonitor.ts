import { useEffect, useRef } from 'react';

/**
 * A custom hook to measure and log component render performance
 * Useful for identifying performance bottlenecks across different browsers
 */
export const usePerformanceMonitor = (componentName: string) => {
  const renderStart = useRef<number | null>(null);

  // Track component mount/render time
  useEffect(() => {
    renderStart.current = performance.now();
    
    // Log the render time after the component has rendered
    const logRenderTime = () => {
      if (renderStart.current !== null) {
        const renderTime = performance.now() - renderStart.current;
        console.log(`${componentName} rendered in ${renderTime.toFixed(2)}ms`);
        
        // Log a warning if render time is too high
        if (renderTime > 16.67) { // More than one frame at 60fps
          console.warn(`${componentName} render time is high: ${renderTime.toFixed(2)}ms`);
        }
      }
    };

    // Use requestAnimationFrame to ensure the component has fully rendered
    const rafId = requestAnimationFrame(logRenderTime);
    
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [componentName]);

  // Function to measure specific operations
  const measure = (operation: () => void, operationName: string) => {
    const start = performance.now();
    operation();
    const end = performance.now();
    
    console.log(`${componentName} - ${operationName}: ${(end - start).toFixed(2)}ms`);
  };

  return { measure };
};