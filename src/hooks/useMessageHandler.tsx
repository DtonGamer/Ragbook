import { useState, useRef } from "react";
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
  const { user } = useAuthContext();
  const { creditsLeft, isPro } = useSubscription();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const createConversation = async () => {
    if (!user) return null;

    const { data, error } = await supabase
      .from("conversations")
      .insert({ user_id: user.id })
      .select()
      .single();

    if (error) {
      console.error("Error creating conversation:", error);
      toast.error("Failed to create conversation");
      return null;
    }

    try {
      localStorage.setItem("lastConversationId", data.id);
    } catch {}

    return data.id;
  };

  const handleSendMessage = async (content: string, mode: "auto" | "document" | "general" = "auto") => {
    console.log("🚀 Starting handleSendMessage with mode:", mode);

    let currentConversationId = conversationId;

    // If no conversation ID, create a new one (first message in a new session)
    if (!currentConversationId) {
      currentConversationId = await createConversation();
      if (!currentConversationId) {
        toast.error("Failed to create conversation");
        return;
      }
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
        if (response.status === 404) {
          // Conversation not found, create a new one and retry
          console.log("Conversation not found, creating new one...");
          const newConversationId = await createConversation();
          if (newConversationId) {
            // Retry the request with the new conversation ID
            requestBody.conversationId = newConversationId;

            const retryResponse = await fetch(fnUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${currentSession.access_token}`,
              },
              body: JSON.stringify(requestBody),
            });

            if (!retryResponse.ok) {
              throw new Error(`Retry failed: ${retryResponse.status}`);
            }

            // Process the successful retry response
            const retryResponseData = await retryResponse.json();
            const retryCreditsInfo = retryResponseData.credits;

            // Refresh subscription to get updated credits
            if (retryCreditsInfo !== undefined) {
              console.log("💰 Credits after message (retry):", retryCreditsInfo);
              await refreshSubscription();
            }

            // Fetch messages in chronological order to ensure proper sequence
            const { data: recentMessages, error: fetchError } = await supabase
              .from("messages")
              .select("*")
              .eq("conversation_id", newConversationId)
              .order("created_at", { ascending: true });

            if (fetchError || !recentMessages || recentMessages.length < 1) {
              // Fallback: create messages from response data
              const userMessageFromOptimistic: Message = {
                role: "user",
                content: content,
                messageId: `db-user-${Date.now()}`,
                userId: user?.id
              };
              
              const assistantMessageObj: Message = {
                role: "assistant",
                content: typeof retryResponseData.message === 'string' ? retryResponseData.message : JSON.stringify(retryResponseData.message, null, 2) || "No response received",
                sources: retryResponseData.sources || [],
                messageId: `server-assistant-${Date.now()}`,
                userId: user?.id
              };

              setMessages(prev => {
                const filteredMessages = prev.filter(m => m.messageId !== tempUserMessageId);
                return [...filteredMessages, userMessageFromOptimistic, assistantMessageObj];
              });
            } else {
              // Messages are already in correct chronological order
              const orderedMessages: Message[] = recentMessages
                .map(msg => ({
                  role: msg.role as "user" | "assistant",
                  content: msg.content,
                  sources: (msg.metadata as { sources?: any[] })?.sources || [],
                  messageId: msg.id,
                  userId: user?.id
                }));

              // Check if assistant message is already in DB results
              const hasAssistantResponse = orderedMessages.some(msg => msg.role === 'assistant');

              if (hasAssistantResponse) {
                // DB already has the assistant message, just use DB messages
                setMessages(prev => {
                  const filteredMessages = prev.filter(m => m.messageId !== tempUserMessageId);
                  return [...filteredMessages, ...orderedMessages];
                });
              } else {
                // DB doesn't have assistant message yet, add it from server response
                const assistantMessageObj: Message = {
                  role: "assistant",
                  content: typeof retryResponseData.message === 'string' ? retryResponseData.message : JSON.stringify(retryResponseData.message, null, 2) || "No response received",
                  sources: retryResponseData.sources || [],
                  messageId: `server-assistant-${Date.now()}`,
                  userId: user?.id
                };

                setMessages(prev => {
                  const filteredMessages = prev.filter(m => m.messageId !== tempUserMessageId);
                  return [...filteredMessages, ...orderedMessages, assistantMessageObj];
                });
              }
            }
            return; // Successfully handled with retry
          } else {
            throw new Error("Failed to create a new conversation after 'not found' error");
          }
        }

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
      const creditsInfo = responseData.credits;

      // Refresh subscription to get updated credits
      if (creditsInfo !== undefined) {
        console.log("💰 Credits after message:", creditsInfo);
        await refreshSubscription();
      }

      // Fetch messages in chronological order to ensure proper sequence
      const { data: recentMessages, error: fetchError } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", currentConversationId)
        .order("created_at", { ascending: true });

      if (fetchError || !recentMessages || recentMessages.length < 1) {
        // Fallback: create messages from response data
        const userMessageFromOptimistic: Message = {
          role: "user",
          content: content,
          messageId: `db-user-${Date.now()}`,
          userId: user?.id
        };
        
        const assistantMessageObj: Message = {
          role: "assistant",
          content: typeof responseData.message === 'string' ? responseData.message : JSON.stringify(responseData.message, null, 2) || "No response received",
          sources: responseData.sources || [],
          messageId: `server-assistant-${Date.now()}`,
          userId: user?.id
        };

        setMessages(prev => {
          const filteredMessages = prev.filter(m => m.messageId !== tempUserMessageId);
          return [...filteredMessages, userMessageFromOptimistic, assistantMessageObj];
        });
      } else {
        // Messages are already in correct chronological order
        const orderedMessages: Message[] = recentMessages
          .map(msg => ({
            role: msg.role as "user" | "assistant",
            content: msg.content,
            sources: (msg.metadata as { sources?: any[] })?.sources || [],
            messageId: msg.id,
            userId: user?.id
          }));

        // Check if assistant message is already in DB results
        const hasAssistantResponse = orderedMessages.some(msg => msg.role === 'assistant');

        if (hasAssistantResponse) {
          // DB already has the assistant message, just use DB messages
          setMessages(prev => {
            const filteredMessages = prev.filter(m => m.messageId !== tempUserMessageId);
            return [...filteredMessages, ...orderedMessages];
          });
        } else {
          // DB doesn't have assistant message yet, add it from server response
          const assistantMessageObj: Message = {
            role: "assistant",
            content: typeof responseData.message === 'string' ? responseData.message : JSON.stringify(responseData.message, null, 2) || "No response received",
            sources: responseData.sources || [],
            messageId: `server-assistant-${Date.now()}`,
            userId: user?.id
          };

          setMessages(prev => {
            const filteredMessages = prev.filter(m => m.messageId !== tempUserMessageId);
            return [...filteredMessages, ...orderedMessages, assistantMessageObj];
          });
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