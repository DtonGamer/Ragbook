import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface DevConsoleToggleProps {
  onToggle: (enabled: boolean) => void;
}

export const DevConsoleToggle = ({ onToggle }: DevConsoleToggleProps) => {
  const [isEnabled, setIsEnabled] = useState(false);

  const handleToggle = () => {
    const newState = !isEnabled;
    setIsEnabled(newState);
    onToggle(newState);
  };

  // Only show in development
  if (import.meta.env.PROD) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50">
      <Button
        variant={isEnabled ? "default" : "outline"}
        size="sm"
        onClick={handleToggle}
        className="flex items-center gap-2"
      >
        <span className="text-xs">Console</span>
        <Badge variant={isEnabled ? "default" : "secondary"} className="text-xs">
          {isEnabled ? "ON" : "OFF"}
        </Badge>
      </Button>
    </div>
  );
};
