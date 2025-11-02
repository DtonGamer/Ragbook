# Testing & Debugging Rules

**Activation Mode**: Manual (use @testing when needed)

## Testing Philosophy
- Write tests for critical business logic
- Test error scenarios and edge cases
- Maintain test coverage for core features
- Use tests as documentation
- Keep tests simple and readable

## Frontend Testing

### Testing Tools
- **Framework**: Vitest
- **Testing Library**: @testing-library/react
- **Coverage**: @vitest/coverage-istanbul

### What to Test
- Component rendering
- User interactions
- State management
- API integration (mocked)
- Error handling
- Real-time subscriptions (mocked)

### Testing Patterns
```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';

describe('ChatMessage', () => {
  it('renders user message correctly', () => {
    render(<ChatMessage role="user" content="Hello" />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('handles copy button click', async () => {
    const user = userEvent.setup();
    render(<ChatMessage role="assistant" content="Response" />);
    
    const copyButton = screen.getByRole('button', { name: /copy/i });
    await user.click(copyButton);
    
    // Assert clipboard or toast notification
  });
});
```

### Mocking Supabase
```typescript
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: [], error: null }))
      }))
    })),
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null }))
    }
  }
}));
```

## Backend Testing

### Edge Function Testing
- Test authentication flows
- Test credit checking logic
- Test vector search queries
- Test error responses
- Test webhook signature verification

### Testing Approach
```typescript
// Use Deno's built-in testing
Deno.test("submit-document validates document_id", async () => {
  const req = new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify({ document_id: "invalid" })
  });
  
  const response = await handler(req);
  assertEquals(response.status, 400);
});
```

## Worker Testing

### Python Testing
- Use pytest for unit tests
- Mock external dependencies (Supabase, Redis, HuggingFace)
- Test chunking logic
- Test embedding generation
- Test OCR processing

### Testing Patterns
```python
import pytest
from unittest.mock import Mock, patch
from worker import process_document

def test_chunking_with_overlap():
    text = "This is a test document with multiple sentences."
    chunks = chunk_text(text, chunk_size=10, overlap=2)
    
    assert len(chunks) > 1
    assert all(len(chunk) <= 10 for chunk in chunks)
    # Verify overlap

@patch('worker.supabase')
def test_document_processing(mock_supabase):
    mock_supabase.storage.from_().download.return_value = b"PDF content"
    
    result = process_document("doc-id")
    
    assert result["status"] == "completed"
    assert result["chunk_count"] > 0
```

## Integration Testing

### End-to-End Flow Testing
1. Upload document → verify queued status
2. Worker processes → verify completed status
3. Chat with document → verify response with sources
4. Check credits → verify decrement

### Testing Checklist
- [ ] User signup and login
- [ ] Document upload and processing
- [ ] Real-time status updates
- [ ] Chat with RAG
- [ ] Credit system
- [ ] Payment flow (test mode)
- [ ] Admin panel access

## Debugging Strategies

### Frontend Debugging
- Use React DevTools for component inspection
- Check browser console for errors
- Use Network tab for API calls
- Verify Supabase Realtime connections
- Check localStorage for session data

### Backend Debugging
- Check Supabase Edge Function logs
- Verify database queries with SQL editor
- Test RLS policies with different users
- Monitor Redis queue length
- Check webhook delivery logs (Paystack)

### Worker Debugging
- Check Docker container logs: `docker-compose logs -f worker`
- Verify Redis connection: `redis-cli -u $REDIS_URL PING`
- Check queue contents: `redis-cli -u $REDIS_URL LRANGE pdf-processing 0 -1`
- Monitor worker resource usage: `docker stats`
- Test OCR locally with sample PDFs

### Database Debugging
```sql
-- Check document status
SELECT id, filename, status, status_message, error_message
FROM documents
WHERE user_id = 'user-uuid'
ORDER BY created_at DESC;

-- Check knowledge base entries
SELECT document_id, COUNT(*) as chunk_count
FROM knowledge_base
GROUP BY document_id;

-- Check user credits
SELECT user_id, plan, credits_remaining, credits_max
FROM user_subscriptions;

-- Test vector search
SELECT content, 1 - (embedding <=> '[0.1, 0.2, ...]'::vector) as similarity
FROM knowledge_base
ORDER BY embedding <=> '[0.1, 0.2, ...]'::vector
LIMIT 5;
```

## Common Issues & Solutions

### Document Stuck in "queued"
**Debug Steps:**
1. Check worker is running: `docker ps`
2. Check worker logs: `docker-compose logs worker`
3. Verify Redis connection
4. Check queue length: `redis-cli LLEN pdf-processing`

### Credits Not Decrementing
**Debug Steps:**
1. Check user plan (Pro has unlimited)
2. Test decrement function manually
3. Check Edge Function logs
4. Verify RLS policies

### Vector Search Returns No Results
**Debug Steps:**
1. Verify embeddings exist: `SELECT COUNT(*) FROM knowledge_base WHERE document_id = '...'`
2. Check embedding dimensions: `SELECT vector_dims(embedding) FROM knowledge_base LIMIT 1`
3. Test similarity threshold
4. Verify document is completed

### Real-time Updates Not Working
**Debug Steps:**
1. Check Realtime is enabled in Supabase
2. Verify publication settings
3. Check browser console for connection errors
4. Test with different network conditions

## Performance Testing

### Load Testing
- Test concurrent document uploads
- Test multiple simultaneous chat requests
- Monitor database connection pool
- Check worker queue processing speed
- Measure vector search latency

### Performance Metrics to Track
- Document processing time by page count
- Vector search query time
- Credit decrement operation time
- Real-time update latency
- API response times

## Logging Best Practices

### Frontend Logging
```typescript
// Development only
if (import.meta.env.DEV) {
  console.log('Document status:', status);
}

// Production errors
console.error('Failed to upload document:', error);
```

### Backend Logging
```typescript
// Edge Functions
console.log(`[rag-chat] User ${userId} - Credits: ${credits}`);
console.error(`[submit-document] Error:`, error);
```

### Worker Logging
```python
import logging

logger = logging.getLogger(__name__)

logger.info(f"Processing document {document_id}")
logger.error(f"OCR failed for {document_id}: {error}")
logger.debug(f"Generated {len(chunks)} chunks")
```

## Monitoring & Alerting

### Key Metrics to Monitor
- Worker uptime and health
- Redis queue length
- Database connection count
- API error rates
- Document processing success rate
- Average processing time
- Credit usage patterns

### Alert Conditions
- Worker down for > 5 minutes
- Queue length > 100 jobs
- Database connection pool exhausted
- API error rate > 5%
- Processing failure rate > 10%
