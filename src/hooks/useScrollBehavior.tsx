import { useState, useEffect, useRef } from "react";

interface UseScrollBehaviorProps {
  messages: any[]; // Array of messages
}

export const useScrollBehavior = ({ messages }: UseScrollBehaviorProps) => {
  const [shouldAutoScroll, setShouldAutoScroll] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLElement | null>(null);

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

  // Set up scroll container reference and scroll event listener
  useEffect(() => {
    // Find the scroll container (typically the nearest parent with overflow-y)
    const findScrollContainer = (): HTMLElement | null => {
      if (messagesEndRef.current) {
        let parent = messagesEndRef.current.parentElement;
        while (parent) {
          const overflowY = window.getComputedStyle(parent).overflowY;
          if (overflowY === 'auto' || overflowY === 'scroll') {
            return parent;
          }
          parent = parent.parentElement;
        }
      }
      return null;
    };

    scrollContainerRef.current = findScrollContainer();

    const handleScroll = () => {
      if (scrollContainerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        const atBottom = scrollHeight - scrollTop <= clientHeight + 5; // 5px threshold
        
        // If user scrolled up, set isUserScrolling to true to prevent auto-scroll
        setIsUserScrolling(!atBottom);
      }
    };

    if (scrollContainerRef.current) {
      scrollContainerRef.current.addEventListener('scroll', handleScroll);
      // Check initial scroll position
      const { scrollTop } = scrollContainerRef.current;
      setIsUserScrolling(scrollTop > 0);
    }

    return () => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  // Smarter scrolling useEffect
  useEffect(() => {
    // Only auto-scroll if:
    // 1. We're supposed to auto-scroll (new messages)
    // 2. We're not on the initial load
    // 3. We have messages to scroll to
    // 4. User is not currently scrolled up reading history
    if (shouldAutoScroll && !isInitialLoad && messages.length > 0 && !isUserScrolling) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } else if (isInitialLoad && messages.length > 0) {
      // On initial load with messages, jump instantly to bottom without animation
      // This handles the case of loading an existing conversation
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      setIsInitialLoad(false);
    } else if (isInitialLoad && messages.length === 0) {
      // If there are no messages on initial load, just mark initial load as done
      setIsInitialLoad(false);
    }
  }, [messages, shouldAutoScroll, isInitialLoad, isUserScrolling]);

  return {
    messagesEndRef,
    scrollContainerRef,
    shouldAutoScroll,
    setShouldAutoScroll,
    isInitialLoad,
    setIsInitialLoad,
    isUserScrolling,
    setIsUserScrolling,
    sidebarCollapsed,
    setSidebarCollapsed
  };
};