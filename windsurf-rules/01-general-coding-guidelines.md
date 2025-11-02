# General Coding Guidelines

**Activation Mode**: Always On

## Project Context
This is RAG Book - a production-grade RAG system for students featuring:
- Asynchronous document processing with OCR support
- Credit-based payment system with Paystack
- Real-time status updates via Supabase
- Vector search with HuggingFace embeddings (384-dim)

## Core Principles

### Code Quality
- Write production-grade, scalable code suitable for deployment
- Prioritize security, performance, and maintainability
- Follow existing patterns and conventions in the codebase
- Add comprehensive error handling and validation
- Include proper logging for debugging and monitoring

### Documentation
- Add clear comments for complex logic
- Update README.md when adding new features
- Document API endpoints and data structures
- Keep inline documentation concise but informative

### Testing & Validation
- Test all changes thoroughly before committing
- Verify real-time updates work correctly
- Check credit system functionality
- Ensure RLS policies are not bypassed
- Test error scenarios and edge cases

### Performance
- Optimize for 384-dimensional vectors (not 768-dim)
- Consider storage costs and query performance
- Use batch processing where appropriate
- Implement proper indexing for database queries

### Security
- Never expose API keys or secrets in code
- Always use environment variables for sensitive data
- Validate and sanitize all user inputs
- Respect Row-Level Security (RLS) policies
- Use Supabase service key only in backend/worker code

## File Organization
- Keep components modular and reusable
- Follow the existing folder structure
- Place new features in appropriate directories
- Maintain separation between frontend, backend, and worker code

## Git Practices
- Write clear, descriptive commit messages
- Keep commits focused and atomic
- Don't commit sensitive files (.env, secrets)
- Follow the existing .gitignore patterns
