import { useState } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: any[];
  messageId?: string;
  userId?: string;
}

interface UseMessageCacheReturn {
  deduplicateMessages: (msgs: Message[]) => Message[];
  cacheMessages: (conversationId: string, messages: Message[], userId?: string) => void;
  getCachedMessages: (conversationId: string, userId?: string) => Message[] | null;
  clearCache: (conversationId: string, userId?: string) => void;
}

export const useMessageCache = (): UseMessageCacheReturn => {
  // Deduplicate messages by id or fallback to content+role+userId signature
  const deduplicateMessages = (msgs: Message[]): Message[] => {
    const seen = new Map<string, Message>();
    return msgs.filter((msg) => {
      // Make sure content is a string for the deduplication key
      const contentString = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      const key = msg.messageId || `${msg.role}-${contentString}-${msg.userId || ''}`;
      if (seen.has(key)) {
        console.log("🚫 Duplicate message detected and removed:", key);
        return false;
      }
      seen.set(key, msg);
      return true;
    });
  };

  const cacheMessages = (conversationId: string, messages: Message[], userId?: string) => {
    try {
      // Use localStorage with user-specific key if userId is provided
      const cacheKey = userId ? `chat:${userId}:${conversationId}` : `chat:${conversationId}`;
      localStorage.setItem(cacheKey, JSON.stringify(messages));
    } catch (e) {
      console.warn("Failed to cache messages:", e);
    }
  };

  const getCachedMessages = (conversationId: string, userId?: string): Message[] | null => {
    try {
      // Try user-specific cache first
      if (userId) {
        const userCached = localStorage.getItem(`chat:${userId}:${conversationId}`);
        if (userCached) {
          return JSON.parse(userCached);
        }
      }
      // Fallback to old key for compatibility
      const cached = localStorage.getItem(`chat:${conversationId}`);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      console.error("Cache retrieval error:", e);
    }
    return null;
  };

  const clearCache = (conversationId: string, userId?: string) => {
    try {
      // Clear user-specific cache if userId is provided
      if (userId) {
        localStorage.removeItem(`chat:${userId}:${conversationId}`);
      }
      // Also clear old key for compatibility
      localStorage.removeItem(`chat:${conversationId}`);
    } catch (e) {
      console.error("Cache clearing error:", e);
    }
  };

  return {
    deduplicateMessages,
    cacheMessages,
    getCachedMessages,
    clearCache
  };
};