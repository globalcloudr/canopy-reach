# Canopy Reach

Social media scheduling and publishing product for the Canopy platform.

**GitHub**: https://github.com/globalcloudr/canopy-reach
**Live URL**: https://canopy-reach.vercel.app
**Status**: In development

## What Is Built

### Phase 1 — App scaffold
- Next.js 16 app with App Router, TypeScript, Tailwind v4, @canopy/ui vendored
- `ReachShell` — full app shell with Canopy portal token handoff, workspace resolution, sidebar nav
- Supabase lazy singleton client
- CLAUDE.md, env example

### Phase 2 — Data layer
- DB schema: `reach_integrations`, `reach_posts`, `reach_guidelines`, `reach_templates`
- `lib/reach-schema.ts` — all TypeScript types and platform constants
- `lib/postiz-client.ts` — server-side Postiz API wrapper
- `lib/reach-data.ts` — Supabase CRUD for all four tables

### Phase 3 — Pages and API routes

**Pages:**
- `/` — Dashboard: stats (scheduled, published this month, connected accounts), next post preview, connect warning
- `/calendar` — Filterable post list (all/scheduled/published/draft), grouped by date
- `/posts/new` — Post composer: platform picker, body with character limit, templates, media URL, post now/schedule/draft
- `/posts/[id]` — Post detail with per-post engagement stats
- `/connect` — Platform connection flow: OAuth via Postiz, sync button, disconnect
- `/guidelines` — Read view for staff, edit view for operators
- `/settings` — Workspace info

**API routes:**
- `GET/POST /api/posts` — list with status/date filters, create (draft/schedule/now)
- `GET/DELETE /api/posts/[id]` — detail + analytics, delete from Postiz and DB
- `GET /api/integrations` — list connected accounts for workspace
- `DELETE /api/integrations/[id]` — disconnect account
- `GET /api/integrations/oauth-url` — get Postiz OAuth URL per platform
- `POST /api/integrations/sync` — pull integrations from Postiz, match to platforms, upsert to DB
- `GET/POST /api/guidelines` — read and save guidelines
- `GET /api/templates` — list post templates

## What Is Not Done Yet

- Canopy portal launch route (`/auth/launch/reach`)
- `REACH_APP_URL` env var in portal
- Portal dashboard card
- PhotoVault media browser integration (post composer currently supports URL-only media)

## How to Run

```bash
npm install
npm run dev     # runs at localhost:3000
```

## Environment Variables

Copy `.env.local.example` to `.env.local` and fill in values:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
POSTIZ_API_KEY=
POSTIZ_API_URL=https://api.postiz.com/public/v1
NEXT_PUBLIC_PORTAL_URL=https://usecanopy.school
```

## Database

Shared Supabase project with canopy-platform, photovault, and canopy-stories.

Product-owned tables: `reach_integrations`, `reach_posts`, `reach_guidelines`, `reach_templates`

Migration SQL files are in `docs/sql/`.
