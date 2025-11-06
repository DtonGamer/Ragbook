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
  cacheMessages: (conversationId: string, messages: Message[]) => void;
  getCachedMessages: (conversationId: string) => Message[] | null;
  clearCache: (conversationId: string) => void;
}

export const useMessageCache = (): UseMessageCacheReturn => {
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

  const cacheMessages = (conversationId: string, messages: Message[]) => {
    try {
      sessionStorage.setItem(`chat:${conversationId}`, JSON.stringify(messages));
    } catch (e) {
      console.warn("Failed to cache messages:", e);
    }
  };

  const getCachedMessages = (conversationId: string): Message[] | null => {
    try {
      const cached = sessionStorage.getItem(`chat:${conversationId}`);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      console.error("Cache retrieval error:", e);
    }
    return null;
  };

  const clearCache = (conversationId: string) => {
    try {
      sessionStorage.removeItem(`chat:${conversationId}`);
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