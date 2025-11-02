import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
// ============================================================================
// CONFIGURATION
// ============================================================================
const EMBEDDING_DIMENSIONS = 384; // HuggingFace all-MiniLM-L6-v2
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
  const HUGGINGFACE_API_KEY = Deno.env.get('HUGGINGFACE_API_KEY');
  if (!HUGGINGFACE_API_KEY) {
    throw new Error('HUGGINGFACE_API_KEY not configured');
  }
  const response = await fetch('https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      inputs: [
        queryText
      ],
      options: {
        wait_for_model: true
      }
    })
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HuggingFace API error: ${response.status} - ${errorText}`);
  }
  const result = await response.json();
  // Handle different response formats
  let embedding;
  if (Array.isArray(result) && Array.isArray(result[0])) {
    // Response is [[embedding]]
    embedding = result[0];
  } else if (Array.isArray(result)) {
    // Response is [embedding]
    embedding = result;
  } else {
    throw new Error('Unexpected embedding response format');
  }
  if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Invalid embedding response. Expected ${EMBEDDING_DIMENSIONS} dimensions, got ${embedding?.length || 0}`);
  }
  return embedding;
}
// ============================================================================
// SMART QUERY ANALYSIS
// ============================================================================
function analyzeQuery(message, userState) {
  const lowerMessage = message.toLowerCase().trim();
  // Document list request
  const listKeywords = [
    'list my files',
    'list my documents',
    'show my files',
    'show my documents',
    'what files do i have',
    'what documents do i have',
    'my uploaded files'
  ];
  if (listKeywords.some((phrase)=>lowerMessage.includes(phrase))) {
    return {
      type: 'document_list',
      confidence: 0.95,
      reasoning: 'User explicitly asked to list documents',
      alternatives: [],
      userIntent: 'list_documents',
      needsEmbedding: false
    };
  }
  // Document search request
  const searchKeywords = [
    'search my documents',
    'search my files',
    'find in my documents',
    'look in my files',
    'check my documents for',
    'search uploaded'
  ];
  if (searchKeywords.some((phrase)=>lowerMessage.includes(phrase))) {
    return {
      type: 'document_search',
      confidence: 0.9,
      reasoning: 'User explicitly asked to search documents',
      alternatives: [],
      userIntent: 'search_documents',
      needsEmbedding: true
    };
  }
  // Check for question indicators (might need RAG)
  const questionWords = [
    'what',
    'how',
    'why',
    'when',
    'where',
    'who',
    'explain',
    'tell me about',
    'describe'
  ];
  const hasQuestionWord = questionWords.some((word)=>lowerMessage.includes(word));
  // Check user's document usage patterns
  const hasDocuments = userState?.preferences?.has_documents || false;
  const prefersDocSearch = userState?.intent_patterns?.search_documents > 5;
  if (hasQuestionWord && (hasDocuments || prefersDocSearch)) {
    return {
      type: 'hybrid_search',
      confidence: 0.75,
      reasoning: 'Question detected with document history - trying RAG first',
      alternatives: [
        'general_chat'
      ],
      userIntent: 'potential_document_search',
      needsEmbedding: true
    };
  }
  // General chat
  return {
    type: 'general_chat',
    confidence: 0.9,
    reasoning: 'Natural conversation - no explicit document search request',
    alternatives: [],
    userIntent: 'general_conversation',
    needsEmbedding: false
  };
}
// ============================================================================
// CREDIT MANAGEMENT
// ============================================================================
async function checkAndDecrementCredits(supabase, userId) {
  // Get user subscription
  const { data: subscription, error: subError } = await supabase.from('user_subscriptions').select('plan, credits_remaining, credits_max').eq('user_id', userId).single();
  if (subError || !subscription) {
    // Create default subscription if doesn't exist
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
  // Pro users have unlimited credits (check against 1000 max)
  if (plan === 'pro') {
    if (credits_remaining <= 0) {
      return {
        success: false,
        remaining: 0,
        plan: 'pro',
        message: 'Pro plan credits exhausted. Please contact support.'
      };
    }
    // Decrement pro credits
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
  // Free users have limited credits
  if (credits_remaining <= 0) {
    return {
      success: false,
      remaining: 0,
      plan: 'free',
      message: 'You have run out of credits. Please upgrade to Pro for 1000 credits.'
    };
  }
  // Decrement free credits
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
    const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`, {
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
      throw new Error(`AI service error: ${aiResponse.status}`);
    }
    const aiData = await aiResponse.json();
    return aiData.candidates?.[0]?.content?.parts?.[0]?.text || "Hey! I'm here to chat. What's on your mind?";
  } catch (error) {
    console.error('General chat error:', error);
    return "Hey! I'm having a bit of trouble right now, but I'm here to chat. Try asking me again?";
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
    // ========================================================================
    // CHECK & DECREMENT CREDITS
    // ========================================================================
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
    // Get user state using RPC
    const { data: userState } = await supabase.rpc('get_or_create_user_state', {
      target_user_id: user.id
    });
    // Fetch conversation history
    const { data: recentMessages } = await supabase.from('messages').select('role, content').eq('conversation_id', conversationId).order('created_at', {
      ascending: false
    }).limit(10);
    const conversationHistory = (recentMessages || []).reverse().map((msg)=>`${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`).join('\n\n');
    // Analyze query with smart routing
    const queryAnalysis = analyzeQuery(sanitizedMessage, userState);
    // Check if should yield control
    const { data: shouldYield } = await supabase.rpc('should_yield_control', {
      target_user_id: user.id
    });
    let responseContent = '';
    let sources = [];
    let decisionFactors = {
      queryType: queryAnalysis.type,
      confidence: queryAnalysis.confidence,
      reasoning: queryAnalysis.reasoning,
      alternatives: queryAnalysis.alternatives,
      userIntent: queryAnalysis.userIntent,
      shouldYield: shouldYield || false,
      userTrustLevel: userState?.trust_level || 0.5,
      needsEmbedding: queryAnalysis.needsEmbedding
    };
    // ========================================================================
    // SMART ROUTING: GENERATE RESPONSE BASED ON QUERY TYPE
    // ========================================================================
    if (shouldYield && queryAnalysis.confidence < 0.7) {
      // System is uncertain - ask for clarification
      responseContent = `I sense you might be looking for something specific, but I'm not entirely sure what you need. Could you help me understand better? 

I can help you with:
• Searching through your uploaded documents
• Listing your uploaded files  
• Having a general conversation

What would be most helpful for you right now?`;
    } else if (queryAnalysis.type === 'document_list') {
      // List documents (no embedding needed)
      const { data: documents, error: docError } = await supabase.from('documents').select('id, original_name, created_at, file_size, status, user_id, chunk_count').eq('user_id', user.id).order('created_at', {
        ascending: false
      });
      if (docError) {
        console.error('Document list error:', docError);
      }
      if (!documents || documents.length === 0) {
        responseContent = "You haven't uploaded any documents yet. You can upload documents from the Documents page to get started.";
      } else {
        const formatStatus = (doc)=>{
          if (doc.status === 'completed') {
            return `✅ Ready (${doc.chunk_count || 0} chunks)`;
          } else if (doc.status === 'processing') {
            return `⏳ Processing`;
          } else if (doc.status === 'failed') {
            return `❌ Failed`;
          } else {
            return `📤 ${doc.status}`;
          }
        };
        const docList = documents.map((doc)=>`• **${doc.original_name}** - ${formatStatus(doc)}\n  Uploaded: ${new Date(doc.created_at).toLocaleDateString()}`).join('\n\n');
        const completedCount = documents.filter((d)=>d.status === 'completed').length;
        responseContent = `Here are your uploaded documents:\n\n${docList}\n\n---\n\n**Summary:** ${completedCount} of ${documents.length} documents ready to search.\n\nYou can ask me to search through your completed documents for specific information.`;
      }
    } else if (queryAnalysis.needsEmbedding) {
      // Document search or hybrid search (needs embedding)
      try {
        console.log('Generating query embedding with HuggingFace...');
        const queryEmbedding = await generateQueryEmbedding(sanitizedMessage);
        // Search using match_documents RPC
        const { data: chunks, error: searchError } = await supabase.rpc('match_documents', {
          query_embedding: queryEmbedding,
          match_threshold: 0.65,
          match_count: 5,
          p_user_id: user.id
        });
        if (searchError) {
          await logToSecurityLog(supabase, 3, 'Knowledge base search failed', 'rag-chat', user.id, null, requestId, userInfo.ip, userInfo.userAgent, null, {
            error: searchError.message
          });
          // Fallback to general chat
          if (queryAnalysis.type === 'hybrid_search') {
            responseContent = await generateGeneralChatResponse(sanitizedMessage, conversationHistory);
          } else {
            responseContent = "I'm sorry, I couldn't search your documents at the moment. Please try again later.";
          }
        } else if (!chunks || chunks.length === 0) {
          // No results found
          if (queryAnalysis.type === 'hybrid_search') {
            // Fallback to general chat for hybrid queries
            responseContent = await generateGeneralChatResponse(sanitizedMessage, conversationHistory);
          } else {
            responseContent = "I couldn't find any relevant information in your documents for that query. Try rephrasing your question or check if you have uploaded the relevant documents.";
          }
        } else {
          // Found relevant chunks - generate RAG response
          const context = chunks.map((chunk)=>chunk.content).join('\n\n');
          sources = chunks.map((chunk)=>({
              document_id: chunk.document_id,
              document_title: chunk.document_title,
              similarity: chunk.similarity,
              content: chunk.content.substring(0, 200) + '...',
              chunk_index: chunk.chunk_index
            }));
          try {
            const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
            if (!GEMINI_API_KEY) {
              throw new Error('GEMINI_API_KEY not configured');
            }
            const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      {
                        text: `Based on the following context from the user's documents, please provide a helpful and accurate response to their question: "${sanitizedMessage}"

Context from documents:
${context}

Instructions:
- Provide a clear, helpful response based on the context
- If the context doesn't contain enough information to fully answer the question, say so
- Cite which documents the information comes from when relevant
- Be conversational and natural in your response`
                      }
                    ]
                  }
                ],
                generationConfig: {
                  temperature: 0.7,
                  topK: 40,
                  topP: 0.95,
                  maxOutputTokens: 1024
                }
              })
            });
            if (!aiResponse.ok) {
              throw new Error(`AI service error: ${aiResponse.status}`);
            }
            const aiData = await aiResponse.json();
            responseContent = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I couldn't generate a response at the moment.";
          } catch (aiError) {
            await logToSecurityLog(supabase, 3, 'AI service error for document search', 'rag-chat', user.id, null, requestId, userInfo.ip, userInfo.userAgent, null, {
              error: String(aiError)
            });
            responseContent = "I'm sorry, I couldn't generate a response at the moment. Please try again later.";
          }
        }
      } catch (embeddingError) {
        await logToSecurityLog(supabase, 3, 'Embedding generation failed', 'rag-chat', user.id, null, requestId, userInfo.ip, userInfo.userAgent, null, {
          error: String(embeddingError)
        });
        // Fallback to general chat
        responseContent = await generateGeneralChatResponse(sanitizedMessage, conversationHistory);
      }
    } else {
      // General chat (no embedding needed)
      responseContent = await generateGeneralChatResponse(sanitizedMessage, conversationHistory);
    }
    // ========================================================================
    // SAVE ASSISTANT MESSAGE
    // ========================================================================
    const { data: savedMessage } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: responseContent,
      metadata: {
        ...sources.length > 0 ? {
          sources
        } : {},
        decisionFactors,
        systemState: {
          userTrustLevel: userState?.trust_level || 0.5,
          lastUpdated: new Date().toISOString(),
          learningPoints: [
            `User prefers ${queryAnalysis.type} queries`,
            `Confidence level: ${Math.round(queryAnalysis.confidence * 100)}%`
          ]
        }
      }
    }).select().single();
    // Log decision using RPC
    if (savedMessage) {
      await supabase.rpc('log_decision', {
        target_user_id: user.id,
        target_conversation_id: conversationId,
        target_message_id: savedMessage.id,
        decision_factors: decisionFactors,
        confidence_score: queryAnalysis.confidence,
        alternatives: queryAnalysis.alternatives,
        reasoning: queryAnalysis.reasoning
      });
    }
    // Update user state using RPC
    await supabase.rpc('update_user_state', {
      target_user_id: user.id,
      interaction_data: {
        trust_delta: queryAnalysis.confidence > 0.7 ? 0.05 : -0.02,
        intent_patterns: {
          ...userState?.intent_patterns || {},
          [queryAnalysis.userIntent || 'unknown']: (userState?.intent_patterns?.[queryAnalysis.userIntent || 'unknown'] || 0) + 1
        },
        preferences: {
          ...userState?.preferences || {},
          last_query_type: queryAnalysis.type,
          last_confidence: queryAnalysis.confidence,
          has_documents: sources.length > 0
        }
      }
    });
    // Update conversation timestamp
    await supabase.from('conversations').update({
      updated_at: new Date().toISOString()
    }).eq('id', conversationId);
    await logToSecurityLog(supabase, 1, 'Response sent successfully', 'rag-chat', user.id, null, requestId, userInfo.ip, userInfo.userAgent, {
      queryType: queryAnalysis.type,
      confidence: queryAnalysis.confidence,
      creditsRemaining: creditResult.remaining,
      plan: creditResult.plan
    });
    const response = new Response(JSON.stringify({
      message: responseContent,
      sources: sources,
      conversationId: conversationId,
      credits: creditResult.remaining,
      plan: creditResult.plan,
      decisionFactors: decisionFactors,
      systemState: {
        userTrustLevel: userState?.trust_level || 0.5,
        lastUpdated: new Date().toISOString(),
        learningPoints: [
          `User prefers ${queryAnalysis.type} queries`,
          `Confidence level: ${Math.round(queryAnalysis.confidence * 100)}%`
        ]
      }
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
    return addSecurityHeaders(response);
  } catch (error) {
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
