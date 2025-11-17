import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthProvider";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: any[];
  messageId?: string;
  userId?: string;
}

interface UseConversationManagerProps {
  onSidebarRefresh?: () => void;
}

export const useConversationManager = ({
  onSidebarRefresh
}: UseConversationManagerProps) => {
  const { user } = useAuthContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [showWelcomeMessage, setShowWelcomeMessage] = useState(false); // Changed to false by default
  const [isCreatingNew, setIsCreatingNew] = useState(false); // Track if we're creating a new conversation

  const isInitializing = useRef(false);
  const hasInitialized = useRef(false);

  // Simple cache helpers
  const getCacheKey = (convId: string) =>
    user ? `chat:${user.id}:${convId}` : `chat:${convId}`;

  const loadFromCache = (convId: string): Message[] | null => {
    try {
      const cached = localStorage.getItem(getCacheKey(convId));
      if (cached) {
        const parsed = JSON.parse(cached);
        return Array.isArray(parsed) ? parsed : null;
      }
    } catch (e) {
      console.error("Cache load error:", e);
    }
    return null;
  };

  const saveToCache = (convId: string, msgs: Message[]) => {
    try {
      localStorage.setItem(getCacheKey(convId), JSON.stringify(msgs));
    } catch (e) {
      console.warn("Cache save error:", e);
    }
  };

  // Initialize on mount - SIMPLIFIED
  useEffect(() => {
    if (!user || hasInitialized.current || isInitializing.current) return;

    isInitializing.current = true;
    hasInitialized.current = true;

    const initialize = async () => {
      try {
        const lastConvId = localStorage.getItem("lastConversationId");

        if (lastConvId) {
          // Try to load the last conversation
          const cached = loadFromCache(lastConvId);

          if (cached && cached.length > 0) {
            // Use cached data immediately
            setConversationId(lastConvId);
            setMessages(cached);
            setShowWelcomeMessage(false);
            console.log("✅ Loaded from cache:", cached.length, "messages");
          } else {
            // Check if the conversation exists in the database
            const { data: convExists, error: convError } = await supabase
              .from("conversations")
              .select("id")
              .eq("id", lastConvId)
              .single();

            if (convExists && !convError) {
              // Load from database
              await loadConversation(lastConvId);
            } else {
              // Conversation doesn't exist in DB - show welcome message
              resetToWelcomeState();
            }
          }
        } else {
          // No previous conversation - show welcome
          resetToWelcomeState();
        }
      } catch (error) {
        console.error("Initialization error:", error);
        // On error, reset to welcome state
        resetToWelcomeState();
      } finally {
        isInitializing.current = false;
      }
    };

    initialize();
  }, [user]);

  // Helper function to reset to welcome state
  const resetToWelcomeState = () => {
    setConversationId(null);
    setMessages([]);
    setShowWelcomeMessage(true);
    setIsCreatingNew(true);
  };

  // Save to cache whenever messages change
  useEffect(() => {
    if (conversationId && messages.length > 0) {
      saveToCache(conversationId, messages);
      localStorage.setItem("lastConversationId", conversationId);
    }
  }, [conversationId, messages]);

  const loadConversation = async (convId: string) => {
    if (isLoadingConversation) return;

    setIsLoadingConversation(true);

    try {
      const { data: messagesData, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const loadedMessages: Message[] = messagesData.map(msg => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
        sources: (msg.metadata as { sources?: any[] })?.sources || [],
        messageId: msg.id,
        userId: user?.id
      }));

      setConversationId(convId);
      setMessages(loadedMessages);
      setShowWelcomeMessage(false);
      setIsCreatingNew(false); // Reset the creating new state when loading existing conversation
      saveToCache(convId, loadedMessages);

      console.log("✅ Loaded from DB:", loadedMessages.length, "messages");
    } catch (error) {
      console.error("Error loading conversation:", error);
      toast.error("Failed to load conversation");
      // If conversation doesn't exist, show welcome message
      resetToWelcomeState();
    } finally {
      setIsLoadingConversation(false);
    }
  };

  const createConversation = async () => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from("conversations")
        .insert({ user_id: user.id })
        .select()
        .single();

      if (error) throw error;

      setConversationId(data.id);
      setMessages([]);
      setShowWelcomeMessage(false);
      setIsCreatingNew(false); // Reset the creating new state when a conversation is created in DB
      localStorage.setItem("lastConversationId", data.id);

      console.log("✅ Created new conversation:", data.id);

      // Refresh sidebar
      onSidebarRefresh?.();

      return data.id;
    } catch (error) {
      console.error("Error creating conversation:", error);
      toast.error("Failed to create conversation");
      return null;
    }
  };

  const handleNewConversation = async () => {
    // Reset to initial state without creating a DB entry initially
    setConversationId(null);
    setMessages([]);
    setShowWelcomeMessage(true);
    setIsCreatingNew(true); // Indicate we're in a new conversation state
  };

  return {
    messages,
    setMessages,
    conversationId,
    setConversationId,
    isLoadingConversation,
    showWelcomeMessage,
    setShowWelcomeMessage,
    isCreatingNew,
    loadConversation,
    createConversation,
    handleNewConversation,
  };
};