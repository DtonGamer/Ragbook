import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
// ============================================================================
// CONFIGURATION
// ============================================================================
const EMBEDDING_DIMENSIONS = 384;
const MAX_MESSAGE_LENGTH = 10000;
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
// HUGGINGFACE EMBEDDING GENERATION
// ============================================================================
async function generateQueryEmbedding(queryText) {
  console.log('Generating embedding for query:', queryText);
  const HUGGINGFACE_API_KEY = Deno.env.get('HUGGINGFACE_API_KEY');
  if (!HUGGINGFACE_API_KEY) {
    console.error('HUGGINGFACE_API_KEY not configured');
    throw new Error('HUGGINGFACE_API_KEY not configured');
  }
  const apiUrl = 'https://router.huggingface.co/hf-inference/models/BAAI/bge-small-en-v1.5';
  console.log('Sending embedding request to:', apiUrl);
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
    console.error('HuggingFace API error:', response.status, errorText);
    throw new Error(`HuggingFace API error: ${response.status} - ${errorText}`);
  }
  const embedding = await response.json();
  console.log('Received embedding response, type:', typeof embedding, 'length/array:', Array.isArray(embedding), 'first_element_type:', Array.isArray(embedding[0]) ? 'array' : 'number');
  const result = Array.isArray(embedding[0]) ? embedding[0] : embedding;
  
  // Validate embedding dimensions
  console.log('Embedding result length:', result.length);
  if (result.length !== EMBEDDING_DIMENSIONS) {
    console.error(`Embedding dimension mismatch: expected ${EMBEDDING_DIMENSIONS}, got ${result.length}`);
    throw new Error(`Embedding dimension mismatch: expected ${EMBEDDING_DIMENSIONS}, got ${result.length}`);
  }
  
  console.log('Successfully generated embedding with', result.length, 'dimensions');
  return result;
}
// ============================================================================
// SIMPLIFIED QUERY ROUTING
// ============================================================================
function shouldSearchDocuments(message) {
  const lowerMessage = message.toLowerCase().trim();
  // Document search keywords
  const searchKeywords = [
    'my document',
    'my pdf',
    'my file',
    'in my document',
    'from my document',
    'according to my',
    'search my documents',
    'search my files',
    'find in my documents',
    'look in my files',
    'check my documents for'
  ];
  return searchKeywords.some((phrase)=>lowerMessage.includes(phrase));
}
function shouldListDocuments(message) {
  const lowerMessage = message.toLowerCase().trim();
  // Document list keywords
  const listKeywords = [
    'list my files',
    'list my documents',
    'show my files',
    'show my documents',
    'what files do i have',
    'what documents do i have',
    'my uploaded files'
  ];
  return listKeywords.some((phrase)=>lowerMessage.includes(phrase));
}

