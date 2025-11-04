import { cn } from "@/lib/utils";
import { Bot, Brain, Check, ChevronDown, ChevronUp, Copy, Eye, User } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { UserFeedback } from "./UserFeedback";
import ReactMarkdown from 'react-markdown';

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  sources?: Array<{
    type: string;
    content?: string;
    similarity?: number;
    title?: string;
    url?: string;
    description?: string;
  }>;
  isNew?: boolean;
  isStreaming?: boolean;
  messageId?: string;
  userId?: string;
}

export const ChatMessage = memo(({ 
  role, 
  content, 
  sources, 
  isNew = false, 
  isStreaming = false, 
  messageId,
  userId
}: ChatMessageProps) => {
  const isUser = role === "user";
  const [copied, setCopied] = useState(false);
  const [isVisible, setIsVisible] = useState(!isNew);
  const [showAllDetails, setShowAllDetails] = useState(false);
  const messageRef = useRef<HTMLDivElement>(null);

  /**
   * Trigger entrance animation for new messages.
   * We use requestAnimationFrame to ensure the DOM has settled
   * before starting the animation, preventing layout thrashing.
   */
  useEffect(() => {
    if (isNew && !isVisible) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    }
  }, [isNew, isVisible]);

  /**
   * Smoothly scroll new messages into view.
   * This ensures users always see the latest message without
   * jarring jumps.
   */
  useEffect(() => {
    if (isNew && isVisible && messageRef.current) {
      messageRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
      });
    }
  }, [isNew, isVisible]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success("Message copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy message");
    }
  };

  // Memoize the sources content to prevent unnecessary re-renders
  const sourcesContent = sources && sources.length > 0 && (
    <div>
      <p className="text-xs text-muted-foreground mb-2 font-medium">Sources:</p>
      <div className="space-y-2">
        {sources.map((source, idx) => (
          <div key={idx} className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
            {source.type === 'knowledge_base' ? (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-primary">Knowledge Base</span>
                  {source.similarity && (
                    <span className="text-muted-foreground">
                      ({(source.similarity * 100).toFixed(0)}% match)
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground leading-relaxed">{source.content}</p>
              </>
            ) : (
              <>
                <div className="font-medium text-secondary mb-1">{source.title}</div>
                <p className="text-muted-foreground mb-1">{source.description}</p>
                <a 
                  href={source.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {source.url}
                </a>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );



  return (
    <div 
      ref={messageRef}
      className={cn(
        'flex gap-3 mb-6',
        isUser ? 'justify-end' : 'justify-start',
        // Animation styles
        'transform transition-all duration-400',
        isVisible
          ? 'translate-y-0 opacity-100'
          : 'translate-y-4 opacity-0'
      )}
      style={{
        // Custom spring easing for a gentle bounce effect
        transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
    >
      {!isUser && (
        <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center shrink-0 shadow-sm shadow-primary/20">
          <Bot className="w-5 h-5 text-primary-foreground" />
        </div>
      )}
      <div className={`flex-1 max-w-[80%] ${isUser ? 'flex justify-end' : ''}`}>
        <div className={cn(
          'rounded-2xl px-5 sm:px-6 py-4 sm:py-5 transition-smooth',
          isUser 
            ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20' 
            : 'bg-card text-card-foreground border border-border/50 shadow-sm',
          // Streaming indicator
          isStreaming && 'animate-pulse'
        )}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 prose prose-sm dark:prose-invert max-w-none">
              {isUser ? (
                <p className="text-[15px] leading-[1.7] whitespace-pre-wrap break-words tracking-wide m-0">{content}</p>
              ) : (
                <ReactMarkdown
                  components={{
                    div: ({children}) => <div className="text-[15px] leading-[1.7] tracking-wide">{children}</div>,
                    p: ({children}) => <p className="mb-4 last:mb-0">{children}</p>,
                    strong: ({children}) => <strong className="font-semibold text-foreground">{children}</strong>,
                    ul: ({children}) => <ul className="my-3 ml-4 list-disc space-y-2">{children}</ul>,
                    ol: ({children}) => <ol className="my-3 ml-4 list-decimal space-y-2">{children}</ol>,
                    li: ({children}) => <li className="leading-[1.7]">{children}</li>,
                    code: ({children}) => <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>,
                    pre: ({children}) => <pre className="bg-muted p-3 rounded-lg overflow-x-auto my-3">{children}</pre>,
                  }}
                >
                  {content}
                </ReactMarkdown>
              )}
            </div>
            {!isUser && (
              <button
                onClick={handleCopy}
                className="flex-shrink-0 p-1.5 rounded-md hover:bg-muted/50 transition-smooth-fast group hover:scale-102 active:scale-98"
                title="Copy message"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
                )}
              </button>
            )}
          </div>
          {/* Streaming indicator dots */}
          {isStreaming && (
            <div className="flex gap-1 mt-2">
              <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          )}
          {/* Global details toggle (wraps Sources and Feedback) */}
          {!isUser && (sources?.length || (messageId && userId)) && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <button
                onClick={() => setShowAllDetails(!showAllDetails)}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors group"
              >
                <Eye className="w-4 h-4" />
                <span>Conversation details</span>
                {showAllDetails ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>

              {showAllDetails && (
                <div className="mt-3 space-y-4">
                  {sourcesContent}
                  {/* User Feedback */}
                  {messageId && userId && (
                    <div className="pt-2 border-t border-border/50">
                      <UserFeedback messageId={messageId} userId={userId} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
        </div>
      </div>
      {isUser && (
        <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center shrink-0 shadow-sm shadow-primary/20">
          <User className="w-5 h-5 text-primary-foreground" />
        </div>
      )}
    </div>
  );
});

// Add a display name for better debugging
ChatMessage.displayName = 'ChatMessage';