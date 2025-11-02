import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/components/ui/use-toast";

interface ToastNotificationProps {
  title: string;
  description?: string;
  variant?: "default" | "success" | "error" | "warning" | "info";
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
}

export const ToastNotification = ({ 
  title, 
  description, 
  variant = "default", 
  action,
  duration = 5000
}: ToastNotificationProps) => {
  const { toast } = useToast();

  const variantConfig = {
    default: { 
      icon: "ℹ️", 
      className: "border-gray-200" 
    },
    success: { 
      icon: "✅", 
      className: "border-green-200 bg-green-50" 
    },
    error: { 
      icon: "❌", 
      className: "border-red-200 bg-red-50" 
    },
    warning: { 
      icon: "⚠️", 
      className: "border-yellow-200 bg-yellow-50" 
    },
    info: { 
      icon: "ℹ️", 
      className: "border-blue-200 bg-blue-50" 
    }
  };

  const config = variantConfig[variant];

  toast({
    title,
    description: description ? (
      <div className="flex items-start gap-2">
        <span>{config.icon}</span>
        <span>{description}</span>
      </div>
    ) : undefined,
    className: config.className,
    action: action ? (
      <ToastAction 
        altText={action.label} 
        onClick={action.onClick}
        className="bg-primary text-primary-foreground hover:bg-primary/90"
      >
        {action.label}
      </ToastAction>
    ) : undefined,
    duration,
  });
};