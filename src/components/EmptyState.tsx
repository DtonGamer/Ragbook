import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { FileText, Plus, Upload } from "lucide-react";
import { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
  };
  className?: string;
}

export const EmptyState = ({ 
  icon, 
  title, 
  description, 
  primaryAction, 
  secondaryAction,
  className 
}: EmptyStateProps) => {
  return (
    <Card 
      className={cn("flex flex-col items-center justify-center p-8 text-center", className)}
      role="status"
      aria-live="polite"
    >
      <CardContent className="flex flex-col items-center gap-4 p-6">
        <div 
          className="w-16 h-16 rounded-full bg-muted flex items-center justify-center"
          aria-hidden="true"
        >
          {icon || <FileText className="w-8 h-8 text-muted-foreground" />}
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2 justify-center pt-2" role="group" aria-label="Available actions">
          {primaryAction && (
            <Button 
              onClick={primaryAction.onClick}
              aria-label={primaryAction.label}
            >
              {primaryAction.icon || <Plus className="w-4 h-4 mr-2" />}
              {primaryAction.label}
            </Button>
          )}
          {secondaryAction && (
            <Button 
              variant="outline" 
              onClick={secondaryAction.onClick}
              aria-label={secondaryAction.label}
            >
              {secondaryAction.icon || <Upload className="w-4 h-4 mr-2" />}
              {secondaryAction.label}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};