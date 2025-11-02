# Windsurf Rules for RAG Book Project

This directory contains Cascade AI rules to help manage development of the RAG Book project.

## How to Use These Rules

### Installation
1. Create the `.windsurf/rules` directory in your project root:
   ```bash
   mkdir -p .windsurf/rules
   ```

2. Copy all rule files from `windsurf-rules/` to `.windsurf/rules/`:
   ```bash
   cp windsurf-rules/*.md .windsurf/rules/
   ```

3. The rules will be automatically discovered by Windsurf

### Rule Files

1. **01-general-coding-guidelines.md** (Always On)
   - Project context and core principles
   - Code quality standards
   - Security and performance guidelines
   - File organization and git practices

2. **02-frontend-react-typescript.md** (Glob: `src/**/*.{ts,tsx,jsx,js}`)
   - React and TypeScript best practices
   - Component structure and hooks
   - Tailwind CSS and shadcn/ui usage
   - Real-time features and error handling

3. **03-backend-supabase-edge-functions.md** (Glob: `supabase/functions/**/*.ts`)
   - Edge function development patterns
   - Authentication and authorization
   - Database operations and RLS
   - Redis queue integration
   - Credit system implementation

4. **04-python-worker.md** (Glob: `worker/**/*.py`)
   - Python worker architecture
   - OCR processing with OCRmyPDF
   - Embedding generation with HuggingFace
   - Text chunking and database operations
   - Docker best practices

5. **05-database-architecture.md** (Glob: `supabase/migrations/**/*.sql`)
   - Database schema design
   - Migration best practices
   - Row-Level Security (RLS) policies
   - Vector search configuration
   - Performance optimization

6. **06-testing-debugging.md** (Manual: use @testing)
   - Testing strategies for frontend, backend, and worker
   - Debugging techniques
   - Common issues and solutions
   - Performance testing
   - Monitoring and alerting

## Activation Modes

### Always On
- General coding guidelines apply to all files

### Glob Patterns
- Frontend rules activate for files matching `src/**/*.{ts,tsx,jsx,js}`
- Backend rules activate for files matching `supabase/functions/**/*.ts`
- Worker rules activate for files matching `worker/**/*.py`
- Database rules activate for files matching `supabase/migrations/**/*.sql`

### Manual Activation
- Testing rules can be activated by mentioning `@testing` in your prompt

## Customization

Feel free to modify these rules to match your team's preferences:

1. Edit existing rules to add project-specific conventions
2. Add new rules for additional patterns or requirements
3. Adjust activation modes based on your workflow
4. Keep rules under 12,000 characters each

## Best Practices for Rules

- Keep rules concise and actionable
- Use bullet points and code examples
- Group related guidelines together
- Update rules as the project evolves
- Remove outdated or conflicting rules

## Quick Reference

### Key Technologies
- **Frontend**: React 18, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (PostgreSQL, pgvector, Edge Functions)
- **Worker**: Python, Docker, sentence-transformers, OCRmyPDF
- **Queue**: Upstash Redis
- **AI**: HuggingFace (embeddings), Google Gemini (chat)
- **Payments**: Paystack

### Important Conventions
- Use 384-dimensional vectors (not 768)
- Always check credits before chat operations
- Update document status for real-time feedback
- Follow RLS policies for security
- Use environment variables for all secrets

### Common Commands
```bash
# Start development
npm run dev

# Start worker
cd worker && docker-compose up --build

# Run tests
npm run test

# Check worker logs
docker-compose logs -f worker

# Check Redis queue
redis-cli -u $REDIS_URL LLEN pdf-processing
```

## Support

For questions or issues with these rules:
1. Check the project documentation in `/docs`
2. Review the README.md and QWEN.md files
3. Consult the specific rule file for detailed guidance

---

**Last Updated**: October 2024
**Project**: RAG Book - AI Study Assistant
**Version**: 1.0