// ============================================================================
// AI-POWERED QUERY INTENT ANALYSIS
// ============================================================================
async function analyzeQueryIntentWithGemini(message, conversationHistory) {
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  
  if (!GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY not configured - falling back to keywords');
    // Fallback to keyword matching
    return analyzeQueryIntent(message, conversationHistory);
  }
  
  const prompt = `You are a query intent classifier for a RAG (Retrieval-Augmented Generation) system.

**CONVERSATION HISTORY:**
${conversationHistory || 'No previous conversation'}

**USER MESSAGE:** 
"${message}"

**TASK:**
Determine if this message requires searching the user's uploaded documents or just general knowledge.

**SEARCH DOCUMENTS when:**
- User explicitly mentions "my document/file/PDF/notes/textbook"
- User asks about content they uploaded
- Follow-up questions referring to previous document-based answers
- Questions like "what does it say about X in my files?"

**USE GENERAL KNOWLEDGE when:**
- Greetings ("hello", "hi", "hey")
- General questions that don't reference uploaded content
- Casual conversation
- Questions about common knowledge topics

**IMPORTANT:**
- If the message is a greeting (hi, hello, hey, what's up), ALWAYS use general knowledge
- Be conservative: when in doubt, prefer general knowledge over document search
- Only search documents when there's clear evidence the user wants their files searched

Return ONLY this JSON structure (no markdown, no explanation):
{
  "shouldSearchDocs": boolean,
  "confidence": number (0.0-1.0),
  "reason": string
}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,  // Very low for consistent classification
            maxOutputTokens: 150
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
    const intent = JSON.parse(cleanText);
    
    console.log('✅ Gemini intent analysis:', intent);
    
    // Validate response structure
    if (typeof intent.shouldSearchDocs !== 'boolean') {
      throw new Error('Invalid response format from Gemini');
    }
    
    return intent;
    
  } catch (error) {
    console.error('❌ Gemini intent analysis failed:', error);
    // Fallback to keyword matching
    console.log('🔄 Falling back to keyword-based intent detection');
    return analyzeQueryIntent(message, conversationHistory);
  }
}

// ============================================================================
// ENHANCED QUERY ROUTING
// ============================================================================
function analyzeQueryIntent(message, conversationHistory) {
  console.log('Analyzing query intent for:', message);
  const lowerMessage = message.toLowerCase().trim();
  
  // Strong document signals
  const docKeywords = [
    'my document', 'my pdf', 'my file', 'in my document',
    'from my document', 'according to my', 'in the document',
    'the pdf says', 'my notes say', 'in my textbook', 'in my files'
  ];
  
  // List intent
  const listKeywords = [
    'list my files', 'show my documents', 'what files do i have', 'show my files'
  ];
  
  console.log('Checking for document keywords:', docKeywords);
  console.log('Checking for list keywords:', listKeywords);
  
  // Follow-up indicators (check conversation history)
  const isFollowUp = conversationHistory.includes('document') || 
                     conversationHistory.includes('Source') ||
                     conversationHistory.includes('in your documents');
  
  console.log('Is follow-up?', isFollowUp);
  
  // Direct document reference
  const hasDirectDocReference = docKeywords.some(kw => lowerMessage.includes(kw));
  console.log('Has direct document reference?', hasDirectDocReference);
  
  // List request
  const isListRequest = listKeywords.some(kw => lowerMessage.includes(kw));
  console.log('Is list request?', isListRequest);
  
  // Comparative questions (need both sources)
  const isComparative = /compare|versus|vs|difference between|similar to/.test(lowerMessage);
  console.log('Is comparative?', isComparative);
  
  // Decision logic
  if (isListRequest) {
    console.log('Routing to document search: list request');
    return {
      shouldSearchDocs: true,
      shouldUseGeneralKnowledge: false,
      confidence: 1.0,
      reason: 'list_request'
    };
  }
  
  if (hasDirectDocReference) {
    console.log('Routing to document search: direct document reference');
    return {
      shouldSearchDocs: true,
      shouldUseGeneralKnowledge: isComparative,  // Hybrid for comparisons
      confidence: 0.95,
      reason: 'explicit_document_reference'
    };
  }
  
  if (isFollowUp && lowerMessage.length < 50) {
    // Short follow-ups likely refer to previous document discussion
    console.log('Routing to document search: follow-up to document discussion');
    return {
      shouldSearchDocs: true,
      shouldUseGeneralKnowledge: false,
      confidence: 0.75,
      reason: 'follow_up_to_document_discussion'
    };
  }
  
  // Default to general chat
  console.log('Routing to general chat: no document signals found');
  return {
    shouldSearchDocs: false,
    shouldUseGeneralKnowledge: true,
    confidence: 0.9,
    reason: 'general_conversation'
  };
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
    const systemPrompt = `You are a friendly, intelligent study companion and conversational AI. Your name is RAG Book.

Key traits:
- Be natural, warm, and engaging in conversation
- Remember and reference previous messages in the conversation
- You can discuss ANY topic - academics, hobbies, advice, general knowledge, current events, philosophy, etc.
- Give thoughtful, helpful responses
- Be encouraging and supportive
- Use a conversational, friendly tone (not robotic or overly formal)
- You CAN be casual, use contractions, and show personality

You also have access to the user's uploaded study documents. If they ask you to search their documents or reference their notes/textbooks, you can do that. But most of the time, you're just having a conversation.

Recent conversation history:
${conversationHistory || 'No previous messages'}

User's latest message: "${message}"

Respond naturally and conversationally. Keep responses focused but friendly. If it's a greeting, greet back. If it's a question, answer it. If it's just chat, chat back!`;
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const requestBody = {
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
    };
    const aiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
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
  const context = chunks.map((chunk, idx) => {
    let chunkText = `[Source ${idx + 1}: ${chunk.document_title}, Chunk ${chunk.chunk_index}/${chunk.chunk_metadata?.total_chunks || '?'}, Similarity: ${Math.round(chunk.similarity * 100)}%]\n`;
    
    // Add previous chunk for context
    if (chunk.chunk_metadata?.previous_chunk) {
      chunkText += `\n[Previous context: ...${chunk.chunk_metadata.previous_chunk}]\n`;
    }
    
    chunkText += `\n${chunk.content}\n`;
    
    // Add next chunk for context
    if (chunk.chunk_metadata?.next_chunk) {
      chunkText += `\n[Following text: ${chunk.chunk_metadata.next_chunk}...]\n`;
    }
    
    return chunkText;
  }).join('\n\n---\n\n');
  
  // Include conversation history in the prompt
  const fullContext = conversationHistory 
    ? `${conversationHistory}\n\nRETRIEVED CONTEXT FROM USER'S DOCUMENTS:\n${context}`
    : `RETRIEVED CONTEXT FROM USER'S DOCUMENTS:\n${context}`;
  
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
              text: `You are RAG Book, a warm and intelligent AI study companion. You have access to the user's study documents and can search through them to help with learning.

# YOUR PERSONALITY
- Friendly, encouraging, and supportive like a patient tutor
- Explain complex topics clearly without being condescending
- Use examples and analogies to make concepts stick
- Celebrate understanding and gently correct misconceptions
- Show enthusiasm for learning!

# CONVERSATION CONTEXT
${conversationHistory || 'This is the start of our conversation.'}

# RETRIEVED INFORMATION FROM USER'S DOCUMENTS
${context}

# USER'S CURRENT QUESTION
"${message}"

# INSTRUCTIONS FOR YOUR RESPONSE

1. **Use conversation memory**: If the user refers to something from earlier (like "explain that simpler" or "what about the second one?"), check the conversation history to understand the reference.

2. **Cite your sources**: When using information from documents, mention which document it came from (e.g., "According to your Biology Chapter 3...").

3. **Acknowledge limitations**: If the documents don't contain enough information, be honest: "Your documents mention X, but I don't see details about Y. Would you like me to explain Y from my general knowledge?"

4. **Connect ideas**: If you see information across multiple documents or chunks, synthesize them: "Your notes on X and your textbook chapter on Y both mention..."

5. **Be conversational, not robotic**: 
   - Good: "Great question! Your textbook explains that photosynthesis happens in two main stages..."
   - Bad: "According to Source 1, photosynthesis is a two-stage process..."

6. **Maintain context**: Remember what you've already explained. Don't repeat yourself unless asked.

7. **Encourage deeper learning**: End with a thoughtful follow-up if appropriate (but don't overdo it).

Now, provide your response:`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,  // Balanced for personality + accuracy
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
  // High confidence: 0.75+ (definitely relevant)
  const highConfidence = chunks.filter(c => c.similarity >= 0.75);
  
  // Medium confidence: 0.65-0.74 (probably relevant)
  const mediumConfidence = chunks.filter(c => c.similarity >= 0.65 && c.similarity < 0.75);
  
  // Low confidence: 0.55-0.64 (possibly relevant)
  const lowConfidence = chunks.filter(c => c.similarity >= 0.55 && c.similarity < 0.65);
  
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
    console.error('GEMINI_API_KEY not configured for proactive response');
    return {
      mainResponse: "I couldn't generate a response. Please try again.",
      suggestions: undefined,
      clarifyingQuestion: undefined
    };
  }
  
  const context = chunks.map((chunk, idx) => 
    `[Source ${idx + 1}]: ${chunk.content}`
  ).join('\n\n');
  
  const prompt = `You are RAG Book, a proactive AI study companion.

CONVERSATION HISTORY:
${conversationHistory}

RETRIEVED CONTEXT:
${context}

USER'S QUESTION:
"${message}"

Provide a response in JSON format with these fields:
{
  "mainResponse": "Your main answer to the question",
  "suggestions": ["Related topic 1", "Related topic 2", "Related topic 3"],  // Optional: 3 related things they might want to learn
  "clarifyingQuestion": "A follow-up question to deepen understanding"  // Optional: Ask if they want clarification
}

Be warm and encouraging. Make suggestions relevant to their studies.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.6,
            maxOutputTokens: 1200
          }
        })
      }
    );

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    
    try {
      const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleanText);
      return parsed;
    } catch (parseError) {
      console.error('Failed to parse proactive response:', parseError);
      return {
        mainResponse: text,
        suggestions: undefined,
        clarifyingQuestion: undefined
      };
    }
  } catch (error) {
    console.error('Proactive response generation error:', error);
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
  
  // Group by document
  for (const chunk of chunks) {
    const docId = chunk.document_id;
    if (!byDocument.has(docId)) {
      byDocument.set(docId, []);
    }
    byDocument.get(docId).push(chunk);
  }
  
  // Take top N from each document
  const diversified = [];
  
  for (const docChunks of byDocument.values()) {
    // Sort by combined_score or similarity
    const sortedChunks = docChunks
      .sort((a, b) => (b.combined_score || b.similarity) - (a.combined_score || a.similarity))
      .slice(0, maxPerDoc);
    
    diversified.push(...sortedChunks);
  }
  
  // Sort final list by score
  return diversified.sort((a, b) => 
    (b.combined_score || b.similarity) - (a.combined_score || a.similarity)
  );
}

// ============================================================================
// QUERY EXPANSION
// ============================================================================
async function expandQuery(originalQuery) {
  console.log('Expanding query:', originalQuery);
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  
  if (!GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY not configured for query expansion');
    return [originalQuery];  // ✅ Always return original
  }
  
  const prompt = `Generate 2-3 alternative search queries for: "${originalQuery}"

