import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: any[];
  messageId?: string;
  userId?: string;
}

interface UseConversationManagerProps {
  initialMessages: Message[];
  initialConversationId: string | null;
  onMessagesUpdate: (messages: Message[]) => void;
  onConversationIdUpdate: (id: string | null) => void;
  onIsLoadingConversationUpdate: (loading: boolean) => void;
  onShowWelcomeMessageUpdate: (show: boolean) => void;
  onIsNavigatingToChatUpdate: (navigating: boolean) => void;
  onSetShouldAutoScroll?: (shouldAutoScroll: boolean) => void;
  onSetIsUserScrolling?: (isUserScrolling: boolean) => void;
}

export const useConversationManager = ({
  initialMessages,
  initialConversationId,
  onMessagesUpdate,
  onConversationIdUpdate,
  onIsLoadingConversationUpdate,
  onShowWelcomeMessageUpdate,
  onIsNavigatingToChatUpdate,
  onSetShouldAutoScroll,
  onSetIsUserScrolling
}: UseConversationManagerProps) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [showWelcomeMessage, setShowWelcomeMessage] = useState(false);
  const [isNavigatingToChat, setIsNavigatingToChat] = useState(false);
  
  const loadingRef = useRef<boolean>(false);
  const prevConversationIdRef = useRef<string | null>(null);
  const isLoadingConversationRef = useRef(false);

  // Initialize conversation state
  useEffect(() => {
    if (!user) return;

    // Prevent running multiple times
    if (isLoadingConversationRef.current) {
      console.log("⏸️ Already loading initial conversation, skipping");
      return;
    }

    const lastId = (() => {
      try { 
        return localStorage.getItem("lastConversationId"); 
      } catch { 
        return null; 
      }
    })();

    console.log("🎬 Initial load - lastConversationId:", lastId);

    // If we already have messages from cache (set in useState initializer), don't load again
    if (lastId && lastId === conversationId && messages.length > 0) {
      console.log("✓ Already have cached messages, skipping load");
      setShowWelcomeMessage(false);
      setIsNavigatingToChat(false);
      onShowWelcomeMessageUpdate(false);
      onIsNavigatingToChatUpdate(false);
      return;
    }

    // Check if this is likely a new conversation by seeing if there's no cache for it
    // A new conversation that was just created won't have cached messages yet
    const hasCachedMessages = lastId ? !!sessionStorage.getItem(`chat:${lastId}`) : false;
    
    // If there's a previous conversation ID and no messages yet
    if (lastId && messages.length === 0) {
      // If there are cached messages for this conversation, it's an existing one, show welcome options
      // If there are no cached messages, it might be a new conversation or one that hasn't been loaded yet
      if (hasCachedMessages) {
        setIsNavigatingToChat(true);
        setConversationId(lastId);
        onIsNavigatingToChatUpdate(true);
        onConversationIdUpdate(lastId);
      } else {
        // For conversations with no cached messages, we need to load from DB to determine if it's new
        // We'll initially set the conversation ID and let the loadConversation handle the rest
        setConversationId(lastId);
        onConversationIdUpdate(lastId);
        // Don't set isNavigatingToChat to true yet - we'll decide after loading
        setIsNavigatingToChat(false);
        onIsNavigatingToChatUpdate(false);
      }
    } else if (!conversationId && !isLoadingConversation && !loadingRef.current) {
      console.log("🆕 No conversation found, creating new one");
      setIsNavigatingToChat(false);
      onIsNavigatingToChatUpdate(false);
      loadOrCreateConversation();
    } else if (conversationId && messages.length === 0 && !isLoadingConversation) {
      // If we have a conversation ID but still no messages after loading, 
      // determine based on whether it has cached messages
      const hasCachedMessagesCurrent = conversationId ? !!sessionStorage.getItem(`chat:${conversationId}`) : false;
      if (hasCachedMessagesCurrent) {
        // This is an existing conversation that we tried to load but has no messages
        setIsNavigatingToChat(true);
        onIsNavigatingToChatUpdate(true);
      } else {
        // Likely a new conversation with no messages yet
        setIsNavigatingToChat(false);
        onIsNavigatingToChatUpdate(false);
      }
    } else {
      setIsNavigatingToChat(false);
      onIsNavigatingToChatUpdate(false);
    }
  }, [user]); // Only depend on user

  // Effect to handle when conversation is updated (to turn off navigation loading state)
  useEffect(() => {
    // If we're navigating to chat and have loaded messages, turn off the navigation loading state
    if (isNavigatingToChat && messages.length > 0 && conversationId) {
      setIsNavigatingToChat(false);
      onIsNavigatingToChatUpdate(false);
    }
  }, [messages.length, conversationId, isNavigatingToChat]);

  // Update parent state when local state changes
  useEffect(() => {
    onMessagesUpdate(messages);
  }, [messages]); // Remove callback from deps to prevent infinite loop

  useEffect(() => {
    onConversationIdUpdate(conversationId);
  }, [conversationId]); // Remove callback from deps to prevent infinite loop

  useEffect(() => {
    onIsLoadingConversationUpdate(isLoadingConversation);
  }, [isLoadingConversation]); // Remove callback from deps to prevent infinite loop

  const loadOrCreateConversation = async () => {
    if (!user || isLoadingConversation) return;

    try {
      const { data: recentConversations, error: loadError } = await supabase
        .from("conversations")
        .select("id, title, created_at, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (loadError) {
        console.error("Error loading conversations:", loadError);
        await createConversation();
        return;
      }

      if (recentConversations && recentConversations.length > 0) {
        const recentConversation = recentConversations[0];
        setConversationId(recentConversation.id);
        onConversationIdUpdate(recentConversation.id);
        await loadConversation(recentConversation.id);
        console.log("Loaded existing conversation:", recentConversation.id);
      } else {
        await createConversation();
      }
    } catch (error) {
      console.error("Error in loadOrCreateConversation:", error);
      await createConversation();
    }
  };

  const createConversation = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("conversations")
      .insert({ user_id: user.id })
      .select()
      .single();

    if (error) {
      console.error("Error creating conversation:", error);
      toast.error("Failed to create conversation");
      return;
    }

    setConversationId(data.id);
    onConversationIdUpdate(data.id);
    try {
      localStorage.setItem("lastConversationId", data.id);
    } catch {}
    setMessages([]);
    onMessagesUpdate([]);
    setShowWelcomeMessage(false);
    onShowWelcomeMessageUpdate(false);
    // Ensure we're not showing the navigation loading state anymore
    setIsNavigatingToChat(false);
    onIsNavigatingToChatUpdate(false);
    console.log("Created new conversation:", data.id);
  };

  const handleNewConversation = async () => {
    await createConversation();
    // When creating a new conversation, we should not show the navigation state anymore
    setIsNavigatingToChat(false);
    onIsNavigatingToChatUpdate(false);
  };

  const clearCurrentConversation = () => {
    setConversationId(null);
    onConversationIdUpdate(null);
    setMessages([]);
    onMessagesUpdate([]);
    setShowWelcomeMessage(true);
    onShowWelcomeMessageUpdate(true);
  };

  const loadConversation = async (newConversationId: string, clearMessages: boolean = false) => {
    console.log("🔄 loadConversation called:", { 
      newConversationId, 
      currentConversationId: conversationId,
      isLoading: isLoadingConversationRef.current 
    });
    
    // CRITICAL: Prevent concurrent loads of the same conversation
    if (isLoadingConversationRef.current) {
      console.log("⏸️ Load already in progress, skipping");
      return;
    }

    // Don't reload if we're already viewing this conversation with messages
    if (conversationId === newConversationId && messages.length > 0 && !clearMessages) {
      console.log("✓ Already viewing this conversation with messages");
      // Ensure welcome message is hidden when viewing existing conversation
      setShowWelcomeMessage(false);
      onShowWelcomeMessageUpdate(false);
      return;
    }

    // Set loading flag immediately to prevent double-loads
    isLoadingConversationRef.current = true;
    loadingRef.current = true;
    setIsLoadingConversation(true);
    onIsLoadingConversationUpdate(true);
    
    // Hide welcome message as soon as we start loading a real conversation
    setShowWelcomeMessage(false);
    onShowWelcomeMessageUpdate(false);

    try {
      // Check cache first for instant loading
      const cached = sessionStorage.getItem(`chat:${newConversationId}`);
      if (cached && !clearMessages) {
        try {
          const cachedMessages: Message[] = JSON.parse(cached);
          if (Array.isArray(cachedMessages) && cachedMessages.length > 0) {
            console.log("⚡ Using cached messages:", cachedMessages.length);
            
            // Determine if this is switching to a different conversation
            const isSwitchingConversation = prevConversationIdRef.current !== newConversationId;
            
            // Update state in one batch
            setMessages(cachedMessages);
            onMessagesUpdate(cachedMessages);
            setConversationId(newConversationId);
            onConversationIdUpdate(newConversationId);
            
            // Update ref to track current conversation
            prevConversationIdRef.current = newConversationId;
            
            // Release loading locks
            isLoadingConversationRef.current = false;
            loadingRef.current = false;
            setIsLoadingConversation(false);
            onIsLoadingConversationUpdate(false);
            
            return;
          }
        } catch (e) {
          console.error("Cache parse error:", e);
        }
      }

      console.log("📥 Loading conversation from database...");
      
      const { data: messagesData, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", newConversationId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error loading messages:", error);
        toast.error("Failed to load conversation");
        return;
      }

      const loadedMessages: Message[] = messagesData.map(msg => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
        sources: (msg.metadata as { sources?: any[] })?.sources || [],
        messageId: msg.id,
        userId: user?.id
      }));

      console.log("✅ Loaded from database:", loadedMessages.length, "messages");
      
      // Determine if this is switching to a different conversation
      const isSwitchingConversation = prevConversationIdRef.current !== newConversationId;
      
      // Update all state together
      setMessages(loadedMessages);
      onMessagesUpdate(loadedMessages);
      setConversationId(newConversationId);
      onConversationIdUpdate(newConversationId);
      
      // Cache for next time
      try {
        sessionStorage.setItem(`chat:${newConversationId}`, JSON.stringify(loadedMessages));
      } catch (e) {
        console.warn("Failed to cache messages:", e);
      }
      
      // Update ref to track current conversation
      prevConversationIdRef.current = newConversationId;

      // Reset scroll state for loaded conversation (instant scroll to bottom)
      if (onSetShouldAutoScroll) {
        onSetShouldAutoScroll(false); // Disable auto-scroll for loaded conversations
      }
      if (onSetIsUserScrolling) {
        onSetIsUserScrolling(false); // Reset user scrolling state
      }

    } catch (error) {
      console.error("Error loading conversation:", error);
      toast.error("Failed to load conversation");
    } finally {
      // Always release locks
      isLoadingConversationRef.current = false;
      loadingRef.current = false;
      setIsLoadingConversation(false);
      onIsLoadingConversationUpdate(false);
    }
  };

  return {
    messages,
    setMessages,
    conversationId,
    setConversationId,
    isLoadingConversation,
    setIsLoadingConversation,
    showWelcomeMessage,
    setShowWelcomeMessage,
    isNavigatingToChat,
    setIsNavigatingToChat,
    loadOrCreateConversation,
    createConversation,
    handleNewConversation,
    clearCurrentConversation,
    loadConversation
  };
};