import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
// ============================================================================
// CONFIGURATION
// ============================================================================
const EMBEDDING_DIMENSIONS = 384;
const MAX_MESSAGE_LENGTH = 10000;
const DEBUG_MODE = Deno.env.get('DEBUG_MODE') === 'true'; // Only log in debug mode
// Rate limiting (10 requests per minute)
const RATE_LIMITS = {
  CHAT: {
    windowMs: 60 * 1000,
    maxRequests: 10
  }
};
// Security headers
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
};
// Validation patterns
const VALIDATION_PATTERNS = {
  NO_SCRIPT_TAGS: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  NO_HTML_TAGS: /<[^>]*>/g,
  PROMPT_INJECTION: [
    /ignore\s+(previous|above|all)\s+(instructions?|prompts?|rules?)/i,
    /forget\s+(everything|all)\s+(previous|above)/i,
    /you\s+are\s+now\s+(a\s+)?(different|new)/i,
    /pretend\s+to\s+be/i,
    /act\s+as\s+if/i,
    /roleplay\s+as/i,
    /system\s*:\s*override/i,
    /admin\s*:\s*override/i,
    /jailbreak/i,
    /DAN\s+mode/i
  ]
};
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400',
  ...SECURITY_HEADERS
};
// ============================================================================
// UTILITY: DEBUG LOGGING
// ============================================================================
function debugLog(category, message, data) {
  if (DEBUG_MODE) {
    console.log(`[${category}]`, message, data || '');
  }
}
// ============================================================================
// RATE LIMITING
// ============================================================================
const rateLimitStore = new Map();
// Cleanup old entries every 5 minutes
setInterval(()=>{
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()){
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);
async function checkRateLimit(req) {
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  let userId = 'anonymous';
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const payload = JSON.parse(atob(token.split('.')[1]));
      userId = payload.sub || 'anonymous';
    } catch (error) {
    // Ignore
    }
  }
  const key = `${ip}:${userId}`;
  const now = Date.now();
  const config = RATE_LIMITS.CHAT;
  let entry = rateLimitStore.get(key);
  if (!entry || now > entry.resetTime) {
    entry = {
      count: 0,
      resetTime: now + config.windowMs
    };
  }
  if (entry.count >= config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
      retryAfter
    };
  }
  entry.count++;
  rateLimitStore.set(key, entry);
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime
  };
}
// ============================================================================
// VALIDATION
// ============================================================================
function validateMessage(message) {
  const errors = [];
  if (!message || typeof message !== 'string') {
    errors.push('Message is required');
    return {
      isValid: false,
      errors
    };
  }
  let sanitized = message.trim().replace(VALIDATION_PATTERNS.NO_SCRIPT_TAGS, '').replace(VALIDATION_PATTERNS.NO_HTML_TAGS, '').slice(0, MAX_MESSAGE_LENGTH);
  if (sanitized.length === 0) errors.push('Message cannot be empty');
  if (sanitized.length > MAX_MESSAGE_LENGTH) errors.push('Message is too long');
  const hasPromptInjection = VALIDATION_PATTERNS.PROMPT_INJECTION.some((pattern)=>pattern.test(sanitized));
  if (hasPromptInjection) errors.push('Message contains potentially harmful content');
  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData: errors.length === 0 ? sanitized : undefined
  };
}
function validateUuid(uuid) {
  const errors = [];
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid || typeof uuid !== 'string') {
    errors.push('UUID is required');
    return {
      isValid: false,
      errors
    };
  }
  if (!uuidPattern.test(uuid)) errors.push('Invalid UUID format');
  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData: errors.length === 0 ? uuid : undefined
  };
}
// ============================================================================
// SECURITY LOGGING
// ============================================================================
async function logSecurityEvent(supabase, eventType, severity, userId, ip, userAgent, details) {
  try {
    await supabase.from('security_events').insert({
      event_type: eventType,
      severity: severity,
      user_id: userId,
      ip_address: ip,
      user_agent: userAgent,
      details: details
    });
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
}
async function logToSecurityLog(supabase, level, message, service, userId, sessionId, requestId, ip, userAgent, metadata, errorDetails) {
  try {
    await supabase.from('security_logs').insert({
      level: level,
      message: message,
      service: service,
      user_id: userId,
      session_id: sessionId,
      request_id: requestId,
      ip_address: ip,
      user_agent: userAgent,
      metadata: metadata || null,
      error_details: errorDetails || null
    });
  } catch (error) {
    console.error('Failed to write to security log:', error);
  }
}
// ============================================================================
// FAST-PATH PATTERNS (NEW - Instant Routing)
// ============================================================================
function checkFastPathPatterns(message) {
  const lower = message.toLowerCase().trim();
  // Greetings (instant general chat)
  const greetings = [
    'hello',
    'hi',
    'hey',
    'greetings',
    'good morning',
    'good afternoon',
    'good evening',
    'what\'s up',
    'whats up',
    'sup'
  ];
  if (greetings.some((g)=>lower === g || lower.startsWith(g + ' ') || lower.startsWith(g + ','))) {
    return {
      decision: 'general',
      confidence: 1.0,
      reason: 'greeting_pattern'
    };
  }
  // Explicit document references (instant document search)
  const explicitDocPatterns = [
    'my document',
    'my pdf',
    'my file',
    'my notes',
    'my textbook',
    'in my document',
    'from my document',
    'according to my',
    'in the document',
    'the pdf says',
    'my notes say'
  ];
  if (explicitDocPatterns.some((p)=>lower.includes(p))) {
    return {
      decision: 'document',
      confidence: 0.95,
      reason: 'explicit_document_reference'
    };
  }
  // Document list requests (instant list)
  const listPatterns = [
    'list my files',
    'show my documents',
    'what files do i have',
    'show my files',
    'list my documents',
    'what documents do i have'
  ];
  if (listPatterns.some((p)=>lower.includes(p))) {
    return {
      decision: 'list_documents',
      confidence: 1.0,
      reason: 'list_request'
    };
  }
  // Short general questions (likely general chat)
  if (message.length < 30 && !lower.includes('document') && !lower.includes('file') && !lower.includes('pdf')) {
    return {
      decision: 'general',
      confidence: 0.8,
      reason: 'short_general_question'
    };
  }
  return null; // Ambiguous - needs AI analysis
}
// ============================================================================
// SIMPLIFIED AI INTENT ANALYSIS
// ============================================================================
async function analyzeQueryIntent(message, conversationHistory) {
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  if (!GEMINI_API_KEY) {
    debugLog('INTENT', 'Gemini API key not configured, using fallback');
    return fallbackIntentDetection(message, conversationHistory);
  }
  const prompt = `Classify query intent for RAG system.

CONVERSATION: ${conversationHistory.slice(-500) || 'None'}
USER: "${message}"

Return JSON only (no markdown):
{
  "shouldSearchDocs": boolean,
  "confidence": number,
  "reason": string
}

Rules:
- Search docs if: user mentions "my document/file/PDF", asks about uploaded content, follow-up to doc discussion
- Use general knowledge if: greeting, general question, casual chat
- Be conservative: default to general knowledge when unsure`;
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 100
        }
      })
    });
    if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
    const intent = JSON.parse(cleanText);
    if (typeof intent.shouldSearchDocs !== 'boolean') {
      throw new Error('Invalid response format');
    }
    debugLog('INTENT', 'AI analysis result', intent);
    return intent;
  } catch (error) {
    debugLog('INTENT', 'AI analysis failed, using fallback', error.message);
    return fallbackIntentDetection(message, conversationHistory);
  }
}
// Fallback keyword-based detection
function fallbackIntentDetection(message, conversationHistory) {
  const lower = message.toLowerCase();
  const docKeywords = [
    'document',
    'pdf',
    'file',
    'notes',
    'textbook',
    'uploaded'
  ];
  const hasDocKeyword = docKeywords.some((kw)=>lower.includes(kw));
  const isFollowUp = conversationHistory.includes('document') || conversationHistory.includes('Source');
  if (hasDocKeyword) {
    return {
      shouldSearchDocs: true,
      confidence: 0.85,
      reason: 'keyword_match'
    };
  }
  if (isFollowUp && message.length < 50) {
    return {
      shouldSearchDocs: true,
      confidence: 0.75,
      reason: 'follow_up'
    };
  }
  return {
    shouldSearchDocs: false,
    confidence: 0.9,
    reason: 'general_fallback'
  };
}
// ============================================================================
// HUGGINGFACE EMBEDDING GENERATION
// ============================================================================
async function generateQueryEmbedding(queryText) {
  const HUGGINGFACE_API_KEY = Deno.env.get('HUGGINGFACE_API_KEY');
  if (!HUGGINGFACE_API_KEY) {
    throw new Error('HUGGINGFACE_API_KEY not configured');
  }
  const apiUrl = 'https://router.huggingface.co/hf-inference/models/BAAI/bge-small-en-v1.5';
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      inputs: queryText,
      options: {
        wait_for_model: true
      }
    })
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HuggingFace API error: ${response.status} - ${errorText}`);
  }
  const embedding = await response.json();
  const result = Array.isArray(embedding[0]) ? embedding[0] : embedding;
  if (result.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Embedding dimension mismatch: expected ${EMBEDDING_DIMENSIONS}, got ${result.length}`);
  }
  debugLog('EMBEDDING', 'Generated embedding', {
    dimensions: result.length
  });
  return result;
}
// ============================================================================
// OPTIMIZED QUERY EXPANSION (Only for complex queries)
// ============================================================================
async function expandQueryIfNeeded(originalQuery) {
  // Skip expansion for short/simple queries
  if (originalQuery.length < 15 || originalQuery.split(' ').length < 4) {
    debugLog('EXPANSION', 'Skipping expansion for short query');
    return [
      originalQuery
    ];
  }
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  if (!GEMINI_API_KEY) {
    return [
      originalQuery
    ];
  }
  const prompt = `Generate 1 alternative search query for: "${originalQuery}"

Return JSON array (no markdown):
["${originalQuery}", "alternative"]

Example:
Input: "How do plants make food?"
Output: ["How do plants make food?", "photosynthesis process"]`;
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 100
        }
      })
    });
    if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
    let alternatives = JSON.parse(cleanText);
    if (!Array.isArray(alternatives) || alternatives.length === 0) {
      return [
        originalQuery
      ];
    }
    if (!alternatives.includes(originalQuery)) {
      alternatives.unshift(originalQuery);
    }
    debugLog('EXPANSION', 'Expanded queries', alternatives.slice(0, 2));
    return alternatives.slice(0, 2); // Max 2 queries
  } catch (error) {
    debugLog('EXPANSION', 'Expansion failed', error.message);
    return [
      originalQuery
    ];
  }
}
// ============================================================================
// CREDIT MANAGEMENT
// ============================================================================
async function checkAndDecrementCredits(supabase, userId) {
  const { data: subscription, error: subError } = await supabase.from('user_subscriptions').select('plan, credits_remaining, credits_max').eq('user_id', userId).single();
  if (subError || !subscription) {
    const { data: newSub } = await supabase.from('user_subscriptions').insert({
      user_id: userId,
      plan: 'free',
      credits_remaining: 50,
      credits_max: 50
    }).select().single();
    return {
      success: true,
      remaining: 49,
      plan: 'free',
      isNewUser: true
    };
  }
  const { plan, credits_remaining } = subscription;
  if (plan === 'pro') {
    if (credits_remaining <= 0) {
      return {
        success: false,
        remaining: 0,
        plan: 'pro',
        message: 'Pro plan credits exhausted. Please contact support.'
      };
    }
    await supabase.from('user_subscriptions').update({
      credits_remaining: credits_remaining - 1,
      updated_at: new Date().toISOString()
    }).eq('user_id', userId);
    return {
      success: true,
      remaining: credits_remaining - 1,
      plan: 'pro'
    };
  }
  if (credits_remaining <= 0) {
    return {
      success: false,
      remaining: 0,
      plan: 'free',
      message: 'You have run out of credits. Please upgrade to Pro for 1000 credits.'
    };
  }
  await supabase.from('user_subscriptions').update({
    credits_remaining: credits_remaining - 1,
    updated_at: new Date().toISOString()
  }).eq('user_id', userId);
  return {
    success: true,
    remaining: credits_remaining - 1,
    plan: 'free'
  };
}
// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
function extractUserInfo(req) {
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';
  let userId;
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const payload = JSON.parse(atob(token.split('.')[1]));
      userId = payload.sub;
    } catch (error) {
    // Ignore
    }
  }
  return {
    userId,
    ip,
    userAgent
  };
}
function addSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  Object.entries(SECURITY_HEADERS).forEach(([key, value])=>headers.set(key, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
function addRateLimitHeaders(response, rateLimitInfo) {
  const headers = new Headers(response.headers);
  headers.set('X-RateLimit-Limit', rateLimitInfo.limit.toString());
  headers.set('X-RateLimit-Remaining', rateLimitInfo.remaining.toString());
  headers.set('X-RateLimit-Reset', new Date(rateLimitInfo.resetTime).toISOString());
  if (rateLimitInfo.retryAfter) {
    headers.set('Retry-After', rateLimitInfo.retryAfter.toString());
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
// ============================================================================
// GENERAL CHAT HELPER
// ============================================================================
async function generateGeneralChatResponse(message, conversationHistory) {
  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }
    const systemPrompt = `You are RAG Book, a friendly AI study companion.

Traits: Natural, warm, engaging, supportive. Can discuss any topic. Be conversational, not robotic.

Recent conversation:
${conversationHistory.slice(-2000) || 'None'}

User: "${message}"

Respond naturally and conversationally.`;
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const aiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: systemPrompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.9,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024
        }
      })
    });
    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      throw new Error(`AI service error: ${aiResponse.status} - ${errorText}`);
    }
    const aiData = await aiResponse.json();
    const responseText = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "Hey! I'm here to chat. What's on your mind?";
    return responseText;
  } catch (error) {
    console.error('General chat error:', error);
    return "Hey! I'm having a bit of trouble right now, but I'm here to chat. Try asking me again?";
  }
}
// ============================================================================
// RAG RESPONSE GENERATION
// ============================================================================
async function generateRagResponse(message, chunks, conversationHistory = '') {
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }
  const context = chunks.map((chunk, idx)=>{
    let chunkText = `[Source ${idx + 1}: ${chunk.document_title}, Chunk ${chunk.chunk_index}/${chunk.chunk_metadata?.total_chunks || '?'}, Similarity: ${Math.round(chunk.similarity * 100)}%]\n`;
    if (chunk.chunk_metadata?.previous_chunk) {
      chunkText += `\n[Previous context: ...${chunk.chunk_metadata.previous_chunk}]\n`;
    }
    chunkText += `\n${chunk.content}\n`;
    if (chunk.chunk_metadata?.next_chunk) {
      chunkText += `\n[Following text: ${chunk.chunk_metadata.next_chunk}...]\n`;
    }
    return chunkText;
  }).join('\n\n---\n\n');
  const fullContext = conversationHistory ? `${conversationHistory.slice(-3000)}\n\nRETRIEVED CONTEXT:\n${context}` : `RETRIEVED CONTEXT:\n${context}`;
  const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: `You are RAG Book, a warm AI study companion.

CONVERSATION:
${conversationHistory.slice(-1500) || 'Start of conversation.'}

RETRIEVED INFO:
${context}

USER QUESTION:
"${message}"

INSTRUCTIONS:
1. Use conversation memory for references
2. Cite sources naturally
3. Acknowledge limitations honestly
4. Connect ideas across sources
5. Be conversational, not robotic
6. Don't repeat yourself

Respond:`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        topK: 30,
        topP: 0.9,
        maxOutputTokens: 1200
      }
    })
  });
  if (!aiResponse.ok) {
    const errorBody = await aiResponse.text();
    throw new Error(`AI service error: ${aiResponse.status} - ${errorBody}`);
  }
  const aiData = await aiResponse.json();
  return aiData.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't generate a response. Please try again.";
}
// ============================================================================
// CONFIDENCE SCORING & FILTERING
// ============================================================================
function filterChunksByConfidence(chunks) {
  const highConfidence = chunks.filter((c)=>c.similarity >= 0.75);
  const mediumConfidence = chunks.filter((c)=>c.similarity >= 0.65 && c.similarity < 0.75);
  const lowConfidence = chunks.filter((c)=>c.similarity >= 0.55 && c.similarity < 0.65);
  return {
    high: highConfidence,
    medium: mediumConfidence,
    low: lowConfidence,
    hasHighQuality: highConfidence.length > 0
  };
}
// ============================================================================
// PROACTIVE AI BEHAVIORS
// ============================================================================
async function generateProactiveResponse(message, chunks, conversationHistory) {
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  if (!GEMINI_API_KEY) {
    return {
      mainResponse: "I couldn't generate a response. Please try again.",
      suggestions: undefined,
      clarifyingQuestion: undefined
    };
  }
  const context = chunks.map((chunk, idx)=>`[Source ${idx + 1}]: ${chunk.content}`).join('\n\n');
  const prompt = `You are RAG Book, a proactive AI study companion.

CONVERSATION:
${conversationHistory.slice(-1000)}

CONTEXT:
${context}

USER:
"${message}"

Return JSON:
{
  "mainResponse": "Your answer",
  "suggestions": ["Related topic 1", "Related topic 2", "Related topic 3"],
  "clarifyingQuestion": "Optional follow-up question"
}

Be warm and encouraging.`;
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 1200
        }
      })
    });
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    try {
      const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleanText);
    } catch (parseError) {
      return {
        mainResponse: text,
        suggestions: undefined,
        clarifyingQuestion: undefined
      };
    }
  } catch (error) {
    debugLog('PROACTIVE', 'Generation error', error.message);
    return {
      mainResponse: "I couldn't generate a response. Please try again.",
      suggestions: undefined,
      clarifyingQuestion: undefined
    };
  }
}
// ============================================================================
// CROSS-DOCUMENT DIVERSITY
// ============================================================================
function diversifyChunks(chunks, maxPerDoc = 2) {
  const byDocument = new Map();
  for (const chunk of chunks){
    const docId = chunk.document_id;
    if (!byDocument.has(docId)) {
      byDocument.set(docId, []);
    }
    byDocument.get(docId).push(chunk);
  }
  const diversified = [];
  for (const docChunks of byDocument.values()){
    const sortedChunks = docChunks.sort((a, b)=>(b.combined_score || b.similarity) - (a.combined_score || a.similarity)).slice(0, maxPerDoc);
    diversified.push(...sortedChunks);
  }
  return diversified.sort((a, b)=>(b.combined_score || b.similarity) - (a.combined_score || a.similarity));
}
// ============================================================================
// OPTIMIZED DOCUMENT SEARCH
// ============================================================================
async function searchDocuments(supabase, userId, message) {
  // Check if user has any documents first (fast path)
  const { count, error: countError } = await supabase.from('documents').select('id', {
    count: 'exact',
    head: true
  }).eq('user_id', userId).eq('status', 'completed');
  if (countError || !count || count === 0) {
    debugLog('SEARCH', 'No documents found for user');
    return {
      chunks: [],
      error: 'no_documents'
    };
  }
  // Expand query only if needed
  const queries = await expandQueryIfNeeded(message);
  debugLog('SEARCH', 'Searching with queries', queries);
  const allChunks = [];
  const processedDocs = new Set();
  for (const query of queries){
    try {
      // Generate embedding
      const queryEmbedding = await generateQueryEmbedding(query);
      // Clean query for full-text search
      const keywordQuery = query.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter((word)=>word.length > 2).join(' & ');
      // Try hybrid search first
      let chunks;
      try {
        const { data, error } = await supabase.rpc('hybrid_search_documents', {
          query_text: keywordQuery,
          query_embedding: queryEmbedding,
          p_user_id: userId,
          match_threshold: 0.65,
          match_count: 10
        });
        if (error) throw error;
        chunks = data || [];
      } catch (hybridError) {
        debugLog('SEARCH', 'Hybrid search failed, using vector only', hybridError.message);
        // Fallback to vector search
        const { data, error } = await supabase.rpc('match_documents', {
          query_embedding: queryEmbedding,
          match_threshold: 0.65,
          match_count: 10,
          p_user_id: userId
        });
        if (error) throw error;
        chunks = data || [];
      }
      // Add only new documents
      const newChunks = chunks.filter((chunk)=>!processedDocs.has(chunk.document_id));
      newChunks.forEach((chunk)=>processedDocs.add(chunk.document_id));
      allChunks.push(...newChunks);
    } catch (error) {
      debugLog('SEARCH', 'Query search failed', error.message);
      continue;
    }
  }
  // Sort and diversify
  allChunks.sort((a, b)=>(b.combined_score || b.similarity) - (a.combined_score || a.similarity));
  const diversified = diversifyChunks(allChunks, 2);
  return {
    chunks: diversified.slice(0, 10),
    error: null
  };
}
// ============================================================================
// MAIN HANDLER
// ============================================================================
async function handleRequest(req) {
  const userInfo = extractUserInfo(req);
  const requestId = crypto.randomUUID();
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  try {
    await logToSecurityLog(supabase, 1, 'Request received', 'rag-chat', userInfo.userId || null, null, requestId, userInfo.ip, userInfo.userAgent, {
      method: req.method,
      url: req.url
    });
    const body = await req.json();
    // Validate input
    const messageValidation = validateMessage(body.message);
    if (!messageValidation.isValid) {
      await logSecurityEvent(supabase, 'PROMPT_INJECTION_DETECTED', 'MEDIUM', userInfo.userId || null, userInfo.ip, userInfo.userAgent, {
        message: body.message,
        errors: messageValidation.errors
      });
      return new Response(JSON.stringify({
        error: 'Invalid input',
        details: messageValidation.errors
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const conversationIdValidation = validateUuid(body.conversationId);
    if (!conversationIdValidation.isValid) {
      return new Response(JSON.stringify({
        error: 'Invalid conversation ID'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const sanitizedMessage = messageValidation.sanitizedData;
    const conversationId = conversationIdValidation.sanitizedData;
    // Verify authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      await logSecurityEvent(supabase, 'AUTH_FAILURE', 'MEDIUM', null, userInfo.ip, userInfo.userAgent, {
        reason: 'missing_authorization_header'
      });
      return new Response(JSON.stringify({
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      await logSecurityEvent(supabase, 'AUTH_FAILURE', 'MEDIUM', null, userInfo.ip, userInfo.userAgent, {
        reason: 'invalid_token',
        error: authError?.message
      });
      return new Response(JSON.stringify({
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Verify conversation ownership
    const { data: conversation, error: convError } = await supabase.from('conversations').select('id, user_id').eq('id', conversationId).eq('user_id', user.id).single();
    if (convError || !conversation) {
      await logSecurityEvent(supabase, 'SUSPICIOUS_ACTIVITY', 'HIGH', user.id, userInfo.ip, userInfo.userAgent, {
        reason: 'unauthorized_conversation_access',
        conversationId
      });
      return new Response(JSON.stringify({
        error: 'Conversation not found'
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Get mode (validate)
    let mode = body.mode || 'auto';
    const validModes = [
      'auto',
      'document',
      'general'
    ];
    if (!validModes.includes(mode)) {
      debugLog('MODE', `Invalid mode: ${mode}, defaulting to auto`);
      mode = 'auto';
    }
    debugLog('REQUEST', 'Processing', {
      message: sanitizedMessage.slice(0, 50),
      mode
    });
    // ============================================================================
    // FAST-PATH ROUTING (NEW - Biggest Optimization)
    // ============================================================================
    const fastPathResult = checkFastPathPatterns(sanitizedMessage);
    // Handle list documents request immediately (no credit charge)
    if (fastPathResult?.decision === 'list_documents') {
      const { data: documents } = await supabase.from('documents').select('id, original_name, created_at, file_size, status, user_id, chunk_count').eq('user_id', user.id).order('created_at', {
        ascending: false
      });
      let responseContent;
      if (!documents || documents.length === 0) {
        responseContent = "You haven't uploaded any documents yet. You can upload documents from the Documents page to get started.";
      } else {
        const formatStatus = (doc)=>{
          if (doc.status === 'completed') return `✅ Ready (${doc.chunk_count || 0} chunks)`;
          if (doc.status === 'processing') return `⏳ Processing`;
          if (doc.status === 'failed') return `❌ Failed`;
          return `📤 ${doc.status}`;
        };
        const docList = documents.map((doc)=>`• **${doc.original_name}** - ${formatStatus(doc)}\n  Uploaded: ${new Date(doc.created_at).toLocaleDateString()}`).join('\n\n');
        const completedCount = documents.filter((d)=>d.status === 'completed').length;
        responseContent = `Here are your uploaded documents:\n\n${docList}\n\n---\n\n**Summary:** ${completedCount} of ${documents.length} documents ready to search.\n\nYou can ask me to search through your completed documents for specific information.`;
      }
      // Save messages
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        role: 'user',
        content: sanitizedMessage
      });
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: responseContent,
        metadata: null
      });
      await supabase.from('conversations').update({
        updated_at: new Date().toISOString()
      }).eq('id', conversationId);
      // Get current credits without decrementing
      const { data: sub } = await supabase.from('user_subscriptions').select('credits_remaining, plan').eq('user_id', user.id).single();
      return addSecurityHeaders(new Response(JSON.stringify({
        message: responseContent,
        sources: [],
        conversationId: conversationId,
        credits: sub?.credits_remaining || 0,
        plan: sub?.plan || 'free'
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }));
    }
    // ============================================================================
    // PARALLEL OPERATIONS: Fetch history + Save user message
    // ============================================================================
    const [historyResult, _] = await Promise.all([
      supabase.from('messages').select('role, content').eq('conversation_id', conversationId).order('created_at', {
        ascending: false
      }).limit(20),
      supabase.from('messages').insert({
        conversation_id: conversationId,
        role: 'user',
        content: sanitizedMessage
      })
    ]);
    const conversationHistory = (historyResult.data || []).reverse().map((msg)=>`${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`).join('\n\n');
    // ============================================================================
    // DETERMINE ROUTING (with optimizations)
    // ============================================================================
    let shouldSearchDocs = false;
    if (mode === 'document') {
      shouldSearchDocs = true;
      debugLog('ROUTING', 'Forced document mode');
    } else if (mode === 'general') {
      shouldSearchDocs = false;
      debugLog('ROUTING', 'Forced general mode');
    } else if (fastPathResult) {
      // Use fast-path result
      shouldSearchDocs = fastPathResult.decision === 'document';
      debugLog('ROUTING', `Fast-path: ${fastPathResult.decision}`, fastPathResult);
    } else {
      // Only call AI for ambiguous queries
      const intent = await analyzeQueryIntent(sanitizedMessage, conversationHistory);
      shouldSearchDocs = intent.shouldSearchDocs;
      debugLog('ROUTING', `AI analysis: ${shouldSearchDocs ? 'document' : 'general'}`, intent);
    }
    // ============================================================================
    // CHECK CREDITS (Only after routing decision)
    // ============================================================================
    const creditResult = await checkAndDecrementCredits(supabase, user.id);
    if (!creditResult.success) {
      return new Response(JSON.stringify({
        error: 'Insufficient credits',
        message: creditResult.message,
        credits: 0,
        plan: creditResult.plan
      }), {
        status: 402,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // ============================================================================
    // GENERATE RESPONSE
    // ============================================================================
    let responseContent = '';
    let sources = [];
    if (shouldSearchDocs) {
      debugLog('EXECUTION', 'Starting document search');
      const { chunks, error: searchError } = await searchDocuments(supabase, user.id, sanitizedMessage);
      if (searchError === 'no_documents') {
        responseContent = "You haven't uploaded any documents yet. You can upload documents from the Documents page to get started.";
      } else if (!chunks || chunks.length === 0) {
        responseContent = "I couldn't find any relevant information in your documents for that query. Try rephrasing your question or check if you have uploaded the relevant documents.";
      } else {
        // Filter by confidence
        const filtered = filterChunksByConfidence(chunks);
        if (!filtered.hasHighQuality && filtered.medium.length === 0) {
          const bestMatch = chunks[0];
          responseContent = `I found some mentions in your documents, but they don't seem very relevant to your question (best match confidence: ${Math.round(bestMatch.similarity * 100)}%). 

Would you like me to:
1. Show you what I found anyway?
2. Try rephrasing your question?
3. Answer from my general knowledge instead?`;
          sources = chunks.slice(0, 3).map((chunk)=>({
              document_id: chunk.document_id,
              document_title: chunk.document_title,
              similarity: chunk.similarity,
              content: chunk.content.substring(0, 200) + '...',
              chunk_index: chunk.chunk_index,
              search_type: chunk.search_type || 'vector'
            }));
        } else {
          const goodChunks = [
            ...filtered.high,
            ...filtered.medium
          ].slice(0, 5);
          // Get proactive response
          const proactiveResult = await generateProactiveResponse(sanitizedMessage, goodChunks, conversationHistory);
          // Add confidence message if needed
          const bestMatch = goodChunks[0];
          const confidenceLevel = bestMatch.similarity >= 0.75 ? 'high' : 'medium';
          const confidenceMessage = confidenceLevel === 'medium' ? "\n\nℹ️ Note: The information found has moderate similarity to your query. Please verify the accuracy of the response." : "";
          responseContent = proactiveResult.mainResponse + confidenceMessage;
          sources = goodChunks.map((chunk)=>({
              document_id: chunk.document_id,
              document_title: chunk.document_title,
              similarity: chunk.similarity,
              content: chunk.content.substring(0, 200) + '...',
              chunk_index: chunk.chunk_index,
              confidence: chunk.similarity,
              search_type: chunk.search_type || 'vector',
              suggestions: proactiveResult.suggestions,
              clarifyingQuestion: proactiveResult.clarifyingQuestion
            }));
        }
      }
    } else {
      debugLog('EXECUTION', 'Using general chat');
      responseContent = await generateGeneralChatResponse(sanitizedMessage, conversationHistory);
    }
    // ============================================================================
    // SAVE RESPONSE & UPDATE CONVERSATION
    // ============================================================================
    await Promise.all([
      supabase.from('messages').insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: responseContent,
        metadata: sources.length > 0 ? {
          sources
        } : null
      }),
      supabase.from('conversations').update({
        updated_at: new Date().toISOString()
      }).eq('id', conversationId)
    ]);
    await logToSecurityLog(supabase, 1, 'Response sent successfully', 'rag-chat', user.id, null, requestId, userInfo.ip, userInfo.userAgent, {
      creditsRemaining: creditResult.remaining,
      plan: creditResult.plan
    });
    const response = new Response(JSON.stringify({
      message: responseContent,
      sources: sources,
      conversationId: conversationId,
      credits: creditResult.remaining,
      plan: creditResult.plan
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
    return addSecurityHeaders(response);
  } catch (error) {
    console.error('Unexpected error in handler:', error);
    await logToSecurityLog(supabase, 4, 'Unexpected error in rag-chat handler', 'rag-chat', userInfo.userId || null, null, requestId, userInfo.ip, userInfo.userAgent, null, {
      error: String(error),
      stack: error.stack
    });
    const errorResponse = new Response(JSON.stringify({
      error: 'Internal server error',
      message: 'An unexpected error occurred. Please try again later.'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
    return addSecurityHeaders(errorResponse);
  }
}
// ============================================================================
// MAIN SERVE FUNCTION
// ============================================================================
serve(async (req)=>{
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Origin': req.headers.get('origin') || '*',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400'
      }
    });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({
      error: 'Method not allowed'
    }), {
      status: 405,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
  // Apply rate limiting
  const rateLimitResult = await checkRateLimit(req);
  if (!rateLimitResult.allowed) {
    const userInfo = extractUserInfo(req);
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      await logSecurityEvent(supabase, 'RATE_LIMIT_EXCEEDED', 'LOW', userInfo.userId || null, userInfo.ip, userInfo.userAgent, {
        limit: RATE_LIMITS.CHAT.maxRequests,
        window: `${RATE_LIMITS.CHAT.windowMs / 1000}s`,
        retryAfter: rateLimitResult.retryAfter
      });
    } catch (error) {
      console.error('Failed to log rate limit event:', error);
    }
    const response = new Response(JSON.stringify({
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please try again later.',
      retryAfter: rateLimitResult.retryAfter
    }), {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': rateLimitResult.retryAfter?.toString() || '60'
      }
    });
    return addRateLimitHeaders(response, {
      remaining: rateLimitResult.remaining,
      resetTime: rateLimitResult.resetTime,
      limit: RATE_LIMITS.CHAT.maxRequests,
      retryAfter: rateLimitResult.retryAfter
    });
  }
  // Execute the handler
  const response = await handleRequest(req);
  // Add rate limit headers to successful response
  return addRateLimitHeaders(response, {
    remaining: rateLimitResult.remaining,
    resetTime: rateLimitResult.resetTime,
    limit: RATE_LIMITS.CHAT.maxRequests
  });
});
