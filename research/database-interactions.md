# RAG Book Database Interactions Documentation

## Overview
This document describes how users, admins, and the system interact with the database tables in the RAG Book application. It details the relationships between different entities and the access patterns for each user type.

## Table Interactions

### 1. conversations Table
**Purpose**: Stores user conversation threads

**Users**:
- **SELECT**: View their own conversations
- **INSERT**: Create new conversations
- **UPDATE**: Update conversation metadata (title, timestamps)
- **DELETE**: Delete their own conversations

**Admins**:
- **SELECT**: View all conversations (when implemented)

**System**:
- **UPDATE**: Update `updated_at` timestamps via triggers

**Access Patterns**:
- User creates new conversation when starting chat
- User loads recent conversations on app initialization
- User loads specific conversation history by ID
- System updates timestamp when new messages are added

### 2. messages Table  
**Purpose**: Stores individual chat messages within conversations

**Users**:
- **SELECT**: View messages in their conversations
- **INSERT**: Add new messages (user and system messages)
- **UPDATE**: Modify existing messages (if implemented)
- **DELETE**: Remove their own messages (if implemented)

**Admins**:
- **SELECT**: View all messages (when implemented)

**System**:
- **INSERT**: Add AI responses to conversations
- **UPDATE**: Modify conversation timestamps via triggers

**Access Patterns**:
- User sends message → INSERT into messages table
- AI generates response → INSERT into messages table  
- User loads conversation → SELECT all messages by conversation_id
- User loads conversation history → SELECT with pagination

### 3. documents Table
**Purpose**: Stores metadata for user-uploaded documents

**Users**:
- **SELECT**: View their own documents
- **INSERT**: Upload new documents (via frontend upload flow)
- **UPDATE**: Update document status, processing info
- **DELETE**: Remove their own documents

**Admins**:
- **SELECT**: View all documents (when implemented)

**System**:
- **UPDATE**: Update processing status via worker functions
- **INSERT**: Create document records in processing queue

**Access Patterns**:
- User uploads document → INSERT document record with "pending" status
- Worker processes document → UPDATE status (pending → queued → processing → completed/failed)
- User views document list → SELECT all user documents
- System checks document status → SELECT specific document by ID

### 4. knowledge_base Table
**Purpose**: Stores document chunks with vector embeddings for RAG search

**Users**:
- **SELECT**: Search their own knowledge base via vector similarity
- **INSERT**: System adds document chunks (not direct user access)
- **DELETE**: Remove chunks when documents are deleted

**Admins**:
- **SELECT**: Search all knowledge base entries (admin_search_all_knowledge function)

**System**:
- **INSERT**: Worker adds chunks when documents are processed
- **DELETE**: Remove chunks when documents are deleted

**Access Patterns**:
- User asks question about documents → Vector similarity search on knowledge_base
- Worker processes document → Chunk document and INSERT chunks with embeddings
- User deletes document → DELETE all related knowledge_base entries

### 5. user_subscriptions Table
**Purpose**: Tracks user subscription status, plan types, and credit balances

**Users**:
- **SELECT**: View their own subscription details
- **UPDATE**: System updates credits and plan status (via webhook/payment)

**Admins**:
- **SELECT**: View all subscription details
- **UPDATE**: Modify subscription plans when needed

**System**:
- **INSERT**: Create default subscription for new users
- **UPDATE**: Modify credits after each chat message
- **UPDATE**: Modify plan status via Paystack webhook

**Access Patterns**:
- User signs up → INSERT default "free" subscription
- User sends message → UPDATE credits (decrement)
- User pays via Paystack → Webhook UPDATE plan to "pro"
- User loads app → SELECT subscription to check credits and plan

### 6. user_roles Table
**Purpose**: Defines user roles (admin, etc.)

**Users**:
- **SELECT**: Check their own roles (for authorization)
- **INSERT**: System adds roles (not direct user access)

**Admins**:
- **SELECT**: View all user roles
- **INSERT/UPDATE**: Assign roles to users

**System**:
- **INSERT**: Add roles via admin functions

**Access Patterns**:
- User logs in → SELECT to check if user has admin role
- Admin assigns role → INSERT new role record
- App checks permissions → SELECT role for current user

### 7. decision_log Table
**Purpose**: Logs AI decision-making transparency for accountability

**Users**:
- **SELECT**: View their own decision logs
- **INSERT**: System logs decisions (not direct user access)

**Admins**:
- **SELECT**: View all decision logs

**System**:
- **INSERT**: Log each AI decision with factors and confidence

**Access Patterns**:
- AI generates response → INSERT decision factors, confidence, alternatives
- Users review transparency → SELECT their decision logs
- Admin audits decisions → SELECT all decision logs

### 8. security_events Table
**Purpose**: Tracks security-related events and anomalies

**Users**:
- **SELECT**: View their own events (limited access)

**Admins**:
- **SELECT**: View all security events
- **INSERT**: Manual security events if needed

