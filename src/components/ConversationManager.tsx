import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthProvider";
import { Button } from "@/components/ui/button";
import { Bot, Plus } from "lucide-react";

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
  // Additional props from parent component (not from useConversationManager hook)
  conversationId: string | null;
  isLoadingConversation: boolean;
  showWelcomeMessage: boolean;
  isCreatingNew?: boolean; // Added prop to track if creating a new conversation
  loadConversation: (id: string) => void;
  handleNewConversation: () => void;
  isNavigatingToChat?: boolean; // Optional prop for backward compatibility
  clearCurrentConversation?: () => void; // Optional prop for backward compatibility
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
  onNewConversation,
  conversationId,
  isLoadingConversation,
  showWelcomeMessage,
  isCreatingNew = false, // Default to false if not provided
  loadConversation,
  handleNewConversation,
  isNavigatingToChat = false,
  clearCurrentConversation
}: ConversationManagerProps) => {
  const navigate = useNavigate();
  const { user, signOut } = useAuthContext();
  const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState(0);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const handleNewConversationClick = async () => {
    await handleNewConversation();
    setSidebarRefreshTrigger(prev => prev + 1);
  };

  // Determine if we're showing the welcome options (when there's a conversation ID but no messages)
  const shouldShowWelcomeOptions = (conversationId && initialMessages.length === 0 && !isCreatingNew);

  // Show "Conversation Deleted" only when we had a conversation ID but it no longer exists
  const shouldShowDeletedMessage = (initialConversationId && initialMessages.length === 0 && !showWelcomeMessage && !conversationId && !isCreatingNew);

  // Show initial welcome message if no messages and showing welcome, or if we're in a new conversation state
  const shouldShowInitialMessage = (initialMessages.length === 0 && (showWelcomeMessage || isCreatingNew) && !conversationId);

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

  if (shouldShowDeletedMessage) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center shadow-glow">
            <Bot className="w-10 h-10 text-primary" />
          </div>
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
          <h2 className="text-3xl font-bold mb-3 text-foreground">Ready to study?</h2>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            Ask me anything about your course materials! I can explain concepts, help with homework, or search through your uploaded textbooks and notes.
          </p>
        </div>
      </div>
    );
  }

  return null; // Return null when we have messages to show, as other components will render them
};