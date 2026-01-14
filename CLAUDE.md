# ReplyGuys.app - Claude Instructions

## Project Overview
Audience-intelligence engine for X creators. Scrapes replies to "Question" posts, uses AI to evaluate them, and generates visual reports.

**MVP Scope:** Auth (X OAuth) → Submit URL → Scrape replies → Store in DB → Live dashboard with realtime updates. AI evaluation and infographic generation come later.

---

## Tech Stack
- **Framework:** Next.js 16 (App Router) + React 19 (React Compiler enabled)
- **Styling:** Tailwind CSS + shadcn/ui (theme already configured, dark mode default)
- **Database:** Supabase (Postgres) + Supabase Realtime
- **Auth:** X OAuth (for login + posting permissions)
- **Workflows:** Inngest (event-driven pipelines)
- **Scraping:** Apify (`kaitoeasyapi/twitter-x-data-tweet-scraper-pay-per-result-cheapest`)
- **AI:** Gemini 1.5 Pro via Vercel AI SDK (later phase)

---

## Code Conventions

### Server-First
- Default to **Server Components** (90% of UI)
- Push `"use client"` as far down the tree as possible
- Ask: "Does this need interactivity?" If no, keep it server-side

### No useEffect
- Never use `useEffect` for data fetching
- Fetch in Server Components or via event handlers
- For state sync, use `key` prop or derive during render
- If you must run code on mount, create a custom hook

### React Compiler
- No manual `useMemo` or `useCallback` - compiler handles it
- No premature optimization

### Supabase
- **Server:** `createClient()` from `@/lib/supabase/server`
- **Client:** `createClient()` from `@/lib/supabase/client`
- Always use `getUser()` for auth checks (never `getSession()`)
- Always destructure and check `{ data, error }`
- Use `.select('col1, col2')` - never `select('*')`
- Use `.single()` or `.maybeSingle()` for single-row queries

### Forms
- Use `next/form` for all forms
- Validate client-side first, always re-validate server-side

### Error Handling
- Expected errors (business logic): return `{ success: false, error: string }`
- Unexpected errors: let them bubble to error boundaries
- Use `error.tsx` for route-level error UI
- Never expose "user not found" vs "wrong password"

### Comments
- Explain WHY, not WHAT
- 1-2 lines max
- No commented-out code
- No decorative blocks or ASCII art

### Animations
- Use Framer Motion, prefer `opacity` and `transform`
- Respect `prefers-reduced-motion`
- Isolate in `"use client"` components

---

## File Structure
```
app/
  (auth)/           # Auth routes (login, signup, callback)
  (dashboard)/      # Protected routes
  api/inngest/      # Inngest webhook endpoint
lib/
  supabase/
    client.ts       # Browser client
    server.ts       # Server client
    proxy.ts        # Middleware session refresh
  inngest/
    client.ts       # Inngest client
components/
  ui/               # shadcn components
```

---

## Key Patterns

### Server Actions
```typescript
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };
```

### Parallel Data Fetching
```typescript
const [users, posts] = await Promise.all([
  fetchUsers(),
  fetchPosts()
]);
```

### Supabase Query
```typescript
const supabase = await createClient();
const { data, error } = await supabase
  .from('reports')
  .select('id, status, x_post_url')
  .eq('user_id', userId)
  .single();

if (error) throw new Error('Failed to load report');
```

### Realtime Subscription (Client Component)
```typescript
useEffect(() => {
  const channel = supabase
    .channel('replies')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'replies' }, handler)
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, []);
```

---

## Database Schema

### profiles
`id` (uuid, PK) | `x_username` | `avatar_url` | `bio`

### x_credentials (encrypted)
`id` | `user_id` (FK) | `access_token` | `refresh_token` | `expires_at`

### reports
`id` | `user_id` (FK) | `x_post_url` | `status` (enum) | `config` (jsonb) | `summary_json` | `infographic_url`

### replies
`id` (tweet ID) | `report_id` (FK) | `username` | `is_premium` | `text` | `evaluation` (jsonb)

---

## Environment Variables
See `env.example`. Local Supabase is configured in `.env.local`.

---

## Commands
```bash
bun dev          # Start dev server
bun build        # Production build
npx inngest-cli dev  # Inngest dev server
supabase start   # Local Supabase
```
