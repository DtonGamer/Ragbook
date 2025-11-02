import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useConfirmation } from "@/hooks/useConfirmation";
import { supabase } from "@/integrations/supabase/client";
import {
  Clock,
  Edit2,
  MessageSquare,
  MoreVertical,
  Plus,
  Search,
  Trash2
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

interface ConversationSidebarProps {
  currentConversationId: string | null;
  onConversationSelect: (conversationId: string) => void;
  onNewConversation: () => void;
  onClearCurrentConversation?: () => void;
  className?: string;
  collapsed?: boolean;
  refreshTrigger?: number;
}

export const ConversationSidebar = ({
  currentConversationId,
  onConversationSelect,
  onNewConversation,
  onClearCurrentConversation,
  className = "",
  collapsed = false,
  refreshTrigger = 0
}: ConversationSidebarProps) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const { confirm, cancel, handleConfirm, confirmationState } = useConfirmation();

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (refreshTrigger > 0) {
      loadConversations();
    }
  }, [refreshTrigger]);

  const loadConversations = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("conversations")
        .select(`
          id,
          title,
          created_at,
          updated_at,
          messages(count)
        `)
        .eq("user_id", session.user.id)
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("Error loading conversations:", error);
        toast.error("Failed to load conversations");
        return;
      }

      const conversationsWithCount = data.map(conv => ({
        id: conv.id,
        title: conv.title || "New Conversation",
        created_at: conv.created_at,
        updated_at: conv.updated_at,
        message_count: conv.messages?.[0]?.count || 0
      }));

      setConversations(conversationsWithCount);
    } catch (error) {
      console.error("Error loading conversations:", error);
      toast.error("Failed to load conversations");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRename = async (conversationId: string, newTitle: string) => {
    if (!newTitle.trim()) return;

    try {
      const { error } = await supabase
        .from("conversations")
        .update({ title: newTitle.trim() })
        .eq("id", conversationId);

      if (error) {
        console.error("Error renaming conversation:", error);
        toast.error("Failed to rename conversation");
        return;
      }

      setConversations(prev => 
        prev.map(conv => 
          conv.id === conversationId 
            ? { ...conv, title: newTitle.trim() }
            : conv
        )
      );
      setEditingId(null);
      setEditingTitle("");
      toast.success("Conversation renamed");
    } catch (error) {
      console.error("Error renaming conversation:", error);
      toast.error("Failed to rename conversation");
    }
  };

  const handleDelete = async (conversationId: string) => {
    const confirmed = await confirm({
      title: "Delete Conversation",
      description: "Are you sure you want to delete this conversation? This action cannot be undone.",
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "destructive",
      icon: "trash"
    });

    if (!confirmed) return;

    try {
      const { error: messagesError } = await supabase
        .from("messages")
        .delete()
        .eq("conversation_id", conversationId);

      if (messagesError) {
        console.error("Error deleting messages:", messagesError);
        toast.error("Failed to delete conversation");
        return;
      }

      const { error } = await supabase
        .from("conversations")
        .delete()
        .eq("id", conversationId);

      if (error) {
        console.error("Error deleting conversation:", error);
        toast.error("Failed to delete conversation");
        return;
      }

      setConversations(prev => prev.filter(conv => conv.id !== conversationId));
      
      if (conversationId === currentConversationId) {
        if (onClearCurrentConversation) {
          onClearCurrentConversation();
        } else {
          onNewConversation();
        }
      }
      
      toast.success("Conversation deleted");
    } catch (error) {
      console.error("Error deleting conversation:", error);
      toast.error("Failed to delete conversation");
    }
  };

  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className={`bg-card flex flex-col h-full transition-all duration-300 overflow-hidden ${className}`}>
      {/* Header with Title and New Chat Button */}
      <div className={`border-b border-border/50 flex-shrink-0 ${collapsed ? 'p-3' : 'p-4'}`}>
        {!collapsed ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Conversations</h2>
              <Button
                size="sm"
                onClick={onNewConversation}
                className="h-9 w-9 p-0 rounded-lg bg-primary hover:bg-primary/90 transition-colors"
                title="New conversation"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-9 bg-background/50 border-border/50 focus:border-primary/50 transition-colors"
              />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Button
              size="sm"
              onClick={onNewConversation}
              className="h-10 w-10 p-0 rounded-lg bg-primary hover:bg-primary/90 transition-colors"
              title="New conversation"
            >
              <Plus className="w-4 h-4" />
            </Button>
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-primary" />
            </div>
          </div>
        )}
      </div>

      {/* Conversations List - Scrollable */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className={`space-y-2 ${collapsed ? 'p-2' : 'p-3'}`}>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className={`${collapsed ? 'h-12' : 'h-14'} bg-muted/50 rounded-lg animate-pulse`} />
              ))}
            </div>
          ) : filteredConversations.length === 0 ? (
            !collapsed && (
              <div className="text-center py-6 px-4 text-muted-foreground">
                <MessageSquare className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p className="text-sm">
                  {searchQuery ? "No conversations found" : "No conversations yet"}
                </p>
              </div>
            )
          ) : (
            filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`group relative rounded-lg cursor-pointer transition-all duration-200 ${
                  collapsed ? 'p-2' : 'p-3'
                } ${
                  conversation.id === currentConversationId
                    ? "bg-primary/10 border border-primary/20 shadow-sm"
                    : "hover:bg-muted/50 hover:shadow-sm hover:border-border/50 border border-transparent"
                }`}
                onClick={() => onConversationSelect(conversation.id)}
                title={collapsed ? conversation.title : undefined}
              >
                {collapsed ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <MessageSquare className="w-4 h-4 text-primary" />
                    </div>
                    {conversation.message_count > 0 && (
                      <Badge variant="secondary" className="h-4 px-1.5 text-xs font-medium">
                        {conversation.message_count}
                      </Badge>
                    )}
                  </div>
                ) : editingId === conversation.id ? (
                  <div className="space-y-2">
                    <Input
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={() => {
                        if (editingTitle.trim()) {
                          handleRename(conversation.id, editingTitle);
                        } else {
                          setEditingId(null);
                          setEditingTitle("");
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleRename(conversation.id, editingTitle);
                        } else if (e.key === "Escape") {
                          setEditingId(null);
                          setEditingTitle("");
                        }
                      }}
                      className="h-8 text-sm"
                      autoFocus
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <h3 className="font-medium text-sm truncate pr-8 text-foreground">
                        {conversation.title}
                      </h3>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted/50"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingId(conversation.id);
                              setEditingTitle(conversation.title);
                            }}
                          >
                            <Edit2 className="w-4 h-4 mr-2" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(conversation.id);
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{formatDate(conversation.updated_at)}</span>
                      {conversation.message_count > 0 && (
                        <>
                          <Separator orientation="vertical" className="h-3" />
                          <Badge variant="secondary" className="h-5 px-2 text-xs font-medium">
                            {conversation.message_count}
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <ConfirmationDialog
        open={confirmationState.open}
        onOpenChange={cancel}
        onConfirm={handleConfirm}
        title={confirmationState.title}
        description={confirmationState.description}
        confirmText={confirmationState.confirmText}
        cancelText={confirmationState.cancelText}
        variant={confirmationState.variant}
        icon={confirmationState.icon}
      />
    </div>
  );
};