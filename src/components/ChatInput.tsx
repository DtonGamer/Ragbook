import { useState } from "react";
import { /*ModeSelector*/ } from "@/components/ModeSelector";
import { Textarea } from "@/components/ui/textarea";

interface ChatInputProps {
  onSend: (message: string, mode: "auto" | "document" | "general") => void;
  disabled?: boolean;
}

export const ChatInput = ({ onSend, disabled }: ChatInputProps) => {
  const defaultMode: "auto" | "document" | "general" = "auto"; // Default to auto mode
  const [input, setInput] = useState("");

  const handleSubmit = () => {
    if (input.trim() && !disabled) {
      onSend(input.trim(), "auto"); // Pass default mode
      setInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent) => {
    // Auto-resize textarea
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
          onKeyUp={handleKeyUp}
          placeholder="Ask a question..."
          disabled={disabled}
          rows={1}
          className="w-full px-4 py-3 pr-12 rounded-lg bg-input border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50 text-sm resize-none min-h-[48px] max-h-32 overflow-y-auto"
          style={{
            height: 'auto',
            minHeight: '48px'
          }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = Math.min(target.scrollHeight, 128) + 'px';
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