**System**:
- **INSERT**: Log security events automatically (failed auth, prompt injection, etc.)

**Access Patterns**:
- Authentication fails → INSERT auth failure event
- Prompt injection detected → INSERT security event
- User accesses security events → SELECT events for user

### 9. security_logs Table
**Purpose**: Detailed logging for security monitoring and analysis

**Users**:
- **SELECT**: View their own logs (limited access)

**Admins**:
- **SELECT**: View all security logs
- **INSERT**: Manual logs if needed

**System**:
- **INSERT**: Log all security-relevant actions

**Access Patterns**:
- Every chat request → INSERT security log entry
- Rate limit exceeded → INSERT rate limit event
- System anomalies → INSERT security log

### 10. processing_queue Table
**Purpose**: Manages document processing jobs in the queue

**Users**:
- **SELECT**: View their own processing jobs
- **INSERT**: Submit documents to processing queue

**Admins**:
- **SELECT**: View all processing jobs
- **DELETE**: Clear jobs if needed

**System**:
- **INSERT**: Add jobs when documents submitted
- **UPDATE**: Update job status during processing
- **DELETE**: Remove completed jobs

**Access Patterns**:
- User submits document → INSERT processing job
- Worker processes job → UPDATE status (queued → processing → completed)
- User checks status → SELECT job by document_id

### 11. user_sessions Table
**Purpose**: Tracks user sessions for security and analytics

**Users**:
- **SELECT**: View their own sessions
- **INSERT**: Create new session
- **UPDATE**: Update session activity

**Admins**:
- **SELECT**: View all sessions (for security review)

**System**:
- **INSERT**: Create session on login
- **UPDATE**: Update last activity timestamp

**Access Patterns**:
- User logs in → INSERT new session
- User activity → UPDATE last_activity timestamp
- Session expiry → DELETE expired sessions

### 12. user_state Table
**Purpose**: Stores user personalization state and preferences

**Users**:
- **SELECT**: Load their own preferences
- **INSERT**: Initialize user state
- **UPDATE**: Update preferences and learning data

**Admins**:
- **SELECT**: View user states for support (if needed)

**System**:
- **INSERT**: Create default state for new users
- **UPDATE**: Update learning and preferences via AI interactions

**Access Patterns**:
- User first interaction → INSERT default user state
- AI learns user preferences → UPDATE preference patterns
- User loads app → SELECT user state for personalization

### 13. system_memory Table
**Purpose**: Stores AI's persistent memory about users

**Users**:
- **SELECT**: View their own system memory
- **INSERT**: Add memory entries
- **UPDATE**: Modify memory
- **DELETE**: Clear memory

**Admins**:
- **SELECT**: Access all system memory for review

**System**:
- **INSERT**: Add AI learning about user
- **UPDATE**: Update memory confidence and content

**Access Patterns**:
- AI learns new user fact → INSERT memory entry
- User requests memory → SELECT memory entries
- User wants clean slate → DELETE memory entries

### 14. user_feedback Table
**Purpose**: Stores user feedback on AI responses

**Users**:
- **SELECT**: View their own feedback
- **INSERT**: Submit feedback
- **UPDATE**: Modify feedback

**Admins**:
- **SELECT**: View all feedback for improvement

**System**:
- **INSERT**: Store user feedback

**Access Patterns**:
- User provides feedback → INSERT feedback entry
- Admin analyzes feedback → SELECT all feedback
- User updates feedback → UPDATE feedback content

### 15. rate_limits Table
**Purpose**: Tracks API rate limiting for users and IPs

**Users**:
- **SELECT**: Check their own rate limits (indirectly)

**Admins**:
- **SELECT**: View all rate limits for monitoring

**System**:
- **INSERT**: Create rate limit entries
- **UPDATE**: Update request counts
- **DELETE**: Clean up expired limits

**Access Patterns**:
- User makes request → Check and update rate limit
- Rate limit expires → Clean up old entries

## Authentication and Authorization Flow

1. **User Authentication**: 
   - User logs in → Supabase auth generates JWT
   - App uses JWT for all database requests
   - RLS policies verify `auth.uid() = user_id`

2. **Admin Authorization**:
   - App checks `user_roles` table for 'admin' role
   - Uses RPC functions to verify admin status
   - Admin-specific policies allow broader access

3. **System Operations**:
   - Functions use SERVICE_ROLE_KEY for system operations
   - RLS bypassed for system functions using SECURITY DEFINER
   - Functions verify permissions before bypassing RLS

## Security Considerations

1. **Row Level Security**: All tables protected by RLS policies
2. **Column Level Security**: Sensitive data protected at column level
3. **Function Security**: RPC functions with proper validation
4. **Rate Limiting**: API protection against abuse
5. **Audit Trail**: All operations logged for security review

## Performance Optimizations

1. **Indexes**: Proper indexes on user_id, created_at, and search columns
2. **Caching**: Application-level caching for frequently accessed data
3. **Pagination**: Proper pagination for large datasets
4. **Connection Pooling**: Efficient database connection management