Return ONLY a JSON array of strings (no markdown):
["${originalQuery}", "alternative 1", "alternative 2"]

Example:
Input: "How do plants make food?"
Output: ["How do plants make food?", "photosynthesis process", "plant nutrition"]

Now generate for the input above:`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 150
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
    
    let alternatives = JSON.parse(cleanText);
    
    // ✅ CRITICAL: Always include original query
    if (!Array.isArray(alternatives)) {
      alternatives = [originalQuery];
    }
    
    if (alternatives.length === 0) {
      alternatives = [originalQuery];
    }
    
    if (!alternatives.includes(originalQuery)) {
      alternatives.unshift(originalQuery);
    }
    
    console.log('✅ Expanded queries:', alternatives);
    return alternatives.slice(0, 3);  // Max 3
    
  } catch (error) {
    console.error('Query expansion failed:', error);
    return [originalQuery];  // ✅ Always fallback
  }
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
    // Check & decrement credits
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
    // Save user message
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: sanitizedMessage
    });
    // Fetch conversation history
    const { data: recentMessages } = await supabase.from('messages').select('role, content').eq('conversation_id', conversationId).order('created_at', {
      ascending: false
    }).limit(10);
    const conversationHistory = (recentMessages || []).reverse().map((msg)=>`${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`).join('\n\n');
    // Get the mode from the request (defaults to 'auto')
    const mode = body.mode || 'auto';
    console.log('═══════════════════════════════════════════════');
    console.log('📥 INCOMING REQUEST');
    console.log('Message:', sanitizedMessage);
    console.log('Mode:', mode);  // Check if mode is present
    console.log('ConversationId:', conversationId);
    console.log('═══════════════════════════════════════════════');

    // Validate mode parameter
    const validModes = ['auto', 'document', 'general'];
    if (!validModes.includes(mode)) {
      console.warn(`Invalid mode received: ${mode}, defaulting to 'auto'`);
      mode = 'auto';
    }

    // Route query
    let responseContent = '';
    let sources = [];
    
    // Determine if documents should be searched based on selected mode
    let shouldSearchDocs = false;
    
    if (mode === 'document') {
      // Forced document search mode
      shouldSearchDocs = true;
      console.log('📁 Document mode: Forcing document search for query:', sanitizedMessage);
    } else if (mode === 'general') {
      // Forced general chat mode
      shouldSearchDocs = false;
      console.log('💬 General mode: Using general knowledge only for query:', sanitizedMessage);
    } else {
      // Auto mode - use AI intent detection to decide
      console.log('🤖 Auto mode: Analyzing intent with Gemini...');
      const intent = await analyzeQueryIntentWithGemini(sanitizedMessage, conversationHistory);
      console.log('Query intent from Gemini:', intent);
      shouldSearchDocs = intent.shouldSearchDocs;
      console.log(`🎯 Auto mode decision: ${shouldSearchDocs ? 'Searching documents' : 'Using general knowledge'} based on AI analysis`);
    }
    
    console.log('Analyzing message for document search:', sanitizedMessage);

    if (shouldListDocuments(sanitizedMessage)) {
      // List documents
      const { data: documents } = await supabase.from('documents').select('id, original_name, created_at, file_size, status, user_id, chunk_count').eq('user_id', user.id).order('created_at', {
        ascending: false
      });
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
    } else if (shouldSearchDocs) {
      console.log('Starting document search for query:', sanitizedMessage);
      // Hybrid search with query expansion
      try {
        // Expand the query first
        console.log('Expanding query:', sanitizedMessage);
        const expandedQueries = await expandQuery(sanitizedMessage);
        console.log('Expanded queries:', expandedQueries);
        
        let allChunks = [];
        const processedDocuments = new Set(); // To avoid duplicate documents

        // Search with original and expanded queries
        for (const query of expandedQueries.slice(0, 3)) {  // Limit to 3 to avoid rate limits
          console.log('Processing expanded query:', query);
          const queryEmbedding = await generateQueryEmbedding(query);
          
          // Clean query for full-text search
          const keywordQuery = query
            .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special chars
            .split(/\s+/)
            .filter(word => word.length > 2)
            .join(' & ');  // PostgreSQL tsquery format

          try {
            // Use hybrid search function
            console.log('Running hybrid search with query:', query, 'and embedding length:', queryEmbedding.length);
            const { data: chunks, error: searchError } = await supabase.rpc('hybrid_search_documents', {
              query_text: keywordQuery,
              query_embedding: queryEmbedding,
              p_user_id: user.id,
              match_threshold: 0.65,
              match_count: 10  // Get more for diversity
            });

            console.log('Hybrid search results - chunks found:', chunks?.length || 0, 'error:', searchError);
            if (!searchError && chunks && chunks.length > 0) {
              console.log('Found', chunks.length, 'chunks from hybrid search');
              // Add chunks that are from new documents only
              const newChunks = chunks.filter(chunk => !processedDocuments.has(chunk.document_id));
              console.log('New chunks from unique documents:', newChunks.length);
              newChunks.forEach(chunk => processedDocuments.add(chunk.document_id));
              allChunks = allChunks.concat(newChunks);
            }
          } catch (hybridError) {
            console.error('Hybrid search failed, falling back to vector search:', hybridError);
            // Fallback to original vector search
            console.log('Running fallback vector search for query:', query);
            const { data: chunks, error: searchError } = await supabase.rpc('match_documents', {
              query_embedding: queryEmbedding,
              match_threshold: 0.65,
              match_count: 10,
              p_user_id: user.id
            });
            
            console.log('Vector search results - chunks found:', chunks?.length || 0, 'error:', searchError);
            if (!searchError && chunks && chunks.length > 0) {
              console.log('Found', chunks.length, 'chunks from vector search');
              // Add chunks that are from new documents only
              const newChunks = chunks.filter(chunk => !processedDocuments.has(chunk.document_id));
              console.log('New chunks from vector search:', newChunks.length);
              newChunks.forEach(chunk => processedDocuments.add(chunk.document_id));
              allChunks = allChunks.concat(newChunks);
            }
          }
        }

        console.log('Total chunks found across all queries:', allChunks.length);
        
        // Sort by combined score (or similarity if no combined score)
        allChunks.sort((a, b) => (b.combined_score || b.similarity) - (a.combined_score || a.similarity));
        
        // Apply cross-document diversification
        console.log('Applying diversification to', allChunks.length, 'chunks');
        const diversifiedChunks = diversifyChunks(allChunks, 2);  // Max 2 per doc
        const topChunks = diversifiedChunks.slice(0, 10);  // Take top results after diversification
        console.log('Top chunks after diversification:', topChunks.length);
        
        if (topChunks.length === 0) {
          console.log('No chunks found for query:', sanitizedMessage);
          responseContent = "I couldn't find any relevant information in your documents for that query. Try rephrasing your question or check if you have uploaded the relevant documents.";
        } else {
          // Filter by confidence
          const filtered = filterChunksByConfidence(topChunks);
          
          if (!filtered.hasHighQuality && filtered.medium.length === 0) {
            // Only low-confidence matches found
            const bestMatch = topChunks[0];
            responseContent = `I found some mentions in your documents, but they don't seem very relevant to your question (best match confidence: ${Math.round(bestMatch.similarity * 100)}%). 

Would you like me to:
1. Show you what I found anyway?
2. Try rephrasing your question?
3. Answer from my general knowledge instead?`;
            
            sources = topChunks.slice(0, 3).map((chunk) => ({
              document_id: chunk.document_id,
              document_title: chunk.document_title,
              similarity: chunk.similarity,
              content: chunk.content.substring(0, 200) + '...',
              chunk_index: chunk.chunk_index,
              search_type: chunk.search_type || 'vector'  // Add search type information
            }));
          } else {
            // Use high + medium confidence chunks
            const goodChunks = [...filtered.high, ...filtered.medium].slice(0, 5);
            
            // Add confidence information to the response
            const bestMatch = goodChunks[0];
            const confidenceLevel = bestMatch.similarity >= 0.75 ? 'high' : 
                                  bestMatch.similarity >= 0.65 ? 'medium' : 'low';
                                  
            const confidenceMessage = confidenceLevel === 'low' 
              ? "\n\n⚠️ Note: The information found has low similarity to your query. Please verify the accuracy of the response."
              : confidenceLevel === 'medium'
              ? "\n\nℹ️ Note: The information found has moderate similarity to your query. Please verify the accuracy of the response."
              : "";
            
            // Get proactive response with suggestions
            const proactiveResult = await generateProactiveResponse(
              sanitizedMessage,
              goodChunks,
              conversationHistory
            );
            
            // Format response with suggestions
            responseContent = proactiveResult.mainResponse;
            
            if (proactiveResult.suggestions || proactiveResult.clarifyingQuestion) {
              responseContent += '\n\n---\n\n';
              
              if (proactiveResult.suggestions && proactiveResult.suggestions.length > 0) {
                responseContent += '**You might also want to explore:**\n';
                proactiveResult.suggestions.forEach((s) => {
                  responseContent += `• ${s}\n`;
                });
              }
              
              if (proactiveResult.clarifyingQuestion) {
                responseContent += `\n💡 ${proactiveResult.clarifyingQuestion}`;
              }
            }
            
            responseContent += confidenceMessage;
            
            // Store metadata for frontend to show interactive suggestions
            sources = goodChunks.map((chunk) => ({
              document_id: chunk.document_id,
              document_title: chunk.document_title,
              similarity: chunk.similarity,
              content: chunk.content.substring(0, 200) + '...',
              chunk_index: chunk.chunk_index,
              confidence: chunk.similarity, // Add confidence score
              search_type: chunk.search_type || 'vector',  // Add search type information
              // Add proactive metadata
              suggestions: proactiveResult.suggestions,
              clarifyingQuestion: proactiveResult.clarifyingQuestion
            }));
          }
        }
      } catch (error) {
        console.error('Hybrid search error:', error);
        // Fallback to original search
        console.log('Falling back to original vector search for query:', sanitizedMessage);
        const queryEmbedding = await generateQueryEmbedding(sanitizedMessage);
        const { data: chunks, error: searchError } = await supabase.rpc('match_documents', {
          query_embedding: queryEmbedding,
          match_threshold: 0.65,
          match_count: 5,
          p_user_id: user.id
        });
        
        console.log('Fallback search results - chunks found:', chunks?.length || 0, 'error:', searchError);
        if (searchError || !chunks || chunks.length === 0) {
          console.log('Fallback search also failed for query:', sanitizedMessage);
          responseContent = "I couldn't find any relevant information in your documents for that query. Try rephrasing your question or check if you have uploaded the relevant documents.";
        } else {
          console.log('Fallback search successful, generating RAG response with', chunks.length, 'chunks');
          responseContent = await generateRagResponse(sanitizedMessage, chunks, conversationHistory);
          sources = chunks.map((chunk) => ({
              document_id: chunk.document_id,
              document_title: chunk.document_title,
              similarity: chunk.similarity,
              content: chunk.content.substring(0, 200) + '...',
              chunk_index: chunk.chunk_index
            }));
        }
      }
    } else {
      // General chat
      responseContent = await generateGeneralChatResponse(sanitizedMessage, conversationHistory);
    }
    // Save assistant message
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: responseContent,
      metadata: sources.length > 0 ? {
        sources
      } : null
    });
    // Update conversation timestamp
    await supabase.from('conversations').update({
      updated_at: new Date().toISOString()
    }).eq('id', conversationId);
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
