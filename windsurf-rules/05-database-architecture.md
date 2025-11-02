# Database & Architecture Rules

**Activation Mode**: Glob Pattern: `supabase/migrations/**/*.sql`

## Database Technology
- **Database**: PostgreSQL (via Supabase)
- **Vector Extension**: pgvector
- **Real-time**: Supabase Realtime
- **Auth**: Supabase Auth with JWT

## Schema Design Principles

### Core Tables
- `documents` - Document metadata and processing status
- `knowledge_base` - Text chunks with 384-dim vector embeddings
- `user_subscriptions` - Credits and payment management
- `conversations` - Chat sessions
- `messages` - Chat history
- `user_roles` - Admin access control

### Enums
- `document_status`: pending, queued, processing, completed, failed, partial
- `subscription_plan`: free, pro
- `app_role`: user, admin

## Migration Best Practices

### Migration Structure
- Use sequential numbering for migrations
- One migration per logical change
- Include both up and down migrations
- Test migrations on development database first
- Document breaking changes

### Migration Naming
```
YYYYMMDDHHMMSS_descriptive_name.sql
Example: 20240101120000_create_documents_table.sql
```

### SQL Best Practices
- Use explicit column types
- Add NOT NULL constraints where appropriate
- Set default values for columns
- Create indexes for foreign keys
- Use CASCADE for delete operations carefully

## Row-Level Security (RLS)

### RLS Principles
- Enable RLS on all user-facing tables
- Create policies for SELECT, INSERT, UPDATE, DELETE
- Use `auth.uid()` to identify current user
- Test policies thoroughly
- Document policy logic

### Common RLS Patterns
```sql
-- Users can only see their own documents
CREATE POLICY "Users can view own documents"
ON documents FOR SELECT
USING (auth.uid() = user_id);

-- Users can only insert their own documents
CREATE POLICY "Users can insert own documents"
ON documents FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admin can see all
CREATE POLICY "Admins can view all documents"
ON documents FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);
```

## Vector Search Configuration

### pgvector Setup
- Use `vector(384)` for embedding column
- Create IVFFlat index for performance
- Use cosine similarity for distance metric
- Set appropriate lists parameter (100 for medium datasets)

### Index Creation
```sql
CREATE INDEX knowledge_base_embedding_idx 
ON knowledge_base 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

### Vector Search Query Pattern
```sql
SELECT 
  content,
  1 - (embedding <=> query_embedding) as similarity
FROM knowledge_base
WHERE document_id = ANY($1)
ORDER BY embedding <=> query_embedding
LIMIT 10;
```

## Database Functions

### Credit Management
```sql
CREATE OR REPLACE FUNCTION decrement_credits(user_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  remaining INTEGER;
BEGIN
  UPDATE user_subscriptions
  SET credits_remaining = credits_remaining - 1
  WHERE user_id = user_uuid
  RETURNING credits_remaining INTO remaining;
  
  RETURN remaining;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Function Best Practices
- Use `SECURITY DEFINER` carefully (bypasses RLS)
- Return meaningful values
- Handle NULL cases
- Use transactions for multi-step operations
- Add error handling

## Triggers & Automation

### Common Trigger Patterns
```sql
-- Update updated_at timestamp
CREATE TRIGGER update_documents_updated_at
BEFORE UPDATE ON documents
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Cascade delete knowledge_base entries
-- (Use ON DELETE CASCADE in foreign key instead)
```

### Trigger Best Practices
- Keep trigger logic simple
- Avoid complex business logic in triggers
- Document trigger behavior
- Test trigger side effects
- Consider performance impact

## Realtime Configuration

### Enable Realtime
- Enable replication for tables that need real-time updates
- Configure publication for specific tables
- Use filters to reduce unnecessary updates
- Handle connection drops gracefully in client

### Realtime Tables
- `documents` - For status updates
- `messages` - For chat updates (optional)
- `user_subscriptions` - For credit updates

## Performance Optimization

### Indexing Strategy
- Index foreign keys
- Index columns used in WHERE clauses
- Index columns used in ORDER BY
- Use partial indexes for filtered queries
- Monitor index usage with EXPLAIN

### Query Optimization
- Use EXPLAIN ANALYZE for slow queries
- Avoid N+1 queries
- Use JOINs instead of multiple queries
- Limit result sets appropriately
- Use pagination for large datasets

### Connection Management
- Use connection pooling
- Set appropriate pool size
- Handle connection timeouts
- Close connections properly
- Monitor connection usage

## Backup & Recovery

### Backup Strategy
- Supabase handles automatic backups
- Export critical data regularly
- Test restore procedures
- Document recovery steps
- Keep migration history

## Data Integrity

### Constraints
- Use foreign keys for relationships
- Add CHECK constraints for validation
- Use UNIQUE constraints where appropriate
- Set NOT NULL for required fields
- Use DEFAULT values sensibly

### Data Validation
- Validate data at application layer
- Use database constraints as safety net
- Handle constraint violations gracefully
- Log validation errors
- Provide user-friendly error messages

## Architecture Patterns

### Async Processing Flow
```
Frontend → Edge Function → Redis Queue → Python Worker → Database
                ↓                                           ↓
              Update Status ← ← ← ← ← ← ← ← ← ← ← ← ← ← ←
                ↓
              Realtime Subscription → Frontend
```

### Credit System Flow
```
User Request → Edge Function → Check Credits → Process Request
                                     ↓
                              Decrement Credits
                                     ↓
                              Update Subscription
```

### Document Processing States
```
pending → queued → processing → completed
                        ↓
                     failed
```

## Security Considerations

### Sensitive Data
- Never store plain text passwords
- Encrypt sensitive fields if needed
- Use Supabase Vault for secrets
- Audit access to sensitive tables
- Log security events

### API Security
- Use service role key only in backend
- Validate all inputs
- Rate limit API endpoints
- Use HTTPS for all connections
- Implement proper CORS policies
