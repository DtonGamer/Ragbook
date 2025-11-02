import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentStatusIndicator } from "@/components/DocumentStatusIndicator";
import { cn } from "@/lib/utils";
import { 
  AlertCircle, 
  Calendar, 
  Download, 
  File, 
  FileText, 
  HardDrive, 
  Loader2,
  RefreshCw, 
  Trash2, 
  Zap 
} from "lucide-react";
import { memo, useState } from "react";

interface DocumentCardProps {
  id: string;
  name: string;
  size: number;
  type: string;
  createdAt: string;
  status: 'pending' | 'queued' | 'processing' | 'completed' | 'failed' | 'partial' | 'canceled';
  progress?: number;
  chunkCount?: number;
  needsOcr?: boolean;
  error?: string;
  onProcess?: (id: string) => void;
  onDelete?: (id: string) => void;
  onDownload?: (id: string) => void;
  onRetry?: (id: string) => void;
  className?: string;
}

export const DocumentCard = memo(({ 
  id, 
  name, 
  size, 
  type, 
  createdAt, 
  status, 
  progress = 0,
  chunkCount,
  needsOcr = false,
  error,
  onProcess,
  onDelete,
  onDownload,
  onRetry,
  className 
}: DocumentCardProps) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const getFileIcon = () => {
    if (type === 'application/pdf') return <File className="w-5 h-5 text-red-500" />;
    if (type.includes('text')) return <FileText className="w-5 h-5 text-blue-500" />;
    return <File className="w-5 h-5 text-gray-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleProcess = async () => {
    if (onProcess && !isProcessing) {
      setIsProcessing(true);
      try {
        await onProcess(id);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleRetry = async () => {
    if (onRetry && !isProcessing) {
      setIsProcessing(true);
      try {
        await onRetry(id);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  return (
    <Card 
      className={cn("hover:shadow-md transition-shadow flex flex-col h-full", className)}
      role="article"
      aria-label={`Document: ${name}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            <span className="sr-only">File type icon</span>
            {getFileIcon()}
            <CardTitle 
              className="text-sm truncate" 
              title={name}
              aria-label={`Document name: ${name}`}
            >
              {name}
            </CardTitle>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0 flex-1 flex flex-col justify-between">
        <div className="space-y-3">
          <DocumentStatusIndicator 
            status={status} 
            progress={progress} 
            error={error}
            className="mb-2"
          />

          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                <span className="sr-only">File size</span>
                <HardDrive className="w-3 h-3" aria-hidden="true" />
                {formatFileSize(size)}
              </span>
              <span className="flex items-center gap-1">
                <span className="sr-only">Upload date</span>
                <Calendar className="w-3 h-3" aria-hidden="true" />
                {formatDate(createdAt)}
              </span>
            </div>
            
            {chunkCount !== undefined && chunkCount > 0 && (
              <div className="flex items-center gap-2">
                <span 
                  className="text-xs px-2 py-1 bg-muted rounded"
                  aria-label={`Contains ${chunkCount} knowledge chunks`}
                >
                  {chunkCount} chunks
                </span>
              </div>
            )}
            
            {needsOcr && (
              <div className="flex items-center gap-2">
                <span 
                  className="text-xs px-2 py-1 bg-orange-100 text-orange-800 rounded border border-orange-200 flex items-center gap-1"
                  aria-label="Requires OCR processing"
                >
                  <span className="sr-only">OCR Required</span>
                  <FileText className="w-3 h-3" aria-hidden="true" />
                  OCR Required
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-4 flex-wrap" role="group" aria-label="Document actions">
          {(status === 'pending' || status === 'failed' || status === 'canceled') && (
            <Button
              size="sm"
              className="flex-1 min-w-[100px]"
              onClick={status === 'failed' || status === 'canceled' ? handleRetry : handleProcess}
              disabled={isProcessing}
              aria-label={
                status === 'failed' || status === 'canceled' 
                  ? "Retry processing this document" 
                  : "Process this document"
              }
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" aria-hidden="true" />
                  <span>Processing</span>
                </>
              ) : (
                <>
                  {status === 'failed' || status === 'canceled' ? (
                    <>
                      <RefreshCw className="w-3 h-3 mr-1" aria-hidden="true" />
                      <span>Retry</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3 h-3 mr-1" aria-hidden="true" />
                      <span>Process</span>
                    </>
                  )}
                </>
              )}
            </Button>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDownload && onDownload(id)}
            className="flex-shrink-0 px-3"
            aria-label="Download document"
          >
            <Download className="w-3 h-3" aria-hidden="true" />
            <span className="sr-only">Download</span>
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete && onDelete(id)}
            className="flex-shrink-0 px-3 text-destructive hover:text-destructive"
            aria-label="Delete document"
          >
            <Trash2 className="w-3 h-3" aria-hidden="true" />
            <span className="sr-only">Delete</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});

// Add a display name for better debugging
DocumentCard.displayName = 'DocumentCard';