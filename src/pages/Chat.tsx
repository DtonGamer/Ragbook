import { ChatInput } from "@/components/ChatInput";
import { ChatMessage } from "@/components/ChatMessage";
import { CreditsDisplay } from "@/components/CreditsDisplay";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { useAuthContext } from "@/contexts/AuthProvider";
import { useSubscription } from "@/hooks/useSubscription";
import { useEffect, useState, useRef } from "react";
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
  const { user, isAdmin, signOut } = useAuthContext();
  const { isPro, creditsLeft, refreshSubscription } = useSubscription();

  const [isLoading, setIsLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState(0);

  const {
    messages: conversationMessages,
    setMessages,
    conversationId: conversationHookId,
    setConversationId,
    isLoadingConversation: isLoadingConversationHook,
    showWelcomeMessage: showWelcomeMessageHook,
    setShowWelcomeMessage,
    isCreatingNew: isCreatingNewHook,
    loadConversation,
    handleNewConversation,
    createConversation,  // FIX BUG 2: pull createConversation from the manager
  } = useConversationManager({
    onSidebarRefresh: () => setSidebarRefreshTrigger(prev => prev + 1)
  });

  const {
    messagesEndRef,
    scrollContainerRef,
    shouldAutoScroll,
    setShouldAutoScroll,
    isInitialLoad,
    setIsInitialLoad,
    isUserScrolling,
    setIsUserScrolling,
    sidebarCollapsed: hookSidebarCollapsed,
    setSidebarCollapsed: setHookSidebarCollapsed
  } = useScrollBehavior({ messages: conversationMessages });

  const {
    handleSendMessage: sendMessageFromHook,
    handleSuggestionClick: handleSuggestionClickFromHook,
    showUpgradeModal: hookShowUpgradeModal,
    setShowUpgradeModal: setHookShowUpgradeModal
  } = useMessageHandler({
    conversationId: conversationHookId,
    setConversationId,       // FIX BUG 2: pass down so the handler can sync state
    createConversation,      // FIX BUG 2: pass the single source of truth
    messages: conversationMessages,
    setMessages,
    setIsLoading,
    refreshSubscription
  });

  const { deduplicateMessages } = useMessageCache();

  const handleSendMessage = async (content: string, mode: "auto" | "document" | "general" = "auto") => {
    setShouldAutoScroll(true);
    setIsUserScrolling(false);
    await sendMessageFromHook(content, mode);
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSuggestionClickFromHook(suggestion, "auto");
  };

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

  useEffect(() => {
    console.log("Messages updated:", conversationMessages.length);
  }, [conversationMessages]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const sidebar = (
    <div className="h-full flex flex-col">
      <ConversationSidebar
        currentConversationId={conversationHookId}
        onConversationSelect={loadConversation}
        onNewConversation={handleNewConversation}
        onClearCurrentConversation={handleNewConversation}
        collapsed={sidebarCollapsed}
        className="flex-1 min-h-0"
        refreshTrigger={sidebarRefreshTrigger}
      />

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
        <div className="flex-1 overflow-y-auto pb-36 md:pb-32 custom-scrollbar" ref={(el) => {
          if (el && !scrollContainerRef.current) {
            scrollContainerRef.current = el;
          }
        }}>
          <div className="max-w-4xl mx-auto px-5 sm:px-4 py-8">
            <ConversationManager
              initialMessages={conversationMessages}
              initialConversationId={conversationHookId}
              onMessagesUpdate={setMessages}
              onConversationIdUpdate={setConversationId}
              onIsLoadingConversationUpdate={() => {}}
              onShowWelcomeMessageUpdate={setShowWelcomeMessage}
              onIsNavigatingToChatUpdate={() => {}}
              isLoading={isLoading || isLoadingConversationHook}
              onNewConversation={handleNewConversation}
              conversationId={conversationHookId}
              isLoadingConversation={isLoadingConversationHook}
              showWelcomeMessage={showWelcomeMessageHook}
              isCreatingNew={isCreatingNewHook}
              loadConversation={loadConversation}
              handleNewConversation={handleNewConversation}
            />
            {!isLoadingConversationHook && conversationMessages.length > 0 && (
              <MessageList
                messages={conversationMessages}
                isLoading={isLoading}
                isNavigatingToChat={false}
                isLoadingConversation={isLoadingConversationHook}
                messagesEndRef={messagesEndRef}
                onSuggestionClick={handleSuggestionClick}
              />
            )}
          </div>
        </div>

        <div className={`fixed bottom-0 left-0 right-0 border-t border-border/50 backdrop-blur-sm bg-card/95 shadow-lg z-30 transition-all duration-300 pb-safe ${sidebarCollapsed ? 'lg:left-20' : 'lg:left-80'}`}>
          <div className="max-w-4xl mx-auto px-5 sm:px-4 py-4">
            <ChatInput
              onSend={(message, mode = "auto") => handleSendMessage(message, mode)}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground text-center mt-2">
              {"Press Enter to send, Shift+Enter for new line"}
            </p>
          </div>
        </div>
      </div>

      <UpgradeModal
        open={hookShowUpgradeModal}
        onOpenChange={setHookShowUpgradeModal}
      />
    </ResponsiveLayout>
  );
};

export default Chat;
