import { Bot } from "lucide-react";
import { ChatMessage } from "@/components/ChatMessage";
import { useMessageCache } from "@/hooks/useMessageCache";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: any[];
  messageId?: string;
  userId?: string;
}

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  isNavigatingToChat: boolean;
  isLoadingConversation: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  onSuggestionClick: (suggestion: string) => void;
}

export const MessageList = ({
  messages,
  isLoading,
  isNavigatingToChat,
  isLoadingConversation,
  messagesEndRef,
  onSuggestionClick
}: MessageListProps) => {
  const { deduplicateMessages } = useMessageCache();

  return (
    <>
      {deduplicateMessages(messages).map((message, index, arr) => (
        <ChatMessage
          key={message.messageId || `msg-${index}-${message.role}`}
          {...message}
          isStreaming={isLoading && !isLoadingConversation && index === arr.length - 1 && message.role === 'assistant'}
          onSuggestionClick={onSuggestionClick}
        />
      ))}

      {isLoading && !isNavigatingToChat && !isLoadingConversation && (
        <div className="flex gap-4 mb-4">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center shrink-0 shadow-sm shadow-primary/20">
            <Bot className="w-5 h-5 text-primary-foreground animate-pulse" />
          </div>
          <div className="flex-1">
            <div className="rounded-2xl px-5 py-4 bg-card border border-border/50 shadow-sm max-w-[70%]">
              <div className="flex gap-2">
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </>
  );
};