import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthProvider";
import { useSubscription } from "./useSubscription";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: any[];
  messageId?: string;
  userId?: string;
}

interface UseMessageHandlerProps {
  conversationId: string | null;
  setConversationId: (id: string) => void;           // NEW: from useConversationManager
  createConversation: () => Promise<string | null>;  // NEW: from useConversationManager
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setIsLoading: (loading: boolean) => void;
  refreshSubscription: () => Promise<void>;
}

export const useMessageHandler = ({
  conversationId,
  setConversationId,
  createConversation,
  messages,
  setMessages,
  setIsLoading,
  refreshSubscription
}: UseMessageHandlerProps) => {
  const { user } = useAuthContext();
  const { creditsLeft, isPro } = useSubscription();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // FIX BUG 2: Removed internal createConversation entirely.
  // Now uses the one passed in from useConversationManager, which correctly
  // calls setConversationId and refreshes the sidebar. This prevents duplicate
  // conversations from being created when conversationId is still null on a
  // second rapid send.

  const handleSendMessage = async (content: string, mode: "auto" | "document" | "general" = "auto") => {
    console.log("🚀 Starting handleSendMessage with mode:", mode);

    let currentConversationId = conversationId;

    if (!currentConversationId) {
      currentConversationId = await createConversation();
      if (!currentConversationId) {
        toast.error("Failed to create conversation");
        return;
      }
      // FIX BUG 2: Keep the shared conversationId in sync so subsequent messages
      // in the same session don't create another new conversation.
      setConversationId(currentConversationId);
    }

    if (!isPro && creditsLeft <= 0) {
      console.log("❌ No credits remaining");
      setShowUpgradeModal(true);
      toast.error("You've run out of credits! Upgrade to Pro for unlimited access.");
      return;
    }

    if (!isPro && creditsLeft <= 10 && creditsLeft > 0) {
      toast.warning(`Only ${creditsLeft} credits remaining. Consider upgrading to Pro.`);
    }

    const tempUserMessageId = `temp-user-${Date.now()}`;

    // FIX BUG 1: Add the optimistic user message and keep it in state.
    // We no longer replace the full message list from the DB fetch — we only
    // append the assistant reply. This prevents the user message from disappearing.
    const optimisticUserMessage: Message = {
      role: "user",
      content,
      messageId: tempUserMessageId,
      userId: user?.id
    };

    setMessages(prev => [...prev, optimisticUserMessage]);
    setIsLoading(true);

    try {
      const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (refreshError) console.error("Session refresh error:", refreshError);

      if (sessionError) {
        console.error("Session error:", sessionError);
        throw new Error("Session error: " + sessionError.message);
      }

      const currentSession = refreshedSession || session;
      if (!currentSession) throw new Error("Not authenticated");

      const requestBody = {
        message: content,
        conversationId: currentConversationId,
        mode,
      };

      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rag-chat-credits`;

      console.log('📤 Sending request to rag-chat-credits with mode:', mode);

      const response = await fetch(fnUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentSession.access_token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        if (response.status === 401) {
          toast.error("Your session expired. Please sign in again.");
          await supabase.auth.signOut({ scope: 'local' });
          return;
        }
        if (response.status === 429) {
          toast.error("Rate limit exceeded. Please try again later.");
          return;
        }
        if (response.status === 402) {
          toast.error("Credits exhausted. Please upgrade to Pro.");
          setShowUpgradeModal(true);
          return;
        }

        let errorMessage = "Failed to get response";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          errorMessage = response.statusText || errorMessage;
        }

        throw new Error(errorMessage);
      }

      const responseData = await response.json();

      if (responseData.credits !== undefined) {
        console.log("💰 Credits after message:", responseData.credits);
        await refreshSubscription();
      }

      // FIX BUG 1: Instead of replacing the entire message list with a DB fetch,
      // we just replace the optimistic user message with a stable one, then append
      // the assistant reply. This guarantees order: user msg always precedes reply.
      const stableUserMessage: Message = {
        role: "user",
        content,
        messageId: `db-user-${Date.now()}`,
        userId: user?.id
      };

      const assistantMessage: Message = {
        role: "assistant",
        content: typeof responseData.message === 'string'
          ? responseData.message
          : JSON.stringify(responseData.message, null, 2) || "No response received",
        sources: responseData.sources || [],
        messageId: `server-assistant-${Date.now()}`,
        userId: user?.id
      };

      setMessages(prev => {
        // Replace the optimistic user message with a stable one, keep all others
        const withoutOptimistic = prev.filter(m => m.messageId !== tempUserMessageId);
        return [...withoutOptimistic, stableUserMessage, assistantMessage];
      });

    } catch (error: any) {
      console.error("Chat error:", error);
      toast.error(error.message || "Failed to send message");
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.messageId !== tempUserMessageId));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string, mode: "auto" | "document" | "general" = "auto") => {
    handleSendMessage(suggestion, mode);
  };

  return {
    showUpgradeModal,
    setShowUpgradeModal,
    handleSendMessage,
    handleSuggestionClick
  };
};
