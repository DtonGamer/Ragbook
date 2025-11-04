import { ChatInput } from "@/components/ChatInput";
import { ChatMessage } from "@/components/ChatMessage";
import { CreditsDisplay } from "@/components/CreditsDisplay";
import { LoadingState } from "@/components/LoadingState";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ConversationSidebar } from "@/components/ConversationSidebar";
import { SystemMemory } from "@/components/SystemMemory";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Bot, CreditCard, Crown, FileText, LogOut, Plus, Settings } from "lucide-react";

import { toast } from "sonner";

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
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef<boolean>(false);
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Add new state variables for scroll behavior
  const [shouldAutoScroll, setShouldAutoScroll] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const prevConversationIdRef = useRef<string | null>(null);
  const isLoadingConversationRef = useRef(false);
  const [isNavigatingToChat, setIsNavigatingToChat] = useState(() => {
    // If we have messages from cache, we're not navigating to an empty chat
    try {
      const lastId = localStorage.getItem("lastConversationId");
      if (lastId) {
        const cached = sessionStorage.getItem(`chat:${lastId}`);
        if (cached) {
          const cachedMessages: Message[] = JSON.parse(cached);
          if (Array.isArray(cachedMessages) && cachedMessages.length > 0) {
            return false; // No need for navigation loading if we have cached messages
          }
        }
      }
    } catch (e) {
      console.error("Initial cache check error:", e);
    }
    // Changed default from true to false to show welcome options instead of loading state
    return false; // Show welcome options instead of loading spinner
  });

  // Deduplicate messages by id or fallback to content+role+userId signature
  const deduplicateMessages = (msgs: Message[]): Message[] => {
    const seen = new Map<string, Message>();
    return msgs.filter((msg) => {
      const key = msg.messageId || `${msg.role}-${msg.content}-${msg.userId}`;
      if (seen.has(key)) {
        console.log("🚫 Duplicate message detected and removed:", key);
        return false;
      }
      seen.set(key, msg);
      return true;
    });
  };

  // Single useEffect to handle initial load (conversation-first restore)
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
      return;
    }

    // If there's a previous conversation ID and no messages yet, show welcome options
    // and set the conversation ID for when the user chooses to load it
    if (lastId && messages.length === 0) {
      setIsNavigatingToChat(true);
      setConversationId(lastId);
    } else if (!conversationId && !isLoadingConversation && !loadingRef.current) {
      console.log("🆕 No conversation found, creating new one");
      setIsNavigatingToChat(false);
      loadOrCreateConversation();
    } else if (conversationId && messages.length === 0 && !isLoadingConversation) {
      setIsNavigatingToChat(true);
    } else {
      setIsNavigatingToChat(false);
    }
  }, [user]); // Only depend on user

  // Effect to handle when conversation is updated (to turn off navigation loading state)
  useEffect(() => {
    // If we're navigating to chat and have loaded messages, turn off the navigation loading state
    if (isNavigatingToChat && messages.length > 0 && conversationId) {
      setIsNavigatingToChat(false);
    }
  }, [messages.length, conversationId, isNavigatingToChat]);

  // Keyboard shortcut for toggling sidebar
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

  // Smarter scrolling useEffect
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
  }, [messages, shouldAutoScroll, isInitialLoad]);

  useEffect(() => {
    console.log("Messages updated:", messages.length);
  }, [messages]);

  useEffect(() => {
    if (conversationId) {
      try {
        localStorage.setItem("lastConversationId", conversationId);
      } catch {}
    }
  }, [conversationId]);

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
    try {
      localStorage.setItem("lastConversationId", data.id);
    } catch {}
    setMessages([]);
    setShowWelcomeMessage(false);
    console.log("Created new conversation:", data.id);
  };

  const handleNewConversation = async () => {
    await createConversation();
    setSidebarRefreshTrigger(prev => prev + 1);
  };

  const clearCurrentConversation = () => {
    setConversationId(null);
    setMessages([]);
    setShowWelcomeMessage(true);
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
      return;
    }

    // Set loading flag immediately to prevent double-loads
    isLoadingConversationRef.current = true;
    loadingRef.current = true;
    setIsLoadingConversation(true);
    
    // Hide welcome message as soon as we start loading a real conversation
    setShowWelcomeMessage(false);

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
            setConversationId(newConversationId);
            
            // If switching conversations, we want instant positioning
            // If it's initial load, let the main useEffect handle it
            if (isSwitchingConversation && !isInitialLoad) {
              setIsInitialLoad(true); // Trigger instant scroll
            }
            
            setShouldAutoScroll(false); // Don't animate scroll for cached loads
            
            // Update ref to track current conversation
            prevConversationIdRef.current = newConversationId;
            
            // Release loading locks
            isLoadingConversationRef.current = false;
            loadingRef.current = false;
            setIsLoadingConversation(false);
            
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
      setConversationId(newConversationId);
      
      // If switching conversations, trigger instant positioning
      if (isSwitchingConversation && !isInitialLoad) {
        setIsInitialLoad(true);
      }
      
      setShouldAutoScroll(false);
      
      // Cache for next time
      try {
        sessionStorage.setItem(`chat:${newConversationId}`, JSON.stringify(loadedMessages));
      } catch (e) {
        console.warn("Failed to cache messages:", e);
      }
      
      // Update ref to track current conversation
      prevConversationIdRef.current = newConversationId;

    } catch (error) {
      console.error("Error loading conversation:", error);
      toast.error("Failed to load conversation");
    } finally {
      // Always release locks
      isLoadingConversationRef.current = false;
      loadingRef.current = false;
      setIsLoadingConversation(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const handleSendMessage = async (content: string) => {
    console.log("🚀 Starting handleSendMessage");
    
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

    // Enable smooth scrolling for new messages being added
    setShouldAutoScroll(true);
    setIsInitialLoad(false); // Make sure we're not in initial load mode

    const tempUserMessageId = `temp-user-${Date.now()}`;
    const tempAssistantMessageId = `temp-assistant-${Date.now()}`;

    const optimisticUserMessage: Message = { 
      role: "user", 
      content, 
      messageId: tempUserMessageId,
      userId: user.id 
    };
    
    console.log("✅ Adding optimistic user message");
    setMessages((prev) => [...prev, optimisticUserMessage]);

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
      };
      
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rag-chat`;
      
      console.log('📤 Sending request to rag-chat');

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
          navigate('/auth');
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
          userId: user.id
        };
        setMessages((prev) => {
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
      setMessages((prev) => prev.filter(m => m.messageId !== tempUserMessageId));
    } finally {
      setIsLoading(false);
      // Keep auto-scroll enabled for potential follow-up messages
    }
  };


  const sidebar = (
  <div className="h-full flex flex-col">
     {/* ConversationSidebar now handles its own header */}
    <ConversationSidebar
        currentConversationId={conversationId}
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
            {/* Show welcome options when navigating to chat with existing conversation */}
            {(isNavigatingToChat && conversationId && messages.length === 0) ? (
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
                    >
                      <span>Continue Previous Conversation</span>
                    </Button>
                    <Button 
                      onClick={handleNewConversation}
                      variant="outline"
                      className="transition-smooth hover:scale-102 active:scale-98 min-w-[200px]"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Start New Conversation
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {messages.length === 0 && !isNavigatingToChat && (
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
                            onClick={handleNewConversation}
                            className="mb-4 transition-smooth hover:scale-102 active:scale-98"
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
                )}

                {deduplicateMessages(messages).map((message, index, arr) => (
                  <ChatMessage 
                    key={message.messageId || `msg-${index}-${message.role}`} 
                    {...message} 
                    isNew={index === arr.length - 1}
                    isStreaming={isLoading && index === arr.length - 1 && message.role === 'assistant'}
                  />
                ))}

                {isLoading && !isNavigatingToChat && (
                  <div className="flex gap-4 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center shrink-0 shadow-sm shadow-primary/20">
                      <Bot className="w-5 h-5 text-primary-foreground animate-pulse" />
                    </div>
                    <div className="flex-1">
                      <div className="rounded-2xl px-5 py-4 bg-card border border-border/50 shadow-sm max-w-[70%]">
                        <div className="flex gap-2">
                          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </>
            )}
          </div>
        </div>

        {/* Input - Fixed footer with dynamic left offset */}
        <div className={`fixed bottom-0 left-0 right-0 border-t border-border/50 backdrop-blur-sm bg-card/95 shadow-lg z-30 transition-all duration-300 pb-safe ${sidebarCollapsed ? 'lg:left-20' : 'lg:left-80'}`}>
          <div className="max-w-4xl mx-auto px-5 sm:px-4 py-4">
            <ChatInput onSend={handleSendMessage} disabled={isLoading || isNavigatingToChat} />
            <p className="text-xs text-muted-foreground text-center mt-2">
              {isNavigatingToChat && conversationId && messages.length === 0 
                ? "Select an option above to continue" 
                : "Press Enter to send, Shift+Enter for new line"}
            </p>
          </div>
        </div>
      </div>

      {/* Upgrade Modal */}
      <Dialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-yellow-500" />
              Upgrade to Pro
            </DialogTitle>
            <DialogDescription>
              You've run out of credits! Upgrade to Pro for unlimited access.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <h4 className="font-semibold">Pro Benefits:</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>✓ 1,000 credits per month</li>
                <li>✓ Process scanned PDFs with OCR</li>
                <li>✓ Priority processing queue</li>
                <li>✓ Larger file uploads (50 MB)</li>
                <li>✓ All future features included</li>
              </ul>
            </div>
            <div className="bg-primary/10 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold">₦3,000/month</p>
              <p className="text-sm text-muted-foreground">~$6.50 USD</p>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowUpgradeModal(false)}
              className="w-full sm:w-auto"
            >
              Maybe Later
            </Button>
            <Button
              onClick={() => {
                setShowUpgradeModal(false);
                navigate("/pricing");
              }}
              className="w-full sm:w-auto bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 text-black"
            >
              <Crown className="mr-2 h-4 w-4" />
              Upgrade Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ResponsiveLayout>
  );
};

export default Chat;