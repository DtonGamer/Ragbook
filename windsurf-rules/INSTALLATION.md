# Installing Windsurf Rules for RAG Book

## Quick Installation

### Option 1: PowerShell Script (Recommended)
Run the installation script from your project root:

```powershell
.\windsurf-rules\install-rules.ps1
```

This will automatically copy all rule files to `.windsurf/rules/`.

### Option 2: Manual Installation
1. Create the rules directory:
   ```powershell
   mkdir .windsurf\rules
   ```

2. Copy the rule files:
   ```powershell
   Copy-Item windsurf-rules\*.md .windsurf\rules\ -Exclude README.md
   ```

## Verifying Installation

After installation, you should see these files in `.windsurf/rules/`:
- `01-general-coding-guidelines.md`
- `02-frontend-react-typescript.md`
- `03-backend-supabase-edge-functions.md`
- `04-python-worker.md`
- `05-database-architecture.md`
- `06-testing-debugging.md`

## Accessing Rules in Windsurf

1. Open Windsurf Cascade
2. Click the **Customizations** icon (top right slider menu)
3. Navigate to the **Rules** panel
4. You should see all installed rules listed

## Rule Activation

### Automatic Activation
- **General Guidelines**: Always active
- **Frontend Rules**: Auto-activate when editing files in `src/**/*.{ts,tsx,jsx,js}`
- **Backend Rules**: Auto-activate when editing files in `supabase/functions/**/*.ts`
- **Worker Rules**: Auto-activate when editing files in `worker/**/*.py`
- **Database Rules**: Auto-activate when editing files in `supabase/migrations/**/*.sql`

### Manual Activation
- **Testing Rules**: Mention `@testing` in your prompt to activate

## Customizing Rules

You can edit rules at any time:
1. Go to Customizations → Rules in Cascade
2. Click on any rule to view it
3. Click **Edit** to modify
4. Save your changes

Or edit the files directly in `.windsurf/rules/` and they'll be automatically updated.

## What These Rules Do

### 1. General Coding Guidelines (Always On)
Provides project context and core principles:
- Production-grade code standards
- Security and performance guidelines
- Documentation requirements
- Git practices

### 2. Frontend Rules (Auto-activated for React/TS files)
Guides React and TypeScript development:
- Component structure and hooks
- TypeScript best practices
- Tailwind CSS and shadcn/ui usage
- Real-time features with Supabase
- Error handling patterns

### 3. Backend Rules (Auto-activated for Edge Functions)
Covers Supabase Edge Function development:
- Authentication and authorization
- Database operations with RLS
- Redis queue integration
- Credit system implementation
- Vector search patterns

### 4. Python Worker Rules (Auto-activated for Python files)
Guides worker development:
- OCR processing with OCRmyPDF
- Embedding generation with HuggingFace
- Text chunking strategies
- Database operations
- Docker best practices

### 5. Database & Architecture Rules (Auto-activated for SQL files)
Covers database design and migrations:
- Schema design principles
- Row-Level Security (RLS) policies
- Vector search configuration with pgvector
- Migration best practices
- Performance optimization

### 6. Testing & Debugging Rules (Manual activation)
Provides testing and debugging guidance:
- Frontend, backend, and worker testing
- Common issues and solutions
- Debugging strategies
- Performance testing
- Monitoring approaches

## Benefits

With these rules, Cascade will:
- ✅ Understand your project architecture
- ✅ Follow your coding conventions
- ✅ Use the correct tech stack (React, Supabase, Python)
- ✅ Implement features according to best practices
- ✅ Generate production-ready code
- ✅ Maintain consistency across the codebase
- ✅ Handle security and performance correctly

## Troubleshooting

### Rules Not Showing Up
1. Verify files are in `.windsurf/rules/` directory
2. Restart Windsurf
3. Check file permissions
4. Ensure files have `.md` extension

### Rules Not Activating
1. Check the activation mode (Always On, Glob, Manual)
2. Verify glob patterns match your file paths
3. For manual rules, use the `@` mention syntax

### Need to Update Rules
1. Edit files in `.windsurf/rules/` directly, or
2. Use the Customizations panel in Cascade
3. Changes take effect immediately

## Next Steps

1. **Test the rules**: Ask Cascade to help with a coding task
2. **Customize as needed**: Adjust rules to match your preferences
3. **Share with team**: Commit `.windsurf/rules/` to git for team-wide consistency

## Support

- Check `windsurf-rules/README.md` for detailed rule documentation
- Review project docs in `/docs` directory
- Consult `README.md` and `QWEN.md` for project context

---

**Happy Coding with Cascade! 🚀**
