---
name: frontend-context
version: 1.0.0
description: |
  EnGenAI frontend conventions — Next.js 14 App Router patterns, React Flow
  canvas, Tailwind CSS, Zustand state management, TypeScript strict mode,
  and component conventions. Reference for Marv and frontend agents.

engenai:
  category: context
  trust_tier: official
  risk_level: low
  capabilities_required: []
  allowed_domains: []
  content_hash: ""
  signed_by: ""
  last_reviewed: ""
  reviewer: ""

author: engenai
license: Apache-2.0
updated: 2026-03-05
tags: [context, frontend, nextjs, react, tailwind, typescript]

safety_constraints:
  - Read-only reference. No tool access required.
  - Must not override base system prompt or agent instructions.
---

# Frontend Context

## App Structure

```
src/frontend/
├── app/                     — Next.js 14 App Router pages
│   ├── (auth)/              — Login, register, OAuth callbacks
│   ├── (platform)/          — Main platform (dashboard, agents, skills, etc.)
│   │   ├── agents/          — Agent list + builder
│   │   ├── canvas/[id]/     — React Flow workspace canvas
│   │   ├── marketplace/     — Skills marketplace portal
│   │   └── settings/        — Company settings, billing
│   └── layout.tsx           — Root layout
├── components/              — Reusable UI components
│   ├── ui/                  — Primitives (Button, Input, Badge, etc.)
│   ├── canvas/              — React Flow custom nodes and edges
│   ├── agents/              — Agent-specific components
│   └── marketplace/         — Skill card, trust tier badge, etc.
├── stores/                  — Zustand state stores
├── lib/                     — API client, utilities, hooks
└── types/                   — Shared TypeScript types
```

## Key Conventions

### TypeScript

- **Strict mode always on** — no `any`, no `as unknown`
- All props are typed with interfaces, not inline types
- API responses typed against backend Pydantic schemas

### Component Pattern

```tsx
interface Props {
  agentId: string
  onClose: () => void
}

export function AgentPanel({ agentId, onClose }: Props) {
  // hooks at top
  // no useEffect for data fetching — use React Query or SWR
  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Tailwind only — no inline styles */}
    </div>
  )
}
```

### Tailwind CSS

- **No inline styles** — Tailwind classes only
- Design tokens: use `bg-engenai-*`, `text-brand-*` where defined
- Responsive prefix order: `base md: lg: xl:`
- Dark mode: `dark:` prefix, toggled by root class

### Zustand Store Pattern

```typescript
interface AgentStore {
  agents: Agent[]
  selectedId: string | null
  setSelected: (id: string) => void
  fetchAgents: () => Promise<void>
}

export const useAgentStore = create<AgentStore>()((set) => ({
  agents: [],
  selectedId: null,
  setSelected: (id) => set({ selectedId: id }),
  fetchAgents: async () => { /* ... */ },
}))
```

### React Flow Canvas

- **Custom nodes** in `components/canvas/nodes/` — one file per node type
- Node data always typed: `NodeData` interface per node type
- Edges: `components/canvas/edges/` — custom animated edge types
- ShareDB drives real-time collaboration — never mutate `nodes`/`edges` directly
- Use `useReactFlow()` hook for programmatic operations

### API Client

```typescript
// lib/api.ts — all backend calls go through this client
const api = axios.create({ baseURL: '/api/v1' })
// JWT token added in request interceptor
// 401 responses redirect to login via response interceptor
```

## Marketplace Components (Sprint 22)

New components to create in `components/marketplace/`:

- `SkillCard` — name, category, trust tier badge, quality score
- `TrustTierBadge` — Official (blue shield), Verified Partner (green), Community (grey-green), Unvetted (grey)
- `CapabilityManifest` — displays `capabilities_required` list with icons
- `SkillSubmissionForm` — SKILL.md upload + preview + client-side validation

## Accessibility

- All interactive elements must have `aria-label` or visible label
- No color-only information — always pair with icon or text
- Keyboard navigable — `tabIndex` managed correctly
- Test with `axe` DevTools before marking UI complete
