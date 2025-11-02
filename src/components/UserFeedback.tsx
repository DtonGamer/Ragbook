import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, ChevronDown, ChevronUp, Lightbulb, MessageCircle, ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface UserFeedbackProps {
  messageId: string;
  userId: string;
  onFeedbackSubmitted?: () => void;
}

type FeedbackType = 'helpful' | 'not_helpful' | 'suggest_alternative' | 'confused' | 'frustrated';

export const UserFeedback = ({ messageId, userId, onFeedbackSubmitted }: UserFeedbackProps) => {
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackType | null>(null);
  const [feedbackContent, setFeedbackContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const feedbackOptions = [
    {
      type: 'helpful' as const,
      label: 'Helpful',
      icon: ThumbsUp,
      color: 'text-green-600 hover:text-green-700',
      bgColor: 'hover:bg-green-50'
    },
    {
      type: 'not_helpful' as const,
      label: 'Not helpful',
      icon: ThumbsDown,
      color: 'text-red-600 hover:text-red-700',
      bgColor: 'hover:bg-red-50'
    },
    {
      type: 'suggest_alternative' as const,
      label: 'Suggest alternative',
      icon: Lightbulb,
      color: 'text-blue-600 hover:text-blue-700',
      bgColor: 'hover:bg-blue-50'
    },
    {
      type: 'confused' as const,
      label: 'Confused',
      icon: MessageCircle,
      color: 'text-yellow-600 hover:text-yellow-700',
      bgColor: 'hover:bg-yellow-50'
    },
    {
      type: 'frustrated' as const,
      label: 'Frustrated',
      icon: AlertCircle,
      color: 'text-orange-600 hover:text-orange-700',
      bgColor: 'hover:bg-orange-50'
    }
  ];

  const handleFeedbackSubmit = async () => {
    if (!selectedFeedback) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('user_feedback')
        .insert({
          user_id: userId,
          message_id: messageId,
          feedback_type: selectedFeedback,
          feedback_content: feedbackContent.trim() || null
        });

      if (error) {
        throw error;
      }

      toast.success("Thank you for your feedback! It helps me learn and improve.");
      setSelectedFeedback(null);
      setFeedbackContent("");
      setShowDetails(false);
      onFeedbackSubmitted?.();
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast.error("Failed to submit feedback. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFeedbackSelect = (type: FeedbackType) => {
    setSelectedFeedback(type);
    if (type === 'suggest_alternative' || type === 'confused' || type === 'frustrated') {
      setShowDetails(true);
    } else {
      setShowDetails(false);
      setFeedbackContent("");
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-border/30">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between hover:bg-muted/30 transition-colors rounded-lg p-2 -m-2"
      >
        <div className="flex items-center gap-2">
          <ThumbsUp className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-medium">Was this response helpful?</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-3 h-3 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            {feedbackOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = selectedFeedback === option.type;
              
              return (
                <Button
                  key={option.type}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleFeedbackSelect(option.type)}
                  className={`h-8 px-3 text-xs transition-all duration-200 ${
                    isSelected 
                      ? 'bg-primary text-primary-foreground' 
                      : `${option.color} ${option.bgColor} border-border/50`
                  }`}
                >
                  <Icon className="w-3 h-3 mr-1" />
                  {option.label}
                </Button>
              );
            })}
          </div>

          {showDetails && (
            <div className="space-y-2">
              <textarea
                value={feedbackContent}
                onChange={(e) => setFeedbackContent(e.target.value)}
                placeholder={
                  selectedFeedback === 'suggest_alternative' 
                    ? "What would you have preferred instead?"
                    : selectedFeedback === 'confused'
                    ? "What specifically confused you?"
                    : "What frustrated you about this response?"
                }
                className="w-full px-3 py-2 text-xs border border-border/50 rounded-lg bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
                rows={2}
                maxLength={500}
              />
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">
                  {feedbackContent.length}/500 characters
                </span>
                <Button
                  onClick={handleFeedbackSubmit}
                  disabled={isSubmitting || !selectedFeedback}
                  size="sm"
                  className="h-7 px-3 text-xs"
                >
                  {isSubmitting ? "Submitting..." : "Submit"}
                </Button>
              </div>
            </div>
          )}

          {selectedFeedback && !showDetails && (
            <div className="flex justify-end">
              <Button
                onClick={handleFeedbackSubmit}
                disabled={isSubmitting}
                size="sm"
                className="h-7 px-3 text-xs"
              >
                {isSubmitting ? "Submitting..." : "Submit"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
