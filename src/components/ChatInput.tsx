import { useState, useRef } from "react";

interface ChatInputProps {
  onSend: (message: string, mode: "auto" | "document" | "general") => void;
  disabled?: boolean;
}

export const ChatInput = ({ onSend, disabled }: ChatInputProps) => {
  const [input, setInput] = useState("");
  // FIX BUG 3: Guard against double submission. On mobile, the virtual keyboard
  // can fire keydown AND a synthetic click on the send button in the same tick,
  // calling handleSubmit twice and creating a duplicate message/conversation.
  const isSubmitting = useRef(false);

  const handleSubmit = () => {
    if (isSubmitting.current) return; // guard
    if (input.trim() && !disabled) {
      isSubmitting.current = true;
      onSend(input.trim(), "auto");
      setInput("");
      // Reset after a short delay to allow the event loop to clear
      setTimeout(() => {
        isSubmitting.current = false;
      }, 300);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    target.style.height = 'auto';
    target.style.height = Math.min(target.scrollHeight, 128) + 'px';
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder="Ask a question..."
          disabled={disabled}
          rows={1}
          className="w-full px-4 py-3 pr-12 rounded-lg bg-input border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50 text-sm resize-none min-h-[48px] max-h-32 overflow-y-auto"
          style={{
            height: 'auto',
            minHeight: '48px'
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !input.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-all duration-200 shadow-sm shadow-primary/20"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  );
};
