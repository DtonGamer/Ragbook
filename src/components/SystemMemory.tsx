import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { Brain, ChevronDown, ChevronUp, Clock, Database, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";

interface SystemMemoryProps {
  userId: string;
  className?: string;
}

type MemoryItem = Tables<'system_memory'>;

export const SystemMemory = ({ userId, className }: SystemMemoryProps) => {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMemories();
  }, [userId]);

  const loadMemories = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('system_memory')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setMemories(data || []);
    } catch (err) {
      console.error('Error loading system memory:', err);
      setError('Failed to load system memory');
    } finally {
      setIsLoading(false);
    }
  };

  const getMemoryIcon = (type: string) => {
    switch (type) {
      case 'preference':
        return <TrendingUp className="w-4 h-4 text-blue-500" />;
      case 'pattern':
        return <Brain className="w-4 h-4 text-purple-500" />;
      case 'adaptation':
        return <Database className="w-4 h-4 text-green-500" />;
      case 'feedback':
        return <Clock className="w-4 h-4 text-orange-500" />;
      default:
        return <Brain className="w-4 h-4 text-gray-500" />;
    }
  };

  const getMemoryTypeLabel = (type: string) => {
    switch (type) {
      case 'preference':
        return 'User Preference';
      case 'pattern':
        return 'Interaction Pattern';
      case 'adaptation':
        return 'System Adaptation';
      case 'feedback':
        return 'Feedback Learning';
      default:
        return 'Memory';
    }
  };

  const formatMemoryContent = (content: any, type: string) => {
    if (typeof content === 'string') {
      return content;
    }
    
    if (typeof content === 'object' && content !== null) {
      switch (type) {
        case 'preference':
          return Object.entries(content)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ');
        case 'pattern':
          return Object.entries(content)
            .map(([key, value]) => `${key} (${value} times)`)
            .join(', ');
        case 'adaptation':
          return content.description || JSON.stringify(content);
        case 'feedback':
          return content.summary || JSON.stringify(content);
        default:
          return JSON.stringify(content);
      }
    }
    
    return 'No content available';
  };

  if (isLoading) {
    return (
      <div className={cn("p-4 border border-border/50 rounded-lg bg-card/50", className)}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Brain className="w-4 h-4 animate-pulse" />
          <span>Loading system memory...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("p-4 border border-red-200 rounded-lg bg-red-50", className)}>
        <div className="flex items-center gap-2 text-sm text-red-600">
          <Brain className="w-4 h-4" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (memories.length === 0) {
    return null;
  }

  return (
    <div className={cn("border border-border/50 rounded-lg bg-card/50", className)}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          <div className="text-left">
            <h3 className="font-medium text-sm">System Memory</h3>
            <p className="text-xs text-muted-foreground">
              {memories.length} memory {memories.length === 1 ? 'item' : 'items'}
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-border/50 p-4 space-y-3">
          {memories.map((memory) => (
            <div
              key={memory.id}
              className="p-3 bg-muted/30 rounded-lg border border-border/30"
            >
              <div className="flex items-start gap-2 mb-2">
                {getMemoryIcon(memory.memory_type)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-foreground">
                      {getMemoryTypeLabel(memory.memory_type)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({Math.round(memory.confidence * 100)}% confidence)
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {formatMemoryContent(memory.content, memory.memory_type)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(memory.created_at).toLocaleDateString()} at{' '}
                    {new Date(memory.created_at).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
          
          <div className="pt-2 border-t border-border/30">
            <p className="text-xs text-muted-foreground text-center">
              This is what I've learned about your preferences and patterns.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
