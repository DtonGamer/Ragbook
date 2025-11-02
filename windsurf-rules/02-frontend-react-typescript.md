# Frontend Development Rules (React + TypeScript)

**Activation Mode**: Glob Pattern: `src/**/*.{ts,tsx,jsx,js}`

## Tech Stack
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **State Management**: React hooks + TanStack Query
- **Routing**: React Router v6
- **Build Tool**: Vite

## React Best Practices

### Component Structure
- Use functional components with hooks
- Keep components small and focused (single responsibility)
- Extract reusable logic into custom hooks
- Place custom hooks in `src/hooks/` directory
- Use shadcn/ui components from `src/components/ui/`

### TypeScript Usage
- Always define proper types and interfaces
- Avoid using `any` - use `unknown` if type is truly unknown
- Use type inference where appropriate
- Define props interfaces for all components
- Use Supabase-generated types from `src/integrations/supabase/types.ts`

### State Management
- Use `useState` for local component state
- Use `useEffect` carefully - always specify dependencies
- Leverage TanStack Query for server state (documents, subscriptions, etc.)
- Use custom hooks for shared logic:
  - `useAuth` for authentication
  - `useSubscription` for credits and plans
  - `useDocumentStatus` for real-time updates

### Styling Guidelines
- Use Tailwind CSS utility classes
- Follow shadcn/ui component patterns
- Maintain responsive design (mobile-first approach)
- Use consistent spacing and color schemes
- Leverage Tailwind's design tokens

### Real-Time Features
- Subscribe to Supabase Realtime for document status updates
- Clean up subscriptions in useEffect cleanup functions
- Handle connection errors gracefully
- Show loading states during real-time operations

### Error Handling
- Use error boundaries for component-level errors
- Display user-friendly error messages with toast notifications
- Log errors to console for debugging
- Handle async errors in try-catch blocks

## File Naming Conventions
- Components: PascalCase (e.g., `ChatMessage.tsx`)
- Hooks: camelCase with 'use' prefix (e.g., `useDocumentStatus.ts`)
- Utilities: camelCase (e.g., `formatDate.ts`)
- Types: PascalCase (e.g., `DocumentTypes.ts`)

## Import Organization
```typescript
// 1. External libraries
import React from 'react';
import { useQuery } from '@tanstack/react-query';

// 2. Internal components
import { Button } from '@/components/ui/button';
import ChatMessage from '@/components/ChatMessage';

// 3. Hooks and utilities
import { useAuth } from '@/hooks/useAuth';
import { formatDate } from '@/lib/utils';

// 4. Types
import type { Document } from '@/integrations/supabase/types';
```

## Common Patterns

### Supabase Integration
- Use the Supabase client from `src/integrations/supabase/client.ts`
- Always handle authentication state
- Use RLS-protected queries
- Handle session expiration gracefully

### Credit System
- Always check credits before chat operations
- Display remaining credits prominently
- Show upgrade prompts when credits are low
- Update credits display in real-time after operations

### Document Upload
- Validate file type and size before upload
- Show upload progress
- Handle upload errors gracefully
- Update UI with real-time status changes
