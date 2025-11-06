import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Bot, Plus } from "lucide-react";
import { useConversationManager } from "@/hooks/useConversationManager";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: any[];
  messageId?: string;
  userId?: string;
}

interface ConversationManagerProps {
  initialMessages: Message[];
  initialConversationId: string | null;
  onMessagesUpdate: (messages: Message[]) => void;
  onConversationIdUpdate: (id: string | null) => void;
  onIsLoadingConversationUpdate: (loading: boolean) => void;
  onShowWelcomeMessageUpdate: (show: boolean) => void;
  onIsNavigatingToChatUpdate: (navigating: boolean) => void;
  isLoading: boolean;
  onNewConversation: () => void;
}

export const ConversationManager = ({
  initialMessages,
  initialConversationId,
  onMessagesUpdate,
  onConversationIdUpdate,
  onIsLoadingConversationUpdate,
  onShowWelcomeMessageUpdate,
  onIsNavigatingToChatUpdate,
  isLoading,
  onNewConversation
}: ConversationManagerProps) => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState(0);
  
  const {
    conversationId,
    isLoadingConversation,
    showWelcomeMessage,
    isNavigatingToChat,
    handleNewConversation,
    clearCurrentConversation,
    loadConversation
  } = useConversationManager({
    initialMessages,
    initialConversationId,
    onMessagesUpdate,
    onConversationIdUpdate,
    onIsLoadingConversationUpdate,
    onShowWelcomeMessageUpdate,
    onIsNavigatingToChatUpdate
  });

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const handleNewConversationClick = async () => {
    await handleNewConversation();
    setSidebarRefreshTrigger(prev => prev + 1);
  };

  // Determine if we're waiting for initial data
  const shouldShowWelcomeOptions = (isNavigatingToChat && conversationId && initialMessages.length === 0);
  const shouldShowInitialMessage = (initialMessages.length === 0 && !isNavigatingToChat);
  
  if (shouldShowWelcomeOptions) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center shadow-glow">
            <Bot className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-3xl font-bold mb-3 text-foreground">Welcome Back!</h2>
          <p className="text-muted-foreground text-lg max-w-md mx-auto mb-6">
            We found your previous conversation. What would you like to do?
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button 
              onClick={() => loadConversation(conversationId)}
              className="transition-smooth hover:scale-102 active:scale-98 min-w-[200px] bg-primary hover:bg-primary/90"
              disabled={isLoading || isLoadingConversation}
            >
              <span>Continue Previous Conversation</span>
            </Button>
            <Button 
              onClick={handleNewConversationClick}
              variant="outline"
              className="transition-smooth hover:scale-102 active:scale-98 min-w-[200px]"
              disabled={isLoading || isLoadingConversation}
            >
              <Plus className="w-4 h-4 mr-2" />
              Start New Conversation
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (shouldShowInitialMessage) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center shadow-glow">
            <Bot className="w-10 h-10 text-primary" />
          </div>
          {showWelcomeMessage ? (
            <>
              <h2 className="text-3xl font-bold mb-3 text-foreground">Conversation Deleted</h2>
              <p className="text-muted-foreground text-lg max-w-md mx-auto mb-6">
                The conversation has been deleted. Start a new conversation by clicking the "New Conversation" button or typing a message below.
              </p>
              <Button 
                onClick={handleNewConversationClick}
                className="mb-4 transition-smooth hover:scale-102 active:scale-98"
                disabled={isLoading || isLoadingConversation}
              >
                <Plus className="w-4 h-4 mr-2" />
                Start New Conversation
              </Button>
            </>
          ) : (
            <>
              <h2 className="text-3xl font-bold mb-3 text-foreground">Ready to study?</h2>
              <p className="text-muted-foreground text-lg max-w-md mx-auto">
                Ask me anything about your course materials! I can explain concepts, help with homework, or search through your uploaded textbooks and notes.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return null; // Return null when we have messages to show, as other components will render them
};