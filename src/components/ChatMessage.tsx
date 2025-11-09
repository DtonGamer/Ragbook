import { cn } from "@/lib/utils";
import { Bot, Brain, Check, ChevronDown, ChevronUp, Copy, User, MessageSquare, Link, FileText, Sparkles } from "lucide-react";
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
    suggestions?: string[];
    clarifyingQuestion?: string;
  }>;
  isNew?: boolean;
  isStreaming?: boolean;
  messageId?: string;
  userId?: string;
  onSuggestionClick?: (suggestion: string) => void;
}

export const ChatMessage = memo(({ 
  role, 
  content, 
  sources, 
  isNew = false, 
  isStreaming = false, 
  messageId,
  userId,
  onSuggestionClick
}: ChatMessageProps) => {
  const isUser = role === "user";
  const [copied, setCopied] = useState(false);
  const [isVisible, setIsVisible] = useState(!isNew);
  const [showSources, setShowSources] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const messageRef = useRef<HTMLDivElement>(null);

  const hasSources = sources && sources.length > 0;
  const hasSuggestions = sources?.some(s => s.suggestions && s.suggestions.length > 0);
  const hasClarifyingQuestion = sources?.some(s => s.clarifyingQuestion);
  const clarifyingQuestion = sources?.find(s => s.clarifyingQuestion)?.clarifyingQuestion;

  useEffect(() => {
    if (isNew && !isVisible) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    }
  }, [isNew, isVisible]);

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

  return (
    <div 
      ref={messageRef}
      className={cn(
        'flex gap-3 mb-6',
        isUser ? 'justify-end' : 'justify-start',
        'transform transition-all duration-400',
        isVisible
          ? 'translate-y-0 opacity-100'
          : 'translate-y-4 opacity-0'
      )}
      style={{
        transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
    >
      {!isUser && (
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/90 to-primary shadow-lg flex items-center justify-center shrink-0">
          <Bot className="w-5 h-5 text-primary-foreground" />
        </div>
      )}
      
      <div className={cn(
        'flex-1 space-y-3',
        isUser ? 'flex justify-end' : 'max-w-[90%] sm:max-w-[85%] lg:max-w-[80%]'
      )}>
        {/* Main message bubble */}
        <div className={cn(
          'rounded-2xl px-4 py-3.5 transition-all duration-300',
          isUser 
            ? 'bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg inline-block max-w-full' 
            : 'bg-card text-card-foreground border border-border/60 shadow-sm',
          isStreaming && 'animate-pulse'
        )}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 prose prose-sm dark:prose-invert max-w-none">
              {isUser ? (
                <p className="text-[15px] sm:text-sm leading-relaxed whitespace-pre-wrap break-words m-0">
                  {typeof content === 'string' ? content : JSON.stringify(content, null, 2)}
                </p>
              ) : (
                <ReactMarkdown
                  components={{
                    div: ({children}) => <div className="text-[15px] sm:text-sm leading-relaxed">{children}</div>,
                    p: ({children}) => <p className="mb-3 last:mb-0">{children}</p>,
                    strong: ({children}) => <strong className="font-semibold text-foreground">{children}</strong>,
                    ul: ({children}) => <ul className="my-2 ml-5 list-disc space-y-1.5">{children}</ul>,
                    ol: ({children}) => <ol className="my-2 ml-5 list-decimal space-y-1.5">{children}</ol>,
                    li: ({children}) => <li className="leading-relaxed">{children}</li>,
                    code: ({children}) => <code className="bg-muted px-1.5 py-0.5 rounded text-[13px] font-mono">{children}</code>,
                    pre: ({children}) => <pre className="bg-muted p-3 rounded-lg overflow-x-auto my-2 text-[13px] border border-border/50">{children}</pre>,
                    a: ({children, href}) => (
                      <a 
                        href={href} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-primary hover:underline font-medium"
                      >
                        {children}
                      </a>
                    ),
                  }}
                >
                  {typeof content === 'string' ? content : JSON.stringify(content, null, 2)}
                </ReactMarkdown>
              )}
            </div>
            
            {!isUser && !isStreaming && (
              <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                <button
                  onClick={handleCopy}
                  className="p-1.5 rounded-md hover:bg-accent transition-colors group"
                  title="Copy message"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
                  )}
                </button>
              </div>
            )}
          </div>
          
          {isStreaming && (
            <div className="flex gap-1.5 mt-3">
              <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          )}
        </div>

        {/* Suggestions with expandable section */}
        {!isUser && !isStreaming && hasSuggestions && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="w-3.5 h-3.5 text-purple-500" />
                <p className="text-xs font-medium text-muted-foreground">Explore related topics</p>
              </div>
              
              <button
                onClick={() => setShowSuggestions(!showSuggestions)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors py-0.5 px-1 rounded"
              >
                {showSuggestions ? 'Show less' : 'Show more'}
              </button>
            </div>
            
            <div className={cn(
              "flex flex-wrap gap-1.5 transition-all duration-300 overflow-hidden",
              showSuggestions ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
            )}>
              {sources
                .flatMap(s => s.suggestions || [])
                .filter((v, i, a) => a.indexOf(v) === i)
                .map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => onSuggestionClick?.(suggestion)}
                    className="text-xs px-2.5 py-1 rounded-full bg-primary/10 hover:bg-primary/20 text-primary transition-colors border border-primary/20 hover:border-primary/30 flex items-center gap-1.5"
                  >
                    <MessageSquare className="w-3 h-3" />
                    {suggestion}
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* Clarifying Question */}
        {!isUser && !isStreaming && hasClarifyingQuestion && (
          <div className="flex items-start gap-2 bg-blue-50/70 dark:bg-blue-500/10 rounded-xl px-4 py-3 border border-blue-200/70 dark:border-blue-500/30">
            <div className="p-1.5 bg-blue-100 dark:bg-blue-500/20 rounded-lg mt-0.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed flex-1">{clarifyingQuestion}</p>
          </div>
        )}

        {/* Collapsible Sources & Feedback */}
        {!isUser && !isStreaming && (hasSources || (messageId && userId)) && (
          <div className="space-y-2.5">
            <button
              onClick={() => setShowSources(!showSources)}
              className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              <div className="flex items-center gap-1.5">
                {showSources ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    <span>Hide details</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span>Feedback</span>
                  </>
                )}
              </div>
            </button>

            {showSources && (
              <div className="space-y-3 pl-1 pt-1.5">
                {hasSources && (
                  <div className="space-y-2.5">
                    {sources.map((source, idx) => (
                      <div 
                        key={idx} 
                        className="bg-muted/40 dark:bg-background/50 rounded-xl p-3 border border-border/40 hover:border-border/60 transition-colors"
                      >
                        {source.type === 'knowledge_base' ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-muted-foreground" />
                                <span className="text-xs font-medium text-foreground">Knowledge Base</span>
                              </div>
                              {source.similarity && (
                                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                  {(source.similarity * 100).toFixed(0)}% match
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed pl-6">
                              {source.content}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-start gap-2">
                              <Link className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                              <div className="flex-1">
                                <div className="font-medium text-sm text-foreground mb-1">{source.title}</div>
                                <p className="text-sm text-muted-foreground mb-2 leading-relaxed">
                                  {source.description}
                                </p>
                                <a 
                                  href={source.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline text-sm break-all flex items-center gap-1"
                                >
                                  {source.url}
                                  <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </a>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                {messageId && userId && (
                  <div className={hasSources ? "pt-2.5 border-t border-border/40" : ""}>
                    <UserFeedback messageId={messageId} userId={userId} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      
      {isUser && (
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/90 to-primary shadow-lg flex items-center justify-center shrink-0">
          <User className="w-5 h-5 text-primary-foreground" />
        </div>
      )}
    </div>
  );
});

ChatMessage.displayName = 'ChatMessage';