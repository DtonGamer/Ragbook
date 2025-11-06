import { ChatInput } from "@/components/ChatInput";
import { ChatMessage } from "@/components/ChatMessage";
import { CreditsDisplay } from "@/components/CreditsDisplay";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ConversationSidebar } from "@/components/ConversationSidebar";
import { SystemMemory } from "@/components/SystemMemory";
import { Button } from "@/components/ui/button";
import { Bot, CreditCard, Crown, FileText, LogOut, Plus, Settings } from "lucide-react";

import { useScrollBehavior } from "@/hooks/useScrollBehavior";
import { useMessageHandler } from "@/hooks/useMessageHandler";
import { useMessageCache } from "@/hooks/useMessageCache";
import { useConversationManager } from "@/hooks/useConversationManager";
import { MessageList } from "@/components/MessageList";
import { ConversationManager } from "@/components/ConversationManager";
import { UpgradeModal } from "@/components/UpgradeModal";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: any[];
  messageId?: string;
  userId?: string;
}

const Chat = () => {
  const navigate = useNavigate();
  const { user, isAdmin, signOut } = useAuth();
  const { isPro, creditsLeft, refreshSubscription } = useSubscription();
  
  // Enhanced state initialization to prevent welcome message flash
  const [messages, setMessages] = useState<Message[]>(() => {
    // On mount, immediately check if we have a cached conversation
    try {
      const lastId = localStorage.getItem("lastConversationId");
      if (lastId) {
        const cached = sessionStorage.getItem(`chat:${lastId}`);
        if (cached) {
          const cachedMessages: Message[] = JSON.parse(cached);
          if (Array.isArray(cachedMessages) && cachedMessages.length > 0) {
            console.log("⚡ Initial state: Using cached messages");
            return cachedMessages;
          }
        }
      }
    } catch (e) {
      console.error("Initial cache check error:", e);
    }
    return [];
  });

  const [isLoading, setIsLoading] = useState(false);
  const [chatMode, setChatMode] = useState<"auto" | "document" | "general">("auto");
  
  const [conversationId, setConversationId] = useState<string | null>(() => {
    try {
      return localStorage.getItem("lastConversationId");
    } catch {
      return null;
    }
  });

  const [showWelcomeMessage, setShowWelcomeMessage] = useState(() => {
    try {
      const lastId = localStorage.getItem("lastConversationId");
      // Only show welcome if no conversation exists
      return !lastId;
    } catch {
      return false;
    }
  });

  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  // showUpgradeModal state is now managed by the useMessageHandler hook
  // const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Note: In the refactored version, we don't need sidebar refresh trigger
  // since the conversation management is handled by the hook
  // const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState(0);
  // We can still use it if needed for other reasons
  const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState(0);
  
  // Use the new hooks
  const { 
    messagesEndRef, 
    shouldAutoScroll, 
    setShouldAutoScroll,
    isInitialLoad,
    setIsInitialLoad,
    sidebarCollapsed: hookSidebarCollapsed,
    setSidebarCollapsed: setHookSidebarCollapsed
  } = useScrollBehavior({ messages });
  
  // Use the conversation manager hook to handle conversation logic
  const conversationManager = useConversationManager({
    initialMessages: messages,
    initialConversationId: conversationId,
    onMessagesUpdate: setMessages,
    onConversationIdUpdate: setConversationId,
    onIsLoadingConversationUpdate: setIsLoadingConversation,
    onShowWelcomeMessageUpdate: setShowWelcomeMessage,
    onIsNavigatingToChatUpdate: (navigating: boolean) => {
      // Using setIsNavigatingToChatHook as callback after defining it
      setIsNavigatingToChatHook && setIsNavigatingToChatHook(navigating);
    },
  });
  
  const {
    messages: conversationMessages,
    setMessages: setConversationMessages,
    conversationId: conversationHookId,
    setConversationId: setConversationHookId,
    isLoadingConversation: isLoadingConversationHook,
    setIsLoadingConversation: setIsLoadingConversationHook,
    showWelcomeMessage: showWelcomeMessageHook,
    setShowWelcomeMessage: setShowWelcomeMessageHook,
    isNavigatingToChat: isNavigatingToChatHook,
    setIsNavigatingToChat: setIsNavigatingToChatHook,
    loadOrCreateConversation,
    createConversation,
    handleNewConversation,
    clearCurrentConversation,
    loadConversation
  } = conversationManager;

  // Use the message handler hook
  const {
    handleSendMessage: sendMessageFromHook,
    handleSuggestionClick: handleSuggestionClickFromHook,
    showUpgradeModal: hookShowUpgradeModal,
    setShowUpgradeModal: setHookShowUpgradeModal
  } = useMessageHandler({
    conversationId,
    messages,
    setMessages,
    setIsLoading,
    refreshSubscription
  });

  // Use the cache hook for message deduplication
  const { deduplicateMessages } = useMessageCache();
  


  // Create local version of handleSendMessage to maintain the original signature
  const handleSendMessage = async (content: string, mode: "auto" | "document" | "general") => {
    // The credit checking and upgrade modal logic is now handled in the hook
    // Enable smooth scrolling for new messages being added
    setShouldAutoScroll(true);
    setIsInitialLoad(false); // Make sure we're not in initial load mode

    await sendMessageFromHook(content, mode);
  };

  const handleSuggestionClick = (suggestion: string) => {
    // Auto-fill the input with the suggestion and use the current mode
    handleSuggestionClickFromHook(suggestion, chatMode);
  };

  // Keyboard shortcut for toggling sidebar - keeping this here instead of hook
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'b') {
        event.preventDefault();
        setSidebarCollapsed(!sidebarCollapsed);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sidebarCollapsed]);

  // Smarter scrolling useEffect - keeping this here for now to maintain behavior
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
  }, [messages, shouldAutoScroll, isInitialLoad, messagesEndRef, setIsInitialLoad]);

  useEffect(() => {
    console.log("Messages updated:", messages.length);
  }, [messages]);

  useEffect(() => {
    if (conversationId) {
      try {
        localStorage.setItem("lastConversationId", conversationId);
      } catch {
        // Ignore localStorage errors
      }
    }
  }, [conversationId]);

  // For now, keep the conversation management functions in the main component
  // for backward compatibility with existing code






  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };


  const sidebar = (
  <div className="h-full flex flex-col">
     {/* ConversationSidebar now handles its own header */}
    <ConversationSidebar
        currentConversationId={conversationHookId}
        onConversationSelect={loadConversation}
        onNewConversation={handleNewConversation}
        onClearCurrentConversation={clearCurrentConversation}
       collapsed={sidebarCollapsed}
        className="flex-1 min-h-0"
        refreshTrigger={sidebarRefreshTrigger}
      />


      
      {/* Footer - Fixed at bottom */}
<div className={`border-t border-border/50 flex-shrink-0 ${sidebarCollapsed ? 'p-2 pb-safe' : 'p-3 pb-safe'}`}>
        {!sidebarCollapsed ? (
          <div className="space-y-2">
            {user && (
              <>
                <div className="mb-2">
                  <CreditsDisplay />
                </div>
                <div className="mb-2">
                  <SystemMemory userId={user.id} />
                </div>
              </>
            )}
            
            <Button 
              variant="outline"
              size="sm"
              onClick={() => navigate("/documents")}
              className="w-full justify-start h-9 transition-all hover:bg-primary/10 hover:border-primary/30 hover:shadow-sm"
            >
              <FileText className="w-4 h-4 mr-2" />
              Documents
            </Button>

            <Button 
              variant="outline"
              size="sm"
              onClick={() => navigate("/pricing")}
              className="w-full justify-start h-9 transition-all hover:bg-primary/10 hover:border-primary/30 hover:shadow-sm"
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Pricing
            </Button>

            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/admin")}
                className="w-full justify-start h-9 transition-all hover:bg-primary/10 hover:border-primary/30 hover:shadow-sm"
              >
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
            )}

            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSignOut}
              className="w-full justify-start h-9 transition-all hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive hover:shadow-sm"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/documents")}
              className="w-12 h-10 p-0 transition-all hover:bg-primary/10 flex items-center justify-center"
              title="Documents"
            >
              <FileText className="w-4 h-4" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/pricing")}
              className="w-12 h-10 p-0 transition-all hover:bg-primary/10 flex items-center justify-center"
              title="Pricing"
            >
              <CreditCard className="w-4 h-4" />
            </Button>

            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/admin")}
                className="w-12 h-10 p-0 transition-all hover:bg-primary/10 flex items-center justify-center"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </Button>
            )}

            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSignOut}
              className="w-12 h-10 p-0 transition-all hover:bg-destructive/10 hover:text-destructive flex items-center justify-center"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
    
  );

  return (
    <ResponsiveLayout 
      sidebar={sidebar}
      sidebarCollapsed={sidebarCollapsed}
      onSidebarCollapsedChange={setSidebarCollapsed}
      onNewConversation={handleNewConversation}
    >
      <div className="flex flex-col h-full">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto pb-36 md:pb-32 custom-scrollbar">
          <div className="max-w-4xl mx-auto px-5 sm:px-4 py-8">
            {/* Conversation manager handles welcome messages and new conversation options, 
                 or returns null when regular messages should be displayed */}
            <ConversationManager
              initialMessages={messages}
              initialConversationId={conversationHookId}
              onMessagesUpdate={setMessages}
              onConversationIdUpdate={setConversationId}
              onIsLoadingConversationUpdate={setIsLoadingConversation}
              onShowWelcomeMessageUpdate={setShowWelcomeMessage}
              onIsNavigatingToChatUpdate={setIsNavigatingToChatHook}
              isLoading={isLoading}
              onNewConversation={handleNewConversation}
            />
            {/* Show messages when ConversationManager returns null (has no special UI to render) */}
            {messages.length > 0 && !isNavigatingToChatHook && (
              <MessageList 
                messages={messages}
                isLoading={isLoading}
                isNavigatingToChat={isNavigatingToChatHook}
                messagesEndRef={messagesEndRef}
                onSuggestionClick={handleSuggestionClick}
              />
            )}
          </div>
        </div>

        {/* Input - Fixed footer with dynamic left offset */}
        <div className={`fixed bottom-0 left-0 right-0 border-t border-border/50 backdrop-blur-sm bg-card/95 shadow-lg z-30 transition-all duration-300 pb-safe ${sidebarCollapsed ? 'lg:left-20' : 'lg:left-80'}`}>
          <div className="max-w-4xl mx-auto px-5 sm:px-4 py-4">
            <ChatInput 
              onSend={handleSendMessage} 
              disabled={isLoading || isNavigatingToChatHook} 
              mode={chatMode}
              onModeChange={setChatMode}
            />
            <p className="text-xs text-muted-foreground text-center mt-2">
              {isNavigatingToChatHook && conversationHookId && messages.length === 0 
                ? "Select an option above to continue" 
                : "Press Enter to send, Shift+Enter for new line"}
            </p>
          </div>
        </div>
      </div>

      {/* Upgrade Modal */}
      <UpgradeModal 
        open={hookShowUpgradeModal} 
        onOpenChange={setHookShowUpgradeModal} 
      />
    </ResponsiveLayout>
  );
};

export default Chat;