import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Trash2, X, Zap } from "lucide-react";

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
  icon?: "trash" | "warning" | "close"| "zap";
}

export function ConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  icon = "warning",
}: ConfirmationDialogProps) {
  const getIcon = () => {
    switch (icon) {
      case "trash":
        return <Trash2 className="h-6 w-6" />;
      case "close":
        return <X className="h-6 w-6" />;
      case "warning":
      default:
        return <AlertTriangle className="h-6 w-6" />;
      case "zap":
        return <Zap className="h-6 w-6" />;
    }
  };

  const getIconColor = () => {
    if (variant === "destructive") {
      return "text-destructive";
    }
    return "text-amber-500";
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className={`flex-shrink-0 ${getIconColor()}`}>
              {getIcon()}
            </div>
            <div className="flex-1">
              <AlertDialogTitle className="text-left">{title}</AlertDialogTitle>
              <AlertDialogDescription className="text-left mt-2">
                {description}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel asChild>
            <Button variant="outline" className="w-full sm:w-auto">
              {cancelText}
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant={variant === "destructive" ? "destructive" : "default"}
              className="w-full sm:w-auto"
              onClick={onConfirm}
            >
              {confirmText}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
