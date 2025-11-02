# Backend Development Rules (Supabase Edge Functions)

**Activation Mode**: Glob Pattern: `supabase/functions/**/*.ts`

## Tech Stack
- **Runtime**: Deno (TypeScript)
- **Database**: Supabase PostgreSQL with pgvector
- **Queue**: Upstash Redis
- **AI**: Google Gemini for chat, HuggingFace for embeddings

## Edge Function Best Practices

### Function Structure
- Keep functions focused on a single responsibility
- Use proper error handling with try-catch blocks
- Return consistent response formats
- Set appropriate CORS headers
- Use TypeScript for type safety

### Authentication & Authorization
- Always verify JWT tokens from Supabase Auth
- Use `supabaseClient.auth.getUser()` to get authenticated user
- Check user permissions before operations
- Use service role key only when necessary (not for user-facing operations)

### Database Operations
- Use parameterized queries to prevent SQL injection
- Respect Row-Level Security (RLS) policies
- Use transactions for multi-step operations
- Handle database errors gracefully
- Use proper indexes for performance

### Redis Queue Integration
- Push jobs to Redis queue for async processing
- Use consistent job payload structure
- Set appropriate job priorities
- Handle Redis connection errors
- Don't block on Redis operations

### Credit System
- Always check credits before chat operations
- Decrement credits atomically using database functions
- Handle insufficient credits gracefully
- Update subscription status correctly
- Log credit transactions for auditing

## Edge Function Patterns

### submit-document Function
```typescript
// 1. Authenticate user
// 2. Validate document_id
// 3. Check document exists and belongs to user
// 4. Push job to Redis queue
// 5. Update document status to 'queued'
// 6. Return success response
```

### rag-chat-credits Function
```typescript
// 1. Authenticate user
// 2. Check credits availability
// 3. Perform vector search on knowledge_base
// 4. Generate AI response with Gemini
// 5. Decrement credits
// 6. Stream response with SSE
// 7. Include sources in response
```

### paystack-webhook Function
```typescript
// 1. Verify webhook signature
// 2. Parse webhook payload
// 3. Handle event types (charge.success, subscription.create, etc.)
// 4. Update user_subscriptions table
// 5. Send confirmation email (if applicable)
// 6. Return 200 OK
```

## Error Handling
- Return proper HTTP status codes
- Include error messages in response body
- Log errors for debugging
- Don't expose sensitive information in errors
- Handle edge cases (null values, missing data)

## Environment Variables
- Use `Deno.env.get()` for environment variables
- Never hardcode secrets
- Validate required env vars at function start
- Use different keys for test/production

## Response Formats

### Success Response
```typescript
return new Response(
  JSON.stringify({
    success: true,
    data: { ... },
    message: "Operation completed"
  }),
  { status: 200, headers: { 'Content-Type': 'application/json' } }
);
```

### Error Response
```typescript
return new Response(
  JSON.stringify({
    success: false,
    error: "Error message",
    code: "ERROR_CODE"
  }),
  { status: 400, headers: { 'Content-Type': 'application/json' } }
);
```

### Streaming Response (SSE)
```typescript
const stream = new ReadableStream({
  async start(controller) {
    controller.enqueue(`data: ${JSON.stringify({ type: 'content', delta: '...' })}\n\n`);
    controller.enqueue('data: [DONE]\n\n');
    controller.close();
  }
});

return new Response(stream, {
  headers: {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  }
});
```

## Vector Search Best Practices
- Use 384-dimensional embeddings (not 768)
- Set appropriate similarity threshold (e.g., 0.7)
- Limit results to top K chunks (e.g., 5-10)
- Use cosine similarity metric
- Include document metadata in results

## Performance Optimization
- Use connection pooling for database
- Cache frequently accessed data
- Minimize external API calls
- Use batch operations where possible
- Set appropriate timeouts
