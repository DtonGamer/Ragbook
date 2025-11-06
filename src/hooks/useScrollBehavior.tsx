import { useState, useEffect, useRef } from "react";

interface UseScrollBehaviorProps {
  messages: any[]; // Array of messages
}

export const useScrollBehavior = ({ messages }: UseScrollBehaviorProps) => {
  const [shouldAutoScroll, setShouldAutoScroll] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut for toggling sidebar
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'b') {
        event.preventDefault();
        setSidebarCollapsed(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Smarter scrolling useEffect
  useEffect(() => {
    // Only auto-scroll if:
    // 1. We're supposed to auto-scroll (new messages)
    // 2. We're not on the initial load
    // 3. We have messages to scroll to
    if (shouldAutoScroll && !isInitialLoad && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } else if (isInitialLoad && messages.length > 0) {
      // On initial load, jump instantly to bottom without animation
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      setIsInitialLoad(false);
    }
  }, [messages, shouldAutoScroll, isInitialLoad]);

  return {
    messagesEndRef,
    shouldAutoScroll,
    setShouldAutoScroll,
    isInitialLoad,
    setIsInitialLoad,
    sidebarCollapsed,
    setSidebarCollapsed
  };
};