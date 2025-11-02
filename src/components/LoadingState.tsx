import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface LoadingStateProps {
  isLoading?: boolean;
  size?: "sm" | "md" | "lg";
  message?: string;
  className?: string;
  children?: React.ReactNode;
}

export const LoadingState = ({ 
  isLoading = true, 
  size = "md", 
  message = "Loading...", 
  className,
  children
}: LoadingStateProps) => {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-12 h-12"
  };

  if (!isLoading) {
    return children ? <>{children}</> : null;
  }

  return (
    <div 
      className={cn(
        "flex flex-col items-center justify-center gap-4 py-12",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2 
        className={cn(
          "animate-spin text-primary",
          sizeClasses[size]
        )} 
        aria-hidden="true"
      />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
};

interface SkeletonProps {
  className?: string;
}

export const Skeleton = ({ className }: SkeletonProps) => {
  return (
    <div 
      className={cn(
        "animate-pulse rounded-md bg-muted",
        className
      )} 
      role="progressbar"
      aria-valuetext="Loading"
      aria-busy="true"
    />
  );
};