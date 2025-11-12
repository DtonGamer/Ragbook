import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bot, FileText, Search, ChevronDown, Zap, BookOpen } from "lucide-react";

export type ChatMode = "auto" | "document" | "general";

interface ModeSelectorProps {
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
}

export const ModeSelector = ({ mode, onModeChange }: ModeSelectorProps) => {
  const getModeConfig = () => {
    switch (mode) {
      case "auto":
        return {
          label: "Auto",
          icon: <Zap className="w-4 h-4" />,
          description: "AI decides whether to search documents",
          color: "text-yellow-600 dark:text-yellow-400",
          bgColor: "bg-yellow-50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/30"
        };
      case "document":
        return {
          label: "Documents",
          icon: <Search className="w-4 h-4" />,
          description: "Search your uploaded documents",
          color: "text-blue-600 dark:text-blue-400",
          bgColor: "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30"
        };
      case "general":
        return {
          label: "General",
          icon: <BookOpen className="w-4 h-4" />,
          description: "Use general knowledge only",
          color: "text-green-600 dark:text-green-400",
          bgColor: "bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30"
        };
    }
  };

  const modeConfig = getModeConfig();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-9 gap-2 min-w-0 px-3 border ${modeConfig.bgColor} hover:${modeConfig.bgColor.replace('bg-', 'hover:bg-')}`}
        >
          <span className={`${modeConfig.color} flex items-center justify-center`}>
            {modeConfig.icon}
          </span>
          <span className="font-medium hidden sm:inline">{modeConfig.label}</span>
          <ChevronDown className="w-3.5 h-3.5 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-1">
        <DropdownMenuItem 
          onClick={() => onModeChange("auto")}
          className={`cursor-pointer p-0 my-1 rounded-lg ${mode === "auto" ? modeConfig.bgColor : "hover:bg-accent"}`}
        >
          <div className="flex items-center gap-3 p-3 w-full">
            <div className={`p-2 rounded-lg ${mode === "auto" ? modeConfig.bgColor : "bg-muted"}`}>
              <Zap className={`w-5 h-5 ${mode === "auto" ? modeConfig.color : "text-muted-foreground"}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">Auto (Recommended)</div>
              <div className="text-xs text-muted-foreground leading-relaxed">
                AI intelligently decides when to search documents or use general knowledge
              </div>
            </div>
            
          {mode === "auto" && (
              <div className="flex-shrink-0">
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
              </div>
            )} 
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => onModeChange("document")}
          className={`cursor-pointer p-0 my-1 rounded-lg ${mode === "document" ? modeConfig.bgColor : "hover:bg-accent"}`}
        >
          <div className="flex items-center gap-3 p-3 w-full">
            <div className={`p-2 rounded-lg ${mode === "document" ? modeConfig.bgColor : "bg-muted"}`}>
              <Search className={`w-5 h-5 ${mode === "document" ? modeConfig.color : "text-muted-foreground"}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">Document Search</div>
              <div className="text-xs text-muted-foreground leading-relaxed">
                Search your uploaded documents and course materials
              </div>
            </div>
            {mode === "document" && (
              <div className="flex-shrink-0">
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
              </div>
            )} 
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => onModeChange("general")}
          className={`cursor-pointer p-0 my-1 rounded-lg ${mode === "general" ? modeConfig.bgColor : "hover:bg-accent"}`}
        >
          <div className="flex items-center gap-3 p-3 w-full">
            <div className={`p-2 rounded-lg ${mode === "general" ? modeConfig.bgColor : "bg-muted"}`}>
              <BookOpen className={`w-5 h-5 ${mode === "general" ? modeConfig.color : "text-muted-foreground"}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">General Knowledge</div>
              <div className="text-xs text-muted-foreground leading-relaxed">
                Use general knowledge without searching documents
              </div>
            </div>
            {mode === "general" && (
              <div className="flex-shrink-0">
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
              </div>
            )} 
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};