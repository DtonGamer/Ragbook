# RAG Book AI Agents

This directory contains specialized AI agents for the RAG Book UI/UX improvement project, organized in a 4-phase workflow:

## Phase 1: UX & Planning
- **[ux-researcher](./ux-researcher/agent.md)** - Conducts user research and defines user needs
- **[ux-writer](./ux-writer/agent.md)** - Creates user-centered copy and microcopy
- **[accessibility-specialist](./accessibility-specialist.md)** - Ensures accessibility compliance

## Phase 2: UI Design
- **[ui-designer](./ui-designer/agent.md)** - Creates visual designs and design system
- **[ux-writer](./ux-writer/agent.md)** - Refines copy based on visual design
- **[accessibility-specialist](./accessibility-specialist.md)** - Reviews designs for accessibility

## Phase 3: Implementation
- **[frontend-developer](./frontend-developer/agent.md)** - Implements components and pages
- **[accessibility-specialist](./accessibility-specialist.md)** - Implements accessibility features
- **[performance-analyst](./performance-analyst/agent.md)** - Optimizes performance

## Phase 4: Testing & Optimization
- **[qa-tester](./qa-tester/agent.md)** - Conducts comprehensive testing
- **[performance-analyst](./performance-analyst/agent.md)** - Validates performance metrics
- **[accessibility-specialist](./accessibility-specialist.md)** - Validates accessibility compliance

## Agent Collaboration Syntax
Agents collaborate using this syntax:
`[agent-name] to [task], then [agent-name] to [next task]`

## MCP Integration
All agents are designed to work with:
- **Context7 MCP**: For up-to-date documentation and best practices
- **Chrome DevTools MCP**: For browser automation, performance analysis, and accessibility testing