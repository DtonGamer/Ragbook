import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, Clock, FileText, Loader2, PauseCircle } from "lucide-react";
import { memo, useState } from "react";

interface DocumentStatusIndicatorProps {
  status: 'pending' | 'queued' | 'processing' | 'completed' | 'failed' | 'partial' | 'canceled';
  progress?: number;
  error?: string;
  estimatedTime?: string;
  className?: string;
}

export const DocumentStatusIndicator = memo(({ 
  status, 
  progress = 0, 
  error,
  estimatedTime,
  className 
}: DocumentStatusIndicatorProps) => {
  const [showDetails, setShowDetails] = useState(false);

  const getStatusConfig = () => {
    switch (status) {
      case 'pending':
        return {
          icon: Clock,
          text: 'Pending',
          color: 'bg-yellow-500',
          bg: 'bg-yellow-100',
          textClass: 'text-yellow-800',
          progressColor: 'bg-yellow-500',
          description: 'Document is waiting to be processed'
        };
      case 'queued':
        return {
          icon: PauseCircle,
          text: 'Queued',
          color: 'bg-purple-500',
          bg: 'bg-purple-100',
          textClass: 'text-purple-800',
          progressColor: 'bg-purple-500',
          description: 'Document is in processing queue'
        };
      case 'processing':
        return {
          icon: Loader2,
          text: 'Processing...',
          color: 'bg-blue-500',
          bg: 'bg-blue-100',
          textClass: 'text-blue-800',
          progressColor: 'bg-blue-500',
          description: 'Document is currently being processed'
        };
      case 'completed':
        return {
          icon: CheckCircle2,
          text: 'Completed',
          color: 'bg-green-500',
          bg: 'bg-green-100',
          textClass: 'text-green-800',
          progressColor: 'bg-green-500',
          description: 'Document processing completed successfully'
        };
      case 'failed':
        return {
          icon: AlertCircle,
          text: 'Failed',
          color: 'bg-red-500',
          bg: 'bg-red-100',
          textClass: 'text-red-800',
          progressColor: 'bg-red-500',
          description: 'Document processing failed'
        };
      case 'partial':
        return {
          icon: FileText,
          text: 'Partial',
          color: 'bg-orange-500',
          bg: 'bg-orange-100',
          textClass: 'text-orange-800',
          progressColor: 'bg-orange-500',
          description: 'Document processed with partial results'
        };
      case 'canceled':
        return {
          icon: AlertCircle,
          text: 'Canceled',
          color: 'bg-gray-500',
          bg: 'bg-gray-100',
          textClass: 'text-gray-800',
          progressColor: 'bg-gray-500',
          description: 'Document processing was canceled'
        };
      default:
        return {
          icon: Clock,
          text: 'Unknown',
          color: 'bg-gray-500',
          bg: 'bg-gray-100',
          textClass: 'text-gray-800',
          progressColor: 'bg-gray-500',
          description: 'Unknown status'
        };
    }
  };

  const config = getStatusConfig();
  const IconComponent = config.icon;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-2" role="status" aria-label={`${config.text} - ${config.description}`}>
        <div className={cn("w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0", config.bg)}>
          <IconComponent 
            className={cn("w-4 h-4", config.textClass)} 
            aria-hidden="true"
          />
        </div>
        <div>
          <div className={cn("font-medium text-sm", config.textClass)}>
            {config.text}
          </div>
          {estimatedTime && status === 'queued' && (
            <div className="text-xs text-muted-foreground">
              Est. {estimatedTime}
            </div>
          )}
        </div>
      </div>

      {(status === 'processing' || status === 'queued') && (
        <div className="w-full" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress 
            value={progress} 
            className="h-2"
            indicatorClassName={config.progressColor}
          />
        </div>
      )}

      {error && status === 'failed' && (
        <div 
          className="text-xs text-red-600 mt-1 cursor-pointer flex items-start gap-1"
          onClick={() => setShowDetails(!showDetails)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setShowDetails(!showDetails);
            }
          }}
          tabIndex={0}
          role="button"
          aria-expanded={showDetails}
          aria-label="Show error details"
        >
          <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" aria-hidden="true" />
          <span>{error.length > 50 ? `${error.substring(0, 50)}...` : error}</span>
        </div>
      )}

      {showDetails && error && (
        <div 
          className="text-xs text-red-600 p-2 bg-red-50 rounded border border-red-200 mt-1"
          role="alert"
          aria-live="polite"
        >
          {error}
        </div>
      )}
    </div>
  );
});

// Add a display name for better debugging
DocumentStatusIndicator.displayName = 'DocumentStatusIndicator';