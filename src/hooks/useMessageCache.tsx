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
  clearAllCache: () => void;
  getCacheSize: (conversationId: string, userId?: string) => number;
}

// Generate cache key consistently across functions
const generateCacheKey = (conversationId: string, userId?: string): string => {
  return userId ? `chat:${userId}:${conversationId}` : `chat:${conversationId}`;
};

// Generate deduplication key consistently
const generateDeduplicationKey = (msg: Message): string => {
  // Make sure content is a string for the deduplication key
  const contentString = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
  return msg.messageId || `${msg.role}-${contentString}-${msg.userId || ''}`;
};

export const useMessageCache = (): UseMessageCacheReturn => {
  // Deduplicate messages by id or fallback to content+role+userId signature
  const deduplicateMessages = (msgs: Message[]): Message[] => {
    const seen = new Map<string, Message>();
    return msgs.filter((msg) => {
      const key = generateDeduplicationKey(msg);
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
      const cacheKey = generateCacheKey(conversationId, userId);
      
      // Check cache size before storing to prevent localStorage from getting too large
      const serializedMessages = JSON.stringify(messages);
      const byteSize = new Blob([serializedMessages]).size;
      
      // If cache is too large (1MB limit), we might want to consider a different approach
      // For now, let's log if it's large
      if (byteSize > 1024 * 1024) { // 1MB
        console.warn(`Cache size is very large (${Math.round(byteSize / 1024)}KB) for conversation ${conversationId}`);
      }
      
      localStorage.setItem(cacheKey, serializedMessages);
    } catch (e) {
      console.warn("Failed to cache messages:", e);
    }
  };

  const getCachedMessages = (conversationId: string, userId?: string): Message[] | null => {
    try {
      // Try user-specific cache first
      const cacheKey = generateCacheKey(conversationId, userId);
      const cached = localStorage.getItem(cacheKey);
      
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
      const cacheKey = generateCacheKey(conversationId, userId);
      localStorage.removeItem(cacheKey);
    } catch (e) {
      console.error("Cache clearing error:", e);
    }
  };

  const clearAllCache = () => {
    try {
      // Clear all chat-related cache entries
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('chat:')) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (e) {
      console.error("Clear all cache error:", e);
    }
  };

  const getCacheSize = (conversationId: string, userId?: string): number => {
    try {
      const cacheKey = generateCacheKey(conversationId, userId);
      const cached = localStorage.getItem(cacheKey);
      
      if (cached) {
        return new Blob([cached]).size;
      }
      return 0;
    } catch (e) {
      console.error("Get cache size error:", e);
      return 0;
    }
  };

  return {
    deduplicateMessages,
    cacheMessages,
    getCachedMessages,
    clearCache,
    clearAllCache,
    getCacheSize
  };
};