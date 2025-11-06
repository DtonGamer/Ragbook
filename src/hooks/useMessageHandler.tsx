import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
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
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setIsLoading: (loading: boolean) => void;
  refreshSubscription: () => Promise<void>;
}

export const useMessageHandler = ({
  conversationId,
  messages,
  setMessages,
  setIsLoading,
  refreshSubscription
}: UseMessageHandlerProps) => {
  const { user } = useAuth();
  const { creditsLeft, isPro } = useSubscription();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  
  const handleSendMessage = async (content: string, mode: "auto" | "document" | "general" = "auto") => {
    console.log("🚀 Starting handleSendMessage with mode:", mode);
    
    if (!conversationId) {
      toast.error("No active conversation");
      return;
    }

    // Check credits before sending
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
    const tempAssistantMessageId = `temp-assistant-${Date.now()}`;

    const optimisticUserMessage: Message = { 
      role: "user", 
      content, 
      messageId: tempUserMessageId,
      userId: user?.id 
    };
    
    console.log("✅ Adding optimistic user message");
    setMessages(prev => [...prev, optimisticUserMessage]);

    setIsLoading(true);

    try {
      const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (refreshError) {
        console.error("Session refresh error:", refreshError);
      }
      
      if (sessionError) {
        console.error("Session error:", sessionError);
        throw new Error("Session error: " + sessionError.message);
      }
      
      const currentSession = refreshedSession || session;
      if (!currentSession) throw new Error("Not authenticated");

      const requestBody = {
        message: content,
        conversationId,
        mode,  // Add the mode to the request body
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
          // Note: Navigation needs to be handled by parent component
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
      const creditsInfo = responseData.credits;

      // Refresh subscription to get updated credits
      if (creditsInfo !== undefined) {
        console.log("💰 Credits after message:", creditsInfo);
        await refreshSubscription();
      }

      // Fetch fresh messages from database to ensure consistency
      const { data: newMessages, error: fetchError } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (fetchError) {
        console.error("Error fetching updated messages:", fetchError);
        // Fall back to optimistic update if fetch fails
        const assistantMessageObj: Message = { 
          role: "assistant", 
          content: responseData.message || "No response received", 
          sources: responseData.sources || [],
          messageId: tempAssistantMessageId,
          userId: user?.id
        };
        setMessages(prev => {
          return [...prev.filter(m => m.messageId !== tempUserMessageId), assistantMessageObj];
        });
      } else {
        // Load fresh messages from database
        const loadedMessages: Message[] = newMessages.map(msg => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
          sources: (msg.metadata as { sources?: any[] })?.sources || [],
          messageId: msg.id,
          userId: user?.id
        }));

        console.log("✅ Replacing with fresh messages from DB:", loadedMessages.length);
        setMessages(loadedMessages);
        
        // Update cache
        try {
          sessionStorage.setItem(`chat:${conversationId}`, JSON.stringify(loadedMessages));
        } catch (e) {
          console.warn("Failed to update cache:", e);
        }
      }

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
    // Auto-fill the input with the suggestion and use the current mode
    handleSendMessage(suggestion, mode);
  };

  return {
    showUpgradeModal,
    setShowUpgradeModal,
    handleSendMessage,
    handleSuggestionClick
  };
};