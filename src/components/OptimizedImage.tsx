import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import React from "react";

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  fallback?: React.ReactNode;
}

/**
 * An optimized image component that handles loading states,
 * provides fallbacks, and optimizes for performance across browsers
 */
export const OptimizedImage = ({ 
  src, 
  alt, 
  width, 
  height, 
  className,
  fallback,
  ...props 
}: OptimizedImageProps) => {
  const [isLoading, setIsLoading] = React.useState(true);
  const [hasError, setHasError] = React.useState(false);

  const handleLoad = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  if (hasError) {
    return fallback || (
      <div className={cn("bg-muted flex items-center justify-center", className)}>
        <span className="text-muted-foreground text-sm">Image failed to load</span>
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {isLoading && (
        <Skeleton className={cn("absolute inset-0", className)} />
      )}
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        onLoad={handleLoad}
        onError={handleError}
        className={cn("transition-opacity duration-300", isLoading ? "opacity-0" : "opacity-100")}
        {...props}
      />
    </div>
  );
};